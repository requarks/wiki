<template>
  <div class="w-table relative" :class="flat ? '' : 'rounded shadow-card'">
    <table class="w-full border-collapse text-left">
      <thead v-if="!hideHeader">
        <tr>
          <th
            v-for="col of columns"
            :key="col.name"
            :style="col.headerStyle ?? col.style"
            class="w-table__cell px-4 py-2 text-body2 font-medium text-black/54 dark:text-white/70"
            :class="[alignClass(col), col.sortable ? 'cursor-pointer select-none' : '']"
            :aria-sort="ariaSort(col)"
            @click="col.sortable ? sortBy(col) : undefined">
            {{ col.label }}
            <w-icon
              v-if="col.sortable"
              name="la:arrow-up"
              size="14px"
              class="align-middle transition-[opacity,transform]"
              :class="[
                sort.name === col.name ? 'opacity-100' : 'opacity-0',
                sort.name === col.name && sort.descending ? 'rotate-180' : ''
              ]" />
          </th>
        </tr>
      </thead>
      <tbody>
        <!--
          `h-[52px]` is a floor, not a fixed height: on a table row CSS treats `height` as a minimum
          and taller content still expands it. Without one, a row's height came purely from its
          content, so the rows carrying action buttons stood 52px tall (a 36px flat button plus the
          cell's 16px of vertical padding) while rows whose actions were hidden collapsed to 40px.
          The table this replaces had the same floor at 48px, which is why the two never visibly
          disagreed there; 52px is that same idea sized to what these cells actually hold, so no
          existing row has to shrink to make them agree.
        -->
        <tr
          v-for="(row, rowIndex) of visibleRows"
          :key="rowKey ? row[rowKey] : rowIndex"
          class="w-table__row h-[52px]">
          <!--
            The cell slot is named per column (`body-cell-<name>`), which is what the pages already
            provide, and receives one object so `#body-cell-x="props"` reads `props.value` /
            `props.row` / `props.col` as before. The fallback renders the formatted value, so a
            column without a slot needs no markup at all.
          -->
          <template v-for="col of columns" :key="col.name">
            <slot
              :name="`body-cell-${col.name}`"
              :row="row"
              :col="col"
              :value="cellValue(row, col)">
              <w-td :props="{ col }">{{ cellValue(row, col) }}</w-td>
            </slot>
          </template>
        </tr>
      </tbody>
    </table>
    <w-inner-loading :showing="loading" />
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'

/**
 * Data table.
 *
 * Columns are `[{ name, label, field, align, sortable, format, style }]` -- the same descriptors
 * the admin pages already declare -- and each row is rendered through an optional
 * `#body-cell-<name>` slot.
 *
 * Simplifications against the component this replaces: no pagination, no selection, no virtual
 * scrolling, no top/bottom slots. Every call site passed `:rows-per-page-options="[0]"` and
 * `hide-bottom`, i.e. "show all rows, no footer", so the whole paging apparatus was dead weight.
 * Sorting is kept because several tables mark columns sortable and the header is visible there.
 */
const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  /** `[{ name, label, field, align, sortable, format, style }]` */
  columns: {
    type: Array,
    default: () => []
  },
  /** Row property holding a stable identity, used as the render key. */
  rowKey: {
    type: String,
    default: null
  },
  /** Drops the elevation shadow. */
  flat: {
    type: Boolean,
    default: false
  },
  hideHeader: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  /** Free-text filter, matched against every column's rendered value. */
  filter: {
    type: String,
    default: ''
  }
})

const sort = reactive({ name: null, descending: false })

const ALIGN = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
}

function alignClass(col) {
  return ALIGN[col.align] ?? ALIGN.left
}

function ariaSort(col) {
  if (!col.sortable) {
    return undefined
  }
  if (sort.name !== col.name) {
    return 'none'
  }
  return sort.descending ? 'descending' : 'ascending'
}

/** `field` is either a property name or a function of the row, as the descriptors already assume. */
function rawValue(row, col) {
  return typeof col.field === 'function' ? col.field(row) : row[col.field]
}

function cellValue(row, col) {
  const value = rawValue(row, col)
  return col.format ? col.format(value, row) : value
}

function sortBy(col) {
  if (sort.name === col.name) {
    sort.descending = !sort.descending
  } else {
    sort.name = col.name
    sort.descending = false
  }
}

const filteredRows = computed(() => {
  const needle = props.filter?.trim().toLowerCase()
  if (!needle) {
    return props.rows
  }
  return props.rows.filter((row) =>
    props.columns.some((col) =>
      String(cellValue(row, col) ?? '')
        .toLowerCase()
        .includes(needle)
    )
  )
})

const visibleRows = computed(() => {
  const col = props.columns.find((c) => c.name === sort.name)
  if (!col) {
    return filteredRows.value
  }

  const direction = sort.descending ? -1 : 1
  // -> Copy first: sorting the prop array in place would mutate the caller's state
  return [...filteredRows.value].sort((a, b) => {
    const left = rawValue(a, col)
    const right = rawValue(b, col)
    if (left === right) {
      return 0
    }
    if (left == null) {
      return -direction
    }
    if (right == null) {
      return direction
    }
    return (
      (typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right))) * direction
    )
  })
})
</script>

<style scoped>
/*
  Row rules are drawn as scaled pseudo-elements for the same reason as `.w-hairline`: a plain 1px
  border lands on a fractional device row under display scaling and paints unevenly. The cells
  themselves are the positioning context (WTd sets `position: relative`) -- a <tr> is not a reliable
  containing block for an absolutely positioned child.
*/
.w-table__row + .w-table__row :deep(td)::before,
thead + tbody .w-table__row:first-child :deep(td)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background-color: rgb(0 0 0 / 0.12);
  transform: scaleY(calc(1 / var(--w-dpr, 1)));
  transform-origin: top left;
  pointer-events: none;
}

:global(body.body--dark .w-table__row + .w-table__row td::before),
:global(body.body--dark thead + tbody .w-table__row:first-child td::before) {
  background-color: rgb(255 255 255 / 0.15);
}
</style>
