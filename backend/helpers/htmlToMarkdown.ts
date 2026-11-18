import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import {
  highlightedCodeBlock,
  strikethrough,
  tables,
  taskListItems
} from '@joplin/turndown-plugin-gfm'

import type { AnyNode, Element } from 'domhandler'

/**
 * HTML → markdown: for a page 2.x wrote in an editor 3.x does not have (`models/import.ts`), and for
 * an agent reading a page whose source it may not see (`mcp/content.ts`), which gets the stored
 * render back as what a reader sees, in the form a model reads best.
 *
 * Turndown with the GitHub-flavoured rules (the Joplin fork, which is maintained where the original is
 * not), and the plugin is not optional: a WYSIWYG page is mostly tables, and plain Turndown has no
 * rule for one — it would flatten a table to a run of loose text and nobody would notice until they
 * opened the page.
 *
 * Turndown escapes what CommonMark reads as markup and nothing more, so the markup the wiki's own
 * renderer adds on top is escaped here as well (`escapeWikiMarkdown`). Without it, text that was
 * plain in the HTML comes out of the 3.x renderer changed: a `&lt;pool&gt;` becomes an HTML tag and
 * vanishes, a MAC address loses the part that reads as an `:icon:`. A bare URL is the one piece of
 * text no escaping can get right, so it is made a link first (`linkBareUrls`).
 *
 * Built once. The service holds only its rules, so the same instance converts every page rather than
 * being rebuilt per call.
 */
let turndown: TurndownService | null = null

/**
 * What a conversion could not carry over, for a caller that reports it. Filled in by `htmlToMarkdown`
 * when one is passed.
 */
export interface ConversionLosses {
  /** The formatting dropped from inside code, inline or a block, by name: `bold`, `link`, … */
  codeFormatting: Set<string>
}

/**
 * Formatting an element inside code stood for, by tag, as the import log names it. A tag that is not
 * here (`span`, `font`) carried nothing a reader saw as formatting, so dropping it is not reported.
 */
const CODE_FORMATTING: Record<string, string> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  s: 'strikethrough',
  del: 'strikethrough',
  strike: 'strikethrough',
  mark: 'highlight',
  sub: 'subscript',
  sup: 'superscript',
  a: 'link'
}

export function htmlToMarkdown(html: string, report?: ConversionLosses): string {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      /*
        Turndown hands an element with no text to this and to no rule at all — and a page index has
        no text by design, so its rule below would never be asked. Everything else blank is what
        Turndown's own default makes of it.
      */
      blankReplacement: (_content, node) =>
        node.nodeName.toLowerCase() === 'block-index'
          ? blockIndexMarkdown(node)
          : (node as unknown as { isBlock: boolean }).isBlock
            ? '\n\n'
            : ''
    }).use([highlightedCodeBlock, strikethrough])
    // -> `gfm` is these four in this order, which matters since a later rule wins a node. Spelled out
    //    so that the table rules can be handed a service of their own (`withTableRowSnapshots`).
    tables(withTableRowSnapshots(turndown))
    turndown.use(taskListItems)

    /*
      Inline code, from the element's text rather than its converted children. Turndown's own rule
      takes the children's markdown, so `<code><strong>x</strong></code>` came out as `**x**` — and
      inside a code span that is the asterisks themselves, on the page. A code span holds no formatting,
      so what is lost is the bold and not the text (`noteCodeFormatting`). The filter and the delimiter
      logic are Turndown's.
    */
    turndown.addRule('code', {
      filter: (node) =>
        node.nodeName === 'CODE' &&
        !(node.parentNode?.nodeName === 'PRE' && !node.previousSibling && !node.nextSibling),
      replacement: (_content, node) => {
        const code = (node.textContent ?? '').replace(/\r?\n|\r/g, ' ')
        if (!code) {
          return ''
        }
        const extraSpace = /^`|^ .*?[^ ].* $|`$/.test(code) ? ' ' : ''
        const runs = code.match(/`+/g) ?? []
        let delimiter = '`'
        while (runs.includes(delimiter)) {
          delimiter += '`'
        }
        return delimiter + extraSpace + code + extraSpace + delimiter
      }
    })

    const escape = turndown.escape.bind(turndown)
    turndown.escape = (text) => escapeWikiMarkdown(escape(text))

    addWikiRules(turndown)
  }
  const $ = cheerio.load(html, null, false)
  if (report) {
    noteCodeFormatting($, report)
  }
  liftAlertTitles($)
  unspanTables($)
  linkBareUrls($)
  return turndown.turndown($.html())
}

