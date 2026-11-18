import * as cheerio from 'cheerio'
import { slugifyHeading } from '../models/rendering.ts'

import type { AnyNode, Element } from 'domhandler'
import type { CommentAnchor } from '../models/comments.ts'

/**
 * Confluence's storage format → HTML this wiki renders, for **Import from Confluence**
 * (`models/importConfluence.ts`).
 *
 * The storage format is XHTML with two namespaces of Confluence's own mixed in: `ac:` for what
 * Confluence draws (a macro, a link, an image, a task list, a layout) and `ri:` for what such an
 * element points at (a page by space and title, an attachment by file name, a person by account id).
 * Neither means anything to a browser, so every one of them is rewritten here into plain HTML — or
 * into the custom element of the block that does the same job (`block-badge` for a status label) —
 * and what is left is handed to `htmlToMarkdown` like any other HTML, or stored as it is.
 *
 * **What cannot be carried says so.** A macro this file has no translation for is counted by name and
 * leaves a line in the page where it stood rather than vanishing; a macro that LISTS content (a page
 * tree, a report, "recently updated") is dropped and counted, since what it showed was computed by
 * Confluence and there is nothing to keep. The counts are what the import log reports.
 *
 * Parsed with htmlparser2 in HTML mode, not as XML: the format is meant to be XHTML, but Confluence
 * writes HTML entities into it (`&nbsp;`) that an XML parser refuses. `recognizeCDATA` and
 * `recognizeSelfClosing` are the two XML habits it does have.
 */

/** What the converter asks the import about, for everything a body points at. Null is "not imported". */
export interface StorageResolver {
  /** A page's path, by its space and title. */
  pagePath(spaceKey: string, title: string): string | null
  /** A page's path, by its content id. */
  pagePathById(contentId: string): string | null
  /** An attachment's URL path, by the page it is on (space and title) and its file name. */
  filePath(spaceKey: string, title: string, fileName: string): string | null
  /** A person's name, by account id or user key. */
  userName(userId: string): string | null
  /** Where a space's pages are, as a path. */
  spacePath(spaceKey: string): string | null
}

/** Where the body being converted lives, which is what an unqualified reference means. */
export interface StorageContext {
  spaceKey: string
  title: string
  /** The folder this page's children are in: its own path, or the site root for the home page. */
  childrenPath: string
  resolve: StorageResolver
}

/** What a conversion could not carry, for the log. */
export interface StorageLosses {
  /** Macro name → how many were left as a note on the page. */
  unsupported: Map<string, number>
  /** Macro name → how many were dropped, being something Confluence computed. */
  dynamic: Map<string, number>
  /** Links to a page or file that is not part of this import, kept as their text. */
  unresolvedLinks: number
}

export interface StorageConversion {
  html: string
  /** Inline comment marker ref → the passage it marks, described the way an annotation is. */
  anchors: Map<string, CommentAnchor>
}

/** What a body refers to, read before it is converted so that a batch can be looked up at once. */
export interface StorageRefs {
  pages: Array<{ spaceKey: string; title: string }>
  pageIds: string[]
  files: Array<{ spaceKey: string; title: string; fileName: string }>
  users: string[]
  spaces: string[]
}

export function newStorageLosses(): StorageLosses {
  return { unsupported: new Map(), dynamic: new Map(), unresolvedLinks: 0 }
}

/**
 * Macros that show something Confluence works out when the page is viewed — a list of children, a
 * report, a search — and so have nothing in the storage format to carry. `toc` is among them because
 * a page here has its own table of contents beside the article.
 */
const DYNAMIC_MACROS = new Set([
  'toc',
  'toc-zone',
  'pagetreesearch',
  'recently-updated',
  'recently-updated-dashboard',
  'blog-posts',
  'tasks-report-macro',
  'decisionreport',
  'create-from-template',
  'popular-labels',
  'listlabels',
  'livesearch',
  'search',
  'space-details',
  'spaces-list',
  'page-index',
  'attachments',
  'contributors',
  'contributors-summary',
  'profile',
  'profile-picture',
  'network',
  'change-history',
  'favpages',
  'recently-viewed'
])

