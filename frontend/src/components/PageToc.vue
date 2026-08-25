<template>
  <nav class="page-toc" aria-label="Table of contents">
    <ul
      class="page-toc-list"
      :class="{ 'page-toc-list--animated': markerAnimated }"
      ref="listEl"
      :style="{
        '--page-toc-marker-y': `${marker.y}px`,
        '--page-toc-marker-h': `${marker.h}px`,
        '--page-toc-marker-opacity': marker.visible ? 1 : 0
      }">
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
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { isVisible, scrollToAnchor } from '@/helpers/anchors'
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

/*
  The tab block, named here because the spy has to leave its rows alone — see `spyableRows`. Uppercase
  because `tagName` is, for an HTML element in an HTML document.
*/
const TAB_TAG = 'BLOCK-TAB'

let spyFrame = null
let spySuspendedUntil = 0

// DATA

const listEl = ref(null)

/*
  Where the marker sits on the rail, in pixels down from the top of the list, and how tall it is.
  Measured rather than expressed in CSS because the marker is one element for the whole list: that is
  what lets it travel from one heading to the next instead of being switched off one row and on
  another, and a pseudo-element on the active row can only ever do the latter.
*/
const marker = reactive({ y: 0, h: 0, visible: false })

/*
  Whether the marker may animate yet. Off for its first placement, so that a reader arriving partway
  down a page is not shown it sliding from the top of the list -- there is no move to follow there,
  only the list settling.
*/
const markerAnimated = ref(false)

/* The inset the marker keeps at each end of a row, so it marks the label rather than the gap too. */
const MARKER_INSET = 2

let markerObserver = null

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
 * The rows the spy may mark, paired with the element each one points at.
 *
 * Two kinds are left out, both because where they sit says nothing about what is being read:
 *
 * - **A row pointing at a tab.** A tab is somewhere a reader is sent, not somewhere they arrive by
 *   scrolling: every panel of a block starts at the same offset, so a reader passing the block passes
 *   all of them at once and the marker has no reason to prefer any one. `block-tab` is also the only
 *   row whose target is the container of a whole section of page rather than a line at the top of one.
 * - **Anything inside a panel that is not showing.** A closed tab is `display: none`, so its contents
 *   measure nothing at all — `top: 0`, which reads as a heading the reader has long since passed
 *   rather than as one that is not on the page. Since the last match in document order wins, the
 *   deepest hidden row held the marker whatever the reader did.
 *
 * Neither is excluded from the list itself: both are still drawn, and clicking either still opens the
 * panel and scrolls to it, which is `scrollToAnchor`'s job rather than the spy's.
 */
function spyableRows() {
  const rows = []
  for (const item of visibleItems.value) {
    const heading = headingFor(item.key)
    if (heading && heading.tagName !== TAB_TAG && isVisible(heading)) {
      rows.push({ key: item.key, heading })
    }
  }
  return rows
}

/**
 * Mark whichever heading the reader has reached.
 *
 * Positions are read fresh each time rather than cached: the render is replaced wholesale while
 * editing, and images settling in shift every heading below them.
 */
function syncSpy() {
  if (performance.now() < spySuspendedUntil) {
    return
  }

  const rows = spyableRows()
  if (rows.length === 0) {
    // -> Nothing on the page to measure against — a page that is all tabs, or a render still arriving.
    //    The marker stays where it was, rather than moving to a row nobody is reading.
    return
  }

  const line = scrollportTop(rows[0].heading) + SPY_LINE
  let current = null
  for (const row of rows) {
    if (row.heading.getBoundingClientRect().top <= line) {
      current = row.key
    }
  }

  // -> Above the first heading, the first section is still the one being read
  const next = current ?? rows[0].key
  if (next !== props.selected) {
    emit('update:selected', next)
  }
}

/**
 * Put the marker over the active row.
 *
 * Offsets are read off the row rather than computed from the list, since every depth has its own
 * type size and therefore its own height. `offsetTop` is relative to the list, which is the nearest
 * positioned ancestor and so the marker's own containing block.
 */
function syncMarker() {
  const list = listEl.value
  const active = list?.querySelector('.page-toc-item--active')
  if (!active) {
    // -> Nothing marked: fade out where it stands, rather than travelling to the top of the list
    marker.visible = false
    return
  }

  marker.y = active.offsetTop + MARKER_INSET
  marker.h = Math.max(active.offsetHeight - MARKER_INSET * 2, 0)
  marker.visible = true

  if (!markerAnimated.value) {
    // -> A frame after the first placement, so the browser paints it there before the transition
    //    exists to animate away from it
    requestAnimationFrame(() => {
      markerAnimated.value = true
    })
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

// -> After the class the marker is measured from has been applied
watch([() => props.selected, visibleItems], async () => {
  await nextTick()
  syncMarker()
})

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

  /*
    The rows move for reasons no event reports: the sidebar narrows at 1400px and long labels wrap
    onto another line, which changes the height of the row the marker is on and the offset of every
    row below it. Watching the list itself catches all of that, resizes included.
  */
  markerObserver = new ResizeObserver(syncMarker)
  markerObserver.observe(listEl.value)
  syncMarker()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', queueSpy, { capture: true })
  window.removeEventListener('resize', queueSpy)
  if (spyFrame !== null) {
    cancelAnimationFrame(spyFrame)
  }
  markerObserver?.disconnect()
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
    The active marker, drawn ON the rail rather than beside it: `left: 0` is the list's own border
    box, which is where the rail is, so every depth marks the same line whatever its indentation.

    One element for the whole list rather than a pseudo on the active row, so that moving to the next
    heading is a slide down the rail instead of the marker being switched off one row and on another.
    Where it goes cannot be said in CSS -- each depth has its own type size and so its own height --
    so `syncMarker` measures the row and hands the two numbers over as custom properties.
  */
  &-list::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    height: var(--page-toc-marker-h, 0);
    border-radius: 1px;
    background-color: var(--color-primary);
    opacity: var(--page-toc-marker-opacity, 0);
    transform: translateY(var(--page-toc-marker-y, 0));
  }

  /* -> The class arrives a frame after the first placement, so the marker does not travel to it */
  &-list--animated::after {
    transition:
      transform 0.25s var(--ease-standard),
      height 0.25s var(--ease-standard),
      opacity 0.15s var(--ease-standard);
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
    &-link,
    &-list--animated::after {
      transition-duration: 0.01ms;
    }
  }
}
</style>
