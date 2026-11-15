import emoticons from 'markdown-it-emoji/lib/data/shortcuts.mjs'
import { MarkdownSerializer } from 'prosemirror-markdown'
import { TableMap } from 'prosemirror-tables'

import { inlineMarkdownValue } from '@/helpers/blocks'
import { KINDS } from '@/renderers/modules/github-alerts'
import { wikiLinkText } from '@/renderers/modules/markdown-it-wikilinks'

import { writeMdAttrs } from './schema'

/**
 * A ProseMirror document back into markdown.
 *
 * The exacting half. Parsing a construct wrongly shows the author something odd and they can see it;
 * serialising one wrongly writes it into the page, and the mistake only surfaces the next time
 * somebody opens the file. So every rule here is written to produce source that the site's own
 * markdown-it reads back as the document it came from — which is exactly what `verifyRoundTrip` in
 * `convert.js` checks, rather than trusting this file to be right.
 *
 * What is deliberately NOT preserved is spelling: which of `-`, `*` or `+` starts a bullet is kept
 * because a page full of one of them would otherwise become a page full of another, but indentation,
 * table padding and the spacing inside a `{…}` are normalised. That is the cost of the format being a
 * view rather than the storage, and it is why converting a page rewrites its source once, up front,
 * as its own history version.
 */

/** The fence a block component needs: deep enough that nothing inside it closes it early. */
function fenceFor(node) {
  return ':'.repeat(2 + blockDepth(node))
}

/**
 * How deeply block components nest inside this one.
 *
 * MDC closes a block with the fence it was opened with, so a `::block-tabs` holding `::block-tab`
 * children has to be written with three colons or the first child's `::` would close the parent. The
 * depth is counted rather than assumed, so a tabset holding a panel holding a block still comes out
 * right.
 */
function blockDepth(node) {
  let deepest = 0
  node.forEach((child) => {
    const own = child.type.name === 'block_component' || child.type.name === 'block_container'
    const inner = blockDepth(child) + (own ? 1 : 0)
    deepest = Math.max(deepest, inner)
  })
  return deepest
}

/** A block's props as MDC writes them, `{a="b"}`, or nothing when it has none. */
function blockAttrSuffix(node) {
  const attrs = node.attrs.blockAttrs ?? {}
  const written = Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    // -> A double quote would close the attribute and MDC has no escape for it, exactly as
    //    `helpers/blocks.js` writes them
    .map(([name, value]) => `${name}="${String(value).replaceAll('"', "'")}"`)
  return written.length > 0 ? `{${written.join(' ')}}` : ''
}

/** `::block-name{a="b"}`, the opening line both block nodes share. */
function blockOpening(node, fence) {
  return `${fence}block-${node.attrs.name}${blockAttrSuffix(node)}`
}

/**
 * A table as the lines of a pipe table: the header row(s), the delimiter row, then the body.
 *
 * Written from the table's grid (`TableMap`) rather than from its rows, because a merged cell leaves
 * its row short: `prosemirror-tables` keeps no node for a position a span covers, while a pipe table
 * needs a slot in every row for every column or what follows shifts left. MultiMarkdown, which the
 * renderer reads with `multimdTable` on, has a mark for both kinds of covered slot -- an empty one,
 * `||` with nothing between the pipes, extends the cell to its left, and `^^` extends the cell above.
 *
 * Two merges have no MultiMarkdown spelling, and are written as an ordinary grid with the covered
 * slots left empty -- the content survives and the columns stay aligned, only the merge is lost:
 *
 * - any merge on a site with `multimdTable` off, where `||` is an empty cell and `^^` is text;
 * - a header cell merged down into the body: the plugin starts its rowspans afresh in each of
 *   `<thead>` and `<tbody>`, so a `^^` in the first body row is read as the text `^^`.
 */
