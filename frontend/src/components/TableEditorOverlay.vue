<template>
  <w-layout class="table-editor" view="hHh lpR fFf" container>
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
        :href="siteStore.docsBase + `/guide/table-editor`"
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
        <!-- -> "Update" when the overlay was opened over a table that is already in the page: the
                button says what pressing it does, and what it does is replace that one -->
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(submitLabel)"
          :aria-label="t(submitLabel)"
          icon="la:check"
          @click="insert" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <w-page class="p-4">
        <!--
          A tinted strip rather than a colour of its own: the overlay's panel is a gradient
          ($grey-3 -> $grey-4, $dark-4 -> $dark-3), so a fixed background would be a step apart from it
          at one end of that gradient and level with it at the other. A translucent black -- white in
          dark mode -- is a step darker than whatever it happens to sit on.

          Bled out of the page's padding on three sides so it meets the header and both edges, which is
          what makes it read as a toolbar under the title bar rather than as a panel floating in the
          page; `px-4` then puts its contents back on the page's own inset.
        -->
        <div
          class="-mx-4 -mt-4 flex flex-wrap items-center gap-2 bg-black/5 px-4 py-2 dark:bg-white/5">
          <!-- -> `push`, like the overlay's own header buttons and the Styling menu at the far end of
                  this strip: solid, with the ledge that collapses under the press -->
          <w-btn
            push
            no-caps
            icon="la:plus"
            color="primary"
            padding="xs sm"
            :label="t(`editor.tableEditor.addRow`)"
            @click="addRow" />
          <w-btn
            push
            no-caps
            icon="la:plus"
            color="primary"
            padding="xs sm"
            :label="t(`editor.tableEditor.addColumn`)"
            @click="addColumn" />
          <!--
            Three groups in one strip, ruled apart: what the table holds, what its markdown looks like,
            and what the page does with it. A rule rather than more space -- at this density the gap that
            would read as a break is wide enough to look like a missing control.

            The two options here both change the markdown under the grid as they are ticked, which is the
            only feedback either of them has. Headerless comes first, since it changes the grid as well.

            Margins on all three sides, past the row's own gap: a checkbox sitting at the bare gap from a
            rule reads as attached to it, and two of them that close together read as one control with two
            boxes. The pair ends up breathing inside its group rather than filling it.
          -->
          <w-separator vertical />
          <w-checkbox
            v-model="state.headerless"
            class="ml-2"
            :label="t('editor.tableEditor.headerless')" />
          <w-checkbox
            v-model="state.compact"
            class="mx-2"
            :label="t('editor.tableEditor.compact')" />
          <!--
            The classes the content stylesheet gives a table, which go under it as a `markdown-it-attrs`
            line — see `css/_page-contents.scss`, where each of the three is defined. Last in the strip
            and in its own colour: the only control here that opens something rather than doing something.

            A menu of checkboxes rather than a `w-select`: these are not one choice from a list, they are
            three independent switches, and a select would read as "pick a style" and then have to explain
            why two are ticked. `WCheckbox` binds a value within an array, which is exactly this shape, and
            `WMenu` does not close on a click inside itself, so all three can be set in one visit.
          -->
          <w-separator vertical />
          <w-btn
            push
            no-caps
            icon="mdi:palette"
            color="secondary"
            padding="xs sm"
            :label="t(`editor.tableEditor.styling`)">
            <w-icon name="mdi:menu-down" />
            <w-menu anchor="bottom left" self="top left" :offset="[0, 4]">
              <div class="flex flex-col gap-3 p-4">
                <w-checkbox
                  v-for="option of STYLE_CLASSES"
                  :key="option.value"
                  v-model="state.classes"
                  :val="option.value"
                  :label="t(option.label)" />
              </div>
            </w-menu>
          </w-btn>
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
              <!-- -> Gone entirely when the table is headerless, rather than emptied: `rows[0]` is a
                      body row in that case, and it is shown as one below -->
              <tr v-if="!state.headerless">
                <th v-for="(_, colIndex) of state.rows[0]" :key="`head-${colIndex}`">
                  <input
                    v-model="state.rows[0][colIndex]"
                    class="table-editor-cell table-editor-cell--head"
                    type="text"
                    :style="{ textAlign: state.align[colIndex] }"
                    :aria-label="t(`editor.tableEditor.headerCell`, { column: colIndex + 1 })"
                    @paste="onCellPaste(0, colIndex, $event)" />
                </th>
                <th class="table-editor-rowtools" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) of bodyRows" :key="`row-${rowIndex}`">
                <td v-for="(_, colIndex) of row" :key="`cell-${rowIndex}-${colIndex}`">
                  <!-- -> Set the way the column is set: the alignment is the one thing about a table
                          the syntax can carry, so the grid may as well show it rather than describe it -->
                  <input
                    v-model="state.rows[rowIndex + rowOffset][colIndex]"
                    class="table-editor-cell"
                    type="text"
                    :style="{ textAlign: state.align[colIndex] }"
                    :aria-label="
                      t(`editor.tableEditor.bodyCell`, { row: rowIndex + 1, column: colIndex + 1 })
                    "
                    @paste="onCellPaste(rowIndex + rowOffset, colIndex, $event)" />
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
                    @click="removeRow(rowIndex + rowOffset)">
                    <w-tooltip>{{ t('editor.tableEditor.removeRow') }}</w-tooltip>
                  </w-btn>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--
          The markdown itself, because that is what gets inserted and it is worth seeing before it lands
          in the page. Headed the way the block picker heads its own markdown.

          `-mx-4` gives back the page's own padding, so the band `w-section-header` trails reaches the
          panel's edges instead of stopping short of them — and the class's own 16px leaves the heading
          text at the same inset the rest of the page keeps.
        -->
        <div class="w-section-header -mx-4 mt-6">{{ t('editor.tableEditor.markdown') }}</div>
        <!--
          Drawn as the page will draw it: `page-contents` is the content stylesheet, so the preview is
          a code block, not a panel of its own invention — one that follows the site's own code surface,
          in both themes, without this file restating any of it.

          `mt-4` rather than the heading's own 10px, because the faint band the heading trails below
          itself reaches 13px down and the block's background would paint over it. The `pre` is the only
          child, which is what gives up the block margins content puts around a code block.
        -->
        <div class="page-contents mt-4">
          <pre>{{ markdown }}</pre>
        </div>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { ALIGNMENTS, buildTable, parseTable } from '@/helpers/markdownTable'

