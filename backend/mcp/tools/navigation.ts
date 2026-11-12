import { createHash } from 'node:crypto'
import { omit } from 'es-toolkit/object'
import { v4 as uuid } from 'uuid'
import { decodeUrlPath, normalizePagePath } from '../../helpers/common.ts'
import { NAVIGATION_MODES } from '../../models/navigation.ts'
import { callApi } from '../inject.ts'
import { mayOnPage, pageUrl } from '../context.ts'
import {
  activeLocales,
  loadReadablePage,
  PAGE_REF_PROPERTIES,
  primaryLocale,
  resolvePageId
} from '../content.ts'
import { jsonResult, ToolError } from '../tool.ts'
import type { NavigationItem, NavigationMode } from '../../models/navigation.ts'
import type { McpContext } from '../context.ts'
import type { PageRef } from '../content.ts'
import type { McpTool } from '../tool.ts'

/**
 * The sidebar: reading the menu a page or folder shows, setting how it resolves one (inherit,
 * override, hide) and replacing a menu's items.
 *
 * Its own group, off by default (`mcp.tools.navigation`): a menu is shown on every page below the
 * entry owning it — the site-wide one on every page of the locale — so changing it is a decision
 * about the wiki's structure rather than knowledge added to it, as moving a page is.
 *
 * Through the REST routes in-process (`api/navigation.ts`), which hold the checks: `manage:navigation`
 * on the entry for its mode, and on the entry OWNING the menu for its items, which for a page that
 * inherits is an ancestor's; `manage:navigation` on a menu's owner to point a `menu` item at it; and
 * the audit entry. The tools only resolve paths into the ids the routes take, and add the one thing a
 * route does not — a stale-read check, since the route replaces the whole menu.
 */

const NOTHING_THERE = 'There is no page or folder there that you may read.'

/** A page or folder whose sidebar is asked about, as the navigation routes address it. */
interface NavEntry {
  kind: 'page' | 'folder'
  /** The tree entry id: the page id for a page. */
  id: string
  locale: string
  path: string
  tags: string[]
  navigationMode: NavigationMode
  /** The menu the sidebar shows there. Null when it is hidden. */
  navigationId: string | null
}

/**
 * The page or folder an argument names, as this caller may know it. A path finds the page there
 * first, as a reader at that path sees it, and the folder only where there is no page — which is
 * also the only place a folder's own Edit Nav is offered.
 */
async function resolveEntry(ctx: McpContext, ref: PageRef): Promise<NavEntry> {
  const fromPage = async (id: string): Promise<NavEntry> => {
    const page = await loadReadablePage(ctx, id)
    return {
      kind: 'page',
      id: page.id,
      locale: page.locale,
      path: page.path,
      tags: page.tags ?? [],
      navigationMode: page.navigationMode as NavigationMode,
      navigationId: page.navigationId
    }
  }
  if (ref.id || ref.url) {
    const id = await resolvePageId(ctx, ref)
    try {
      return await fromPage(id)
    } catch (err) {
      // -> An id may name a folder, which `browse_tree` hands out; a URL always names a page
      if (!ref.id) {
        throw err
      }
      return folderById(ctx, id)
    }
  }
  if (ref.path === undefined) {
    throw new ToolError('Name the page or folder with `id`, `url` or `path`.')
  }
  const locale = ref.locale || primaryLocale(ctx)
  if (!activeLocales(ctx).includes(locale)) {
    throw new ToolError(`${locale} is not a locale of this site.`)
  }
  const path = normalizePagePath(decodeUrlPath(ref.path)) || 'home'
  const pageId = await WIKI.models.pages.idAtPath(ctx.siteId, locale, path)
  if (pageId) {
    return fromPage(pageId)
  }
  // -> A folder nobody may read here is no folder to this caller, as on the missing-page screen
  if (!mayOnPage(ctx, 'read:pages', { siteId: ctx.siteId, path, locale })) {
    throw new ToolError(NOTHING_THERE)
  }
  const atPath = await WIKI.models.navigation.navigationAtPath(ctx.siteId, locale, path)
  if (!atPath.folderId) {
    throw new ToolError(NOTHING_THERE)
  }
  return {
    kind: 'folder',
    id: atPath.folderId,
    locale,
    path,
    tags: [],
    navigationMode: atPath.navigationMode,
    navigationId: atPath.navigationId
  }
}

