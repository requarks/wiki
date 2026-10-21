import { normalizeNewPagePath } from '../../helpers/common.ts'
import { resolveLink } from '../../helpers/pageLinks.ts'
import { sourceLinkHrefs } from '../../helpers/linkRewrite.ts'
import { audit } from '../../helpers/audit.ts'
import { retagRefusal } from '../../api/pages.ts'
import { PAGE_ICON_COLORS, SOURCE_SYNTAX } from '../../models/pages.ts'
import { mayOnPage, pageUrl } from '../context.ts'
import {
  loadPageRef,
  loadReadablePage,
  PAGE_REF_PROPERTIES,
  pageFields,
  primaryLocale
} from '../content.ts'
import { jsonResult, ToolError } from '../tool.ts'
import type { McpContext } from '../context.ts'
import type { PageRef } from '../content.ts'
import type { McpTool } from '../tool.ts'
import type { Page, PageActor } from '../../models/pages.ts'

/** The editors whose source an assistant writes: prose, which a person can then read in a diff. */
const WRITABLE_EDITORS = new Set(['markdown', 'visual', 'asciidoc'])

/** One find-and-replace in a page's source. */
interface SourceEdit {
  oldText: string
  newText: string
}

const EDITS_SCHEMA = {
  type: 'array',
  minItems: 1,
  maxItems: 50,
  description:
    "Find-and-replace edits on the page's source, applied in order. Each `oldText` must appear exactly once in the source as it stands after the edits before it — include enough surrounding text to make it unique. Prefer this to `content`: a correction should change the passage that is wrong and nothing else, so the diff a person reviews is that small.",
  items: {
    type: 'object',
    required: ['oldText', 'newText'],
    additionalProperties: false,
    properties: {
      oldText: { type: 'string', minLength: 1, maxLength: 100000 },
      newText: { type: 'string', maxLength: 100000 }
    }
  }
}

const REASON_SCHEMA = {
  type: 'string',
  minLength: 3,
  maxLength: 255,
  description:
    'Why the change is being made, in a sentence — "The rotation job was renamed in v3", not "Updated page". Recorded on the version, shown in the history, and used as the commit message where the wiki keeps its pages in git. Required: it is how a person decides whether to trust the change.'
}

const ICON_DESCRIPTION =
  'The icon shown for the page, as an Iconify reference `prefix:name`. Pick one from the Material Design Icons (`mdi`, e.g. `mdi:server-network`) or Line Awesome (`la`, e.g. `la:robot`) sets. Refused if this wiki cannot show it.'

const ICON_COLOR_DESCRIPTION = `The color the icon is drawn in, by Tailwind CSS color name. Leave this out unless the person you are working for asked for a specific color: the default, the site's primary color, is what pages normally use. One of: ${PAGE_ICON_COLORS.join(', ')}.`

/**
 * Make sure the wiki can draw an icon an assistant named — what the icon picker's materialize call
 * does for a person picking one. Stored as it is checked, so the icon is served without the Iconify
 * API from then on.
 *
 * @throws ToolError when it is malformed, from a set that is not enabled, or does not exist
 */
async function assertIcon(icon: string): Promise<void> {
  if (!icon) {
    return
  }
  const failed = await WIKI.models.icons.materializeIcons([icon])
  if (failed.length > 0) {
    throw new ToolError(
      `This wiki cannot show the icon ${icon}: it is not a \`prefix:name\` reference, its set is not enabled here, or the set has no icon by that name. Pick another from the mdi or la sets.`
    )
  }
}

/**
 * The actor a page write is made as: the token's owner, with their group-wide permissions — which is
 * what decides whether the render may keep scripts and styles, as it does for the same token on
 * `/_api` (dev/specs/mcp.md §6.2).
 */
function writerOf(ctx: McpContext): PageActor {
  if (!ctx.user) {
    // -> Write tools need `mcp:write`, which an anonymous caller never holds; this is the backstop
    throw new ToolError('Writing needs a personal access token.')
  }
  return { id: ctx.user.id, permissions: ctx.actor.permissions }
}

/**
 * Refuse a page write this wiki cannot render. A page an assistant writes has no browser to render
 * it, and an unrendered page is blank to readers and missing from search — not contributed at all —
 * so without the renderer the tools that produce one are unavailable rather than half-working.
 */
async function assertCanRender(): Promise<void> {
  if (!(await WIKI.models.rendering.isAvailable())) {
    throw new ToolError(
      'Writing pages is unavailable on this wiki: it has no server-side renderer (the Puppeteer extension). Use suggest_edit instead — a reviewer applies the change and their browser renders it.'
    )
  }
}

