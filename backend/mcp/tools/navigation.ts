import { randomUUID } from 'node:crypto'
import { NAVIGATION_MODES } from '../../models/navigation.ts'
import { callApi } from '../inject.ts'
import { loadPageRef, PAGE_REF_PROPERTIES, pageFields, resolveRefPath } from '../content.ts'
import { mayOnPage } from '../context.ts'
import { jsonResult, ToolError } from '../tool.ts'
import type { McpContext } from '../context.ts'
import type { PageRef } from '../content.ts'
import type { McpTool } from '../tool.ts'
import type {
  MayManageNavigation,
  NavigationItem,
  NavigationMode
} from '../../models/navigation.ts'

/*
  The sidebar a page shows, read and edited from the page, exactly as Edit Nav does it in the browser
  and through the same route (`PUT …/navigation/pages/:pageId`) — or from a folder, at a path with no
  page, as the missing-page screen's Edit Nav does. The admin area's own screen, which
  edits every menu of a site with `manage:sites`, is administration and stays out of reach here.

  A menu is replaced whole on every save, and nothing keeps its earlier items: so an agent may write
  items only from a reading of them that is (a) complete — items limited to groups it is not in
  included, which only a caller who may edit them is given — and (b) current, which
  `itemsRevision` proves. Without either, a save would silently drop what it did not see.
*/

/** `manage:navigation` at a path, for this caller. */
function navRuleOf(ctx: McpContext): MayManageNavigation {
  return (ref) => mayOnPage(ctx, 'manage:navigation', ref)
}

/** The page or folder a navigation tool is about. */
interface NavTarget {
  id: string
  kind: 'page' | 'folder'
  locale: string
  mode: NavigationMode
  /** How an answer names it: `page` with the usual page fields, or `folder`. */
  named: Record<string, unknown>
}

/**
 * The page a reference names — or, where there is no page there this caller may read, the folder at
 * the same path (or with that id), which has a sidebar of its own.
 *
 * The browser's rule: Edit Nav is offered on the page at a path, and on the folder only from the
 * missing-page screen, which is what a reader who may not open the page is shown too. Falling back on
 * the folder for an unreadable page, rather than only for an absent one, is also what keeps "there is
 * a page here you may not read" from showing through.
 */
async function loadNavTarget(ctx: McpContext, ref: PageRef): Promise<NavTarget> {
  try {
    const page = await loadPageRef(ctx, ref)
    return {
      id: page.id,
      kind: 'page',
      locale: page.locale,
      mode: page.navigationMode as NavigationMode,
      named: { page: pageFields(ctx, page) }
    }
  } catch (err) {
    if (!(err instanceof ToolError)) {
      throw err
    }
    let folderId: string | null = ref.id ?? null
    if (!folderId) {
      const { locale, path } = resolveRefPath(ctx, ref)
      folderId = await WIKI.models.navigation.folderIdAt(ctx.siteId, locale, path)
    }
    const folder = folderId
      ? await WIKI.models.navigation.describeEntry(ctx.siteId, folderId)
      : null
    if (
      folder?.type !== 'folder' ||
      !mayOnPage(ctx, 'read:pages', { siteId: ctx.siteId, ...folder })
    ) {
      throw err
    }
    return {
      id: folder.id,
      kind: 'folder',
      locale: folder.locale,
      mode: folder.navigationMode,
      named: { folder: { id: folder.id, path: folder.path, locale: folder.locale } }
    }
  }
}

/** The reference properties, with `id` naming a folder too. */
const TARGET_PROPERTIES = {
  ...PAGE_REF_PROPERTIES,
  id: {
    ...PAGE_REF_PROPERTIES.id,
    description: 'The id of a page, or of a folder as get_navigation names it.'
  }
}

const TARGET_HELP =
  'Name a page with `id`, `url` or `path`. A path with no page you may read names the folder there instead: a folder has a sidebar of its own, which is what a reader sees at its path while it has no page, and which — when it overrides — the pages below it inherit. The answer then names it as `folder` rather than `page`, and its `id` works in later calls.'

/** What decides a menu's answer to a reader: which of the page's two menus it is, and who owns it. */
interface MenuAnswer {
  id: string
  /** Whose menu it is: the site-wide one, or the entry at a path the caller may know of. */
  belongsTo?: { siteWide: true } | { path: string; locale: string }
  canEditItems?: boolean
  itemsRevision?: string
  items: NavigationItem[]
}