/**
 * The admonition classes the content stylesheet draws, and the alert marker each one is written as —
 * the inverse of `KINDS` in the frontend's `renderers/modules/github-alerts.js`, with the label it
 * draws when the alert has no title of its own.
 */
const ALERT_KINDS: Record<string, { marker: string; label: string }> = {
  'is-info': { marker: 'NOTE', label: 'Note' },
  'is-success': { marker: 'TIP', label: 'Tip' },
  'is-important': { marker: 'IMPORTANT', label: 'Important' },
  'is-warning': { marker: 'WARNING', label: 'Warning' },
  'is-danger': { marker: 'CAUTION', label: 'Caution' }
}

/**
 * The inline blocks (`blocks/CLAUDE.md`), whose element is written back as `:block-name[value]{…}`.
 * Only these: a container block's body is markdown of its own and has no inline form.
 */
const INLINE_BLOCKS = new Set([
  'block-badge',
  'block-color',
  'block-kbd',
  'block-progress',
  'block-timestamp',
  'block-unit'
])

/** The little of a DOM element the rules below read. The backend has no DOM lib to name it from. */
interface DomElement {
  getAttribute(name: string): string | null
  querySelector(selector: string): { textContent: string | null } | null
  attributes: ArrayLike<{ name: string; value: string }>
  textContent: string | null
}

function elementOf(node: TurndownService.Node): DomElement {
  return node as unknown as DomElement
}

function alertKindOf(node: TurndownService.Node): string | null {
  const classes = (elementOf(node).getAttribute('class') ?? '').split(/\s+/)
  return classes.find((name) => ALERT_KINDS[name]) ?? null
}

/** Attributes as the HTML parser Turndown runs on hands them out. */
function attributesOf(node: TurndownService.Node): Array<{ name: string; value: string }> {
  return Array.from(elementOf(node).attributes ?? [])
}

/**
 * What the wiki's markdown has syntax for and plain HTML spells another way: an alert, a disclosure,
 * an inline block and an image's size. Each is the inverse of what the renderer draws, so a render
 * converted back to markdown — an agent reading a page — gets the source an author would have written,
 * and so does HTML written to look like it (Import from Confluence).
 */
