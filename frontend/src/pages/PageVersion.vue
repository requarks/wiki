<template>
  <!--
    `h-full min-h-0`, as in the page view: the shell hands this a definite height and it has to CLAIM
    it, or the article column below cannot scroll on its own and the whole page scrolls in the shell.
  -->
  <w-page class="page-version flex flex-col h-full min-h-0">
    <!--
      Where the page view puts the breadcrumb trail. A snapshot has no trail to draw: the crumbs lead
      to where each folder is NOW, which is a walk out of the version and into the live wiki without
      saying so -- and the version's own path is already the title bar's business. What identifies this
      screen is the version, so the version is what the bar says.
    -->
    <div
      class="page-breadcrumbs page-breadcrumbs--version py-1 px-4 sm:py-2 flex flex-wrap"
      v-if="state.version">
      <div class="min-w-0 flex-1 flex items-center">
        <!-- -> No `color` on the icon and no grey on the date: the indigo bar states one foreground
                for everything in it, and `WIcon` paints with `currentColor`, so both inherit it -->
        <w-icon class="mr-2" name="la:history" size="sm" />
        <!-- -> `shrink-0`, so it is the ID that truncates on a narrow bar and never the words saying
                what the ID is -->
        <span class="text-caption shrink-0 mr-1">{{ t('history.viewingVersionId') }}</span>
        <!-- -> Monospaced and selectable: it is an identifier, and the reason to show one in full is
                so it can be read off and quoted -->
        <span class="text-caption font-robotomono select-all truncate">{{ state.version.id }}</span>
      </div>
      <!--
        Off on a phone, as the page view's date is: on a 390px screen it takes a whole line of its own
        under the identifier.
      -->
      <div class="flex-none items-center justify-end hidden sm:flex">
        <div class="text-caption">
          {{ t('history.snapshotFrom') }} <strong>{{ snapshotFrom }}</strong>
        </div>
      </div>
    </div>
    <page-version-header
      v-if="state.version"
      :icon="versionIcon"
      :title="state.version.title"
      :description="versionDescription"
      :live-path="livePath"
      @download="downloadVersion"
      @restore="restoreVersion"
      @branch="branchFrom" />
    <!-- -> `min-h-0` so the columns inside can be shorter than their content and scroll -->
    <div class="page-container flex min-h-0 flex-nowrap items-stretch" style="flex: 1 1 100%">
      <div
        class="min-w-0 flex-1"
        :style="siteStore.theme.tocPosition === `left` ? `order: 2;` : `order: 1;`">
        <!--
          The same placeholder column the page view uses for a page that is not there, and for the
          same reason: this is a state of the view rather than an error screen. Nothing here offers a
          way to fix it -- a version either exists and may be read, or it does not -- so the way out is
          the way they came.
        -->
        <div v-if="state.failed" class="page-placeholder">
          <w-icon class="page-placeholder-icon" name="la:history" />
          <div class="text-h6">{{ t('history.versionUnavailable') }}</div>
          <div class="text-body2 mt-1 opacity-60">{{ t('history.versionUnavailableHint') }}</div>
          <w-btn
            class="mt-6"
            outline
            icon="la:arrow-left"
            color="primary"
            padding="xs lg"
            :label="t(`common.newpage.goback`)"
            @click="goBack" />
        </div>
        <w-scroll-area class="page-container-scrl" v-else style="height: 100%">
          <!-- -> Half the padding on a phone, matching the page view; `--content-bleed` follows in
                  `_page-chrome.scss` -->
          <div class="page-container-body p-2 sm:p-4">
            <!--
              Delegated rather than bound per link: the anchors are written by `v-html`, so there is
              nothing here to put a handler on.
            -->
            <div
              class="page-contents"
              ref="pageContents"
              v-html="state.render"
              @click="onContentClick" />
          </div>
          <!-- -> Inside the scrolling column and last, so it is the bottom of the page rather than
                  something sitting over the article -->
          <w-footer>
            <footer-nav />
          </w-footer>
        </w-scroll-area>
      </div>
      <!-- -> The scrim behind the contents panel while it overlays the article, and how it is
              dismissed without picking a heading -->
      <transition name="page-sidebar-scrim">
        <div v-if="tocPanelIsOpen" class="page-sidebar-scrim" @click="closeTocPanel" />
      </transition>
      <!--
        The contents column, drawn from the `toc` the version recorded -- see `models/pageHistory.ts`,
        where `toc` is kept in a version's `meta` for exactly this. Below 750px it stops being a column
        and slides in over the article instead, which is why it stays mounted at every width and
        `is-open` is what decides whether it is on screen.

        Contents and nothing else. The page view's tags and rating are beside them there because both
        are things to DO to the page in front of the reader, and neither is a thing to do to a record
        of what it once said -- editing tags writes the live page, and a rating is about the page as it
        stands.
      -->
      <div
        class="page-sidebar"
        v-if="showToc"
        :class="{ 'is-open': tocPanelIsOpen }"
        :style="siteStore.theme.tocPosition === `left` ? `order: 1;` : `order: 2;`"
        @click="onSidebarClick">
        <div class="p-4 flex items-center">
          <w-icon class="mr-2" name="la:stream" color="grey" />
          <div class="text-caption text-grey-7">{{ t('common.page.contents') }}</div>
        </div>
        <div class="px-4 pb-2">
          <page-toc
            :nodes="versionToc"
            :min-depth="tocDepth.min"
            :max-depth="tocDepth.max"
            v-model:selected="state.tocSelected" />
        </div>
      </div>
    </div>
    <!--
      What opens that panel, in the bottom-right corner -- the corner `VersionLayout` gives to
      scroll-to-top, which stands down below 750px so that this can have it. Same position and the same
      `.corner-btn` shape, so the two read as one button that changes what it does.
    -->
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
  </w-page>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { useMinWidth } from '@/composables/screen'
