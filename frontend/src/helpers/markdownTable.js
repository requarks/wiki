/**
 * Markdown tables, written and read back.
 *
 * Both directions live here because they have to agree on one shape: `TableEditorOverlay` writes a table
 * with `buildTable`, the markdown editor finds one with `findEditableTables` so it can offer to edit it,
 * and the overlay reads it back with `parseTable`. Two definitions of "what a table looks like" would
 * mean a table that came back out of the editor differing from the one that went in, in whitespace
 * nobody asked to change.
 *
 * A table is a grid of one-line strings, an alignment per column -- the only formatting the syntax
 * carries -- and whether it has a header row at all. What a MultiMarkdown table can do beyond that, a
 * multi-line cell or a `^^` rowspan or a second body, has nowhere to go in that model, which is what
 * `findEditableTables` is for: it offers only the tables that survive the round trip.
 *
 * A headerless table is MultiMarkdown syntax -- the delimiter row comes first and there is no header
 * above it -- so one renders as a table only while the site has the MultiMarkdown Table option on. It is
 * on by default; the editor's preview pane is where an author would see it if it were not.
 */

/** Narrowest a delimiter cell can be and still show its colons: `:-:`. */
const MIN_WIDTH = 3

/** Cycled through by the editor's per-column button, in this order. */
export const ALIGNMENTS = ['left', 'center', 'right']

/** A delimiter row's cell, and nothing else: dashes, with a colon at either end or both. */
const DELIMITER_CELL = /^:?-+:?$/

/** The opening or closing line of a fenced block, indented up to the three spaces markdown allows. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/

/**
 * A `markdown-it-attrs` line: `{.some-class}` under a block, which is how a table carries the classes
 * the content stylesheet styles it by. It belongs to the table above it, so it belongs to the table.
 */
const ATTRS_LINE = /^ {0,3}\{([^}]*)\}\s*$/

/**
 * A cell as it is written into a row.
 *
 * Its own `|` is escaped, and a newline -- which only a paste can produce -- becomes a space, because
 * there is no way to write either into a table row.
 */
export function escapeCell(value) {
  return (value ?? '').replaceAll('|', '\\|').replaceAll(/\s+/g, ' ').trim()
}

/**
 * The table as markdown.
 *
 * `compact` writes each cell as it is; without it every column is padded to its widest cell, which
 * lines the columns up under their headers and costs a rewrite of the whole block on every edit. Either
 * way the delimiter row is as wide as the column, so the two stay in step.
 *
 * `headerless` puts the delimiter row first and no row above it, which is how MultiMarkdown says a table
 * has no header: every row of `rows` is then a body row rather than `rows[0]` being the head.
 *
 * `classes` and `otherAttrs` become the `markdown-it-attrs` line under the table, if either holds
 * anything. `otherAttrs` is whatever the author had in there that is not a class -- an `#id`, say -- kept
 * verbatim so that reading a table and writing it back does not quietly drop half of its attributes.
 */
export function buildTable(
  { align, rows, headerless = false, classes = [], otherAttrs = [] },
  { compact = true } = {}
) {
  const cells = rows.map((row) => align.map((_, colIndex) => escapeCell(row[colIndex])))
  const widths = align.map((_, colIndex) =>
    compact ? MIN_WIDTH : Math.max(MIN_WIDTH, ...cells.map((row) => row[colIndex].length))
  )
  const line = (row) =>
    `| ${row.map((cell, i) => (compact ? cell : cell.padEnd(widths[i]))).join(' | ')} |`
  const delimiters = align.map((value, i) => {
    const dashes = '-'.repeat(widths[i] - (value === 'center' ? 2 : 1))
    switch (value) {
      case 'center': {
        return `:${dashes}:`
      }
      case 'right': {
        return `${dashes}:`
      }
      default: {
        return `:${dashes}`
      }
    }
  })
  const body = headerless
    ? [line(delimiters), ...cells.map((row) => line(row))]
    : [line(cells[0]), line(delimiters), ...cells.slice(1).map((row) => line(row))]

  const attrs = [...classes.map((name) => `.${name}`), ...otherAttrs]
  // -> Directly under the last row, with no blank line: that is the only place it attaches to the table
  return (attrs.length > 0 ? [...body, `{${attrs.join(' ')}}`] : body).join('\n')
}

