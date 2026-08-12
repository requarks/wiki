<template>
  <!--
    `h-full min-h-0`: the shell hands this page a definite height, and the page has to CLAIM it for
    the article column below to scroll on its own. Left to grow, the whole page would scroll inside
    the shell instead and take the sidebars with it.
  -->
  <w-page class="flex flex-col h-full min-h-0">
    <!--
      Both bars are about a page: where it sits and when it was last written to. A path with no page
      has neither to report -- the trail would end on a crumb that leads nowhere and the bar would read
      "Last modified on N/A" -- so the missing-page screen below is the whole column.
    -->
    <!-- -> `py-1` on a phone: with the date gone the bar holds one line of small type, and 8px above and
            below it made a strip nearly as tall as the crumbs themselves -->
    <div
      class="page-breadcrumbs py-1 px-4 sm:py-2 flex flex-wrap"
      v-if="!editorStore.isActive && !pageStore.notFound">
      <div class="min-w-0 flex-1">
        <w-breadcrumbs
          :items="breadcrumbs"
          :active-color="dark.isActive ? `grey-5` : `grey-7`"
          separator-color="grey">
          <template #separator><w-icon name="la:angle-right" /></template>
        </w-breadcrumbs>
      </div>
      <!--
        Off on a phone: on a 390px screen the date takes a whole line of its own under the trail, which
        is a lot of room for something a reader is not here for -- and the trail itself is how they get
        back out, so that is what the bar keeps.
      -->
      <div class="flex-none items-center justify-end hidden sm:flex">
        <template v-if="!pageStore.publishState === `draft`">
          <div class="text-caption text-accent"><strong>Unpublished</strong></div>
          <w-separator class="mx-2" vertical />
        </template>
        <div class="text-caption text-grey-6">
          Last modified on <strong>{{ lastModified }}</strong>
        </div>
      </div>
    </div>
    <page-header v-if="!pageStore.notFound" />
    <!-- -> `min-h-0` so the columns inside can be shorter than their content and scroll -->
    <div class="page-container flex min-h-0 flex-nowrap items-stretch" style="flex: 1 1 100%">
      <div
        class="min-w-0 flex-1"
        :style="siteStore.theme.tocPosition === `left` ? `order: 2;` : `order: 1;`">
        <component :is="editorComponents[editorStore.editor]" v-if="editorStore.isActive" />
        <!--
          The lock screen, in place of the article. There is nothing to hide here: the server sent no
          body at all, so this is the whole of what arrived for a protected page.
        -->
        <div v-else-if="pageStore.isLocked" class="page-placeholder">
          <w-icon class="page-placeholder-icon" name="la:lock" />
          <div class="text-h6">{{ t('common.page.locked') }}</div>
          <div class="text-body2 mt-1 opacity-60">{{ t('common.page.lockedHint') }}</div>
          <w-btn
            class="mt-6"
            unelevated
            icon="la:lock-open"
            color="primary"
            padding="xs lg"
            :label="t(`common.page.unlock`)"
            @click="promptUnlock" />
        </div>
        <!--
          The same column for a path with no page behind it, which is a state of this view rather than
          an error screen: the reader is still inside the wiki, at a URL that could hold a page, and
          for anyone who may write one the answer to "this page does not exist" is the button that
          creates it -- at this path, so that the link they followed leads somewhere afterwards.
        -->
        <div v-else-if="pageStore.notFound" class="page-placeholder">
          <w-icon class="page-placeholder-icon" name="la:file-alt" />
          <!-- -> "...yet" is an invitation, so it is for whoever can take it up; to a reader who
               cannot write here the page simply does not exist -->
          <div class="text-h6">
            {{ canCreatePage ? t('common.newpage.title') : t('common.notfound.subtitle') }}
          </div>
          <div class="text-body2 mt-1 opacity-60" v-if="canCreatePage">
            {{ t('common.newpage.subtitle') }}
          </div>
          <!--
            The path itself, because the sentence above is about a page the reader cannot see and this
            is the one thing that says WHICH page: the link they followed, and what the button is about
            to create.
          -->
          <div class="text-caption font-robotomono mt-3 opacity-50">/{{ pageStore.path }}</div>
          <w-btn
            class="mt-6"
            v-if="canCreatePage"
            unelevated
            icon="la:plus"
            color="primary"
            padding="xs lg"
            :label="t(`common.newpage.create`)"
            @click="createPage" />
          <!-- -> Nothing to create for this reader, so the way out is the way they came -->
          <w-btn
            class="mt-6"
            v-else
            outline
            icon="la:arrow-left"
            color="primary"
            padding="xs lg"
            :label="t(`common.newpage.goback`)"
            @click="goBack" />
        </div>
        <!--
          A redirection, which is a page with nowhere to read: it takes the reader on rather than
          showing them anything. Ahead of the article because there is no article -- see
          `PageRedirect.vue` -- and behind the two screens above because a page that is locked, or
          that is not there at all, has no target to have been given yet.
        -->
        <page-redirect v-else-if="pageStore.editor === `redirect`" />
        <w-scroll-area class="page-container-scrl" ref="pageScroller" v-else style="height: 100%">
          <!-- -> Half the padding on a phone, where 16px a side is 8% of the window spent on margin;
                  the stylesheet has `--content-bleed` to match -->
          <div class="page-container-body p-2 sm:p-4">
            <!--
              Delegated rather than bound per link: the anchors are written by `v-html`, so there is
              nothing here to put a handler on, and they are replaced wholesale on every render.
            -->
            <div
              class="page-contents"
              ref="pageContents"
              v-html="pageStore.render"
              @click="onContentClick" />
            <template v-if="pageStore.relations && pageStore.relations.length > 0">
              <w-separator class="my-6" />
              <div class="flex flex-wrap">
                <div class="min-w-0 flex-1 text-left" v-if="relationsLeft.length > 0">
                  <w-btn
                    class="mr-2 mb-2"
                    padding="sm md"
                    outline
                    no-caps
                    color="primary"
                    v-for="rel of relationsLeft"
                    :key="`rel-id-` + rel.id"
                    v-bind="relationLink(rel)">
                    <w-icon :name="rel.icon" />
                    <div class="flex flex-col text-left pl-4">
                      <div class="text-body2">
                        <strong>{{ rel.label }}</strong>
                      </div>
                      <div class="text-caption">{{ rel.caption }}</div>
                    </div>
                  </w-btn>
                </div>
                <div class="min-w-0 flex-1 text-center" v-if="relationsCenter.length > 0">
                  <div class="flex flex-col">
                    <w-btn
                      color="primary"
                      flat
                      no-caps
                      v-for="rel of relationsCenter"
                      :key="`rel-id-` + rel.id"
                      v-bind="relationLink(rel)">
                      <w-icon class="mr-2" :name="rel.icon" />
                      <span>{{ rel.label }}</span>
                    </w-btn>
                  </div>
                </div>
                <div class="min-w-0 flex-1 text-right" v-if="relationsRight.length > 0">
                  <w-btn
                    class="ml-2 mb-2"
                    padding="sm md"
                    outline
                    no-caps
                    color="primary"
                    v-for="rel of relationsRight"
                    :key="`rel-id-` + rel.id"
                    v-bind="relationLink(rel)">
                    <div class="flex flex-col text-left pr-4">
                      <div class="text-body2">
                        <strong>{{ rel.label }}</strong>
                      </div>
                      <div class="text-caption">{{ rel.caption }}</div>
                    </div>
                    <w-icon :name="rel.icon" />
                  </w-btn>
                </div>
              </div>
            </template>
          </div>
          <!--
            Inside the scrolling column, and last: this is the bottom of the PAGE, so it is reached by
            reading to the end of it rather than sitting over the article the whole way down.

            The editor replaces this column wholesale, which is how it goes without a footer, and the
            lock screen likewise -- a page that sent no body has no end to arrive at.
          -->
          <w-footer>
            <footer-nav />
          </w-footer>
        </w-scroll-area>
      </div>
      <!--
        The scrim behind the contents panel while it is overlaying the article, which is also how it is
        dismissed without picking a heading. Same treatment as the nav drawer's: see `WDrawer`.
      -->
      <transition name="page-sidebar-scrim">
        <div v-if="tocPanelIsOpen" class="page-sidebar-scrim" @click="closeTocPanel" />
      </transition>
      <!--
        The contents column. Below 750px it stops being a column and becomes a panel that slides in from
        the right over the article -- see the stylesheet -- so it stays mounted at every width and it is
        `is-open` that decides whether it is on screen.

        The click handler closes it on the way out: any anchor inside it is something that takes the reader
        somewhere (a heading, a tag), and a panel left over the place they were going would have to be
        dismissed by hand. A `<button>` in here -- the tag editor's, the rating -- is not that, which is
        why the test is `closest('a')` rather than any click at all.
      -->
      <div
        class="page-sidebar"
        v-if="showSidebar"
        :class="{ 'is-open': tocPanelIsOpen }"
        :style="siteStore.theme.tocPosition === `left` ? `order: 1;` : `order: 2;`"
        @click="onSidebarClick">
        <template v-if="showToc">
          <!-- TOC -->
          <div class="p-4 flex items-center">
            <w-icon class="mr-2" name="la:stream" color="grey" />
            <!-- -> Its own string, not `common.page.toc`: this heading labels a column beside the
                 article and reads better short, where "Table of Contents" is the full name of the
                 thing and belongs where there is room for it -->
            <div class="text-caption text-grey-7">{{ t('common.page.contents') }}</div>
          </div>
          <div class="px-4 pb-2">
            <page-toc
              :nodes="pageStore.toc"
              :min-depth="pageStore.tocDepth.min"
              :max-depth="pageStore.tocDepth.max"
              v-model:selected="state.tocSelected" />
          </div>
        </template>
        <!-- Tags -->
        <template v-if="showTags">
          <w-separator v-if="showToc" />
          <div
            class="p-4"
            @mouseover="state.showTagsEditBtn = true"
            @mouseleave="state.showTagsEditBtn = false">
            <div class="flex items-center">
              <w-icon class="mr-2" name="la:tags" color="grey" />
              <div class="text-caption text-grey-7">{{ t('common.page.tags') }}</div>
              <w-space />
              <!--
                Rendered for whoever may save the page, and hidden with `visibility` rather than
                removed as the pointer comes and goes: `display: none` took the row's height with it,
                so the heading jumped 6px the moment the pointer arrived. `visibility` also keeps it
                out of the tab order and out of hit-testing while hidden, which `opacity: 0` on its own
                would not.

                It stays put while editing, because that is when it is the way back out.

                A reader gets no button at all -- `v-if`, not the same `visibility` treatment, because
                for them it is not a control that happens to be out of sight.
              -->
              <w-btn
                v-if="canEditPage"
                class="tags-edit-btn"
                :class="{ 'is-hidden': !state.tagEditMode && !state.showTagsEditBtn }"
                size="sm"
                padding="none xs"
                :icon="state.tagEditMode ? `la:check` : `la:pen`"
                color="deep-orange-9"
                flat
                :label="state.tagEditMode ? t('common.actions.exitEdit') : t('common.actions.edit')"
                no-caps
                @click="state.tagEditMode = !state.tagEditMode" />
            </div>
            <page-tags class="mt-2" :edit="state.tagEditMode" />
          </div>
        </template>
        <template v-if="siteStore.features.ratingsMode !== `off` && pageStore.allowRatings">
          <w-separator v-if="showToc || showTags" />
          <!-- Rating -->
          <div class="p-4 flex items-center">
            <w-icon class="mr-2" name="la:star-half-alt" color="grey" />
            <div class="text-caption text-grey-7">{{ t('common.page.ratePage') }}</div>
          </div>
          <div class="px-4">
            <w-rating
              v-if="siteStore.features.ratingsMode === `stars`"
              v-model="state.currentRating"
              icon="la:star"
              color="secondary"
              size="sm" />
            <div class="flex items-center" v-else-if="siteStore.features.ratingsMode === `thumbs`">
              <w-btn class="acrylic-btn" flat icon="la:thumbs-down" color="secondary" />
              <w-btn class="acrylic-btn ml-2" flat icon="la:thumbs-up" color="secondary" />
            </div>
          </div>
        </template>
      </div>
      <!-- -> Every action on it acts on a page: there is none here to edit, share, rate or delete -->
      <page-actions-col v-if="!pageStore.notFound" />
    </div>
    <!--
      What opens that panel, in the bottom-right corner -- the corner `MainLayout` gives to scroll-to-top,
      which stands down below 750px so that this can have it. Same position and the same `.corner-btn`
      shape (declared in `MainLayout`, which is always mounted above this view), so the two read as one
      button that changes what it does rather than as two buttons fighting for a corner.

      Not gated on having scrolled, as scroll-to-top is: the contents are how a reader decides where to go
      in a long page, and that is most useful before they have gone anywhere.
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
    <side-dialog />
  </w-page>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { dialog } from '@/composables/dialog'