/**
 * Apply find-and-replace edits to a source, each matched exactly once.
 *
 * @throws ToolError naming the edit that did not match, or matched more than once
 */
export function applyEdits(source: string, edits: SourceEdit[]): string {
  let result = source
  edits.forEach((edit, index) => {
    const first = result.indexOf(edit.oldText)
    if (first < 0) {
      throw new ToolError(
        `Edit ${index + 1}: its oldText is not in the page's source. Read the page again with get_page and copy the text exactly.`
      )
    }
    if (result.indexOf(edit.oldText, first + 1) >= 0) {
      throw new ToolError(
        `Edit ${index + 1}: its oldText appears more than once. Include more of the text around it.`
      )
    }
    result = result.slice(0, first) + edit.newText + result.slice(first + edit.oldText.length)
  })
  return result
}

/**
 * The links in a page's source that reach no page the caller may read — so that a broken link is
 * fixed in the same task rather than found by the next reader.
 *
 * Read off the source rather than the `pageLinks` rows: a page written here has no render until the
 * queue reaches it, and the rows are made from the render. The same reader the importer uses
 * (`sourceLinkHrefs`), and the same resolution (`resolveLink`). A link to a page the caller may not
 * read is reported as not reaching anything, as `get_page_links` reports it, since that is what
 * following it would give them. Only links within this site; assets are not checked.
 */
async function brokenLinksIn(
  ctx: McpContext,
  page: { locale: string; path: string; editor: string },
  source: string
): Promise<string[]> {
  const syntax = SOURCE_SYNTAX[page.editor]
  if (!syntax) {
    return []
  }
  const broken: string[] = []
  for (const href of new Set(sourceLinkHrefs(source, syntax))) {
    const link = resolveLink(href, { siteId: ctx.siteId, locale: page.locale, path: page.path })
    if (!link || link.targetSiteId !== ctx.siteId || link.kind === 'asset') {
      continue
    }
    let target: { id: string } | null = null
    if (link.kind === 'page' && link.targetLocale && link.targetPath !== null) {
      const id = await WIKI.models.pages.idAtPath(ctx.siteId, link.targetLocale, link.targetPath)
      target = id ? { id } : null
    } else if (link.kind === 'alias' && link.targetRef) {
      target = await WIKI.models.pages.getPathFromAlias(ctx.siteId, link.targetRef)
    } else if (link.kind === 'pageId' && link.targetRef) {
      target = await WIKI.models.pages.getPathFromId(ctx.siteId, link.targetRef)
    }
    const readable = target
      ? await loadReadablePage(ctx, target.id).then(
          () => true,
          () => false
        )
      : false
    if (!readable) {
      broken.push(href)
    }
  }
  return broken
}

/** What every page write answers with: where the page is now, its version, and what to fix next. */
async function writeAnswer(
  ctx: McpContext,
  page: Page,
  versionId: string | null,
  source: string,
  { queued, ...extra }: { queued: boolean } & Record<string, unknown>
) {
  const brokenLinks = await brokenLinksIn(ctx, page, source)
  return jsonResult({
    ...pageFields(ctx, page),
    versionId,
    publishState: page.publishState,
    ...extra,
    ...(queued
      ? {
          render: 'queued',
          note: 'The page is saved and queued for rendering: readers and search see the new version once the renderer has been through it, usually within seconds.'
        }
      : {}),
    ...(brokenLinks.length > 0
      ? {
          brokenLinks,
          brokenLinksNote:
            'These links reach no page you may read. Fix them with update_page, or create the pages they point at.'
        }
      : {})
  })
}

