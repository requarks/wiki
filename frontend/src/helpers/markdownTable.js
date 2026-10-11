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

/**
 * A delimiter cell of a compact column: three characters, with at most one space either side. Only asked
 * of a cell already known to be a delimiter cell, so three of `-` and `:` is enough to say it.
 */
const COMPACT_DELIMITER_CELL = /^ ?[-:]{3} ?$/

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

/**
 * A table's lines as the two quick actions below need them: which line is the delimiter row, and where
 * the rows end -- before the `{.class}` line, if the table has one, which is not a row.
 *
 * @param {string} source A table's source, from `findEditableTables`.
 */
function tableLayout(source) {
  const lines = source.split('\n')
  return {
    lines,
    delimiterAt: parseDelimiters(lines[0]) ? 0 : 1,
    lastRow: ATTRS_LINE.test(lines.at(-1) ?? '') ? lines.length - 2 : lines.length - 1,
    columns: parseTable(source).align.length
  }
}

/**
 * An empty row for the "Add Row" lens, and where it goes: under the row the caret is in, or under the
 * last row when the caret is in the header, the delimiter row, or not in the table at all.
 *
 * Edited in place rather than through `buildTable`, which would rewrite every row and state alignments
 * the author left out. The new row is built cell by cell off the delimiter row, with its pipes and
 * indentation, and each cell is as wide as the delimiter cell above it -- unless that one is the three
 * characters a compact column is written with (`---`, `:-:`, with or without a space either side), in
 * which case the column is not padded and its new cell is two spaces, the empty cell compact tables
 * write. A column the delimiter row is short of -- see `parseTable` -- is added the compact way too.
 *
 * @param {{ startLine: number, source: string }} table From `findEditableTables`.
 * @param {number|null} caretLine 1-based, or null for no caret in the editor.
 * @returns {{ afterLine: number, text: string, column: number }} The row, the 1-based line it goes
 *          under, and the 1-based column of its first cell.
 */
export function tableRowToAdd(table, caretLine) {
  const { lines, delimiterAt, lastRow, columns } = tableLayout(table.source)
  const offset = (caretLine ?? 0) - table.startLine
  const after = offset > delimiterAt && offset <= lastRow ? offset : lastRow

  const delimiter = lines[delimiterAt].trimEnd()
  const indent = delimiter.slice(0, delimiter.length - delimiter.trimStart().length)
  const leading = delimiter.trimStart().startsWith('|')
  const raw = rawCells(delimiter)
  // -> Without a leading pipe the indentation is the first cell's, and is not part of its width
  if (!leading) {
    raw[0] = raw[0].slice(indent.length)
  }
  const cells = raw.map((cell) =>
    COMPACT_DELIMITER_CELL.test(cell) ? '  ' : cell.replaceAll(/[-:]/g, ' ')
  )
  cells.push(...Array(Math.max(0, columns - cells.length)).fill('  '))
  /*
    Two things change for a table written without outer pipes. The row is closed with one, since an
    empty last cell with nothing after it is no cell at all. And the first cell is cut to one space: it
    is all whitespace at the start of the line, and four of it would make the row an indented code
    block.
  */
  if (!leading) {
    cells[0] = ' '
  }
  const text = `${indent}${leading ? '|' : ''}${cells.join('|')}|`

  // -> One space into the first cell, or as far as it goes in a table written `|-|`
  const first = text.indexOf('|')
  const next = text.indexOf('|', first + 1)
  const column = leading ? Math.min(first + 2, next < 0 ? text.length : next) : indent.length
  return { afterLine: table.startLine + after, text, column: column + 1 }
}

/**
 * Every row of a table with one empty column added at the end, for the "Add Column" lens.
 *
 * In place, for the reason `tableRowToAdd` gives, and compact: ` --- ` in the delimiter row and an
 * empty cell of two spaces in every other, which is the shape `tableRowToAdd` reads a compact column
 * as. A row with fewer cells than the table -- which markdown allows -- is filled out first, the same
 * way, or the new cell would land in somebody else's column. And
 * every row ends in a pipe afterwards: without one, an empty last cell is not a cell at all, since a
 * trailing pipe is read as closing the row rather than as opening another.
 *
 * @param {{ startLine: number, source: string }} table From `findEditableTables`.
 * @returns {{ startLine: number, endLine: number, text: string, caret: { line: number, column: number } }}
 *          The rows to replace, 1-based and inclusive, what replaces them, and where the caret goes:
 *          the new cell of the first row that is not the delimiter.
 */
