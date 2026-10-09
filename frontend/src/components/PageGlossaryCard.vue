<template>
  <!--
    Teleported, as the annotation cards are, so that `position: fixed` means the window. A tooltip in
    the ARIA sense: it describes the link it is over (`aria-describedby`, set while it is up). Its Read
    More is for the pointer only, out of the tab order: keyboard focus stays on the term, whose Enter
    already does the same thing, and the card goes when focus leaves the term.
  -->
  <teleport to="body">
    <div
      v-if="state.term"
      ref="cardEl"
      :id="cardId"
      class="page-glossary-card"
      role="tooltip"
      :lang="locale"
      :dir="siteStore.localeDir(locale)"
      :style="state.style"
      @mouseenter="cancelHide"
      @mouseleave="scheduleHide">
      <div class="page-glossary-card-name">{{ state.term.term }}</div>
      <div v-if="state.term.expansion" class="page-glossary-card-expansion">
        {{ state.term.expansion }}
      </div>
      <!--
        -> Safe to hand to v-html: `renderers/glossary.js` renders with raw HTML disabled, and nothing
           stored is HTML -- the same boundary as the overlay's.
      -->
      <div
        v-if="state.term.definition"
        ref="bodyEl"
        class="page-glossary-card-body"
        :class="{ 'is-clipped': state.clipped }"
        v-html="definitionHtml" />
      <!-- -> A real link, so that a middle-click or a ctrl-click still opens it in a new tab -->
      <a
        class="page-glossary-card-more"
        :href="glossaryHref(state.term.term)"
        tabindex="-1"
        @click="openTerm">
        {{ t('glossary.readMore') }}
      </a>
    </div>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { GLOSSARY_LINK_CLASS } from '@/helpers/glossaryLinker'
import { glossaryHref, glossaryLinkTarget } from '@/helpers/glossaryUrl'
import { renderDefinition } from '@/renderers/glossary'

import { useGlossaryStore } from '@/stores/glossary'
import { useSiteStore } from '@/stores/site'

/**
 * The card over a glossary link in an article: the term, its expansion and the start of its
 * definition, shown while the link is hovered or focused (spec §9). Listens on the article rather than
 * on each link, since the links are made after the render is written and re-made whenever a term
 * changes.
 */

const props = defineProps({
  /** The element the render was written into. */
  root: {
    type: Object,
    default: null
  },
  /** The locale the page is written in, which the card is too. */
  locale: {
    type: String,
    required: true
  },
  /** Which term a link is to: `(anchor) => Promise<?string>`, an id or null for none. */
  resolveTermId: {
    type: Function,
    required: true
  }
})

/**
 * `open` -- Read More was clicked, with the `{ name, locale }` of the link the card is over: the page
 * follows it exactly as it follows a click on that link.
 */
const emit = defineEmits(['open'])

/** Long enough that moving the pointer across a paragraph does not flash a card at every term. */
const OPEN_DELAY = 400

/** Long enough to move the pointer from the link onto the card. */
const CLOSE_DELAY = 200

/** Clear space between the card and its link, and between the card and the window's edge. */
const GAP = 6
const MARGIN = 12

// STORES

const glossaryStore = useGlossaryStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const cardId = `glossary-card-${useId()}`
const cardEl = ref(null)
const bodyEl = ref(null)

const state = reactive({
  term: null,
  style: {},
  /** Whether the definition runs on past what the card shows, which fades its last line out. */
  clipped: false
})

let anchor = null
let openTimer = null
let closeTimer = null
/** Bumped by every show and hide, so that a term arriving for a card nobody wants any more is dropped. */
let seq = 0

const definitionHtml = computed(() => renderDefinition(state.term?.definition))

// METHODS

function linkOf(target) {
  const link = target?.closest?.(`a.${GLOSSARY_LINK_CLASS}`)
  return link && props.root?.contains(link) ? link : null
}

async function show(link) {
  clearTimeout(openTimer)
  cancelHide()
  if (link === anchor && state.term) {
    return
  }
  const mine = ++seq
  const id = await props.resolveTermId(link)
  const term = id ? await glossaryStore.term(id) : null
  if (mine !== seq || !link.isConnected) {
    return
  }
  if (!term) {
    hide()
    return
  }
  anchor?.removeAttribute('aria-describedby')
  anchor = link
  anchor.setAttribute('aria-describedby', cardId)
  // -> Drawn out of sight first: where it goes depends on how tall it turned out
  state.style = { top: '0px', left: '0px', visibility: 'hidden' }
  state.term = term
  await nextTick()
  if (mine !== seq) {
    return
  }
  state.clipped = Boolean(bodyEl.value && bodyEl.value.scrollHeight > bodyEl.value.clientHeight + 1)
  place()
}

/**
 * Under the link, or over it where there is no room below. Measured against the link's FIRST line box,
 * so a term that wraps onto a second line is not given a card floating between the two.
 */
