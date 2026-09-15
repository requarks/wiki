import { MarkdownParser } from 'prosemirror-markdown'

import { KINDS, MARKER } from '@/renderers/modules/github-alerts'

import { readMdAttrs, schema } from './schema'

/**
 * Markdown into a ProseMirror document, through the site's own markdown-it.
 *
 * The one rule this file exists to keep: **the Visual editor parses what the renderer parses**. Not a
 * second markdown implementation reading the same text and mostly agreeing — the very instance
 * `renderers/markdown.js` built, with its plugins, its config and every collision fix in it. A
 * separate parser would drift, and the first symptom of the drift would be a page silently rewritten
 * on save.
 *
 * So all of the work here is a translation of the token stream markdown-it already produces. What it
 * cannot translate it keeps verbatim (`raw_block`, `raw_inline`), which is what makes opening an
 * arbitrary page in this editor safe rather than hopeful.
 *
 * Two things markdown-it does not hand over on its own, and which are recovered from the source text
 * instead:
 *
 * - **Abbreviation definitions.** `markdown-it-abbr` consumes the `*[X]: …` line entirely and emits
 *   no token for it, so a round trip through the token stream alone would delete every one of them.
 * - **A block component's body.** MDC tokenises what is between the fences, but a block holding a
 *   fenced source — a diagram, a formula — wants that text exactly as typed, which only the source
 *   has.
 */

/** `*[HTML]: Hyper Text Markup Language`, at the start of a line. */
const ABBREVIATION = /^ {0,3}\*\[([^\]\n]+)\]:[ \t]*(.*)$/

/** The opening or closing line of a fenced code block, indented up to the three spaces markdown allows. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/

/**
 * The abbreviation definitions in a page, with the lines they sit on.
 *
 * A definition inside a fenced code block is a code sample and not a definition, which is the same
 * reading `helpers/markdownBlocks.js` takes of the same lines — so fences are tracked rather than the
 * pattern simply being run over the whole document.
 */
function findAbbreviations(text) {
  const found = []
  let fence = null
  for (const line of text.split('\n')) {
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      if (fence && line.trimStart().startsWith(fence)) {
        fence = null
      } else if (!fence) {
        fence = fenceMatch[1]
      }
      continue
    }
    if (fence) {
      continue
    }
    const match = ABBREVIATION.exec(line)
    if (match) {
      found.push({ label: match[1], title: match[2].trim() })
    }
  }
  return found
}

/**
 * A synthetic markdown-it token, for the constructs assembled here rather than parsed.
 *
 * Plain objects rather than `Token` instances: the parser only ever reads `type`, `attrs`, `content`,
 * `children` and `meta` off them, and `attrGet` is the one method it calls.
 */
function token(type, fields = {}) {
  return {
    type,
    tag: '',
    attrs: null,
    content: '',
    children: null,
    meta: null,
    nesting: 0,
    attrGet(name) {
      return this.attrs?.find(([key]) => key === name)?.[1] ?? null
    },
    ...fields
  }
}

/**
 * A copy of a markdown-it token with some fields changed.
 *
 * Not a spread: `Token` keeps `attrGet` on its prototype, and a spread produces a plain object
 * without it — which reads as "this token has no attributes" everywhere downstream rather than as an
 * error. That silently emptied every `[text]{.cls}` span of its class.
 */
function retype(tok, fields) {
  return Object.assign(Object.create(Object.getPrototypeOf(tok)), tok, fields)
}

/**
 * Whether a block component's body is document content or a source it merely carries.
 *
 * Decided from what the body actually parsed into rather than from a list of block names, so a block
 * this file has never heard of — a custom one an installation added — is classified by the same rule
 * as the ones that ship. A body that is empty, or that is nothing but one fenced source, belongs to
 * the block; anything else is page content and is edited in place.
 *
 * This is the same division the blocks themselves make: `block-tab` and `block-steps` leave what they
 * hold in the light DOM precisely because it is the article's content and has to be drawn by the
 * article's stylesheet.
 *
 * @param {object[]} body The tokens between the opening and closing fences.
 */
function bodyIsContent(body) {
  if (body.length === 0) {
    return false
  }
  return !(body.length === 1 && body[0].type === 'fence')
}

/** An MDC block's body, taken out of the source between its opening and closing fence lines. */
function blockBody(lines, map) {
  if (!map) {
    return ''
  }
  // -> `map[1]` is the line the closing fence sits on, so the body is everything strictly between
  return lines
    .slice(map[0] + 1, map[1])
    .join('\n')
    .replace(/\s+$/, '')
}