/**
 * The raw text between one row's pipes, unsplit and untrimmed -- what `isCompact` measures.
 *
 * An escaped `\|` is not a separator, and the outer pipes markdown allows on each side leave an empty
 * segment at each end which is not a column.
 */
function rawCells(line) {
  const cells = []
  let cell = ''
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '\\' && line[index + 1] === '|') {
      cell += '|'
      index++
      continue
    }
    if (line[index] === '|') {
      cells.push(cell)
      cell = ''
      continue
    }
    cell += line[index]
  }
  cells.push(cell)
  const trimmed = line.trim()
  if (trimmed.startsWith('|') && cells[0].trim() === '') {
    cells.shift()
  }
  if (trimmed.endsWith('|') && cells.length > 0 && cells.at(-1).trim() === '') {
    cells.pop()
  }
  return cells
}

/** One row's cells, as the values they hold. */
function splitRow(line) {
  return rawCells(line).map((cell) => cell.trim())
}

/**
 * The alignments a delimiter row states, or `null` if the line is not one.
 *
 * This is also what tells a table's header row from a paragraph that happens to hold a pipe: a table is
 * a line followed by one of these.
 *
 * A cell with no colon means no alignment, which renders as left and is stored as `left` -- the editor
 * has no fourth state to keep it in, so writing such a table back states the colon it left out.
 */
function parseDelimiters(line) {
  if (!line?.includes('|') && !/^ {0,3}:?-+:?$/.test(line ?? '')) {
    return null
  }
  const cells = splitRow(line)
  if (cells.length === 0 || !cells.every((cell) => DELIMITER_CELL.test(cell))) {
    return null
  }
  return cells.map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) {
      return 'center'
    }
    return cell.endsWith(':') ? 'right' : 'left'
  })
}

/**
 * Whether the source was written compact, so that reading a table and writing it back does not reformat
 * it on the author's behalf.
 *
 * Measured on the whitespace rather than by building the table both ways and comparing: a hand-written
 * table is compact whether it was written `|a|b|` or `| a | b |`, and neither is what either branch of
 * `buildTable` emits exactly. What padding looks like is a cell holding spaces beyond the single one
 * that keeps the text off the pipe -- and, in a delimiter row, a run of dashes longer than the three a
 * compact table ever needs.
 */
function isCompact(lines, delimiterAt) {
  const unpadded = (raw) => {
    const value = raw.trim()
    return value === '' ? raw.length <= 2 : raw === value || raw === ` ${value} `
  }
  return lines.every((line, index) =>
    rawCells(line).every(
      (raw) => unpadded(raw) && (index !== delimiterAt || raw.trim().length <= MIN_WIDTH)
    )
  )
}

/**
 * A table's source as the editor's own state: one alignment per column, and `rows[0]` as the header
 * unless the table is headerless, in which case every row is a body row.
 *
 * Which of the two it is comes from where the delimiter row is -- first line, or second.
 *
 * The column count is the widest row rather than the delimiter row's, so a body row carrying more cells
 * than the header -- which markdown itself drops on the floor -- arrives as a column the author can see
 * and deal with, instead of being deleted by opening the editor.
 */
export function parseTable(source) {
  const all = source.split('\n').filter((line) => line.trim() !== '')
  /*
    The attrs line, if the table has one, comes off before anything else looks at the rows -- it is the
    only line of the block that is not one. Its tokens are split into the classes, which the editor
    offers, and everything else, which it carries through untouched.
  */
  const attrs = ATTRS_LINE.exec(all.at(-1) ?? '')
  const tokens = attrs ? attrs[1].trim().split(/\s+/).filter(Boolean) : []
  const lines = attrs ? all.slice(0, -1) : all
  const headerless = Boolean(parseDelimiters(lines[0]))
  const delimiterAt = headerless ? 0 : 1
  const align = parseDelimiters(lines[delimiterAt]) ?? []
  const body = lines.slice(delimiterAt + 1).map(splitRow)
  const rows = headerless ? body : [splitRow(lines[0] ?? ''), ...body]
  const columns = Math.max(1, align.length, ...rows.map((row) => row.length))
  return {
    align: Array.from({ length: columns }, (_, i) => align[i] ?? 'left'),
    rows: rows.map((row) => Array.from({ length: columns }, (_, i) => row[i] ?? '')),
    compact: isCompact(lines, delimiterAt),
    headerless,
    classes: tokens.filter((token) => token.startsWith('.')).map((token) => token.slice(1)),
    otherAttrs: tokens.filter((token) => !token.startsWith('.'))
  }
}