import { useMeta } from '@/composables/meta'
import { useMinWidth } from '@/composables/screen'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { scrollToAnchor, scrollToAnchorWhenReady } from '@/helpers/anchors'
import { enhanceRenderedContent, routableHref, sameDocumentHash } from '@/helpers/renderedContent'
import { flattenToc } from '@/helpers/toc'

import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import FooterNav from '@/components/FooterNav.vue'
import LoadingGeneric from '@/components/LoadingGeneric.vue'
import PageActionsCol from '@/components/PageActionsCol.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageRedirect from '@/components/PageRedirect.vue'
import PageTags from '@/components/PageTags.vue'
import PageToc from '@/components/PageToc.vue'
import PageUnlockDialog from '@/components/PageUnlockDialog.vue'
import SideDialog from '@/components/SideDialog.vue'

const editorComponents = {
  markdown: defineAsyncComponent({
    loader: () => import('../components/EditorMarkdown.vue'),
    loadingComponent: LoadingGeneric
  }),
  redirect: defineAsyncComponent({
    loader: () => import('../components/EditorRedirect.vue'),
    loadingComponent: LoadingGeneric
  })
  // wysiwyg: defineAsyncComponent({
  //   loader: () => import('../components/EditorWysiwyg.vue'),
  //   loadingComponent: LoadingGeneric
  // })
}