function tableLines(state, table) {
  const map = TableMap.get(table)
  const { multimdTable } = state.options.site
  const headerRows = multimdTable ? headerRowCount(table) : 1
  const lines = []

  for (let row = 0; row < map.height; row++) {
    let line = '|'
    for (let col = 0; col < map.width;) {
      const pos = map.map[row * map.width + col]
      const rect = map.findCell(pos)
      const own = rect.top === row
      const spanable = multimdTable && (own || rect.top >= headerRows || row < headerRows)
      let text = ''
      if (own) {
        text = cellText(state, table.nodeAt(pos))
      } else if (spanable) {
        text = '^^'
      }
      line += ` ${text} |`
      // -> The rest of the cell's width: an empty slot extends it, a blank one is a cell of its own
      for (let i = rect.left + 1; i < rect.right; i++) {
        line += spanable ? '|' : '  |'
      }
      col = rect.right
    }
    lines.push(line)
    /*
      The delimiter row goes under the header rows -- which in markdown is the only place it can go,
      and the only thing that makes the table a table.
    */
    if (row === headerRows - 1) {
      lines.push(alignmentRow(table, map))
    }
  }
  return lines
}

/**
 * How many rows the table's header is: the first row, and every row after it made only of header
 * cells.
 *
 * MultiMarkdown allows a header of several rows -- every row above the delimiter -- and a header cell
 * can only span rows inside it, so a header of two rows has to be written as one for its spans to
 * survive. GFM's tables, with the plugin off, have exactly one.
 */
function headerRowCount(table) {
  let count = 1
  for (; count < table.childCount; count++) {
    let headers = true
    table.child(count).forEach((cell) => {
      headers &&= cell.type.name === 'table_header'
    })
    if (!headers) {
      break
    }
  }
  return count
}

/**
 * One cell as inline markdown.
 *
 * A pipe table has one line per row, so a cell's paragraphs -- which is what pressing Enter in one
 * makes -- cannot be written as paragraphs. Each is written as a line of the cell instead, joined with
 * the `<br>` that draws a break between them, or with a space on a site that does not allow HTML,
 * where nothing can. The page reads back with the cell as one paragraph of lines, which renders the
 * same. A list or a quote in a cell gives up its marker the same way and keeps its lines.
 */
function cellText(state, cell) {
  const lineBreak = state.options.site.allowHTML ? '<br>' : ' '
  const lines = cellLines(state, cell)
  // -> An empty paragraph at either end is where the caret was left, not a line anybody wrote
  while (lines.length > 1 && lines.at(-1) === '') {
    lines.pop()
  }
  while (lines.length > 1 && lines[0] === '') {
    lines.shift()
  }
  return (
    lines
      .join(lineBreak)
      /*
        Nothing above writes a newline -- `hard_break` does not inside a cell -- but a code block's text
        has its own, and any newline that got through would end the row and push the rest of the cell
        into the next.
      */
      .replace(/\n/g, lineBreak)
      /*
        A literal pipe would end the cell, so it is escaped here rather than by the text rule, which
        has no idea it is inside a table. One that is already escaped is left alone: a code span may
        hold `a\|b` as its literal text, and escaping the escape would put a second backslash on the
        page.
      */
      .replace(/\\?\|/g, (match) => (match === '|' ? '\\|' : match))
      .trim()
  )
}

/** Every textblock in a cell, in order, as one line each -- however deeply it is nested. */
function cellLines(state, node) {
  const lines = []
  node.forEach((child) => {
    if (child.isTextblock) {
      lines.push(inlineOf(state, child))
    } else if (child.isLeaf) {
      // -> A rule or a raw block says nothing a cell can show, and an empty line for it would be a gap
      if (child.textContent) {
        lines.push(child.textContent)
      }
    } else {
      lines.push(...cellLines(state, child))
    }
  })
  return lines
}

/**
 * One textblock's inline content as a string, rendered through a throwaway serializer state.
 *
 * `MarkdownSerializerState` writes into an accumulator it owns, and a table cell has to be turned
 * into text before the row it belongs to can be written at all — so the cell is rendered on a state
 * of its own and the result taken out of it. The state is told it is inside a cell, which is what
 * `hard_break` asks.
 */
function inlineOf(state, node) {
  const sub = new state.constructor(state.nodes, state.marks, {
    ...state.options,
    inTableCell: true
  })
  sub.renderInline(node)
  return sub.out.trim()
}

