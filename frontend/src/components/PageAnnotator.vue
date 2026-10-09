<template>
  <!--
    Teleported, so that `position: fixed` means the viewport: the page column is an ancestor that a
    view transition snapshots, and a fixed box inside anything that ends up with a transform is fixed
    to that instead.
  -->
  <teleport to="body">
    <transition name="page-annotator-slide" appear>
      <div
        ref="panelEl"
        class="page-annotator"
        :class="{ 'is-review': state.mode === `review` }"
        role="region"
        :aria-label="t(`common.comments.annotationsTitle`)">
        <!--
          The toolbar: pick a passage, write a note on it, repeat. Annotate is on when the panel opens
          and goes off again after each passage, so that a stray drag across the article afterwards --
          reading, copying a sentence -- is not taken for another annotation.
        -->
        <div class="page-annotator-bar" v-if="state.mode === `annotate`">
          <w-btn
            no-caps
            :color="state.picking ? `accent` : `primary`"
            icon="la:highlighter"
            unelevated
            :label="t(`common.comments.annotate`)"
            :aria-pressed="String(state.picking)"
            :disable="Boolean(state.draft)"
            @click="togglePicking" />
          <div class="page-annotator-hint" aria-live="polite">{{ hint }}</div>
          <w-space />
          <w-btn flat no-caps color="grey" :label="t(`common.actions.cancel`)" @click="cancel" />
          <w-btn
            unelevated
            no-caps
            color="primary"
            icon="la:check"
            :label="t(`common.comments.annotationReview`)"
            :disable="state.pending.length < 1 || Boolean(state.draft)"
            @click="startReview">
            <span class="page-annotator-count" v-if="state.pending.length > 0">
              {{ state.pending.length }}
            </span>
          </w-btn>
        </div>
        <!--
          The review: one comment about the page as a whole, then each passage with its note, then
          the way out in either direction. Built on the same box every other comment is written in, so
          the general comment has the preview and the `@` completion the others have.
        -->
        <div class="page-annotator-review" v-else>
          <div class="text-subtitle2 pb-2">{{ t('common.comments.annotationReviewTitle') }}</div>
          <page-comment-editor
            ref="commentEditor"
            v-model="state.comment"
            allow-empty
            cancelable
            :rows="3"
            :busy="state.busy"
            :placeholder="t(`common.comments.annotationGeneralPlaceholder`)"
            :submit-label="t(`common.comments.postWithAnnotations`)"
            :cancel-label="t(`common.comments.annotationGoBack`)"
            @submit="post"
            @cancel="backToAnnotating">
            <div class="text-caption text-grey-6 pt-3 pb-1">
              {{ t('common.comments.annotationsCount', state.pending.length) }}
            </div>
            <ol class="page-annotator-list">
              <li v-for="(item, idx) of state.pending" :key="item.key" class="page-annotator-item">
                <div class="min-w-0 flex-1">
                  <div class="page-annotation-quote">{{ item.anchor.exact }}</div>
                  <div class="page-comment-body" v-html="renderComment(item.note)" />
                </div>
                <w-btn
                  flat
                  round
                  dense
                  size="sm"
                  color="grey"
                  icon="la:crosshairs"
                  :aria-label="t(`common.comments.annotationLocate`)"
                  @click="showPending(item)">
                  <w-tooltip>{{ t('common.comments.annotationLocate') }}</w-tooltip>
                </w-btn>
                <w-btn
                  flat
                  round
                  dense
                  size="sm"
                  color="negative"
                  icon="la:trash"
                  :aria-label="t(`common.comments.annotationRemove`)"
                  :disable="state.busy"
                  @click="removePending(idx)">
                  <w-tooltip>{{ t('common.comments.annotationRemove') }}</w-tooltip>
                </w-btn>
              </li>
            </ol>
          </page-comment-editor>
        </div>
      </div>
    </transition>
    <!--
      The note on the passage just picked, beside it. Fixed rather than in the article's flow so that
      nothing in the article moves while it is open -- it is positioned off the passage's own boxes,
      and follows them as the column scrolls.
    -->
    <div
      v-if="state.draft"
      ref="cardEl"
      class="page-annotator-card"
      :style="state.cardStyle"
      @keydown.esc.stop="discardDraft">
      <w-input
        ref="noteInput"
        type="textarea"
        outlined
        dense
        hide-bottom-space
        :rows="3"
        :placeholder="t(`common.comments.annotationNotePlaceholder`)"
        :aria-label="t(`common.comments.annotationNotePlaceholder`)"
        v-model="state.draft.note"
        @keydown.ctrl.enter="commitDraft"
        @keydown.meta.enter="commitDraft" />
      <div class="flex justify-end gap-1 pt-2">
        <w-btn
          flat
          dense
          no-caps
          size="sm"
          padding="none sm"
          color="grey"
          :label="t(`common.actions.discard`)"
          @click="discardDraft" />
        <w-btn
          unelevated
          dense
          no-caps
          size="sm"
          padding="none sm"
          color="primary"
          :label="t(`common.actions.ok`)"
          :disable="!draftIsValid"
          @click="commitDraft" />
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { confirm } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { apiErrorMessage } from '@/helpers/apiError'
import {
  HIGHLIGHTS,
  QUOTE_MAX_LENGTH,
  describeRange,
  indexText,
  locateAnchor,
  paintHighlight,
  placeBeside,
  scrollRangeIntoView
} from '@/helpers/annotations'
import { renderComment } from '@/renderers/comment'