/**
 * Macros that list the pages carrying some labels — a blueprint's index page is one of these — and
 * become an index of the pages with those tags, which is what labels are here. One that names no
 * label (a CQL query on something else) is dropped with the other computed macros.
 */
const LABEL_LISTINGS = new Set(['contentbylabel', 'content-report-table', 'detailssummary'])

/** Macros that only wrap their body in something this wiki has no use for: the body is kept as is. */
const UNWRAPPED_MACROS = new Set([
  'excerpt',
  'section',
  'column',
  'div',
  'span',
  'details',
  'center',
  'auimessage',
  'tooltip',
  'expand-content',
  'ui-text-box'
])

/**
 * Confluence's four admonitions, and the panel, onto the kinds of alert this wiki draws
 * (`renderers/modules/github-alerts.js`). Confluence's own names do not mean what they say: `note`
 * is its yellow box and `warning` its red one.
 */
const ADMONITIONS: Record<string, string> = {
  info: 'is-info',
  tip: 'is-success',
  note: 'is-warning',
  warning: 'is-danger',
  panel: 'is-info'
}

/** The same, as the editor's ADF panel types name them. */
const ADF_PANELS: Record<string, string> = {
  info: 'is-info',
  note: 'is-important',
  success: 'is-success',
  warning: 'is-warning',
  error: 'is-danger',
  custom: 'is-info'
}

/** Status label colours → `block-badge`'s theme tones. */
const STATUS_COLORS: Record<string, string> = {
  grey: 'grey',
  gray: 'grey',
  red: 'negative',
  yellow: 'warning',
  green: 'positive',
  blue: 'info',
  purple: 'primary'
}

/** The hex values the cloud editor writes for the same six colours. */
const STATUS_HEX: Record<string, string> = {
  '#dfe1e6': 'grey',
  '#ffebe6': 'negative',
  '#ffd5d2': 'negative',
  '#fff0b3': 'warning',
  '#f8e6a0': 'warning',
  '#e3fcef': 'positive',
  '#d3f1a7': 'positive',
  '#baf3db': 'positive',
  '#deebff': 'info',
  '#cce0ff': 'info',
  '#eae6ff': 'primary',
  '#dfd8fd': 'primary'
}

/** Emoticons by Confluence's legacy names, the ones the storage format has used since before emoji. */
const EMOTICON_NAMES: Record<string, string> = {
  smile: '🙂',
  sad: '🙁',
  cheeky: '😛',
  laugh: '😀',
  wink: '😉',
  'thumbs-up': '👍',
  'thumbs-down': '👎',
  information: 'ℹ️',
  tick: '✅',
  cross: '❌',
  warning: '⚠️',
  plus: '➕',
  minus: '➖',
  question: '❓',
  'light-on': '💡',
  'light-off': '💡',
  'yellow-star': '⭐',
  'red-star': '⭐',
  'green-star': '⭐',
  'blue-star': '⭐',
  heart: '❤️',
  'broken-heart': '💔'
}

/** Atlassian's own emoji, which have no codepoint in `emoji-id`, by their short name. */
const EMOJI_SHORTNAMES: Record<string, string> = {
  ':grin:': '😁',
  ':smile:': '🙂',
  ':smiley:': '😃',
  ':slight_smile:': '🙂',
  ':frowning:': '🙁',
  ':stuck_out_tongue:': '😛',
  ':wink:': '😉',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':info:': 'ℹ️',
  ':check_mark:': '✅',
  ':white_check_mark:': '✅',
  ':cross_mark:': '❌',
  ':warning:': '⚠️',
  ':question:': '❓',
  ':bulb:': '💡',
  ':star:': '⭐',
  ':heart:': '❤️',
  ':broken_heart:': '💔',
  ':tada:': '🎉',
  ':rocket:': '🚀'
}

/** Elements whose text is not the article's, as `helpers/annotations.js` skips them. */
const NOT_TEXT = new Set(['script', 'style', 'template', 'textarea', 'noscript', 'svg', 'button'])

/**
 * Elements the renderer writes on lines of their own. The newline between two of them is whitespace in
 * the article as drawn, so the text being described has a space there too — or the words either side
 * of a paragraph break run together and the context around a passage matches nothing.
 */
