import { pathSegmentFromTitle } from './common.ts'
import { slugifyHeading } from '../models/rendering.ts'

/**
 * DokuWiki's wiki syntax → HTML this wiki renders, for **Import from DokuWiki**
 * (`models/importDokuwiki.ts`).
 *
 * The same arrangement as Confluence's storage format (`helpers/confluenceStorage.ts`): the source is
 * rewritten into plain HTML — or into the element of the block that does the same job, a page index
 * for a namespace listing — and what comes out is handed to `htmlToMarkdown`, or stored as it is. Going
 * through HTML rather than writing markdown directly is what makes the escaping someone else's
 * problem: DokuWiki text is full of characters the wiki's markdown reads as markup (a `<pool>`, a
 * `[[`, a single newline that this renderer draws as a line break), and `htmlToMarkdown` already
 * escapes exactly those.
 *
 * DokuWiki's parser is a lexer of modes, each with an entry and an exit pattern. This is not that: it is
 * a line-oriented reader for the block syntax (headings, lists, tables, quotes, indented code) and a
 * pass of ordered substitutions for the inline syntax, with what must not be looked inside of —
 * `<code>`, `<nowiki>`, `%%…%%`, a link, a URL — lifted out into numbered slots first and put back last.
 * That covers what the syntax page documents, plus the handful of plugins most wikis have (`WRAP`,
 * `note`, `tag`, the namespace listings).
 *
 * **What cannot be carried says so.** A plugin this file has no translation for is counted by name and
 * leaves a line where it stood; a listing that was computed when the page was viewed (`changes`,
 * `backlinks`, a feed) is dropped and counted. The counts are what the import log reports.
 */

/** What the converter asks the import about. Null is "not part of this import". */
export interface DokuwikiResolver {
  /** A page's path here, by its DokuWiki id. `home` is the site's home page. */
  pagePath(id: string): string | null
  /** A page's title, for a link written without a label of its own. */
  pageTitle(id: string): string | null
  /**
   * A namespace by its id (`''` is the root): the path its start page is at, null when it has none,
   * the folder its pages are in, and what it is called (its start page's title, or its name).
   */
  namespace(id: string): { home: string | null; folder: string; title: string } | null
  /** A media file's URL path, by its id. */
  filePath(id: string): string | null
  /** An interwiki shortcut's URL template, as `conf/interwiki.conf` writes one. */
  interwiki(name: string): string | null
}

export interface DokuwikiContext {
  /** The id of the page being converted, which is what a relative link is relative to. */
  pageId: string
  resolve: DokuwikiResolver
  /**
   * Leave out the first heading when the page opens with it. It becomes the page's title, which this
   * wiki draws above the content, so keeping it would show it twice.
   */
  dropTitle: boolean
}

/** What a conversion could not carry, for the log. */
export interface DokuwikiLosses {
  /** Plugin name → how many were left as a note on the page. */
  unsupported: Map<string, number>
  /** Plugin name → how many were dropped, being something DokuWiki computed when the page was viewed. */
  dynamic: Map<string, number>
  /** Links and images to media or Windows shares that are not part of this import; their text was kept. */
  unresolvedLinks: number
  /** Links to pages that did not exist in DokuWiki either, pointed at where such a page would be here. */
  missingPages: number
}

export interface DokuwikiConversion {
  html: string
  /** The page's first heading, which is what DokuWiki calls its title, or null when it has none. */
  title: string | null
  /** What the tag plugin (`{{tag>…}}`) named. */
  tags: string[]
}

/** What a body refers to, read before it is converted so that a batch can be looked up at once. */
export interface DokuwikiRefs {
  pages: string[]
  namespaces: string[]
  files: string[]
  interwiki: string[]
}

export function newDokuwikiLosses(): DokuwikiLosses {
  return { unsupported: new Map(), dynamic: new Map(), unresolvedLinks: 0, missingPages: 0 }
}

/** What `{{name>…}}` plugins list pages of a namespace — rendered here as an index of its folder. */
const NAMESPACE_LISTINGS = new Set(['indexmenu', 'indexmenu_n', 'simplenavi', 'nspages', 'catlist'])

/** Plugins showing what DokuWiki works out when the page is viewed, with nothing to carry over. */
const DYNAMIC_PLUGINS = new Set([
  'backlinks',
  'changes',
  'blog',
  'archive',
  'pagelist',
  'search',
  'searchform',
  'tagcloud',
  'count',
  'popularity',
  'recent',
  'feed',
  'rss',
  'discussion',
  'include',
  'pagequery',
  'dataentry',
  'datatable',
  'datarelated',
  'translation'
])

/** `~~MACRO~~` words that only steer DokuWiki's own rendering, and are dropped without a word. */
const SILENT_MACROS = new Set(['NOTOC', 'NOCACHE', 'TOC', 'NOINDEX', 'NO_TOC'])

/** File extensions DokuWiki shows as a picture rather than a link. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'])

/** The `note` plugin's kinds, onto this wiki's alerts (`renderers/modules/github-alerts.js`). */
const NOTE_KINDS: Record<string, string> = {
  '': 'is-info',
  classic: 'is-info',
  tip: 'is-success',
  important: 'is-warning',
  warning: 'is-danger'
}