const createPage: McpTool<{
  path: string
  locale?: string
  title: string
  description?: string
  icon?: string
  iconColor?: string
  tags?: string[]
  content: string
  reason: string
}> = {
  name: 'create_page',
  title: 'Create a page',
  description:
    'Creates a new wiki page in markdown, to record something the wiki does not have yet — for the next person, and the next assistant. Search first (search_pages) and update an existing page instead whenever one covers the topic; use browse_tree to see where the page belongs and how pages there are named. Refused if a page already exists at the path, with that page, so you can update it instead. Link to other wiki pages by their path, e.g. [Setup](/guides/setup). A diagram is better as a ```mermaid code block than as an image. The answer lists any links that reach no page.',
  group: 'edit',
  category: 'pages',
  readOnly: false,
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        minLength: 1,
        maxLength: 2048,
        description:
          'Where the page goes, without a locale prefix: lowercase words separated by hyphens, folders by slashes, e.g. `runbooks/database-credentials`.'
      },
      locale: {
        type: 'string',
        maxLength: 10,
        description: "The page's locale. The site's primary locale when absent."
      },
      title: { type: 'string', minLength: 1, maxLength: 255 },
      description: {
        type: 'string',
        maxLength: 255,
        description: 'One sentence saying what the page is for. Shown in search results.'
      },
      icon: {
        type: 'string',
        maxLength: 255,
        description: `${ICON_DESCRIPTION} Leave out for the default page icon.`
      },
      iconColor: {
        type: 'string',
        enum: [...PAGE_ICON_COLORS],
        description: ICON_COLOR_DESCRIPTION
      },
      tags: {
        type: 'array',
        maxItems: 20,
        items: { type: 'string', minLength: 1, maxLength: 255 },
        description: 'Use tags the wiki already uses (list_tags) where they fit.'
      },
      content: {
        type: 'string',
        minLength: 1,
        maxLength: 1000000,
        description:
          "The page's markdown. Do not repeat the title as a level-1 heading: the page shows it already."
      },
      reason: REASON_SCHEMA
    },
    required: ['path', 'title', 'content', 'reason'],
    additionalProperties: false
  },
  async run(ctx, args) {
    const actor = writerOf(ctx)
    await assertCanRender()
    const locale = args.locale || primaryLocale(ctx)
    const path = normalizeNewPagePath(args.path)

    // -> Before anything else, so that the answer to "it is already there" is the page to update
    const existingId = await WIKI.models.pages.idAtPath(ctx.siteId, locale, path)
    if (existingId) {
      const existing = await loadReadablePage(ctx, existingId).catch(() => null)
      if (existing) {
        throw new ToolError(
          `A page already exists at ${path}: ${pageUrl(ctx, existing.locale, existing.path)} (id ${existing.id}). Read it with get_page and change it with update_page rather than creating another.`
        )
      }
      throw new ToolError(`A page already exists at ${path} in ${locale}. Choose another path.`)
    }

    // -> As the create route asks: of the page as it is about to be, tags and all
    const incoming = { siteId: ctx.siteId, path, locale, tags: args.tags ?? [] }
    if (!mayOnPage(ctx, 'write:pages', incoming)) {
      throw new ToolError('You are not allowed to create a page there.')
    }
    if (incoming.tags.length > 0 && !mayOnPage(ctx, 'write:tags', incoming)) {
      throw new ToolError('You are not allowed to assign tags to a page there.')
    }
    const icon = args.icon?.trim() ?? ''
    await assertIcon(icon)

    const { page, versionId } = await WIKI.models.pages.createPage(
      ctx.siteId,
      {
        path,
        locale,
        title: args.title,
        description: args.description ?? '',
        icon,
        iconColor: args.iconColor ?? '',
        tags: args.tags ?? [],
        editor: 'markdown',
        content: args.content,
        publishState: WIKI.models.mcp.getConfig().newPagePublishState,
        reasonForChange: args.reason
      },
      actor
    )
    await WIKI.models.pages.queueRerender(ctx.siteId, page.id, actor)
    await audit(ctx.req, 'page', 'createPage', {
      pageId: page.id,
      siteId: ctx.siteId,
      locale: page.locale,
      path: page.path,
      title: page.title,
      versionId
    })
    return writeAnswer(ctx, page, versionId, args.content, { queued: true })
  }
}

const updatePage: McpTool<
  PageRef & {
    baseVersionId: string
    edits?: SourceEdit[]
    content?: string
    title?: string
    description?: string
    icon?: string
    iconColor?: string
    tags?: string[]
    reason: string
  }