function place() {
  if (!anchor || !cardEl.value) {
    return
  }
  const rect = anchor.getClientRects()[0] ?? anchor.getBoundingClientRect()
  const width = cardEl.value.offsetWidth
  const height = cardEl.value.offsetHeight
  let top = rect.bottom + GAP
  if (top + height > window.innerHeight - MARGIN && rect.top - GAP - height > MARGIN) {
    top = rect.top - GAP - height
  }
  const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN))
  state.style = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function hide() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
  seq++
  anchor?.removeAttribute('aria-describedby')
  anchor = null
  state.term = null
}

function scheduleHide() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(hide, CLOSE_DELAY)
}

function cancelHide() {
  clearTimeout(closeTimer)
}

/** Read More: what a click on the term would have done. A modified click is the browser's, as anywhere. */
function openTerm(ev) {
  if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) {
    return
  }
  const target = glossaryLinkTarget(anchor)
  if (!target) {
    return
  }
  ev.preventDefault()
  hide()
  emit('open', target)
}

function onPointerOver(ev) {
  const link = linkOf(ev.target)
  if (!link) {
    return
  }
  cancelHide()
  if (link === anchor && state.term) {
    return
  }
  clearTimeout(openTimer)
  openTimer = setTimeout(() => show(link), OPEN_DELAY)
}

function onPointerOut(ev) {
  const link = linkOf(ev.target)
  if (!link || link.contains(ev.relatedTarget)) {
    return
  }
  clearTimeout(openTimer)
  if (!cardEl.value?.contains(ev.relatedTarget)) {
    scheduleHide()
  }
}

function onFocusIn(ev) {
  const link = linkOf(ev.target)
  if (link) {
    show(link)
  }
}

function onFocusOut(ev) {
  if (linkOf(ev.target)) {
    hide()
  }
}

function onKeyDown(ev) {
  if (ev.key === 'Escape' && state.term) {
    hide()
  }
}

// -> The card is placed once; anything that moves the link out from under it puts it away instead
function onViewportChange() {
  if (state.term) {
    hide()
  }
}

function attach(root) {
  root?.addEventListener('pointerover', onPointerOver)
  root?.addEventListener('pointerout', onPointerOut)
  root?.addEventListener('focusin', onFocusIn)
  root?.addEventListener('focusout', onFocusOut)
}

function detach(root) {
  root?.removeEventListener('pointerover', onPointerOver)
  root?.removeEventListener('pointerout', onPointerOut)
  root?.removeEventListener('focusin', onFocusIn)
  root?.removeEventListener('focusout', onFocusOut)
}

watch(
  () => props.root,
  (root, previous) => {
    detach(previous)
    attach(root)
    hide()
  },
  { immediate: true }
)

document.addEventListener('keydown', onKeyDown)
document.addEventListener('scroll', onViewportChange, { capture: true, passive: true })
window.addEventListener('resize', onViewportChange)

onBeforeUnmount(() => {
  detach(props.root)
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('scroll', onViewportChange, { capture: true })
  window.removeEventListener('resize', onViewportChange)
  hide()
})

defineExpose({ hide })
</script>

<style lang="scss">
/* -> The surface of the annotation cards (`PageAnnotationsLayer.vue`), which float over the same article */
.page-glossary-card {
  position: fixed;
  z-index: 2001;
  width: max-content;
  max-width: min(340px, calc(100vw - 24px));
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  /* -> Stated: teleported to `<body>`, it would otherwise inherit the browser's black in either theme */
  color: #26292e;
  font-size: 14px;
  line-height: 1.45;

  @at-root .body--dark & {
    border-color: rgba(255, 255, 255, 0.1);
    background-color: $dark-2;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.87);
  }
}

.page-glossary-card-name {
  font-weight: 600;
  font-size: 15px;
}

.page-glossary-card-expansion {
  opacity: 0.7;
}

/*
  The start of the definition: about five lines, the rest faded out rather than cut mid-word. The whole
  of it is a click away, in the overlay.
*/
.page-glossary-card-body {
  max-height: calc(1.45em * 5);
  margin-top: 6px;
  overflow: hidden;

  &.is-clipped {
    mask-image: linear-gradient(to bottom, #000 60%, transparent);
  }

  p,
  ul,
  ol,
  pre {
    margin: 0 0 0.4em;
  }

  ul,
  ol {
    padding-inline-start: 1.25em;
  }

  code {
    padding: 0 0.25em;
    border-radius: 3px;
    background-color: rgba(0, 0, 0, 0.06);
    font-size: 0.9em;

    @at-root .body--dark & {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  a {
    color: var(--color-primary);

    @at-root .body--dark & {
      color: var(--color-primary-light);
    }
  }
}

.page-glossary-card-more {
  display: inline-block;
  margin-top: 8px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  @at-root .body--dark & {
    color: var(--color-primary-light);
  }
}
</style>