function addWikiRules(service: TurndownService): void {
  /*
    An admonition, as `> [!NOTE] Title`. The title has been lifted onto the element by
    `liftAlertTitles`, since by the time this runs the paragraph that held it would already be part of
    the converted body.
  */
  service.addRule('alert', {
    filter: (node) => node.nodeName === 'BLOCKQUOTE' && alertKindOf(node) !== null,
    replacement: (content, node) => {
      const kind = ALERT_KINDS[alertKindOf(node)!]
      const title = (elementOf(node).getAttribute('data-alert-title') ?? '').trim()
      const marker = `[!${kind.marker}]${title && title !== kind.label ? ` ${service.escape(title)}` : ''}`
      const body = content.replace(/^\n+|\n+$/g, '')
      const lines = [marker, ...(body ? body.split('\n') : [])]
      return `\n\n${lines.map((line) => (line ? `> ${line}` : '>')).join('\n')}\n\n`
    }
  })

  /*
    A disclosure stays HTML, since markdown has none — but only its two tags do. The body between them
    is markdown, which the renderer parses as such because an HTML block ends at the blank line after
    `<summary>`.
  */
  service.addRule('details', {
    filter: 'details',
    replacement: (content, node) => {
      const summary = elementOf(node).querySelector('summary')
      const label = (summary?.textContent ?? '').trim()
      const escaped = label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      return `\n\n<details>\n<summary>${escaped}</summary>\n\n${content.trim()}\n\n</details>\n\n`
    }
  })
  service.addRule('summary', { filter: 'summary', replacement: () => '' })

  service.addRule('inlineBlock', {
    filter: (node) => INLINE_BLOCKS.has(node.nodeName.toLowerCase()),
    replacement: (_content, node) => {
      const value = (node.textContent ?? '').replace(/[\\\]]/g, '\\$&')
      // -> MDC has no escape for a double quote in an attribute, so it becomes a single one, as the
      //    visual editor writes it
      const attrs = attributesOf(node)
        .filter((attr) => attr.value !== '')
        .map((attr) => `${attr.name}="${attr.value.replaceAll('"', "'")}"`)
      return `:${node.nodeName.toLowerCase()}[${value}]${attrs.length > 0 ? `{${attrs.join(' ')}}` : ''}`
    }
  })

  /*
    Tabs, as the fences `::block-tabs` is written with: three colons round the set, since its panels
    are blocks of their own, and two round each panel, whose body is markdown. With the index below,
    the only blocks written back: the one whose render is all light DOM with nothing drawn in between,
    and one with no body to lose.
  */
  service.addRule('blockTabs', {
    filter: (node) => node.nodeName.toLowerCase() === 'block-tabs',
    replacement: (content) => `\n\n:::block-tabs\n${content.trim()}\n:::\n\n`
  })
  service.addRule('blockTab', {
    filter: (node) => node.nodeName.toLowerCase() === 'block-tab',
    replacement: (content, node) => {
      const attrs = attributesOf(node)
        .filter((attr) => attr.value !== '')
        .map((attr) => `${attr.name}="${attr.value.replaceAll('"', "'")}"`)
      const suffix = attrs.length > 0 ? `{${attrs.join(' ')}}` : ''
      return `\n\n::block-tab${suffix}\n${content.trim()}\n::\n\n`
    }
  })

  /*
    A page index, which has no body at all: the block reads everything from its props. Written as
    the visual editor writes an atom block, with the closing fence on the next line.
  */
  service.addRule('blockIndex', {
    filter: (node) => node.nodeName.toLowerCase() === 'block-index',
    replacement: (_content, node) => blockIndexMarkdown(node)
  })

  /*
    An image, with its width as `markdown-it-imsize` writes one — after the title, as the visual
    editor's serializer explains. Without this a picture somebody sized to fit the page comes back at
    its full width.
  */
  service.addRule('image', {
    filter: 'img',
    replacement: (_content, node) => {
      const el = elementOf(node)
      const src = el.getAttribute('src') ?? ''
      if (!src) {
        return ''
      }
      const alt = service.escape(el.getAttribute('alt') ?? '')
      const title = el.getAttribute('title')
      const width = /^\d+$/.test(el.getAttribute('width') ?? '') ? el.getAttribute('width') : ''
      const height = /^\d+$/.test(el.getAttribute('height') ?? '') ? el.getAttribute('height') : ''
      const destination = /\s/.test(src) ? `<${src}>` : src.replace(/[()]/g, '\\$&')
      const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : ''
      const size = width || height ? ` =${width}x${height}` : ''
      return `![${alt}](${destination}${titlePart}${size})`
    }
  })

  /*
    Sub- and superscript, as `markdown-it-sub` and `markdown-it-sup` write them. Neither reads a space
    inside unless it is escaped. Without these the tags were dropped and `H<sub>2</sub>O` read `H2O`.
  */
  for (const [tag, mark] of [
    ['sub', '~'],
    ['sup', '^']
  ] as const) {
    service.addRule(tag, {
      filter: tag,
      replacement: (content) => {
        const text = content.trim()
        return text ? `${mark}${text.replace(/\s+/g, '\\ ')}${mark}` : ''
      }
    })
  }

  /*
    Footnotes, as `markdown-it-footnote` renders them: a reference is a `<sup class="footnote-ref">`
    (added after the superscript rule, so it wins the node), and the notes are a list at the end
    behind a rule of their own, each with a link back. Written back as `[^n]` and `[^n]: …`, a note's
    later lines indented under it. Import from DokuWiki writes its `((…))` notes in this shape.
  */
  service.addRule('footnoteRef', {
    filter: (node) => node.nodeName === 'SUP' && hasClass(node, 'footnote-ref'),
    replacement: (_content, node) => {
      const label = (node.textContent ?? '').replace(/^\[|\]$/g, '').replace(/:\d+$/, '')
      return label ? `[^${label}]` : ''
    }
  })
  service.addRule('footnoteItem', {
    filter: (node) => node.nodeName === 'LI' && hasClass(node, 'footnote-item'),
    replacement: (content, node) => {
      const label = /^fn(.+)$/.exec(elementOf(node).getAttribute('id') ?? '')?.[1] ?? ''
      const [first = '', ...rest] = content.trim().split('\n')
      const body = [first, ...rest.map((line) => (line ? `    ${line}` : ''))].join('\n')
      return `\n\n[^${label}]: ${body}\n\n`
    }
  })
  service.addRule('footnoteChrome', {
    filter: (node) =>
      (node.nodeName === 'HR' && hasClass(node, 'footnotes-sep')) ||
      (node.nodeName === 'A' && hasClass(node, 'footnote-backref')),
    replacement: () => ''
  })
}