export function tableWithColumnAdded(table) {
  const { lines, delimiterAt, lastRow, columns } = tableLayout(table.source)
  const rows = lines.slice(0, lastRow + 1).map((line, index) => {
    const blank = index === delimiterAt ? ' --- |' : '  |'
    const added = Math.max(0, columns - rawCells(line).length) + 1
    const trimmed = line.trimEnd()
    const closed = trimmed.endsWith('|') && !trimmed.endsWith('\\|')
    return `${closed ? trimmed : `${trimmed} |`}${blank.repeat(added)}`
  })
  const caretRow = delimiterAt === 0 ? 1 : 0
  return {
    startLine: table.startLine,
    endLine: table.startLine + lastRow,
    text: rows.join('\n'),
    // -> One space into the new cell, which each row ends with as `  |`
    caret: { line: table.startLine + caretRow, column: rows[caretRow].length - 1 }
  }
}

/**
 * Where each cell of one row sits, 0-based with `end` exclusive: between its pipes (`start`, `end`) and
 * where its text is once the padding is left out (`textStart`, `textEnd`).
 *
 * The same reading as `rawCells` -- an escaped `\|` is part of a cell, and the outer pipes leave no
 * cell of their own -- but positions rather than strings, which is what moving the caret needs.
 *
 * @param {string} line One row of a table.
 * @returns {Array<{ start: number, end: number, textStart: number, textEnd: number }>}
 */
function cellSpans(line) {
  const bounds = [-1]
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '\\' && line[index + 1] === '|') {
      index++
    } else if (line[index] === '|') {
      bounds.push(index)
    }
  }
  bounds.push(line.length)
  const spans = bounds.slice(0, -1).map((bound, index) => {
    const start = bound + 1
    const end = bounds[index + 1]
    const text = line.slice(start, end)
    const textStart = start + text.length - text.trimStart().length
    return { start, end, textStart, textEnd: textStart + text.trim().length }
  })
  const trimmed = line.trim()
  const blank = (span) => span && span.textStart === span.textEnd
  if (trimmed.startsWith('|') && blank(spans[0])) {
    spans.shift()
  }
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|') && blank(spans.at(-1))) {
    spans.pop()
  }
  return spans
}

/**
 * The indexes of a table's rows that hold cells: every line of it but the delimiter row and the
 * `{.class}` line.
 */
function cellRows(source) {
  const { lines, delimiterAt, lastRow } = tableLayout(source)
  return {
    lines,
    rows: Array.from({ length: lastRow + 1 }, (_, index) => index).filter(
      (index) => index !== delimiterAt
    )
  }
}

/**
 * Whether a line of the source is one of the table's rows of cells -- the header or a body row -- which
 * is where Tab moves between cells rather than indenting.
 *
 * @param {{ startLine: number, source: string }} table From `findEditableTables`.
 * @param {number} line 1-based.
 */
export function isCellRow(table, line) {
  return cellRows(table.source).rows.includes(line - table.startLine)
}

/**
 * Where Tab (`direction` 1) or Shift+Tab (-1) takes the caret from a cell: the next cell along the row,
 * or the first cell of the next row from the end of one -- and the other way round. The delimiter row is
 * never a stop.
 *
 * The cell the caret is in is the one whose closing pipe it has not passed, so a caret in the padding
 * or against a pipe belongs to the cell on its left, and one in the indentation before a row to its
 * first cell. A row written short of cells is simply left sooner.
 *
 * What it answers is a range to select: the cell's text, so that typing replaces it the way it does in a
 * spreadsheet, or a caret one space into a cell that is empty. Past the last cell of the table it
 * answers `'addRow'`, for the editor to add one and move into it; before the first, null.
 *
 * @param {{ startLine: number, source: string }} table From `findEditableTables`.
 * @param {number} line 1-based.
 * @param {number} column 1-based.
 * @param {1|-1} direction
 * @returns {{ line: number, startColumn: number, endColumn: number } | 'addRow' | null}
 */
export function tableCellMove(table, line, column, direction) {
  const { lines, rows } = cellRows(table.source)
  const at = rows.indexOf(line - table.startLine)
  if (at < 0) {
    return null
  }
  const target = (row, span) => {
    if (!span) {
      return null
    }
    if (span.textEnd > span.textStart) {
      return {
        line: table.startLine + row,
        startColumn: span.textStart + 1,
        endColumn: span.textEnd + 1
      }
    }
    const caret = Math.min(span.start + 1, span.end) + 1
    return { line: table.startLine + row, startColumn: caret, endColumn: caret }
  }

  const spans = cellSpans(lines[rows[at]])
  const found = spans.findIndex((span) => column - 1 <= span.end)
  const cell = found < 0 ? spans.length - 1 : found
  if (direction > 0) {
    if (cell + 1 < spans.length) {
      return target(rows[at], spans[cell + 1])
    }
    if (at + 1 < rows.length) {
      return target(rows[at + 1], cellSpans(lines[rows[at + 1]])[0])
    }
    return 'addRow'
  }
  if (cell > 0) {
    return target(rows[at], spans[cell - 1])
  }
  if (at > 0) {
    return target(rows[at - 1], cellSpans(lines[rows[at - 1]]).at(-1))
  }
  return null
}
