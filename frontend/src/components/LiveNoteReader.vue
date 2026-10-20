<template>
  <!--
    A live note as a page is read: the render alone, held to the centered measure, with its contents
    beside it -- the page view's own chrome (`_page-chrome.scss`), drawn the way `PageVersion.vue`
    draws it, so that a note being read looks like a page being read.

    `min-h-0` so the columns inside can be shorter than their content and scroll.
  -->
  <div
    class="page-container flex min-h-0 flex-nowrap items-stretch"
    :class="{ 'page-container--toc-left': tocColumnIsLeft }"
    style="flex: 1 1 100%">
    <div class="min-w-0 flex-1" :style="tocIsLeft ? `order: 2;` : `order: 1;`">
      <!-- -> Until the room has answered there is no note to draw, only an empty document -->
      <div v-if="!collabStore.hasSynced" class="page-placeholder">
        <w-spinner color="primary" size="48px" />
      </div>
      <div v-else-if="isEmpty" class="page-placeholder">
        <w-icon class="page-placeholder-icon" name="la:sticky-note" />
        <div class="text-body2 opacity-60">{{ t('liveNote.empty') }}</div>
      </div>
      <!--
        Hidden rather than taken out while a placeholder stands in for it, so that the element the
        render is written into is always there: what is done to a render once it is in the DOM (blocks,
        tabs, copy buttons) has somewhere to be done the moment one arrives.
      -->
      <w-scroll-area
        v-show="collabStore.hasSynced && !isEmpty"
        ref="scrollArea"
        class="page-container-scrl page-article-col"
        style="height: 100%">
        <!-- -> Centered whatever the theme's content width says: reading is all this view is for -->
        <div class="page-container-body is-centered p-2 sm:p-4">
          <div class="page-measure">
            <!--
              Delegated rather than bound per link: the anchors are written by `v-html`, and are
              replaced wholesale with every edit that arrives.
            -->
            <div
              ref="contentEl"
              class="page-contents"
              :lang="commonStore.locale"
              :dir="siteStore.localeDir(commonStore.locale)"
              v-html="liveNoteStore.render"
              @click="onContentClick" />
          </div>
        </div>
      </w-scroll-area>
    </div>
    <!-- -> The scrim behind the contents panel while it overlays the article, and how it is dismissed
            without picking a heading -->
    <transition name="page-sidebar-scrim">
      <div v-if="tocPanelIsOpen" class="page-sidebar-scrim" @click="closeTocPanel" />
    </transition>
    <!--
      The contents column, from the headings of the render as it stands -- `anchorHeadings`, which does
      what the server does to a page as it is saved. Below 750px it is a panel over the article
      instead, which is why it stays mounted at every width and `is-open` decides whether it is on
      screen.
    -->
    <div
      v-if="showToc"
      class="page-sidebar"
      :class="{ 'is-open': tocPanelIsOpen }"
      :style="tocIsLeft ? `order: 1;` : `order: 2;`"
      :lang="commonStore.locale"
      :dir="siteStore.localeDir(commonStore.locale)"
      @click="onSidebarClick">
      <div class="p-4 flex items-center">
        <w-icon class="me-2" name="la:stream" color="grey" />
        <div class="text-caption text-grey-7">{{ t('common.page.contents') }}</div>
      </div>
      <div class="px-4 pb-2">
        <page-toc
          :nodes="state.toc"
          :min-depth="TOC_DEPTH.min"
          :max-depth="TOC_DEPTH.max"
          :joined="tocJoinsArticleEdge"
          v-model:selected="state.tocSelected" />
      </div>
    </div>
    <!-- -> What opens that panel: the bottom-right corner, which nothing else on a note's screen uses -->
    <transition name="toc-open-btn">
      <div v-if="showTocPanelBtn" class="fixed bottom-0 right-0 z-30">
        <w-btn
          class="corner-btn corner-btn--right"
          icon="mdi:file-tree"
          color="primary"
          round
          size="md"
          :aria-label="t(`common.page.contents`)"
          :aria-expanded="tocPanelIsOpen"
          @click="openTocPanel" />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { throttle } from 'es-toolkit/function'

import { collabHandles } from '@/composables/collab'
import { useMinWidth } from '@/composables/screen'
import { scrollToAnchor, scrollToAnchorWhenReady } from '@/helpers/anchors'
import { withGlossary } from '@/helpers/glossaryUrl'
import { enhanceRenderedContent, resolveContentClick } from '@/helpers/renderedContent'
import { anchorHeadings, flattenToc } from '@/helpers/toc'
import { MarkdownRenderer } from '@/renderers/markdown'

import PageToc from '@/components/PageToc.vue'

import { useCollabStore } from '@/stores/collab'
import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useLiveNoteStore } from '@/stores/liveNote'
import { useSiteStore } from '@/stores/site'

