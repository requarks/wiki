import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  navigation as navigationTable,
  pages as pagesTable,
  tree as treeTable
} from '../db/schema.ts'
import {
  CustomError,
  decodeTreePath,
  encodeTreeLabel,
  encodeTreePath,
  treeLabelSql
} from '../helpers/common.ts'
import { liveCondition } from '../helpers/publishing.ts'

export const NAVIGATION_MODES = [
  'inherit',
  'override',
  'overrideExact',
  'hide',
  'hideExact'
] as const
export type NavigationMode = (typeof NAVIGATION_MODES)[number]

export interface NavigationItem {
  id: string
  /**
   * `menu` draws like a link but opens another menu in the sidebar instead of going anywhere — a
   * shortcut down the tree, so that a reader can reach a page under `/guides` without first loading
   * `/guides` to get its sidebar. Top level only: the sidebar has no way to open one from a submenu.
   */
  type: 'link' | 'header' | 'separator' | 'menu'
  label?: string
  icon?: string
  target?: string
  /**
   * A `menu` item only: the menu it opens, by id — which for a tree entry's menu is the entry's own id,
   * so it follows the entry through a move or a rename. Always one of the same site and locale.
   */
  targetNavId?: string
  /**
   * A `menu` item only: whether it is also a link to the page at the target menu's location — the
   * page owning it, or the one sharing a folder's path — drawn as a link with a separate chevron for
   * the menu. Has no effect where there is no such page, as on a folder nobody wrote a page for.
   */
  showLink?: boolean
  openInNewWindow?: boolean
  /** A link with children only: whether the sidebar shows its submenu already open. */
  expandByDefault?: boolean
  visibilityGroups?: string[]
  children?: NavigationItem[]
}

/**
 * A menu as something an item can point at: where the entry owning it sits, in the shape the page
 * rules are asked about.
 */
export interface NavigationOwner {
  id: string
  /** Null only for a menu whose owning tree entry is gone, which nothing can reach any more. */
  locale: string | null
  /** Where the owning entry sits. Empty for a locale's root menu, null for an orphaned one. */
  path: string | null
  tags: string[]
  /** Whether this is a locale's site-wide menu, the one every page falls back to. */
  isRoot: boolean
  /**
   * The page at the menu's location, if one exists: the page owning it, the page sharing the path of
   * the folder owning it, or the home page for a locale's root menu.
   */
  pageId: string | null
}

/**
 * The page a `menu` item links to, as the page rules and the publishing rule are asked about it — by
 * the route answering a reader, who may not be allowed to know it is there.
 */
export interface NavigationTargetPage {
  siteId: string
  path: string
  locale: string
  tags: string[]
  isLive: boolean
}

/**
 * Asked of every `menu` item a save ADDS, by the route handling it: whether the caller may point at
 * that menu. Who is asking is the caller's business, so the model only applies the answer. Absent for
 * a save made on the wiki's own behalf, which is not refused anything.
 */
export type MayPickMenuTarget = (target: NavigationOwner) => boolean

export interface UpdateNavigationResult {
  navigationMode: NavigationMode
  navigationId: string | null
}

/** One menu as the admin area lists it. */
export interface NavigationSummary {
  id: string
  /** Null only for a menu whose owning tree entry is gone, which nothing can reach any more. */
  locale: string | null
  /** Where the owning entry sits. Empty for a locale's root menu, null for an orphaned one. */
  path: string | null
  /** Whether this is a locale's site-wide menu, the one every page falls back to. */
  isRoot: boolean
  /** Every item, children included. */
  itemCount: number
  /** Pages whose sidebar shows this menu, whether they own it or inherit it. */
  pageCount: number
}

export interface NavigationPage {
  total: number
  menus: NavigationSummary[]
}

/**
 * Where the entry owning a menu sits, from the row of a menu joined to the tree: empty for a locale's
 * root menu, which no entry owns, and null for a menu whose owning entry is gone.
 */
function ownerPath(row: {
  locale: string | null
  folderPath: string | null
  fileName: string | null
}): string | null {
  if (row.locale !== null) {
    return ''
  }
  if (row.fileName === null) {
    return null
  }
  const folder = row.folderPath ? decodeTreePath(row.folderPath) : ''
  return folder ? `${folder}/${row.fileName}` : row.fileName
}

/** An item is visible when it names no group, or names one the viewer belongs to. */
function isVisibleTo(item: NavigationItem, userGroups: string[]): boolean {
  const groups = item.visibilityGroups ?? []
  return groups.length < 1 || groups.some((g) => userGroups.includes(g))
}

/**
 * Navigation model
 *
 * A navigation menu is a row of `items` belonging either to a tree entry that overrides the menu below
 * it — keyed by that entry's id, which is why an id alone is enough to fetch a menu — or to a site AND
 * A LOCALE, which is the menu every page in that locale falls back to and what the locale's home page
 * edits rather than one of its own.
 *
 * Per locale because a sidebar is written in a language: a French page showing the English menu is the
 * one thing a translated wiki cannot do. Which is also why the ancestor walk below is locale-scoped —
 * an override on the English `/guides` says nothing about the French one.
 *
 * Which menu a page gets is decided when the mode is saved rather than when the page is rendered:
 * every tree entry carries the resolved `navigationId`, so drawing a sidebar is one lookup.
 */
