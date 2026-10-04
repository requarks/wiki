<template>
  <!--
    The note of the annotation that was clicked, beside its passage. Teleported, as the annotator's
    card is, so that `position: fixed` means the window.
  -->
  <teleport to="body">
    <div
      v-if="openItem"
      ref="cardEl"
      class="page-annotation-popup"
      role="dialog"
      :aria-label="t(`common.comments.annotationsTitle`)"
      :style="state.cardStyle"
      @keydown.esc.stop="close">
      <div class="flex items-center gap-2">
        <w-avatar size="24px" :color="avatarColorFor(openItem.authorId)" text-color="white">
          <img v-if="openItem.authorHasAvatar" :src="`/_user/${openItem.authorId}/avatar`" alt="" />
          <span v-else>{{ (openItem.authorName || '?').trim().charAt(0).toUpperCase() }}</span>
        </w-avatar>
        <div class="min-w-0 truncate text-body2 font-medium">{{ openItem.authorName }}</div>
        <div class="shrink-0 text-caption text-grey-6">{{ relativeDate(openItem.createdAt) }}</div>
        <w-space />
        <w-btn
          flat
          round
          dense
          size="sm"
          color="grey"
          icon="la:times"
          :aria-label="t(`common.actions.close`)"
          @click="close" />
      </div>
      <div
        class="page-comment-body page-annotation-popup-note"
        :class="{ 'is-resolved': isResolved }"
        v-html="renderComment(openItem.annotation.note, state.mentions)" />
      <div class="page-annotation-popup-state" v-if="isResolved">
        <w-icon name="la:check-circle" size="1.1em" />
        {{
          openItem.annotation.resolvedByName
            ? t('common.comments.annotationResolvedBy', {
                name: openItem.annotation.resolvedByName
              })
            : t('common.comments.annotationResolved')
        }}
      </div>
      <div class="flex items-center gap-1 pt-2">
        <w-btn
          flat
          no-caps
          size="sm"
          padding="none xs"
          color="primary"
          icon="la:comments"
          :label="t(`common.comments.annotationViewComment`)"
          @click="emit(`view-comment`, openItem.commentId)" />
        <w-space />
        <w-btn
          v-if="mayResolve(openItem)"
          unelevated
          no-caps
          size="sm"
          padding="none sm"
          :color="isResolved ? `grey` : `positive`"
          :icon="isResolved ? `la:undo` : `la:check`"
          :label="
            isResolved
              ? t(`common.comments.annotationReopen`)
              : t(`common.comments.annotationResolve`)
          "
          :loading="state.busy"
          @click="toggleResolved" />
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { apiErrorMessage } from '@/helpers/apiError'
import { avatarColorFor } from '@/helpers/avatarColors'
import { relativeDate } from '@/helpers/datetime'
import {
  HIGHLIGHTS,
  indexText,
  locateAnchor,
  paintHighlight,
  placeBeside,
  rangeContainsPoint,
  scrollRangeIntoView
} from '@/helpers/annotations'
import { renderComment } from '@/renderers/comment'

/**
 * Every annotation on the page, painted over the article at once: View All Annotations, from the
 * Talk view's column, and what "Show in the article" beside a single annotation turns on too.
 *
 * Mounted by `pages/Index.vue` for as long as it is switched on, whichever view is on screen -- it
 * stays on until the reader turns it off from the Talk view -- and drawing only while the article is.
 *
 * **It loads the discussion itself** rather than borrowing the Talk view's, which is unmounted the
 * moment the reader comes back to the article. And it loads it again every time they do, since what
 * they came back from is where annotations are resolved and deleted.
 *
 * **A highlight cannot be clicked.** The Custom Highlight API paints a range without putting anything
 * in the article -- which is the point of it (`helpers/annotations.js`) -- so there is no element for
 * a click to land on. A click on the article is matched against the boxes of every passage instead,
 * and the pointer is turned into a hand over one the same way.
 */