/**
 * A live note's Reader view: the note rendered, and nothing to edit it with.
 *
 * Fed straight from the collaboration room's document rather than from an editor -- there is no
 * editor -- so it follows every edit as it arrives, whoever made it. The session is the note view's
 * (`pages/LiveNote.vue`), open before this mounts and left open after it goes, so switching to the
 * Editor and back is not a reconnect. Rendered here exactly as the editor's preview renders it, and
 * the source and render written to the live note store as the editor would write them, since the title
 * in the bar above, Download and Publish to Page all read them from there.
 *
 * Mounted for anybody who may read the note, and the only view a reader of a locked note gets.
 */

/**
 * How often an edit arriving is drawn, at most. Throttled rather than debounced, unlike the editor's
 * preview: somebody else typing without pause would otherwise leave the reader looking at nothing
 * changing until they stopped, and following along is the point of a live note.
 */
const RENDER_INTERVAL_MS = 300

// STORES

const collabStore = useCollabStore()
const commonStore = useCommonStore()
const editorStore = useEditorStore()
const liveNoteStore = useLiveNoteStore()
const siteStore = useSiteStore()

// ROUTER

const route = useRoute()
const router = useRouter()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  /** The contents tree of the render as it stands, in the shape a page's `toc` has. */
  toc: [],
  tocSelected: null,
  tocPanelOpen: false
})

const scrollArea = ref(null)
const contentEl = ref(null)

const md = new MarkdownRenderer(editorStore.editors.markdown ?? {})

/** The note's text, as the room shares it. Null only if the session is somehow not open. */
const ytext = collabHandles()?.ydoc.getText('content') ?? null

/**
 * The blocks this site has switched off, which are left undefined rather than loaded -- the same
 * choice the editor's preview makes, without its notice, which is addressed to an author.
 */
let disabledBlockTags = new Set()

/** Whether the URL's `#heading` has been gone to yet, which only the first render should do. */
let arrivedAtHash = false

/** Set as this view goes, for the mount hook to see once its `await` returns. */
let unmounted = false

// COMPUTED

/** Below 750px, where the contents stop being a column beside the article and become a panel over it. */
const isAtLeast750 = useMinWidth(750)
const tocIsPanel = computed(() => !isAtLeast750.value)

const tocIsLeft = computed(() => siteStore.theme.tocPosition === 'left')

/*
  The article's edge goes down whichever side faces the contents (`.page-article-col` in
  `_page-chrome.scss`), so it moves to the left with them -- while they are a column, a panel having a
  shadow rather than an edge.
*/
const tocColumnIsLeft = computed(() => showToc.value && !tocIsPanel.value && tocIsLeft.value)

/*
  Whether the contents rail turns out at each end to meet that edge, as on a page (`tocJoinsArticleEdge`
  in `pages/Index.vue`): only beside the article as a column, and only where the side the labels start
  from -- the rail's -- is the side facing it.
*/
const tocJoinsArticleEdge = computed(() => {
  if (tocIsPanel.value) {
    return false
  }
  const isRtl = siteStore.localeDir(commonStore.locale) === 'rtl'
  return tocIsLeft.value ? isRtl : !isRtl
})

/**
 * Which heading levels the contents list. A note has no depth settings of its own, and is fixed at
 * H1 to H3 rather than following a new page's default: a note is one document with no tree around it,
 * so its subsections are the only structure a reader has to find their way through.
 */
const TOC_DEPTH = Object.freeze({ min: 1, max: 3 })

/**
 * Whether there is a contents section to draw: the site's theme not turning contents off, and some
 * heading within the depth to list -- asked of the helper the list draws from, so the two agree.
 */
const showToc = computed(
  () =>
    collabStore.hasSynced &&
    siteStore.theme.tocPosition !== 'off' &&
    flattenToc(state.toc, { minDepth: TOC_DEPTH.min, maxDepth: TOC_DEPTH.max }).length > 0
)

const tocPanelIsOpen = computed(() => tocIsPanel.value && showToc.value && state.tocPanelOpen)
const showTocPanelBtn = computed(() => tocIsPanel.value && showToc.value && !state.tocPanelOpen)

const isEmpty = computed(() => !liveNoteStore.content.trim())

// METHODS

async function loadSiteBlocks() {
  try {
    const siteBlocks = (await API_CLIENT.get(`sites/${siteStore.id}/blocks`).json()) ?? []
    disabledBlockTags = new Set(
      siteBlocks.filter((block) => !block.isEnabled).map((block) => `block-${block.block}`)
    )
  } catch (err) {
    // -> Left empty, which draws every block: the same failure the editor's preview settles for
    console.warn(`Could not read which blocks this site has enabled: ${err.message}`)
  }
}