/** A folder by its tree entry id, readable where its path is. */
async function folderById(ctx: McpContext, id: string): Promise<NavEntry> {
  const ref = await WIKI.models.navigation.entryRef(ctx.siteId, id)
  if (!ref || !mayOnPage(ctx, 'read:pages', { ...ref, siteId: ctx.siteId })) {
    throw new ToolError(NOTHING_THERE)
  }
  const atPath = await WIKI.models.navigation.navigationAtPath(ctx.siteId, ref.locale, ref.path)
  if (atPath.folderId !== id) {
    throw new ToolError(NOTHING_THERE)
  }
  return {
    kind: 'folder',
    id,
    locale: ref.locale,
    path: ref.path,
    tags: ref.tags,
    navigationMode: atPath.navigationMode,
    navigationId: atPath.navigationId
  }
}

/** Whether this is the locale's root home page, whose menu is the site-wide one in every mode. */
function isSiteRoot(entry: NavEntry): boolean {
  return entry.kind === 'page' && entry.path === 'home'
}

/**
 * The menu a save in this mode writes its items to, as `navigation.updateNavigation` decides it: the
 * inherited one for `inherit` (null when the sidebar above is hidden), the entry's own otherwise —
 * except on the root home page, which edits the site-wide menu regardless.
 */
async function targetMenuId(
  ctx: McpContext,
  entry: NavEntry,
  mode: NavigationMode
): Promise<string | null> {
  if (mode === 'inherit' || isSiteRoot(entry)) {
    return WIKI.models.navigation.inheritedNavId(ctx.siteId, entry.id)
  }
  return entry.id
}

/** Where the entry owning a menu sits, for an agent to read: empty for the locale's site-wide menu. */
async function menuOwnerPath(
  ctx: McpContext,
  menuId: string,
  locale: string
): Promise<string | null> {
  const owner = await WIKI.models.navigation.refForNavId(ctx.siteId, menuId, locale)
  if (!owner) {
    return null
  }
  // -> The site-wide menu is reported at the home page's path for the page rules; to a reader it is
  //    the locale's root, which is what `list_navigation_menus` calls it too
  const isSiteMenu = !(await WIKI.models.navigation.entryRef(ctx.siteId, menuId))
  return isSiteMenu ? '' : owner.path
}

/**
 * Whether this caller may edit the items of the menu this entry would show in `mode` — the question
 * the update route asks: `manage:navigation` here, and on the entry owning that menu.
 */
async function mayEditItems(
  ctx: McpContext,
  entry: NavEntry,
  mode: NavigationMode
): Promise<boolean> {
  if (!mayOnPage(ctx, 'manage:navigation', { ...entry, siteId: ctx.siteId })) {
    return false
  }
  const owner = await WIKI.models.navigation.menuOwnerRef(ctx.siteId, entry.id, mode)
  return Boolean(owner) && mayOnPage(ctx, 'manage:navigation', { ...owner!, siteId: ctx.siteId })
}

/** The whole of a menu, items limited to other groups included — what an edit has to start from. */
async function fullItems(ctx: McpContext, menuId: string): Promise<any[]> {
  return (await callApi(ctx, 'GET', `sites/${ctx.siteId}/navigation/${menuId}`, {
    query: { full: true }
  })) as any[]
}

/**
 * A fingerprint of a menu's stored items, which a save is checked against: the route replaces the
 * whole menu, so a save made from a stale read would silently undo somebody else's change.
 */
function versionOf(menuId: string, items: any[]): string {
  const stored = items.map(storedShape)
  return `${menuId}:${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 16)}`
}

