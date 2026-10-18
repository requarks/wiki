import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { navigation as navigationTable, tree as treeTable } from '../db/schema.ts'
import { encodeTreePath, isNoteImagesPath } from '../helpers/common.ts'
import { relinkHref, resolveLink } from '../helpers/pageLinks.ts'
import type { NavigationItem } from './navigation.ts'

/**
 * The site settings this model answers to, under `navigation` in a site's config — the Automations
 * card of the admin area's Navigation screen. All on for a site created since they exist, all off
 * on one that predates them.
 */
export interface NavigationAutomationSettings {
  addPagesToParentMenu: boolean
  removePagesFromParentMenu: boolean
  migrateLinksOnMove: boolean
  updateLabelsOnRename: boolean
  createFolderMenus: boolean
  deleteOrphanedMenus: boolean
  /** Also act on what an import or a storage sync does, not only on what a person does. */
  includeStorageOperations: boolean
}

/** A page, as the automations need to know it: where it sits and what it is called. */
export interface AutomatedPage {
  id: string
  locale: string
  /** Slash path, `home` for a locale's home page. */
  path: string
  title: string
  icon?: string | null
  alias?: string | null
}

/** A folder, as the automations need to know it. */
export interface AutomatedFolder {
  id: string
  locale: string
  /** Slash path of the folder itself. */
  path: string
  title: string
}

/** Where a page or folder sat, or sits — a locale and a slash path. */
interface Location {
  locale: string
  path: string
}

/**
 * The icon a link the wiki adds for a page starts with, where the page has none of its own — the same
 * one the navigation editor gives a new link.
 */
const DEFAULT_LINK_ICON = 'mdi:text-box-outline'

/** The icon of a menu item the wiki adds for a folder — the same one the editor gives a new one. */
const DEFAULT_MENU_ICON = 'mdi:folder-outline'

/** The slash path of the folder holding a path: empty at the site root. */
function parentOf(slashPath: string): string {
  const parent = path.posix.dirname(slashPath)
  return parent === '.' ? '' : parent
}

/** A page path, with the site root and its home page treated as the one page they are. */
function samePagePath(a: string | null, b: string): boolean {
  const home = (p: string | null) => (p === '' || p === 'home' ? 'home' : p)
  return home(a) === home(b)
}

/**
 * Every item of a menu, top level and nested, passed through `fn` — which answers the item to keep
 * (itself or a changed copy), or null to remove it.
 *
 * A removed link that was a parent hands its children up to the place it held, rather than taking
 * them with it: they are other links to other pages, and the automation was only ever about one.
 *
 * @returns The new items, or null when nothing changed
 */
function mapItems(
  items: NavigationItem[],
  fn: (item: NavigationItem) => NavigationItem | null
): NavigationItem[] | null {
  let changed = false
  const out: NavigationItem[] = []
  for (const item of items) {
    // -> A new array of children only when one of them changed: an untouched parent is the same
    //    object, which is what "nothing changed" is told by
    let children = item.children
    if (item.children?.length) {
      let childChanged = false
      const next: NavigationItem[] = []
      for (const child of item.children) {
        const kept = fn(child)
        if (kept !== child) {
          childChanged = true
        }
        if (kept) {
          next.push(kept)
        }
      }
      if (childChanged) {
        children = next
      }
    }
    const kept = fn(children === item.children ? item : { ...item, children })
    if (kept === null) {
      changed = true
      // -> Its children survive it, flattened to the top level where it stood
      out.push(...(children ?? []).map((child) => ({ ...child, children: [] })))
      continue
    }
    if (kept !== item) {
      changed = true
    }
    out.push(kept)
  }
  return changed ? out : null
}

/** Whether any item of a menu, top level or nested, answers to `test`. */
function someItem(items: NavigationItem[], test: (item: NavigationItem) => boolean): boolean {
  return items.some((item) => test(item) || (item.children ?? []).some(test))
}