// STORES

const commonStore = useCommonStore()
const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// COMPOSABLES

const dark = useDark()

// META

/*
  A getter, not a plain object: the page's title is not known when this runs. The view is mounted for
  the path, and the title arrives with the page a moment later -- read once, it was always the empty
  string, so the tab showed nothing but the site name the template appends. It has to keep up with
  every navigation after that too, since the view is reused rather than remounted.
*/
useMeta(() => ({
  title: pageStore.title
}))

// DATA

const state = reactive({
  showSideDialog: false,
  sideDialogComponent: null,
  showGlobalDialog: false,
  globalDialogComponent: null,
  showTagsEditBtn: false,
  tagEditMode: false,
  tocSelected: null,
  /**
   * Whether the contents panel has been slid open. Only consulted below 750px, where the contents are a
   * panel over the article rather than a column beside it.
   */
  tocPanelOpen: false,
  currentRating: 3
})
const pageContents = ref(null)
/** The article column, which is what scrolls -- see `scrollPageToTop`. */
const pageScroller = ref(null)

// COMPUTED

/**
 * Below 750px, where the contents stop being a column beside the article and become a panel over it.
 *
 * This view's own threshold: at 200px (see `$toc-narrow-max`) the column still costs a third of a 600px
 * window, and an article is what the reader came for. `MainLayout` has to agree with it — that is where
 * scroll-to-top gives up this corner — and so does `$toc-overlay-max` in the stylesheet below.
 */