/** What the read route works out about a `menu` item's target, which is not stored. */
const DERIVED_FIELDS = ['targetPath', 'targetMissing', 'targetHasPage', 'targetPage']

/** An item as it is stored, without what the read route works out about a `menu` item's target. */
function storedShape(item: any): NavigationItem {
  const rest: any = omit(item, DERIVED_FIELDS)
  return rest.children ? { ...rest, children: rest.children.map(storedShape) } : rest
}

/** An item as the tools hand it to an agent: its target menu named by path as well as by id. */
function itemAnswer(item: any): Record<string, unknown> {
  const rest: any = omit(item, DERIVED_FIELDS)
  return {
    ...rest,
    ...(item.type === 'menu'
      ? {
          targetMenuPath: item.targetMissing ? null : (item.targetPath ?? null),
          ...(item.targetMissing
            ? { note: 'The menu this item opened is gone; it is shown to nobody.' }
            : {})
        }
      : {}),
    ...(rest.children ? { children: rest.children.map(itemAnswer) } : {})
  }
}

const MODE_DESCRIPTION =
  '`inherit`: show the menu of the nearest ancestor that overrides, or the site-wide menu. `override`: this page or folder gets a menu of its own, shown here and on everything below it that inherits. `overrideExact`: its own menu, here only; below it inherits from above. `hide`: no sidebar here or below. `hideExact`: no sidebar here only.'

const getNavigation: McpTool<PageRef> = {
  name: 'get_navigation',
  title: 'Get the navigation of a page or folder',
  description:
    "Reads the sidebar menu a page or folder shows: how it resolves it (its navigation mode), which menu that is and where that menu lives — the locale's site-wide menu (`menuPath` empty), which the home page edits and every page falls back to, or the page or folder that overrides it — and the menu's items: headers, links (with an Iconify icon such as `mdi:book-open-variant`, and nested child links), separators, and `menu` items that open another page's menu in the sidebar. Also says whether you may change the mode and the items, and gives the `version` to pass to update_navigation. A path finds the page there first, and the folder only where there is no page.",
  group: 'navigation',
  category: 'navigation',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...PAGE_REF_PROPERTIES,
      id: {
        type: 'string',
        format: 'uuid',
        description: 'The id of a page, or of a folder as browse_tree names it.'
      },
      path: {
        type: 'string',
        maxLength: 2048,
        description:
          'The path of a page or folder without any locale prefix, e.g. guides/setup. `home` (or empty) for the home page, whose menu is the site-wide one.'
      }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const entry = await resolveEntry(ctx, args)
    const canSetMode = mayOnPage(ctx, 'manage:navigation', { ...entry, siteId: ctx.siteId })
    const canEditItems = await mayEditItems(ctx, entry, entry.navigationMode)
    const menuId = entry.navigationId
    let items: any[] = []
    let version: string | null = null
    if (menuId) {
      if (canEditItems) {
        items = await fullItems(ctx, menuId)
        version = versionOf(menuId, items)
      } else {
        items = (await callApi(ctx, 'GET', `sites/${ctx.siteId}/navigation/${menuId}`)) as any[]
      }
    }
    /*
      A page or folder that overrode once and went back to inherit or hide keeps its own menu, shown
      by nothing until it overrides again — and a save with `override` writes into THAT menu. Without
      it here, its version could not be had, and the stale-read check would refuse every such save.
    */
    let ownMenu: Record<string, unknown> | null = null
    if (!isSiteRoot(entry) && menuId !== entry.id && (await mayEditItems(ctx, entry, 'override'))) {
      const own = await fullItems(ctx, entry.id)
      if (own.length > 0) {
        ownMenu = {
          menuId: entry.id,
          items: own.map(itemAnswer),
          version: versionOf(entry.id, own),
          note: `This ${entry.kind}'s own menu, kept from when it last overrode and shown by nothing now. Mode override or overrideExact shows it again; saving items with either mode replaces it, so pass this version.`
        }
      }
    }
    return jsonResult({
      [entry.kind]: {
        id: entry.id,
        locale: entry.locale,
        path: entry.path,
        ...(entry.kind === 'page' ? { url: pageUrl(ctx, entry.locale, entry.path) } : {})
      },
      mode: entry.navigationMode,
      ...(menuId
        ? {
            menuId,
            menuPath: await menuOwnerPath(ctx, menuId, entry.locale),
            items: items.map(itemAnswer)
          }
        : { note: 'The sidebar is hidden here.' }),
      canSetMode,
      canEditItems,
      ...(version ? { version } : {}),
      ...(ownMenu ? { ownMenu } : {}),
      ...(!canEditItems && menuId
        ? {
            itemsNote:
              'Only the items you may see are listed. Editing them needs manage:navigation on the page or folder owning the menu.'
          }
        : {})
    })
  }
}

