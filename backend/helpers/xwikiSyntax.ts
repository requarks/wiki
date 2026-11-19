import { pathSegmentFromTitle } from './common.ts'
import { slugifyHeading } from '../models/rendering.ts'

/**
 * XWiki's wiki syntax → HTML this wiki renders, for **Import from XWiki** (`models/importXwiki.ts`).
 *
 * DokuWiki's arrangement (`helpers/dokuwikiSyntax.ts`): the source is rewritten into plain HTML — or
 * into the element of the block that does the same job, a page index for a listing of children — and
 * what comes out is handed to `htmlToMarkdown`, or stored as it is. Going through HTML is what makes
 * the escaping someone else's problem: XWiki text is full of characters the wiki's markdown reads as
 * markup.
 *
 * XWiki's own parser is a grammar (WikiModel); this is not that. It is a pass that lifts out what must
 * not be looked inside — `~` escapes, `{{{verbatim}}}`, macros — into numbered slots, then a
 * line-oriented reader for the block syntax (headings, lists, tables, quotes, groups) and ordered
 * substitutions for the inline syntax, with the slots put back last. XWiki Syntax 2.0 and 2.1 are
 * read alike: 2.1 only added reference types and the rules for resolving an untyped one, which 2.0
 * references are a subset of.
 *
 * **References are resolved the way XWiki resolves them** (`#pageTarget`): an untyped `[[A]]` is the
 * terminal page `A` in the current space if it exists, then the nested page, then — from a nested page
 * — the same two as siblings. Each candidate is asked of the import's index in turn, which is why a
 * body is converted twice: once with a resolver that records every key asked for
 * (`collectXwikiRefs`), so that a batch can be looked up in one query per kind, and once for real.
 *
 * **What cannot be carried says so.** A macro this file has no translation for is counted by name and
 * leaves a line where it stood; one that computed something when the page was viewed (a script, a
 * live table, an activity stream) is dropped and counted. The counts are what the import log reports.
 */

/** What the converter asks the import about. Null is "not part of this import". */
export interface XwikiResolver {
  /** A document by its key (`referenceKey`): its path here (`home` for the site's home page) and title. */
  page(key: string): { path: string; title: string } | null
  /** A space by its key (`''` is the wiki): the folder its pages are in, and what it is called. */
  space(key: string): { folder: string; title: string } | null
  /** An attachment's URL path, by `fileKey`. */
  file(key: string): string | null
  /** A user's name, by the key of their profile document (`XWiki.jdoe`). */
  user(key: string): string | null
}

export interface XwikiContext {
  /** The key of the document being converted, which every relative reference is relative to. */
  docKey: string
  resolve: XwikiResolver
  /**
   * The page's title. A first heading saying the same is left out, since this wiki draws the title
   * above the content and keeping it would show it twice.
   */
  dropHeading: string | null
}

/** What a conversion could not carry, for the log. */
export interface XwikiLosses {
  /** Macro name → how many were left as a note on the page. */
  unsupported: Map<string, number>
  /** Macro name → how many were dropped, being something XWiki computed when the page was viewed. */
  dynamic: Map<string, number>
  /** Macro name → how many were kept as their source, in a code block. */
  asCode: Map<string, number>
  /** Syntax id → how many bodies were in a syntax this cannot read, and were kept as text. */
  syntaxes: Map<string, number>
  /** Links and images to attachments, interwiki aliases or server paths that are not part of this import. */
  unresolvedLinks: number
  /** Links to pages that did not exist in XWiki either, pointed at where such a page would be here. */
  missingPages: number
  /** `include` and `display` macros, replaced by a link to the page they showed. */
  included: number
}

/** What a body refers to, read before it is converted so that a batch can be looked up at once. */
export interface XwikiRefs {
  pages: string[]
  spaces: string[]
  files: string[]
  users: string[]
}

export function newXwikiLosses(): XwikiLosses {
  return {
    unsupported: new Map(),
    dynamic: new Map(),
    asCode: new Map(),
    syntaxes: new Map(),
    unresolvedLinks: 0,
    missingPages: 0,
    included: 0
  }
}

/** Whether a syntax id is markdown, which this wiki stores as it is rather than converting. */
export function isMarkdownSyntax(syntax: string): boolean {
  return /^markdown\b/i.test(syntax)
}

/** The box macros, onto this wiki's alerts (`renderers/modules/github-alerts.js`). */
const ALERT_MACROS: Record<string, string> = {
  info: 'is-info',
  success: 'is-success',
  warning: 'is-warning',
  error: 'is-danger'
}

/** Macros that only steer XWiki's own rendering or hold nothing a reader saw, dropped without a word. */
const SILENT_MACROS = new Set(['toc', 'id', 'comment', 'putfootnotes', 'anchor', 'nocache'])

/** Layout macros whose content is wiki text and whose layout is not kept: the content stays. */
const UNWRAP_MACROS = new Set([
  'container',
  'section',
  'column',
  'layout',
  'cache',
  'context',
  'gallery',
  'figure',
  'center',
  'align',
  'translation-content'
])

/** Macros showing what XWiki worked out when the page was viewed, with nothing to carry over. */
const DYNAMIC_MACROS = new Set([
  'velocity',
  'groovy',
  'python',
  'script',
  'ruby',
  'php',
  'jython',
  'sql',
  'livetable',
  'livedata',
  'activity',
  'notifications',
  'recentlymodified',
  'spaces',
  'space',
  'tagcloud',
  'tags',
  'chart',
  'dashboard',
  'gadget',
  'blogpostlist',
  'useravatar',
  'watchlist',
  'attachments',
  'attachmentselector',
  'translation',
  'locations',
  'pagelist',
  'search',
  'query',
  'menu',
  'contributors',
  'documents',
  'async',
  'wikis',
  'sharepage',
  'velocityhtml',
  'visitors'
])

/** Macros whose content is a source for something else to draw: kept as that source, in a code block. */
const CODE_MACROS: Record<string, { language: string; reported: boolean }> = {
  formula: { language: 'latex', reported: true },
  mathjax: { language: 'latex', reported: true },
  latex: { language: 'latex', reported: true },
  markdown: { language: 'markdown', reported: true },
  ditaa: { language: 'ditaa', reported: true },
  graphviz: { language: 'dot', reported: true },
  mermaid: { language: 'mermaid', reported: false },
  plantuml: { language: 'plantuml', reported: false }
}

/** Macros that showed an attachment in a viewer of their own: a link to the file here. */
const FILE_MACROS = new Set(['office', 'pdfviewer', 'video', 'audio', 'officeviewer'])