import PageCommentEditor from '@/components/PageCommentEditor.vue'

/**
 * Annotating the article: picking passages of it, a note on each, and posting them as one comment.
 *
 * Mounted by `pages/Index.vue` over the article, from the New Annotation button beside the Talk
 * view, and unmounted when the reader posts, cancels, or goes anywhere else -- nothing here is kept
 * between two visits, since the passages are live ranges into one render of one page.
 *
 * **Nothing is written into the article.** A picked passage is described (`helpers/annotations.js`)
 * and painted with the CSS Custom Highlight API, so the text the second passage is picked from is
 * exactly the text the first one was. Where the browser has no such API the passages are simply not
 * coloured; everything else works.
 *
 * Signed-in readers only, which is the caller's check: an annotation is resolved later by whoever
 * posted it, and a guest has no session to be recognized by.
 */
const props = defineProps({
  /** The element the article was rendered into -- what passages may be picked from. */
  root: {
    type: Object,
    default: null
  },
  /** Bumped when the article's elements change under the same text. See `PageAnnotationsLayer.vue`. */
  contentRevision: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'posted'])

/** As `ANNOTATION_NOTE_MAX_LENGTH` on the server. */
const NOTE_MAX_LENGTH = 2000

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const panelEl = ref(null)
const cardEl = ref(null)
const noteInput = ref(null)
const commentEditor = ref(null)

let nextKey = 0

const state = reactive({
  /** `annotate` while passages are being picked, `review` once the reader has asked to review them. */
  mode: 'annotate',
  /** Whether a drag across the article picks a passage. */
  picking: true,
  /**
   * The passage just picked, with its note still being written. Its range is `markRaw`: a DOM object
   * behind a reactive proxy has its methods called with the proxy as `this`, which the browser
   * refuses.
   */
  draft: null,
  /** Picked and noted: `{ key, anchor, range, note }`, in the order they were picked. */
  pending: [],
  /** The comment on the page as a whole, written in the review. */
  comment: '',
  busy: false,
  cardStyle: {}
})

// COMPUTED

const hint = computed(() => {
  if (state.draft) {
    return t('common.comments.annotateNoteHint')
  }
  return state.picking ? t('common.comments.annotateHint') : t('common.comments.annotateIdleHint')
})

/** A note is required, and held to the server's limit -- the box has no cap of its own to stop at. */
const draftIsValid = computed(() => {
  const length = state.draft?.note.trim().length ?? 0
  return length > 0 && length <= NOTE_MAX_LENGTH
})

/** Whether leaving now would throw away something the reader wrote. */
const hasWork = computed(() => state.pending.length > 0 || Boolean(state.draft))

// METHODS

function paint() {
  paintHighlight(
    HIGHLIGHTS.pending,
    state.pending.map((item) => item.range)
  )
  paintHighlight(HIGHLIGHTS.draft, state.draft ? [state.draft.range] : [])
}

/*
  The passages picked so far, found again in the article as it now stands: its elements changed under
  the same text, and a range that began or ended inside a word that was wrapped no longer does. Found by
  the same description that will be posted, so what is painted is what will be saved; one that cannot
  be found keeps the range it had, which is still over the right words, give or take that word.
*/
watch(
  () => props.contentRevision,
  () => {
    if (!props.root || (state.pending.length < 1 && !state.draft)) {
      return
    }
    const index = indexText(props.root)
    for (const item of [...state.pending, state.draft].filter(Boolean)) {
      const range = locateAnchor(index, item.anchor)
      if (range) {
        item.range = markRaw(range)
      }
    }
    paint()
  },
  { flush: 'post' }
)

function togglePicking() {
  state.picking = !state.picking
}