/** A token's attribute list as a plain object, for the block attributes MDC puts on the open token. */
function attrObject(attrs) {
  if (!attrs || attrs.length === 0) {
    return null
  }
  return Object.fromEntries(attrs)
}

/**
 * Inline tokens, with the three places MDC and the task list plugin leave the stream unusable put
 * right.
 *
 * All three are cases where a token means something only in combination with its neighbours, which is
 * exactly what `MarkdownParser` cannot express: it dispatches on one token's type at a time.
 */
function normalizeInline(children, config) {
  const out = []
  for (let i = 0; i < children.length; i++) {
    const tok = children[i]

    /*
      MDC's inline span puts its attributes on a THIRD token, after the close — `[text]{.cls}` is
      span-open, text, span-close, props. A mark's attributes have to be on its opening token, so the
      props are carried back to it and the token itself dropped.

      The same props token also follows an image (`![alt](src){.cls}`), where it decorates that image
      rather than opening anything, and is folded onto it for the same reason.
    */
    if (tok.type === 'mdc_inline_props') {
      const previous = out.at(-1)
      if (previous?.type === 'mdc_span_close') {
        const open = out.findLast((entry) => entry.type === 'mdc_span_open' && !entry.meta?.closed)
        if (open) {
          open.attrs = tok.attrs
          open.meta = { ...open.meta, closed: true }
        }
      } else if (previous?.type === 'image') {
        previous.meta = { ...previous.meta, props: tok.attrs }
      } else if (previous?.type === 'link_close') {
        // -> Back onto the opening token, which is where a mark's attributes have to be
        const open = out.findLast((entry) => entry.type === 'link_open' && !entry.meta?.closed)
        if (open) {
          open.meta = { ...open.meta, props: tok.attrs, closed: true }
        }
      }
      continue
    }

    if (tok.type === 'mdc_inline_span') {
      out.push(retype(tok, { type: tok.nesting === 1 ? 'mdc_span_open' : 'mdc_span_close' }))
      continue
    }

    /*
      `_text_` is an underline rather than an emphasis on a site that turns `underline` on — see the
      mark in the schema for why that distinction cannot be normalised away. The markup character is
      the only thing that separates the two, and markdown-it keeps it on the token.
    */
    if (config.underline && (tok.type === 'em_open' || tok.type === 'em_close')) {
      if (tok.markup === '_') {
        out.push(
          retype(tok, { type: tok.type === 'em_open' ? 'md_underline_open' : 'md_underline_close' })
        )
        continue
      }
    }

    /*
      The checkbox `markdown-it-task-lists` writes. It is the marker of a task item rather than part of
      its text, and the item itself carries whether it is ticked, so there is nothing here for it to
      contribute.

      The plugin slices the `[x] ` off the text itself, marker and space together, so nothing is left
      to trim after it — see the guard in `renderers/markdown.js` that keeps MDC's inline span off
      that marker, without which it silently sliced nothing and left the marker in the page.
    */
    if (tok.type === 'html_inline' && tok.content.includes('task-list-item-checkbox')) {
      continue
    }

    out.push(tok)
  }
  return out
}

/**
 * The whole token stream, rewritten into something `MarkdownParser` can dispatch on.
 *
 * Everything here is structural: a token type that has to be split by what it is a token OF (MDC
 * blocks all arrive as `mdc_block_open`, whatever component they name), a token that has to be
 * dropped because the schema models it as an attribute, or content that has to be recovered from the
 * source because the tokens no longer hold it.
 */
