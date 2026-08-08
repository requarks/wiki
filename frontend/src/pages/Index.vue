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
    <div
      class="page-breadcrumbs py-2 px-4 flex flex-wrap"
      v-if="!editorStore.isActive && !pageStore.notFound">
      <div class="min-w-0 flex-1">
        <w-breadcrumbs
          :items="breadcrumbs"
          :active-color="dark.isActive ? `grey-5` : `grey-7`"
          separator-color="grey">
          <template #separator><w-icon name="la:angle-right" /></template>
        </w-breadcrumbs>
      </div>
      <div class="flex-none flex items-center justify-end">
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
        <w-scroll-area class="page-container-scrl" v-else style="height: 100%">
          <div class="page-container-body p-4">
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
                    :key="`rel-id-` + rel.id">
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
                      :key="`rel-id-` + rel.id">
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
                    :key="`rel-id-` + rel.id">
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
      <div
        class="page-sidebar"
        v-if="showSidebar"
        :style="siteStore.theme.tocPosition === `left` ? `order: 1;` : `order: 2;`">
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
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { scrollToAnchorWhenReady } from '@/helpers/anchors'
import { enhanceRenderedContent, routableHref } from '@/helpers/renderedContent'
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
import PageTags from '@/components/PageTags.vue'
import PageToc from '@/components/PageToc.vue'
import PageUnlockDialog from '@/components/PageUnlockDialog.vue'
import SideDialog from '@/components/SideDialog.vue'

const editorComponents = {
  markdown: defineAsyncComponent({
    loader: () => import('../components/EditorMarkdown.vue'),
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

useMeta({
  title: pageStore.title
})

// DATA

const state = reactive({
  showSideDialog: false,
  sideDialogComponent: null,
  showGlobalDialog: false,
  globalDialogComponent: null,
  showTagsEditBtn: false,
  tagEditMode: false,
  tocSelected: null,
  currentRating: 3
})
const pageContents = ref(null)

// COMPUTED

const showSidebar = computed(() => {
  return (
    pageStore.showSidebar &&
    siteStore.showSidebar &&
    siteStore.theme.tocPosition !== 'off' &&
    !editorStore.isActive &&
    // -> Contents, tags and a rating, all of a page that is not there
    !pageStore.notFound
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

    // -> Load Page
    try {
      await pageStore.pageLoad({ path: newValue })
      if (editorStore.isActive) {
        editorStore.$patch({
          isActive: false
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
  const target = routableHref(anchor, window.location)
  if (!target) {
    return
  }
  ev.preventDefault()
  router.push(target)
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
  The column in place of the article: the lock screen, and the page that does not exist. Both are the
  same shape -- a large faint icon, a sentence, and the one button that does something about it -- and
  share the styling so they cannot drift apart.
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
}
.page-header {
  height: 95px;

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
</style>
