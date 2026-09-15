import { Schema } from 'prosemirror-model'
import { tableNodes } from 'prosemirror-tables'

import { KINDS } from '@/renderers/modules/github-alerts'

/**
 * The document model the Visual editor edits.
 *
 * Every node here exists because some markdown the site's pipeline understands has to survive being
 * opened and saved again. That is the whole design brief: the source is markdown, this is a view of
 * it, and a construct with no node of its own would be silently rewritten into something else the
 * next time an author pressed Save.
 *
 * So the schema is not "what a rich text editor offers" — it is `renderers/markdown.js` read
 * backwards. Where the two disagree the renderer wins, because the renderer is what produces the page
 * a reader sees.
 *
 * Two conventions run through all of it:
 *
 * - **`mdAttrs`** is the `{#id .class target=…}` suffix `markdown-it-attrs` reads off the end of a
 *   block. It is kept as a plain object of the three attributes that plugin is configured to allow,
 *   and written back out in a fixed order, which is why converting a page normalises the spacing
 *   inside those braces.
 * - **`markup`** is the character the author actually used where markdown offers a choice — `-` or
 *   `*` for a bullet, `_` or `*` for emphasis. Dropping it would be a diff on every line of a list
 *   that happened to be written the other way.
 *
 * `toDOM` here is what the *editor* draws, not what the page shows: the page is rendered from the
 * markdown by the real pipeline. Where the two can cheaply agree they do, so that the content
 * stylesheet makes the editor look like the page.
 */

/** The attributes `markdown-it-attrs` is allowed to read, in the order they are written back. */
export const MD_ATTR_NAMES = ['id', 'class', 'target']

/**
 * Blocks that may carry a `{…}` suffix, as a spec fragment to spread into their `attrs`.
 *
 * Null rather than an empty object for "nothing was written", so that a block nobody classed
 * serialises with no braces at all rather than with an empty pair.
 */
const mdAttrs = { mdAttrs: { default: null } }

/**
 * Turn a markdown-it token's attribute list into what `mdAttrs` holds.
 *
 * Only the three names the plugin is configured for: anything else on the token was put there by the
 * renderer rather than by the author — the alert rule's `is-warning`, the task list plugin's
 * `contains-task-list` — and writing those back would be the editor inventing source the author never
 * typed.
 *
 * The order the token lists them in is kept, because it is the order they were written in and
 * `writeMdAttrs` puts them back the same way. Sorting them into a canonical order instead would
 * rewrite `{.cls #x}` as `{#x .cls}` on every page that happened to use the other one.
 *
 * @param {{ attrs?: Array<[string, string]> }} token A markdown-it token, or anything with its
 *        `attrs` shape.
 * @param {string[]} [skipClasses] Classes the renderer added, which are not the author's to keep.
 * @returns {object|null} The attributes, or null when there are none worth writing.
 */
export function readMdAttrs(token, skipClasses = []) {
  const out = {}
  for (const [name, raw] of token?.attrs ?? []) {
    if (!MD_ATTR_NAMES.includes(name) || raw === null || raw === undefined || raw === '') {
      continue
    }
    let value = raw
    if (name === 'class' && skipClasses.length > 0) {
      value = value
        .split(/\s+/)
        .filter((entry) => entry && !skipClasses.includes(entry))
        .join(' ')
      if (!value) {
        continue
      }
    }
    out[name] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * The `{…}` suffix for a set of attributes, the empty string when there are none.
 *
 * `#id` and `.class` use the shorthands, because that is what an author writes and what the editor's
 * own insert paths produce; anything else is written out as a pair. A class list becomes one `.name`
 * per class, which is how `markdown-it-attrs` reads it back. Written in the object's own key order,
 * which `readMdAttrs` took from the source.
 */
export function writeMdAttrs(attrs) {
  if (!attrs) {
    return ''
  }
  const parts = []
  for (const [name, value] of Object.entries(attrs)) {
    if (!value) {
      continue
    }
    if (name === 'id') {
      parts.push(`#${value}`)
    } else if (name === 'class') {
      for (const entry of String(value).split(/\s+/).filter(Boolean)) {
        parts.push(`.${entry}`)
      }
    } else {
      // -> Quoted, which is what the Markdown editor and `helpers/blocks.js` both write: unquoted
      //    parses back the same, but the two editors saving one page should not disagree about it
      parts.push(`${name}="${String(value).replaceAll('"', "'")}"`)
    }
  }
  return parts.length > 0 ? `{${parts.join(' ')}}` : ''
}

/**
 * The alert kinds, taken from the plugin that defines them so the two cannot drift.
 *
 * The editor draws an alert with the class the rendered page will carry, which is what makes the
 * content stylesheet dress both the same way — see `renderers/modules/github-alerts.js` for why those
 * classes are the admonition ones rather than a set of its own.
 */
export const ALERT_KINDS = Object.fromEntries(
  [...KINDS].map(([kind, spec]) => [kind, spec.className])
)

const tables = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    /*
      Which way the column is set, as markdown says it: the colons in the delimiter row. It belongs to
      the column rather than to the cell, but markdown-it puts it on every cell as a `style` attribute
      and the serialiser reads it back off the first row, so this is where it can be kept without a
      second structure to hold a table's columns.
    */
    align: {
      default: null,
      getFromDOM: (dom) => dom.style.textAlign || null,
      setDOMAttr: (value, attrs) => {
        if (value) {
          attrs.style = `${attrs.style ?? ''}text-align: ${value};`
        }
      }
    }
  }
})