const isAtLeast750 = useMinWidth(750)
const tocIsPanel = computed(() => !isAtLeast750.value)

/** Whether the contents panel is on screen. Never true while the contents are a column. */
const tocPanelIsOpen = computed(() => tocIsPanel.value && showSidebar.value && state.tocPanelOpen)

/*
  The opener: only where the contents are a panel, only on a page that has one to show, and not while it is
  already open -- the scrim is what closes it then, and the button would be behind the panel in any case.
*/
const showTocPanelBtn = computed(() => tocIsPanel.value && showSidebar.value && !state.tocPanelOpen)

const showSidebar = computed(() => {
  return (
    pageStore.showSidebar &&
    siteStore.showSidebar &&
    siteStore.theme.tocPosition !== 'off' &&
    !editorStore.isActive &&
    // -> Contents, tags and a rating, all of a page that is not there
    !pageStore.notFound &&
    // -> Nor of one nobody stays on: a redirection has no headings to list and is gone in a moment
    pageStore.editor !== 'redirect'
  )
})
/*
  Whether there is a contents SECTION, heading and separator included -- not just whether the page
  asked for one. A page with no headings, or whose depth settings leave nothing to list, would
  otherwise show "Contents" over an empty space. Asked of the same helper the list itself draws from,
  so the two can never disagree about whether a row survives.
*/
const showToc = computed(() => {
  if (!pageStore.showToc) {
    return false
  }
  return (
    flattenToc(pageStore.toc, {
      minDepth: pageStore.tocDepth.min,
      maxDepth: pageStore.tocDepth.max
    }).length > 0
  )
})
/*
  Same question for the tags, and for the same reason: `showTags` is what the page ASKED for, and on a
  page carrying none that left a "Tags" heading over an empty space.

  Held open while the tag editor is in use, so that removing the last tag does not take the field being
  typed into away with it. That only arises mid-edit -- with no tags to start from there is no edit
  button to reach the mode through.
*/
const showTags = computed(() => {
  return pageStore.showTags && (pageStore.tags?.length > 0 || state.tagEditMode)
})
/*
  Whether this user may save a change to the page, which is what editing the tags amounts to -- the tags
  go up with the rest of the page rather than through an endpoint of their own. So the test is the pair
  the PATCH route accepts: `write:pages` or `manage:pages`.

  Read off `pagePermissions` rather than through `userStore.can()`, which asks a broader question: the
  group-wide list from `whoami` says what a user may do somewhere, and the rules decide where. What
  they may do HERE is what `pages/userPermissions` answers, and it is the same authority the PATCH
  route itself consults.
*/
const canEditPage = computed(() =>
  ['write:pages', 'manage:pages'].some((permission) =>
    userStore.pagePermissions.includes(permission)
  )
)

/*
  Whether the missing-page screen offers to create the page. `write:pages` at THIS path, from the same
  list as the tag button above: page rules are written against paths, not against pages, so they answer
  for one that does not exist yet — and it is the check the create endpoint itself makes. The group-wide
  list would say "may write pages somewhere", which is how a button ends up leading to a 403.

  The editor is part of the answer: creating a page opens one, and markdown is the only editor this
  view can mount. A site with it switched off has nothing to open, so the screen says the page is
  missing and leaves it at that.
*/
const canCreatePage = computed(
  () => userStore.pagePermissions.includes('write:pages') && siteStore.editors.markdown
)