/**
 * The note as the room holds it, into the store and onto the screen.
 *
 * What survives the render being replaced is what the editor's preview keeps across one (see
 * `processContent` there): where the reader had scrolled to, and which panel of each tabset was open
 * -- carried by position, since the source order of the blocks is what survives an edit and the
 * elements do not. A reader who opened the third tab must not be thrown back to the first every time
 * somebody else types a word.
 */
function render() {
  const content = ytext.toString()
  liveNoteStore.content = content

  let html
  try {
    html = md.render(content, { pagePath: '' })
  } catch (err) {
    // -> The last render that worked stays up. Said nowhere else: the reader did not write it, and a
    //    notice per keystroke of somebody else's would be noise
    console.error(err)
    return
  }
  const template = document.createElement('template')
  template.innerHTML = html
  state.toc = anchorHeadings(template.content)

  const scroller = scrollArea.value?.$el
  const scrollTop = scroller?.scrollTop ?? 0
  const openTabs = [...(contentEl.value?.querySelectorAll('block-tabs') ?? [])].map(
    (el) => el.active ?? 0
  )

  liveNoteStore.setRender(template.innerHTML)

  nextTick(async () => {
    const container = contentEl.value
    if (!container) {
      return
    }
    const tabsets = [...container.querySelectorAll('block-tabs')]
    for (const [index, el] of tabsets.entries()) {
      if (openTabs[index]) {
        el.active = openTabs[index]
      }
    }
    // -> The panels settle first: restoring against a tabset still showing its first panel is
    //    restoring against a layout about to change by the height of a panel
    await Promise.all(tabsets.map((el) => el.updateComplete ?? Promise.resolve()))
    if (scroller) {
      scroller.scrollTop = scrollTop
    }
    const pendingTags = new Set()
    for (const block of container.querySelectorAll(':not(:defined)')) {
      const tag = block.tagName.toLowerCase()
      if (!disabledBlockTags.has(tag)) {
        pendingTags.add(tag)
      }
    }
    if (pendingTags.size > 0) {
      commonStore.loadBlocks([...pendingTags])
    }
    // -> The render was just replaced, so the copy buttons went with it
    enhanceRenderedContent(container)

    if (!arrivedAtHash && collabStore.hasSynced) {
      arrivedAtHash = true
      scrollToAnchorWhenReady(route.hash)
    }
  })
}

const renderSoon = throttle(render, RENDER_INTERVAL_MS)

/**
 * A revision put back from the revisions overlay, which asks whichever view is open to make the edit
 * (`restoreEditorContent`, the event the editor answers when it is the one open). With no editor, the
 * edit is made on the document itself -- one transaction, so that it reaches everyone in the room as
 * a single change.
 */
function restoreContent({ content }) {
  if (!ytext || !liveNoteStore.canWrite) {
    return
  }
  ytext.doc.transact(() => {
    ytext.delete(0, ytext.length)
    ytext.insert(0, content ?? '')
  })
}

function onContentClick(ev) {
  const intent = resolveContentClick(ev, window.location)
  if (!intent) {
    return
  }
  // -> As a page's are, in `pages/Index.vue`: a term over the note, a heading travelled to with the
  //    URL following, and a fragment naming nothing in the render left to the browser
  if (intent.kind === 'glossary') {
    ev.preventDefault()
    router.push({
      path: route.path,
      query: withGlossary(route.query, {
        name: intent.name,
        locale: intent.locale,
        pageLocale: commonStore.locale
      }),
      hash: route.hash
    })
    return
  }
  if (intent.kind === 'hash') {
    if (scrollToAnchor(intent.hash, { smooth: true })) {
      ev.preventDefault()
      router.push({ path: route.path, query: route.query, hash: intent.hash })
    }
    return
  }
  ev.preventDefault()
  router.push(intent.target)
}

/*
  Following a link out of the panel puts it away, since what the reader asked for is behind it. A
  `<button>` in here is not that, which is why the test is `closest('a')` rather than any click.
*/
function onSidebarClick(ev) {
  if (tocPanelIsOpen.value && ev.target?.closest?.('a')) {
    closeTocPanel()
  }
}

function openTocPanel() {
  state.tocPanelOpen = true
}

function closeTocPanel() {
  state.tocPanelOpen = false
}

// MOUNTED

onMounted(async () => {
  EVENT_BUS.on('restoreEditorContent', restoreContent)
  // -> Before the first render, as the editor does it: a block defined once is defined for the rest
  //    of the session, so a list arriving after that is too late to keep a switched-off one from drawing
  await loadSiteBlocks()
  if (unmounted || !ytext) {
    return
  }
  // -> Every change, whoever made it -- the room's first answer included, which arrives as one
  ytext.observe(renderSoon)
  render()
})

onBeforeUnmount(() => {
  unmounted = true
  EVENT_BUS.off('restoreEditorContent', restoreContent)
  ytext?.unobserve(renderSoon)
  renderSoon.cancel()
})
</script>