/**
 * A selection only means something once it is finished, which is when the pointer comes up -- or,
 * for somebody selecting from the keyboard, when Shift does. The selection itself settles after the
 * event, hence the turn of the loop before reading it.
 */
function onPointerUp(ev) {
  if (!state.picking || state.draft || state.mode !== 'annotate') {
    return
  }
  if (panelEl.value?.contains(ev.target)) {
    return
  }
  setTimeout(pickSelection, 0)
}

function onKeyUp(ev) {
  if (ev.key === 'Shift') {
    onPointerUp(ev)
  }
}

/**
 * The reader's selection, cut down to the article.
 *
 * A drag that runs past the end of the article into what follows it is still a passage of the
 * article -- the overshoot is cut off rather than the whole drag refused.
 */
function selectedRange() {
  const selection = window.getSelection()
  if (!props.root || !selection || selection.rangeCount < 1 || selection.isCollapsed) {
    return null
  }
  const range = selection.getRangeAt(0).cloneRange()
  const article = document.createRange()
  article.selectNodeContents(props.root)
  if (range.compareBoundaryPoints(Range.START_TO_START, article) < 0) {
    range.setStart(article.startContainer, article.startOffset)
  }
  if (range.compareBoundaryPoints(Range.END_TO_END, article) > 0) {
    range.setEnd(article.endContainer, article.endOffset)
  }
  return range.collapsed ? null : range
}

function pickSelection() {
  const range = selectedRange()
  if (!range) {
    return
  }
  const described = describeRange(indexText(props.root), range)
  window.getSelection()?.removeAllRanges()
  if (!described) {
    return
  }
  if (described.anchor.exact.length > QUOTE_MAX_LENGTH) {
    notify({ type: 'warning', message: t('common.comments.annotationTooLong') })
    return
  }
  state.draft = { anchor: described.anchor, range: markRaw(described.range), note: '' }
  paint()
  nextTick(() => {
    placeCard()
    noteInput.value?.focus({ preventScroll: true })
  })
}

/**
 * Put the note card to the right of the passage's last line, or under it where the window has no
 * room on the right -- a passage ending near the far edge of the column, or any passage on a phone.
 * Kept inside the window and clear of the panel at the bottom either way.
 */
function placeCard() {
  if (!state.draft) {
    return
  }
  state.cardStyle = placeBeside(state.draft.range, {
    height: cardEl.value?.offsetHeight,
    floor: panelEl.value?.getBoundingClientRect().top
  })
}

function commitDraft() {
  if (!draftIsValid.value) {
    return
  }
  state.pending.push({ ...state.draft, key: nextKey++, note: state.draft.note.trim() })
  state.draft = null
  state.picking = false
  paint()
}

function discardDraft() {
  state.draft = null
  state.picking = false
  paint()
}

function startReview() {
  state.picking = false
  state.mode = 'review'
  nextTick(() => commentEditor.value?.focus())
}

function backToAnnotating() {
  state.mode = 'annotate'
}

function showPending(item) {
  scrollRangeIntoView(item.range)
}

function removePending(idx) {
  state.pending.splice(idx, 1)
  paint()
  // -> Nothing left to review is nothing left to post as annotations: back to picking some
  if (state.pending.length < 1) {
    state.mode = 'annotate'
  }
}

/**
 * Ask before throwing away what the reader has picked, if they have picked anything.
 *
 * @returns {Promise<boolean>} Whether it is fine to go.
 */
function confirmDiscard() {
  if (!hasWork.value) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    confirm({
      title: t('common.comments.annotationCancelTitle'),
      message: t('common.comments.annotationCancelWarn'),
      cancel: true,
      color: 'negative',
      okLabel: t('common.actions.discard')
    })
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false))
  })
}

async function cancel() {
  if (await confirmDiscard()) {
    emit('close')
  }
}

async function post() {
  state.busy = true
  try {
    const comment = await API_CLIENT.post(`sites/${siteStore.id}/pages/${pageStore.id}/comments`, {
      json: {
        content: state.comment,
        annotations: state.pending.map(({ note, anchor }) => ({ note, anchor }))
      }
    }).json()
    // -> Emptied first, so that the page being left does not ask whether to throw them away
    state.pending = []
    notify({ type: 'positive', message: t('common.comments.postSuccess') })
    emit('posted', comment.id)
  } catch (err) {
    // -> In full, as for any other comment: a cooldown or a spam refusal is something to act on
    notify({
      type: 'negative',
      message: t('common.comments.postFailed'),
      caption: apiErrorMessage(err),
      timeout: 10000
    })
  }
  state.busy = false
}