/** The `WRAP` plugin's box classes. Everything else it does is layout, and is unwrapped. */
const WRAP_KINDS: Record<string, string> = {
  info: 'is-info',
  help: 'is-info',
  todo: 'is-info',
  download: 'is-info',
  tip: 'is-success',
  important: 'is-warning',
  safety: 'is-warning',
  alert: 'is-danger',
  danger: 'is-danger',
  warning: 'is-danger'
}

/** GeSHi's names that are not the highlighter's. Everything else is passed on as written. */
const CODE_LANGUAGES: Record<string, string> = {
  html4strict: 'html',
  html5: 'html',
  xhtml: 'html',
  javascript: 'javascript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  apache: 'apacheconf',
  dos: 'batch',
  text: '',
  txt: '',
  plain: '',
  none: '',
  '-': ''
}

/**
 * DokuWiki's typography (`conf/entities.conf`), the part of it that cannot be mistaken for anything
 * else: arrows and the three signs. Its dashes and quotes are left as typed.
 */
const ENTITIES: Array<[RegExp, string]> = [
  [/<->/g, '↔'],
  [/<=>/g, '⇔'],
  [/->/g, '→'],
  [/<-/g, '←'],
  [/=>/g, '⇒'],
  [/<=/g, '⇐'],
  [/\(c\)/g, '©'],
  [/\(tm\)/g, '™'],
  [/\(r\)/g, '®']
]

/**
 * A slot: lifted-out HTML that the substitutions must not look inside, put back last. Marked with
 * private-use characters, which no wiki text holds and no substitution here matches.
 */
const INLINE_SLOT = /\uE001(\d+)\uE002/g
/** A slot standing on a line of its own, which the block reader passes through untouched. */
const BLOCK_SLOT_LINE = /^[ \t]*\uE000(\d+)\uE000[ \t]*$/