/**
 * Navigation automations
 *
 * What the Automations settings of a site do: keep its menus in step with the pages and folders they
 * point at, as those are created, deleted, moved and renamed. Each is a site setting.
 *
 * Called from the models, at the point each change has succeeded, rather than from the routes — so
 * that a change made by an import or a storage sync is seen too, and then acted on only where the
 * site asked for that (`includeStorageOperations`). Nothing here is queued: a menu is changed in the
 * same request as the page that changed it, so a reader who follows the new page never meets a
 * sidebar that has not caught up. The one exception is the sweep of orphaned menus, which is a
 * question about the whole site rather than about one change, and runs on a schedule.
 *
 * Nothing here ever fails the change it follows. A menu that could not be updated is logged and left
 * as it was: the page was saved, and a stale link is something an editor can fix by hand.
 *
 * A menu's items are rewritten under a row lock, so two pages created in one folder at once both end
 * up in its menu rather than one overwriting the other's link.
 */
class NavigationAutomation {
  /** The site's automation settings, as stored. */
  settingsFor(siteId: string): Partial<NavigationAutomationSettings> {
    return WIKI.sites[siteId]?.config?.navigation ?? {}
  }

  /**
   * Whether an automation should act on the change in hand: switched on, and the change is a
   * person's — or it is the storage's, and the site asked for those too.
   */
  isOn(
    siteId: string,
    key: Exclude<keyof NavigationAutomationSettings, 'includeStorageOperations'>
  ) {
    const settings = this.settingsFor(siteId)
    if (!settings[key]) {
      return false
    }
    return (
      WIKI.models.notifications.originNow() !== 'import' ||
      Boolean(settings.includeStorageOperations)
    )
  }

  /** Run an automation without letting it fail the change it follows. */
  private async guarded(label: string, work: () => Promise<void>): Promise<void> {
    try {
      await work()
    } catch (err: any) {
      WIKI.logger.warn(`Navigation automation (${label}) failed: ${err.message}`)
    }
  }

  // ------------------------------------------------------------------------------------------------
  // MENUS
  // ------------------------------------------------------------------------------------------------

