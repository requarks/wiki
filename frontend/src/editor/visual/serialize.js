import { MarkdownSerializer } from 'prosemirror-markdown'

import { KINDS } from '@/renderers/modules/github-alerts'

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

/** `::block-name{a="b"}`, the opening line both block nodes share. */
function blockOpening(node, fence) {
  const attrs = node.attrs.blockAttrs ?? {}
  const written = Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    // -> A double quote would close the attribute and MDC has no escape for it, exactly as
    //    `helpers/blocks.js` writes them
    .map(([name, value]) => `${name}="${String(value).replaceAll('"', "'")}"`)
  const suffix = written.length > 0 ? `{${written.join(' ')}}` : ''
  return `${fence}block-${node.attrs.name}${suffix}`
}

/**
 * A table row as one pipe-delimited line.
 *
 * Cells are rendered as inline markdown: a pipe table has one line per row, so a cell holding more
 * than a paragraph cannot be written as one. Rather than refuse, the paragraphs are joined with a
 * space and the round-trip check is what tells the author the page no longer renders the same — which
 * is the honest failure for a construct this format genuinely cannot express.
 */
function tableRow(state, row) {
  const cells = []
  row.forEach((cell) => {
    const parts = []
    cell.forEach((child) => {
      parts.push(inlineOf(state, child))
    })
    /*
      A literal pipe would end the cell, so it is escaped here rather than by the text rule, which has
      no idea it is inside a table. One that is already escaped is left alone: a code span may hold
      `a\|b` as its literal text, and escaping the escape would put a second backslash on the page.
    */
    cells.push(
      parts
        .join(' ')
        .replace(/\\?\|/g, (match) => (match === '|' ? '\\|' : match))
        .trim()
    )
  })
  return `| ${cells.join(' | ')} |`
}

/**
 * One block's inline content as a string, rendered through a throwaway serializer state.
 *
 * `MarkdownSerializerState` writes into an accumulator it owns, and a table cell has to be turned
 * into text before the row it belongs to can be written at all — so the cell is rendered on a state
 * of its own and the result taken out of it.
 */
function inlineOf(state, node) {
  if (node.isTextblock) {
    const sub = new state.constructor(state.nodes, state.marks, state.options)
    sub.renderInline(node)
    return sub.out.trim()
  }
  return node.textContent
}

/** The delimiter row, which is also where a pipe table says how each column is set. */
function alignmentRow(row) {
  const cells = []
  row.forEach((cell) => {
    const align = cell.attrs.align
    cells.push(
      align === 'center' ? ':---:' : align === 'right' ? '---:' : align === 'left' ? ':---' : '---'
    )
  })
  return `| ${cells.join(' | ')} |`
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

  blockquote(state, node) {
    state.wrapBlock('> ', null, node, () => state.renderContent(node))
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
    node.forEach((row, _offset, index) => {
      state.write(tableRow(state, row))
      state.ensureNewLine()
      /*
        The delimiter row goes under the first row when that row is the header — which in markdown is
        the only place it can go, and the only thing that makes the table a table.
      */
      if (index === 0) {
        state.write(alignmentRow(row))
        state.ensureNewLine()
      }
    })
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
    const src = node.attrs.src.replace(/[()]/g, '\\$&')
    const title = node.attrs.title ? ` "${node.attrs.title.replace(/"/g, '\\"')}"` : ''
    /*
      `markdown-it-imsize`'s own syntax, which is a suffix on the destination. Either half may be
      missing -- `=300x`, `=x200` -- and both are written, because a height on its own is a size the
      plugin reads and dropping it would resize the picture on a save nobody asked to resize it in.
    */
    const size =
      node.attrs.width || node.attrs.height
        ? ` =${node.attrs.width ?? ''}x${node.attrs.height ?? ''}`
        : ''
    state.write(
      `![${state.esc(node.attrs.alt || '')}](${src}${size}${title})${writeMdAttrs(node.attrs.mdAttrs)}`
    )
  },

  /**
   * A line break, as whichever of the two kinds it was.
   *
   * A trailing break is dropped: markdown has nowhere to put one, and writing it would leave a stray
   * backslash at the end of a paragraph.
   */
  hard_break(state, node, parent, index) {
    for (let i = index + 1; i < parent.childCount; i++) {
      if (parent.child(i).type !== node.type) {
        state.write(node.attrs.markup === 'soft' ? '\n' : '\\\n')
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
   * A wikilink whose text is still exactly its target is `[[Target]]`; one whose text differs, or
   * carries any other formatting, is `[[Target|text]]`. The piped form is also what a run that is
   * partly bold needs, since the bare form's text is a name and is not parsed as markdown. A title has
   * nowhere to go in either, so a wikilink that gained one is written as an ordinary link.
   */
  link: {
    open: (_state, mark, parent, index) => {
      if (!mark.attrs.wikilink || mark.attrs.title) {
        return '['
      }
      return isBareWikiLink(mark, parent, index) ? '[[' : `[[${mark.attrs.wikilink}|`
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
 * that says exactly what the target says, with no mark on it besides the link itself.
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
  return text === mark.attrs.wikilink
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

/**
 * @param {import('prosemirror-model').Node} doc
 * @returns {string} The page source, with the single trailing newline a file ends on.
 */
export function serialize(doc) {
  const text = serializer.serialize(doc, { tightLists: true })
  return text.endsWith('\n') ? text : `${text}\n`
}
