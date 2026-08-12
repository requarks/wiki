<template>
  <nav class="page-toc" aria-label="Table of contents">
    <ul class="page-toc-list">
      <li
        v-for="item of visibleItems"
        :key="item.key"
        class="page-toc-item"
        :class="[
          `page-toc-item--d${Math.min(item.depth, 2)}`,
          { 'page-toc-item--active': item.key === selected }
        ]"
        :style="{ '--page-toc-depth': item.depth }">
        <!--
          A real `href` so the section can be middle-clicked or copied, with the click handled here
          instead: scrolling it into view keeps the reader where the wiki put them, rather than
          handing the URL a fragment the router would then try to resolve.
        -->
        <a class="page-toc-link" :href="item.key" @click="onClick($event, item)">{{
          item.label
        }}</a>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import { scrollToAnchor } from '@/helpers/anchors'
import { flattenToc } from '@/helpers/toc'

/**
 * The page contents: a list of links to the headings in the render, marking the one being read.
 *
 * Depth is expressed by indentation off a single rail plus a type ramp — heavier and darker at the
 * top level, lighter and smaller further in. There is no disclosure control: which levels the
 * contents cover is the page's own setting (`tocDepth`, as `minDepth`/`maxDepth` here), not something
 * to fiddle with per visit, and a column of carets both wasted the width and read as a file tree.
 */
