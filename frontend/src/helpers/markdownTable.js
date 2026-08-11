/**
 * Markdown tables, written and read back.
 *
 * Both directions live here because they have to agree on one shape: `TableEditorOverlay` writes a table
 * with `buildTable`, the markdown editor finds one with `findEditableTables` so it can offer to edit it,
 * and the overlay reads it back with `parseTable`. Two definitions of "what a table looks like" would
 * mean a table that came back out of the editor differing from the one that went in, in whitespace
 * nobody asked to change.
 *
 * A table is a grid of one-line strings plus an alignment per column, which is the only formatting the
 * syntax carries. Everything else a MultiMarkdown table can do -- a multi-line cell, a `^^` rowspan, a
 * second body, no header at all -- has nowhere to go in that model, which is what `findEditableTables`
 * is for: it offers only the tables that survive the round trip.
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
 */
export function buildTable({ align, rows }, { compact = true } = {}) {
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
  return [line(cells[0]), line(delimiters), ...cells.slice(1).map((row) => line(row))].join('\n')
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
function isCompact(lines) {
  const unpadded = (raw) => {
    const value = raw.trim()
    return value === '' ? raw.length <= 2 : raw === value || raw === ` ${value} `
  }
  return lines.every((line, index) =>
    rawCells(line).every((raw) => unpadded(raw) && (index !== 1 || raw.trim().length <= MIN_WIDTH))
  )
}

/**
 * A table's source as the editor's own state: `rows[0]` is the header, one alignment per column.
 *
 * The column count is the widest row rather than the delimiter row's, so a body row carrying more cells
 * than the header -- which markdown itself drops on the floor -- arrives as a column the author can see
 * and deal with, instead of being deleted by opening the editor.
 */
export function parseTable(source) {
  const lines = source.split('\n').filter((line) => line.trim() !== '')
  const align = parseDelimiters(lines[1]) ?? []
  const rows = [splitRow(lines[0] ?? ''), ...lines.slice(2).map(splitRow)]
  const columns = Math.max(1, align.length, ...rows.map((row) => row.length))
  return {
    align: Array.from({ length: columns }, (_, i) => align[i] ?? 'left'),
    rows: rows.map((row) => Array.from({ length: columns }, (_, i) => row[i] ?? '')),
    compact: isCompact(lines)
  }
}

/**
 * Whether the table ending at `last` carries on below it.
 *
 * A MultiMarkdown table may have a second body, separated from the first by one blank line, and it is
 * part of the same table -- so a lens over the first half would offer to replace a piece of a table and
 * leave the rest of it stranded. Told apart from an ordinary table that merely follows this one by
 * whether that next row brings a delimiter row of its own; a paragraph holding a pipe reads as a
 * continuation too, and costs only the offer to edit.
 */
function continuesBelow(lines, last) {
  if ((lines[last + 1] ?? '').trim() !== '' || !lines[last + 2]?.includes('|')) {
    return false
  }
  return !parseDelimiters(lines[last + 3])
}

/**
 * Every table in the source that the table editor can hold, in the order they appear.
 *
 * Line numbers are 1-based, to be handed straight to the editor.
 *
 * What is deliberately left out: a table inside a fenced block, which is a code sample and not a table;
 * a headerless table, whose first line is already the delimiter row; and a table using a multi-line
 * cell, a `^^` rowspan or a second body. The editor's model has no place to keep any of those, so
 * offering to edit one would be offering to throw it away.
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

    // -> A header row and then a delimiter row. A delimiter row FIRST is a headerless table
    if (!lines[index].includes('|') || parseDelimiters(lines[index])) {
      continue
    }
    if (!parseDelimiters(lines[index + 1])) {
      continue
    }

    const start = index
    let last = index + 1
    while ((lines[last + 1] ?? '').trim() !== '' && lines[last + 1].includes('|')) {
      last++
    }
    // -> Whatever this block turns out to be, no line of it starts another table
    index = last

    const body = lines.slice(start + 2, last + 1)
    if (
      body.some((line) => line.trimEnd().endsWith('\\')) ||
      body.some((line) => splitRow(line).includes('^^')) ||
      continuesBelow(lines, last)
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