import { useSiteStore } from '@/stores/site'

/**
 * Builds a markdown table and hands it to the editor.
 *
 * Handmade rather than a data grid. A markdown table is a small thing — one-line strings in a grid,
 * plus a per-column alignment, which is the only formatting the syntax carries — and the library this
 * replaces (`tabulator-tables`) is a sortable, filterable, virtually-rendered spreadsheet whose model
 * has no place to put that alignment. Every editing gesture here is a `splice`.
 *
 * Opened over a table that is already in the page — from the "Edit Table" lens in the markdown editor,
 * which passes its source and the lines it occupies — the same grid edits that table instead, and the
 * result goes back over those lines rather than in at the cursor.
 *
 * The editor receives the result over the event bus, the same way the File Manager hands back an asset.
 */

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

const ALIGN_ICONS = {
  left: 'mdi:format-align-left',
  center: 'mdi:format-align-center',
  right: 'mdi:format-align-right'
}

/*
  The classes the Styling menu offers, and what each one does to a table. Every one of them is defined in
  `css/_page-contents.scss` -- this list is the UI for those rules, so a class added there needs a line
  here to be reachable, and a line here naming a class that is not there does nothing at all.

  A class an author wrote by hand that is not in this list is left alone rather than stripped: it stays in
  `state.classes` and goes back out with the table, it simply has no box of its own to tick.
*/
const STYLE_CLASSES = [
  { value: 'table-vertical-middle', label: 'editor.tableEditor.styleVerticalMiddle' },
  { value: 'table-leading-col', label: 'editor.tableEditor.styleLeadingCol' },
  { value: 'table-code-nohighlight', label: 'editor.tableEditor.styleCodeNoHighlight' }
]

/* -> Spelled out rather than built from the value: a key assembled at runtime is invisible to the
      translation tooling, the same way a concatenated icon name is invisible to the icon scanner. */
const ALIGN_LABELS = {
  left: 'editor.tableEditor.alignLeft',
  center: 'editor.tableEditor.alignCenter',
  right: 'editor.tableEditor.alignRight'
}

// DATA

/*
  `rows[0]` is the header, unless `headerless` is set -- in which case it is simply the first row, and
  every row is a body row. Keeping the header in the same array as the body is what makes a column
  operation one splice per row instead of two code paths that have to agree, and it is also what makes
  the Headerless tick reversible: nothing is thrown away, the first row just stops being a heading.

  A starter table when there is nothing to edit; the table that was there when there is. `replace` holds
  the lines it came from, and is what turns this from an insert into an update -- see `insert`.
*/
const editing = siteStore.overlayOpts?.source
  ? {
      ...parseTable(siteStore.overlayOpts.source),
      replace: {
        startLine: siteStore.overlayOpts.startLine,
        endLine: siteStore.overlayOpts.endLine
      }
    }
  : null

const state = reactive(
  editing ?? {
    align: ['left', 'left', 'left'],
    compact: true,
    headerless: false,
    classes: [],
    otherAttrs: [],
    rows: [
      ['Column 1', 'Column 2', 'Column 3'],
      ['', '', ''],
      ['', '', '']
    ],
    replace: null
  }
)

// COMPUTED

/** Where the body starts in `rows`: after the header, or at the top when there is none. */
const rowOffset = computed(() => (state.headerless ? 0 : 1))

const bodyRows = computed(() => state.rows.slice(rowOffset.value))

/* -> Written by `helpers/markdownTable`, which is also what read the table being edited: the two
      directions have to agree, or reopening a table would reformat it */
const markdown = computed(() => buildTable(state, { compact: state.compact }))

const submitLabel = computed(() =>
  state.replace ? 'common.actions.update' : 'common.actions.insert'
)

// METHODS

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

/*
  The result, and where it goes: over the lines the table came from, or in at the cursor when it came
  from nowhere. The editor is the one holding the document, so it does the placing -- this only says
  which of the two it is.
*/
function insert() {
  EVENT_BUS.emit('insertTable', { markdown: markdown.value, replace: state.replace })
  close()
}

function close() {
  siteStore.$patch({ overlay: '' })
}

// -> Cleared here rather than in `close`, so it goes whichever way the overlay was left: a table left
//    behind in the options would be edited again the next time the toolbar button opens this
onBeforeUnmount(() => {
  siteStore.overlayOpts = {}
})
</script>

<style lang="scss">
.table-editor {
  /*
    Nothing here sits on a `w-card`, and that is where the app's dark text colour comes from -- so the
    overlay has to state its own or everything that merely inherits `color` stays black on the dark
    panel: the cell inputs (`color: inherit`, deliberately, so they follow the surface), the `Markdown`
    heading and the Compact checkbox's label. Same reason `BlockPickerOverlay` states it.
  */
  @at-root .body--light & {
    color: $grey-9;
  }
  @at-root .body--dark & {
    color: #fff;
  }

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
}
</style>