/**
 * One menu as this caller may see it: in full with a revision to write against when they may edit
 * its items, or as a reader sees it in the sidebar otherwise — through the route that draws the
 * sidebar, so that what is left out for whom is decided in one place.
 */
async function menuFor(
  ctx: McpContext,
  target: NavTarget,
  navId: string,
  canEditItems: boolean | undefined
): Promise<MenuAnswer> {
  const items = await callApi(ctx, 'GET', `sites/${ctx.siteId}/navigation/${navId}`, {
    query: { full: Boolean(canEditItems) }
  })
  let belongsTo: MenuAnswer['belongsTo']
  if (navId !== target.id) {
    // -> A menu keyed by no tree entry is a locale's site-wide one, which is no secret. Any other
    //    owner is a path, and named only to whoever may read what is there, as "Go up" is
    const owner = await WIKI.models.navigation.entryRef(ctx.siteId, navId)
    if (!owner) {
      belongsTo = { siteWide: true }
    } else if (mayOnPage(ctx, 'read:pages', { ...owner, siteId: ctx.siteId })) {
      belongsTo = { path: owner.path, locale: owner.locale }
    }
  }
  return {
    id: navId,
    ...(belongsTo ? { belongsTo } : {}),
    ...(canEditItems !== undefined ? { canEditItems } : {}),
    ...(canEditItems
      ? { itemsRevision: await WIKI.models.navigation.itemsRevision(ctx.siteId, navId) }
      : {}),
    items
  }
}

const getNavigation: McpTool<PageRef> = {
  name: 'get_navigation',
  title: 'Get the navigation of a page or folder',
  description: [
    'The sidebar menu a page (or a folder) shows, and how it decides it — its navigation `mode`:',
    '- `inherit`: shows the menu of the nearest ancestor that overrides one, or the site-wide menu of its locale when none does. Changing that menu changes it for every page that inherits it.',
    '- `override`: shows a menu of its own, which pages below it inherit.',
    '- `overrideExact`: shows a menu of its own; pages below it keep inheriting from above.',
    '- `hide` / `hideExact`: no sidebar, here and below / here only.',
    '',
    "`shows` says which of the page's two menus readers see: `inherited` (the one `inherit` resolves to — null when the sidebar above is hidden) or `own` (the one `override` resolves to). For the home page both are the site-wide menu.",
    '',
    'Where you hold `manage:navigation` on the page, both menus are returned in full, each with `canEditItems` and, where you may edit it, an `itemsRevision` to pass to update_navigation, along with `menuTargets` — the menus a `menu` item may open. Otherwise you get the menu the page shows, as you would see it in the sidebar.',
    '',
    TARGET_HELP,
    '',
    "Item types: `link` (`label`, `target`, optional `icon`, and `children` — links, headers and separators, one level deep), `header` (a `label`), `separator`, and `menu` (top level only: opens the menu `targetNavId` in the sidebar instead of going anywhere; `showLink` makes it also a link to the page at that menu's location). An item with `visibilityGroups` (group ids) is shown only to members of those groups."
  ].join('\n'),
  group: 'navigation',
  category: 'navigation',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: TARGET_PROPERTIES,
    additionalProperties: false
  },
  async run(ctx, args) {
    const target = await loadNavTarget(ctx, args)
    const { mode } = target
    const rule = navRuleOf(ctx)
    const manages = await WIKI.models.navigation.mayManageAt(ctx.siteId, target.id, rule)
    const inheritedId = await WIKI.models.navigation.inheritedNavId(ctx.siteId, target.id)
    const ownId = await WIKI.models.navigation.itemsNavId(ctx.siteId, target.id, 'override')
    const shows = mode === 'inherit' ? 'inherited' : mode.startsWith('override') ? 'own' : null

    const answer: Record<string, unknown> = {
      ...target.named,
      mode,
      shows
    }
    if (!manages) {
      // -> A reader is told what the sidebar here shows them, and nothing about the menu not shown
      const shownId = shows === 'inherited' ? inheritedId : shows === 'own' ? ownId : null
      if (shows && shownId) {
        answer[shows] = await menuFor(ctx, target, shownId, undefined)
      } else if (shows === 'inherited') {
        answer.inherited = null
      }
      return jsonResult(answer)
    }

    answer.inherited = inheritedId
      ? await menuFor(
          ctx,
          target,
          inheritedId,
          await WIKI.models.navigation.mayEditItemsAt(ctx.siteId, target.id, 'inherit', rule)
        )
      : null
    // -> The home page's own menu IS the inherited one, the site-wide menu; it is not repeated
    answer.own =
      ownId === inheritedId
        ? { id: ownId, sameAs: 'inherited' }
        : await menuFor(
            ctx,
            target,
            ownId!,
            await WIKI.models.navigation.mayEditItemsAt(ctx.siteId, target.id, 'override', rule)
          )
    const { menus } = await callApi(ctx, 'GET', `sites/${ctx.siteId}/navigation/targets`, {
      query: { locale: target.locale }
    })
    answer.menuTargets = menus
    return jsonResult(answer)
  }
}