function hasClass(node: TurndownService.Node, name: string): boolean {
  return (elementOf(node).getAttribute('class') ?? '').split(/\s+/).includes(name)
}

/** A page index as markdown: the block's fences, with its props and no body. */
function blockIndexMarkdown(node: TurndownService.Node): string {
  const attrs = attributesOf(node)
    .filter((attr) => attr.value !== '')
    .map((attr) => `${attr.name}="${attr.value.replaceAll('"', "'")}"`)
  return `\n\n::block-index${attrs.length > 0 ? `{${attrs.join(' ')}}` : ''}\n::\n\n`
}

/**
 * Move an alert's title paragraph onto the alert itself, where the `alert` rule reads it. The
 * renderer writes the title as the first paragraph of the quote, classed `alert-title`.
 */
function liftAlertTitles($: cheerio.CheerioAPI): void {
  $('blockquote > p.alert-title:first-child').each((_, element) => {
    const title = $(element)
    title.parent().attr('data-alert-title', title.text())
    title.remove()
  })
}

/**
 * Write every merged cell out as the cells it covered, the first holding its content and the rest
 * empty.
 *
 * A markdown table has no spans, and the table rule writes each `<td>` it finds as one cell — so a
 * cell spanning two columns left its row a cell short, and one spanning two rows left every row
 * below it a cell short at that point, which shifts the rest of the row into the wrong columns. Laid
 * out on the grid first, each row has every column and its text stays under its heading; only the
 * merging is lost.
 */
function unspanTables($: cheerio.CheerioAPI): void {
  $('table').each((_, table) => {
    const own = (el: AnyNode) => $(el).closest('table')[0] === table
    if (
      $(table)
        .find('[colspan], [rowspan]')
        .filter((_, el) => own(el)).length < 1
    ) {
      return
    }
    const pending: Array<{ left: number; tag: string } | undefined> = []
    $(table)
      .find('tr')
      .filter((_, tr) => own(tr))
      .each((_, tr) => {
        const cells = $(tr).children('th, td').toArray()
        const out: Array<AnyNode | string> = []
        let column = 0
        const fill = () => {
          for (let held = pending[column]; held && held.left > 0; held = pending[column]) {
            out.push(`<${held.tag}></${held.tag}>`)
            held.left--
            column++
          }
        }
        for (const cell of cells) {
          fill()
          const tag = (cell as Element).name
          const colspan = Math.max(1, Number.parseInt($(cell).attr('colspan') ?? '1', 10) || 1)
          const rowspan = Math.max(1, Number.parseInt($(cell).attr('rowspan') ?? '1', 10) || 1)
          $(cell).removeAttr('colspan').removeAttr('rowspan')
          out.push(cell)
          for (let n = 1; n < colspan; n++) {
            out.push(`<${tag}></${tag}>`)
          }
          for (let n = 0; n < colspan; n++) {
            pending[column + n] = rowspan > 1 ? { left: rowspan - 1, tag } : undefined
          }
          column += colspan
        }
        fill()
        $(tr).empty()
        for (const piece of out) {
          $(tr).append(piece as any)
        }
      })
  })
}

/** The plugin's rules that read a table's `rows`, by the key it adds them under. */
const ROW_READING_RULES = new Set(['tableCell', 'tableRow', 'table'])

/**
 * The service as the table rules see it, with each table's rows read once rather than on every look.
 *
 * The rules ask a table for `rows` inside their loops — per column, to vote on its alignment, and
 * per row inside that — and in domino, which Turndown parses with on Node, `rows` is a fresh
 * `getElementsByTagName('tr')` that walks the whole table each time it is read. A table cost columns
 * × rows × cells: a 3000-row table took over a minute, on the main thread, during which the server
 * answered nothing.
 *
 * So before any of those rules runs, the table gets its rows as a plain array of its own, which
 * shadows the getter. Nothing changes the tree while Turndown converts it, so the snapshot cannot go
 * stale. Done through the plugin's `addRule` calls rather than by reaching into Turndown's rule list,
 * which is not public.
 */
