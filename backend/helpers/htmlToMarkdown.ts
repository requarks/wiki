import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'

import type { AnyNode } from 'domhandler'

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
      emDelimiter: '*'
    }).use(gfm)

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
  }
  const $ = cheerio.load(html, null, false)
  if (report) {
    noteCodeFormatting($, report)
  }
  linkBareUrls($)
  return turndown.turndown($.html())
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