const relationsLeft = computed(() => {
  return pageStore.relations ? pageStore.relations.filter((r) => r.position === 'left') : []
})
const relationsCenter = computed(() => {
  return pageStore.relations ? pageStore.relations.filter((r) => r.position === 'center') : []
})
const relationsRight = computed(() => {
  return pageStore.relations ? pageStore.relations.filter((r) => r.position === 'right') : []
})
const lastModified = computed(() => {
  return pageStore.updatedAt
    ? // -> The fields luxon's DATETIME_MED expanded to, so the bar reads exactly as before
      Temporal.Instant.from(pageStore.updatedAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'N/A'
})

/**
 * The trail the breadcrumb bar draws, root first. The Home crumb is prepended here rather than
 * written into the markup, so the bar takes a single flat list.
 */
const breadcrumbs = computed(() => [
  { key: 'home', icon: 'la:home', to: '/', ariaLabel: 'Home', tooltip: 'Home' },
  ...pageStore.breadcrumbs.map((brd) => ({
    key: brd.id,
    icon: brd.icon,
    label: brd.title,
    ariaLabel: brd.title,
    to: brd.path
  }))
])

// WATCHERS

/*
  The copy buttons on code blocks are part of the content, so they are re-added whenever the content
  is. Keyed on the render rather than on the route: it arrives after the page has already mounted, and
  it is replaced again on every save without the route moving at all.
*/
watch(
  () => pageStore.render,
  () => {
    nextTick(() => enhanceRenderedContent(pageContents.value))
  },
  { immediate: true }
)

/*
  A protected page asks for its password the moment it arrives: the reader followed a link to read it,
  and making them press a button first would only add a step. Keyed on the page rather than on the
  flag, so dismissing the prompt does not immediately reopen it -- the lock screen's own button is the
  way back in -- while walking to another protected page prompts again.

  Deliberately NOT `immediate`. This component is unmounted and remounted around any route outside the
  page view (a search, the profile, the admin area), and the store it reads is global: an immediate run
  fires against whatever page was on screen BEFORE that detour, so leaving a locked page for the search
  screen and coming back to an unprotected one prompted for the earlier page's password. Every real
  case still fires here, because `pageLoad` clears the flag as it starts and the reply sets it again --
  so a locked page always arrives as a change, mount or no mount.
*/
watch(
  () => (pageStore.isLocked ? pageStore.id : null),
  (lockedPageId) => {
    if (lockedPageId) {
      promptUnlock()
    }
  }
)

/*
  A fragment that changes without the page doing so: a link inside the content, or the reader going
  back to one. The browser tries it natively and gets nowhere when the heading is inside a panel that
  is not open, so the same routine runs here — where the heading is revealed first.
*/
onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHashChange)
})

function onHashChange() {
  scrollToAnchorWhenReady(window.location.hash)
}

watch(
  () => route.path,
  async (newValue) => {
    // -> Ignore route change (e.g. from page create route fix)
    if (editorStore.ignoreRouteChange) {
      editorStore.$patch({ ignoreRouteChange: false })
      return
    }

    // -> Enter Create Mode?
    if (newValue.startsWith('/_create')) {
      if (!route.params.editor) {
        notify({
          type: 'negative',
          message: 'No editor specified!'
        })
        return router.replace('/')
      }
      loading.show()
      const pageCreateArgs = { editor: route.params.editor, fromNavigate: true }
      if (route.query.path) {
        pageCreateArgs.path = route.query.path
      }
      if (route.query.locale) {
        pageCreateArgs.locale = route.query.locale
      }
      await pageStore.pageCreate(pageCreateArgs)
      loading.hide()
      return
    }

    // -> Enter Edit Mode?
    if (newValue.startsWith('/_edit')) {
      if (!route.params.pagePath) {
        return router.replace('/')
      }
      loading.show()
      await pageStore.pageEdit({ path: route.params.pagePath, fromNavigate: true })
      loading.hide()
      return
    }

    // -> Moving to a non-page path? Ignore
    if (newValue.startsWith('/_')) {
      return
    }

    // -> Load Page. The contents panel belongs to the page being left, so it goes with it
    state.tocPanelOpen = false
    scrollPageToTop()
    try {
      await pageStore.pageLoad({ path: newValue })
      if (editorStore.isActive) {
        /*
          Walking away from the editor closes it, and `mode` describes the editor that was open — so
          it has to go back with it. Left on `create`, it goes on claiming a page is being written
          long after the reader has moved on to reading one, and everything that asks gets the wrong
          answer: `pageSave` POSTs a new page instead of patching the one on screen, the header
          offers Create Page where Save Changes belongs, and Discard throws away a property edit as
          though it were an abandoned draft — putting the welcome screen over a wiki that has a home
          page.
        */
        editorStore.$patch({
          isActive: false,
          mode: 'edit'
        })
      }
      // -> Load Blocks. `?.` because a locked page draws its lock screen in place of the article, so
      //    there is no content element to scan -- and nothing in it to scan for.
      nextTick(async () => {
        for (const block of pageContents.value?.querySelectorAll(':not(:defined)') ?? []) {
          commonStore.loadBlocks([block.tagName.toLowerCase()])
        }
        /*
          Then the heading in the URL, if there is one. The browser tried it the moment it had the
          document, which was long before this render existed, so nothing happened — following a link
          to `#a-heading` left the reader at the top of the page. Done here rather than on mount
          because a route change within the app renders a new page the same way.
        */
        scrollToAnchorWhenReady(route.hash)
      })
    } catch (err) {
      if (err.message === 'ERR_PAGE_NOT_FOUND') {
        if (newValue === '/') {
          if (!userStore.authenticated) {
            router.push('/login')
          } else if (!userStore.can('write:pages')) {
            router.replace('/_error/unauthorized')
          } else {
            siteStore.overlay = 'Welcome'
          }
        } else {
          // -> Not a notification over the page the reader came from: that page is still on screen
          //    behind it, at a URL that is not its own. The view draws the missing page instead.
          pageStore.pageNotFound({ path: newValue })
          /*
            The one place the page permissions have to be asked for on their own: everywhere else they
            arrive with the page, and here there is no page to carry them — while the screen about to
            be drawn offers to create one, which is a permission question.
          */
          await userStore.fetchPagePermissions(newValue)
        }
      } else if (err.message === 'ERR_PAGE_UNAUTHORIZED') {
        // -> `replace`, so the back button leaves the wiki the way it came rather than bouncing off
        //    the same refusal again
        router.replace('/_error/unauthorized')
      } else {
        notify({
          type: 'negative',
          message: err.message
        })
      }
    }
  },
  { immediate: true }
)