const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ul',
  'ol',
  'div',
  'blockquote',
  'pre',
  'table',
  'tr',
  'td',
  'th',
  'details',
  'summary',
  'hr',
  'br'
])

/** How much text either side of a passage is kept — `CONTEXT_LENGTH` in `helpers/annotations.js`. */
const ANCHOR_CONTEXT = 32

/** The longest passage an annotation may hold — `QUOTE_MAX_LENGTH` there. */
const ANCHOR_MAX_LENGTH = 1000

/** The attribute a marker is held under between the conversion and the passage being described. */
const MARKER_ATTR = 'data-confluence-marker'

function load(xhtml: string): cheerio.CheerioAPI {
  return cheerio.load(
    xhtml,
    {
      xml: {
        xmlMode: false,
        recognizeSelfClosing: true,
        recognizeCDATA: true,
        decodeEntities: true
      }
    },
    false
  )
}

/** `ac:name` and friends need their colon escaped to be a selector. */
function tag(name: string): string {
  return name.replace(':', '\\:')
}

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * What a body refers to — pages, attachments, people, spaces — so that the import can look a whole
 * batch's worth up in one query per kind rather than one per link.
 */
export function collectStorageRefs(xhtml: string, spaceKey: string, title: string): StorageRefs {
  const $ = load(xhtml)
  const refs: StorageRefs = { pages: [], pageIds: [], files: [], users: [], spaces: [] }

  $(tag('ri:page')).each((_, el) => {
    const pageTitle = $(el).attr('ri:content-title')
    if (pageTitle) {
      refs.pages.push({ spaceKey: $(el).attr('ri:space-key') || spaceKey, title: pageTitle })
    }
    const id = $(el).attr('ri:content-id')
    if (id) {
      refs.pageIds.push(id)
    }
  })
  $(tag('ri:content-entity')).each((_, el) => {
    const id = $(el).attr('ri:content-id')
    if (id) {
      refs.pageIds.push(id)
    }
  })
  $(tag('ri:attachment')).each((_, el) => {
    const fileName = $(el).attr('ri:filename')
    if (!fileName) {
      return
    }
    const owner = $(el).children(tag('ri:page')).first()
    refs.files.push({
      spaceKey: owner.attr('ri:space-key') || spaceKey,
      title: owner.attr('ri:content-title') || title,
      fileName
    })
  })
  $(tag('ri:user')).each((_, el) => {
    const id = $(el).attr('ri:account-id') || $(el).attr('ri:userkey')
    if (id) {
      refs.users.push(id)
    }
  })
  $(tag('ri:space')).each((_, el) => {
    const key = $(el).attr('ri:space-key')
    if (key) {
      refs.spaces.push(key)
    }
  })
  return refs
}

/**
 * Convert one body.
 *
 * Macros are rewritten innermost first, so that an expand holding a code block is given the code
 * block's HTML as its body rather than the macro.
 */