class Navigation {
  /**
   * The items of one menu.
   *
   * @param id Menu id — a tree entry id, or a site id for the site-wide menu
   * @param userGroups Groups the viewer belongs to. Items limited to other groups are dropped, at both
   *                   levels, unless `unfiltered` is set.
   * @param unfiltered Return every item regardless of visibility, which is what editing one needs —
   *                   an editor that could not see an item would drop it on the next save.
   */
  async getNav(
    siteId: string,
    id: string,
    {
      userGroups = [],
      unfiltered = false,
      mayOpenPage
    }: {
      userGroups?: string[]
      unfiltered?: boolean
      /**
       * Asked of the page a `showLink` menu item would link to: whether this reader may be sent there.
       * Without it no item links anywhere, which is the safe answer for a caller that has not said.
       */
      mayOpenPage?: (page: NavigationTargetPage) => boolean
    } = {}
  ): Promise<NavigationItem[]> {
    const rows = await WIKI.db
      .select({ items: navigationTable.items })
      .from(navigationTable)
      .where(and(eq(navigationTable.id, id), eq(navigationTable.siteId, siteId)))
      .limit(1)

    const items = (rows[0]?.items ?? []) as NavigationItem[]
    const targets = await this.menuTargetsOf(siteId, id, items)
    if (unfiltered) {
      // -> The editor is told where each `menu` item points, and which no longer point anywhere,
      //    rather than having them dropped: it saves what it was given, so a dropped item is a deleted one
      return items.map((item) => {
        if (item.type !== 'menu') {
          return item
        }
        const target = targets.get(item.targetNavId ?? '')
        return {
          ...item,
          targetPath: target?.path ?? null,
          targetMissing: !target,
          targetHasPage: Boolean(target?.pageId)
        }
      })
    }
    const visible = items
      .filter((item) => isVisibleTo(item, userGroups))
      .filter((item) => item.type !== 'menu' || targets.has(item.targetNavId ?? ''))
    const pages = await this.targetPagesOf(siteId, visible, targets)
    return visible.map((item) => {
      if (item.type === 'menu') {
        // -> Only a page this reader may be sent to: anything else would hand out the path of a page
        //    they may not know exists, for a link that could only answer them with a 404
        const page = pages.get(item.targetNavId ?? '')
        return page && mayOpenPage?.(page) ? { ...item, targetPage: page.path } : item
      }
      return item.children?.length
        ? { ...item, children: item.children.filter((c) => isVisibleTo(c, userGroups)) }
        : item
    })
  }