// METHODS

/**
 * Follow a link inside the page's content without reloading the application.
 *
 * A rendered page is HTML, so its internal links are ordinary anchors: the browser would throw the
 * whole SPA away and build it again to show a page the router can swap in. `routableHref` decides
 * which ones are ours; anything it declines is left to the browser, including a click asking for a
 * new tab.
 */
/**
 * Back to the top of the article on arriving at another page.
 *
 * The article column scrolls, not the window -- the shell around it holds still -- so the router's own
 * `scrollBehavior` has nothing to do: it scrolls the document, which never moved. Left alone, a reader
 * following a link from halfway down one page arrives halfway down the next.
 *
 * Called before the content is swapped rather than after, so the jump happens on the page being left
 * instead of showing the new one at the old offset for a frame. A `#heading` in the URL still wins:
 * `scrollToAnchorWhenReady` runs once the render has settled, and travelling to it from the top is
 * what it is written to do.
 */
function scrollPageToTop() {
  pageScroller.value?.$el?.scrollTo({ top: 0, left: 0 })
}

/**
 * What a relation button links to, as props for `WBtn`.
 *
 * The buttons were rendered with neither, so a relation was decoration: it drew its label and caption
 * and swallowed the click. A target is stored as `PageRelationDialog` leaves it — a rooted path within
 * this wiki (`/guides/upgrading`) or a complete external address — so the two cases are told apart the
 * same way an in-content link is, by `routableHref`, and the router takes the ones that are ours
 * rather than reloading the app to reach them.
 *
 * Nothing at all for a relation with no target: the dialog only requires a label, and an `<a>` with an
 * empty href reloads the current page.
 *
 * @param rel A page relation
 * @returns `{ to }` for a page in this wiki, `{ href }` for an ordinary web address, `{}` for neither
 */
function relationLink(rel) {
  const target = rel.target?.trim()
  if (!target) {
    return {}
  }
  let url
  try {
    // -> Resolved against this origin, because a stored page target is a path rather than a URL and
    //    `routableHref` compares origins
    url = new URL(target, window.location.origin)
  } catch {
    return {}
  }
  const routed = routableHref({ href: url.toString() }, window.location)
  if (routed) {
    return { to: routed }
  }
  // -> An ordinary web link or nothing: a target is author-supplied, and `javascript:` in an href is
  //    script this page would run on click
  return /^https?:$/.test(url.protocol) ? { href: url.toString() } : {}
}

function onContentClick(ev) {
  if (
    ev.defaultPrevented ||
    ev.button !== 0 ||
    ev.metaKey ||
    ev.ctrlKey ||
    ev.shiftKey ||
    ev.altKey
  ) {
    return
  }
  const anchor = ev.target?.closest?.('a[href]')
  if (!anchor) {
    return
  }
  /*
    A heading on this same page: travelled to rather than jumped at, which is how the contents list
    and an arriving `#heading` already reach one. Through the helper, so a heading inside a closed tab
    is revealed first, and only claimed once it says it found somewhere to go -- a fragment naming
    nothing in the render is left to the browser, as it was.

    The URL still follows, so the address bar can be copied and Back returns to the section before.
    `router.push` rather than assigning `location.hash`, which would jump the page as well -- and since
    a pushed hash sets no target element, marking where the reader landed is the helper's job (see
    `LANDED_CLASS`) rather than `:target`'s.
  */
  const hash = sameDocumentHash(anchor, window.location)
  if (hash) {
    if (scrollToAnchor(hash, { smooth: true })) {
      ev.preventDefault()
      router.push({ path: route.path, query: route.query, hash })
    }
    return
  }
  const target = routableHref(anchor, window.location)
  if (!target) {
    return
  }
  ev.preventDefault()
  router.push(target)
}

function openTocPanel() {
  state.tocPanelOpen = true
}

function closeTocPanel() {
  state.tocPanelOpen = false
}

/**
 * Close the contents panel once the reader has picked something out of it.
 *
 * Delegated rather than bound per row: `PageToc` emits only `update:selected`, which does not fire again
 * when the heading already showing is picked a second time — so a click is the thing to listen for, not the
 * selection changing. Any anchor counts, which is what also covers a tag.
 */
function onSidebarClick(ev) {
  if (tocPanelIsOpen.value && ev.target?.closest?.('a')) {
    closeTocPanel()
  }
}

/** Asks for the page's password. Opened on arrival, and again from the lock screen's own button. */
function promptUnlock() {
  dialog({ component: PageUnlockDialog })
}

/**
 * Opens the editor on the page that is not there, at the path that was asked for.
 *
 * The path comes from the store rather than from the route, because the route is where it goes: the
 * editor moves to `/_create/markdown` and the path travels in the page itself, which is the same way
 * every other New Page button works.
 */