import { confirm, dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { apiErrorMessage } from '@/helpers/apiError'
import { scrollToAnchor } from '@/helpers/anchors'
import { enhanceRenderedContent, resolveContentClick } from '@/helpers/renderedContent'
import { renderVersionSource, saveVersionSource, versionPageProps } from '@/helpers/pageVersions'
import { flattenToc } from '@/helpers/toc'

import { useEditorStore } from '@/stores/editor'
import { useSiteStore } from '@/stores/site'

import FooterNav from '@/components/FooterNav.vue'
import PageToc from '@/components/PageToc.vue'
import PageVersionHeader from '@/components/PageVersionHeader.vue'

// STORES

const editorStore = useEditorStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  /** The version as the API answered it, or null while it is on its way — and after it fails. */
  version: null,
  /** The version's source, rendered here. See `renderFor`. */
  render: '',
  /**
   * Whether the version could not be loaded — gone, never there, or not this reader's to see. One flag
   * for all three: the API deliberately does not tell them apart (a version on a page you cannot read
   * is indistinguishable from one that does not exist), so neither can this.
   */
  failed: false,
  tocSelected: null,
  /** Whether the contents panel has been slid open. Only consulted below 750px. */
  tocPanelOpen: false
})

const pageContents = ref(null)

// META

/*
  A getter, for the same reason as the page view's: the title is not known when this runs -- the view
  mounts for the version ID and the snapshot arrives a moment later.

  Below `state` and not above it, which is not a matter of taste: `useMeta` runs the getter straight
  away, so declared first it read `state` from inside its temporal dead zone and the whole view failed
  to mount with "Cannot access 'state' before initialization".
*/
useMeta(() => ({
  title: state.version?.title ?? ''
}))

// COMPUTED

/** Below 750px, where the contents stop being a column beside the article and become a panel over it. */
const isAtLeast750 = useMinWidth(750)
const tocIsPanel = computed(() => !isAtLeast750.value)

const tocPanelIsOpen = computed(() => tocIsPanel.value && showToc.value && state.tocPanelOpen)

const showTocPanelBtn = computed(() => tocIsPanel.value && showToc.value && !state.tocPanelOpen)

/**
 * The page's own fields as the version recorded them.
 *
 * Everything but the path, the title and the date lives in `meta` — those four have columns of their
 * own on `pageHistory`. Read off the VERSION rather than off the live page throughout: the point of
 * this screen is what the page said then, and its icon and description are part of that.
 */