  /**
   * The pages the `showLink` menu items of a menu link to, by target menu id.
   *
   * A locale's root menu links to its home page, addressed as `home`, which is the path that page has
   * and the one the page rules are asked about it at.
   */
  private async targetPagesOf(
    siteId: string,
    items: NavigationItem[],
    targets: Map<string, NavigationOwner>
  ): Promise<Map<string, NavigationTargetPage>> {
    const wanted = new Map<string, NavigationOwner>()
    for (const item of items) {
      const target = targets.get(item.targetNavId ?? '')
      if (item.type === 'menu' && item.showLink && target?.pageId) {
        wanted.set(target.id, target)
      }
    }
    if (wanted.size < 1) {
      return new Map()
    }
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        tags: pagesTable.tags,
        isLive: sql<boolean>`${liveCondition(pagesTable)}`.mapWith(Boolean)
      })
      .from(pagesTable)
      .where(
        and(
          eq(pagesTable.siteId, siteId),
          inArray(
            pagesTable.id,
            [...wanted.values()].map((target) => target.pageId!)
          )
        )
      )
    const byPage = new Map(rows.map((row) => [row.id, row]))
    const pages = new Map<string, NavigationTargetPage>()
    for (const target of wanted.values()) {
      const row = byPage.get(target.pageId!)
      if (row && target.locale) {
        pages.set(target.id, {
          siteId,
          path: target.isRoot ? 'home' : target.path!,
          locale: target.locale,
          tags: (row.tags ?? []) as string[],
          isLive: Boolean(row.isLive)
        })
      }
    }
    return pages
  }

  /**
   * Who owns each of a site's menus, by menu id — all of them, or the ones named.
   *
   * A site-wide menu is keyed by locale and owned by nothing in the tree; any other is keyed by the id
   * of the entry owning it, which is how the two are told apart here.
   */
  async describeNavs(siteId: string, ids?: string[]): Promise<Map<string, NavigationOwner>> {
    if (ids && ids.length < 1) {
      return new Map()
    }
    const rows = await WIKI.db
      .select({
        id: navigationTable.id,
        locale: navigationTable.locale,
        ownerLocale: treeTable.locale,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        tags: treeTable.tags,
        /*
          The page at the menu's location: the owning entry itself when it is a page, the page beside
          it when it is a folder -- a page and a folder may share a path -- and the home page for a
          locale's root menu, which no entry owns.
        */
        pageId: sql<string | null>`(
          SELECT p.id
          FROM tree p
          WHERE p."siteId" = ${navigationTable.siteId}
            AND p.tree = 'page'
            AND p.locale = coalesce(${navigationTable.locale}, ${treeTable.locale})
            AND p."folderPath" = coalesce(${treeTable.folderPath}, ''::ltree)
            AND p."fileName" = coalesce(${treeTable.fileName}, 'home')
          LIMIT 1
        )`
      })
      .from(navigationTable)
      .leftJoin(
        treeTable,
        and(eq(treeTable.id, navigationTable.id), eq(treeTable.siteId, navigationTable.siteId))
      )
      .where(
        and(eq(navigationTable.siteId, siteId), ids ? inArray(navigationTable.id, ids) : undefined)
      )
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          locale: row.locale ?? row.ownerLocale,
          path: ownerPath(row),
          tags: (row.tags ?? []) as string[],
          isRoot: row.locale !== null,
          pageId: row.pageId ?? null
        }
      ])
    )
  }

  /**
   * Where "Go up" goes from a menu: the page or folder above the one owning it.
   *
   * Above the OWNER rather than above the page being read, since that is where the menu changes: a
   * page deep in a section shows the section's menu, and so does every folder between it and the
   * section, so going up one folder at a time would show the same menu again at every step.
   *
   * A locale's root menu has nothing above it, and a menu whose owner is gone has no place to be above
   * — null for both. For a menu owned at the top level of a locale, the parent is the locale's root,
   * an empty path.
   */
  async menuParent(
    siteId: string,
    navId: string
  ): Promise<{ locale: string; path: string } | null> {
    const owner = (await this.describeNavs(siteId, [navId])).get(navId)
    if (!owner || owner.isRoot || owner.path === null || !owner.locale) {
      return null
    }
    const segments = owner.path.split('/')
    return { locale: owner.locale, path: segments.slice(0, -1).join('/') }
  }

  /**
   * The menus the `menu` items of one menu point at that are still there to open, by id.
   *
   * A target is gone when its menu was deleted — by the admin area, or with the page owning it — and
   * also when it has moved to another locale with its entry, since a sidebar never crosses locales.
   * Either way the item has nothing to open and is left out of what a reader is sent.
   */
  private async menuTargetsOf(
    siteId: string,
    navId: string,
    items: NavigationItem[]
  ): Promise<Map<string, NavigationOwner>> {
    const ids = items.flatMap((item) =>
      item.type === 'menu' && item.targetNavId ? [item.targetNavId] : []
    )
    if (ids.length < 1) {
      return new Map()
    }
    const owners = await this.describeNavs(siteId, [navId, ...ids])
    const locale = owners.get(navId)?.locale
    const targets = new Map<string, NavigationOwner>()
    for (const id of ids) {
      const owner = owners.get(id)
      if (owner && owner.path !== null && owner.locale === locale) {
        targets.set(id, owner)
      }
    }
    return targets
  }

  /**
   * The menus a `menu` item in a locale may point at: every menu of the site in that locale whose
   * owner still exists. Who may pick which is the route's question, asked of the `NavigationOwner`s.
   */
  async listNavTargets(siteId: string, locale: string): Promise<NavigationOwner[]> {
    const owners = await this.describeNavs(siteId)
    return [...owners.values()]
      .filter((owner) => owner.locale === locale && owner.path !== null)
      .toSorted((a, b) => Number(b.isRoot) - Number(a.isRoot) || a.path!.localeCompare(b.path!))
  }

  /**
   * Check the items about to be stored as a menu, refusing what the sidebar could not draw.
   *
   * A `menu` item must name a menu of the same site and locale that exists, and not the menu it sits
   * in. It may not be nested: the sidebar opens one from the top level only. The same checks whoever
   * is saving — the editor, the admin area, or an automation adding items on the wiki's behalf — so
   * they live here rather than in a route.
   *
   * `mayPick` is asked only of the targets this save ADDS, compared with what is stored: an item another
   * editor pointed at a menu this one may not manage is theirs to keep, and refusing every save of the
   * menu until it was removed would make it this editor's problem.
   *
   * @param navId The menu the items are for, which for a tree entry need not exist yet
   * @param locale The locale of that menu, which a target has to share
   */
  async validateItems({
    siteId,
    navId,
    locale,
    items,
    mayPick
  }: {
    siteId: string
    navId: string
    locale: string
    items: NavigationItem[]
    mayPick?: MayPickMenuTarget
  }): Promise<void> {
    if (items.some((item) => item.children?.some((child) => child.type === 'menu'))) {
      throw new CustomError(
        'navMenuNested',
        'A menu item cannot be nested under a link: it can only be added at the top level.',
        400
      )
    }
    const targetIds = items.flatMap((item) =>
      item.type === 'menu' ? [item.targetNavId ?? ''] : []
    )
    if (targetIds.length < 1) {
      return
    }
    if (targetIds.some((id) => !id)) {
      throw new CustomError('navMenuNoTarget', 'A menu item has no target menu selected.', 400)
    }
    if (targetIds.includes(navId)) {
      throw new CustomError('navMenuSelfTarget', 'A menu item cannot open the menu it is in.', 400)
    }

    const stored = await WIKI.db
      .select({ items: navigationTable.items })
      .from(navigationTable)
      .where(and(eq(navigationTable.id, navId), eq(navigationTable.siteId, siteId)))
      .limit(1)
    const kept = new Set(
      ((stored[0]?.items ?? []) as NavigationItem[]).flatMap((item) =>
        item.type === 'menu' && item.targetNavId ? [item.targetNavId] : []
      )
    )

    const owners = await this.describeNavs(siteId, targetIds)
    for (const id of targetIds) {
      const owner = owners.get(id)
      if (!owner || owner.path === null || owner.locale !== locale) {
        // -> An item kept from before whose target has since gone is drawn by nobody, so it is no
        //    reason to refuse the save; only a target being added has to exist
        if (kept.has(id)) {
          continue
        }
        throw new CustomError(
          'navMenuTargetInvalid',
          'A menu item points at a menu that does not exist in this locale.',
          400
        )
      }
      if (mayPick && !kept.has(id) && !mayPick(owner)) {
        throw new CustomError(
          'navMenuTargetForbidden',
          'You are not allowed to add a menu item opening a menu whose navigation you do not manage.',
          403
        )
      }
    }
  }

  /**
   * The menu a site uses for one locale, which is the one every page in it inherits by default.
   *
   * Created empty on demand rather than with the site: a locale is activated long after, and the first
   * page written in it has to have a sidebar to inherit. An absent menu is an empty one, never an
   * error.
   */
  async siteNavId(siteId: string, locale: string): Promise<string> {
    const existing = await WIKI.db
      .select({ id: navigationTable.id })
      .from(navigationTable)
      .where(and(eq(navigationTable.siteId, siteId), eq(navigationTable.locale, locale)))
      .limit(1)
    if (existing[0]) {
      return existing[0].id
    }
    // -> Two pages created in a new locale at once both find nothing and both insert; the unique
    //    index settles it and the loser reads back what the winner wrote
    const inserted = await WIKI.db
      .insert(navigationTable)
      .values({ siteId, locale, items: [] })
      .onConflictDoNothing({ target: [navigationTable.siteId, navigationTable.locale] })
      .returning({ id: navigationTable.id })
    if (inserted[0]) {
      return inserted[0].id
    }
    const raced = await WIKI.db
      .select({ id: navigationTable.id })
      .from(navigationTable)
      .where(and(eq(navigationTable.siteId, siteId), eq(navigationTable.locale, locale)))
      .limit(1)
    return raced[0]!.id
  }

  /**
   * Drop the menus belonging to tree entries that no longer exist.
   *
   * A menu is keyed by the id of the entry that owns it, so deleting a page or a folder would
   * otherwise leave its menu behind with nothing able to reach it. A site's own menus are identified
   * by site and locale rather than by an id borrowed from the tree, so they are not at risk here.
   *
   * @param ids Tree entry ids being removed
   */
  async deleteNavForEntries(ids: string[]): Promise<void> {
    if (ids.length < 1) {
      return
    }
    await WIKI.db.delete(navigationTable).where(inArray(navigationTable.id, ids))
  }

  /**
   * A page of the menus a site holds, for the admin area.
   *
   * The path is filtered and sorted here rather than in SQL because the tree stores it encoded
   * (`folderPath` is hex labels), so a substring of the path a person typed matches nothing in the
   * column. A site holds one menu per locale plus one per entry that overrides, which is few enough
   * to read whole.
   *
   * @param filter Matched against the owning entry's path, case-insensitively
   */
  async listNavs({
    siteId,
    filter = '',
    page = 1,
    limit = 20
  }: {
    siteId: string
    filter?: string
    page?: number
    limit?: number
  }): Promise<NavigationPage> {
    const rows = await WIKI.db
      .select({
        id: navigationTable.id,
        locale: navigationTable.locale,
        ownerLocale: treeTable.locale,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        // -> Two levels, as the editor allows: the top-level items plus each one's children
        itemCount: sql<number>`jsonb_array_length(${navigationTable.items}) + coalesce((
          SELECT sum(jsonb_array_length(e->'children'))
          FROM jsonb_array_elements(${navigationTable.items}) e
          WHERE jsonb_typeof(e->'children') = 'array'
        ), 0)`.mapWith(Number),
        // -> Every entry carries the menu it resolved to, so the owner and everything inheriting from
        //    it are counted alike
        pageCount: sql<number>`(
          SELECT count(*)
          FROM tree tp
          WHERE tp."siteId" = ${navigationTable.siteId}
            AND tp."navigationId" = ${navigationTable.id}
            AND tp.tree = 'page'
        )`.mapWith(Number)
      })
      .from(navigationTable)
      .leftJoin(
        treeTable,
        and(eq(treeTable.id, navigationTable.id), eq(treeTable.siteId, navigationTable.siteId))
      )
      .where(eq(navigationTable.siteId, siteId))

    const needle = filter.trim().toLowerCase()
    const menus = rows
      .map((row): NavigationSummary => {
        // -> A site-wide menu is keyed by locale; any other is keyed by the id of the entry owning it
        const isRoot = row.locale !== null
        return {
          id: row.id,
          locale: row.locale ?? row.ownerLocale,
          path: ownerPath(row),
          isRoot,
          itemCount: row.itemCount,
          pageCount: row.pageCount
        }
      })
      .filter((menu) => !needle || (menu.path ?? '').includes(needle))
      .toSorted(
        (a, b) =>
          (a.locale ?? '').localeCompare(b.locale ?? '') ||
          Number(b.isRoot) - Number(a.isRoot) ||
          (a.path ?? '').localeCompare(b.path ?? '')
      )

    return {
      total: menus.length,
      menus: menus.slice((page - 1) * limit, page * limit)
    }
  }

  /**
   * Replace the items of a menu that already exists, addressed by its own id.
   *
   * What the admin area saves through: it edits a menu as a menu, with no page in hand, so neither the
   * mode nor the descendants of any entry move — only the items of this one row.
   */
  async setNavItems(
    siteId: string,
    navId: string,
    items: NavigationItem[],
    { mayPick }: { mayPick?: MayPickMenuTarget } = {}
  ): Promise<void> {
    const owner = (await this.describeNavs(siteId, [navId])).get(navId)
    if (!owner) {
      throw new CustomError('navNotFound', 'This navigation menu does not exist.', 404)
    }
    // -> A menu whose entry is gone has no locale, which no target shares: it keeps what it holds and
    //    gains no new `menu` item
    await this.validateItems({ siteId, navId, locale: owner.locale ?? '', items, mayPick })
    const updated = await WIKI.db
      .update(navigationTable)
      .set({ items })
      .where(and(eq(navigationTable.id, navId), eq(navigationTable.siteId, siteId)))
      .returning({ id: navigationTable.id })
    if (updated.length < 1) {
      throw new CustomError('navNotFound', 'This navigation menu does not exist.', 404)
    }
  }

  /**
   * Delete a menu that belongs to a tree entry.
   *
   * The entry owning it is handed back to `inherit` first when it still overrides, so that it and
   * everything below it that inherited the menu are repointed at the ancestor's — otherwise they
   * would go on pointing at a row that no longer exists. A locale's site-wide menu cannot be deleted:
   * it is what every page in the locale falls back to, and would only be recreated empty on the next
   * page written there.
   *
   * @returns What was deleted, for the audit log
   */
  async deleteNav(
    siteId: string,
    navId: string
  ): Promise<{ locale: string | null; path: string | null }> {
    const menus = await WIKI.db
      .select({ locale: navigationTable.locale })
      .from(navigationTable)
      .where(and(eq(navigationTable.id, navId), eq(navigationTable.siteId, siteId)))
      .limit(1)
    if (!menus[0]) {
      throw new CustomError('navNotFound', 'This navigation menu does not exist.', 404)
    }
    if (menus[0].locale !== null) {
      throw new CustomError(
        'navDeleteRoot',
        'The root navigation menu of a locale cannot be deleted.',
        400
      )
    }

    const entries = await WIKI.db
      .select({
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        locale: treeTable.locale,
        navigationMode: treeTable.navigationMode
      })
      .from(treeTable)
      .where(and(eq(treeTable.id, navId), eq(treeTable.siteId, siteId)))
      .limit(1)
    const owner = entries[0]
    // -> A hidden sidebar keeps hiding: the menu was not what it showed, so there is nothing to repoint
    if (owner && ['override', 'overrideExact'].includes(owner.navigationMode)) {
      await this.updateNavigation({ siteId, pageId: navId, mode: 'inherit' })
    }

    await WIKI.db
      .delete(navigationTable)
      .where(and(eq(navigationTable.id, navId), eq(navigationTable.siteId, siteId)))

    if (!owner) {
      return { locale: null, path: null }
    }
    const folder = owner.folderPath ? decodeTreePath(owner.folderPath) : ''
    return { locale: owner.locale, path: folder ? `${folder}/${owner.fileName}` : owner.fileName }
  }

  /**
   * The tree entry a navigation change is addressed to: a page, or a folder — which has a sidebar of
   * its own to set even where nobody wrote a page at its path. Never an asset, which is served as a
   * file and is drawn in no sidebar.
   */
  private async getEntry(siteId: string, pageId: string) {
    const entries = await WIKI.db
      .select()
      .from(treeTable)
      .where(
        and(
          eq(treeTable.id, pageId),
          eq(treeTable.siteId, siteId),
          inArray(treeTable.type, ['page', 'folder'])
        )
      )
      .limit(1)
    const entry = entries[0]
    if (!entry) {
      throw new CustomError('navInvalidPage', 'This page or folder does not exist.', 404)
    }
    return entry
  }

  /**
   * A page or folder as the page rules are asked about it, by its tree entry id — what the navigation
   * routes check `manage:navigation` against. Null for anything else, or nothing.
   */
  async entryRef(
    siteId: string,
    entryId: string
  ): Promise<{ path: string; locale: string; tags: string[] } | null> {
    const entry = await this.getEntry(siteId, entryId).catch(() => null)
    if (!entry) {
      return null
    }
    const folder = entry.folderPath ? decodeTreePath(entry.folderPath) : ''
    return {
      path: folder ? `${folder}/${entry.fileName}` : entry.fileName,
      locale: entry.locale,
      tags: (entry.tags ?? []) as string[]
    }
  }

  /**
   * The sidebar at a path where there is no page: the folder there, if any, with how it resolves its
   * menu — or, with no folder either, the menu a page written there would inherit.
   *
   * What the missing-page screen draws its sidebar from, and what its Edit Nav sets the mode of. A
   * folder's `navigationId` is resolved and stored like a page's, so it is read rather than worked out.
   *
   * @param path Slash path, already normalized for a lookup
   * @param includeFolder Look for a folder at all — false for a requester who may not know of one
   */
  async navigationAtPath(
    siteId: string,
    locale: string,
    path: string,
    { includeFolder = true }: { includeFolder?: boolean } = {}
  ): Promise<{
    folderId: string | null
    navigationMode: NavigationMode
    navigationId: string | null
  }> {
    const segments = path.split('/').filter(Boolean)
    const fileName = segments.at(-1)
    const folderPath = encodeTreePath(segments.slice(0, -1).join('/'))
    if (fileName && includeFolder) {
      const folders = await WIKI.db
        .select({
          id: treeTable.id,
          navigationMode: treeTable.navigationMode,
          navigationId: treeTable.navigationId
        })
        .from(treeTable)
        .where(
          and(
            eq(treeTable.siteId, siteId),
            eq(treeTable.locale, locale),
            eq(treeTable.type, 'folder'),
            eq(treeTable.folderPath, folderPath),
            eq(treeTable.fileName, fileName)
          )
        )
        .limit(1)
      if (folders[0]) {
        return {
          folderId: folders[0].id,
          navigationMode: folders[0].navigationMode as NavigationMode,
          navigationId: folders[0].navigationId ?? null
        }
      }
    }
    return {
      folderId: null,
      navigationMode: 'inherit',
      navigationId: await this.ancestorNavId(siteId, locale, folderPath)
    }
  }

  /**
   * The menu a tree entry falls back to: the nearest ancestor that overrides or hides, or the
   * site-wide menu when nothing above it does either.
   *
   * What a page or folder is given when it is created or moved, as well as what a mode change
   * repoints descendants to: an entry carries the menu it resolves to from the moment it exists.
   *
   * A page and a folder may share a path, and both may override what is under it. The page wins the
   * tie, being the one a reader at that path sees and the one Edit Nav is offered on there — a folder's
   * own mode is only reachable from its path while there is no page at it.
   *
   * @param siteId Site the entry belongs to, since paths are only unique within one
   * @param folderPath Encoded ltree path of the folder holding the entry, empty at the site root
   */
  async ancestorNavId(siteId: string, locale: string, folderPath: string): Promise<string | null> {
    if (!folderPath) {
      return this.siteNavId(siteId, locale)
    }
    // -> Within the locale: the tree holds every translation side by side, so an override on the
    //    English `/guides` would otherwise decide what the French one below it shows
    const result = await WIKI.db.execute(sql`
      SELECT "navigationId"
      FROM tree
      WHERE "siteId" = ${siteId}
        AND "locale" = ${locale}
        AND ("folderPath" || ${treeLabelSql(sql`"fileName"`)}) @> ${folderPath}::ltree
        AND "navigationMode" IN ('override', 'hide')
        AND tree IN ('page', 'folder')
      ORDER BY nlevel("folderPath") DESC, (tree = 'page') DESC
      LIMIT 1
    `)
    const rows = (result.rows ?? result) as any[]
    return rows.length > 0 ? (rows[0].navigationId ?? null) : this.siteNavId(siteId, locale)
  }

  /**
   * The menu a page inherits — the one its sidebar shows while its own mode is `inherit`.
   *
   * `navigationId` on the entry already answers this for a page that IS inheriting, but only for one:
   * the navigation editor asks before anything is saved, so that a page can edit the menu it shows
   * without being opened on the ancestor that owns it, and so that it can tell there is one to edit.
   *
   * Null when the nearest ancestor hides the sidebar, which leaves nothing to inherit.
   */
  async inheritedNavId(siteId: string, pageId: string): Promise<string | null> {
    const entry = await this.getEntry(siteId, pageId)
    return this.ancestorNavId(siteId, entry.locale, entry.folderPath ?? '')
  }

  /**
   * WHERE the menu a page shows actually lives, as a path the page rules can be asked about.
   *
   * `manage:navigation` is a page rule, so every question about it is a question about a path — and
   * the path that decides whether somebody may edit MENU ITEMS is not the page they are standing on
   * but the entry whose menu those items belong to. A page under `/guides` that inherits is editing
   * `/guides`'s menu, and changing it changes what every page under `/guides` shows.
   *
   * Three shapes come back:
   *
   * - **An ancestor entry** — the nearest one that overrides. Its own path is what gets checked.
   * - **The site root** — when nothing above overrides, the menu is the site-wide one for the locale,
   *   which in this model is the home page's own (`isSiteRoot` in `updateNavigation`). So the path
   *   is that page's, and editing the sidebar the whole wiki inherits needs a rule reaching it.
   * - **Null** — the sidebar above is hidden, so there is no menu and nothing to edit.
   *
   * @param ownPath Where the page itself sits, used when the page overrides and so owns its menu
   */
  async menuOwnerRef(
    siteId: string,
    pageId: string,
    mode: NavigationMode
  ): Promise<{ navigationId: string | null; path: string; locale: string; tags: string[] } | null> {
    const entry = await this.getEntry(siteId, pageId)
    const folderPath = entry.folderPath ?? ''
    /*
      Which menu the items belong to is the MODE's answer, exactly as it is in `updateNavigation`
      (`targetNavId`): a page that overrides owns the menu it is about to write, so the path to ask
      about is its own. Only `inherit` reaches upwards. Getting this wrong in either direction is a
      real bug -- always asking about the ancestor refuses somebody editing their own page's menu,
      and always asking about the page lets them rewrite one handed down from above.
    */
    if (mode !== 'inherit') {
      const own = decodeTreePath(folderPath)
      return {
        navigationId: entry.id,
        path: own ? `${own}/${entry.fileName}` : entry.fileName,
        locale: entry.locale,
        tags: (entry.tags ?? []) as string[]
      }
    }
    const navId = await this.ancestorNavId(siteId, entry.locale, folderPath)
    if (!navId) {
      return null
    }
    return this.refForNavId(siteId, navId, entry.locale)
  }

  /**
   * The entry a menu belongs to, as a path the page rules can be asked about.
   *
   * A menu belonging to the tree is keyed by its entry's id; the site-wide one is keyed by site and
   * locale and matches no entry, which is exactly how the two are told apart here.
   *
   * @param fallbackLocale The locale to report for the site-wide menu, whose owner is the home page
   */
  async refForNavId(
    siteId: string,
    navId: string,
    fallbackLocale?: string
  ): Promise<{ navigationId: string; path: string; locale: string; tags: string[] } | null> {
    const owners = await WIKI.db
      .select({
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        locale: treeTable.locale,
        tags: treeTable.tags
      })
      .from(treeTable)
      .where(and(eq(treeTable.id, navId), eq(treeTable.siteId, siteId)))
      .limit(1)
    const owner = owners[0]
    if (owner) {
      const ownerFolder = owner.folderPath ? decodeTreePath(owner.folderPath) : ''
      return {
        navigationId: navId,
        path: ownerFolder ? `${ownerFolder}/${owner.fileName}` : owner.fileName,
        locale: owner.locale,
        tags: (owner.tags ?? []) as string[]
      }
    }
    // -> The site-wide menu, which the home page owns. `home` is the path `isSiteRoot` recognises.
    const siteMenus = await WIKI.db
      .select({ locale: navigationTable.locale })
      .from(navigationTable)
      .where(and(eq(navigationTable.id, navId), eq(navigationTable.siteId, siteId)))
      .limit(1)
    const locale = siteMenus[0]?.locale ?? fallbackLocale
    if (!locale) {
      return null
    }
    return { navigationId: navId, path: 'home', locale, tags: [] }
  }

  /**
   * Set how a page decides its sidebar, and optionally the menu itself.
   *
   * Two things move here. The entry records its own mode and the menu it resolves to, and — when the
   * change alters what descendants inherit — every entry below it that is still on `inherit` is
   * repointed, stopping at any that overrides or hides in between.
   *
   * @param items When given, the menu the mode resolves to, replacing whatever was there — this
   *              entry's own, or the one it inherits when the mode is `inherit`
   */
  async updateNavigation({
    siteId,
    pageId,
    mode,
    items,
    mayPick
  }: {
    siteId: string
    pageId: string
    mode: NavigationMode
    items?: NavigationItem[]
    mayPick?: MayPickMenuTarget
  }): Promise<UpdateNavigationResult> {
    const entry = await this.getEntry(siteId, pageId)

    const folderPath = entry.folderPath ?? ''
    // -> The home page at the root edits the site-wide menu FOR ITS LOCALE rather than one of its own,
    //    which is what makes it the menu every other page in that locale inherits
    const isSiteRoot = folderPath === '' && entry.fileName === 'home' && entry.type === 'page'
    const ownNavId = isSiteRoot ? await this.siteNavId(siteId, entry.locale) : entry.id
    const label = encodeTreeLabel(entry.fileName)
    const fullPath = folderPath ? `${folderPath}.${label}` : label

    const ancestorId = await this.ancestorNavId(siteId, entry.locale, folderPath)

    if (items) {
      /*
        Which menu the items belong to is the mode's answer, not the entry's: a page that inherits
        shows a menu belonging to an ancestor, so editing the sidebar from that page edits THAT menu
        rather than starting one of its own that nothing would point at. For the root home page the two
        are the same id — the site-wide menu is what it inherits and what it owns.
      */
      const targetNavId = mode === 'inherit' ? ancestorId : ownNavId
      if (!targetNavId) {
        throw new CustomError(
          'navNoInheritedMenu',
          'This page inherits a hidden sidebar, so there is no menu to save items to.',
          400
        )
      }
      // -> Every menu reached from this one is in the entry's locale: an inherited menu is found by a
      //    walk that never leaves it, and the site-wide one is the locale's own
      await this.validateItems({ siteId, navId: targetNavId, locale: entry.locale, items, mayPick })
      await WIKI.db
        .insert(navigationTable)
        .values({ id: targetNavId, siteId, items })
        .onConflictDoUpdate({ target: navigationTable.id, set: { items } })
      // NOTE: a site menu already exists by the time it is named here — `siteNavId` created it — so
      //       this insert only ever creates one for a tree entry, whose id is the key
    }

    // -> A mode that stops applying below this entry hands its descendants back to the ancestor
    const wasCascading = ['override', 'hide'].includes(entry.navigationMode)

    let navId: string | null = null
    let cascadeTo: string | null | undefined

    switch (mode) {
      case 'inherit': {
        navId = ancestorId
        if (wasCascading) {
          cascadeTo = ancestorId
        }
        break
      }
      case 'override': {
        navId = ownNavId
        cascadeTo = ownNavId
        break
      }
      case 'overrideExact': {
        navId = ownNavId
        if (wasCascading) {
          cascadeTo = ancestorId
        }
        break
      }
      case 'hide': {
        navId = null
        cascadeTo = null
        break
      }
      case 'hideExact': {
        navId = null
        if (wasCascading) {
          cascadeTo = ancestorId
        }
        break
      }
    }

    await WIKI.db
      .update(treeTable)
      .set({ navigationMode: mode, navigationId: navId })
      .where(eq(treeTable.id, entry.id))

    if (cascadeTo !== undefined) {
      // -> Everything below that still inherits, except what sits under a nearer override or hide,
      //    which owns its own subtree
      await WIKI.db.execute(sql`
        UPDATE tree tt
        SET "navigationId" = ${cascadeTo}
        WHERE tt."siteId" = ${siteId}
          AND tt."locale" = ${entry.locale}
          AND tt.tree IN ('page', 'folder')
          AND tt."folderPath" <@ ${fullPath}::ltree
          AND tt."navigationMode" = 'inherit'
          AND NOT EXISTS (
            SELECT 1
            FROM tree tc
            WHERE tc."siteId" = ${siteId}
              AND tc."locale" = ${entry.locale}
              AND tc.tree IN ('page', 'folder')
              AND tc."folderPath" <@ ${fullPath}::ltree
              AND (tc."folderPath" || ${treeLabelSql(sql`tc."fileName"`)}) @> tt."folderPath"
              AND tc."navigationMode" IN ('override', 'hide')
          )
      `)
    }

    return { navigationMode: mode, navigationId: navId }
  }

  /**
   * Repoint the sidebars of a subtree that has just moved.
   *
   * A menu is inherited from where an entry SITS -- the nearest ancestor that overrides or hides, and
   * the site menu of its locale when none does -- so a folder that changes parents, or locales, takes
   * a subtree full of entries pointing at a menu that is no longer above them. Left alone, a French
   * page would show the English sidebar, which is the one thing a translated wiki cannot do.
   *
   * Only entries still on `inherit` are repointed, and only those not sitting under an override or a
   * hide WITHIN the moved subtree: a menu written for a branch belongs to that branch's own entry, is
   * keyed by its id, and travels with it.
   *
   * Called after the rows are at their destination, since what is above them is what decides this.
   *
   * @param folderId The moved folder, whose own mode is considered along with its descendants'
   * @param locale The locale it now sits in
   * @param folderPath Encoded ltree path of its new parent, empty at the site root
   * @param fileName Its path name, which with `folderPath` is what its descendants sit under
   */
  async repointMovedSubtree({
    siteId,
    folderId,
    locale,
    folderPath,
    fileName
  }: {
    siteId: string
    folderId: string
    locale: string
    folderPath: string
    fileName: string
  }): Promise<void> {
    const inherited = await this.ancestorNavId(siteId, locale, folderPath)
    const label = encodeTreeLabel(fileName)
    const fullPath = folderPath ? `${folderPath}.${label}` : label

    // -> The folder itself first: it is not under its own path, so the cascade below passes it over
    await WIKI.db
      .update(treeTable)
      .set({ navigationId: inherited })
      .where(and(eq(treeTable.id, folderId), eq(treeTable.navigationMode, 'inherit')))

    // -> The same walk `updateNavigation` does when a mode changes, over the subtree that moved
    await WIKI.db.execute(sql`
      UPDATE tree tt
      SET "navigationId" = ${inherited}
      WHERE tt."siteId" = ${siteId}
        AND tt."locale" = ${locale}
        AND tt.tree IN ('page', 'folder')
        AND tt."folderPath" <@ ${fullPath}::ltree
        AND tt."navigationMode" = 'inherit'
        AND NOT EXISTS (
          SELECT 1
          FROM tree tc
          WHERE tc."siteId" = ${siteId}
            AND tc."locale" = ${locale}
            AND tc.tree IN ('page', 'folder')
            AND tc."folderPath" <@ ${fullPath}::ltree
            AND (tc."folderPath" || ${treeLabelSql(sql`tc."fileName"`)}) @> tt."folderPath"
            AND tc."navigationMode" IN ('override', 'hide')
        )
    `)
  }
}

export const navigation = new Navigation()