const navigationItemSchema = (nested: boolean): Record<string, any> => ({
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 255,
      description: 'Keep the id of an item you got from get_navigation. A new item gets one.'
    },
    type: {
      type: 'string',
      enum: nested ? ['link', 'header', 'separator'] : ['link', 'header', 'separator', 'menu']
    },
    label: { type: 'string', maxLength: 255 },
    icon: {
      type: 'string',
      maxLength: 255,
      description:
        'An Iconify reference, `prefix:name`, e.g. `mdi:rocket-launch-outline` or `mdi:cog-outline`. The wiki stores it so it can serve it.'
    },
    target: {
      type: 'string',
      maxLength: 2048,
      description:
        'A link only: a path on this wiki with its locale prefix (e.g. `/en/guides/setup`), or an http://, https:// or mailto: address.'
    },
    openInNewWindow: { type: 'boolean' },
    visibilityGroups: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      description:
        'Group ids the item is limited to. Visible to everyone when empty or absent. Keep what get_navigation gave you.'
    },
    ...(nested
      ? {}
      : {
          expandByDefault: {
            type: 'boolean',
            description: 'A link with children: whether its submenu is shown open.'
          },
          targetNavId: {
            type: 'string',
            format: 'uuid',
            description: 'A `menu` item: the id of the menu it opens.'
          },
          targetMenuPath: {
            type: ['string', 'null'],
            maxLength: 2048,
            description:
              'A `menu` item, instead of `targetNavId`: the path of the page or folder owning the menu it opens, as list_navigation_menus names it. Ignored when `targetNavId` is given.'
          },
          showLink: {
            type: 'boolean',
            description:
              "A `menu` item: whether it also links to the page at the target menu's location."
          },
          children: {
            type: 'array',
            maxItems: 100,
            items: navigationItemSchema(true),
            description: 'A link only: links nested under it, one level deep.'
          }
        })
  },
  required: ['type'],
  additionalProperties: false
})

interface ItemArg {
  id?: string
  type: NavigationItem['type']
  label?: string
  icon?: string
  target?: string
  openInNewWindow?: boolean
  visibilityGroups?: string[]
  expandByDefault?: boolean
  targetNavId?: string
  targetMenuPath?: string | null
  showLink?: boolean
  children?: ItemArg[]
}

/**
 * Items as the route stores them: an id on each, a `menu` item's target resolved from a path to an
 * id among the menus this caller may pick, and no field that does not belong to the item's type.
 */