/**
 * A link in the article is text to be picked while picking, not somewhere to go: a drag that starts
 * on one ends in a click on it. Captured, so the article's own handler sees a click already taken.
 */
function onArticleClick(ev) {
  if ((state.picking || state.draft) && ev.target?.closest?.('a')) {
    ev.preventDefault()
  }
}

function onViewportChange() {
  if (state.draft) {
    placeCard()
  }
}

// MOUNTED

onMounted(() => {
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('keyup', onKeyUp)
  // -> Captured: the article scrolls in a box of its own, and a scroll does not bubble
  document.addEventListener('scroll', onViewportChange, { capture: true, passive: true })
  window.addEventListener('resize', onViewportChange)
  props.root?.addEventListener('click', onArticleClick, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('keyup', onKeyUp)
  document.removeEventListener('scroll', onViewportChange, { capture: true })
  window.removeEventListener('resize', onViewportChange)
  props.root?.removeEventListener('click', onArticleClick, true)
  // -> Its own two only: with View All Annotations on, the rest of the page's are still showing
  paintHighlight(HIGHLIGHTS.pending, [])
  paintHighlight(HIGHLIGHTS.draft, [])
})

// EXPOSED

/* -> For `pages/Index.vue`, which draws the article's cursor and asks before the reader leaves */
defineExpose({
  isPicking: computed(() => state.mode === 'annotate' && state.picking && !state.draft),
  confirmDiscard
})
</script>

<style lang="scss">
/*
  The panel: a sheet pulled up from the bottom edge of the window, as wide as a comfortable line of
  text and no wider, so that the article on either side of it stays in view while passages are picked.
*/
.page-annotator {
  position: fixed;
  z-index: 2000;
  bottom: 0;
  left: 50%;
  width: min(760px, 100vw - 32px);
  translate: -50% 0;
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background-color: #fff;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.16);
  color: #26292e;

  @at-root .body--dark & {
    border-color: rgba(255, 255, 255, 0.08);
    background-color: $dark-2;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.87);
  }

  @media (max-width: $breakpoint-xs-max) {
    width: 100vw;
    border-radius: 12px 12px 0 0;
  }

  &.is-review {
    padding: 16px;
  }
}

.page-annotator-slide-enter-active,
.page-annotator-slide-leave-active {
  transition: transform 0.25s var(--ease-standard);
}

.page-annotator-slide-enter-from,
.page-annotator-slide-leave-to {
  transform: translateY(100%);
}

.page-annotator-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.page-annotator-hint {
  min-width: 0;
  font-size: 0.8125rem;
  opacity: 0.7;

  @media (max-width: $breakpoint-xs-max) {
    display: none;
  }
}

.page-annotator-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.25);
  font-size: 0.6875rem;
  line-height: 18px;
  text-align: center;
}

/*
  The review grows out of the toolbar rather than replacing it in a cut: the same sheet, pulled
  further up. Capped so the passages being reviewed can still be seen above it, and scrolling inside
  itself beyond that.
*/
.page-annotator-review {
  max-height: min(70vh, 640px);
  overflow-y: auto;
  animation: page-annotator-expand 0.25s var(--ease-standard);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes page-annotator-expand {
  from {
    max-height: 44px;
    opacity: 0.4;
  }
  to {
    max-height: min(70vh, 640px);
    opacity: 1;
  }
}

.page-annotator-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.page-annotator-item {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);

  @at-root .body--dark & {
    border-top-color: rgba(255, 255, 255, 0.08);
  }
}

/*
  The note card, beside the passage it is about. Above the panel in the stacking order: near the
  bottom of the window the two can meet, and the card is what the reader is typing in.
*/
.page-annotator-card {
  position: fixed;
  z-index: 2001;
  padding: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  /*
    Stated, as the panel's is: teleported to `<body>`, the card inherits nothing but the browser's own
    black -- which is what the note box typed in on the dark surface, and could not be read.
  */
  color: #26292e;

  @at-root .body--dark & {
    border-color: rgba(255, 255, 255, 0.1);
    background-color: $dark-2;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.87);
  }
}

/*
  While picking: the article reads as text to be selected, links included, which is the whole of what
  a click on it does until a passage is picked. Room is kept below the last paragraph for the panel,
  so that the end of the article can still be scrolled clear of it.
*/
.page-article-col.is-annotating .page-container-body {
  padding-bottom: 120px;
}

.page-article-col.is-picking .page-contents {
  &,
  * {
    cursor: text !important;
  }

  a,
  img {
    -webkit-user-drag: none;
  }
}
</style>