function normalize(tokens, source, config) {
  const lines = source.split('\n')
  const out = []

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]

    switch (tok.type) {
      /*
        Every block component arrives under one token type and is told apart by its tag, so the tag is
        what the dispatch has to be moved onto. A block whose body is a source it carries becomes a
        single atom holding that source verbatim; one whose body is page content becomes a container
        and the tokens inside it are kept.
      */
      case 'mdc_block_open': {
        const depth = []
        let end = i + 1
        for (; end < tokens.length; end++) {
          if (tokens[end].type === 'mdc_block_open') {
            depth.push(1)
          } else if (tokens[end].type === 'mdc_block_close') {
            if (depth.length === 0) {
              break
            }
            depth.pop()
          }
        }
        const name = tok.tag.replace(/^block-/, '')
        const blockAttrs = attrObject(tok.attrs)
        if (bodyIsContent(tokens.slice(i + 1, end))) {
          out.push(token('mdc_container_open', { meta: { name, blockAttrs } }))
          out.push(...normalize(tokens.slice(i + 1, end), source, config))
          out.push(token('mdc_container_close'))
        } else {
          out.push(
            token('mdc_atom', { meta: { name, blockAttrs, body: blockBody(lines, tok.map) } })
          )
        }
        i = end
        continue
      }

      /*
        A blockquote opening with `[!NOTE]` is an alert, and a different piece of source from a
        blockquote somebody classed by hand. The plugin has already rewritten the tokens by the time
        this runs — the marker is gone from the text and its title is a paragraph of its own — so the
        alert is recognised from the same marker, read off the ORIGINAL source line.
      */
      case 'blockquote_open': {
        const alert = alertAt(tokens, i, lines)
        if (alert) {
          out.push(token('md_alert_open', { meta: alert }))
          // -> The title has been spliced in as a paragraph; it belongs to the marker line, not the body
          i = alert.skipTo - 1
          continue
        }
        out.push(tok)
        continue
      }
      case 'blockquote_close':
        out.push(tokens[i].meta?.alert ? token('md_alert_close') : tok)
        continue

      /*
        `prosemirror-tables` has no row groups: a table holds rows directly. The header row is told
        apart by its cells being header cells, which is the same thing markdown says with its
        delimiter row.
      */
      case 'thead_open':
      case 'thead_close':
      case 'tbody_open':
      case 'tbody_close':
        continue

      /*
        A cell's content in this schema is block content, because that is what a cell can hold once a
        table is edited rather than written — but markdown-it puts the inline straight inside the cell.
        The paragraph it will need is added here.
      */
      case 'th_open':
      case 'td_open':
        out.push(tok)
        if (tokens[i + 1]?.type === 'inline') {
          out.push(token('paragraph_open', { type: 'paragraph_open', nesting: 1 }))
          out.push(normalizeInlineToken(tokens[i + 1], config))
          out.push(token('paragraph_close', { type: 'paragraph_close', nesting: -1 }))
          i += 1
        }
        continue

      /*
        Whether a task item is ticked has to be read here, while the checkbox the task list plugin
        wrote is still in the stream — `normalizeInline` is about to strip it as the marker it is, so
        by the time the item's attributes are computed there would be nothing left to read.
      */
      case 'list_item_open':
        out.push(retype(tok, { meta: { ...tok.meta, checked: checkedInItem(tokens, i) } }))
        continue

      case 'inline':
        out.push(normalizeInlineToken(tok, config))
        continue

      /*
        The footnote section markdown-it appends at the end of the document. The wrapper and the
        back-reference anchor are rendering furniture with no source behind them; the definitions
        themselves are kept.
      */
      case 'footnote_block_open':
      case 'footnote_block_close':
      case 'footnote_anchor':
        continue

      default:
        out.push(tok)
    }
  }

  return out
}

/** An inline token with its children normalised, leaving the original untouched. */
function normalizeInlineToken(tok, config) {
  return retype(tok, { children: normalizeInline(tok.children ?? [], config) })
}

/**
 * Whether the blockquote opening at `index` is a GitHub alert, and what it says.
 *
 * Read from the source line rather than from the tokens, because by this point the plugin has taken
 * the marker out of the text — and a blockquote an author classed `{.is-warning}` by hand carries the
 * very same class, so the class is not evidence of anything.
 */
function alertAt(tokens, index, lines) {
  const open = tokens[index]
  const first = open.map ? lines[open.map[0]] : null
  if (!first) {
    return null
  }
  const body = first.replace(/^ {0,3}>[ \t]?/, '')
  if (body === first) {
    return null
  }
  const match = MARKER.exec(body)
  const kind = match ? match[1].toLowerCase() : null
  if (!kind || !KINDS.has(kind)) {
    return null
  }

  /*
    The plugin replaced the marker with a title paragraph, or spliced one in ahead of the body. Either
    way the three tokens making up that paragraph are furniture and are stepped over; what they say is
    carried on the alert itself.
  */
  let skipTo = index + 1
  if (
    tokens[skipTo]?.type === 'paragraph_open' &&
    tokens[skipTo].attrGet?.('class') === 'alert-title'
  ) {
    skipTo += 3
  }
  // -> An empty title means the marker stood alone, and the kind's own label is what gets drawn
  const title = match[2].trim()
  return { kind, title: title || null, skipTo }
}

/**
 * Mark the blockquote closes that belong to an alert, so the close can be rewritten too.
 *
 * Done as a pass of its own because the open and the close are matched by nesting, which is cheaper
 * to compute over the whole array once than to track through the rewrite.
 */