async function toStoredItems(
  ctx: McpContext,
  locale: string,
  items: ItemArg[]
): Promise<NavigationItem[]> {
  let targets: Array<{ id: string; path: string }> | null = null
  const resolveTarget = async (path: string): Promise<string> => {
    targets ??= (
      await callApi(ctx, 'GET', `sites/${ctx.siteId}/navigation/targets`, { query: { locale } })
    ).menus as Array<{ id: string; path: string }>
    const wanted = normalizePagePath(decodeUrlPath(path))
    const found = targets.find((target) => target.path === wanted)
    if (!found) {
      throw new ToolError(
        `There is no menu at "${path}" in ${locale} that you may point a menu item at. list_navigation_menus lists those you may.`
      )
    }
    return found.id
  }
  const convert = async (item: ItemArg, nested: boolean): Promise<NavigationItem> => {
    const stored: NavigationItem = {
      id: item.id || uuid(),
      type: item.type,
      ...(item.type !== 'separator' && item.label !== undefined ? { label: item.label } : {}),
      ...(item.type !== 'separator' && item.icon ? { icon: item.icon } : {}),
      visibilityGroups: item.visibilityGroups ?? []
    }
    if (item.type === 'link') {
      if (!item.target) {
        throw new ToolError(`The link "${item.label ?? ''}" has no \`target\`.`)
      }
      stored.target = item.target
      stored.openInNewWindow = item.openInNewWindow ?? false
      if (!nested) {
        stored.expandByDefault = item.expandByDefault ?? false
        stored.children = await Promise.all(
          (item.children ?? []).map((child) => convert(child, true))
        )
      }
    } else if (item.children?.length) {
      throw new ToolError('Only a link can hold children.')
    }
    if (item.type === 'menu') {
      if (item.targetNavId) {
        stored.targetNavId = item.targetNavId
      } else if (typeof item.targetMenuPath === 'string') {
        stored.targetNavId = await resolveTarget(item.targetMenuPath)
      } else {
        throw new ToolError(
          `The menu item "${item.label ?? ''}" names no menu to open: give \`targetMenuPath\` or \`targetNavId\`.`
        )
      }
      stored.showLink = item.showLink ?? false
    }
    return stored
  }
  return Promise.all(items.map((item) => convert(item, false)))
}

/** The icons a menu names, so that the wiki can serve each without asking Iconify. */
function iconsOf(items: NavigationItem[]): string[] {
  const icons = items.flatMap((item) => [item.icon, ...(item.children ?? []).map((c) => c.icon)])
  return [...new Set(icons.filter((icon): icon is string => Boolean(icon)))]
}

const updateNavigation: McpTool<
  PageRef & { mode?: NavigationMode; items?: ItemArg[]; expectedVersion?: string }