  /**
   * The menu owned at a folder path — the "direct parent menu" of whatever sits in that folder.
   *
   * At the site root that is the locale's own menu. Anywhere else it is a menu owned exactly there,
   * by the folder or by the page at that path, in a mode that owns one (override, or override for
   * the current path only) — never one inherited from further up, which is not that folder's to add
   * to. The page wins a tie, as it does when descendants resolve their sidebar.
   *
   * @param folderPath Slash path of the folder, empty at the site root
   * @returns The menu's id, or null when nothing owns a menu there
   */
  async parentMenuAt(siteId: string, locale: string, folderPath: string): Promise<string | null> {
    if (!folderPath) {
      return WIKI.models.navigation.siteNavId(siteId, locale)
    }
    const segments = folderPath.split('/')
    const owners = await WIKI.db
      .select({ id: treeTable.id, type: treeTable.type })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          inArray(treeTable.type, ['page', 'folder']),
          inArray(treeTable.navigationMode, ['override', 'overrideExact']),
          eq(treeTable.folderPath, encodeTreePath(segments.slice(0, -1).join('/'))),
          eq(treeTable.fileName, segments.at(-1)!)
        )
      )
    const owner = owners.find((row) => row.type === 'page') ?? owners[0]
    if (!owner) {
      return null
    }
    // -> The home page at the root edits the locale's own menu rather than one of its own
    if (folderPath === 'home' && owner.type === 'page') {
      return WIKI.models.navigation.siteNavId(siteId, locale)
    }
    return owner.id
  }

  /**
   * The folder at a path, if there is one — which shares the path of the page beside it, and whose
   * menu item with `showLink` on is therefore already a link to that page.
   */
  async folderIdAt(siteId: string, locale: string, slashPath: string): Promise<string | null> {
    const segments = slashPath.split('/').filter(Boolean)
    if (segments.length < 1) {
      return null
    }
    const rows = await WIKI.db
      .select({ id: treeTable.id })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          eq(treeTable.type, 'folder'),
          eq(treeTable.folderPath, encodeTreePath(segments.slice(0, -1).join('/'))),
          eq(treeTable.fileName, segments.at(-1)!)
        )
      )
      .limit(1)
    return rows[0]?.id ?? null
  }

  /**
   * Rewrite one menu's items, under a lock on its row.
   *
   * A menu owned by a tree entry exists from the moment its owner overrides, but its row only from
   * the first time items are saved to it — so a missing row is an empty menu, and is created by the
   * first change made to it.
   *
   * @param fn Answers the new items, or null to leave the menu as it is
   */
  async editMenu(
    siteId: string,
    navId: string,
    fn: (items: NavigationItem[]) => NavigationItem[] | null
  ): Promise<boolean> {
    return WIKI.db.transaction(async (tx) => {
      const rows = await tx
        .select({ items: navigationTable.items })
        .from(navigationTable)
        .where(and(eq(navigationTable.id, navId), eq(navigationTable.siteId, siteId)))
        .for('update')
      const next = fn((rows[0]?.items ?? []) as NavigationItem[])
      if (!next) {
        return false
      }
      if (rows[0]) {
        await tx.update(navigationTable).set({ items: next }).where(eq(navigationTable.id, navId))
      } else {
        await tx
          .insert(navigationTable)
          .values({ id: navId, siteId, items: next })
          .onConflictDoUpdate({ target: navigationTable.id, set: { items: next } })
      }
      return true
    })
  }

  /** Every menu of a site, with the locale its links are read in. */
  private async menusOf(siteId: string): Promise<{ id: string; locale: string }[]> {
    const owners = await WIKI.models.navigation.describeNavs(siteId)
    const primary = WIKI.sites[siteId]?.config?.locales?.primary ?? 'en'
    return [...owners.values()].map((owner) => ({ id: owner.id, locale: owner.locale ?? primary }))
  }

  // ------------------------------------------------------------------------------------------------
  // LINKS
  // ------------------------------------------------------------------------------------------------

  /** A link to a page, as the navigation editor would write one. */
  private linkTo(siteId: string, page: AutomatedPage): NavigationItem {
    return {
      id: randomUUID(),
      type: 'link',
      label: page.title,
      icon: page.icon || DEFAULT_LINK_ICON,
      target: WIKI.models.pages.urlFor(siteId, page.locale, page.path),
      openInNewWindow: false,
      expandByDefault: false,
      visibilityGroups: [],
      children: []
    }
  }

  /**
   * Whether a link goes to a page — by its path in its locale, or by one of the two short links that
   * name it (`/i/<id>`, `/a/<alias>`). Resolved the way a link in page content is, so a target
   * written with or without the locale prefix, an extension, a trailing slash or a fragment all
   * count.
   *
   * @param menuLocale The locale of the menu holding the link, which a relative target resolves in
   */
  private pointsAt(
    siteId: string,
    item: NavigationItem,
    menuLocale: string,
    page: { id?: string; alias?: string | null; locale: string; path: string }
  ): boolean {
    if (item.type !== 'link' || !item.target) {
      return false
    }
    const link = resolveLink(item.target, { siteId, locale: menuLocale, path: '' })
    if (!link || link.targetSiteId !== siteId) {
      return false
    }
    switch (link.kind) {
      case 'page':
        return link.targetLocale === page.locale && samePagePath(link.targetPath, page.path)
      case 'pageId':
        return Boolean(page.id) && link.targetRef === page.id
      case 'alias':
        return Boolean(page.alias) && link.targetRef === page.alias
      default:
        return false
    }
  }

  /**
   * Where a link under a moved folder goes now, or null when it does not go under that folder — the
   * folder's own path is not under it, since that is the page beside it, which did not move.
   */
  private relocatedUnder(
    siteId: string,
    item: NavigationItem,
    menuLocale: string,
    from: Location,
    to: Location
  ): string | null {
    if (item.type !== 'link' || !item.target) {
      return null
    }
    const link = resolveLink(item.target, { siteId, locale: menuLocale, path: '' })
    if (
      link?.kind !== 'page' ||
      link.targetSiteId !== siteId ||
      link.targetLocale !== from.locale ||
      !link.targetPath?.startsWith(`${from.path}/`)
    ) {
      return null
    }
    return relinkHref(
      item.target,
      { siteId, locale: menuLocale, path: '' },
      { siteId, locale: to.locale, path: `${to.path}${link.targetPath.slice(from.path.length)}` }
    )
  }

  /** A link's target, pointed at where a page now is — written the way the old one was. */
  private retarget(siteId: string, item: NavigationItem, menuLocale: string, to: Location) {
    return (
      relinkHref(
        item.target ?? '',
        { siteId, locale: menuLocale, path: '' },
        { siteId, locale: to.locale, path: to.path }
      ) ?? WIKI.models.pages.urlFor(siteId, to.locale, to.path)
    )
  }

  // ------------------------------------------------------------------------------------------------
  // PAGES
  // ------------------------------------------------------------------------------------------------

  /**
   * A page has been created — or restored, which puts it back where its link was taken from.
   *
   * Add New Pages to Direct Parent Menu: a link to it at the end of the menu owned by the folder it
   * is in, unless that menu already links to it.
   */
  async pageCreated(siteId: string, page: AutomatedPage): Promise<void> {
    if (!this.isOn(siteId, 'addPagesToParentMenu')) {
      return
    }
    await this.guarded('add page to parent menu', async () => {
      const navId = await this.parentMenuAt(siteId, page.locale, parentOf(page.path))
      if (!navId) {
        return
      }
      // -> A folder at the page's own path whose menu item links to it already: the blog's front page
      //    arriving after its posts made its folder, say. A second entry for the same page is noise
      const folderId = await this.folderIdAt(siteId, page.locale, page.path)
      await this.editMenu(siteId, navId, (items) =>
        someItem(
          items,
          (item) =>
            this.pointsAt(siteId, item, page.locale, page) ||
            (item.type === 'menu' && item.showLink === true && item.targetNavId === folderId)
        )
          ? null
          : [...items, this.linkTo(siteId, page)]
      )
    })
  }

  /**
   * A page has been deleted.
   *
   * Remove Pages from Direct Parent Menu on Delete: every link to it in the menu owned by the folder
   * it was in, wherever in that menu it sat.
   */
  async pageDeleted(siteId: string, page: AutomatedPage): Promise<void> {
    if (!this.isOn(siteId, 'removePagesFromParentMenu')) {
      return
    }
    await this.guarded('remove page from parent menu', async () => {
      const navId = await this.parentMenuAt(siteId, page.locale, parentOf(page.path))
      if (!navId) {
        return
      }
      await this.editMenu(siteId, navId, (items) =>
        mapItems(items, (item) => (this.pointsAt(siteId, item, page.locale, page) ? null : item))
      )
    })
  }

  /**
   * A page has moved — to another folder, or within its own by a rename.
   *
   * Migrate Link from Direct Parent Menu on Page Move:
   * - Within the same menu, every link to it is pointed at where it now is.
   * - Into another, the link is taken out of the menu of the folder it left and put at the end of the
   *   menu of the folder it arrived in, keeping its label, icon and visibility. Where that folder owns
   *   no menu it is not put back anywhere. Where there was no link to take, a new one is added there,
   *   as for a page created in that folder.
   * - And any link to it in any other menu of the site is pointed at where it now is, since a link
   *   to where a page used to be is a link to nothing.
   */
  async pageMoved(siteId: string, page: AutomatedPage, from: Location): Promise<void> {
    if (!this.isOn(siteId, 'migrateLinksOnMove')) {
      return
    }
    await this.guarded('migrate page link', async () => {
      const to: Location = { locale: page.locale, path: page.path }
      const oldNavId = await this.parentMenuAt(siteId, from.locale, parentOf(from.path))
      const newNavId = await this.parentMenuAt(siteId, to.locale, parentOf(to.path))
      const was = { id: page.id, alias: page.alias, ...from }

      let carried: NavigationItem | null = null
      if (oldNavId && oldNavId !== newNavId) {
        await this.editMenu(siteId, oldNavId, (items) =>
          mapItems(items, (item) => {
            if (!this.pointsAt(siteId, item, from.locale, was)) {
              return item
            }
            carried ??= item
            return null
          })
        )
      }
      if (newNavId && carried) {
        const moved: NavigationItem = {
          ...(carried as NavigationItem),
          target: this.retarget(siteId, carried, to.locale, to),
          // -> It may have been nested where it was, and arrives at the top level of its new menu
          children: (carried as NavigationItem).children ?? []
        }
        await this.editMenu(siteId, newNavId, (items) => [...items, moved])
      } else if (newNavId && newNavId !== oldNavId) {
        // -> Nothing to carry — it was never in the menu it left, or the setting came on after it was
        //    created — so it arrives as a new page would, unless its new menu already reaches it: by
        //    a link to either place it has been, or by the item of the folder at its new path
        const folderId = await this.folderIdAt(siteId, to.locale, to.path)
        const now = { id: page.id, alias: page.alias, ...to }
        await this.editMenu(siteId, newNavId, (items) =>
          someItem(
            items,
            (item) =>
              this.pointsAt(siteId, item, to.locale, now) ||
              this.pointsAt(siteId, item, to.locale, was) ||
              (item.type === 'menu' && item.showLink === true && item.targetNavId === folderId)
          )
            ? null
            : [...items, this.linkTo(siteId, page)]
        )
      }

      // -> Every other link to it, the menu it stayed in included, pointed at where it is now
      for (const menu of await this.menusOf(siteId)) {
        if (menu.id === oldNavId && oldNavId !== newNavId) {
          continue
        }
        await this.editMenu(siteId, menu.id, (items) =>
          mapItems(items, (item) =>
            this.pointsAt(siteId, item, menu.locale, was)
              ? { ...item, target: this.retarget(siteId, item, menu.locale, to) }
              : item
          )
        )
      }
    })
  }

  /**
   * A page's title or icon has changed.
   *
   * Update Link Labels on Page/Folder Title Change: every link to it whose label was its old title
   * takes the new one, as does a menu item opening the page's own menu — and likewise its icon. A
   * label or an icon anybody chose to say something else is theirs, and is left alone.
   *
   * A link to a page with no icon was given the default one (`linkTo`), so for a link that default is
   * the page's old icon too. Not for a menu item, which starts with the folder icon: one follows the
   * page's icon only when it was showing exactly that icon.
   */
  async pageRelabeled(
    siteId: string,
    page: AutomatedPage,
    previous: { title: string; icon?: string | null }
  ): Promise<void> {
    const titleChanged = previous.title !== page.title
    const iconChanged = (previous.icon ?? '') !== (page.icon ?? '')
    if ((!titleChanged && !iconChanged) || !this.isOn(siteId, 'updateLabelsOnRename')) {
      return
    }
    await this.guarded('update page link labels', async () => {
      // -> And the menu item of the folder beside it, whose link half is a link to this page
      const folderId = await this.folderIdAt(siteId, page.locale, page.path)
      for (const menu of await this.menusOf(siteId)) {
        await this.editMenu(siteId, menu.id, (items) =>
          mapItems(items, (item) => {
            const isMenu =
              (item.type === 'menu' && item.targetNavId === page.id) ||
              (item.type === 'menu' && item.showLink === true && item.targetNavId === folderId)
            if (!isMenu && !this.pointsAt(siteId, item, menu.locale, page)) {
              return item
            }
            const next = { ...item }
            if (titleChanged && item.label === previous.title) {
              next.label = page.title
            }
            if (iconChanged) {
              const oldIcon = isMenu ? previous.icon : previous.icon || DEFAULT_LINK_ICON
              if (oldIcon && item.icon === oldIcon) {
                next.icon = isMenu ? page.icon || DEFAULT_MENU_ICON : page.icon || DEFAULT_LINK_ICON
              }
            }
            return next.label !== item.label || next.icon !== item.icon ? next : item
          })
        )
      }
    })
  }

  // ------------------------------------------------------------------------------------------------
  // FOLDERS
  // ------------------------------------------------------------------------------------------------

  /**
   * A folder has come into existence — created on its own, or along the way of something written
   * into a path that did not exist yet.
   *
   * Create Menu on Folder Creation: the folder overrides its sidebar with a menu of its own, empty,
   * for everything under it. And with Add New Pages to Direct Parent Menu on as well, a menu item
   * opening that menu goes at the end of the menu owned by the folder holding it, as a link and a
   * chevron both — which is how a section of the site gets into the menu above it.
   *
   * Never for the live notes' image folder (`NOTE_IMAGES_FOLDER`), which the first image pasted into
   * a note creates: it is hidden from everybody, so a menu item opening it would be a link to nothing
   * in the site's root menu.
   */
  async folderCreated(siteId: string, folder: AutomatedFolder): Promise<void> {
    if (isNoteImagesPath(folder.path) || !this.isOn(siteId, 'createFolderMenus')) {
      return
    }
    await this.guarded('create folder menu', async () => {
      await WIKI.models.navigation.updateNavigation({
        siteId,
        pageId: folder.id,
        mode: 'override',
        items: []
      })
      if (!this.isOn(siteId, 'addPagesToParentMenu')) {
        return
      }
      const navId = await this.parentMenuAt(siteId, folder.locale, parentOf(folder.path))
      if (!navId) {
        return
      }
      await this.editMenu(siteId, navId, (items) => {
        if (items.some((item) => item.type === 'menu' && item.targetNavId === folder.id)) {
          return null
        }
        const menuItem: NavigationItem = {
          id: randomUUID(),
          type: 'menu',
          label: folder.title,
          icon: DEFAULT_MENU_ICON,
          targetNavId: folder.id,
          showLink: true,
          visibilityGroups: []
        }
        /*
          A link to the page at the folder's own path -- the blog's front page, before its first post
          made the folder -- is what this item now is, link half and all. It takes that link's place,
          and keeps how it was labelled, drawn and shown, since it goes to the same page. Only a link at
          the top level can be replaced where it stands: a menu item cannot be nested, so one under a
          parent link gives way and the item goes at the end.
        */
        const besidePage = { locale: folder.locale, path: folder.path }
        const at = items.findIndex((item) => this.pointsAt(siteId, item, folder.locale, besidePage))
        const standIn = (link: NavigationItem): NavigationItem => ({
          ...menuItem,
          label: link.label ?? menuItem.label,
          icon: link.icon || menuItem.icon,
          visibilityGroups: link.visibilityGroups ?? []
        })
        if (at >= 0) {
          const next = [...items]
          const replaced = items[at]
          // -> Whatever was nested under the link stays, at the top level after it
          next.splice(
            at,
            1,
            standIn(replaced),
            ...(replaced.children ?? []).map((child) => ({ ...child, children: [] }))
          )
          return next
        }
        let nested: NavigationItem | null = null
        const without = mapItems(items, (item) => {
          if (this.pointsAt(siteId, item, folder.locale, besidePage)) {
            nested ??= item
            return null
          }
          return item
        })
        return [...(without ?? items), nested ? standIn(nested) : menuItem]
      })
    })
  }

  /**
   * A folder has been deleted, with everything in it.
   *
   * Remove Pages from Direct Parent Menu on Delete: the menu items opening its menu, in the menu of
   * the folder that held it. Its own menu went with it, and so did those of everything below it.
   */
  async folderDeleted(siteId: string, folder: AutomatedFolder): Promise<void> {
    if (!this.isOn(siteId, 'removePagesFromParentMenu')) {
      return
    }
    await this.guarded('remove folder from parent menu', async () => {
      const navId = await this.parentMenuAt(siteId, folder.locale, parentOf(folder.path))
      if (!navId) {
        return
      }
      await this.editMenu(siteId, navId, (items) =>
        mapItems(items, (item) =>
          item.type === 'menu' && item.targetNavId === folder.id ? null : item
        )
      )
    })
  }

  /**
   * A folder has moved — to another parent, to another locale, or by a rename of its path name —
   * taking every page under it along.
   *
   * Migrate Link from Direct Parent Menu on Page Move, for a whole branch at once:
   * - Every link in the site to a page under it is pointed at where that page now is. Its own menu
   *   and those below it moved with it — they are keyed by entry — so it is the links inside them,
   *   and in any other menu, that have to follow.
   * - With a new parent, the menu items opening its menu are taken out of the menu of the folder it
   *   left and put at the end of the one it arrived in, as a page's link is. Where that folder owns no
   *   menu they are not put back.
   */
  async folderMoved(siteId: string, folder: AutomatedFolder, from: Location): Promise<void> {
    if (!this.isOn(siteId, 'migrateLinksOnMove')) {
      return
    }
    await this.guarded('migrate folder links', async () => {
      const to: Location = { locale: folder.locale, path: folder.path }
      for (const menu of await this.menusOf(siteId)) {
        await this.editMenu(siteId, menu.id, (items) =>
          mapItems(items, (item) => {
            const target = this.relocatedUnder(siteId, item, menu.locale, from, to)
            return target ? { ...item, target } : item
          })
        )
      }

      const oldNavId = await this.parentMenuAt(siteId, from.locale, parentOf(from.path))
      const newNavId = await this.parentMenuAt(siteId, to.locale, parentOf(to.path))
      if (!oldNavId || oldNavId === newNavId) {
        return
      }
      const carried: NavigationItem[] = []
      await this.editMenu(siteId, oldNavId, (items) =>
        mapItems(items, (item) => {
          if (item.type === 'menu' && item.targetNavId === folder.id) {
            carried.push(item)
            return null
          }
          return item
        })
      )
      if (newNavId && carried.length > 0) {
        await this.editMenu(siteId, newNavId, (items) => [...items, ...carried])
      }
    })
  }

  /**
   * A folder's title has changed.
   *
   * Update Link Labels on Page/Folder Title Change: every menu item opening its menu whose label was
   * its old title takes the new one.
   */
  async folderRetitled(
    siteId: string,
    folder: AutomatedFolder,
    previousTitle: string
  ): Promise<void> {
    if (previousTitle === folder.title || !this.isOn(siteId, 'updateLabelsOnRename')) {
      return
    }
    await this.guarded('update folder menu labels', async () => {
      for (const menu of await this.menusOf(siteId)) {
        await this.editMenu(siteId, menu.id, (items) =>
          mapItems(items, (item) =>
            item.type === 'menu' && item.targetNavId === folder.id && item.label === previousTitle
              ? { ...item, label: folder.title }
              : item
          )
        )
      }
    })
  }

  // ------------------------------------------------------------------------------------------------
  // ORPHANED MENUS
  // ------------------------------------------------------------------------------------------------

  /**
   * Delete Menu When Orphaned: drop every menu nothing reaches any more, on every site that asked.
   *
   * Orphaned is a menu that is not a locale's own, is the sidebar of no page or folder, and is opened
   * by no menu item — one left behind when the entry owning it went back to inheriting, or started
   * hiding its sidebar. Run on a schedule rather than at each of those moments, because what makes a
   * menu unreachable is spread across every mode change, every move and every menu save.
   *
   * @returns How many menus were deleted
   */
  async purgeOrphanedMenus(): Promise<number> {
    let purged = 0
    for (const siteId of Object.keys(WIKI.sites ?? {})) {
      if (!this.settingsFor(siteId).deleteOrphanedMenus) {
        continue
      }
      const deleted = await WIKI.db
        .delete(navigationTable)
        .where(
          and(
            eq(navigationTable.siteId, siteId),
            isNull(navigationTable.locale),
            sql`NOT EXISTS (
              SELECT 1 FROM tree t
              WHERE t."siteId" = ${navigationTable.siteId} AND t."navigationId" = ${navigationTable.id}
            )`,
            sql`NOT EXISTS (
              SELECT 1
              FROM navigation n, jsonb_array_elements(n.items) e
              WHERE n."siteId" = ${navigationTable.siteId}
                AND jsonb_typeof(n.items) = 'array'
                AND e->>'type' = 'menu'
                AND e->>'targetNavId' = ${navigationTable.id}::text
            )`
          )
        )
        .returning({ id: navigationTable.id })
      purged += deleted.length
    }
    return purged
  }
}

export const navigationAutomation = new NavigationAutomation()