/** The disclosure macros of the extensions repository, as a `<details>`. */
const EXPAND_MACROS = new Set(['expand', 'expandable', 'toggle', 'collapse'])

/** Highlighter names XWiki accepts that are not the wiki's. Everything else is passed on as written. */
const CODE_LANGUAGES: Record<string, string> = {
  none: '',
  text: '',
  plain: '',
  txt: '',
  html4strict: 'html',
  xhtml: 'html',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash'
}

/** Reference types of XWiki Syntax 2.1 (`[[label>>type:reference]]`). */
const REFERENCE_TYPES = new Set([
  'doc',
  'page',
  'space',
  'attach',
  'pageattach',
  'url',
  'mailto',
  'unc',
  'path',
  'interwiki',
  'data',
  'icon',
  'user'
])

/**
 * A slot: lifted-out HTML that the substitutions must not look inside, put back last. Marked with
 * private-use characters, which no wiki text holds and no substitution here matches.
 */
const INLINE_SLOT = /\uE001(\d+)\uE002/g
/** A slot standing on a line of its own, which the block reader passes through untouched. */
const BLOCK_SLOT_LINE = /^[ \t]*\uE000(\d+)\uE000[ \t]*$/

const URL_PATTERN = /\b(?:https?|ftps?|file|news|irc):\/\/[^\s<>"'[\]{}|\\^`]+/gi

const LIST_LINE = /^[ \t]*([*1]+)(\.?)[ \t]+(.*)$/s
const DEFINITION_LINE = /^[ \t]*([;:]+)[ \t]+(.*)$/s
const HEADING_LINE = /^[ \t]*(={1,6})(?!=)[ \t]*(.+?)[ \t]*=*[ \t]*$/s
const TABLE_LINE = /^[ \t]*(?:\||!=|!!)/

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/** One newline at each end of a block macro's content is the macro's own layout, not its content. */
function trimNewlines(text: string): string {
  return text.replace(/^[ \t]*\n/, '').replace(/\n[ \t]*$/, '')
}

// ================================================================================================
// REFERENCES
// ================================================================================================

/** The first position of `char` not escaped with a backslash, or -1. */
function indexOfUnescaped(text: string, char: string, from = 0): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
    } else if (text[i] === char) {
      return i
    }
  }
  return -1
}

/** The last position of `char` not escaped with a backslash, or -1. */
function lastIndexOfUnescaped(text: string, char: string): number {
  let found = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
    } else if (text[i] === char) {
      found = i
    }
  }
  return found
}

function splitUnescaped(text: string, char: string): string[] {
  const parts: string[] = []
  let from = 0
  for (let at = indexOfUnescaped(text, char); at >= 0; at = indexOfUnescaped(text, char, from)) {
    parts.push(text.slice(from, at))
    from = at + 1
  }
  parts.push(text.slice(from))
  return parts
}

function unescapeReference(text: string): string {
  return text.replace(/\\(.)/gs, '$1')
}

/**
 * A document or space reference as XWiki writes one — `wiki:Space.Sub.Page`, with `\.`, `\:`, `\@` and
 * `\\` escaping a separator inside a name — as its names. The wiki is dropped: a XAR is one wiki, and
 * a reference into another one is read as if into this one. A leading `.` makes it relative to the
 * current space, which `relative` says.
 */
export function parseReference(text: string): { parts: string[]; relative: boolean } {
  let value = text.trim()
  const colon = indexOfUnescaped(value, ':')
  if (colon >= 0) {
    value = value.slice(colon + 1)
  }
  const relative = value.startsWith('.')
  if (relative) {
    value = value.slice(1)
  }
  const parts = splitUnescaped(value, '.')
    .map((part) => unescapeReference(part))
    .filter((part) => part !== '')
  return { parts, relative }
}

/**
 * The one spelling of a document or space, which the import's index is keyed by — on both sides:
 * `frontend/src/helpers/xwikiSource.js` writes the same. Only a backslash and a dot are escaped.
 */
export function referenceKey(parts: string[]): string {
  return parts.map((part) => part.replaceAll('\\', '\\\\').replaceAll('.', '\\.')).join('.')
}

/** An attachment's key in the index: the document it is on, and its name. */
export function fileKey(docKey: string, name: string): string {
  return `${docKey}\n${name}`
}

/**
 * The anchor XWiki gives a heading: `H` and the heading's letters and digits, run together — which
 * is what a link to a section names (`||anchor="HMyheading"`).
 */
function xwikiAnchor(text: string): string {
  return `H${text.replace(/[^\p{L}\p{N}]+/gu, '')}`
}

/** A heading's text without its markup, near enough for its anchor and for comparing with a title. */
function plainHeading(text: string): string {
  return text
    .replace(/\[\[([\s\S]*?)>>[\s\S]*?\]\]/g, '$1')
    .replace(/\[\[([\s\S]*?)\]\]/g, '$1')
    .replace(/\{\{\{([\s\S]*?)\}\}\}/g, '$1')
    .replace(/\(%[\s\S]*?%\)/g, '')
    .replace(/~(.)/g, '$1')
    .replace(/\*\*|\/\/|__|--|##|\^\^|,,/g, '')
    .trim()
}

/** Whether two titles say the same thing, regardless of case and spacing. */
function sameTitle(a: string, b: string): boolean {
  const norm = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim()
  return norm(a) === norm(b)
}

/** A macro's `key="value"` parameters, keyed in lowercase. `~` escapes inside a quoted value. */
function macroParams(source: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const match of source.matchAll(/([^\s=]+)\s*=\s*(?:"((?:~[\s\S]|[^"~])*)"|(\S+))/g)) {
    params[match[1].toLowerCase()] =
      match[2] !== undefined ? match[2].replace(/~([\s\S])/g, '$1') : match[3]
  }
  return params
}

interface Macro {
  name: string
  params: Record<string, string>
  /** Null for a macro written `{{name/}}`. */
  content: string | null
  end: number
}

const MACRO_OPEN =
  /\{\{([A-Za-z][\w.:-]*)((?:\s+[^\s=/}]+\s*=\s*(?:"(?:~[\s\S]|[^"~])*"|[^\s"/}]+))*)\s*(\/?)\}\}/y

/**
 * The macro starting at `start`: `{{name params/}}`, or `{{name params}}content{{/name}}` with the
 * content running to the matching close — same-name macros nest. Null when it is not a macro, or one
 * never closed, which XWiki shows as the text it is.
 */