> = {
  name: 'update_navigation',
  title: 'Update the navigation of a page or folder',
  description:
    "Sets how a page or folder resolves its sidebar (`mode`), and/or replaces the items of the menu it then shows (`items`, the whole menu, in order). Read it first with get_navigation and send back every item you are keeping, with its `id`, and that call's `version` as `expectedVersion`; if the menu changed since, nothing is written and you are told. With mode `inherit` the items are those of the menu the page inherits — an ancestor's, or the site-wide one every page falls back to — so changing them changes the sidebar of every page using it. To give the whole wiki a sidebar, edit the home page's (path `home`). The sidebar of every page is something everybody sees: change it only when the person you are working for asked.\n\n" +
    MODE_DESCRIPTION,
  group: 'navigation',
  category: 'navigation',
  readOnly: false,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...PAGE_REF_PROPERTIES,
      id: {
        type: 'string',
        format: 'uuid',
        description: 'The id of a page, or of a folder as get_navigation names it.'
      },
      path: {
        type: 'string',
        maxLength: 2048,
        description:
          'The path of a page or folder without any locale prefix. `home` for the home page, whose menu is the site-wide one.'
      },
      mode: {
        type: 'string',
        enum: NAVIGATION_MODES,
        description: `Leave out to keep the current one. ${MODE_DESCRIPTION}`
      },
      items: {
        type: 'array',
        maxItems: 200,
        items: navigationItemSchema(false),
        description:
          'The whole menu, top to bottom. Leave out to change only the mode. An empty list empties the menu.'
      },
      expectedVersion: {
        type: 'string',
        maxLength: 100,
        description:
          'The `version` get_navigation gave you. Required with `items` when the menu they replace is not empty.'
      }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const entry = await resolveEntry(ctx, args)
    const mode = args.mode ?? entry.navigationMode
    if (args.items === undefined && mode === entry.navigationMode) {
      throw new ToolError('Nothing to change: give a different `mode`, or `items`.')
    }
    let items: NavigationItem[] | undefined
    if (args.items !== undefined) {
      const menuId = await targetMenuId(ctx, entry, mode)
      if (!menuId) {
        throw new ToolError(
          'With `inherit` this page or folder inherits a hidden sidebar, so there is no menu to store items in. Use `override` to give it a menu of its own.'
        )
      }
      if (!(await mayEditItems(ctx, entry, mode))) {
        throw new ToolError(
          'You may not edit the items of that menu: it belongs to a page or folder whose navigation you do not manage. You may still be able to change the mode alone.'
        )
      }
      const current = await fullItems(ctx, menuId)
      if (current.length > 0 && args.expectedVersion !== versionOf(menuId, current)) {
        throw new ToolError(
          menuId !== entry.navigationId
            ? `With \`${mode}\` the items go to this ${entry.kind}'s own menu, which is not the one shown now and already has items: get_navigation lists it as \`ownMenu\`; pass its \`version\`.`
            : args.expectedVersion
              ? 'The menu has changed since you read it. Read it again with get_navigation.'
              : 'The menu has items: read it with get_navigation and pass its `version` as `expectedVersion`.'
        )
      }
      items = await toStoredItems(ctx, entry.locale, args.items)
    }
    const result = await callApi(ctx, 'PUT', `sites/${ctx.siteId}/navigation/pages/${entry.id}`, {
      body: { mode, ...(items ? { items } : {}) }
    })
    /*
      The icon picker stores every icon it hands out, so that the wiki serves it without the Iconify
      API; an icon an agent names is stored the same way, after the save the route has allowed.
    */
    const failedIcons = items ? await WIKI.models.icons.materializeIcons(iconsOf(items)) : []
    const menuId: string | null = result?.navigationId ?? null
    const saved = menuId && items ? await fullItems(ctx, menuId) : null
    return jsonResult({
      [entry.kind]: { id: entry.id, locale: entry.locale, path: entry.path },
      mode: result?.navigationMode ?? mode,
      ...(menuId ? { menuId, menuPath: await menuOwnerPath(ctx, menuId, entry.locale) } : {}),
      ...(saved ? { itemCount: saved.length, version: versionOf(menuId!, saved) } : {}),
      ...(failedIcons.length > 0
        ? {
            iconsNotFound: failedIcons,
            iconsNote:
              'These icons do not exist or are in a set that is not enabled, and will not be drawn. Pick others and save again.'
          }
        : {})
    })
  }
}

const listNavigationMenus: McpTool<{ locale?: string }> = {
  name: 'list_navigation_menus',
  title: 'List the navigation menus you manage',
  description:
    "The sidebar menus of a locale whose navigation you manage — the site-wide one (`path` empty, edited from the home page) and one per page or folder that overrides it — which are also the menus a `menu` item may open. Use a `path` from here as a `menu` item's `targetMenuPath`, or with get_navigation to read that menu.",
  group: 'navigation',
  category: 'navigation',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      locale: {
        type: 'string',
        maxLength: 10,
        description: "The site's primary locale when absent."
      }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const locale = args.locale || primaryLocale(ctx)
    if (!activeLocales(ctx).includes(locale)) {
      throw new ToolError(`${locale} is not a locale of this site.`)
    }
    const { menus } = await callApi(ctx, 'GET', `sites/${ctx.siteId}/navigation/targets`, {
      query: { locale }
    })
    return jsonResult({
      locale,
      menus: (menus as Array<{ id: string; path: string; isRoot: boolean; hasPage: boolean }>).map(
        (menu) => ({
          id: menu.id,
          path: menu.path,
          ...(menu.isRoot ? { siteWide: true } : {}),
          hasPage: menu.hasPage
        })
      )
    })
  }
}

export const navigationTools: McpTool[] = [getNavigation, listNavigationMenus, updateNavigation]