function withTableRowSnapshots(service: TurndownService): TurndownService {
  return Object.create(service, {
    addRule: {
      value: (key: string, rule: TurndownService.Rule) => {
        if (!ROW_READING_RULES.has(key)) {
          return service.addRule(key, rule)
        }
        const replacement = rule.replacement!
        return service.addRule(key, {
          ...rule,
          replacement(content, node, options) {
            snapshotRows(node as unknown as TableTreeNode)
            return replacement.call(this, content, node, options)
          }
        })
      }
    }
  })
}

/** The little of a domino node `snapshotRows` reads. The backend has no DOM lib to name it from. */
interface TableTreeNode {
  nodeName: string
  parentNode: TableTreeNode | null
  rows?: ArrayLike<unknown>
}

/** Give the table a node sits in its rows as an array of its own, once. */
function snapshotRows(node: TableTreeNode): void {
  let table: TableTreeNode | null = node
  while (table && table.nodeName !== 'TABLE') {
    table = table.parentNode
  }
  if (table?.rows && !Object.hasOwn(table, 'rows')) {
    Object.defineProperty(table, 'rows', { value: Array.from(table.rows) })
  }
}

/**
 * The formatting the conversion will drop from inside code. Neither a code span nor a fenced block can
 * hold any — Turndown writes a block from its text, as the rule above does a span — so the text
 * survives and the bold, the strikethrough or the link around part of it does not. Reported so that
 * whoever ran the import knows which pages to look at.
 */
function noteCodeFormatting($: cheerio.CheerioAPI, report: ConversionLosses): void {
  $('code *').each((_, element) => {
    const name = CODE_FORMATTING[element.tagName.toLowerCase()]
    if (name) {
      report.codeFormatting.add(name)
    }
  })
}

/**
 * A URL standing in the text. Its end is then trimmed back to where linkify would end it
 * (`linkBareUrls`): not on trailing punctuation, and not on a closing parenthesis it did not open.
 */