/** What `get_navigation` adds to an item for the reader's sake, and a save has no use for. */
const READ_ONLY_ITEM_FIELDS = ['targetPath', 'targetMissing', 'targetHasPage', 'targetPage']

const ITEM_PROPERTIES = {
  id: {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    description: 'Keep the id of an item you read. Leave it out on a new item.'
  },
  type: { type: 'string', enum: ['link', 'header', 'separator', 'menu'] },
  label: { type: 'string', maxLength: 255 },
  icon: {
    type: 'string',
    maxLength: 255,
    description: 'An icon as `set:name`, e.g. `mdi:book-open-variant`. Optional.'
  },
  target: {
    type: 'string',
    maxLength: 2048,
    description:
      "A `link` item: where it goes — a page of this wiki as its `url` names it (or that URL's path from the site root, e.g. /en/guides/setup), or an http(s):// or mailto: address."
  },
  targetNavId: {
    type: 'string',
    format: 'uuid',
    description: 'A `menu` item: the menu it opens, one of `menuTargets`.'
  },
  showLink: {
    type: 'boolean',
    description:
      "A `menu` item: whether it also links to the page at the target menu's location, where there is one."
  },
  openInNewWindow: { type: 'boolean' },
  expandByDefault: {
    type: 'boolean',
    description: 'A `link` with children: whether its submenu starts open.'
  },
  visibilityGroups: {
    type: 'array',
    maxItems: 100,
    items: { type: 'string', format: 'uuid' },
    description: 'Group ids the item is shown to. Everyone when empty. Keep what you read.'
  },
  ...Object.fromEntries(
    READ_ONLY_ITEM_FIELDS.map((field) => [
      field,
      { description: 'As get_navigation reports it. Ignored.' }
    ])
  )
}

const CHILD_ITEM = {
  type: 'object',
  properties: ITEM_PROPERTIES,
  required: ['type'],
  additionalProperties: false
}

/**
 * An item as the route stores it: what `get_navigation` added for the reader taken off, an id on
 * every new one (the editor tells items apart by it), and a link to a page of this wiki stored as
 * the path it is, so that the menu does not name the host it happened to be written through.
 */
function itemForSave(ctx: McpContext, item: Record<string, any>): NavigationItem {
  const saved: Record<string, any> = {}
  for (const [key, value] of Object.entries(item)) {
    if (!READ_ONLY_ITEM_FIELDS.includes(key)) {
      saved[key] = value
    }
  }
  saved.id ||= randomUUID()
  if (typeof saved.target === 'string' && saved.target.startsWith(`${ctx.origin}/`)) {
    saved.target = saved.target.slice(ctx.origin.length)
  }
  if (Array.isArray(saved.children)) {
    saved.children = saved.children.map((child: Record<string, any>) => itemForSave(ctx, child))
  }
  return saved as NavigationItem
}

const updateNavigation: McpTool<
  PageRef & { mode?: NavigationMode; items?: NavigationItem[]; expectedItemsRevision?: string }