export function storageToHtml(
  xhtml: string,
  ctx: StorageContext,
  losses: StorageLosses
): StorageConversion {
  const $ = load(xhtml)

  // -> Instructions a template leaves for its author, which are not part of any page written from it
  $(tag('ac:placeholder')).remove()

  // -> Kept as a span until the passage it marks has been described, then unwrapped
  $(tag('ac:inline-comment-marker')).each((_, el) => {
    const ref = $(el).attr('ac:ref') ?? ''
    $(el).replaceWith(`<span ${MARKER_ATTR}="${escapeHtml(ref)}">${$(el).html() ?? ''}</span>`)
  })

  convertMacros($, ctx, losses)
  convertAdf($, losses)

  // -> A page laid out in columns reads the same top to bottom, which is all markdown can do
  for (const name of ['ac:layout', 'ac:layout-section', 'ac:layout-cell']) {
    $(tag(name)).each((_, el) => {
      $(el).replaceWith($(el).contents())
    })
  }

  convertTasks($)
  convertImages($, ctx, losses)
  convertLinks($, ctx, losses)

  $(tag('ac:emoticon')).each((_, el) => {
    $(el).replaceWith(escapeHtml(emoticonOf($(el))))
  })

  // -> A date, which Confluence draws in the reader's locale. A calendar date is not a moment, so it
  //    is written as the date rather than as a timestamp block that would shift it by a timezone
  $('time').each((_, el) => {
    const value = $(el).attr('datetime') ?? $(el).text()
    $(el).replaceWith(escapeHtml(value))
  })

  // -> Whatever Confluence element is left has nothing of its own to show
  ;($('*').toArray() as Element[]).reverse().forEach((el) => {
    if (el.name.startsWith('ac:') || el.name.startsWith('ri:') || el.name.startsWith('at:')) {
      $(el).replaceWith($(el).contents())
    }
  })

  /*
    The cloud editor puts every list item's and table cell's text in a paragraph of its own. Markdown
    reads a paragraph in a list item as a loose list, spaced out a blank line per item, which is not
    what anybody wrote; one paragraph alone in its item or cell is just its text.
  */
  $('li > p:only-child, th > p:only-child, td > p:only-child').each((_, el) => {
    if ($(el).parent().contents().length === 1) {
      $(el).replaceWith($(el).contents())
    }
  })

  /*
    A macro Confluence wrote inside a paragraph of its own is a block once converted — an index, a
    set of tabs — and a paragraph cannot hold one. Left there, the paragraph has no text of its own,
    and Turndown drops a blank element whole without looking inside it.
  */
  $('p').each((_, el) => {
    const p = $(el)
    if (
      p.children('block-index, block-tabs').length > 0 &&
      !p.clone().children().remove().end().text().trim()
    ) {
      p.replaceWith(p.contents())
    }
  })

  // -> A heading Confluence made bold throughout is a heading; the bold is noise in markdown
  $('h1 > strong:only-child, h2 > strong:only-child, h3 > strong:only-child').each((_, el) => {
    if ($(el).parent().contents().length === 1) {
      $(el).replaceWith($(el).contents())
    }
  })

  // -> Confluence's own bookkeeping on every element
  ;($('*').toArray() as Element[]).forEach((el) => {
    for (const name of Object.keys(el.attribs)) {
      if (
        name === 'local-id' ||
        name.startsWith('ac:') ||
        name.startsWith('data-layout') ||
        name.startsWith('data-table-') ||
        name.startsWith('data-card-') ||
        name.startsWith('data-original-') ||
        name === 'data-width' ||
        name === 'data-highlight-colour'
      ) {
        $(el).removeAttr(name)
      }
    }
  })

  const anchors = describeMarkers($)
  $(`[${MARKER_ATTR}]`).each((_, el) => {
    $(el).replaceWith($(el).contents())
  })

  return { html: $.html(), anchors }
}

function paramsOf($: cheerio.CheerioAPI, macro: cheerio.Cheerio<AnyNode>): Record<string, string> {
  const params: Record<string, string> = {}
  macro.children(tag('ac:parameter')).each((_, el) => {
    params[$(el).attr('ac:name') ?? ''] = $(el).text()
  })
  return params
}