const props = defineProps({
  /** The element the article was rendered into. */
  root: {
    type: Object,
    default: null
  },
  /** Whether the article is the view on screen. Nothing is painted or open while it is not. */
  active: {
    type: Boolean,
    default: false
  },
  /** Whether a click on a passage opens its note -- not while passages are being picked for a new comment. */
  interactive: {
    type: Boolean,
    default: true
  },
  /** An annotation to bring into view with its note open, as soon as it has been found. */
  revealId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['revealed', 'view-comment'])

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const cardEl = ref(null)

const state = reactive({
  loaded: false,
  /**
   * One entry per annotation that is still in the article: the annotation, what the popup says about
   * who made it, and where it is. `range` is `markRaw` for the reason the annotator's are.
   */
  items: [],
  mentions: [],
  /** The annotation whose note is open. */
  openId: null,
  cardStyle: {},
  busy: false
})

/** The last frame a hover test was asked for, so a burst of movement costs one test a frame. */
let hoverFrame = 0

// COMPUTED

const openItem = computed(() => state.items.find((item) => item.annotation.id === state.openId))

const isResolved = computed(() => Boolean(openItem.value?.annotation.resolvedAt))

const canModerate = computed(() => userStore.pagePermissions.includes('manage:comments'))
const canReview = computed(() => userStore.pagePermissions.includes('review:pages'))
const canWrite = computed(() => userStore.pagePermissions.includes('write:comments'))

// METHODS

/** As the Talk view decides it (`mayResolve` in `PageTalk.vue`), and as the server checks it. */
function mayResolve(item) {
  if (canModerate.value || canReview.value) {
    return true
  }
  return canWrite.value && Boolean(item.authorId) && item.authorId === userStore.id
}

async function load() {
  if (!pageStore.id) {
    return
  }
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/${pageStore.id}/comments`).json()
    state.mentions = resp?.mentions ?? []
    state.items = (resp?.comments ?? []).flatMap((comment) =>
      (comment.annotations ?? []).map((annotation) => ({
        annotation,
        commentId: comment.id,
        authorId: comment.authorId,
        authorName: comment.authorName,
        authorHasAvatar: comment.authorHasAvatar,
        createdAt: comment.createdAt,
        range: null
      }))
    )
    // -> Found before saying so: what waits on `loaded` to reveal one needs to know where it is
    locateAll()
    state.loaded = true
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.comments.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

/** Find every passage in the article as it stands, with one walk of it for all of them. */
function locateAll() {
  if (!props.root) {
    return
  }
  const index = indexText(props.root)
  for (const item of state.items) {
    const range = locateAnchor(index, item.annotation.anchor)
    item.range = range ? markRaw(range) : null
  }
  // -> One whose passage has gone since it was opened has nothing left to be beside
  if (state.openId && !openItem.value?.range) {
    state.openId = null
  }
  paint()
}

/**
 * Paint them all, open ones and resolved ones apart, and the one whose note is open as itself rather
 * than as either -- so it stands out from the rest without two highlights stacked on the same text.
 */
function paint() {
  const showing = props.active
  const others = state.items.filter((item) => item.range && item.annotation.id !== state.openId)
  paintHighlight(
    HIGHLIGHTS.shown,
    showing ? others.filter((i) => !i.annotation.resolvedAt).map((i) => i.range) : []
  )
  paintHighlight(
    HIGHLIGHTS.resolved,
    showing ? others.filter((i) => i.annotation.resolvedAt).map((i) => i.range) : []
  )
  paintHighlight(HIGHLIGHTS.focus, showing && openItem.value ? [openItem.value.range] : [])
}

function unpaint() {
  for (const name of [HIGHLIGHTS.shown, HIGHLIGHTS.resolved, HIGHLIGHTS.focus]) {
    paintHighlight(name, [])
  }
}

/** The annotation at a point on screen. Where passages overlap, the shortest -- the one aimed at. */
function itemAt(x, y) {
  let found = null
  for (const item of state.items) {
    if (!item.range || !rangeContainsPoint(item.range, x, y)) {
      continue
    }
    if (!found || item.annotation.anchor.exact.length < found.annotation.anchor.exact.length) {
      found = item
    }
  }
  return found
}

function open(item) {
  state.openId = item.annotation.id
  paint()
  nextTick(placeCard)
}

function close() {
  if (state.openId) {
    state.openId = null
    paint()
  }
}

function placeCard() {
  if (openItem.value?.range) {
    state.cardStyle = placeBeside(openItem.value.range, { height: cardEl.value?.offsetHeight })
  }
}

async function toggleResolved() {
  const item = openItem.value
  if (!item) {
    return
  }
  state.busy = true
  try {
    const updated = await API_CLIENT.put(
      `sites/${siteStore.id}/annotations/${item.annotation.id}/resolved`,
      { json: { resolved: !item.annotation.resolvedAt } }
    ).json()
    item.annotation = updated
    paint()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.comments.annotationUpdateFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.busy = false
}

/**
 * A click on a passage opens its note, and a click anywhere else in the article closes it. Captured,
 * so that a passage inside a link opens its note rather than following the link -- the article's own
 * handler sees a click already taken. A click that ends a selection is the reader selecting text.
 */
function onArticleClick(ev) {
  if (!props.active || !props.interactive) {
    return
  }
  if (!(window.getSelection()?.isCollapsed ?? true)) {
    return
  }
  const item = itemAt(ev.clientX, ev.clientY)
  if (item) {
    ev.preventDefault()
    open(item)
  } else {
    close()
  }
}

/** Anywhere outside both the article and the note -- the column beside it, the header -- closes it. */
function onDocumentPointerDown(ev) {
  if (!state.openId || cardEl.value?.contains(ev.target) || props.root?.contains(ev.target)) {
    return
  }
  close()
}

function onArticlePointerMove(ev) {
  if (hoverFrame || !props.active || !props.interactive) {
    return
  }
  const { clientX, clientY } = ev
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0
    // -> An attribute rather than a class: the article's classes are Vue's, and are rewritten whole
    //    whenever its binding changes. Styled in `_page-contents.scss`.
    props.root?.toggleAttribute('data-annotation-hover', Boolean(itemAt(clientX, clientY)))
  })
}

function onViewportChange() {
  if (state.openId) {
    placeCard()
  }
}

/** Bring an annotation into view with its note open. See `revealId`. */
function reveal(id) {
  const item = state.items.find((i) => i.annotation.id === id)
  if (item?.range) {
    open(item)
    scrollRangeIntoView(item.range)
    // -> The card is placed against where the passage was; it follows as the scroll moves it
  }
  emit('revealed')
}

// WATCHERS

// -> Back on the article: what was resolved or deleted in the discussion is on screen at once
watch(
  () => props.active,
  (isActive) => {
    if (isActive) {
      load()
    } else {
      close()
      paint()
    }
  }
)

watch(
  () => props.interactive,
  (isInteractive) => {
    if (!isInteractive) {
      close()
    }
  }
)

// -> A save re-renders the page, and every range into the old render points at nothing
watch(
  () => pageStore.render,
  () => locateAll(),
  { flush: 'post' }
)

watch(
  () => [props.revealId, state.loaded, props.active],
  () => {
    if (props.revealId && state.loaded && props.active) {
      reveal(props.revealId)
    }
  },
  // -> After the article is back on screen: a passage in a hidden column has no box to scroll to
  { immediate: true, flush: 'post' }
)

// MOUNTED

onMounted(() => {
  load()
  props.root?.addEventListener('click', onArticleClick, true)
  props.root?.addEventListener('pointermove', onArticlePointerMove)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('scroll', onViewportChange, { capture: true, passive: true })
  window.addEventListener('resize', onViewportChange)
})

onBeforeUnmount(() => {
  props.root?.removeEventListener('click', onArticleClick, true)
  props.root?.removeEventListener('pointermove', onArticlePointerMove)
  props.root?.removeAttribute('data-annotation-hover')
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('scroll', onViewportChange, { capture: true })
  window.removeEventListener('resize', onViewportChange)
  cancelAnimationFrame(hoverFrame)
  unpaint()
})
</script>

<style lang="scss">
/* -> As the annotator's note card, of which this is the reading half */
.page-annotation-popup {
  position: fixed;
  z-index: 2001;
  padding: 8px 10px 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  /* -> Stated: teleported to `<body>`, it would otherwise inherit the browser's black in either theme */
  color: #26292e;

  @at-root .body--dark & {
    border-color: rgba(255, 255, 255, 0.1);
    background-color: $dark-2;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.87);
  }
}

.page-annotation-popup-note {
  max-height: 240px;
  padding-top: 8px;
  overflow-y: auto;

  /* -> Done, as it is drawn in the Talk view */
  &.is-resolved {
    opacity: 0.5;
    text-decoration: line-through;
  }
}

.page-annotation-popup-state {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 6px;
  font-size: 12px;
  color: var(--q-positive);
}
</style>
