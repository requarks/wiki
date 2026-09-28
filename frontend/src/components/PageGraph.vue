<template>
  <div class="page-graph">
    <w-toolbar class="page-graph-toolbar">
      <w-btn
        class="mr-2"
        flat
        dense
        no-caps
        color="grey"
        icon="la:arrow-left"
        :label="isNarrow ? undefined : t('fileman.graph.back')"
        :aria-label="t('fileman.graph.back')"
        @click="emit('close')">
        <w-tooltip v-if="isNarrow">{{ t('fileman.graph.back') }}</w-tooltip>
      </w-btn>
      <w-separator vertical class="page-graph-sep mr-2" />
      <w-btn-toggle
        :model-value="state.view"
        :options="viewOptions"
        :aria-label="t('fileman.graph.views')"
        push
        glossy
        no-caps
        toggle-color="primary"
        @update:model-value="switchView" />
      <w-space />
      <span v-if="search && state.status === 'ready'" class="page-graph-matches" aria-live="polite">
        {{ t('fileman.graph.matches', { count: state.matchCount }, state.matchCount) }}
      </span>
      <span v-if="state.truncated" class="page-graph-truncated">
        <w-icon name="la:exclamation-triangle" size="sm" />
        {{ t('fileman.graph.truncated') }}
      </span>
      <!--
        Up one level from the section the graph is zoomed into. Only there at all below the top: at the
        site root there is nowhere up to go, and a disabled control would be one more thing to read.
      -->
      <w-btn
        v-if="parentLevel"
        class="mx-2"
        flat
        dense
        no-caps
        color="grey"
        icon="la:level-up-alt"
        :label="isNarrow ? undefined : t('fileman.graph.parentLevel')"
        :aria-label="t('fileman.graph.parentLevel')"
        @click="graph?.focusOn(parentLevel.id)">
        <w-tooltip>{{ parentLevel.title }}</w-tooltip>
      </w-btn>
      <w-btn
        flat
        dense
        round
        color="grey"
        icon="la:search-minus"
        :aria-label="t('fileman.graph.zoomOut')"
        @click="graph?.zoomOut()">
        <w-tooltip>{{ t('fileman.graph.zoomOut') }}</w-tooltip>
      </w-btn>
      <w-btn
        flat
        dense
        round
        color="grey"
        icon="la:search-plus"
        :aria-label="t('fileman.graph.zoomIn')"
        @click="graph?.zoomIn()">
        <w-tooltip>{{ t('fileman.graph.zoomIn') }}</w-tooltip>
      </w-btn>
      <w-btn
        flat
        dense
        round
        color="grey"
        icon="mdi:fit-to-screen-outline"
        :aria-label="t('fileman.graph.fit')"
        @click="graph?.fit()">
        <w-tooltip>{{ t('fileman.graph.fit') }}</w-tooltip>
      </w-btn>
    </w-toolbar>

    <div class="page-graph-stage">
      <div
        ref="canvas"
        class="page-graph-canvas"
        :class="{ 'is-hidden': state.status !== 'ready' }" />

      <div v-if="state.status === 'loading'" class="page-graph-state">
        <w-spinner color="primary" size="64px" />
        <span class="text-primary">{{ t('fileman.graph.loading') }}</span>
      </div>
      <div v-else-if="state.status === 'error'" class="page-graph-state">
        <w-icon name="la:exclamation-triangle" size="xl" color="negative" />
        <span>{{ t('fileman.graph.loadFailed') }}</span>
        <w-btn flat no-caps color="primary" :label="t('fileman.graph.retry')" @click="load" />
      </div>
      <div v-else-if="state.status === 'empty'" class="page-graph-state">
        <img src="/_assets/icons/carbon-copy-empty-box.svg" alt="" />
        <span>{{ t('fileman.graph.empty') }}</span>
      </div>

      <!--
        What is under the pointer, or where the keyboard is. It is a card and not a tooltip because it
        holds actions: a page that is also a section is opened by a click, and zooming into it has to
        be offered somewhere. The pointer can travel into it, which is why it is dismissed on a delay.
      -->
      <div
        v-if="state.card"
        class="page-graph-card"
        :class="{ 'is-flipped': cardPlacement.flipped }"
        :style="cardPlacement.style"
        @pointerenter="keepCard"
        @pointerleave="dropCard">
        <div class="page-graph-card-title">{{ state.card.title }}</div>
        <div v-if="state.card.isPage || state.card.path" class="page-graph-card-path">
          {{ cardPath }}
        </div>
        <div class="page-graph-card-facts">
          <span v-if="!state.card.isPublished" class="page-graph-chip is-draft">{{
            t('fileman.graph.unpublished')
          }}</span>
          <span v-if="state.card.isRedirect" class="page-graph-chip">{{
            t('fileman.graph.redirect')
          }}</span>
          <span v-if="state.card.stub === 'external'" class="page-graph-chip">{{
            localeName(state.card.locale)
          }}</span>
          <span v-if="cardPageCount" class="page-graph-chip">{{ cardPageCount }}</span>
        </div>
        <div
          v-if="state.card.hasLinks && (state.card.linksOut || state.card.linksIn)"
          class="page-graph-card-links">
          <span class="is-out">
            <span class="page-graph-swatch is-out" />
            {{ t('fileman.graph.linksOut', { count: state.card.linksOut }, state.card.linksOut) }}
          </span>
          <span class="is-in">
            <span class="page-graph-swatch is-in" />
            {{ t('fileman.graph.linksIn', { count: state.card.linksIn }, state.card.linksIn) }}
          </span>
        </div>
        <div v-if="state.card.actions.length > 0" class="page-graph-card-actions">
          <w-btn
            v-for="action of state.card.actions"
            :key="action"
            dense
            padding="xs 12px"
            no-caps
            :flat="action !== state.card.defaultAction"
            :unelevated="action === state.card.defaultAction"
            :color="action === state.card.defaultAction ? 'primary' : 'grey-8'"
            :icon="ACTION_ICONS[action]"
            :label="t(ACTION_LABELS[action])"
            @click="runCardAction(action)" />
        </div>
      </div>

      <div v-if="state.status === 'ready'" class="page-graph-legend" aria-hidden="true">
        <span><i class="page-graph-key is-page" />{{ t('fileman.graph.legendPage') }}</span>
        <span><i class="page-graph-key is-folder" />{{ t('fileman.graph.legendSection') }}</span>
        <span
          ><i class="page-graph-key is-collapsed">9</i
          >{{ t('fileman.graph.legendCollapsed') }}</span
        >
        <span v-if="hasDrafts"
          ><i class="page-graph-key is-draft" />{{ t('fileman.graph.unpublished') }}</span
        >
        <template v-if="currentView.links">
          <span><i class="page-graph-line is-out" />{{ t('fileman.graph.legendOut') }}</span>
          <span><i class="page-graph-line is-in" />{{ t('fileman.graph.legendIn') }}</span>
          <span
            ><i class="page-graph-line is-relation" />{{ t('fileman.graph.legendRelation') }}</span
          >
          <span><i class="page-graph-line is-redirect" />{{ t('fileman.graph.redirect') }}</span>
        </template>
      </div>
      <div v-if="state.status === 'ready'" class="page-graph-hint" aria-hidden="true">
        {{ t('fileman.graph.hint') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMinWidth } from '@/composables/screen'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { createGraph } from '@/graph/engine'
import { buildModel } from '@/graph/model'
import { DEFAULT_GRAPH_VIEW, GRAPH_VIEWS, graphView } from '@/graph/views'

/**
 * The file manager's graph view: every page of a locale the reader may see, as a tree, a radial tree,
 * or a ring of pages with the links between them drawn across it.
 *
 * This component is the chrome. The drawing is `graph/engine.js`, which owns its SVG outright -- see
 * the header there for why -- and is handed the data and the view, and reports back what it is
 * showing. Everything d3 is behind this component, which the file manager loads only when the view is
 * first opened.
 */

const props = defineProps({
  /** Which locale's pages are drawn. */
  locale: {
    type: String,
    required: true
  },
  /** What the header's search field holds, matched against every title and path. */
  search: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'open'])

const { t } = useI18n()
const siteStore = useSiteStore()
const userStore = useUserStore()

/**
 * Which view was open last. Per browser, like the file list's own view options: it is how somebody
 * likes to look at a wiki, not something about the wiki.
 */
const VIEW_KEY = 'wiki.fileman.graphView'

const ACTION_ICONS = {
  open: 'la:external-link-alt',
  zoom: 'la:search-plus',
  up: 'la:search-minus',
  more: 'la:plus-circle'
}
const ACTION_LABELS = {
  open: 'fileman.graph.actionOpen',
  zoom: 'fileman.graph.actionZoom',
  up: 'fileman.graph.actionUp',
  more: 'fileman.graph.actionMore'
}

/** How long the card outlives the pointer leaving its node, for the pointer to get into it. */
const CARD_LINGER = 240
/** The card's own size, for keeping it on screen; its CSS holds it to these. */
const CARD_WIDTH = 280
const CARD_HEIGHT = 190

function storedView() {
  try {
    return graphView(globalThis.localStorage?.getItem(VIEW_KEY) ?? '').key
  } catch {
    return DEFAULT_GRAPH_VIEW.key
  }
}

const canvas = ref(null)
let graph = null
let model = null
let cardTimer = null
let loadCount = 0

const state = reactive({
  status: 'loading',
  view: storedView(),
  trail: [],
  matchCount: 0,
  truncated: false,
  card: null
})

const currentView = computed(() => graphView(state.view))

/** The level above the one the graph is rooted at, or null at the top. */
const parentLevel = computed(() => (state.trail.length > 1 ? state.trail.at(-2) : null))

/*
  The toolbar is one line at every width, and these are what give way to keep it one: the view names
  below 1200px, where the three of them stop fitting beside everything else, and the Back and Parent
  Level labels on a phone.
  Wrapping instead put the toolbar on two and three lines, with its controls stranded at the top of it.
*/
const isWide = useMinWidth(1200)
const isAtLeastSm = useMinWidth(600)
const isNarrow = computed(() => !isAtLeastSm.value)

const viewOptions = computed(() =>
  GRAPH_VIEWS.map((view) => ({
    value: view.key,
    icon: view.icon,
    ...(isWide.value
      ? { label: t(view.labelKey) }
      : { ariaLabel: t(view.labelKey), tooltip: t(view.labelKey) })
  }))
)

const hasDrafts = ref(false)

const cardPath = computed(() => {
  const card = state.card
  if (!card) {
    return ''
  }
  return `${siteStore.localeUrlPrefix(card.locale ?? props.locale)}/${card.path}`
})

const cardPageCount = computed(() => {
  const card = state.card
  if (!card || card.kind === 'more') {
    return ''
  }
  // -> For a section, how much is in it; a lone page is one page and says nothing
  if (card.isCollapsed || card.stub === 'locale' || card.pages > (card.isPage ? 1 : 0)) {
    const count = card.isPage && !card.isCollapsed ? card.pages - 1 : card.pages
    return count > 0 ? t('fileman.graph.pageCount', { count }, count) : ''
  }
  return ''
})

/** Beside the node, on whichever side has room, and never off the stage. */
const cardPlacement = computed(() => {
  const card = state.card
  if (!card || !canvas.value) {
    return { style: {}, flipped: false }
  }
  const { width, height } = canvas.value.getBoundingClientRect()
  let left = card.x + card.r + 14
  let flipped = false
  if (left + CARD_WIDTH > width - 8) {
    left = card.x - card.r - 14 - CARD_WIDTH
    flipped = true
  }
  left = Math.max(8, left)
  const top = Math.min(Math.max(8, card.y - 28), Math.max(8, height - CARD_HEIGHT - 8))
  return { style: { left: `${left}px`, top: `${top}px` }, flipped }
})

function localeName(code) {
  const locale = siteStore.locales.active.find((lc) => lc.code === code)
  return locale?.nativeName || locale?.name || siteStore.localeAlias(code)
}

function reduceMotion() {
  return (
    userStore.reduceMotion ||
    Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  )
}

function ensureGraph() {
  if (graph) {
    return graph
  }
  graph = createGraph(canvas.value, {
    labels: {
      graph: t('fileman.graph.title'),
      elsewhere: t('fileman.graph.elsewhere'),
      unpublished: t('fileman.graph.unpublished'),
      more: (count) => t('fileman.graph.more', { count }, count),
      pages: (count) => t('fileman.graph.pageCount', { count }, count),
      locale: localeName
    },
    reduceMotion,
    onOpen: (page) => emit('open', page),
    onChange(change) {
      state.trail = change.trail
      state.matchCount = change.matchCount
    },
    onHover(info) {
      if (info) {
        clearTimeout(cardTimer)
        state.card = info
      } else {
        dropCard()
      }
    }
  })
  return graph
}

async function load() {
  const run = ++loadCount
  state.status = 'loading'
  state.card = null
  try {
    const reply = await API_CLIENT.get(`sites/${siteStore.id}/tree/graph`, {
      searchParams: { locale: props.locale }
    }).json()
    // -> A locale switched while this was in flight: the later request owns the view
    if (run !== loadCount) {
      return
    }
    model = buildModel(reply, { rootTitle: siteStore.title || t('fileman.graph.site') })
    state.truncated = model.truncated
    hasDrafts.value = reply.pages.some((page) => !page.isPublished)
    if (model.pageCount < 1) {
      state.status = 'empty'
      return
    }
    // -> Shown before drawing, so the canvas has a size to fit the view to
    state.status = 'ready'
    await nextFrame()
    const g = ensureGraph()
    g.setSearch(props.search, { silent: true })
    g.setData(model, currentView.value)
  } catch (err) {
    if (run === loadCount) {
      console.warn(err)
      state.status = 'error'
    }
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function switchView(key) {
  state.view = key
  try {
    globalThis.localStorage?.setItem(VIEW_KEY, key)
  } catch {
    // -> Not remembered is fine; the view still switches
  }
  graph?.setView(currentView.value)
}

function keepCard() {
  clearTimeout(cardTimer)
}

function dropCard() {
  clearTimeout(cardTimer)
  cardTimer = setTimeout(() => {
    state.card = null
    graph?.clearHover()
  }, CARD_LINGER)
}

function runCardAction(action) {
  const id = state.card?.id
  state.card = null
  if (id) {
    graph?.activate(id, action)
  }
}

watch(
  () => props.locale,
  () => load()
)

watch(
  () => props.search,
  (query) => graph?.setSearch(query)
)

onMounted(load)

onBeforeUnmount(() => {
  clearTimeout(cardTimer)
  graph?.destroy()
  graph = null
})
</script>

<style lang="scss">
/*
  Unscoped, because nearly everything styled here is created by d3 and carries no scope attribute.
  Every selector starts at `.page-graph` instead.

  Colour comes in as two custom properties on each node, edge and link: `--h`, the section's hue, and
  `--s`, its saturation -- `0%` for what belongs to no section, which draws it grey. The lightness is
  the theme's, so a switch to dark mode is these rules alone and nothing has to be redrawn.
*/
.page-graph {
  --pg-out: #f59e0b;
  --pg-in: #0ea5e9;
  --pg-ink: #37474f;
  --pg-ink-soft: #78909c;
  --pg-bg: #fff;
  --pg-light: 46%;
  --pg-edge-light: 55%;

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--pg-ink);
  background-color: var(--pg-bg);

  @at-root .body--dark & {
    --pg-out: #fbbf24;
    --pg-in: #38bdf8;
    --pg-ink: #e0e0e0;
    --pg-ink-soft: #90a4ae;
    --pg-bg: #{$dark-6};
    --pg-light: 64%;
    --pg-edge-light: 60%;
  }

  &-toolbar {
    flex: 0 0 auto;
    min-height: 50px;

    @at-root .body--light & {
      background-color: $grey-1;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    @at-root .body--dark & {
      background-color: $dark-5;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
  }

  /* -> Shorter than the bar, so it divides the two controls rather than the bar itself */
  &-sep {
    flex: 0 0 auto;
    align-self: center;
    height: 24px;
  }

  &-matches,
  &-truncated {
    flex: 0 0 auto;
    font-size: 0.8125rem;
    color: var(--pg-ink-soft);
    white-space: nowrap;
    margin-inline: 8px;
  }

  &-truncated {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: $warning;
  }

  &-stage {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  &-canvas {
    position: absolute;
    inset: 0;

    &.is-hidden {
      visibility: hidden;
    }
  }

  &-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--pg-ink-soft);

    img {
      width: 96px;
      opacity: 0.7;
    }
  }

  /* -- THE CARD -------------------------------------------------------- */

  &-card {
    position: absolute;
    z-index: 2;
    width: 280px;
    max-height: 190px;
    overflow: hidden;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 0.8125rem;
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.18),
      0 2px 6px rgba(0, 0, 0, 0.12);
    animation: page-graph-card-in 0.16s ease-out;
    transform-origin: left center;

    &.is-flipped {
      transform-origin: right center;
    }

    @at-root .body--light & {
      background-color: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(0, 0, 0, 0.08);
    }
    @at-root .body--dark & {
      background-color: rgba(38, 42, 48, 0.97);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    &-title {
      font-size: 0.9375rem;
      font-weight: 600;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &-path {
      margin-top: 2px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.75rem;
      color: var(--pg-ink-soft);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &-facts {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;

      &:empty {
        display: none;
      }
    }

    &-links {
      display: flex;
      gap: 14px;
      margin-top: 8px;

      > span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }

    &-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
  }

  &-chip {
    padding: 1px 8px;
    border-radius: 99px;
    font-size: 0.6875rem;
    font-weight: 500;
    background-color: rgba(128, 128, 128, 0.16);

    &.is-draft {
      color: $warning;
      background-color: rgba($warning, 0.14);
    }
  }

  &-swatch {
    display: inline-block;
    width: 14px;
    height: 3px;
    border-radius: 2px;

    &.is-out {
      background-color: var(--pg-out);
    }
    &.is-in {
      background-color: var(--pg-in);
    }
  }

  /* -- LEGEND AND HINT ------------------------------------------------- */

  &-legend,
  &-hint {
    position: absolute;
    bottom: 10px;
    font-size: 0.75rem;
    color: var(--pg-ink-soft);
    pointer-events: none;
  }

  &-legend {
    left: 12px;
    right: 40%;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;

    > span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
  }

  &-hint {
    right: 12px;
    max-width: 38%;
    text-align: right;
  }

  &-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    font-style: normal;
    background-color: hsl(210 62% var(--pg-light));

    &.is-folder {
      background-color: var(--pg-bg);
      border: 2px solid hsl(210 62% var(--pg-light));
    }
    &.is-collapsed {
      width: 16px;
      height: 16px;
      font-size: 9px;
      font-weight: 700;
      color: hsl(210 62% var(--pg-light));
      background-color: hsl(210 62% var(--pg-light) / 0.18);
      border: 1.5px solid hsl(210 62% var(--pg-light));
    }
    &.is-draft {
      background-color: transparent;
      border: 1.5px dashed var(--pg-ink-soft);
    }
  }

  &-line {
    display: inline-block;
    width: 18px;
    height: 0;
    border-top: 2px solid var(--pg-ink-soft);

    &.is-out {
      border-top-color: var(--pg-out);
    }
    &.is-in {
      border-top-color: var(--pg-in);
    }
    &.is-relation {
      border-top-style: dotted;
    }
    &.is-redirect {
      border-top-style: dashed;
    }
  }

  @media (max-width: 899.98px) {
    &-hint {
      display: none;
    }
    &-legend {
      right: 12px;
    }
  }

  /* -- THE DRAWING ----------------------------------------------------- */

  .pg-svg {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    outline: none;
    user-select: none;
    touch-action: none;

    &:active {
      cursor: grabbing;
    }
  }

  .pg-edge {
    fill: none;
    stroke: hsl(var(--h) var(--s) var(--pg-edge-light) / 0.45);
    stroke-width: 1.25;
    transition:
      opacity 0.25s ease,
      stroke 0.25s ease;

    &.is-draft,
    &.is-stub {
      stroke-dasharray: 3 3;
    }

    &.is-trail {
      stroke: hsl(var(--h) var(--s) var(--pg-edge-light) / 0.95);
      stroke-width: 2;
    }
  }

  /* -> Inside the ring the folders are scaffolding for the bundles, not the thing being looked at */
  .pg-svg.is-relational .pg-edge {
    stroke: hsl(var(--h) var(--s) var(--pg-edge-light) / 0.12);

    &.is-trail {
      stroke: hsl(var(--h) var(--s) var(--pg-edge-light) / 0.5);
    }
  }

  .pg-link {
    fill: none;
    stroke: hsl(var(--h) var(--s) var(--pg-edge-light) / 0.32);
    stroke-linecap: round;
    transition:
      opacity 0.25s ease,
      stroke 0.25s ease;

    &--relation {
      stroke-dasharray: 1 3;
    }
    &--redirect {
      stroke-dasharray: 5 3;
    }

    &.is-stale {
      opacity: 0;
    }

    &.is-drawing {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: page-graph-draw 0.9s ease-out forwards;
    }

    /*
      A highlighted link flows: its dashes travel from the page it is written on to the page it points
      at, so which way a link goes can be read off it without an arrowhead on every line.
    */
    &.is-out,
    &.is-in {
      stroke-dasharray: 6 4;
      animation: page-graph-flow 0.7s linear infinite;
    }
    &.is-out {
      stroke: var(--pg-out);
    }
    &.is-in {
      stroke: var(--pg-in);
    }
  }

  .pg-node {
    cursor: default;
    transition: opacity 0.25s ease;

    &.is-actionable {
      cursor: pointer;
    }

    &.is-exiting {
      opacity: 0 !important;
      pointer-events: none;
    }
  }

  .pg-hit {
    fill: transparent;
  }

  .pg-dot {
    fill: hsl(var(--h) var(--s) var(--pg-light));
    stroke: var(--pg-bg);
    stroke-width: 1.5;
    transition:
      r 0.3s ease,
      stroke-width 0.2s ease;
  }

  .pg-node.is-folder:not(.is-collapsed) .pg-dot {
    stroke: hsl(var(--h) var(--s) var(--pg-light));
    stroke-width: 2;
  }
  .pg-node.is-folder:not(.is-page):not(.is-collapsed) .pg-dot {
    fill: var(--pg-bg);
  }

  .pg-node.is-collapsed .pg-dot,
  .pg-node--more .pg-dot,
  .pg-node--stub .pg-dot,
  .pg-node--group .pg-dot {
    fill: hsl(var(--h) var(--s) var(--pg-light) / 0.16);
    stroke: hsl(var(--h) var(--s) var(--pg-light));
    stroke-width: 1.5;
  }
  .pg-node--more .pg-dot,
  .pg-node--stub .pg-dot {
    stroke-dasharray: 2 2;
  }

  .pg-node.is-draft {
    opacity: 0.6;

    .pg-dot {
      fill: var(--pg-bg);
      stroke: hsl(var(--h) var(--s) var(--pg-light));
      stroke-dasharray: 2 1.5;
      stroke-width: 1.5;
    }
    .pg-label {
      font-style: italic;
    }
  }

  .pg-count {
    font-size: 9px;
    font-weight: 700;
    fill: hsl(var(--h) var(--s) var(--pg-light));
    pointer-events: none;
  }

  .pg-label {
    font-size: 11px;
    fill: currentColor;
    paint-order: stroke;
    stroke: var(--pg-bg);
    stroke-width: 3px;
    stroke-linejoin: round;
    transition: opacity 0.2s ease;
  }
  .pg-svg.is-tree .pg-label {
    font-size: 12px;
  }
  .pg-svg.is-relational .pg-label {
    font-size: 10.5px;
  }
  .pg-node.is-folder .pg-label,
  .pg-node.is-focus .pg-label {
    font-weight: 600;
  }
  .pg-svg.is-relational .pg-node.is-folder:not(.is-collapsed) .pg-label {
    fill: var(--pg-ink-soft);
    font-weight: 500;
  }
  .pg-node--stub .pg-label,
  .pg-node--group .pg-label,
  .pg-node--more .pg-label {
    fill: var(--pg-ink-soft);
    font-style: italic;
  }

  /*
    Zoomed far out a label is a smudge, so they go -- the pages' first, the sections' after. Whatever
    the reader is pointing at, or searched for, keeps its name.
  */
  .pg-svg.is-far .pg-node:not(.is-folder):not(.is-linked):not(.is-match) .pg-label,
  .pg-svg.is-farther .pg-node:not(.is-linked):not(.is-match) .pg-label {
    opacity: 0;
  }

  /* -- HIGHLIGHT ------------------------------------------------------- */

  .pg-svg.is-highlighting {
    .pg-link:not(.is-out):not(.is-in) {
      opacity: 0.12;
    }
    .pg-node:not(.is-linked) {
      opacity: 0.35;
    }
    .pg-node.is-linked .pg-label {
      font-weight: 600;
    }
  }

  .pg-node.is-highlighted .pg-dot,
  .pg-node.is-active .pg-dot {
    stroke: var(--pg-ink);
    stroke-width: 2.5;
  }

  .pg-svg:focus-visible .pg-node.is-active .pg-hit {
    fill: none;
    stroke: var(--pg-out);
    stroke-width: 2;
    stroke-dasharray: 3 2;
  }

  /* -- SEARCH ---------------------------------------------------------- */

  .pg-svg.has-search:not(.is-highlighting) {
    .pg-node:not(.is-match):not(.is-contains-match) {
      opacity: 0.25;
    }
    .pg-link,
    .pg-edge {
      opacity: 0.35;
    }
  }

  .pg-node.is-match .pg-dot,
  .pg-node.is-contains-match .pg-dot {
    stroke: var(--pg-out);
    stroke-width: 3;
  }
  .pg-node.is-match .pg-label {
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .pg-link.is-out,
    .pg-link.is-in {
      animation: none;
    }
    .page-graph-card {
      animation: none;
    }
  }
}

/* -> The reader's own Reduce Motion setting; see `css/_animation.scss` on why every rule needs a twin */
body.body--reduce-motion .page-graph {
  .pg-link.is-out,
  .pg-link.is-in,
  .page-graph-card {
    animation: none;
  }
}

@keyframes page-graph-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes page-graph-flow {
  to {
    stroke-dashoffset: -10;
  }
}

@keyframes page-graph-card-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
}
</style>