const URL_PATTERN =
  /\b(?:(?:https?|ftps?|news|irc|gopher):\/\/[^\s<>"'[\]{}|\\^`]+|www\.[\w-]+\.[^\s<>"'[\]{}|\\^`]+)/gi

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

// ================================================================================================
// IDS
// ================================================================================================

/**
 * A page or media id as DokuWiki stores it (`cleanID`): lowercase, `;` for `:`, a slash for an
 * underscore (`useslash` off, the default), every run of other punctuation one underscore, and no
 * separator at either end of a part.
 */
export function cleanId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replaceAll(';', ':')
    .replaceAll('/', '_')
    .replaceAll(/[^\p{L}\p{M}\p{N}:._-]+/gu, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/:+/g, ':')
    .replaceAll(/^[:._-]+|[:._-]+$/g, '')
    .replaceAll(/:[:._-]+/g, ':')
    .replaceAll(/[:._-]+:/g, ':')
}

/**
 * The id without its accents — what `deaccent`, on by default, made of a link's target when the page
 * was created. Tried after the id as written, since an install with it off stores accents as they are.
 */
function deaccented(id: string): string {
  return id
    .normalize('NFD')
    .replaceAll(/\p{M}+/gu, '')
    .normalize('NFC')
}

export function namespaceOf(id: string): string {
  const at = id.lastIndexOf(':')
  return at < 0 ? '' : id.slice(0, at)
}

export function nameOf(id: string): string {
  return id.slice(id.lastIndexOf(':') + 1)
}

/**
 * Where a link's target is, from the namespace of the page it is written on — DokuWiki's own rules:
 * `.:x` and `..:x` are relative, `:x` is from the root, a target with no colon is in the same
 * namespace, and anything else with a colon is from the root. A trailing colon names the namespace
 * itself, which a link means its start page by.
 */
export function resolveId(ns: string, target: string): { id: string; isNamespace: boolean } {
  let value = target.trim()
  const isNamespace = value === '' || value.endsWith(':')
  let id: string
  if (value.startsWith('.')) {
    // -> `.page` is the older spelling of `.:page`
    value = value.replace(/^\.(?=[^.:])/, '.:')
    const parts = ns ? ns.split(':') : []
    for (const part of value.split(':')) {
      if (part === '.' || part === '') {
        continue
      }
      if (part === '..') {
        parts.pop()
        continue
      }
      parts.push(part)
    }
    id = parts.join(':')
  } else if (value.startsWith(':') || value.includes(':')) {
    id = value
  } else {
    id = ns && value ? `${ns}:${value}` : value || ns
  }
  return { id: cleanId(id), isNamespace }
}

/** Every namespace a page id sits in, the root included, nearest first. */
function ancestorsOf(id: string): string[] {
  const parts = id.split(':').filter(Boolean)
  const out: string[] = []
  for (let n = parts.length - 1; n >= 0; n--) {
    out.push(parts.slice(0, n).join(':'))
  }
  return out
}

/**
 * Everything a body may point at, so that the import can look a whole batch's worth up in one query
 * per kind rather than one per link. Read off the raw text with patterns rather than a parse: a link
 * inside a code block is looked up for nothing, which costs a key and nothing else.
 */
export function collectDokuwikiRefs(text: string, pageId: string): DokuwikiRefs {
  const ns = namespaceOf(pageId)
  const pages = new Set<string>()
  const namespaces = new Set<string>([''])
  const files = new Set<string>()
  const interwiki = new Set<string>()

  const addPage = (target: string) => {
    const { id, isNamespace } = resolveId(ns, target)
    for (const ancestor of ancestorsOf(id)) {
      namespaces.add(ancestor)
    }
    namespaces.add(id)
    if (!isNamespace) {
      pages.add(id)
      pages.add(deaccented(id))
    }
  }

  for (const match of text.matchAll(/\[\[([^\]\n|#]*)(#[^\]\n|]*)?(?:\|[^\n]*?)?\]\]/g)) {
    const target = match[1].trim()
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target) || target.startsWith('\\\\') || /@/.test(target)) {
      continue
    }
    const interwikiMatch = /^([\w.-]+)>(.*)$/s.exec(target)
    if (interwikiMatch) {
      interwiki.add(interwikiMatch[1].toLowerCase())
      continue
    }
    if (target) {
      addPage(target)
    }
  }
  for (const match of text.matchAll(/\{\{([^}\n]*)\}\}/g)) {
    const body = match[1]
    const plugin = /^\s*(\w+)\s*>\s*([^|#\s]*)/.exec(body)
    if (plugin) {
      const pluginName = plugin[1].toLowerCase()
      if (NAMESPACE_LISTINGS.has(pluginName)) {
        addPage(`${plugin[2] || '.'}:`)
      } else if (pluginName === 'topic') {
        const scope = topicScope(body.slice(body.indexOf('>') + 1))
        if (scope) {
          addPage(`${scope}:`)
        }
      }
      continue
    }
    const ref = mediaRefOf(body)
    if (ref && !/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) {
      const { id } = resolveId(ns, ref)
      files.add(id)
      files.add(deaccented(id))
    }
  }
  for (const match of text.matchAll(/<(?:nspages|catlist)\b([^>\n]*)>/gi)) {
    addPage(`${match[1].trim().split(/\s+/)[0] || '.'}:`)
  }
  return {
    pages: [...pages],
    namespaces: [...namespaces],
    files: [...files],
    interwiki: [...interwiki]
  }
}

/** The id or URL a `{{…}}` names, without its alignment, its caption or its size. */
function mediaRefOf(body: string): string {
  const bar = body.indexOf('|')
  const source = (bar < 0 ? body : body.slice(0, bar)).trim()
  const query = source.lastIndexOf('?')
  // -> An external URL's own query string is part of it, unless what follows is a size or a flag
  if (query >= 0 && !/^[a-z]+:\/\//i.test(source)) {
    return source.slice(0, query)
  }
  if (
    query >= 0 &&
    /^(?:\d+(?:x\d+)?|nolink|direct|linkonly|details|nocache|recache|&)+$/.test(
      source.slice(query + 1)
    )
  ) {
    return source.slice(0, query)
  }
  return source
}

// ================================================================================================
// CONVERSION
// ================================================================================================

/**
 * Convert a page or an old version of one.
 *
 * DokuWiki's text has no fixed outer structure — a page is lines — so nothing here can fail on
 * malformed input: an unclosed `<code>` is text, a `**` with no partner is two asterisks, as DokuWiki
 * itself draws them.
 */
export function dokuwikiToHtml(
  text: string,
  ctx: DokuwikiContext,
  losses: DokuwikiLosses
): DokuwikiConversion {
  const converter = new Converter(ctx, losses)
  const source = converter.protect(text.replace(/\r\n?/g, '\n'))
  const html = converter.blocks(source, true) + converter.footnotesHtml()
  return {
    html: converter.restore(html),
    title: converter.title,
    tags: [...new Set(converter.tags)]
  }
}

class Converter {
  readonly #ctx: DokuwikiContext
  readonly #losses: DokuwikiLosses
  readonly #ns: string
  /** Lifted-out HTML, by number. */
  readonly #slots: string[] = []
  /** Slots that hold a block (an index), which a paragraph of nothing else must not wrap. */
  readonly #blockSlots = new Set<number>()
  readonly #footnotes: string[] = []
  title: string | null = null
  tags: string[] = []
  /** Whether the top level has written anything yet — the title is only dropped from the very top. */
  #wroteBlock = false

  constructor(ctx: DokuwikiContext, losses: DokuwikiLosses) {
    this.#ctx = ctx
    this.#losses = losses
    this.#ns = namespaceOf(ctx.pageId)
  }

  #slot(html: string, { block = false } = {}): string {
    this.#slots.push(html)
    const n = this.#slots.length - 1
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

  // ----------------------------------------------------------------------------------------------
  // What nothing else may look inside
  // ----------------------------------------------------------------------------------------------

  /**
   * Lift out code, `<file>`, `<nowiki>`, `%%…%%`, embedded HTML and PHP — in one left-to-right pass, so
   * a `%%` inside a code block stays code.
   */
  protect(text: string): string {
    return text.replace(
      /<(code|file)(\s[^>\n]*)?>([\s\S]*?)<\/\1>|<nowiki>([\s\S]*?)<\/nowiki>|%%([\s\S]*?)%%|<(html|HTML|php|PHP)>([\s\S]*?)<\/\6>/g,
      (match, codeTag, attrs, code, nowiki, percent, embedTag, embedded) => {
        if (codeTag) {
          return this.#blockSlot(this.#codeBlock(attrs ?? '', code))
        }
        if (nowiki !== undefined) {
          return this.#slot(escapeHtml(nowiki))
        }
        if (percent !== undefined) {
          return this.#slot(escapeHtml(percent))
        }
        if (embedTag === 'html') {
          return this.#slot(embedded)
        }
        if (embedTag === 'HTML') {
          return this.#blockSlot(embedded)
        }
        // -> PHP was run by DokuWiki, if `phpok` was on; here it can only be shown
        count(this.#losses.unsupported, 'php')
        return this.#blockSlot(
          `<pre><code class="language-php">${escapeHtml(embedded.trim())}</code></pre>`
        )
      }
    )
  }

  /** `<code lang file>` / `<file lang file>`: the language, and a file name shown above it. */
  #codeBlock(attrs: string, body: string): string {
    const [rawLanguage = '', fileName = ''] = attrs.trim().split(/\s+/)
    const lowered = rawLanguage.toLowerCase().replace(/^\[.*$/, '')
    const language = (CODE_LANGUAGES[lowered] ?? lowered).replace(/[^a-z0-9+#-]/g, '')
    const caption =
      fileName && !fileName.startsWith('[') ? `<p><strong>${escapeHtml(fileName)}</strong></p>` : ''
    // -> DokuWiki drops the line break straight after the opening tag and before the closing one
    const code = body.replace(/^[ \t]*\n/, '').replace(/\n[ \t]*$/, '')
    const cls = language ? ` class="language-${language}"` : ''
    return `${caption}<pre><code${cls}>${escapeHtml(code)}</code></pre>`
  }

  // ----------------------------------------------------------------------------------------------
  // Blocks
  // ----------------------------------------------------------------------------------------------

  /** Convert block-level text: containers first, then line by line. */
  blocks(text: string, top = false): string {
    const source = this.#containers(text).replace(
      /~~([A-Z_]+)(?::[^~\n]*)?~~/g,
      (_, name: string) => {
        if (!SILENT_MACROS.has(name)) {
          count(this.#losses.dynamic, name.toLowerCase())
        }
        return ''
      }
    )
    const lines = source.split('\n')
    const out: string[] = []
    let paragraph: string[] = []

    const emit = (html: string, heading: string | null = null) => {
      if (top && !this.#wroteBlock && heading !== null && this.#ctx.dropTitle) {
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
      const heading = /^[ \t]*(={2,})(.+?)={2,}[ \t]*$/s.exec(line)
      if (heading) {
        flush()
        const level = Math.max(1, 7 - Math.min(heading[1].length, 6))
        const textHtml = this.restore(escapeHtml(heading[2].trim()))
        const plain = textHtml
          .replace(/<[^>]*>/g, '')
          .replaceAll('&lt;', '<')
          .replaceAll('&gt;', '>')
          .replaceAll('&quot;', '"')
          .replaceAll('&amp;', '&')
          .trim()
        if (top && this.title === null && plain) {
          this.title = plain
        }
        emit(`<h${level}>${textHtml}</h${level}>`, plain)
        i++
        continue
      }
      if (/^[ \t]*-{4,}[ \t]*$/.test(line)) {
        flush()
        emit('<hr>')
        i++
        continue
      }
      if (isListLine(line)) {
        flush()
        const items: string[] = []
        while (i < lines.length && isListLine(lines[i])) {
          items.push(lines[i++])
        }
        emit(this.#list(items))
        continue
      }
      if (/^[|^]/.test(line)) {
        flush()
        const rows: string[] = []
        while (i < lines.length && /^[|^]/.test(lines[i])) {
          rows.push(lines[i++])
        }
        emit(this.#table(rows))
        continue
      }
      if (line.startsWith('>')) {
        flush()
        const quoted: string[] = []
        while (i < lines.length && lines[i].startsWith('>')) {
          quoted.push(lines[i++])
        }
        emit(this.#quote(quoted))
        continue
      }
      if (/^( {2,}|\t)/.test(line)) {
        flush()
        const code: string[] = []
        while (
          i < lines.length &&
          /^( {2,}|\t)/.test(lines[i]) &&
          !isListLine(lines[i]) &&
          !BLOCK_SLOT_LINE.test(lines[i])
        ) {
          code.push(lines[i++].replace(/^( {2}|\t)/, ''))
        }
        emit(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
        continue
      }
      paragraph.push(line)
      i++
    }
    flush()
    return out.join('\n')
  }

  /**
   * `<WRAP …>` and the `note` plugin's `<note …>`: an alert when the box was one, its content as it
   * stands when it was only layout (columns, a centred block). Converted from the inside out, each
   * one's body as blocks of its own. `<wrap>` in lowercase is the inline form, and is unwrapped.
   */
  #containers(text: string): string {
    let out = ''
    let rest = text
    const open = /<(WRAP|note)(\s[^>\n]*)?>/
    for (;;) {
      const match = open.exec(rest)
      if (!match) {
        return out + rest
      }
      const tag = match[1]
      const start = match.index
      const bodyStart = start + match[0].length
      const nested = new RegExp(`<${tag}(?:\\s[^>\\n]*)?>|</${tag}>`, 'g')
      nested.lastIndex = bodyStart
      let depth = 1
      let end = -1
      let close = -1
      for (let token = nested.exec(rest); token; token = nested.exec(rest)) {
        depth += token[0].startsWith('</') ? -1 : 1
        if (depth === 0) {
          end = token.index
          close = token.index + token[0].length
          break
        }
      }
      if (end < 0) {
        // -> Never closed: DokuWiki shows the tag as text, and so does this
        return out + rest
      }
      const body = this.blocks(rest.slice(bodyStart, end))
      const classes = (match[2] ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
      const kind =
        tag === 'note'
          ? (NOTE_KINDS[classes[0] ?? ''] ?? 'is-info')
          : (classes.map((name) => WRAP_KINDS[name]).find(Boolean) ?? null)
      out +=
        rest.slice(0, start) +
        this.#blockSlot(kind ? `<blockquote class="${kind}">${body}</blockquote>` : body)
      rest = rest.slice(close)
    }
  }

  #paragraph(lines: string[]): string {
    const html = this.#inline(lines.join('\n')).trim()
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
   * A run of list lines. Depth is the indent in pairs of spaces (a tab counts as two), and `-` is an
   * ordered item, `*` an unordered one. A list that jumps two levels at once nests one level here,
   * since there is nothing in between for the deeper one to belong to.
   */
  #list(lines: string[]): string {
    let html = ''
    const stack: Array<{ tag: string; depth: number }> = []
    for (const line of lines) {
      const match = /^([ \t]+)([*-])[ \t]*(.*)$/s.exec(line)!
      const depth = Math.floor(match[1].replaceAll('\t', '  ').length / 2)
      const tag = match[2] === '-' ? 'ol' : 'ul'
      while (stack.length > 0 && stack.at(-1)!.depth > depth) {
        html += `</li></${stack.pop()!.tag}>`
      }
      const top = stack.at(-1)
      if (top && top.depth === depth) {
        if (top.tag !== tag) {
          html += `</li></${stack.pop()!.tag}><${tag}>`
          stack.push({ tag, depth })
        } else {
          html += '</li>'
        }
      } else {
        html += `<${tag}>`
        stack.push({ tag, depth })
      }
      html += `<li>${this.#inline(match[3])}`
    }
    while (stack.length > 0) {
      html += `</li></${stack.pop()!.tag}>`
    }
    return html
  }

  /** Quoted lines, `>` per level. Lines of one level run on with a line break, as DokuWiki draws them. */
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
      const match = /^((?:>[ \t]*)+)(.*)$/s.exec(line)!
      const depth = (match[1].match(/>/g) ?? []).length
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
   * A table. `^` starts a header cell and `|` a normal one; a cell with nothing at all in it (`||`)
   * widens the one before it, and `:::` extends the one above it down. Two or more spaces on one side
   * of a cell's text align it to the other.
   *
   * Written as a plain HTML table with its spans: `htmlToMarkdown` makes it a markdown table when it can
   * be one, and keeps it as HTML when it cannot.
   */
  #table(lines: string[]): string {
    interface Cell {
      header: boolean
      html: string
      align: string
      colspan: number
      rowspan: number
      merged: boolean
    }
    const rows: Cell[][] = lines.map((line) => {
      const segments: Array<{ delimiter: string; text: string }> = []
      let depth = 0
      let current = ''
      let delimiter = ''
      for (let i = 0; i < line.length; i++) {
        const pair = line.slice(i, i + 2)
        if (pair === '[[' || pair === '{{') {
          depth++
          current += pair
          i++
          continue
        }
        if ((pair === ']]' || pair === '}}') && depth > 0) {
          depth--
          current += pair
          i++
          continue
        }
        const char = line[i]
        if (depth === 0 && (char === '|' || char === '^')) {
          if (delimiter) {
            segments.push({ delimiter, text: current })
          }
          delimiter = char
          current = ''
          continue
        }
        current += char
      }
      const cells: Cell[] = []
      for (const segment of segments) {
        if (segment.text === '' && cells.length > 0) {
          cells.at(-1)!.colspan++
          continue
        }
        const lead = /^ {2,}/.test(segment.text)
        const trail = / {2,}$/.test(segment.text)
        const content = segment.text.trim()
        cells.push({
          header: segment.delimiter === '^',
          html: content === ':::' ? '' : this.#inline(content),
          align: lead && trail ? 'center' : lead ? 'right' : trail ? 'left' : '',
          colspan: 1,
          rowspan: 1,
          merged: content === ':::'
        })
      }
      return cells
    })

    // -> Which cell each column belongs to so far, for a `:::` below it to extend
    const owners: Cell[] = []
    for (const row of rows) {
      let column = 0
      for (const cell of row) {
        if (cell.merged) {
          const owner = owners[column]
          if (owner) {
            owner.rowspan++
          }
          column += owner?.colspan ?? 1
          continue
        }
        for (let n = 0; n < cell.colspan; n++) {
          owners[column + n] = cell
        }
        column += cell.colspan
      }
    }

    const rowHtml = (row: Cell[]) =>
      `<tr>${row
        .filter((cell) => !cell.merged)
        .map((cell) => {
          const tag = cell.header ? 'th' : 'td'
          const attrs = [
            cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '',
            cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '',
            cell.align ? ` align="${cell.align}"` : ''
          ].join('')
          return `<${tag}${attrs}>${cell.html}</${tag}>`
        })
        .join('')}</tr>`
    const [first, ...others] = rows
    if (first && first.length > 0 && first.every((cell) => cell.header && !cell.merged)) {
      return `<table><thead>${rowHtml(first)}</thead><tbody>${others.map(rowHtml).join('')}</tbody></table>`
    }
    return `<table><tbody>${rows.map(rowHtml).join('')}</tbody></table>`
  }

  // ----------------------------------------------------------------------------------------------
  // Inline
  // ----------------------------------------------------------------------------------------------

  /**
   * Inline text: whatever must not be looked inside is lifted out first — footnotes, links, media,
   * addresses, URLs (whose `//` would otherwise be italics) — then the rest is escaped and its
   * formatting marks paired up. A mark with no partner is left as the characters it is.
   */
  #inline(text: string, { inLink = false } = {}): string {
    let s = text
    if (!inLink) {
      s = s.replace(/\(\(([\s\S]+?)\)\)/g, (_, body: string) => this.#footnote(body))
      s = s.replace(/\[\[([^\n]+?)\]\](?!\])/g, (_, body: string) => this.#slot(this.#link(body)))
    }
    s = s.replace(/\{\{([^\n]+?)\}\}/g, (_, body: string) => this.#media(body))
    // -> A link's label is never itself a link: DokuWiki shows an address there as the text it is
    if (!inLink) {
      s = s.replace(/<(nspages|catlist)\b([^>\n]*)>/gi, (_, name: string, args: string) =>
        this.#plugin(name.toLowerCase(), args.trim())
      )
      s = s.replace(/<([\w.+-]+@[\w-]+(?:\.[\w-]+)+)>/g, (_, address: string) =>
        this.#slot(`<a href="mailto:${escapeHtml(address)}">${escapeHtml(address)}</a>`)
      )
      s = s.replace(URL_PATTERN, (match: string) => {
        // -> Punctuation ending a sentence is not part of the address before it
        const url = match.replace(/[.,:;!?)]+$/, '')
        const tail = match.slice(url.length)
        const href = /^www\./i.test(url) ? `http://${url}` : url
        return this.#slot(`<a href="${escapeHtml(href)}">${escapeHtml(url)}</a>`) + tail
      })
    } else {
      s = s.replace(URL_PATTERN, (match: string) => this.#slot(escapeHtml(match)))
    }
    s = s.replace(/\\\\(?=[ \t]|\n|$)/g, () => this.#slot('<br>'))
    s = s.replace(/<\/?(?:sub|sup|del)>/g, (tag: string) => this.#slot(tag))
    s = s.replace(/<\/?wrap\b[^>\n]*>/gi, '')
    for (const [pattern, replacement] of ENTITIES) {
      s = s.replace(pattern, replacement)
    }
    s = escapeHtml(s)
    s = s.replace(/''([\s\S]+?)''/g, '<code>$1</code>')
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/\/\/([\s\S]+?)\/\//g, '<em>$1</em>')
    s = s.replace(/__([\s\S]+?)__/g, '<u>$1</u>')
    // -> A newline inside a paragraph is a space to DokuWiki; this wiki's renderer would draw a break
    return s.replace(/[ \t]*\n[ \t]*/g, ' ')
  }

  /**
   * `((…))`, numbered in order, written the way `markdown-it-footnote` renders one so that
   * `htmlToMarkdown` writes it back as `[^n]`.
   */
  #footnote(body: string): string {
    const n = this.#footnotes.push(this.#inline(body.trim()))
    return this.#slot(`<sup class="footnote-ref"><a href="#fn${n}" id="fnref${n}">[${n}]</a></sup>`)
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

  /** `[[target|label]]` — a page, a section, an external address, an interwiki shortcut. */
  #link(body: string): string {
    const bar = body.indexOf('|')
    const target = (bar < 0 ? body : body.slice(0, bar)).trim()
    const label = bar < 0 ? '' : this.#inline(body.slice(bar + 1).trim(), { inLink: true })
    const anchor = (href: string, fallback: string) =>
      `<a href="${escapeHtml(href)}">${label || escapeHtml(fallback)}</a>`

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target) || /^mailto:/i.test(target)) {
      return anchor(target, target)
    }
    if (/^www\./i.test(target)) {
      return anchor(`http://${target}`, target)
    }
    if (/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(target)) {
      return anchor(`mailto:${target}`, target)
    }
    if (target.startsWith('\\\\')) {
      // -> A Windows share opens from nowhere but the intranet it was written on, and no browser follows one
      this.#losses.unresolvedLinks++
      return label || escapeHtml(target)
    }
    const interwiki = /^([\w.-]+)>(.*)$/s.exec(target)
    if (interwiki) {
      return this.#interwiki(interwiki[1], interwiki[2], label)
    }

    const hash = target.indexOf('#')
    const pageTarget = hash < 0 ? target : target.slice(0, hash)
    const section = hash < 0 ? '' : target.slice(hash + 1)
    const fragment = section ? `#${slugifyHeading(section.replaceAll('_', ' '))}` : ''
    if (!pageTarget) {
      return anchor(fragment || '#', section)
    }
    const { id, isNamespace } = resolveId(this.#ns, pageTarget)
    const path = this.#pageHref(id, isNamespace)
    const fallback =
      (isNamespace ? null : this.#ctx.resolve.pageTitle(id)) ??
      (this.#ctx.resolve.namespace(id)?.title || null) ??
      (nameOf(id) || pageTarget).replaceAll('_', ' ')
    return anchor(`/${path === 'home' ? '' : path}${fragment}`, fallback)
  }

  /**
   * Where a page id is here. A namespace (`ns:`) is its start page; a page that does not exist but
   * names a namespace is that namespace's start page too, as DokuWiki resolves it. A page that never
   * existed — a link somebody wrote to create it — points at where it would be, so following it here
   * offers to create it in the right place.
   */
  #pageHref(id: string, isNamespace: boolean): string {
    const resolve = this.#ctx.resolve
    const ns = resolve.namespace(id)
    if (isNamespace) {
      if (ns) {
        return ns.home ?? ns.folder
      }
    } else {
      const found = resolve.pagePath(id) ?? resolve.pagePath(deaccented(id)) ?? ns?.home
      if (found) {
        return found
      }
    }
    this.#losses.missingPages++
    const parts = id.split(':').filter(Boolean)
    for (let n = parts.length - 1; n >= 0; n--) {
      const known = resolve.namespace(parts.slice(0, n).join(':'))
      if (known) {
        const rest = parts
          .slice(n)
          .map((part) => pathSegmentFromTitle(part.replaceAll('_', ' ')) || 'page')
        return [known.folder, ...rest].filter(Boolean).join('/') || 'home'
      }
    }
    return parts.map((part) => pathSegmentFromTitle(part) || 'page').join('/') || 'home'
  }

  /**
   * `[[wp>Page]]`, through the wiki's own interwiki map. A template with no placeholder has the name
   * appended, URL-encoded; `{URL}` is the name encoded and `{NAME}` as written. A template starting
   * with a colon (`user`) is a page of the wiki itself.
   */
  #interwiki(shortcut: string, reference: string, label: string): string {
    const template = this.#ctx.resolve.interwiki(shortcut.toLowerCase())
    const fallback = escapeHtml(reference || shortcut)
    if (!template) {
      this.#losses.unresolvedLinks++
      return label || fallback
    }
    const hash = reference.indexOf('#')
    const name = hash < 0 ? reference : reference.slice(0, hash)
    const fragment = hash < 0 ? '' : `#${encodeURIComponent(reference.slice(hash + 1))}`
    const filled = /\{(?:URL|NAME)\}/.test(template)
      ? template.replaceAll('{URL}', encodeURIComponent(name)).replaceAll('{NAME}', name)
      : template + encodeURIComponent(name)
    if (filled.startsWith(':')) {
      const { id } = resolveId('', filled)
      const path = this.#pageHref(id, false)
      return `<a href="/${escapeHtml(path === 'home' ? '' : path)}">${label || fallback}</a>`
    }
    return `<a href="${escapeHtml(filled + fragment)}">${label || fallback}</a>`
  }

  /**
   * `{{media?size|caption}}` — a picture where DokuWiki would show one, a link to the file otherwise.
   * Alignment (the spaces inside the braces) is DokuWiki's layout and is not kept. `{{name>…}}` is a
   * plugin's syntax rather than a file.
   */
  #media(body: string): string {
    const plugin = /^\s*(\w+)\s*>([\s\S]*)$/.exec(body)
    if (plugin) {
      return this.#plugin(plugin[1].toLowerCase(), plugin[2].trim())
    }
    const nspages = /^\s*nspages\b([\s\S]*)$/i.exec(body)
    if (nspages) {
      return this.#plugin('nspages', nspages[1].trim())
    }
    const bar = body.indexOf('|')
    const source = (bar < 0 ? body : body.slice(0, bar)).trim()
    const caption = bar < 0 ? '' : body.slice(bar + 1).trim()
    const ref = mediaRefOf(body)
    const params = source.length > ref.length ? source.slice(ref.length + 1).split('&') : []
    let width = ''
    let height = ''
    let linkOnly = false
    for (const param of params) {
      const size = /^(\d+)(?:x(\d+))?$/.exec(param)
      if (size) {
        width = size[1]
        height = size[2] ?? ''
      } else if (param === 'linkonly') {
        linkOnly = true
      }
    }

    const external = /^[a-z][a-z0-9+.-]*:\/\//i.test(ref)
    let href: string | null
    let name: string
    if (external) {
      href = ref
      name = ref
    } else {
      const { id } = resolveId(this.#ns, ref)
      href = this.#ctx.resolve.filePath(id) ?? this.#ctx.resolve.filePath(deaccented(id))
      name = nameOf(id) || ref
    }
    const extension = (/\.([a-z0-9]+)(?:$|\?)/i.exec(ref)?.[1] ?? '').toLowerCase()
    if (!href) {
      this.#losses.unresolvedLinks++
      // -> Raw, since the inline pass escapes what is left once every slot is lifted out
      return caption || name
    }
    if (IMAGE_EXTENSIONS.has(extension) && !linkOnly) {
      // -> A height alone is not something `markdown-it-imsize` keeps the aspect of, so it is sized by width
      return this.#slot(
        `<img src="${escapeHtml(href)}" alt="${escapeHtml(caption)}"${width ? ` width="${width}"` : ''}${width && height ? ` height="${height}"` : ''}>`
      )
    }
    return this.#slot(`<a href="${escapeHtml(href)}">${escapeHtml(caption || name)}</a>`)
  }

  /**
   * The tag plugin's `{{topic>[ns?]tags[&flags]}}`, a listing of the pages carrying some tags, as an
   * index of them. The flags after the first `&` choose which columns its table had (`nodate`,
   * `nouser`, …) and mean nothing to an index.
   *
   * The plugin lists a page carrying ANY of the plain tags, but only if it also carries every `+tag`
   * and none of the `-tag`s. An index lists the pages carrying ALL of its tags and cannot exclude
   * one, so several plain tags make one index each, every `+tag` is asked of all of them, and a
   * `-tag` is dropped. Narrowed to a namespace, it lists that namespace's folder and everything under
   * it — every level the index can reach.
   *
   * `null` when nothing is left to list by: the call then drops it as computed content.
   */
  #topic(args: string): string | null {
    const [query] = args.split('&')
    const mark = query.indexOf('?')
    const required: string[] = []
    const anyOf: string[] = []
    for (const word of tagWords(mark >= 0 ? query.slice(mark + 1) : query)) {
      const tag = tagName(word.replace(/^[-+]/, ''))
      if (!tag || word.startsWith('-')) {
        continue
      }
      ;(word.startsWith('+') ? required : anyOf).push(tag)
    }
    if (required.length + anyOf.length === 0) {
      return null
    }

    const scope = topicScope(args)
    let path = ''
    if (scope) {
      const { id } = resolveId(this.#ns, `${scope}:`)
      const ns = this.#ctx.resolve.namespace(id)
      const folder = ns ? ns.folder : this.#pageHref(id, true)
      path = folder === 'home' ? '' : folder
    }
    const lists =
      anyOf.length > 1 ? anyOf.map((tag) => [...required, tag]) : [[...required, ...anyOf]]
    // -> One slot for them all: a paragraph is a block only when a single slot is all it holds
    return this.#slot(
      lists
        .map(
          (tags) =>
            `<block-index path="${escapeHtml(path)}" tags="${escapeHtml(tags.join(','))}" depth="10" limit="100" columns="1"></block-index>`
        )
        .join('\n'),
      { block: true }
    )
  }

  /**
   * A plugin's own syntax. The tag plugin gives the page its tags; a listing of a namespace becomes an
   * index of its folder, and a listing of tags an index of those tags; a feed keeps its address; what
   * else DokuWiki computed is dropped; anything unknown leaves a line saying what stood there.
   */
  #plugin(name: string, args: string): string {
    if (name === 'tag') {
      for (const tag of tagWords(args)) {
        const value = tagName(tag)
        if (value) {
          this.tags.push(value)
        }
      }
      return ''
    }
    if (name === 'topic') {
      const listing = this.#topic(args)
      if (listing) {
        return listing
      }
    }
    if (NAMESPACE_LISTINGS.has(name)) {
      const token = args.split(/[|#\s]/)[0] ?? ''
      const { id } = resolveId(this.#ns, `${token || '.'}:`)
      const ns = this.#ctx.resolve.namespace(id)
      const folder = ns ? ns.folder : this.#pageHref(id, true)
      return this.#slot(
        `<block-index path="${escapeHtml(folder === 'home' ? '' : folder)}" depth="0" limit="100" columns="1"></block-index>`,
        { block: true }
      )
    }
    if (name === 'rss') {
      count(this.#losses.dynamic, name)
      const url = args.split(/\s+/)[0] ?? ''
      return /^https?:\/\//i.test(url)
        ? this.#slot(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`)
        : ''
    }
    if (DYNAMIC_PLUGINS.has(name) || name === 'topic') {
      count(this.#losses.dynamic, name)
      return ''
    }
    count(this.#losses.unsupported, name)
    return this.#slot(`<em>[The DokuWiki plugin "${escapeHtml(name)}" could not be imported.]</em>`)
  }
}

/**
 * The words of a tag list, as the tag plugin's `parseTagList` reads one: split on spaces, except
 * inside a `"quoted phrase"`, which is one tag.
 */
function tagWords(list: string): string[] {
  return [...list.matchAll(/"([^"]*)"|(\S+)/g)].map((match) =>
    match[1] !== undefined ? match[1].trim().replace(/\s+/g, '_') : match[2]
  )
}

/** A tag as it is called here: its last `:` part, with the underscores DokuWiki writes for spaces as spaces. */
function tagName(word: string): string {
  return word.replaceAll('"', '').split(':').pop()!.replaceAll('_', ' ').trim()
}

/**
 * The namespace a `{{topic>ns?tags}}` is narrowed to, as written — `null` for the whole wiki, which is
 * what no `?`, `*` and `:` all mean.
 */
function topicScope(args: string): string | null {
  const query = args.split('&')[0]
  const mark = query.indexOf('?')
  const scope = mark >= 0 ? query.slice(0, mark).trim() : ''
  return scope && scope !== '*' && scope !== ':' ? scope : null
}

function isListLine(line: string): boolean {
  return /^( {2,}|\t+)[*-]/.test(line)
}
