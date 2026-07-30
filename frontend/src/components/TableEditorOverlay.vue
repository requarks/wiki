<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/color-data-grid.svg" left size="md" />
      <span>{{ t(`editor.tableEditor.title`) }}</span>
      <w-space />
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.viewDocs`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/editor/markdown`"
        target="_blank"
        type="a" />
      <w-btn-group push>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.cancel`)"
          :aria-label="t(`common.actions.cancel`)"
          icon="la:times"
          @click="close" />
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(`common.actions.insert`)"
          :aria-label="t(`common.actions.insert`)"
          icon="la:check"
          @click="insert" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <w-page class="p-4">
        <div class="flex flex-wrap items-center gap-2">
          <w-btn
            outline
            no-caps
            icon="la:plus"
            color="primary"
            padding="xs sm"
            :label="t(`editor.tableEditor.addRow`)"
            @click="addRow" />
          <w-btn
            outline
            no-caps
            icon="la:plus"
            color="primary"
            padding="xs sm"
            :label="t(`editor.tableEditor.addColumn`)"
            @click="addColumn" />
          <w-space />
          <div class="text-caption text-black/60 dark:text-white/70">
            {{ t('editor.tableEditor.pasteHint') }}
          </div>
        </div>
        <!--
          A plain table of plain inputs, which is what a markdown table is: a grid of one-line strings
          plus an alignment per column. The row above the header holds each column's tools -- its
          alignment, which is the only formatting the syntax can carry, and its delete.
        -->
        <div class="table-editor-grid mt-4">
          <table>
            <thead>
              <tr class="table-editor-tools">
                <th v-for="(align, colIndex) of state.align" :key="`tool-${colIndex}`">
                  <!-- -> Centred over the column rather than pushed to its edges: at the edges the
                          delete button reads as belonging to the boundary between two columns -->
                  <div class="flex flex-nowrap items-center justify-center gap-1">
                    <w-btn
                      flat
                      dense
                      padding="none xs"
                      size="sm"
                      color="primary"
                      :icon="ALIGN_ICONS[align]"
                      :aria-label="t(`editor.tableEditor.align`)"
                      @click="cycleAlign(colIndex)">
                      <w-tooltip>
                        {{ t('editor.tableEditor.align') }}: {{ t(ALIGN_LABELS[align]) }}
                      </w-tooltip>
                    </w-btn>
                    <w-btn
                      flat
                      dense
                      padding="none xs"
                      size="sm"
                      color="negative"
                      icon="la:times"
                      :disabled="state.align.length < 2"
                      :aria-label="t(`editor.tableEditor.removeColumn`)"
                      @click="removeColumn(colIndex)">
                      <w-tooltip>{{ t('editor.tableEditor.removeColumn') }}</w-tooltip>
                    </w-btn>
                  </div>
                </th>
                <!-- -> Matches the row-tools column below, so the grid stays square -->
                <th class="table-editor-rowtools" />
              </tr>
              <tr>
                <th v-for="(_, colIndex) of state.rows[0]" :key="`head-${colIndex}`">
                  <input
                    v-model="state.rows[0][colIndex]"
                    class="table-editor-cell table-editor-cell--head"
                    type="text"
                    :aria-label="t(`editor.tableEditor.headerCell`, { column: colIndex + 1 })"
                    @paste="onCellPaste(0, colIndex, $event)" />
                </th>
                <th class="table-editor-rowtools" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) of bodyRows" :key="`row-${rowIndex}`">
                <td v-for="(_, colIndex) of row" :key="`cell-${rowIndex}-${colIndex}`">
                  <input
                    v-model="state.rows[rowIndex + 1][colIndex]"
                    class="table-editor-cell"
                    type="text"
                    :aria-label="
                      t(`editor.tableEditor.bodyCell`, { row: rowIndex + 1, column: colIndex + 1 })
                    "
                    @paste="onCellPaste(rowIndex + 1, colIndex, $event)" />
                </td>
                <td class="table-editor-rowtools">
                  <w-btn
                    flat
                    dense
                    padding="none xs"
                    size="sm"
                    color="negative"
                    icon="la:times"
                    :disabled="bodyRows.length < 2"
                    :aria-label="t(`editor.tableEditor.removeRow`)"
                    @click="removeRow(rowIndex + 1)">
                    <w-tooltip>{{ t('editor.tableEditor.removeRow') }}</w-tooltip>
                  </w-btn>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- -> The markdown itself, because that is what gets inserted and it is worth seeing before
                it lands in the page -->
        <div class="text-overline mt-6">{{ t('editor.tableEditor.markdown') }}</div>
        <pre class="table-editor-output mt-2">{{ markdown }}</pre>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from '@/stores/site'

/**
 * Builds a markdown table and hands it to the editor.
 *
 * Handmade rather than a data grid. A markdown table is a small thing — one-line strings in a grid,
 * plus a per-column alignment, which is the only formatting the syntax carries — and the library this
 * replaces (`tabulator-tables`) is a sortable, filterable, virtually-rendered spreadsheet whose model
 * has no place to put that alignment. Every editing gesture here is a `splice`.
 *
 * The editor receives the result over the event bus, the same way the File Manager hands back an asset.
 */

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

/** Cycled through by the per-column button, in this order. */
const ALIGNMENTS = ['left', 'center', 'right']

const ALIGN_ICONS = {
  left: 'mdi:format-align-left',
  center: 'mdi:format-align-center',
  right: 'mdi:format-align-right'
}

/* -> Spelled out rather than built from the value: a key assembled at runtime is invisible to the
      translation tooling, the same way a concatenated icon name is invisible to the icon scanner. */
const ALIGN_LABELS = {
  left: 'editor.tableEditor.alignLeft',
  center: 'editor.tableEditor.alignCenter',
  right: 'editor.tableEditor.alignRight'
}

/** Narrowest a delimiter cell can be and still show its colons: `:-:`. */
const MIN_WIDTH = 3

// DATA

/*
  `rows[0]` is the header. Keeping it in the same array as the body is what makes a column operation one
  splice per row instead of two code paths that have to agree.
*/
const state = reactive({
  align: ['left', 'left', 'left'],
  rows: [
    ['Column 1', 'Column 2', 'Column 3'],
    ['', '', ''],
    ['', '', '']
  ]
})

// COMPUTED

const bodyRows = computed(() => state.rows.slice(1))

/**
 * The table as markdown.
 *
 * Cells are padded to the width of their column: it costs nothing and it is the difference between a
 * source someone can read and a wall of pipes. A cell's own `|` is escaped, and a newline — which only
 * a paste can produce — becomes a space, because there is no way to write either into a table row.
 */
const markdown = computed(() => {
  const widths = state.align.map((_, colIndex) =>
    Math.max(MIN_WIDTH, ...state.rows.map((row) => escapeCell(row[colIndex]).length))
  )
  const line = (cells) => `| ${cells.map((cell, i) => cell.padEnd(widths[i])).join(' | ')} |`
  const delimiters = state.align.map((align, i) => {
    const dashes = '-'.repeat(widths[i] - (align === 'center' ? 2 : 1))
    switch (align) {
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
  return [
    line(state.rows[0].map(escapeCell)),
    line(delimiters),
    ...bodyRows.value.map((row) => line(row.map(escapeCell)))
  ].join('\n')
})

// METHODS

function escapeCell(value) {
  return (value ?? '').replaceAll('|', '\\|').replaceAll(/\s+/g, ' ').trim()
}

function cycleAlign(colIndex) {
  const next = (ALIGNMENTS.indexOf(state.align[colIndex]) + 1) % ALIGNMENTS.length
  state.align[colIndex] = ALIGNMENTS[next]
}

function addRow() {
  state.rows.push(state.align.map(() => ''))
}

function removeRow(rowIndex) {
  state.rows.splice(rowIndex, 1)
}

function addColumn() {
  state.align.push('left')
  for (const row of state.rows) {
    row.push('')
  }
}

function removeColumn(colIndex) {
  state.align.splice(colIndex, 1)
  for (const row of state.rows) {
    row.splice(colIndex, 1)
  }
}

/** Grow the table until (rowIndex, colIndex) exists. */
function ensureSize(rowCount, colCount) {
  while (state.align.length < colCount) {
    addColumn()
  }
  while (state.rows.length < rowCount) {
    addRow()
  }
}

/**
 * A paste of more than one cell fills the grid from where it was pasted, growing the table to fit.
 *
 * Tab-separated lines are what a spreadsheet puts on the clipboard, so a table copied out of one lands
 * here as a table rather than as a wall of text in a single cell. A paste with no tabs and no newlines
 * is an ordinary paste and is left to the field.
 */
function onCellPaste(rowIndex, colIndex, event) {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text.includes('\t') && !text.includes('\n')) {
    return
  }
  event.preventDefault()
  const grid = text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => line.split('\t'))
  ensureSize(rowIndex + grid.length, colIndex + Math.max(...grid.map((cells) => cells.length)))
  grid.forEach((cells, r) => {
    cells.forEach((cell, c) => {
      state.rows[rowIndex + r][colIndex + c] = cell.trim()
    })
  })
}

function insert() {
  EVENT_BUS.emit('insertTable', markdown.value)
  close()
}

function close() {
  siteStore.$patch({ overlay: '' })
}
</script>

<style lang="scss">
.table-editor {
  &-grid {
    overflow-x: auto;

    table {
      border-collapse: collapse;
    }

    th,
    td {
      padding: 0;
      border: 1px solid rgb(0 0 0 / 0.12);

      @at-root .body--dark & {
        border-color: rgb(255 255 255 / 0.15);
      }
    }
  }

  /* -> The tools row is chrome, not content: no border under the buttons, tighter than a data row */
  &-tools {
    th {
      padding: 2px 4px;
      border: 0;
    }
  }

  &-rowtools {
    width: 32px;
    padding: 0 2px !important;
    border: 0 !important;
    text-align: center;
  }

  &-cell {
    display: block;
    width: 220px;
    padding: 6px 8px;
    background-color: transparent;
    color: inherit;
    font-size: 14px;
    outline: none;

    &:focus {
      background-color: rgb(0 0 0 / 0.05);

      @at-root .body--dark & {
        background-color: rgb(255 255 255 / 0.08);
      }
    }

    /* -> The header row is what a reader sees in bold, so it reads that way here too */
    &--head {
      font-weight: 600;
    }
  }

  &-output {
    padding: 12px;
    border-radius: 4px;
    font-family: 'Roboto Mono', Consolas, 'Liberation Mono', Courier, monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;

    @at-root .body--light & {
      background-color: $grey-2;
      color: $grey-9;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      color: #fff;
    }
  }
}
</style>