const props = defineProps({
  /** The contents tree: `{ key, label, children }`, where `key` is the heading's `#anchor`. */
  nodes: {
    type: Array,
    required: true
  },
  /**
   * The shallowest level to show, counting from 1 — so `2` skips the first level, and its
   * subheadings become the top tier of the list. The page properties panel presents the pair as
   * `H{min} → H{max}`.
   */
  minDepth: {
    type: Number,
    default: 1
  },
  /** The deepest level to show, counting from 1. Anything below it is left out entirely. */
  maxDepth: {
    type: Number,
    default: 2
  },
  /** Key of the heading being read. Owned by the caller; this component keeps it up to date. */
  selected: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:selected'])

/*
  Where the page counts as being "at" a heading: the first heading whose top has passed this line,
  measured down from the top of whatever box the article scrolls in. Deliberately below that edge, so
  a heading becomes current as it settles into reading position rather than the instant its first
  pixel appears.
*/
const SPY_LINE = 120

/*
  How long the spy stands down after a click. A smooth scroll passes over every heading in between,
  and letting the marker run down the list behind it looks like a fault; the click already said which
  heading is meant. Long enough for a scroll of any length to settle.
*/
const CLICK_SETTLE_MS = 1200

let spyFrame = null
let spySuspendedUntil = 0

// COMPUTED

/**
 * The tree flattened to one list, each row carrying its own depth.
 *
 * One list rather than a component per level: the rail and the active marker are then a single
 * positioning context, so a row at any depth marks the same 1px line.
 */
const visibleItems = computed(() =>
  flattenToc(props.nodes, { minDepth: props.minDepth, maxDepth: props.maxDepth })
)

// METHODS

/** The heading element a row points at, or null while the render is still catching up. */
function headingFor(key) {
  // -> `key` is the anchor `#slug`; the bare id is what `getElementById` wants, and it sidesteps
  //    having to escape a slug that is not a valid CSS selector
  return document.getElementById(key.replace(/^#/, ''))
}

function onClick(ev, item) {
  if (!headingFor(item.key)) {
    // -> Nothing to scroll to; let the browser do whatever it can with the href
    return
  }
  ev.preventDefault()
  emit('update:selected', item.key)
  spySuspendedUntil = performance.now() + CLICK_SETTLE_MS

  // -> Through the helper, so that a heading inside a closed tab is revealed rather than scrolled at
  scrollToAnchor(item.key, { smooth: true })
}

/**
 * Where the box the article scrolls in starts, in viewport coordinates.
 *
 * The shell is the viewport and the article scrolls in a column inside it, so a heading at the top of
 * its own scrollport is still ~200px down the window, under the header and the page title. Measuring
 * the reading line from the window instead put the spy a heading behind wherever the reader was.
 */
function scrollportTop(heading) {
  for (let el = heading.parentElement; el; el = el.parentElement) {
    if (['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) {
      return el.getBoundingClientRect().top
    }
  }
  return 0
}

/**
 * Mark whichever heading the reader has reached.
 *
 * Positions are read fresh each time rather than cached: the render is replaced wholesale while
 * editing, and images settling in shift every heading below them.
 */
function syncSpy() {
  if (performance.now() < spySuspendedUntil || visibleItems.value.length === 0) {
    return
  }

  let current = null
  let line = null
  for (const item of visibleItems.value) {
    const heading = headingFor(item.key)
    if (!heading) {
      continue
    }
    line ??= scrollportTop(heading) + SPY_LINE
    if (heading.getBoundingClientRect().top <= line) {
      current = item.key
    }
  }

  // -> Above the first heading, the first section is still the one being read
  const next = current ?? visibleItems.value[0].key
  if (next !== props.selected) {
    emit('update:selected', next)
  }
}

/** Scroll fires far more often than the marker can move; one read per frame is enough. */
function queueSpy() {
  if (spyFrame !== null) {
    return
  }
  spyFrame = requestAnimationFrame(() => {
    spyFrame = null
    syncSpy()
  })
}

// WATCHERS

// -> A new render means new heading positions, and possibly a different set of them
watch(() => props.nodes, queueSpy)

// MOUNTED

onMounted(() => {
  /*
    `capture` because scroll events do not bubble: the page scrolls the document today, but the
    content sits in a scroll container that takes over at shorter viewports, and capturing on the
    window catches whichever one moved.
  */
  window.addEventListener('scroll', queueSpy, { capture: true, passive: true })
  window.addEventListener('resize', queueSpy, { passive: true })
  queueSpy()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', queueSpy, { capture: true })
  window.removeEventListener('resize', queueSpy)
  if (spyFrame !== null) {
    cancelAnimationFrame(spyFrame)
  }
})
</script>

<style lang="scss">
/*
  The contents list.

  Everything hangs off one vertical rail at the left: depth is indentation from it, and the heading
  being read marks it. Colours come from CSS custom properties rather than the SCSS palette so that
  `--color-primary` follows a re-themed site, which a compiled `$primary` could not.
*/
.page-toc {
  --page-toc-indent: 14px;
  /* Translucent, not a palette grey: the rail sits on the sidebar's own fill in both themes */
  --page-toc-rail: rgba(0, 0, 0, 0.1);
  --page-toc-ink-strong: #{$grey-9};
  --page-toc-ink: #{$grey-7};
  --page-toc-ink-soft: #{$grey-6};
  --page-toc-ink-hover: #{$grey-10};
  --page-toc-hover-surface: rgba(0, 0, 0, 0.04);

  line-height: 1.4;

  @at-root .body--dark & {
    --page-toc-rail: rgba(255, 255, 255, 0.12);
    --page-toc-ink-strong: rgba(255, 255, 255, 0.87);
    --page-toc-ink: rgba(255, 255, 255, 0.6);
    --page-toc-ink-soft: rgba(255, 255, 255, 0.45);
    --page-toc-ink-hover: #fff;
    --page-toc-hover-surface: rgba(255, 255, 255, 0.06);
  }

  &-list {
    position: relative;
    margin: 0;
    padding: 0;
    list-style: none;

    /* The rail. Inset top and bottom so it stops level with the first and last label. */
    &::before {
      content: '';
      position: absolute;
      top: 3px;
      bottom: 3px;
      left: 0;
      width: 1px;
      background-color: var(--page-toc-rail);
    }
  }

  &-item {
    position: relative;
    /* Depth is carried as a custom property by the template, so one rule indents every level */
    padding-left: calc(var(--page-toc-depth) * var(--page-toc-indent));
  }

  /*
    The active marker, drawn ON the rail rather than beside it: `left: 0` is the item's own border
    box, which starts at the rail whatever the indentation, so every depth marks the same line.
  */
  &-item--active::before {
    content: '';
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 0;
    width: 2px;
    border-radius: 1px;
    background-color: var(--color-primary);
  }

  &-link {
    display: block;
    /* 9px of gutter, not a caret column: the rail is the only thing to the left of a label */
    padding: 3px 8px 3px 9px;
    border-radius: 4px;
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
    text-decoration: none;
    /* Long headings wrap rather than being cut off; the sidebar is 300px wide, 200px under 1400px */
    overflow-wrap: break-word;
    transition:
      color 0.2s var(--ease-standard),
      background-color 0.2s var(--ease-standard);

    &:hover {
      color: var(--page-toc-ink-hover);
      background-color: var(--page-toc-hover-surface);
    }
  }

  /*
    The depth ramp. Each level steps down in weight, size and contrast, so nesting is legible from
    the type alone -- indentation on its own left every level looking like the same kind of thing.
  */
  &-item--d0 {
    color: var(--page-toc-ink-strong);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  /* Air above each top-level entry, which is what separates one section's block from the next */
  &-item--d0 + &-item--d0,
  &-item--d1 + &-item--d0,
  &-item--d2 + &-item--d0 {
    margin-top: 7px;
  }

  &-item--d1 {
    color: var(--page-toc-ink);
    font-size: 0.78125rem;
    font-weight: 400;
  }

  &-item--d2 {
    color: var(--page-toc-ink-soft);
    font-size: 0.75rem;
    font-weight: 400;
  }

  /* Active beats the ramp at every depth, and keeps that depth's own weight */
  &-item--active {
    color: var(--color-primary);

    @at-root .body--dark & {
      color: var(--color-primary-light);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &-link {
      transition-duration: 0.01ms;
    }
  }
}
</style>