/**
 * The delimiter row, which is also where a pipe table says how each column is set.
 *
 * One delimiter per column of the grid, not per cell of the first row, which a merge leaves short. A
 * column's alignment is read off the first cell that starts in it, which is the cell the renderer
 * gave that column's alignment to.
 */
function alignmentRow(table, map) {
  const delimiters = []
  for (let col = 0; col < map.width; col++) {
    let align = null
    for (let row = 0; row < map.height; row++) {
      const pos = map.map[row * map.width + col]
      if (map.findCell(pos).left === col) {
        align = table.nodeAt(pos).attrs.align
        break
      }
    }
    delimiters.push(
      align === 'center' ? ':---:' : align === 'right' ? '---:' : align === 'left' ? ':---' : '---'
    )
  }
  return `| ${delimiters.join(' | ')} |`
}

const nodes = {
  paragraph(state, node) {
    state.renderInline(node)
    writeAttrsSuffix(state, node)
    state.closeBlock(node)
  },

  heading(state, node) {
    state.write(`${state.repeat('#', node.attrs.level)} `)
    state.renderInline(node, false)
    writeAttrsSuffix(state, node)
    state.closeBlock(node)
  },

  /**
   * `> [name=John Doe]` on a line of its own when the quote carries an attribution, then the body —
   * written inside the quote for the reason the alert's marker is.
   */
  blockquote(state, node) {
    state.wrapBlock('> ', null, node, () => {
      if (node.attrs.author) {
        state.write(`[name=${node.attrs.author}]`)
        state.ensureNewLine()
      }
      state.renderContent(node)
    })
  },

  /**
   * `> [!NOTE] Title`, then the body.
   *
   * The marker is written as the first line INSIDE the quote, which is what makes it the alert's own
   * line rather than a paragraph of the body — `wrapBlock` puts the `> ` in front of everything it
   * writes, the marker included.
   */
  alert(state, node) {
    const kind = KINDS.has(node.attrs.kind) ? node.attrs.kind : 'note'
    state.wrapBlock('> ', null, node, () => {
      state.write(`[!${kind.toUpperCase()}]${node.attrs.title ? ` ${node.attrs.title}` : ''}`)
      state.ensureNewLine()
      state.renderContent(node)
    })
  },

  code_block(state, node) {
    if (node.attrs.indented) {
      state.wrapBlock('    ', null, node, () => state.text(node.textContent, false))
      return
    }
    // -> Long enough to survive any run of backticks in the code itself
    const runs = node.textContent.match(/`{3,}/gm)
    const fence = runs ? `${runs.sort().at(-1)}\`` : '```'
    state.write(fence + (node.attrs.params || '') + '\n')
    state.text(node.textContent, false)
    state.write('\n')
    state.write(fence)
    state.closeBlock(node)
  },

  horizontal_rule(state, node) {
    state.write(node.attrs.markup || '---')
    state.closeBlock(node)
  },

  bullet_list(state, node) {
    state.renderList(node, '  ', () => `${node.attrs.markup || '-'} `)
    writeListAttrs(state, node)
  },

  ordered_list(state, node) {
    const start = node.attrs.order ?? 1
    const width = String(start + node.childCount - 1).length
    const space = state.repeat(' ', width + 2)
    state.renderList(node, space, (index) => {
      const number = String(start + index)
      return `${state.repeat(' ', width - number.length)}${number}${node.attrs.markup || '.'} `
    })
    writeListAttrs(state, node)
  },

  /**
   * One item, with the `[x]` marker in front of it when it is a task.
   *
   * Written by hand rather than folded into the list's own delimiter, because `renderList` gives every
   * item the same one and whether an item is ticked is a property of the item.
   */
  list_item(state, node) {
    if (node.attrs.checked !== null) {
      state.write(node.attrs.checked ? '[x] ' : '[ ] ')
    }
    state.renderContent(node)
  },

  /**
   * A definition list.
   *
   * Written by hand rather than through `renderContent`, which closes every child as its own block and
   * so puts a blank line everywhere. Two different gaps are needed: a term starts a new group and must
   * be separated from the definition above it, or markdown reads it as another line of that
   * definition — while a definition follows its own term directly, which is what keeps the list tight.
   */
  definition_list(state, node) {
    node.forEach((child, _offset, index) => {
      if (index > 0) {
        const startsGroup = child.type.name === 'definition_term'
        state.flushClose(startsGroup || !node.attrs.tight ? 2 : 1)
      }
      state.render(child, node, index)
    })
    state.closeBlock(node)
  },

  definition_term(state, node) {
    state.renderInline(node)
    state.closeBlock(node)
  },
  definition_description(state, node) {
    // -> `: ` opens the definition and everything under it is indented to clear the marker
    state.wrapBlock('  ', ': ', node, () => state.renderContent(node))
  },

  table(state, node) {
    for (const line of tableLines(state, node)) {
      state.write(line)
      state.ensureNewLine()
    }
    state.closeBlock(node)
  },

  block_container(state, node) {
    const fence = fenceFor(node)
    state.write(blockOpening(node, fence))
    state.ensureNewLine()
    state.renderContent(node)
    state.ensureNewLine()
    state.write(fence)
    state.closeBlock(node)
  },

  block_component(state, node) {
    const fence = fenceFor(node)
    state.write(blockOpening(node, fence))
    state.ensureNewLine()
    if (node.attrs.body) {
      state.text(node.attrs.body, false)
      state.ensureNewLine()
    }
    state.write(fence)
    state.closeBlock(node)
  },

  footnote_definition(state, node) {
    state.wrapBlock('    ', `[^${node.attrs.label}]: `, node, () => state.renderContent(node))
  },

  abbreviation(state, node) {
    state.write(`*[${node.attrs.label}]: ${node.attrs.title}`)
    state.closeBlock(node)
  },

  /** Kept exactly as it was read — the whole point of the node. */
  raw_block(state, node) {
    state.text(node.attrs.source, false)
    state.closeBlock(node)
  },

  image(state, node) {
    // -> A space would end the destination, so such an address goes in angle brackets
    const src = /\s/.test(node.attrs.src)
      ? `<${node.attrs.src.replace(/[<>]/g, '\\$&')}>`
      : node.attrs.src.replace(/[()]/g, '\\$&')
    const title = node.attrs.title ? ` "${node.attrs.title.replace(/"/g, '\\"')}"` : ''
    /*
      `markdown-it-imsize`'s own syntax, which is a suffix on the destination. Either half may be
      missing -- `=300x`, `=x200` -- and both are written, because a height on its own is a size the
      plugin reads and dropping it would resize the picture on a save nobody asked to resize it in.

      It goes AFTER the title. The plugin reads the title first and the size second, so the other order
      is not an image at all: `![a](x.png =300x "t")` renders as the literal text.
    */
    const size =
      node.attrs.width || node.attrs.height
        ? ` =${node.attrs.width ?? ''}x${node.attrs.height ?? ''}`
        : ''
    state.write(
      `![${state.esc(node.attrs.alt || '')}](${src}${title}${size})${writeMdAttrs(node.attrs.mdAttrs)}`
    )
  },

  /**
   * A line break, as whichever of the kinds it was.
   *
   * A `<br>` the author wrote is written back as they wrote it, wherever it is. Otherwise a trailing break is
   * dropped: markdown has nowhere to put one, and writing it would leave a stray backslash at the end
   * of a paragraph.
   *
   * Inside a table cell neither newline can be written, since a pipe table's row is one line — and
   * with `multimdTable` on, a row ending in the backslash of a hard break is a MultiMarkdown
   * multi-line row, which moved the rest of the cell into the first column. So a break that draws as
   * a `<br>` is written as one; where it cannot be (a site that does not allow HTML), or where it
   * would not have drawn as one (a soft break without `lineBreaks`), it is a space.
   */
  hard_break(state, node, parent, index) {
    const { markup } = node.attrs
    if (markup === 'html') {
      state.write(node.attrs.source)
      return
    }
    for (let i = index + 1; i < parent.childCount; i++) {
      if (parent.child(i).type !== node.type) {
        if (state.options.inTableCell) {
          const { allowHTML, lineBreaks } = state.options.site
          const drawn = markup === 'hard' || lineBreaks
          state.write(drawn && allowHTML ? '<br>' : ' ')
        } else {
          state.write(markup === 'soft' ? '\n' : '\\\n')
        }
        return
      }
    }
  },

  emoji(state, node) {
    state.write(`:${node.attrs.shortcode}:`)
  },

  icon(state, node) {
    state.write(`:${node.attrs.reference}:`)
  },

  footnote_ref(state, node) {
    state.write(`[^${node.attrs.label}]`)
  },

  raw_inline(state, node) {
    state.write(node.attrs.source)
  },

  // -> `:block-color[#ff6600]{…}`, the value escaped the way the picker writes one
  inline_block(state, node) {
    state.write(
      `:block-${node.attrs.name}[${inlineMarkdownValue(node.attrs.value)}]${blockAttrSuffix(node)}`
    )
  },

  text(state, node) {
    state.text(node.text, !state.inAutolink)
  }
}

const marks = {
  em: { open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true },
  underline: { open: '_', close: '_', mixable: true, expelEnclosingWhitespace: true },
  strong: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
  strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
  mark: { open: '==', close: '==', mixable: true, expelEnclosingWhitespace: true },
  sub: { open: '~', close: '~', mixable: true, expelEnclosingWhitespace: true },
  sup: { open: '^', close: '^', mixable: true, expelEnclosingWhitespace: true },

  /** MDC's inline span, whose attributes hang off the closing bracket. */
  span: {
    open: '[',
    close: (_state, mark) => `]${writeMdAttrs(mark.attrs.mdAttrs)}`,
    mixable: false
  },

  /**
   * An abbreviation at the point of use, which has no source of its own.
   *
   * The mark exists so the editor can show what a `*[X]: …` line elsewhere is doing; the definition is
   * what gets written, by the `abbreviation` node. Emitting anything here would invent markup the
   * author never typed — and it would be re-applied on the next parse, so it would grow every time.
   */
  abbr: { open: '', close: '', mixable: true },

  /**
   * A link, written back in whichever syntax it arrived in.
   *
   * A wikilink whose text is still exactly what it shows by default is `[[Target]]` -- the target
   * itself, or for `[[Glossary:REST]]` the term, so the bare form opens with the namespace and the
   * text supplies the rest. One whose text differs, or carries any other formatting, is
   * `[[Target|text]]`. The piped form is also what a run that is
   * partly bold needs, since the bare form's text is a name and is not parsed as markdown. A title has
   * nowhere to go in either, so a wikilink that gained one is written as an ordinary link.
   */
  link: {
    open: (_state, mark, parent, index) => {
      if (!mark.attrs.wikilink || mark.attrs.title) {
        return '['
      }
      if (!isBareWikiLink(mark, parent, index)) {
        return `[[${mark.attrs.wikilink}|`
      }
      const target = mark.attrs.wikilink
      return `[[${target.slice(0, target.length - wikiLinkText(target).length)}`
    },
    close: (_state, mark) =>
      mark.attrs.wikilink && !mark.attrs.title
        ? `]]${writeMdAttrs(mark.attrs.mdAttrs)}`
        : `](${mark.attrs.href.replace(/[()"]/g, '\\$&')}${
            mark.attrs.title ? ` "${mark.attrs.title.replace(/"/g, '\\"')}"` : ''
          })${writeMdAttrs(mark.attrs.mdAttrs)}`,
    mixable: true
  },

  code: {
    open: (_state, _mark, parent, index) => backticksFor(parent.child(index), -1),
    close: (_state, _mark, parent, index) => backticksFor(parent.child(index - 1), 1),
    escape: false
  }
}

/**
 * Whether a wikilink can be written as `[[Target]]`: its run of the paragraph is nothing but text
 * that says exactly what the link shows by default, with no mark on it besides the link itself.
 */
function isBareWikiLink(mark, parent, index) {
  let text = ''
  for (let i = index; i < parent.childCount; i++) {
    const child = parent.child(i)
    if (!mark.isInSet(child.marks)) {
      break
    }
    if (!child.isText || child.marks.length > 1) {
      return false
    }
    text += child.text
  }
  return text === wikiLinkText(mark.attrs.wikilink)
}

/** A run of backticks long enough to delimit a code span containing backticks of its own. */
function backticksFor(node, side) {
  const pattern = /`+/g
  let length = 0
  if (node.isText) {
    let match
    while ((match = pattern.exec(node.text))) {
      length = Math.max(length, match[0].length)
    }
  }
  let result = length > 0 && side > 0 ? ' `' : '`'
  for (let i = 0; i < length; i++) {
    result += '`'
  }
  if (length > 0 && side < 0) {
    result += ' '
  }
  return result
}