function readMacro(text: string, start: number): Macro | null {
  MACRO_OPEN.lastIndex = start
  const open = MACRO_OPEN.exec(text)
  if (!open) {
    return null
  }
  const name = open[1]
  const params = macroParams(open[2] ?? '')
  const bodyStart = start + open[0].length
  if (open[3] === '/') {
    return { name, params, content: null, end: bodyStart }
  }
  const tags = new RegExp(
    `\\{\\{(/?)${escapeRegExp(name)}(?=[\\s/}])(?:"(?:~[\\s\\S]|[^"~])*"|[^}"])*?(/?)\\}\\}`,
    'g'
  )
  tags.lastIndex = bodyStart
  let depth = 1
  for (let tag = tags.exec(text); tag; tag = tags.exec(text)) {
    if (tag[1] === '/') {
      depth--
      if (depth === 0) {
        return {
          name,
          params,
          content: trimNewlines(text.slice(bodyStart, tag.index)),
          end: tag.index + tag[0].length
        }
      }
    } else if (tag[2] !== '/') {
      depth++
    }
  }
  return null
}

/** Whether `start…end` stands alone on its lines, which is what makes a macro or a group a block. */
function standsAlone(text: string, start: number, end: number): boolean {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineEnd = text.indexOf('\n', end)
  return (
    text.slice(lineStart, start).trim() === '' &&
    text.slice(end, lineEnd < 0 ? text.length : lineEnd).trim() === ''
  )
}

/** The first position of `token` outside any nested `[[…]]`, or -1. */
function topLevelIndex(text: string, token: string): number {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('[[', i)) {
      depth++
      i++
    } else if (text.startsWith(']]', i) && depth > 0) {
      depth--
      i++
    } else if (depth === 0 && text.startsWith(token, i)) {
      return i
    }
  }
  return -1
}

// ================================================================================================
// CONVERSION
// ================================================================================================

/**
 * Everything a body may point at, by running the conversion against a resolver that knows nothing and
 * writes down what it was asked. A reference with several candidates asks for all of them here, since
 * none is found; the real conversion then stops at the first that is.
 */
export function collectXwikiRefs(text: string, syntax: string, docKey: string): XwikiRefs {
  const pages = new Set<string>()
  const spaces = new Set<string>([''])
  const files = new Set<string>()
  const users = new Set<string>()
  const resolve: XwikiResolver = {
    page: (key) => (pages.add(key), null),
    space: (key) => (spaces.add(key), null),
    file: (key) => (files.add(key), null),
    user: (key) => (users.add(key), null)
  }
  try {
    xwikiToHtml(text, syntax, { docKey, resolve, dropHeading: null }, newXwikiLosses())
  } catch {
    // -> The real conversion meets the same input and reports it; here it only cost the lookups
  }
  return { pages: [...pages], spaces: [...spaces], files: [...files], users: [...users] }
}

/**
 * Convert a page, an old version of one, or a comment, in the syntax XWiki says it is in.
 *
 * XWiki 2.x text has no fixed outer structure, so nothing here fails on malformed input: an unclosed
 * macro is text, a `**` with no partner is two asterisks. XHTML is passed through as the HTML it is,
 * plain text is paragraphs, and anything else (XWiki 1.0, a syntax of an extension) is kept as text in
 * a code block and counted. Markdown never reaches this: it is stored as it is (`isMarkdownSyntax`).
 */
export function xwikiToHtml(
  text: string,
  syntax: string,
  ctx: XwikiContext,
  losses: XwikiLosses
): string {
  const source = text.replace(/\r\n?/g, '\n')
  const id = (syntax || 'xwiki/2.1').toLowerCase()
  if (id.startsWith('xhtml/') || id.startsWith('html/')) {
    return source
  }
  if (id.startsWith('plain/')) {
    return source
      .split(/\n{2,}/)
      .filter((block) => block.trim())
      .map((block) => `<p>${escapeHtml(block.trim()).replaceAll('\n', '<br>')}</p>`)
      .join('\n')
  }
  if (!id.startsWith('xwiki/2.')) {
    count(losses.syntaxes, id)
    return source.trim() ? `<pre><code>${escapeHtml(source)}</code></pre>` : ''
  }
  const converter = new Converter(ctx, losses, source)
  const html = converter.blocks(converter.protect(source), true) + converter.footnotesHtml()
  return converter.restore(html)
}

class Converter {
  readonly #ctx: XwikiContext
  readonly #losses: XwikiLosses
  /** The current document's space, and its own name. */
  readonly #space: string[]
  readonly #name: string
  /** Lifted-out HTML, by number. */
  readonly #slots: string[] = []
  /** What an escape or a verbatim slot stood for as text, for a reference that holds one. */
  readonly #raw = new Map<number, string>()
  /** Slots that hold a block (an index), which a paragraph of nothing else must not wrap. */
  readonly #blockSlots = new Set<number>()
  readonly #footnotes: string[] = []
  /** XWiki's anchor for each heading of this page → this wiki's, for a link to a section of it. */
  readonly #anchors = new Map<string, string>()
  /** Whether the top level has written anything yet — the title is only dropped from the very top. */
  #wroteBlock = false

  constructor(ctx: XwikiContext, losses: XwikiLosses, source: string) {
    this.#ctx = ctx
    this.#losses = losses
    const { parts } = parseReference(ctx.docKey)
    this.#space = parts.slice(0, -1)
    this.#name = parts.at(-1) ?? 'WebHome'
    // -> Read ahead: a link to a section is as often above the heading as below it
    for (const line of source.split('\n')) {
      const heading = HEADING_LINE.exec(line)
      if (heading) {
        const plain = plainHeading(heading[2])
        if (plain && !this.#anchors.has(xwikiAnchor(plain))) {
          this.#anchors.set(xwikiAnchor(plain), slugifyHeading(plain))
        }
      }
    }
  }