function markAlertCloses(tokens, lines) {
  const stack = []
  for (const [index, tok] of tokens.entries()) {
    if (tok.type === 'blockquote_open') {
      stack.push(alertAt(tokens, index, lines) !== null)
    } else if (tok.type === 'blockquote_close') {
      if (stack.pop()) {
        tok.meta = { ...tok.meta, alert: true }
      }
    }
  }
}

/**
 * How each token becomes part of the document.
 *
 * Everything the schema models is here; anything not listed reaches `MarkdownParser` as an unknown
 * token and would throw, which is why the normaliser above turns the whole stream into these types
 * and nothing else.
 */
const tokenSpecs = {
  paragraph: { block: 'paragraph', getAttrs: (tok) => ({ mdAttrs: readMdAttrs(tok) }) },
  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)), mdAttrs: readMdAttrs(tok) })
  },
  blockquote: { block: 'blockquote', getAttrs: (tok) => ({ mdAttrs: readMdAttrs(tok) }) },
  md_alert: {
    block: 'alert',
    getAttrs: (tok) => ({ kind: tok.meta.kind, title: tok.meta.title })
  },
  code_block: { block: 'code_block', getAttrs: () => ({ indented: true }), noCloseToken: true },
  fence: {
    block: 'code_block',
    getAttrs: (tok) => ({ params: tok.info ?? '' }),
    noCloseToken: true
  },
  hr: { node: 'horizontal_rule', getAttrs: (tok) => ({ markup: tok.markup || '---' }) },

  bullet_list: {
    block: 'bullet_list',
    getAttrs: (tok, tokens, i) => ({
      tight: listIsTight(tokens, i),
      markup: tok.markup || '-',
      // -> The task list plugin's own class is not the author's, and is not written back
      mdAttrs: readMdAttrs(tok, ['contains-task-list'])
    })
  },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok, tokens, i) => ({
      order: Number(tok.attrGet('start')) || 1,
      tight: listIsTight(tokens, i),
      markup: tok.markup || '.',
      mdAttrs: readMdAttrs(tok, ['contains-task-list'])
    })
  },
  list_item: { block: 'list_item', getAttrs: (tok) => ({ checked: checkedState(tok) }) },

  dl: {
    block: 'definition_list',
    getAttrs: (tok, tokens, i) => ({ tight: deflistIsTight(tokens, i) })
  },
  dt: { block: 'definition_term' },
  dd: { block: 'definition_description' },

  table: { block: 'table' },
  tr: { block: 'table_row' },
  th: { block: 'table_header', getAttrs: (tok) => ({ align: alignOf(tok) }) },
  td: { block: 'table_cell', getAttrs: (tok) => ({ align: alignOf(tok) }) },

  mdc_container: {
    block: 'block_container',
    getAttrs: (tok) => ({ name: tok.meta.name, blockAttrs: tok.meta.blockAttrs })
  },
  mdc_atom: {
    node: 'block_component',
    getAttrs: (tok) => ({
      name: tok.meta.name,
      blockAttrs: tok.meta.blockAttrs,
      body: tok.meta.body
    })
  },

  footnote: { block: 'footnote_definition', getAttrs: (tok) => ({ label: tok.meta.label }) },
  footnote_ref: { node: 'footnote_ref', getAttrs: (tok) => ({ label: tok.meta.label }) },

  html_block: {
    node: 'raw_block',
    getAttrs: (tok) => ({ source: tok.content.replace(/\n$/, '') })
  },
  html_inline: { node: 'raw_inline', getAttrs: (tok) => ({ source: tok.content }) },

  image: {
    node: 'image',
    getAttrs: (tok) => ({
      src: tok.attrGet('src'),
      alt: tok.children?.[0]?.content || null,
      title: tok.attrGet('title') || null,
      width: tok.attrGet('width'),
      height: tok.attrGet('height'),
      mdAttrs: readMdAttrs({ attrs: tok.meta?.props })
    })
  },
  hardbreak: { node: 'hard_break', getAttrs: () => ({ markup: 'hard' }) },
  softbreak: { node: 'hard_break', getAttrs: () => ({ markup: 'soft' }) },
  emoji: {
    node: 'emoji',
    getAttrs: (tok) => ({ shortcode: tok.markup, char: tok.content })
  },
  iconify_icon: { node: 'icon', getAttrs: (tok) => ({ reference: tok.content }) },

  em: { mark: 'em' },
  md_underline: { mark: 'underline' },
  strong: { mark: 'strong' },
  s: { mark: 'strike' },
  mark: { mark: 'mark' },
  sub: { mark: 'sub' },
  sup: { mark: 'sup' },
  abbr: { mark: 'abbr', getAttrs: (tok) => ({ title: tok.attrGet('title') ?? '' }) },
  mdc_span: { mark: 'span', getAttrs: (tok) => ({ mdAttrs: readMdAttrs(tok) }) },
  link: {
    mark: 'link',
    getAttrs: (tok) => ({
      href: tok.attrGet('href'),
      title: tok.attrGet('title') || null,
      mdAttrs: readMdAttrs({ attrs: tok.meta?.props })
    })
  },
  code_inline: { mark: 'code', noCloseToken: true }
}

