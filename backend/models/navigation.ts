import { and, eq, inArray, sql } from 'drizzle-orm'
import { navigation as navigationTable, tree as treeTable } from '../db/schema.ts'
import { CustomError } from '../helpers/common.ts'

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
  type: 'link' | 'header' | 'separator'
  label?: string
  icon?: string
  target?: string
  openInNewWindow?: boolean
  /** A link with children only: whether the sidebar shows its submenu already open. */
  expandByDefault?: boolean
  visibilityGroups?: string[]
  children?: NavigationItem[]
}

export interface UpdateNavigationResult {
  navigationMode: NavigationMode
  navigationId: string | null
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
    id: string,
    { userGroups = [], unfiltered = false }: { userGroups?: string[]; unfiltered?: boolean } = {}
  ): Promise<NavigationItem[]> {
    const rows = await WIKI.db
      .select({ items: navigationTable.items })
      .from(navigationTable)
      .where(eq(navigationTable.id, id))
      .limit(1)

    const items = (rows[0]?.items ?? []) as NavigationItem[]
    if (unfiltered) {
      return items
    }
    return items
      .filter((item) => isVisibleTo(item, userGroups))
      .map((item) =>
        item.children?.length
          ? { ...item, children: item.children.filter((c) => isVisibleTo(c, userGroups)) }
          : item
      )
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

  /** The tree entry a navigation change is addressed to. */
  private async getEntry(siteId: string, pageId: string) {
    const entries = await WIKI.db
      .select()
      .from(treeTable)
      .where(and(eq(treeTable.id, pageId), eq(treeTable.siteId, siteId)))
      .limit(1)
    const entry = entries[0]
    if (!entry) {
      throw new CustomError('navInvalidPage', 'This page does not exist.', 404)
    }
    return entry
  }

  /**
   * The menu a tree entry falls back to: the nearest ancestor that overrides or hides, or the
   * site-wide menu when nothing above it does either.
   *
   * @param siteId Site the entry belongs to, since paths are only unique within one
   * @param folderPath Encoded ltree path of the folder holding the entry, empty at the site root
   */
  private async ancestorNavId(
    siteId: string,
    locale: string,
    folderPath: string
  ): Promise<string | null> {
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
        AND ("folderPath" || "fileName") @> ${folderPath}::ltree
        AND "navigationMode" IN ('override', 'hide')
      ORDER BY nlevel("folderPath" || "fileName") DESC
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
    items
  }: {
    siteId: string
    pageId: string
    mode: NavigationMode
    items?: NavigationItem[]
  }): Promise<UpdateNavigationResult> {
    const entry = await this.getEntry(siteId, pageId)

    const folderPath = entry.folderPath ?? ''
    // -> The home page at the root edits the site-wide menu FOR ITS LOCALE rather than one of its own,
    //    which is what makes it the menu every other page in that locale inherits
    const isSiteRoot = folderPath === '' && entry.fileName === 'home'
    const ownNavId = isSiteRoot ? await this.siteNavId(siteId, entry.locale) : entry.id
    const fullPath = folderPath ? `${folderPath}.${entry.fileName}` : entry.fileName

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
              AND (tc."folderPath" || tc."fileName") @> tt."folderPath"
              AND tc."navigationMode" IN ('override', 'hide')
          )
      `)
    }

    return { navigationMode: mode, navigationId: navId }
  }
}

export const navigation = new Navigation()
