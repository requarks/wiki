<template>
  <nav
    v-if="max > 1"
    class="w-pagination flex flex-nowrap items-center gap-1"
    :aria-label="ariaLabel">
    <button
      v-if="directionLinks"
      type="button"
      class="w-unstyled w-pagination-btn"
      :disabled="modelValue <= 1"
      :aria-label="prevLabel"
      @click="go(modelValue - 1)">
      <w-icon name="mdi:chevron-left" />
    </button>

    <template v-for="(page, idx) of pages" :key="idx">
      <span v-if="page === GAP" class="px-1 text-black/40 dark:text-white/40" aria-hidden="true"
        >…</span
      >
      <button
        v-else
        type="button"
        class="w-unstyled w-pagination-btn"
        :class="page === modelValue ? 'w-pagination-btn--active' : ''"
        :aria-current="page === modelValue ? 'page' : undefined"
        :aria-label="`${pageLabel} ${page}`"
        @click="go(page)">
        {{ page }}
      </button>
    </template>

    <button
      v-if="directionLinks"
      type="button"
      class="w-unstyled w-pagination-btn"
      :disabled="modelValue >= max"
      :aria-label="nextLabel"
      @click="go(modelValue + 1)">
      <w-icon name="mdi:chevron-right" />
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Page selector.
 *
 * Shows a sliding window of at most `maxPages` buttons around the current page, with the first and
 * last always present when `boundaryNumbers` is set and an ellipsis wherever the run is broken.
 */
const props = defineProps({
  /** Current page, 1-based. */
  modelValue: {
    type: Number,
    default: 1
  },
  /** Total number of pages. */
  max: {
    type: Number,
    required: true
  },
  /** Most numbered buttons to show at once. */
  maxPages: {
    type: Number,
    default: 7
  },
  /** Always show the first and last page. */
  boundaryNumbers: {
    type: Boolean,
    default: false
  },
  /** Show previous/next arrows. */
  directionLinks: {
    type: Boolean,
    default: false
  },
  ariaLabel: {
    type: String,
    default: 'Pagination'
  },
  pageLabel: {
    type: String,
    default: 'Page'
  },
  prevLabel: {
    type: String,
    default: 'Previous page'
  },
  nextLabel: {
    type: String,
    default: 'Next page'
  }
})

const emit = defineEmits(['update:modelValue'])

/** Sentinel for an elided run; not a page number, so it cannot collide with one. */
const GAP = Symbol('gap')

const pages = computed(() => {
  const { max, maxPages, boundaryNumbers, modelValue } = props
  if (max <= maxPages) {
    return Array.from({ length: max }, (_, i) => i + 1)
  }

  // -> Centre the window on the current page, then clamp it to the ends
  const half = Math.floor(maxPages / 2)
  let start = Math.max(1, modelValue - half)
  let end = Math.min(max, start + maxPages - 1)
  start = Math.max(1, end - maxPages + 1)

  const out = []
  for (let p = start; p <= end; p++) {
    out.push(p)
  }

  if (boundaryNumbers) {
    // -> Replace, rather than prepend, so the control keeps a stable width as the page changes
    if (out[0] !== 1) {
      out[0] = 1
      if (out[1] !== 2) {
        out[1] = GAP
      }
    }
    if (out[out.length - 1] !== max) {
      out[out.length - 1] = max
      if (out[out.length - 2] !== max - 1) {
        out[out.length - 2] = GAP
      }
    }
  }
  return out
})

function go(page) {
  const target = Math.min(props.max, Math.max(1, page))
  if (target !== props.modelValue) {
    emit('update:modelValue', target)
  }
}
</script>

<style scoped>
.w-pagination-btn {
  min-width: 2rem;
  height: 2rem;
  padding-inline: 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.w-pagination-btn:hover:not(:disabled) {
  background-color: rgb(0 0 0 / 0.06);
}
:global(body.body--dark .w-pagination-btn:hover:not(:disabled)) {
  background-color: rgb(255 255 255 / 0.1);
}
.w-pagination-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.w-pagination-btn--active {
  background-color: var(--color-primary);
  color: var(--color-white);
}
.w-pagination-btn--active:hover {
  background-color: var(--color-primary);
}
</style>