  /** The nested page this document is: its space for a `WebHome`, its space and name otherwise. */
  get #currentPage(): string[] {
    return this.#name === 'WebHome' ? this.#space : [...this.#space, this.#name]
  }

  #slot(html: string, { raw, block = false }: { raw?: string; block?: boolean } = {}): string {
    this.#slots.push(html)
    const n = this.#slots.length - 1
    if (raw !== undefined) {
      this.#raw.set(n, raw)
    }
    if (block) {
      this.#blockSlots.add(n)
    }
    return `\uE001${n}\uE002`
  }

  #blockSlot(html: string): string {
    this.#slots.push(html)
    return `\n\uE000${this.#slots.length - 1}\uE000\n`
  }

  /** Put every slot back, including the ones a slot was built around. */
  restore(html: string): string {
    let out = html
    for (let depth = 0; depth < 8 && /[\uE000\uE001]/.test(out); depth++) {
      out = out
        .replace(INLINE_SLOT, (_, n) => this.#slots[Number(n)] ?? '')
        .replace(/\uE000(\d+)\uE000/g, (_, n) => this.#slots[Number(n)] ?? '')
    }
    return out
  }

  /** Text with its escapes and verbatim put back as the characters they were, for a reference. */
  #rawText(text: string): string {
    return text.replace(INLINE_SLOT, (_, n) => this.#raw.get(Number(n)) ?? '')
  }

  // ----------------------------------------------------------------------------------------------
  // What nothing else may look inside
  // ----------------------------------------------------------------------------------------------

  /**
   * Lift out `~` escapes, `{{{verbatim}}}` and macros, in one left-to-right pass, so that an escaped
   * `~{{` is never a macro and a macro's content is never read as the page's own syntax. A macro or a
   * verbatim block standing on lines of its own is a block; anywhere else it is inline.
   */
  protect(text: string): string {
    let out = ''
    let i = 0
    while (i < text.length) {
      const char = text[i]
      if (char === '~' && i + 1 < text.length) {
        out += this.#slot(escapeHtml(text[i + 1]), { raw: text[i + 1] })
        i += 2
        continue
      }
      if (text.startsWith('{{{', i)) {
        let end = text.indexOf('}}}', i + 3)
        if (end >= 0) {
          // -> `}}}}}` closes on its last three: the content ends in the braces before them
          while (text[end + 3] === '}') {
            end++
          }
          const content = text.slice(i + 3, end)
          out += standsAlone(text, i, end + 3)
            ? this.#blockSlot(`<pre><code>${escapeHtml(trimNewlines(content))}</code></pre>`)
            : this.#slot(`<code>${escapeHtml(content)}</code>`, { raw: content })
          i = end + 3
          continue
        }
      }
      if (text.startsWith('{{', i) && /[A-Za-z]/.test(text[i + 2] ?? '')) {
        const macro = readMacro(text, i)
        if (macro) {
          const standalone = standsAlone(text, i, macro.end)
          const html = this.#macro(macro, standalone)
          out += html ? (standalone ? this.#blockSlot(html) : this.#slot(html)) : ''
          i = macro.end
          continue
        }
      }
      out += char
      i++
    }
    return out
  }

  /** Wiki text inside a macro, as blocks of its own. */
  #wiki(text: string): string {
    return this.blocks(this.protect(text))
  }

  /** Wiki text inside a macro used in the middle of a line. */
  #inlineWiki(text: string): string {
    return this.#inline(stripParameters(this.protect(text))).replaceAll('\n', '<br>')
  }

  // ----------------------------------------------------------------------------------------------
  // Macros
  // ----------------------------------------------------------------------------------------------

  /** A macro's HTML, or `''` for one that leaves nothing behind. */
  #macro(macro: Macro, block: boolean): string {
    const name = macro.name.toLowerCase()
    const content = macro.content ?? ''
    const params = macro.params

    if (name === 'code' || name === 'noformat') {
      const lowered = (params.language ?? params.lang ?? '').toLowerCase()
      const language = (CODE_LANGUAGES[lowered] ?? lowered).replace(/[^a-z0-9+#-]/g, '')
      if (!block) {
        return `<code>${escapeHtml(content)}</code>`
      }
      const caption = params.title ? `<p><strong>${escapeHtml(params.title)}</strong></p>` : ''
      const cls = language ? ` class="language-${language}"` : ''
      return `${caption}<pre><code${cls}>${escapeHtml(content)}</code></pre>`
    }
    if (ALERT_MACROS[name]) {
      if (!block) {
        return this.#inlineWiki(content)
      }
      const title = params.title ? `<p class="alert-title">${escapeHtml(params.title)}</p>` : ''
      return `<blockquote class="${ALERT_MACROS[name]}">${title}${this.#wiki(content)}</blockquote>`
    }
    if (name === 'box' || name === 'quote') {
      if (!block) {
        return this.#inlineWiki(content)
      }
      const title = params.title ? `<p><strong>${escapeHtml(params.title)}</strong></p>` : ''
      return `<blockquote>${title}${this.#wiki(content)}</blockquote>`
    }
    if (EXPAND_MACROS.has(name)) {
      const summary = escapeHtml(params.title || params.label || 'Details')
      return `<details><summary>${summary}</summary>${this.#wiki(content)}</details>`
    }
    if (name === 'html') {
      return content
    }
    if (SILENT_MACROS.has(name)) {
      return ''
    }
    if (UNWRAP_MACROS.has(name)) {
      return block ? this.#wiki(content) : this.#inlineWiki(content)
    }
    if (name === 'figurecaption') {
      return block ? `<p><em>${this.#inlineWiki(content)}</em></p>` : this.#inlineWiki(content)
    }
    if (name === 'footnote') {
      return this.#footnote(content)
    }
    if (name === 'children' || name === 'documenttree' || name === 'navigationtree') {
      return this.#index(name, params)
    }
    if (name === 'include' || name === 'display') {
      this.#losses.included++
      const reference = params.reference ?? params.page ?? params.document ?? ''
      if (!reference) {
        return ''
      }
      const type = (params.type ?? '').toLowerCase()
      const link = this.#link(
        type === 'page' ? `page:${reference}` : type === 'space' ? `space:${reference}` : reference
      )
      return block ? `<p>${link}</p>` : link
    }
    if (name === 'mention') {
      const reference = params.reference ?? ''
      const { parts } = parseReference(reference)
      const key = referenceKey(parts.length === 1 ? ['XWiki', ...parts] : parts)
      const label = this.#ctx.resolve.user(key) ?? parts.at(-1) ?? reference
      return escapeHtml(`@${label}`)
    }
    if (CODE_MACROS[name]) {
      const { language, reported } = CODE_MACROS[name]
      if (reported) {
        count(this.#losses.asCode, name)
      }
      return block
        ? `<pre><code class="language-${language}">${escapeHtml(content)}</code></pre>`
        : `<code>${escapeHtml(content)}</code>`
    }
    if (FILE_MACROS.has(name)) {
      const reference = (params.reference ?? params.attachment ?? params.file ?? content).trim()
      const link = reference ? this.#link(`attach:${reference.replace(/^attach:/i, '')}`) : ''
      return block && link ? `<p>${link}</p>` : link
    }
    if (name === 'iframe') {
      const src = params.src ?? ''
      if (!/^https?:\/\//i.test(src)) {
        count(this.#losses.unsupported, name)
        return ''
      }
      const link = `<a href="${escapeHtml(src)}">${escapeHtml(src)}</a>`
      return block ? `<p>${link}</p>` : link
    }
    if (name === 'rss') {
      count(this.#losses.dynamic, name)
      const feed = params.feed ?? ''
      if (!/^https?:\/\//i.test(feed)) {
        return ''
      }
      const link = `<a href="${escapeHtml(feed)}">${escapeHtml(feed)}</a>`
      return block ? `<p>${link}</p>` : link
    }
    if (DYNAMIC_MACROS.has(name)) {
      count(this.#losses.dynamic, name)
      return ''
    }
    count(this.#losses.unsupported, macro.name)
    const note = `<em>[The XWiki macro "${escapeHtml(macro.name)}" could not be imported.]</em>`
    return block ? `<p>${note}</p>` : note
  }

  /**
   * `{{children/}}`, `{{documentTree/}}`: an index of the folder they listed. `children` lists the page
   * it is on; a tree lists from its `root` (a document or a space), the whole wiki without one.
   */
  #index(name: string, params: Record<string, string>): string {
    let pageParts = this.#currentPage
    let depth = '0'
    if (name !== 'children') {
      depth = '10'
      const root = (params.root ?? params.reference ?? '').trim()
      const typed = /^(document|space|page|wiki):(.*)$/s.exec(root)
      if (!root || typed?.[1] === 'wiki') {
        pageParts = []
      } else {
        const { parts } = parseReference(typed ? typed[2] : root)
        pageParts = parts.at(-1) === 'WebHome' ? parts.slice(0, -1) : parts
      }
    }
    const folder = this.#folderOf(pageParts)
    return this.#slot(
      `<block-index path="${escapeHtml(folder === 'home' ? '' : folder)}" depth="${depth}" limit="100" columns="1"></block-index>`,
      { block: true }
    )
  }

  /** The folder a nested page's children are in here: its space's folder, or its own path. */
  #folderOf(pageParts: string[]): string {
    const space = this.#ctx.resolve.space(referenceKey(pageParts))
    if (space) {
      return space.folder
    }
    return this.#missingPath(pageParts)
  }

  // ----------------------------------------------------------------------------------------------
  // Blocks
  // ----------------------------------------------------------------------------------------------

  /** Convert block-level text: groups first, then line by line. */
  blocks(text: string, top = false): string {
    const lines = this.#groups(stripParameters(text)).split('\n')
    const out: string[] = []
    let paragraph: string[] = []

    const emit = (html: string, heading: string | null = null) => {
      if (
        top &&
        !this.#wroteBlock &&
        heading !== null &&
        this.#ctx.dropHeading &&
        sameTitle(heading, this.#ctx.dropHeading)
      ) {
        this.#wroteBlock = true
        return
      }
      if (html) {
        out.push(html)
        if (top) {
          this.#wroteBlock = true
        }
      }
    }
    const flush = () => {
      if (paragraph.length > 0) {
        emit(this.#paragraph(paragraph))
        paragraph = []
      }
    }

    for (let i = 0; i < lines.length;) {
      const line = lines[i]
      if (!line.trim()) {
        flush()
        i++
        continue
      }
      const slot = BLOCK_SLOT_LINE.exec(line)
      if (slot) {
        flush()
        emit(`\uE000${slot[1]}\uE000`)
        i++
        continue
      }
      const heading = HEADING_LINE.exec(line)
      if (heading) {
        flush()
        const level = heading[1].length
        const html = this.#inline(heading[2].trim())
        const plain = this.restore(html)
          .replace(/<[^>]*>/g, '')
          .replaceAll('&lt;', '<')
          .replaceAll('&gt;', '>')
          .replaceAll('&quot;', '"')
          .replaceAll('&amp;', '&')
          .trim()
        emit(`<h${level}>${html}</h${level}>`, plain)
        i++
        continue
      }
      if (/^[ \t]*-{4,}[ \t]*$/.test(line)) {
        flush()
        emit('<hr>')
        i++
        continue
      }
      if (listItem(line)) {
        flush()
        const items: string[] = []
        while (i < lines.length && listItem(lines[i])) {
          items.push(lines[i++])
        }
        emit(this.#list(items))
        continue
      }
      if (DEFINITION_LINE.test(line)) {
        flush()
        const items: string[] = []
        while (i < lines.length && DEFINITION_LINE.test(lines[i])) {
          items.push(lines[i++])
        }
        emit(this.#definitions(items))
        continue
      }
      if (TABLE_LINE.test(line)) {
        flush()
        const rows: string[] = []
        while (i < lines.length && lines[i].trim() && !BLOCK_SLOT_LINE.test(lines[i])) {
          if (TABLE_LINE.test(lines[i])) {
            rows.push(lines[i])
          } else if (
            listItem(lines[i]) ||
            HEADING_LINE.test(lines[i]) ||
            lines[i].trimStart().startsWith('>')
          ) {
            break
          } else {
            // -> A line that starts no block of its own goes on in the last cell, as a new line there
            rows[rows.length - 1] += `\n${lines[i]}`
          }
          i++
        }
        emit(this.#table(rows))
        continue
      }
      if (line.trimStart().startsWith('>')) {
        flush()
        const quoted: string[] = []
        while (i < lines.length && lines[i].trimStart().startsWith('>')) {
          quoted.push(lines[i++].trimStart())
        }
        emit(this.#quote(quoted))
        continue
      }
      paragraph.push(line.trim())
      i++
    }
    flush()
    return out.join('\n')
  }

  /**
   * `(((…)))`, a group: a document of its own inside this one, which is how XWiki puts a list or a
   * second paragraph in a table cell. Its layout is not kept: standing alone it is its content, and
   * inside a line (a cell) it is that content in a `<div>`.
   */
  #groups(text: string): string {
    let out = ''
    let rest = text
    for (;;) {
      const start = rest.indexOf('(((')
      if (start < 0) {
        return out + rest
      }
      const token = /\(\(\(|\)\)\)/g
      token.lastIndex = start + 3
      let depth = 1
      let end = -1
      for (let match = token.exec(rest); match; match = token.exec(rest)) {
        depth += match[0] === '(((' ? 1 : -1
        if (depth === 0) {
          end = match.index
          break
        }
      }
      if (end < 0) {
        return out + rest
      }
      const body = this.blocks(rest.slice(start + 3, end))
      out += rest.slice(0, start)
      out += standsAlone(rest, start, end + 3)
        ? this.#blockSlot(body)
        : this.#slot(`<div>${body}</div>`)
      rest = rest.slice(end + 3)
    }
  }

  /** A paragraph: its lines run on with a line break, which is what a newline is to XWiki. */
  #paragraph(lines: string[]): string {
    const html = this.#inline(lines.join('\n')).trim().replaceAll('\n', '<br>')
    if (!html) {
      return ''
    }
    // -> An index written on a line of its own is a block once converted, which a paragraph cannot hold
    const only = /^\uE001(\d+)\uE002$/.exec(html)
    if (only && this.#blockSlots.has(Number(only[1]))) {
      return html
    }
    return `<p>${html}</p>`
  }

  /**
   * A run of list lines. The marker is the item's whole path: `**` is a bullet under a bullet, `11.` a
   * number under a number, and `1*.` a bullet under a number. A list that jumps two levels at once
   * gets an empty item at the level in between, as XWiki draws it.
   */
  #list(lines: string[]): string {
    let html = ''
    const stack: string[] = []
    for (const line of lines) {
      const { kinds, text } = listItem(line)!
      const depth = kinds.length
      while (stack.length > depth) {
        html += `</li></${stack.pop()}>`
      }
      if (stack.length === depth) {
        html += stack.at(-1) === kinds[depth - 1] ? '</li>' : `</li></${stack.pop()}>`
      }
      while (stack.length < depth) {
        const tag = kinds[stack.length]
        html += `<${tag}>`
        stack.push(tag)
        if (stack.length < depth) {
          html += '<li>'
        }
      }
      html += `<li>${this.#inline(text)}`
    }
    while (stack.length > 0) {
      html += `</li></${stack.pop()}>`
    }
    return html
  }

  /**
   * `; term` and `: definition`. Markdown has no definition list, so each term is a paragraph of its
   * own, in bold, with its definitions under it a line each.
   */
  #definitions(lines: string[]): string {
    const out: string[] = []
    let current: string[] = []
    const flush = () => {
      if (current.length > 0) {
        out.push(`<p>${current.join('<br>')}</p>`)
        current = []
      }
    }
    for (const line of lines) {
      const match = DEFINITION_LINE.exec(line)!
      const html = this.#inline(match[2].trim())
      if (match[1].endsWith(';')) {
        flush()
        current.push(`<strong>${html}</strong>`)
      } else {
        current.push(html)
      }
    }
    flush()
    return out.join('')
  }

  /** Quoted lines, `>` per level. Lines of one level run on with a line break. */
  #quote(lines: string[]): string {
    let html = ''
    let level = 0
    let run: string[] = []
    const flush = () => {
      if (run.length > 0) {
        html += `<p>${run.map((text) => this.#inline(text)).join('<br>')}</p>`
        run = []
      }
    }
    for (const line of lines) {
      const match = /^(>+)[ \t]?(.*)$/s.exec(line)!
      const depth = match[1].length
      if (depth !== level) {
        flush()
      }
      while (level < depth) {
        html += '<blockquote>'
        level++
      }
      while (level > depth) {
        html += '</blockquote>'
        level--
      }
      run.push(match[2])
    }
    flush()
    return html + '</blockquote>'.repeat(level)
  }

  /**
   * A table. `|=` (or `!=`) starts a header cell and `|` (or `!!`) a normal one. XWiki has no merged
   * cells, so the rows are as written; a header row on top becomes the table's head.
   */
  #table(lines: string[]): string {
    const rows = lines.map((line) => {
      const text = line.trim()
      const cells: Array<{ header: boolean; text: string }> = []
      const append = (chars: string) => {
        if (cells.length > 0) {
          cells[cells.length - 1].text += chars
        }
      }
      // -> A link's `||` parameters are not a cell boundary, so `[[…]]` is stepped over whole
      let depth = 0
      for (let i = 0; i < text.length; i++) {
        const pair = text.slice(i, i + 2)
        if (pair === '[[' || (pair === ']]' && depth > 0)) {
          depth += pair === '[[' ? 1 : -1
          append(pair)
          i++
        } else if (depth === 0 && (pair === '|=' || pair === '!=')) {
          cells.push({ header: true, text: '' })
          i++
        } else if (depth === 0 && pair === '!!') {
          cells.push({ header: false, text: '' })
          i++
        } else if (depth === 0 && text[i] === '|') {
          cells.push({ header: false, text: '' })
        } else {
          append(text[i])
        }
      }
      // -> A `|` closing the row is not a cell of its own
      if (cells.length > 1 && cells.at(-1)!.text.trim() === '' && !cells.at(-1)!.header) {
        cells.pop()
      }
      return cells.map((cell) => ({
        header: cell.header,
        html: this.#inline(cell.text.trim()).replaceAll('\n', '<br>')
      }))
    })
    const rowHtml = (row: Array<{ header: boolean; html: string }>) =>
      `<tr>${row.map((cell) => (cell.header ? `<th>${cell.html}</th>` : `<td>${cell.html}</td>`)).join('')}</tr>`
    const [first, ...others] = rows
    if (first && first.length > 0 && first.every((cell) => cell.header)) {
      return `<table><thead>${rowHtml(first)}</thead><tbody>${others.map(rowHtml).join('')}</tbody></table>`
    }
    return `<table><tbody>${rows.map(rowHtml).join('')}</tbody></table>`
  }

  // ----------------------------------------------------------------------------------------------
  // Inline
  // ----------------------------------------------------------------------------------------------

  /**
   * Inline text: links, images and addresses are lifted out first — a URL's `//` would otherwise be
   * italics — then the rest is escaped and its formatting marks paired up. A mark with no partner is
   * left as the characters it is. Newlines are kept, for the block to decide what they are.
   */
  #inline(text: string, { inLink = false } = {}): string {
    let s = this.#links(text)
    s = s.replace(/(?<![\w/])image:([^\s\]|]+)/g, (_, ref: string) =>
      this.#slot(this.#image(this.#rawText(ref), {}, ''))
    )
    if (!inLink) {
      s = s.replace(/(?<![\w/])(attach|mailto):([^\s\]|]+)/g, (match: string) =>
        this.#slot(this.#link(match))
      )
      s = s.replace(URL_PATTERN, (match: string) => {
        // -> Punctuation ending a sentence is not part of the address before it
        const url = match.replace(/[.,:;!?)]+$/, '')
        return (
          this.#slot(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`) +
          match.slice(url.length)
        )
      })
    } else {
      s = s.replace(URL_PATTERN, (match: string) => this.#slot(escapeHtml(match)))
    }
    s = s.replaceAll('\\\\', () => this.#slot('<br>'))
    s = escapeHtml(s)
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/\/\/([\s\S]+?)\/\//g, '<em>$1</em>')
    s = s.replace(/__([\s\S]+?)__/g, '<u>$1</u>')
    s = s.replace(/--([\s\S]+?)--/g, '<del>$1</del>')
    s = s.replace(/##([\s\S]+?)##/g, '<code>$1</code>')
    s = s.replace(/\^\^([\s\S]+?)\^\^/g, '<sup>$1</sup>')
    s = s.replace(/,,([\s\S]+?),,/g, '<sub>$1</sub>')
    return s
  }

  /** Every `[[…]]`, nested ones included (`[[[[image:a.png]]>>Page]]`), as a slot. */
  #links(text: string): string {
    let out = ''
    let from = 0
    for (;;) {
      const start = text.indexOf('[[', from)
      if (start < 0) {
        break
      }
      let depth = 0
      let end = -1
      for (let j = start; j < text.length - 1; j++) {
        if (text.startsWith('[[', j)) {
          depth++
          j++
        } else if (text.startsWith(']]', j)) {
          depth--
          if (depth === 0) {
            end = j
            break
          }
          j++
        }
      }
      if (end < 0) {
        break
      }
      out += text.slice(from, start) + this.#slot(this.#link(text.slice(start + 2, end)))
      from = end + 2
    }
    return out + text.slice(from)
  }

  /**
   * `[[label>>reference||parameters]]`, or a bare reference (`attach:a.pdf`, `mailto:…`). The label is
   * wiki text; with none, the link is labelled with what it points at, as XWiki labels it.
   */
  #link(body: string): string {
    const labelAt = topLevelIndex(body, '>>')
    const label = labelAt >= 0 ? body.slice(0, labelAt) : ''
    const rest = labelAt >= 0 ? body.slice(labelAt + 2) : body
    const paramsAt = topLevelIndex(rest, '||')
    const reference = this.#rawText(paramsAt >= 0 ? rest.slice(0, paramsAt) : rest).trim()
    const params = paramsAt >= 0 ? macroParams(this.#rawText(rest.slice(paramsAt + 2))) : {}

    if (/^image:/i.test(reference)) {
      // -> `[[caption>>image:a.png]]`: the label is the picture's caption
      const caption = label ? this.restore(this.#inline(label, { inLink: true })) : ''
      return this.#image(reference.slice('image:'.length), params, caption.replace(/<[^>]*>/g, ''))
    }
    const target = this.#target(reference, params)
    const labelHtml = label ? this.#inline(label, { inLink: true }) : escapeHtml(target.label)
    if (!target.href) {
      this.#losses.unresolvedLinks++
      return labelHtml
    }
    return `<a href="${escapeHtml(target.href)}">${labelHtml}</a>`
  }

  /** Where a link reference points here, and what to call it when it has no label. */
  #target(
    reference: string,
    params: Record<string, string>
  ): { href: string | null; label: string } {
    const typed = /^([A-Za-z]+):(.*)$/s.exec(reference)
    const type =
      typed && REFERENCE_TYPES.has(typed[1].toLowerCase()) ? typed[1].toLowerCase() : null
    const value = type ? typed![2] : reference

    if (!type && /^[a-z][a-z0-9+.-]*:\/\//i.test(reference)) {
      return { href: reference, label: reference }
    }
    switch (type) {
      case 'url':
        return { href: value, label: value }
      case 'mailto':
        return { href: `mailto:${value}`, label: value }
      case 'attach':
      case 'pageattach': {
        const file = type === 'attach' ? this.#attachment(value) : this.#pageAttachment(value)
        return { href: file.href, label: file.name }
      }
      case 'unc':
      case 'path':
      case 'data':
      case 'icon':
        return { href: null, label: value }
      case 'interwiki':
        return { href: null, label: value.slice(value.indexOf(':') + 1) || value }
      case 'user': {
        const { parts } = parseReference(value)
        return { href: null, label: parts.at(-1) ?? value }
      }
    }

    // -> A document, a space or a nested page, with an anchor written `#…` (2.0) or as a parameter
    let docRef = value
    let anchor = params.anchor ?? ''
    const hash = lastIndexOfUnescaped(docRef, '#')
    if (hash >= 0) {
      anchor ||= unescapeReference(docRef.slice(hash + 1))
      docRef = docRef.slice(0, hash)
    }
    const query = indexOfUnescaped(docRef, '?')
    if (query >= 0) {
      docRef = docRef.slice(0, query)
    }
    if (!docRef.trim()) {
      const fragment = this.#anchors.get(anchor)
      return { href: fragment ? `#${fragment}` : '#', label: anchor }
    }
    const found = this.#pageTarget(type ?? 'untyped', docRef)
    // -> A section of another page cannot be found by its XWiki anchor here, so the link is to the page
    const sameDoc = found.key === this.#ctx.docKey
    const fragment = sameDoc && anchor ? this.#anchors.get(anchor) : undefined
    return {
      href: `/${found.path === 'home' ? '' : found.path}${fragment ? `#${fragment}` : ''}`,
      label: found.title
    }
  }

  /**
   * The page a reference names, by XWiki's rules for each type; and for one that names a page that is
   * not in the import, where it would be. Each candidate is asked of the index in order.
   */
  #pageTarget(
    type: string,
    reference: string
  ): { path: string; title: string; key: string | null } {
    const candidates: string[][] = []
    let fallback: string[]
    const space = this.#space
    const isNested = this.#name === 'WebHome'

    if (type === 'page') {
      const pageParts = this.#pagePath(reference)
      candidates.push([...pageParts, 'WebHome'], pageParts)
      fallback = [...pageParts, 'WebHome']
    } else if (type === 'space') {
      const { parts, relative } = parseReference(reference)
      const spaceParts = relative ? [...space, ...parts] : parts
      candidates.push([...spaceParts, 'WebHome'])
      fallback = [...spaceParts, 'WebHome']
    } else {
      const { parts, relative } = parseReference(reference)
      if (type === 'doc') {
        const doc = relative || parts.length < 2 ? [...space, ...parts] : parts
        candidates.push(doc)
        fallback = doc
      } else if (relative || parts.length > 1) {
        const doc = relative ? [...space, ...parts] : parts
        candidates.push(doc)
        if (doc.at(-1) !== 'WebHome') {
          candidates.push([...doc, 'WebHome'])
        }
        fallback = doc.at(-1) === 'WebHome' ? doc : [...doc, 'WebHome']
      } else {
        const name = parts[0] ?? 'WebHome'
        candidates.push([...space, name], [...space, name, 'WebHome'])
        fallback = [...space, name, 'WebHome']
        if (isNested && space.length > 0) {
          const parent = space.slice(0, -1)
          candidates.push([...parent, name], [...parent, name, 'WebHome'])
          fallback = [...parent, name, 'WebHome']
        }
      }
    }

    for (const parts of candidates) {
      if (parts.length < 2) {
        continue
      }
      const key = referenceKey(parts)
      const found = this.#ctx.resolve.page(key)
      if (found) {
        return { ...found, key }
      }
    }
    this.#losses.missingPages++
    const nested = fallback.at(-1) === 'WebHome' ? fallback.slice(0, -1) : fallback
    return {
      path: this.#missingPath(nested),
      title: nested.at(-1) ?? 'Home',
      key: null
    }
  }

  /**
   * A `page:` reference's names: `A/B/C` from the top, `./Child` under the current page, `../Sibling`
   * beside it, and a single name beside it too, which is how XWiki fills in a relative one.
   */
  #pagePath(reference: string): string[] {
    const colon = indexOfUnescaped(reference, ':')
    const value = colon >= 0 ? reference.slice(colon + 1) : reference
    const segments = splitUnescaped(value, '/').map((part) => unescapeReference(part))
    const current = this.#currentPage
    if (segments[0] === '.' || segments[0] === '..') {
      const parts = [...current]
      for (const segment of segments) {
        if (segment === '..') {
          parts.pop()
        } else if (segment !== '.' && segment !== '') {
          parts.push(segment)
        }
      }
      return parts
    }
    const named = segments.filter(Boolean)
    return named.length === 1 ? [...current.slice(0, -1), named[0]] : named
  }

  /**
   * Where a nested page that is not in the import would be: the folder of the nearest space that is,
   * and the rest of its names as path segments. Following such a link here offers to create it.
   */
  #missingPath(pageParts: string[]): string {
    for (let n = pageParts.length; n >= 0; n--) {
      const known = this.#ctx.resolve.space(referenceKey(pageParts.slice(0, n)))
      if (known) {
        const rest = pageParts.slice(n).map((part) => pathSegmentFromTitle(part) || 'page')
        return [known.folder, ...rest].filter(Boolean).join('/') || 'home'
      }
    }
    return pageParts.map((part) => pathSegmentFromTitle(part) || 'page').join('/') || 'home'
  }

  /**
   * `attach:[document@]name` — a file on this page, or on the document named. A document reference
   * here is a document's, so a single name is in the current space, and a nested page is tried after
   * a terminal one of the same name.
   */
  #attachment(reference: string): { href: string | null; name: string } {
    const at = lastIndexOfUnescaped(reference, '@')
    const name = unescapeReference(at >= 0 ? reference.slice(at + 1) : reference)
    const candidates: string[] = []
    if (at < 0) {
      candidates.push(this.#ctx.docKey)
    } else {
      const { parts, relative } = parseReference(reference.slice(0, at))
      const doc = relative || parts.length < 2 ? [...this.#space, ...parts] : parts
      candidates.push(referenceKey(doc))
      if (doc.at(-1) !== 'WebHome') {
        candidates.push(referenceKey([...doc, 'WebHome']))
      }
    }
    return { href: this.#fileHref(candidates, name), name }
  }

  /** `pageAttach:A/B/name` — a file on a nested page, or on this page when only the name is given. */
  #pageAttachment(reference: string): { href: string | null; name: string } {
    const slash = lastIndexOfUnescaped(reference, '/')
    const name = unescapeReference(slash >= 0 ? reference.slice(slash + 1) : reference)
    if (slash < 0) {
      return { href: this.#fileHref([this.#ctx.docKey], name), name }
    }
    const pageParts = this.#pagePath(reference.slice(0, slash))
    const candidates = [referenceKey([...pageParts, 'WebHome']), referenceKey(pageParts)]
    return { href: this.#fileHref(candidates, name), name }
  }

  #fileHref(docKeys: string[], name: string): string | null {
    for (const docKey of docKeys) {
      const found = this.#ctx.resolve.file(fileKey(docKey, name))
      if (found) {
        return found
      }
    }
    return null
  }

  /**
   * An image — an attachment, a URL, or an `icon:` of XWiki's own icon set, which is dropped. A width
   * and height in pixels are kept; anything else about how it was laid out is not.
   */
  #image(reference: string, params: Record<string, string>, caption: string): string {
    const typed = /^(attach|pageAttach|url|icon|data):(.*)$/is.exec(reference)
    const type = typed?.[1].toLowerCase() ?? ''
    const value = typed ? typed[2] : reference
    if (type === 'icon') {
      return ''
    }
    let src: string | null
    let name: string
    if (type === 'url' || type === 'data' || /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      src = value
      name = value
    } else {
      const file = type === 'pageattach' ? this.#pageAttachment(value) : this.#attachment(value)
      src = file.href
      name = file.name
    }
    const alt = caption || params.alt || ''
    if (!src) {
      this.#losses.unresolvedLinks++
      return escapeHtml(alt || name)
    }
    const width = /^(\d+)(?:px)?$/.exec(params.width ?? '')?.[1] ?? ''
    const height = /^(\d+)(?:px)?$/.exec(params.height ?? '')?.[1] ?? ''
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${width ? ` width="${width}"` : ''}${width && height ? ` height="${height}"` : ''}>`
  }

  /**
   * `{{footnote}}…{{/footnote}}`, numbered in order, written the way `markdown-it-footnote` renders one
   * so that `htmlToMarkdown` writes it back as `[^n]`. `{{putFootnotes/}}` is where XWiki listed them;
   * here they are always at the end.
   */
  #footnote(body: string): string {
    const n = this.#footnotes.push(this.#inlineWiki(body.trim()))
    return `<sup class="footnote-ref"><a href="#fn${n}" id="fnref${n}">[${n}]</a></sup>`
  }

  footnotesHtml(): string {
    if (this.#footnotes.length < 1) {
      return ''
    }
    const items = this.#footnotes
      .map(
        (html, i) =>
          `<li id="fn${i + 1}" class="footnote-item"><p>${html} <a href="#fnref${i + 1}" class="footnote-backref">↩︎</a></p></li>`
      )
      .join('')
    return `\n<hr class="footnotes-sep"><section class="footnotes"><ol class="footnotes-list">${items}</ol></section>`
  }
}

/** `(% … %)` parameters — a class, a style — and the `(%%)` that ends them: layout, which is not kept. */
function stripParameters(text: string): string {
  return text.replace(/\(%[\s\S]*?%\)/g, '')
}

/**
 * A list line's levels and text. The marker is `*` and `1` characters, one per level, and a `.` after
 * it whenever a `1` is in it: `* a`, `11. b`, `1*. c`. A `1` with no dot is the text it is.
 */
function listItem(line: string): { kinds: string[]; text: string } | null {
  const match = LIST_LINE.exec(line)
  if (!match) {
    return null
  }
  const [, marks, dot, text] = match
  if (!dot && marks.includes('1')) {
    return null
  }
  return { kinds: [...marks].map((mark) => (mark === '1' ? 'ol' : 'ul')), text }
}
