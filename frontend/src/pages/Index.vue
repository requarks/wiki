<template>
  <w-page class="flex flex-col">
    <div class="page-breadcrumbs py-2 px-4 flex flex-wrap" v-if="!editorStore.isActive">
      <div class="min-w-0 flex-1">
        <w-breadcrumbs :items="breadcrumbs" active-color="grey-7" separator-color="grey">
          <template #separator><w-icon name="la:angle-right" /></template>
        </w-breadcrumbs>
      </div>
      <div class="flex-none flex items-center justify-end">
        <template v-if="!pageStore.publishState === `draft`">
          <div class="text-caption text-accent"><strong>Unpublished</strong></div>
          <w-separator class="mx-2" vertical />
        </template>
        <div class="text-caption text-grey-6">Last modified on <strong>{{lastModified}}</strong></div>
      </div>
    </div>
    <page-header />
    <div class="page-container flex flex-nowrap items-stretch" style="flex: 1 1 100%;">
      <div class="min-w-0 flex-1" :style="siteStore.theme.tocPosition === `left` ? `order: 2;` : `order: 1;`">
        <component :is="editorComponents[editorStore.editor]" v-if="editorStore.isActive" />
        <w-scroll-area class="page-container-scrl" v-else style="height: 100%;">
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
                      <div class="text-body2"><strong>{{rel.label}}</strong></div>
                      <div class="text-caption">{{rel.caption}}</div>
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
                      <div class="text-body2"><strong>{{rel.label}}</strong></div>
                      <div class="text-caption">{{rel.caption}}</div>
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
        <template v-if="pageStore.showToc">
          <!-- TOC -->
          <div class="p-4 flex items-center">
            <w-icon class="mr-2" name="la:stream" color="grey" />
            <div class="text-caption text-grey-7">Contents</div>
          </div>
          <div class="px-4 pb-2">
            <w-tree
              class="page-toc"
              :nodes="pageStore.toc"
              icon="la:caret-right"
              node-key="key"
              dense
              v-model:expanded="state.tocExpanded"
              v-model:selected="state.tocSelected" />
          </div>
        </template>
        <!-- Tags -->
        <template v-if="pageStore.showTags">
          <w-separator v-if="pageStore.showToc" />
          <div
            class="p-4"
            @mouseover="state.showTagsEditBtn = true"
            @mouseleave="state.showTagsEditBtn = false">
            <div class="flex items-center">
              <w-icon class="mr-2" name="la:tags" color="grey" />
              <div class="text-caption text-grey-7">Tags</div>
              <w-space />
              <transition name="fade">
                <w-btn
                  v-show="state.showTagsEditBtn"
                  size="sm"
                  padding="none xs"
                  icon="la:pen"
                  color="deep-orange-9"
                  flat
                  label="Edit"
                  no-caps
                  @click="state.tagEditMode = !state.tagEditMode" />
              </transition>
            </div>
            <page-tags class="mt-2" :edit="state.tagEditMode" />
          </div>
        </template>
        <template v-if="siteStore.features.ratingsMode !== `off` && pageStore.allowRatings">
          <w-separator v-if="pageStore.showToc || pageStore.showTags" />
          <!-- Rating -->
          <div class="p-4 flex items-center">
            <w-icon class="mr-2" name="la:star-half-alt" color="grey" />
            <div class="text-caption text-grey-7">Rate this page</div>
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

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

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
  tocExpanded: [],
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
      // -> Load Blocks
      nextTick(() => {
        for (const block of pageContents.value.querySelectorAll(':not(:defined)')) {
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

watch(
  () => pageStore.toc,
  () => {
    refreshTocExpanded()
  },
  { immediate: true }
)
watch(
  () => pageStore.tocDepth,
  () => {
    refreshTocExpanded()
  }
)

// METHODS

function refreshTocExpanded(baseToc, lvl) {
  const toExpand = []
  let isRootNode = false
  if (!baseToc) {
    baseToc = pageStore.toc
    isRootNode = true
    lvl = 1
  }
  if (baseToc.length > 0) {
    for (const node of baseToc) {
      if (lvl >= pageStore.tocDepth.min && lvl < pageStore.tocDepth.max) {
        toExpand.push(node.key)
      }
      if (node.children?.length && lvl < pageStore.tocDepth.max - 1) {
        toExpand.push(...refreshTocExpanded(node.children, lvl + 1))
      }
    }
  }
  if (isRootNode) {
    state.tocExpanded = toExpand
  } else {
    return toExpand
  }
}
</script>

<style lang="scss">
.page-breadcrumbs {
  @at-root .body--light & {
    background: linear-gradient(to bottom, $grey-1 0%, $grey-3 100%);
    border-bottom: 1px solid $grey-4;
  }
  @at-root .body--dark & {
    background: linear-gradient(to bottom, $dark-3 0%, $dark-4 100%);
    border-bottom: 1px solid $dark-3;
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
}

.page-toc {
  &.w-tree--dense .w-tree__node {
    padding-bottom: 5px;
  }
}
</style>
