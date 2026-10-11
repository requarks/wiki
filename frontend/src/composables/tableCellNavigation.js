import * as monaco from 'monaco-editor'
import { Selection } from 'monaco-editor'

import { findEditableTables, isCellRow, tableCellMove } from '@/helpers/markdownTable'

/**
 * Tab and Shift+Tab between the cells of a table, for the Markdown editor. Where they go is
 * `tableCellMove`'s answer; past the last cell, Tab adds a row the way the "Add Row" lens does.
 *
 * Bound only while the caret is in one of a table's rows of cells, through a context key kept up to
 * date as the caret moves -- so everywhere else, the delimiter row included, Tab is Monaco's own and
 * indents. It also stands aside wherever Tab already means something: an open suggestion list, a snippet
 * being filled in (picking a block writes one), an inline suggestion, Tab-moves-focus mode, and several
 * cursors at once. The tables are the ones the lenses are offered over, which are the ones whose cells
 * can be read back reliably.
 *
 * Call it during `setup`. Then `register()` once the editor exists, and `dispose()` with the editor.
 *
 * @param {object} opts
 * @param {() => object} opts.getEditor The Monaco editor, once there is one.
 * @param {(line: number) => void} opts.addRow Adds a row to the table at a line and moves into it.
 */
export function useTableCellNavigation({ getEditor, addRow }) {
  let inCell = null
  let disposables = []
  /** The tables, read once per version of the text rather than once per caret move. */
  let cache = { version: -1, tables: [] }

  function register() {
    const editor = getEditor()
    inCell = editor.createContextKey('markdownTableCell', false)
    const precondition = [
      'markdownTableCell',
      '!suggestWidgetVisible',
      '!inSnippetMode',
      '!inlineSuggestionVisible',
      '!editorTabMovesFocus',
      '!editorReadonly'
    ].join(' && ')
    disposables = [
      editor.onDidChangeCursorSelection(update),
      editor.onDidChangeModelContent(update),
      editor.addAction({
        id: 'markdown.extension.table.nextCell',
        label: 'Table: Next Cell',
        keybindings: [monaco.KeyCode.Tab],
        precondition,
        run: () => move(1)
      }),
      editor.addAction({
        id: 'markdown.extension.table.previousCell',
        label: 'Table: Previous Cell',
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Tab],
        precondition,
        run: () => move(-1)
      })
    ]
  }

  function dispose() {
    for (const disposable of disposables) {
      disposable.dispose()
    }
    disposables = []
  }

  /** The table holding a line, if it is one the lenses are offered over. */
  function tableAt(line) {
    const model = getEditor().getModel()
    if (cache.version !== model.getVersionId()) {
      cache = { version: model.getVersionId(), tables: findEditableTables(model.getValue()) }
    }
    return cache.tables.find((table) => table.startLine <= line && line <= table.endLine)
  }

  /**
   * Whether Tab is ours: one caret, or one selection on a single line -- since Tab selects a cell's
   * text, the next Tab starts from a selection -- in a row of cells.
   */
  function update() {
    const selections = getEditor().getSelections() ?? []
    const [selection] = selections
    const table =
      selections.length === 1 && selection.startLineNumber === selection.endLineNumber
        ? tableAt(selection.startLineNumber)
        : null
    inCell.set(Boolean(table) && isCellRow(table, selection.startLineNumber))
  }

  /**
   * The move itself, from where the selection starts -- which for a cell's text Tab selected is the
   * start of that text, so it reads as the cell it is in. Shift+Tab from the first cell of the table
   * goes nowhere, rather than falling back to an outdent that would edit the row.
   */
  function move(direction) {
    const editor = getEditor()
    const selection = editor.getSelection()
    const table = tableAt(selection.startLineNumber)
    const target =
      table && tableCellMove(table, selection.startLineNumber, selection.startColumn, direction)
    if (target === 'addRow') {
      addRow(table.startLine)
    } else if (target) {
      const range = new Selection(target.line, target.startColumn, target.line, target.endColumn)
      editor.setSelection(range)
      editor.revealRangeInCenterIfOutsideViewport(range)
    }
  }

  return { register, dispose }
}
