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
 * A navigation menu is a row of `items` keyed by the id of whatever it belongs to: a tree entry that
 * overrides the menu below it, or — for the site-wide menu every page falls back to — the site's own
 * id. That double use of the key is why the id alone is enough to fetch a menu, and why the home page
 * edits the site menu rather than one of its own.
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
   * The menu the site as a whole uses, which is the one every page inherits by default.
   *
   * Created empty on demand: a site made before this row existed, or one whose menu was never edited,
   * has nothing stored, and an absent menu is an empty one rather than an error.
   */
  async ensureSiteNav(siteId: string): Promise<void> {
    await WIKI.db
      .insert(navigationTable)
      .values({ id: siteId, siteId, items: [] })
      .onConflictDoNothing()
  }

  /**
   * Drop the menus belonging to tree entries that no longer exist.
   *
   * A menu is keyed by the id of the entry that owns it, so deleting a page or a folder would
   * otherwise leave its menu behind with nothing able to reach it. The site's own menu is keyed by the
   * site id and is never a tree entry, so it is not at risk here.
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
   * The menu a tree entry falls back to: the nearest ancestor that overrides or hides, or the
   * site-wide menu when nothing above it does either.
   *
   * @param siteId Site the entry belongs to, since paths are only unique within one
   * @param folderPath Encoded ltree path of the folder holding the entry, empty at the site root
   */
  private async ancestorNavId(siteId: string, folderPath: string): Promise<string | null> {
    if (!folderPath) {
      return siteId
    }
    const result = await WIKI.db.execute(sql`
      SELECT "navigationId"
      FROM tree
      WHERE "siteId" = ${siteId}
        AND ("folderPath" || "fileName") @> ${folderPath}::ltree
        AND "navigationMode" IN ('override', 'hide')
      ORDER BY nlevel("folderPath" || "fileName") DESC
      LIMIT 1
    `)
    const rows = (result.rows ?? result) as any[]
    return rows.length > 0 ? (rows[0].navigationId ?? null) : siteId
  }

  /**
   * Set how a page decides its sidebar, and optionally the menu itself.
   *
   * Two things move here. The entry records its own mode and the menu it resolves to, and — when the
   * change alters what descendants inherit — every entry below it that is still on `inherit` is
   * repointed, stopping at any that overrides or hides in between.
   *
   * @param items When given, the menu stored against this entry, replacing whatever was there
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
    const entries = await WIKI.db
      .select()
      .from(treeTable)
      .where(and(eq(treeTable.id, pageId), eq(treeTable.siteId, siteId)))
      .limit(1)
    const entry = entries[0]
    if (!entry) {
      throw new CustomError('navInvalidPage', 'This page does not exist.', 404)
    }

    // -> Whatever this change resolves to, `inherit` ultimately falls back to the site menu, and a
    //    site created before that row existed does not have one yet
    await this.ensureSiteNav(siteId)

    const folderPath = entry.folderPath ?? ''
    // -> The home page at the root edits the site-wide menu rather than one of its own, which is what
    //    makes it the menu every other page inherits
    const isSiteRoot = folderPath === '' && entry.fileName === 'home'
    const ownNavId = isSiteRoot ? siteId : entry.id
    const fullPath = folderPath ? `${folderPath}.${entry.fileName}` : entry.fileName

    if (items) {
      await WIKI.db
        .insert(navigationTable)
        .values({ id: ownNavId, siteId, items })
        .onConflictDoUpdate({ target: navigationTable.id, set: { items } })
    }

    const ancestorId = await this.ancestorNavId(siteId, folderPath)
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
          AND tt.tree IN ('page', 'folder')
          AND tt."folderPath" <@ ${fullPath}::ltree
          AND tt."navigationMode" = 'inherit'
          AND NOT EXISTS (
            SELECT 1
            FROM tree tc
            WHERE tc."siteId" = ${siteId}
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