async function createPage() {
  loading.show()
  await pageStore.pageCreate({ editor: 'markdown', path: pageStore.path })
  loading.hide()
}

/**
 * Back out of a path that has no page. `router.back()` alone lands on the wiki's own error screen for
 * a reader who arrived at this URL directly, having nothing to go back to, so that case goes home.
 */
function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/')
  }
}
</script>

<style lang="scss">
/*
  Where the contents column stops being able to afford 300px. This view's own threshold, not one of the
  app's -- `_palette.scss` is for the breakpoints the whole app shares, and this one is a function of this
  page's two sidebars. Stated as a `max` value just under 1400px, the way the shared ones are.
*/
$toc-narrow-max: 1399.98px;

/*
  ...and where it stops being a column at all and becomes a panel over the article. The same boundary as
  the 750px `useMinWidth` above, which decides whether the opener is rendered, and as the one `MainLayout`
  uses to stand scroll-to-top down from this corner. All three have to agree.
*/
$toc-overlay-max: 749.98px;

/*
  The column in place of the article: the lock screen, the page that does not exist, and the
  redirection on its way somewhere else. All three are the same shape -- a large faint icon, a
  sentence, and the one button that does something about it -- and share the styling so they cannot
  drift apart. `PageRedirect.vue` draws its own screens with these classes for that reason.
*/
.page-placeholder {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* -> Off dead centre: the text reads better a little above the middle of the column */
  padding: 0 24px 10vh;
  text-align: center;

  /*
    Stated per theme, as everything else in this column is: the article's own colours come from
    `_page-contents.scss`, so a plain block dropped in beside it inherits the document's black and
    goes invisible on the dark surface. The icon below takes its colour from here as well.
  */
  @at-root .body--light & {
    color: $grey-9;
  }
  @at-root .body--dark & {
    color: #fff;
  }
}

/*
  Large and faint. It is the illustration on an otherwise empty column, not something to look at -- the
  sentence under it is what the reader is here to read.
*/
.page-placeholder-icon {
  margin-bottom: 24px;
  font-size: 96px;
  opacity: 0.12;
}

.page-breadcrumbs {
  @at-root .body--light & {
    background: linear-gradient(to bottom, $grey-1 0%, $grey-3 100%);
    border-bottom: 1px solid $grey-4;
  }
  /*
    The bar sets a background per theme, so it owes a foreground too: the LAST crumb -- the current
    page -- deliberately inherits rather than taking `active-color`, and what it was inheriting in
    dark mode was the document's black.
  */
  @at-root .body--light & {
    color: var(--color-black);
  }
  @at-root .body--dark & {
    background: linear-gradient(to bottom, $dark-3 0%, $dark-4 100%);
    border-bottom: 1px solid $dark-3;
    color: var(--color-white);
  }

  /*
    A point off the trail on a phone, on the bar rather than on the crumbs: `WBreadcrumbs` sets no size
    of its own and its icons are 125% of whatever it inherits, so one declaration here takes the text and
    the icons down together and keeps the two in proportion.

    13px is where it stops. The trail is how a reader gets back out, and it is already the smallest type
    on the screen -- what is wanted is a bar that gives way to the page under it, not one nobody can read.
  */
  @media (max-width: $breakpoint-xs-max) {
    font-size: 0.8125rem;
  }
}
.page-header {
  height: 95px;

  /*
    Sized by its contents on a phone instead, which comes out around 70px: the 95px is pitched for a 64px
    icon beside 34px display type, and holding it under the halved icon and title of the phone layout left
    a band of empty gradient under the description.

    `auto` rather than a smaller fixed height, because a fixed one is what the desktop bar can only just
    afford: a title long enough to wrap has nowhere to go in it. Here the bar grows by a line instead, and
    a page with no description gets a bar shorter still.
  */
  @media (max-width: $breakpoint-xs-max) {
    height: auto;
  }

  @at-root .body--light & {
    background: linear-gradient(to bottom, $grey-2 0%, $grey-1 100%);
    border-bottom: 1px solid $grey-4;
    border-top: 1px solid #fff;
  }
  @at-root .body--dark & {
    background: linear-gradient(to bottom, $dark-4 0%, $dark-3 100%);
    // border-bottom: 1px solid $dark-5;
    border-top: 1px solid $dark-6;
  }

  .no-height .q-field__control {
    height: auto;
  }

  &-title {
    @at-root .body--light & {
      color: $grey-9;
    }
    @at-root .body--dark & {
      color: #fff;
    }
  }
  &-subtitle {
    @at-root .body--light & {
      color: $grey-7;
    }
    @at-root .body--dark & {
      color: rgba(255, 255, 255, 0.6);
    }
  }
}
/*
  The article and the footer under it, stacked inside the one box that scrolls.

  `flex: 1 0 auto` on the article is what keeps the footer at the BOTTOM of a short page instead of
  leaving it hanging under two lines of content: the article takes the leftover height, and past that
  grows with its own content and pushes the footer out of view until the reader gets there. It must
  not shrink either, or a long article would be squeezed to make room rather than scrolling.
*/
.page-container-scrl {
  display: flex;
  flex-direction: column;
}
.page-container-body {
  flex: 1 0 auto;

  /*
    The other half of the padding change in the template above.

    `--content-bleed` is how far the rule under an h1 reaches BACK through the padding of whatever holds
    the content, so that it starts at the sidebar rather than at the text -- so it is a statement about
    this surface's padding, and left at 1rem against 0.5rem of it the rule overhung the column by 8px.
    `_page-contents.scss` declares the property expecting exactly this: a surface that pads differently
    overrides the one property rather than the rule.

    On the `.page-contents` element rather than here, because that is where the default is declared and a
    custom property set on the parent would simply be shadowed by it. The editor's preview pane carries
    the class itself and still pads 1rem, so it keeps the default.
  */
  @media (max-width: $breakpoint-xs-max) {
    .page-contents {
      --content-bleed: 0.5rem;
    }
  }
}