> = {
  name: 'update_page',
  title: 'Update a page',
  description:
    'Changes an existing page: corrects what is wrong, updates what is out of date, adds what is missing. Read the page with get_page first and pass its `versionId` as `baseVersionId`; if the page has changed since, nothing is written and you are told the current version, so read it again. Prefer `edits` (exact find-and-replace on the source) over sending the whole `content`. Change only what you mean to. If you may not edit the page, suggest_edit sends the change to its reviewers instead, and post_comment flags the problem. The answer lists any links that reach no page.',
  group: 'edit',
  category: 'pages',
  readOnly: false,
  inputSchema: {
    type: 'object',
    properties: {
      ...PAGE_REF_PROPERTIES,
      baseVersionId: {
        type: 'string',
        format: 'uuid',
        description: 'The `versionId` get_page gave you: the version your change is made against.'
      },
      edits: EDITS_SCHEMA,
      content: {
        type: 'string',
        minLength: 1,
        maxLength: 1000000,
        description: 'The whole new source, instead of `edits`. Only for a rewrite.'
      },
      title: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 255 },
      icon: {
        type: 'string',
        maxLength: 255,
        description: `${ICON_DESCRIPTION} Leave out to keep the current one; an empty string puts back the default page icon.`
      },
      iconColor: {
        type: 'string',
        enum: ['', ...PAGE_ICON_COLORS],
        description: `${ICON_COLOR_DESCRIPTION} Leave out to keep the current one; an empty string puts back the default.`
      },
      tags: {
        type: 'array',
        maxItems: 20,
        items: { type: 'string', minLength: 1, maxLength: 255 },
        description: 'The full new list of tags. Leave out to keep the current ones.'
      },
      reason: REASON_SCHEMA
    },
    required: ['baseVersionId', 'reason'],
    additionalProperties: false
  },
  async run(ctx, args) {
    const actor = writerOf(ctx)
    if (args.edits && args.content !== undefined) {
      throw new ToolError('Send either `edits` or `content`, not both.')
    }
    const page = await loadPageRef(ctx, args, { withContent: true })
    if (!mayOnPage(ctx, 'write:pages', page)) {
      throw new ToolError(
        'You may not edit this page. Use suggest_edit to send the change to its reviewers, or post_comment to point out what is wrong.'
      )
    }
    if (!WRITABLE_EDITORS.has(page.editor)) {
      throw new ToolError(
        `This page is written with the ${page.editor} editor, which is not prose an assistant can edit.`
      )
    }
    await assertCanRender()

    /*
      Against the version the agent read, so that a correction is always made to what the page says
      now. Refused rather than merged: a stale base means the agent's reading of the page is stale too.
    */
    const currentVersionId = await WIKI.models.pageHistory.latestVersionId(ctx.siteId, page.id)
    if (currentVersionId !== args.baseVersionId) {
      throw new ToolError(
        `The page has changed since version ${args.baseVersionId}: it is now at ${currentVersionId}. Read it again with get_page and make your change against what it says now.`
      )
    }

    /*
      Somebody has the page open in the editor. Their next save is their room's text, which does not
      have this change in it, and would silently replace it — so the page is theirs until they leave.
      Rooms live per instance: on an HA set this sees the ones on the instance that took the call, so
      it is the common case covered rather than every case. See dev/specs/mcp.md §6.4.
    */
    if (WIKI.collab.rooms.has(page.id)) {
      throw new ToolError(
        'Somebody is editing this page right now, and their next save would overwrite your change. Use suggest_edit instead, or try again later.'
      )
    }

    const source = page.content ?? ''
    const content =
      args.content !== undefined
        ? args.content
        : args.edits
          ? applyEdits(source, args.edits)
          : undefined
    if (
      content === undefined &&
      args.title === undefined &&
      args.description === undefined &&
      args.icon === undefined &&
      args.iconColor === undefined &&
      args.tags === undefined
    ) {
      throw new ToolError(
        'Nothing to change: send `edits`, `content`, `title`, `description`, `icon`, `iconColor` or `tags`.'
      )
    }

    const retagRefused = retagRefusal(ctx.req, page, args.tags)
    if (retagRefused) {
      throw new ToolError(retagRefused)
    }
    const icon = args.icon?.trim()
    if (icon !== undefined) {
      await assertIcon(icon)
    }

    const change = await WIKI.models.pages.updatePage(
      ctx.siteId,
      page.id,
      {
        ...(content === undefined ? {} : { content }),
        ...(args.title === undefined ? {} : { title: args.title }),
        ...(args.description === undefined ? {} : { description: args.description }),
        ...(icon === undefined ? {} : { icon }),
        ...(args.iconColor === undefined ? {} : { iconColor: args.iconColor }),
        ...(args.tags === undefined ? {} : { tags: args.tags }),
        reasonForChange: args.reason
      },
      actor
    )
    if (!change) {
      throw new ToolError('There is no page there that you may read.')
    }
    if (content !== undefined) {
      await WIKI.models.pages.queueRerender(ctx.siteId, page.id, actor)
    }
    await audit(ctx.req, 'page', 'updatePage', {
      pageId: change.page.id,
      siteId: ctx.siteId,
      locale: change.page.locale,
      path: change.page.path,
      title: change.page.title,
      versionId: change.versionId
    })
    return writeAnswer(ctx, change.page, change.versionId, content ?? source, {
      queued: content !== undefined,
      previousVersionId: args.baseVersionId
    })
  }
}

export const editTools: McpTool[] = [createPage, updatePage]