/** The `{…}` suffix a block carries, written on the end of its last line. */
function writeAttrsSuffix(state, node) {
  const suffix = writeMdAttrs(node.attrs.mdAttrs)
  if (suffix) {
    state.write(` ${suffix}`)
  }
}

/**
 * The same, for a list — which wears its attributes on a line of its own underneath.
 *
 * `markdown-it-attrs` reads a brace at the start of the line after a list as belonging to the list,
 * and there is nowhere else to put it: the end of the last item's line is that ITEM's attributes.
 */
function writeListAttrs(state, node) {
  const suffix = writeMdAttrs(node.attrs.mdAttrs)
  if (suffix) {
    state.write(suffix)
    state.closeBlock(node)
  }
}

export const serializer = new MarkdownSerializer(nodes, marks)

/** Where the emoji plugin lets an emoticon start or end: not against a letter or a digit. */
const EMOTICON_EDGE = String.raw`(?:^|$|[\p{Z}\p{P}\p{Cc}])`

/**
 * An emoticon, as the one character in it to escape: the last punctuation, which leaves no shorter
 * emoticon on either side of the backslash. An escaped character before it counts as an edge, since
 * markdown-it ends the text token there — and its own boundary rule is what keeps the `:/` in
 * `https://` a URL.
 */
function emoticonPattern(emoticon) {
  const at = emoticon.search(/[^\p{L}\p{N}][\p{L}\p{N}]*$/u)
  const quote = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (
    String.raw`(?<=(?:${EMOTICON_EDGE}|\\[!-/:-@[-${'`'}{-~])${quote(emoticon.slice(0, at))})` +
    `${quote(emoticon[at])}(?=${quote(emoticon.slice(at + 1))}${EMOTICON_EDGE})`
  )
}