.page-container {
  @at-root .body--light & {
    border-top: 1px solid #fff;
  }
  // @at-root .body--dark & {
  //   border-top: 1px solid $dark-6;
  // }
}
/*
  The Tags heading's edit toggle. `visibility` is transitioned alongside the opacity so it still fades
  BOTH ways: as a discrete property it flips at the end of the transition when going to hidden, and at
  the start when coming back, which is exactly the timing a fade wants.
*/
.tags-edit-btn {
  transition:
    opacity 0.2s var(--ease-standard),
    visibility 0.2s var(--ease-standard);

  &.is-hidden {
    visibility: hidden;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tags-edit-btn {
    transition-duration: 0.01ms;
  }
}

.page-sidebar {
  flex: 0 0 300px;

  /*
    Narrower once the window is: 300px is pitched for a wide desktop, where it is a tenth of the width, and
    by 1200px it is a quarter of what is left after the nav sidebar. 200px still holds a heading of a few
    words per line -- the contents list wraps rather than truncating (see `PageToc`) -- and hands the
    article the other 100px.

    1400px is this view's own threshold rather than one of the app's `--breakpoint-*`: it is where THIS
    column starts crowding the article, which depends on its own width and the nav's.
  */
  @media (max-width: $toc-narrow-max) {
    flex: 0 0 200px;
  }

  /*
    And below 750px it stops being a column at all: even at 200px it is a third of a 600px window, and an
    article is what the reader came for. It becomes a panel the width of the wide column, parked off the
    right edge and slid in when asked for -- the same shape as the nav drawer on a narrow screen, and for
    the same reason, so the two behave alike from opposite sides.

    `position: fixed` is what takes it out of the row, so the article gets the whole width whether the
    panel is open or not; the reader is never made to choose between the two, only to look at one at a
    time. `transform` is what animates, being the one property that moves a box without laying anything
    out again -- and the panel is out of flow, so there is nothing behind it to reflow anyway.

    Right regardless of `tocPosition`: the opener is in the bottom-RIGHT corner, and a panel arriving from
    the far side of the screen from the button that summoned it reads as something else appearing.
  */
  @media (max-width: $toc-overlay-max) {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    /* -> The wide column's width, capped so it cannot take the whole of a small screen */
    width: 300px;
    max-width: 85vw;
    transform: translateX(100%);
    transition: transform 0.2s var(--ease-standard);
    box-shadow: -2px 0 12px rgb(0 0 0 / 0.3);

    &.is-open {
      transform: none;
    }
  }

  @at-root .body--light & {
    background-color: $grey-2;
  }
  @at-root .body--dark & {
    background-color: $dark-5;
  }

  // A light rule on the light sidebar, near-black on the dark one -- it reads as the bevel between
  // two panels rather than as a drawn line.
  //
  // The original set a background-colour here as well as a border. It never showed: the element is
  // 1px tall with `box-sizing: border-box`, so the content box is 0px and the opaque border covers
  // it completely. Only the border colour is carried across.
  .w-separator {
    --w-hairline-color: #fff;
  }
  @at-root .body--dark & .w-separator {
    --w-hairline-color: #070a0d;
  }

  /*
    The column is the height of the shell, so its own content scrolls when there is more of it than
    there is room -- a long contents list, in practice. Nothing sticky is involved: the shell holds
    still on its own, and the article beside this scrolls in its own box.
  */
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgb(102 102 102 / 0.5) transparent;
}

/*
  Behind the panel, and under it: the same tint and the same z-index as the nav drawer's scrim, one step
  below the panel it dims. The opener is at z-30 as well and is not rendered while the panel is open, so
  the two never overlap.
*/
.page-sidebar-scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background-color: rgb(0 0 0 / 0.4);
}

.page-sidebar-scrim-enter-active,
.page-sidebar-scrim-leave-active,
.toc-open-btn-enter-active,
.toc-open-btn-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.page-sidebar-scrim-enter-from,
.page-sidebar-scrim-leave-to,
.toc-open-btn-enter-from,
.toc-open-btn-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .page-sidebar,
  .page-sidebar-scrim-enter-active,
  .page-sidebar-scrim-leave-active,
  .toc-open-btn-enter-active,
  .toc-open-btn-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