function convertMacros($: cheerio.CheerioAPI, ctx: StorageContext, losses: StorageLosses): void {
  const macros = $(`${tag('ac:structured-macro')}, ${tag('ac:macro')}`)
    .toArray()
    .reverse()
  for (const el of macros) {
    const macro = $(el)
    const name = (macro.attr('ac:name') ?? '').toLowerCase()
    const params = paramsOf($, macro)
    const richBody = macro.children(tag('ac:rich-text-body')).first()
    const plainBody = macro.children(tag('ac:plain-text-body')).first()
    const body = richBody.length ? (richBody.html() ?? '') : ''

    if (name === 'code' || name === 'noformat') {
      const language = (params.language ?? '').toLowerCase().replace(/[^a-z0-9+#-]/g, '')
      const caption = params.title ? `<p><strong>${escapeHtml(params.title)}</strong></p>` : ''
      const cls = language && language !== 'none' ? ` class="language-${language}"` : ''
      macro.replaceWith(`${caption}<pre><code${cls}>${escapeHtml(plainBody.text())}</code></pre>`)
    } else if (ADMONITIONS[name]) {
      macro.replaceWith(alertHtml(ADMONITIONS[name], params.title ?? '', body))
    } else if (name === 'expand') {
      const summary = params.title || 'Click here to expand...'
      macro.replaceWith(`<details><summary>${escapeHtml(summary)}</summary>${body}</details>`)
    } else if (name === 'quote') {
      macro.replaceWith(`<blockquote>${body}</blockquote>`)
    } else if (name === 'status') {
      const color = statusColorOf(params.colour ?? params.color ?? '')
      const title = (params.title || params.colour || 'Status').replaceAll(/[[\]\n]/g, ' ').trim()
      macro.replaceWith(`<block-badge color="${color}">${escapeHtml(title)}</block-badge>`)
    } else if (name === 'children' || name === 'pagetree') {
      macro.replaceWith(childrenIndexOf($, name, params, ctx))
    } else if (LABEL_LISTINGS.has(name) && labelsOf(params).length > 0) {
      const limit = Number.parseInt(params.max ?? '', 10)
      macro.replaceWith(
        `<block-index tags="${escapeHtml(labelsOf(params).join(','))}" limit="${limit > 0 ? limit : 20}" columns="1"></block-index>`
      )
    } else if (name === 'anchor') {
      macro.remove()
    } else if (DYNAMIC_MACROS.has(name) || LABEL_LISTINGS.has(name)) {
      count(losses.dynamic, name)
      // -> A table of contents zone wraps real content; the rest are nothing but what they computed
      macro.replaceWith(name === 'toc-zone' ? body : '')
    } else if (UNWRAPPED_MACROS.has(name)) {
      macro.replaceWith(body)
    } else if (name.startsWith('view') || name === 'multimedia') {
      macro.replaceWith(fileLinkOf($, macro, params, ctx, losses))
    } else if (params.url && /^https?:\/\//i.test(params.url)) {
      // -> A widget, an iframe, a video: the address is what is worth keeping of it
      count(losses.unsupported, name)
      macro.replaceWith(`<p><a href="${escapeHtml(params.url)}">${escapeHtml(params.url)}</a></p>`)
    } else {
      count(losses.unsupported, name || 'unnamed')
      const note = `<p><em>[The Confluence macro "${escapeHtml(name || 'unnamed')}" could not be imported.]</em></p>`
      macro.replaceWith(body ? `${note}${body}` : note)
    }
  }
}

/**
 * A list of child pages, as the index block draws one. `children` lists the page's own children —
 * `depth` levels of them, or all with `all` — and `pagetree` its space's whole tree, which is the
 * index of the space's path a few levels deep. The block counts depth from 0, the folder itself.
 */
function childrenIndexOf(
  $: cheerio.CheerioAPI,
  name: string,
  params: Record<string, string>,
  ctx: StorageContext
): string {
  let path = ctx.childrenPath
  let depth = 0
  if (name === 'pagetree') {
    path = ctx.resolve.spacePath(ctx.spaceKey) ?? ctx.childrenPath
    depth = 2
  } else if (params.all === 'true') {
    depth = 5
  } else {
    const asked = Number.parseInt(params.depth ?? '', 10)
    depth = asked > 1 ? Math.min(asked - 1, 5) : 0
  }
  return `<block-index path="${escapeHtml(path)}" depth="${depth}" limit="100" columns="1"></block-index>`
}

/**
 * The labels a "content by label" macro asks for: its `labels` (or `label`) list, or the `label = "x"` terms of
 * the CQL query the cloud editor writes instead. Excluded labels (`-x`) are not something the index
 * block can say, so they are left out — and so is the macro, when that leaves nothing.
 */
function labelsOf(params: Record<string, string>): string[] {
  // -> `labels` on the label macros, `label` on the page properties report
  const listed = `${params.labels ?? ''},${params.label ?? ''}`
    .split(/[,\s]+/)
    .map((label) => label.trim().replace(/^\+/, ''))
    .filter((label) => label && !label.startsWith('-'))
  const fromCql = [...(params.cql ?? '').matchAll(/label\s*(?:=|in)\s*\(?\s*"([^"]+)"/gi)].map(
    (match) => match[1]
  )
  return [...new Set([...listed, ...fromCql])]
}

function alertHtml(kind: string, title: string, body: string): string {
  const heading = title ? `<p class="alert-title">${escapeHtml(title)}</p>` : ''
  return `<blockquote class="${kind}">${heading}${body}</blockquote>`
}

function statusColorOf(value: string): string {
  const key = value.trim().toLowerCase()
  return STATUS_COLORS[key] ?? STATUS_HEX[key] ?? 'grey'
}

/** `view-file` and its siblings show an attachment in the page; here they become a link to it. */
function fileLinkOf(
  $: cheerio.CheerioAPI,
  macro: cheerio.Cheerio<AnyNode>,
  params: Record<string, string>,
  ctx: StorageContext,
  losses: StorageLosses
): string {
  const attachment = macro.find(tag('ri:attachment')).first()
  const fileName = attachment.attr('ri:filename') ?? params.name ?? ''
  if (!fileName) {
    count(losses.unsupported, macro.attr('ac:name') ?? 'view-file')
    return ''
  }
  const owner = attachment.children(tag('ri:page')).first()
  const href = ctx.resolve.filePath(
    owner.attr('ri:space-key') || ctx.spaceKey,
    owner.attr('ri:content-title') || ctx.title,
    fileName
  )
  if (!href) {
    losses.unresolvedLinks++
    return `<p>${escapeHtml(fileName)}</p>`
  }
  return `<p><a href="${escapeHtml(href)}">${escapeHtml(fileName)}</a></p>`
}

/**
 * The cloud editor's own nodes, which it writes into the storage format where the storage format has
 * no element for them — a panel of a kind the old macros did not have, a decision list. Each carries
 * a fallback rendering, which is used for anything without a translation here.
 */
function convertAdf($: cheerio.CheerioAPI, losses: StorageLosses): void {
  const extensions = $(tag('ac:adf-extension')).toArray().reverse()
  for (const el of extensions) {
    const ext = $(el)
    const node = ext.children(tag('ac:adf-node')).first()
    const type = node.attr('type') ?? ''
    const attr = (key: string) =>
      node
        .children(tag('ac:adf-attribute'))
        .filter((_, a) => $(a).attr('key') === key)
        .first()
        .text()
    const content = node.children(tag('ac:adf-content')).first()

    if (type === 'panel') {
      ext.replaceWith(
        alertHtml(ADF_PANELS[attr('panel-type')] ?? 'is-info', '', content.html() ?? '')
      )
    } else if (type === 'multi-bodied-extension' && attr('extension-key') === 'native-tabs') {
      // -> The cloud editor's tabs, onto the tabs block: one panel per frame, labelled in order
      const labels = node
        .find(`${tag('ac:adf-parameter')}[key="tabs"] > ${tag('ac:adf-parameter-value')}`)
        .toArray()
        .map((value) =>
          $(value)
            .children(tag('ac:adf-parameter'))
            .filter((_, p) => $(p).attr('key') === 'title')
            .first()
            .text()
        )
      const panels = content
        .children(tag('ac:adf-extension-frame'))
        .toArray()
        .map((frame, index) => {
          const label = labels[index] || `Tab ${index + 1}`
          return `<block-tab label="${escapeHtml(label)}">${$(frame).html() ?? ''}</block-tab>`
        })
      ext.replaceWith(`<block-tabs>${panels.join('')}</block-tabs>`)
    } else if (type === 'decision-list') {
      const items = node
        .children(tag('ac:adf-node'))
        .toArray()
        .map((item) => `<li>${$(item).children(tag('ac:adf-content')).html() ?? ''}</li>`)
      ext.replaceWith(`<ul>${items.join('')}</ul>`)
    } else {
      const fallback = ext.children(tag('ac:adf-fallback')).first()
      if (fallback.length) {
        ext.replaceWith(fallback.contents())
      } else {
        count(losses.unsupported, type || 'unnamed')
        ext.remove()
      }
    }
  }
}

/** Confluence's task lists → the checkbox list items the GFM rules write as `- [x]`. */
function convertTasks($: cheerio.CheerioAPI): void {
  const lists = $(tag('ac:task-list')).toArray().reverse()
  for (const el of lists) {
    const items = $(el)
      .children(tag('ac:task'))
      .toArray()
      .map((task) => {
        const done = $(task).children(tag('ac:task-status')).text().trim() === 'complete'
        const body = $(task).children(tag('ac:task-body')).first()
        // -> A task's body is inline in the editor; a paragraph in it would break the item's line
        body.find('p').each((_, p) => {
          $(p).replaceWith($(p).contents())
        })
        return `<li><input type="checkbox"${done ? ' checked' : ''}>${body.html() ?? ''}</li>`
      })
    $(el).replaceWith(`<ul>${items.join('')}</ul>`)
  }
}

function convertImages($: cheerio.CheerioAPI, ctx: StorageContext, losses: StorageLosses): void {
  $(tag('ac:image')).each((_, el) => {
    const image = $(el)
    const attachment = image.children(tag('ri:attachment')).first()
    const url = image.children(tag('ri:url')).first()
    let src: string | null = null
    if (attachment.length) {
      const owner = attachment.children(tag('ri:page')).first()
      src = ctx.resolve.filePath(
        owner.attr('ri:space-key') || ctx.spaceKey,
        owner.attr('ri:content-title') || ctx.title,
        attachment.attr('ri:filename') ?? ''
      )
    } else if (url.length) {
      src = url.attr('ri:value') ?? null
    }
    if (!src) {
      losses.unresolvedLinks++
      image.remove()
      return
    }
    const alt =
      image.attr('ac:alt') ?? image.attr('ac:title') ?? attachment.attr('ri:filename') ?? ''
    const width = Number.parseInt(image.attr('ac:width') ?? '', 10)
    image.replaceWith(
      `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${width > 0 ? ` width="${width}"` : ''}>`
    )
  })
}

function convertLinks($: cheerio.CheerioAPI, ctx: StorageContext, losses: StorageLosses): void {
  $(tag('ac:link')).each((_, el) => {
    const link = $(el)
    const anchor = link.attr('ac:anchor') ?? ''
    const hash = anchor ? `#${slugifyHeading(safeDecode(anchor))}` : ''
    const richBody = link.children(tag('ac:link-body')).first()
    const plainBody = link.children(tag('ac:plain-text-link-body')).first()
    const bodyHtml = richBody.length
      ? (richBody.html() ?? '')
      : plainBody.length
        ? escapeHtml(plainBody.text())
        : ''

    const user = link.children(tag('ri:user')).first()
    if (user.length) {
      const id = user.attr('ri:account-id') || user.attr('ri:userkey') || ''
      link.replaceWith(escapeHtml(`@${ctx.resolve.userName(id) ?? 'unknown user'}`))
      return
    }

    let href: string | null = null
    let label = ''
    const page = link.children(tag('ri:page')).first()
    const attachment = link.children(tag('ri:attachment')).first()
    const space = link.children(tag('ri:space')).first()
    const entity = link.children(tag('ri:content-entity')).first()
    if (page.length) {
      label = page.attr('ri:content-title') ?? ''
      const id = page.attr('ri:content-id')
      const path = label
        ? ctx.resolve.pagePath(page.attr('ri:space-key') || ctx.spaceKey, label)
        : id
          ? ctx.resolve.pagePathById(id)
          : null
      href = path === null ? null : `/${path}${hash}`
    } else if (attachment.length) {
      label = attachment.attr('ri:filename') ?? ''
      const owner = attachment.children(tag('ri:page')).first()
      href = ctx.resolve.filePath(
        owner.attr('ri:space-key') || ctx.spaceKey,
        owner.attr('ri:content-title') || ctx.title,
        label
      )
    } else if (space.length) {
      label = space.attr('ri:space-key') ?? ''
      const path = ctx.resolve.spacePath(label)
      href = path === null ? null : `/${path}`
    } else if (entity.length) {
      const path = ctx.resolve.pagePathById(entity.attr('ri:content-id') ?? '')
      href = path === null ? null : `/${path}${hash}`
    } else if (anchor) {
      // -> A link to a heading on the same page
      href = hash
    }

    const text = bodyHtml || escapeHtml(label)
    if (href === null) {
      losses.unresolvedLinks++
      link.replaceWith(text)
      return
    }
    link.replaceWith(`<a href="${escapeHtml(href)}">${text || escapeHtml(href)}</a>`)
  })
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** An emoticon as the character it stands for, or nothing when there is no telling which. */
function emoticonOf(el: cheerio.Cheerio<AnyNode>): string {
  const id = el.attr('ac:emoji-id') ?? ''
  if (/^[0-9a-f]{2,6}(?:-[0-9a-f]{2,6})*$/i.test(id)) {
    try {
      return String.fromCodePoint(...id.split('-').map((part) => Number.parseInt(part, 16)))
    } catch {
      // -> Not a codepoint after all; the names below may still say
    }
  }
  const fallback = el.attr('ac:emoji-fallback') ?? ''
  // oxlint-disable-next-line no-control-regex
  if (fallback && !/^[\x00-\x7f]*$/.test(fallback)) {
    return fallback
  }
  const shortName = el.attr('ac:emoji-shortname') ?? fallback
  return EMOJI_SHORTNAMES[shortName] ?? EMOTICON_NAMES[el.attr('ac:name') ?? ''] ?? ''
}

/**
 * Describe every inline comment marker's passage the way an annotation stores one (`CommentAnchor`),
 * against the text of the converted page — folded the way `helpers/annotations.js` folds the article
 * it later searches, with heading ids worked out the way the renderer assigns them. The two texts are
 * not identical, since a block draws something of its own, but the match only needs the passage
 * itself to still be there: the text either side and the heading only break ties.
 */
function describeMarkers($: cheerio.CheerioAPI): Map<string, CommentAnchor> {
  const anchors = new Map<string, CommentAnchor>()
  if ($(`[${MARKER_ATTR}]`).length < 1) {
    return anchors
  }
  const chars: string[] = []
  const headings: Array<{ id: string; start: number }> = []
  const used = new Map<string, number>()
  const spans = new Map<string, { start: number; end: number }>()
  let lastWasSpace = true

  const walk = (node: AnyNode) => {
    if (node.type === 'text') {
      for (const char of node.data) {
        const isSpace = /\s/.test(char)
        if (isSpace && lastWasSpace) {
          continue
        }
        chars.push(isSpace ? ' ' : char)
        lastWasSpace = isSpace
      }
      return
    }
    if (node.type !== 'tag' && node.type !== 'root') {
      return
    }
    if (node.type === 'tag') {
      if (NOT_TEXT.has(node.name)) {
        return
      }
      if (/^h[1-6]$/.test(node.name)) {
        let id = slugifyHeading($(node).text().trim())
        const seen = used.get(id) ?? 0
        used.set(id, seen + 1)
        if (seen > 0) {
          id = `${id}-${seen}`
        }
        headings.push({ id, start: chars.length })
      }
    }
    const ref = node.type === 'tag' ? node.attribs[MARKER_ATTR] : undefined
    const isBlock = node.type === 'tag' && BLOCK_TAGS.has(node.name)
    if (isBlock && !lastWasSpace) {
      chars.push(' ')
      lastWasSpace = true
    }
    const start = chars.length
    for (const child of node.children) {
      walk(child)
    }
    if (isBlock && !lastWasSpace) {
      chars.push(' ')
      lastWasSpace = true
    }
    if (ref) {
      spans.set(ref, { start, end: chars.length })
    }
  }
  for (const node of $.root().contents().toArray()) {
    walk(node)
  }

  const text = chars.join('')
  for (const [ref, span] of spans) {
    let { start, end } = span
    while (start < end && text[start] === ' ') {
      start++
    }
    while (end > start && text[end - 1] === ' ') {
      end--
    }
    const exact = text.slice(start, Math.min(end, start + ANCHOR_MAX_LENGTH))
    if (!exact) {
      continue
    }
    let heading: { id: string; start: number } | null = null
    for (const candidate of headings) {
      if (candidate.start > start) {
        break
      }
      heading = candidate
    }
    anchors.set(ref, {
      exact,
      prefix: text.slice(Math.max(0, start - ANCHOR_CONTEXT), start),
      suffix: text.slice(start + exact.length, start + exact.length + ANCHOR_CONTEXT),
      heading: heading?.id ?? null,
      offset: start - (heading?.start ?? 0)
    })
  }
  return anchors
}