const versionIcon = computed(() => state.version?.meta?.icon || 'la:file-alt')
const versionDescription = computed(() => state.version?.meta?.description ?? '')
const versionToc = computed(() => state.version?.meta?.toc ?? [])
const tocDepth = computed(() => state.version?.meta?.config?.tocDepth ?? { min: 1, max: 2 })

/**
 * Where the live page is, for the View Live button.
 *
 * Built from `pagePath` / `pageLocale` — the page as it stands — and NOT from `version.path`, which is
 * where the page was when this snapshot was written: a page that has since moved would send the reader
 * to a path that no longer holds anything.
 *
 * Prefixed the way every other in-app link to a page is, so a site that brackets its URLs by locale
 * lands on the right one rather than being redirected to the primary locale's copy.
 */
const livePath = computed(() => {
  const path = state.version?.pagePath
  if (!path) {
    return ''
  }
  return `${siteStore.localeUrlPrefix(state.version.pageLocale)}/${path}`
})

/*
  Whether there is a contents section to draw, rather than whether the page asked for one: a version
  with no headings, or whose depth settings leave nothing to list, would otherwise show "Contents" over
  an empty space. Asked of the same helper the list itself draws from, so the two cannot disagree.

  `showToc` on the version is the page's own setting as it stood, and the site's `tocPosition` is the
  live one — there being no historical copy of a site's theme to consult.
*/
const showToc = computed(() => {
  if (!state.version || siteStore.theme.tocPosition === 'off') {
    return false
  }
  if (state.version.meta?.config?.showToc === false) {
    return false
  }
  return (
    flattenToc(versionToc.value, {
      minDepth: tocDepth.value.min,
      maxDepth: tocDepth.value.max
    }).length > 0
  )
})

/**
 * When the snapshot was taken — what stands where the page view says "Last modified on".
 *
 * The same fields that view formats, so the two bars read alike.
 */
const snapshotFrom = computed(() => {
  return state.version?.versionDate
    ? Temporal.Instant.from(state.version.versionDate).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'N/A'
})

// WATCHERS

/*
  The copy buttons on code blocks are part of the content, so they are re-added whenever the content
  is. Keyed on the render rather than on the route, since it arrives after this has already mounted.
*/
watch(
  () => state.render,
  () => {
    nextTick(() => enhanceRenderedContent(pageContents.value))
  },
  { immediate: true }
)

/*
  The version in the URL is what this view is OF, so it is what drives the load — immediately, since
  arriving here IS the request. The router reuses this component when only the parameter changes,
  which is what walking from one version to another would do.
*/
watch(() => route.params.versionId, loadVersion, { immediate: true })

// METHODS

async function loadVersion(versionId) {
  if (!versionId) {
    state.failed = true
    return
  }
  loading.show()
  try {
    const version = await API_CLIENT.get(`sites/${siteStore.id}/versions/${versionId}`).json()
    if (!version?.id) {
      throw new Error('ERR_VERSION_NOT_FOUND')
    }
    state.render = await renderFor(version, version.path)
    state.version = version
    state.failed = false
    state.tocPanelOpen = false
  } catch (err) {
    state.version = null
    state.render = ''
    state.failed = true
    notify({
      type: 'negative',
      message: apiErrorMessage(err, t('history.versionLoadFailed'))
    })
  } finally {
    loading.hide()
  }
}

/**
 * The HTML for a version's source.
 *
 * @param version The version to render.
 * @param pagePath The page the HTML is FOR, which is what a relative image in it resolves against.
 *   Reading a snapshot, that is the path the version was written at -- it is the page as it was, so
 *   its links should resolve as they did. Restoring or branching, it is where the content is GOING,
 *   because that is the page the reader will follow those links from.
 */
async function renderFor(version, pagePath) {
  // -> The renderer is configured per site (line breaks, typographer, …), and that configuration
  //    arrives with the editor configs rather than on its own
  if (!editorStore.configIsLoaded) {
    await editorStore.fetchConfigs()
  }
  return renderVersionSource(version, {
    markdownConfig: editorStore.editors.markdown,
    pagePath
  })
}

/**
 * Save this version's source, the same as the history overlay's Download.
 *
 * No fetch first, unlike there: the overlay downloads from a timeline that carries no source, while
 * this screen already has the whole version in hand -- it is what is being read.
 */
