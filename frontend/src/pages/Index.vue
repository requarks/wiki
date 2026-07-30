<template>
  <!--
    `h-full min-h-0`: the shell hands this page a definite height, and the page has to CLAIM it for
    the article column below to scroll on its own. Left to grow, the whole page would scroll inside
    the shell instead and take the sidebars with it.
  -->
  <w-page class="flex flex-col h-full min-h-0">
    <div class="page-breadcrumbs py-2 px-4 flex flex-wrap" v-if="!editorStore.isActive">
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
    <page-header />
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
        <div v-else-if="pageStore.isLocked" class="page-locked">
          <w-icon class="page-locked-icon" name="la:lock" />
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
        <w-scroll-area class="page-container-scrl" v-else style="height: 100%">
          <div class="p-4">
            <div class="page-contents" ref="pageContents" v-html="pageStore.render" />
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
        <template v-if="pageStore.showTags">
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
          <w-separator v-if="showToc || pageStore.showTags" />
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
      <page-actions-col />
    </div>
    <side-dialog />
  </w-page>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { dialog } from '@/composables/dialog'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { enhanceRenderedContent } from '@/helpers/renderedContent'
import { flattenToc } from '@/helpers/toc'

import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

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
    !editorStore.isActive
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
  Whether this user may save a change to the page, which is what editing the tags amounts to -- the tags
  go up with the rest of the page rather than through an endpoint of their own. So the test is the pair
  the PATCH route accepts: `write:pages` or `manage:pages`.

  Read off `pagePermissions` rather than through `userStore.can()`, which would answer true for
  everybody: `can()` also consults `userStore.permissions`, and `users/whoami` still fills that with a
  hardcoded `['manage:system']` for every session -- a TODO in `api/users.ts`. `pagePermissions` comes
  from `pages/userPermissions`, which reads what the session actually holds. Once whoami is fixed this
  check needs no change: that route stays the authority on what a user may do to a page.
*/
const canEditPage = computed(() =>
  ['write:pages', 'manage:pages'].some((permission) =>
    userStore.pagePermissions.includes(permission)
  )
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
      nextTick(() => {
        for (const block of pageContents.value?.querySelectorAll(':not(:defined)') ?? []) {
          commonStore.loadBlocks([block.tagName.toLowerCase()])
        }
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
          notify({
            type: 'negative',
            message: 'This page does not exist (yet)!'
          })
        }
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

/** Asks for the page's password. Opened on arrival, and again from the lock screen's own button. */
function promptUnlock() {
  dialog({ component: PageUnlockDialog })
}
</script>

<style lang="scss">
.page-locked {
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
.page-locked-icon {
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