/**
 * Whether the table ending at `last` carries on below it.
 *
 * A MultiMarkdown table may have a second body, separated from the first by one blank line, and it is
 * part of the same table -- so a lens over the first half would offer to replace a piece of a table and
 * leave the rest of it stranded.
 *
 * Four things have to hold for that reading, because everything else that can sit under a table is far
 * more common than a second body: one blank line, then a row that opens with a pipe, carries this
 * table's number of columns, is not a delimiter row (that would start a headerless table of its own) and
 * is not followed by one (that would make it the header of an ordinary one). A paragraph that happens to
 * hold a pipe fails the first of those, which is what keeps it from costing the table above its lens.
 */
function continuesBelow(lines, last, columns) {
  const next = lines[last + 2]
  if ((lines[last + 1] ?? '').trim() !== '' || !/^ {0,3}\|/.test(next ?? '')) {
    return false
  }
  if (parseDelimiters(next) || parseDelimiters(lines[last + 3])) {
    return false
  }
  return splitRow(next).length === columns
}

/**
 * Every table in the source that the table editor can hold, in the order they appear.
 *
 * Line numbers are 1-based, to be handed straight to the editor.
 *
 * What is deliberately left out: a table inside a fenced block, which is a code sample and not a table,
 * and a table using a multi-line cell, a `^^` rowspan or a second body. The editor's model has no place
 * to keep any of those, so offering to edit one would be offering to throw it away.
 */
export function findEditableTables(text) {
  const lines = text.split('\n')
  const tables = []
  let fence = null

  for (let index = 0; index < lines.length; index++) {
    const edge = FENCE.exec(lines[index])
    if (fence) {
      if (edge && edge[1][0] === fence[0] && edge[1].length >= fence.length) {
        fence = null
      }
      continue
    }
    if (edge) {
      fence = edge[1]
      continue
    }

    if (!lines[index].includes('|')) {
      continue
    }
    /*
      Two ways a table starts: a delimiter row on its own, which is a headerless table, or a header row
      with the delimiter row under it. The delimiter row of an ordinary table is never mistaken for the
      first kind, because the loop skips past every line of a block it has already been through.
    */
    const headerless = Boolean(parseDelimiters(lines[index]))
    const align = headerless ? parseDelimiters(lines[index]) : parseDelimiters(lines[index + 1])
    if (!align) {
      continue
    }

    const start = index
    let last = headerless ? index : index + 1
    while ((lines[last + 1] ?? '').trim() !== '' && lines[last + 1].includes('|')) {
      last++
    }
    const bodyEnd = last
    /*
      A `{.class}` line under the last row is part of the table as far as anyone editing it is concerned:
      it is where the table's styling lives, and leaving it out of the range would have an update write a
      second one under the first.
    */
    if (ATTRS_LINE.test(lines[last + 1] ?? '')) {
      last++
    }
    // -> Whatever this block turns out to be, no line of it starts another table
    index = last

    const body = lines.slice(headerless ? start + 1 : start + 2, bodyEnd + 1)
    if (
      // -> A lone delimiter row is not a headerless table, it is a line of dashes and pipes
      (headerless && body.length === 0) ||
      body.some((line) => line.trimEnd().endsWith('\\')) ||
      body.some((line) => splitRow(line).includes('^^')) ||
      continuesBelow(lines, last, align.length)
    ) {
      continue
    }

    tables.push({
      startLine: start + 1,
      endLine: last + 1,
      source: lines.slice(start, last + 1).join('\n')
    })
  }

  return tables
}