async function downloadVersion() {
  if (!state.version) {
    return
  }
  try {
    await saveVersionSource(state.version)
  } catch (err) {
    notify({ type: 'negative', message: t('history.downloadFailed'), caption: err.message })
  }
}

/**
 * Put this version's source back on the page, as the history overlay's Restore does.
 *
 * The source only: the page keeps the title, tags and settings it has now. Restoring those too would
 * quietly undo everything done since, and a reader asking for an old version back is asking for the
 * text. Nothing is lost either way -- this is an ordinary edit, so it becomes a version of its own
 * with the current state recorded in it.
 */
function restoreVersion() {
  const version = state.version
  if (!version) {
    return
  }
  confirm({
    title: t('history.restore'),
    message: [
      t('history.restoreConfirm', { date: snapshotFrom.value }),
      t('history.restoreConfirmHint')
    ],
    caption: t('history.versionId', { id: version.id }),
    cancel: true,
    color: 'negative',
    okLabel: t('history.restore')
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await API_CLIENT.patch(`sites/${siteStore.id}/pages/${version.pageId}`, {
        json: {
          content: version.content ?? '',
          // -> For where the content is going, which is the page's path NOW and not the version's
          render: await renderFor(version, version.pagePath),
          reasonForChange: t('history.restoreReason', { date: snapshotFrom.value })
        }
      }).json()
      if (!resp?.page?.id) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({ type: 'positive', message: t('history.restoreSuccess') })
      /*
        On to the live page, which is where the restore actually happened. The overlay reloads the
        page behind itself for the same reason; here there is nothing behind, and a snapshot does not
        change -- staying put would leave the reader on a screen that looks exactly as it did and
        gives no sign anything had happened.
      */
      router.push(livePath.value)
    } catch (err) {
      notify({
        type: 'negative',
        message: t('history.restoreFailed'),
        caption: apiErrorMessage(err)
      })
    } finally {
      loading.hide()
    }
  })
}

/**
 * Start a new page from this version, leaving the live one alone.
 *
 * What to do with an old version that is worth keeping but not worth reverting to. The same path
 * picker as duplicating a page, because that is what this is -- a duplicate of a page as it was.
 */
function branchFrom() {
  const version = state.version
  if (!version) {
    return
  }
  dialog({
    component: defineAsyncComponent(() => import('@/components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'duplicatePage',
      folderPath: '',
      itemId: version.pageId,
      itemTitle: version.title,
      itemFileName: version.pagePath,
      locale: version.pageLocale
    }
  }).onOk(async (target) => {
    loading.show()
    try {
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/pages`, {
        json: {
          // -> Everything the page was, as far as a new page may be given it; see `versionPageProps`
          ...versionPageProps(version),
          path: target.path,
          title: target.title,
          locale: version.pageLocale,
          editor: version.meta?.editor || 'markdown',
          content: version.content ?? '',
          // -> Rendered for where it is going, not for where the version came from
          render: await renderFor(version, target.path),
          reasonForChange: t('history.branchReason', { date: snapshotFrom.value })
        }
      }).json()
      const page = resp?.page
      if (!page?.id) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({ type: 'positive', message: t('history.branchSuccess') })
      // -> This page went up with the version's tags, so a tag no page carried any more is back; the
      //    tag fields have to hear about it, the same as after a save
      siteStore.staleTags()
      router.push(`/${page.path}`)
    } catch (err) {
      notify({
        type: 'negative',
        message: t('history.branchFailed'),
        caption: apiErrorMessage(err)
      })
    } finally {
      loading.hide()
    }
  })
}

function onContentClick(ev) {
  const intent = resolveContentClick(ev, window.location)
  if (!intent) {
    return
  }
  // -> A heading in the snapshot: travelled to rather than jumped at, as everywhere else in the app.
  //    The URL follows so the section can be linked to, and Back returns to the one before.
  if (intent.kind === 'hash') {
    if (scrollToAnchor(intent.hash, { smooth: true })) {
      ev.preventDefault()
      router.push({ path: route.path, query: route.query, hash: intent.hash })
    }
    return
  }
  /*
    Anything else goes to the LIVE wiki, and deliberately so: a link in a snapshot was written to point
    at a page, not at that page as it stood on the same day, and there is no version of the target to
    send the reader to even if it had been.
  */
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

function goBack() {
  router.back()
}
</script>