const BARE_URL = /\b[a-z][a-z\d+.-]{1,31}:\/\/[^\s<>"]+/gi
const URL_TAIL = /[.,;:!?'"*_~]$/

/** Elements whose text is not ordinary text, or is a link already. */
const NOT_LINKED = new Set(['a', 'code', 'pre', 'script', 'style', 'textarea'])

/**
 * Every bare URL in the text made a link to itself, `[https://…](https://…)`.
 *
 * A URL left as text is written right for one setting of the site's `linkify` and wrong for the other,
 * and an administrator can change it after the import. With it on, markdown-it takes the URL from the
 * SOURCE, so any escape inside it is on the page: `https://example.com/some\_page`. With it off, the
 * same URL unescaped is ordinary text, where the `:b:` in `/a:b:c` is an emoji. A link's text is
 * escaped like any other and never linkified, so it reads the same either way — and it is the link
 * that linkify would have made of it.
 */
function linkBareUrls($: cheerio.CheerioAPI): void {
  const texts: Array<AnyNode & { data: string }> = []
  const collect = (node: AnyNode) => {
    if (node.type === 'text') {
      texts.push(node)
    } else if ('children' in node && !('name' in node && NOT_LINKED.has(node.name))) {
      node.children.forEach(collect)
    }
  }
  $.root()
    .contents()
    .each((_, node) => collect(node))

  const escapeText = (text: string) => $('<i>').text(text).html() ?? ''
  for (const node of texts) {
    let out = ''
    let last = 0
    for (const match of node.data.matchAll(BARE_URL)) {
      let url = match[0]
      for (;;) {
        if (URL_TAIL.test(url)) {
          url = url.slice(0, -1)
        } else if (url.endsWith(')') && url.split('(').length < url.split(')').length) {
          url = url.slice(0, -1)
        } else {
          break
        }
      }
      out +=
        escapeText(node.data.slice(last, match.index)) +
        $.html($('<a>').attr('href', url).text(url))
      last = match.index + url.length
    }
    if (last > 0) {
      $(node).replaceWith(out + escapeText(node.data.slice(last)))
    }
  }
}

/**
 * The emoticons `markdown-it-emoji` turns into an emoji: its `lib/data/shortcuts.mjs`, which the
 * visual editor imports and the backend, without the package, copies.
 */
const EMOTICONS = [
  '>:(',
  '>:-(',
  ':")',
  ':-")',
  '</3',
  ':/',
  ':-/',
  ":'(",
  ":'-(",
  ':,(',
  ':,-(',
  ':(',
  ':-(',
  '<3',
  ']:(',
  ']:-(',
  'o:)',
  'O:)',
  'o:-)',
  'O:-)',
  '0:)',
  '0:-)',
  ":')",
  ":'-)",
  ':,)',
  ':,-)',
  ":'D",
  ":'-D",
  ':,D',
  ':,-D',
  ':*',
  ':-*',
  'x-)',
  'X-)',
  ':|',
  ':-|',
  ':o',
  ':-o',
  ':O',
  ':-O',
  ':@',
  ':-@',
  ':D',
  ':-D',
  ':)',
  ':-)',
  ']:)',
  ']:-)',
  ":,'(",
  ":,'-(",
  ';(',
  ';-(',
  ':P',
  ':-P',
  '8-)',
  'B-)',
  ',:(',
  ',:-(',
  ',:)',
  ',:-)',
  ':s',
  ':-S',
  ':z',
  ':-Z',
  ':$',
  ':-$',
  ';)',
  ';-)'
]

/** Where the emoji plugin lets an emoticon start or end: not against a letter or a digit. */
const EMOTICON_EDGE = String.raw`(?:^|$|[\p{Z}\p{P}\p{Cc}])`

/**
 * An emoticon, as the one character in it to escape: the last punctuation, which leaves no shorter
 * emoticon on either side of the backslash. An escaped character before it counts as an edge, since
 * markdown-it ends the text token there — and its own boundary rule is what keeps the `:/` in
 * `https://` a URL.
 */
function emoticonPattern(emoticon: string): string {
  const at = emoticon.search(/[^\p{L}\p{N}][\p{L}\p{N}]*$/u)
  const quote = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (
    String.raw`(?<=(?:${EMOTICON_EDGE}|\\[!-/:-@[-${'`'}{-~])${quote(emoticon.slice(0, at))})` +
    `${quote(emoticon[at])}(?=${quote(emoticon.slice(at + 1))}${EMOTICON_EDGE})`
  )
}

/**
 * Every character in a text node's markdown that the wiki's renderer
 * (`frontend/src/renderers/markdown.js`) would read as markup when CommonMark would not, one character
 * per match. Kept in step with `ESCAPE_EXTRA` in the visual editor's serializer
 * (`frontend/src/editor/visual/serialize.js`), which has to write the same text the same way: a page
 * converted here is edited there.
 *
 * Each rule is limited to the cases that would be read as markup, so the source is not littered with
 * backslashes a reader of it has to look past. And none of them matches a character already escaped
 * (an odd run of backslashes before it): escaping it again would escape the BACKSLASH and leave the
 * character bare, and Turndown escapes some of the same characters (`]`, `*`) first.
 */
const WIKI_MARKUP = new RegExp(
  String.raw`(?<!(?<!\\)\\(?:\\\\)*)(?:` +
    [
      // -> Raw HTML (`<pool>`, `</div>`, a comment) and autolinks, which `allowHTML` renders as such
      '<(?=[a-z0-9/!?])',
      // -> An entity, which would be shown as the character it names
      '&(?=#?[a-z0-9]+;)',
      // -> Every colon that opens an `:emoji:` or `:set:icon:` shortcode, since `:mdi\:home:` still
      //    holds the `:home:` emoji — and a MAC address is a row of them
      String.raw`:(?=[\w+-]+:)`,
      // -> `~sub~` and `~~strike~~`, `^sup^`, `==mark==`
      '[~^]',
      '=(?==)',
      // -> A `{.class}` / `{#id}` attribute block, for `markdown-it-attrs`
      String.raw`\{(?=[^{}]*\})`,
      // -> An MDC block (`::name`, `:::`) or a definition list's `: `, at the start of a line
      String.raw`(?<=^\s*):(?=:|\s)`,
      ...EMOTICONS.map(emoticonPattern)
    ].join('|') +
    ')',
  'giu'
)

/** A text node's markdown, as Turndown escaped it, escaped for what the wiki reads beyond CommonMark. */
function escapeWikiMarkdown(text: string): string {
  return (
    text
      // -> Turndown escapes every `_`. One between two letters or digits can never open or close
      //    emphasis, so the backslash is only noise in the source.
      .replace(/(?<=[\p{L}\p{N}])\\_(?=[\p{L}\p{N}])/gu, '_')
      .replace(WIKI_MARKUP, '\\$&')
  )
}