/** Whether a list is tight, which is whether its items' paragraphs are rendered. */
function listIsTight(tokens, index) {
  for (let i = index + 1; i < tokens.length; i++) {
    if (tokens[i].type !== 'list_item_open') {
      return Boolean(tokens[i].hidden)
    }
  }
  return false
}

/**
 * Whether a list item is a task, and whether it is ticked.
 *
 * Null for an ordinary item — which is not the same as an unticked one, and is what decides whether
 * the item is written back with a `[ ]` marker at all.
 */
function checkedState(tok) {
  return tok.meta?.checked ?? null
}

/**
 * The same question asked of the raw stream, which is where the answer actually is.
 *
 * The class marks the item as a task; the `checked` attribute of the input the plugin wrote is what
 * says whether it is ticked.
 */
function checkedInItem(tokens, index) {
  const classes = tokens[index].attrGet('class') ?? ''
  if (!classes.split(/\s+/).includes('task-list-item')) {
    return null
  }
  for (let i = index + 1; i < tokens.length && i < index + 6; i++) {
    for (const child of tokens[i].children ?? []) {
      if (child.type === 'html_inline' && child.content.includes('task-list-item-checkbox')) {
        return child.content.includes('checked')
      }
    }
  }
  return false
}

/**
 * Whether a definition list is tight, which is whether its definitions' paragraphs are rendered.
 *
 * The same tell as for a bullet list — a hidden paragraph token — read off the first definition,
 * since `markdown-it-deflist` decides tightness for the list as a whole.
 */
function deflistIsTight(tokens, index) {
  for (let i = index + 1; i < tokens.length; i++) {
    if (tokens[i].type === 'dl_close') {
      return true
    }
    if (tokens[i].type === 'paragraph_open') {
      return Boolean(tokens[i].hidden)
    }
  }
  return true
}

/** A cell's alignment, which markdown-it writes as an inline style. */
function alignOf(tok) {
  const match = /text-align:\s*(left|center|right)/.exec(tok.attrGet('style') ?? '')
  return match ? match[1] : null
}

/**
 * A parser bound to one site's markdown configuration.
 *
 * @param {import('@/renderers/markdown').MarkdownRenderer} renderer The renderer the editor previews
 *        with. Its markdown-it instance is the tokenizer, which is the whole point.
 * @param {object} config The site's markdown editor config, for the handful of settings that change
 *        what a token MEANS rather than how it is drawn — `underline` being the one that matters.
 */
export function createParser(renderer, config = {}) {
  const md = renderer.md

  /*
    The tokenizer `MarkdownParser` is given is this shim rather than markdown-it itself, which is the
    seam that makes all of the above possible: the parser calls `parse(text, env)` and never looks at
    what produced the tokens.
  */
  const tokenizer = {
    parse(text, env) {
      const tokens = md.parse(text, env)
      const lines = text.split('\n')
      markAlertCloses(tokens, lines)
      const normalized = normalize(tokens, text, config)
      /*
        The abbreviation definitions, appended as nodes of their own. They are recovered from the
        source because the plugin leaves no token behind — see the note at the top of this file — and
        they go at the end because that is where the editor's own insert puts them and where they can
        be gathered without a second structure tracking where each one was written.
      */
      for (const abbreviation of findAbbreviations(text)) {
        normalized.push(
          token('md_abbreviation', {
            meta: abbreviation
          })
        )
      }
      return normalized
    }
  }

  const parser = new MarkdownParser(schema, tokenizer, {
    ...tokenSpecs,
    md_abbreviation: {
      node: 'abbreviation',
      getAttrs: (tok) => ({ label: tok.meta.label, title: tok.meta.title })
    }
  })

  return {
    /**
     * @param {string} markdown The page source.
     * @param {string} pagePath The page's own path, which a relative image resolves against — passed
     *        through to markdown-it as its environment, exactly as the preview does it.
     */
    parse(markdown, pagePath = '') {
      return parser.parse(markdown ?? '', { pagePath })
    }
  }
}