export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },

    paragraph: {
      content: 'inline*',
      group: 'block',
      attrs: { ...mdAttrs },
      parseDOM: [{ tag: 'p' }],
      toDOM: (node) => ['p', domAttrs(node), 0]
    },

    heading: {
      content: 'inline*',
      group: 'block',
      defining: true,
      attrs: { level: { default: 1 }, ...mdAttrs },
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
      toDOM: (node) => [`h${node.attrs.level}`, domAttrs(node), 0]
    },

    blockquote: {
      content: 'block+',
      group: 'block',
      defining: true,
      attrs: { ...mdAttrs },
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: (node) => ['blockquote', domAttrs(node), 0]
    },

    /**
     * A GitHub-style alert: `> [!NOTE] Optional title`.
     *
     * Its own node rather than a classed blockquote, because the two are different source. The title
     * is a string and not editable content — it is one line of markdown the renderer parses on its
     * own, and modelling it as a child would mean a node that can hold inline content but must
     * serialise onto the marker line.
     */
    alert: {
      content: 'block+',
      group: 'block',
      defining: true,
      attrs: { kind: { default: 'note' }, title: { default: null } },
      parseDOM: [{ tag: 'blockquote[data-alert]' }],
      toDOM: (node) => [
        'blockquote',
        { class: `alert ${ALERT_KINDS[node.attrs.kind] ?? ''}`, 'data-alert': node.attrs.kind },
        0
      ]
    },

    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      marks: '',
      /*
        The whole info string, not just the language: a fence here may also carry `title`,
        `linesStart` and `linesHighlight`, which the renderer parses out of exactly this text. Kept as
        one string so a fence the editor has no form for still comes back the way it went in.

        `indented` is the other way markdown writes a code block — four spaces and no fence. It is not
        a spelling difference to be normalised away: the renderer sends a fence through highlight.js
        and gives it the wiki's code styling, while an indented block gets the browser's bare `<pre>`,
        so rewriting one as the other changes the page.
      */
      attrs: { params: { default: '' }, indented: { default: false } },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: (dom) => ({ params: dom.getAttribute('data-params') ?? '' })
        }
      ],
      toDOM: (node) => ['pre', { 'data-params': node.attrs.params || null }, ['code', 0]]
    },

    horizontal_rule: {
      group: 'block',
      attrs: { markup: { default: '---' } },
      parseDOM: [{ tag: 'hr' }],
      toDOM: () => ['div', { class: 'visual-hr' }, ['hr']]
    },

    bullet_list: {
      content: 'list_item+',
      group: 'block',
      attrs: { tight: { default: true }, markup: { default: '-' }, ...mdAttrs },
      parseDOM: [{ tag: 'ul', getAttrs: (dom) => ({ tight: dom.hasAttribute('data-tight') }) }],
      toDOM: (node) => ['ul', domAttrs(node), 0]
    },

    ordered_list: {
      content: 'list_item+',
      group: 'block',
      attrs: {
        order: { default: 1 },
        tight: { default: true },
        markup: { default: '.' },
        ...mdAttrs
      },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: (dom) => ({
            order: dom.hasAttribute('start') ? Number(dom.getAttribute('start')) : 1,
            tight: dom.hasAttribute('data-tight')
          })
        }
      ],
      toDOM: (node) => [
        'ol',
        { ...domAttrs(node), start: node.attrs.order === 1 ? null : node.attrs.order },
        0
      ]
    },

    /**
     * One item of either list, and — when `checked` is not null — one line of a task list.
     *
     * The checkbox is an attribute of the item rather than a node inside it because that is what it is
     * in the source: `- [x] ` is the item's marker, not its first child. Modelling it as content would
     * let an author put it in the middle of a sentence.
     */
    list_item: {
      content: 'block+',
      defining: true,
      attrs: { checked: { default: null } },
      parseDOM: [
        {
          tag: 'li',
          getAttrs: (dom) => {
            const box = dom.querySelector(':scope > input[type=checkbox]')
            return { checked: box ? box.checked : null }
          }
        }
      ],
      toDOM: (node) =>
        node.attrs.checked === null
          ? ['li', 0]
          : [
              'li',
              { class: 'visual-task-item', 'data-checked': node.attrs.checked ? 'true' : 'false' },
              0
            ]
    },

    definition_list: {
      content: '(definition_term | definition_description)+',
      group: 'block',
      defining: true,
      /*
        Tight exactly as a bullet list is, and for the same reason: a blank line between a term and
        its definition makes `markdown-it-deflist` wrap each definition in a paragraph, which is a
        visible difference on the page. Writing every list out loose would put a `<p>` inside every
        `<dd>` on every wiki that ever used one.
      */
      attrs: { tight: { default: true } },
      parseDOM: [{ tag: 'dl', getAttrs: (dom) => ({ tight: !dom.querySelector('dd > p') }) }],
      toDOM: () => ['dl', 0]
    },
    definition_term: {
      content: 'inline*',
      defining: true,
      parseDOM: [{ tag: 'dt' }],
      toDOM: () => ['dt', 0]
    },
    definition_description: {
      content: 'block+',
      defining: true,
      parseDOM: [{ tag: 'dd' }],
      toDOM: () => ['dd', 0]
    },

    ...tables,

    /**
     * An MDC block component that holds page content: `::block-tabs`, `::block-tab`, `::block-steps`.
     *
     * These are the blocks that deliberately leave what they hold in the light DOM — see the note on
     * `block-tab` and `block-steps` in the repository's own documentation — so their bodies are the
     * article's own markdown and are edited as such, here, in place.
     */
    block_container: {
      content: 'block+',
      group: 'block',
      defining: true,
      attrs: { name: {}, blockAttrs: { default: null } },
      parseDOM: [
        {
          tag: '[data-block-container]',
          getAttrs: (dom) => ({ name: dom.getAttribute('data-block-container') })
        }
      ],
      toDOM: (node) => ['div', { 'data-block-container': node.attrs.name }, 0]
    },

    /**
     * Every other MDC block: an atom drawn by its own custom element.
     *
     * `body` is whatever sat between the fences, kept verbatim. For most blocks that is a fenced
     * source the block itself reads — a mermaid diagram, a KaTeX expression — and it is edited
     * through the block's own content editor rather than as document content, because it is not
     * markdown and the article's rules do not apply to it.
     */
    block_component: {
      group: 'block',
      atom: true,
      defining: true,
      attrs: { name: {}, blockAttrs: { default: null }, body: { default: '' } },
      parseDOM: [
        { tag: '[data-block]', getAttrs: (dom) => ({ name: dom.getAttribute('data-block') }) }
      ],
      toDOM: (node) => ['div', { 'data-block': node.attrs.name }]
    },

    /**
     * A footnote's body. Always written at the end of the document, wherever it was before: that is
     * where markdown-it reports them and where the editor's own insert puts them.
     */
    footnote_definition: {
      content: 'block+',
      group: 'block',
      defining: true,
      attrs: { label: {} },
      parseDOM: [
        {
          tag: '[data-footnote]',
          getAttrs: (dom) => ({ label: dom.getAttribute('data-footnote') })
        }
      ],
      toDOM: (node) => ['div', { 'data-footnote': node.attrs.label, class: 'visual-footnote' }, 0]
    },

    /**
     * An abbreviation definition, `*[HTML]: Hyper Text Markup Language`.
     *
     * An atom with no content of its own, because the definition is a declaration rather than part of
     * the prose: markdown-it consumes the line entirely and leaves no token behind, so the editor is
     * the only thing that will ever show it to the author who wrote it.
     */
    abbreviation: {
      group: 'block',
      atom: true,
      attrs: { label: {}, title: { default: '' } },
      parseDOM: [{ tag: '[data-abbreviation]' }],
      toDOM: (node) => [
        'div',
        { 'data-abbreviation': '', class: 'visual-abbreviation' },
        `${node.attrs.label} — ${node.attrs.title}`
      ]
    },

    /**
     * Markdown this schema has no node for, kept exactly as it was written.
     *
     * The escape hatch that makes opening a page in this editor safe. Raw HTML lands here, and so does
     * anything a future plugin adds to the pipeline before this file learns about it: it is shown as
     * source, it cannot be edited into something else by accident, and it is written back byte for
     * byte. Without it, "the editor did not understand this" and "the editor deleted this" would be
     * the same event.
     */
    raw_block: {
      group: 'block',
      atom: true,
      defining: true,
      attrs: { source: { default: '' } },
      parseDOM: [{ tag: 'div[data-raw]', getAttrs: (dom) => ({ source: dom.textContent }) }],
      toDOM: (node) => ['div', { 'data-raw': '', class: 'visual-raw' }, node.attrs.source]
    },

    text: { group: 'inline' },

    image: {
      inline: true,
      group: 'inline',
      draggable: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
        width: { default: null },
        height: { default: null },
        ...mdAttrs
      },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs: (dom) => ({
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt'),
            title: dom.getAttribute('title'),
            width: dom.getAttribute('width'),
            height: dom.getAttribute('height')
          })
        }
      ],
      toDOM: (node) => ['img', node.attrs]
    },

    /**
     * A line break inside a paragraph — and which of the two kinds markdown has.
     *
     * `soft` is a plain newline, `hard` the backslash that forces a break wherever it is read. They
     * are kept apart because a site with `lineBreaks` on draws BOTH as a `<br>`: flattening a soft
     * break into a space, which is what a CommonMark serialiser does, would quietly delete a visible
     * line break from every page written on such a site.
     */
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      attrs: { markup: { default: 'hard' } },
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br']
    },

    /**
     * Raw inline HTML, kept as written. The inline counterpart of `raw_block`, and there for the same
     * reason: an author who wrote `<kbd>` in the middle of a sentence gets it back.
     */
    raw_inline: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { source: { default: '' } },
      parseDOM: [
        { tag: 'span[data-raw-inline]', getAttrs: (dom) => ({ source: dom.textContent }) }
      ],
      toDOM: (node) => [
        'span',
        { 'data-raw-inline': '', class: 'visual-raw-inline' },
        node.attrs.source
      ]
    },

    /**
     * An emoji shortcode. The character is what is drawn in the editor; the shortcode is what goes
     * back into the source, because that is what the author typed and what the picker inserts.
     */
    emoji: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { shortcode: {}, char: { default: '' } },
      parseDOM: [
        {
          tag: 'span[data-emoji]',
          getAttrs: (dom) => ({ shortcode: dom.getAttribute('data-emoji'), char: dom.textContent })
        }
      ],
      toDOM: (node) => ['span', { 'data-emoji': node.attrs.shortcode }, node.attrs.char]
    },

    /** An Iconify reference written as a shortcode, `:mdi:home:`. */
    icon: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { reference: {} },
      parseDOM: [
        { tag: 'iconify-icon', getAttrs: (dom) => ({ reference: dom.getAttribute('icon') }) }
      ],
      toDOM: (node) => ['iconify-icon', { icon: node.attrs.reference }]
    },

    footnote_ref: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { label: {} },
      parseDOM: [
        {
          tag: 'sup[data-footnote-ref]',
          getAttrs: (dom) => ({ label: dom.getAttribute('data-footnote-ref') })
        }
      ],
      toDOM: (node) => [
        'sup',
        { 'data-footnote-ref': node.attrs.label, class: 'visual-footnote-ref' },
        `[${node.attrs.label}]`
      ]
    }
  },

  marks: {
    /*
      Ordered deliberately: ProseMirror serialises a mark set in the order the marks are declared, and
      the serialiser writes their delimiters in that order too. Link outermost, then the emphases,
      then code — which is the order these read best in and the order markdown-it parses back
      unambiguously.
    */
    /**
     * A link, and whatever `{…}` was stuck to it.
     *
     * `target="_blank"` is the one that matters and the reason this carries attributes at all: it is
     * how both editors write "open in a new tab", and a link mark that could not hold it would drop it
     * from every page that had one, the first time the page was opened here and saved.
     */
    link: {
      attrs: { href: {}, title: { default: null }, ...mdAttrs },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom) => ({ href: dom.getAttribute('href'), title: dom.getAttribute('title') })
        }
      ],
      toDOM: (node) => [
        'a',
        { ...domAttrs(node), href: node.attrs.href, title: node.attrs.title },
        0
      ]
    },

    /**
     * An MDC inline span, `[text]{.cls}`.
     *
     * Its attributes are read off the `mdc_inline_props` token that FOLLOWS the span's close, which is
     * where MDC puts them — see the parser.
     */
    span: {
      attrs: { ...mdAttrs },
      parseDOM: [{ tag: 'span[data-md-span]' }],
      toDOM: (node) => ['span', { ...domAttrs(node), 'data-md-span': '' }, 0]
    },

    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b', getAttrs: (dom) => dom.style.fontWeight !== 'normal' && null },
        { style: 'font-weight=400', clearMark: (mark) => mark.type.name === 'strong' },
        {
          style: 'font-weight',
          getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null
        }
      ],
      toDOM: () => ['strong', 0]
    },

    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
      toDOM: () => ['em', 0]
    },

    /**
     * `_text_`, which this pipeline draws as an underline rather than as emphasis when the site turns
     * `underline` on.
     *
     * A mark of its own, and not a cosmetic detail: with that setting on, rewriting `_x_` as `*x*`
     * would change an underline into an italic. With it off the parser never produces this mark, so
     * `_x_` normalises to `*x*` like any other spelling choice.
     */
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM: () => ['u', 0]
    },

    strike: {
      parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
      toDOM: () => ['s', 0]
    },

    mark: {
      parseDOM: [{ tag: 'mark' }],
      toDOM: () => ['mark', 0]
    },

    sub: {
      parseDOM: [{ tag: 'sub' }],
      toDOM: () => ['sub', 0]
    },

    sup: {
      parseDOM: [{ tag: 'sup' }],
      toDOM: () => ['sup', 0]
    },

    /**
     * An abbreviation the renderer matched, NOT something the author marked up.
     *
     * It exists so the editor can show what a definition elsewhere in the page is doing, and it is
     * deliberately absent from the serialiser: the source of an abbreviation is its `*[X]: …` line,
     * and writing anything at the point of use would invent markup that was never there.
     */
    abbr: {
      attrs: { title: { default: '' } },
      parseDOM: [{ tag: 'abbr[title]', getAttrs: (dom) => ({ title: dom.getAttribute('title') }) }],
      toDOM: (node) => ['abbr', { title: node.attrs.title }, 0]
    },

    /**
     * A code span.
     *
     * Deliberately excludes nothing. `**\`name\`**` is ordinary markdown and markdown-it parses it as
     * a strong containing a code span, so a mark that refused to share its range would drop the
     * strong on the way in and write the page back without it. The declaration order above is what
     * keeps this innermost, which is the only spelling that parses back to the same thing.
     */
    code: {
      code: true,
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code', 0]
    }
  }
})

/** The DOM attributes for a node carrying `mdAttrs`, so the editor draws what the page will. */
function domAttrs(node) {
  const attrs = node.attrs.mdAttrs
  if (!attrs) {
    return {}
  }
  const out = {}
  if (attrs.id) {
    out.id = attrs.id
  }
  if (attrs.class) {
    out.class = attrs.class
  }
  return out
}