> = {
  name: 'update_navigation',
  title: 'Update the navigation of a page or folder',
  description: [
    "Sets a page's (or a folder's) navigation `mode`, the items of the menu that mode resolves to, or both. Call get_navigation first: it explains the modes and item types.",
    '',
    TARGET_HELP,
    '',
    '`items` REPLACES the whole menu, and its earlier items are not kept anywhere: send every item you read, changed or not, with its `id`, and add or remove only what you mean to. Pass the `itemsRevision` get_navigation gave for that menu as `expectedItemsRevision`; if anybody changed it since, nothing is written and you are told to read it again.',
    '',
    "Which menu the items go to is decided by the mode you send (the page's current one when you send none): with `inherit`, the inherited menu — shared with every page that inherits it, so that is a change for all of them; with any other mode, the page's own. Switching to `override` with no items shows the page's own menu as it stands, which may be empty.",
    '',
    'Editing an inherited menu needs `manage:navigation` where that menu belongs as well as on this page; get_navigation says where you have it (`canEditItems`).'
  ].join('\n'),
  group: 'navigation',
  category: 'navigation',
  readOnly: false,
  // -> Removed items are gone: a menu keeps no history to restore them from
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...TARGET_PROPERTIES,
      mode: {
        type: 'string',
        enum: [...NAVIGATION_MODES],
        description: "The page's navigation mode. Its current one when absent."
      },
      items: {
        type: 'array',
        maxItems: 500,
        items: {
          type: 'object',
          properties: {
            ...ITEM_PROPERTIES,
            children: {
              type: 'array',
              maxItems: 500,
              items: CHILD_ITEM,
              description: 'A `link` item: the links, headers and separators under it.'
            }
          },
          required: ['type'],
          additionalProperties: false
        },
        description: 'The whole menu, in order.'
      },
      expectedItemsRevision: {
        type: 'string',
        maxLength: 64,
        description: 'With `items`: the `itemsRevision` of the menu they replace.'
      }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const { mode: requestedMode, items, expectedItemsRevision, ...ref } = args
    if (!requestedMode && !items) {
      throw new ToolError('Send a `mode`, `items`, or both.')
    }
    const target = await loadNavTarget(ctx, ref)
    const mode = requestedMode ?? target.mode

    let navId: string | null = null
    if (items) {
      navId = await WIKI.models.navigation.itemsNavId(ctx.siteId, target.id, mode)
      if (!navId) {
        throw new ToolError(
          `This ${target.kind} inherits a hidden sidebar, so there is no menu to store items in. Give it a menu of its own with \`override\` or \`overrideExact\`.`
        )
      }
      if (!expectedItemsRevision) {
        throw new ToolError(
          'Pass `expectedItemsRevision`: the `itemsRevision` get_navigation gave for the menu these items replace.'
        )
      }
      // -> Asked before the revision, so that a caller who may not edit the menu is told that rather
      //    than that it changed. The route asks it again, and refuses the mode alone on its own
      if (
        !(await WIKI.models.navigation.mayEditItemsAt(ctx.siteId, target.id, mode, navRuleOf(ctx)))
      ) {
        throw new ToolError(
          mode === 'inherit'
            ? `You may not edit the items of the menu this ${target.kind} inherits: it belongs to a page or folder above whose navigation you do not manage. You may still give this ${target.kind} a menu of its own, or change its mode.`
            : `You are not allowed to manage the navigation of this ${target.kind}.`
        )
      }
      /*
        The route has no such check: the browser's editor holds a menu while a person looks at it,
        and an agent's reading is older and nobody is watching it. What is left is the moment between
        this read and the route's write, which a person's save could fall into as well.
      */
      const current = await WIKI.models.navigation.itemsRevision(ctx.siteId, navId)
      if (current !== expectedItemsRevision) {
        throw new ToolError(
          'This menu has changed since you read it, or the revision is for another menu. Nothing was saved: call get_navigation again and redo your change on what it returns.'
        )
      }
    }

    const result = await callApi(ctx, 'PUT', `sites/${ctx.siteId}/navigation/pages/${target.id}`, {
      body: {
        mode,
        ...(items ? { items: items.map((item) => itemForSave(ctx, item)) } : {})
      }
    })
    return jsonResult({
      ...target.named,
      mode: result.navigationMode,
      ...(navId
        ? {
            savedMenu: {
              id: navId,
              itemsRevision: await WIKI.models.navigation.itemsRevision(ctx.siteId, navId)
            }
          }
        : {}),
      note: 'Pass `savedMenu.itemsRevision` as `expectedItemsRevision` to change the same menu again.'
    })
  }
}

export const navigationTools: McpTool[] = [getNavigation, updateNavigation]