/**
 * Characters in typed text that the site's renderer would read as markup, beyond what `esc()` covers,
 * one character per match — `esc()` puts a backslash before each.
 *
 * Kept in step with `WIKI_MARKUP` in `backend/helpers/htmlToMarkdown.ts`, which escapes the same text
 * the same way when a 2.x page is converted: the page it writes is edited here, and saving it must not
 * undo what the conversion escaped. Each rule is limited to the cases that would be read as markup,
 * so `a < b` or `10:30` is left alone rather than littering the source with backslashes, and none
 * matches a character `esc()` has escaped already, which escaping again would leave bare.
 */
const ESCAPE_EXTRA = new RegExp(
  String.raw`(?<!(?<!\\)\\(?:\\\\)*)(?:` +
    [
      // -> Raw HTML (`zpool replace <pool>`, `</div>`, a comment) and autolinks, which would be
      //    rendered as such and vanish from the page
      '<(?=[a-z0-9/!?])',
      // -> An entity (`&copy;`), which would be shown as the character it names
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
      ...Object.values(emoticons).flat().map(emoticonPattern)
    ].join('|') +
    ')',
  'giu'
)

/**
 * @param {import('prosemirror-model').Node} doc
 * @param {object} config The site's markdown editor config, the one the parser was built with. What
 *        a table can say depends on it: `multimdTable` decides whether a merge can be written, and
 *        `allowHTML` / `lineBreaks` whether a line break in a cell can.
 * @returns {string} The page source, with the single trailing newline a file ends on.
 */
export function serialize(doc, config) {
  const text = serializer.serialize(doc, {
    tightLists: true,
    escapeExtraCharacters: ESCAPE_EXTRA,
    site: {
      allowHTML: Boolean(config.allowHTML),
      lineBreaks: Boolean(config.lineBreaks),
      multimdTable: Boolean(config.multimdTable)
    }
  })
  return text.endsWith('\n') ? text : `${text}\n`
}
