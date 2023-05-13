<template lang='pug'>
q-page.column
  .page-breadcrumbs.q-py-sm.q-px-md.row(
    v-if='!editorStore.isActive'
    )
    .col
      q-breadcrumbs(
        active-color='grey-7'
        separator-color='grey'
        )
        template(v-slot:separator)
          q-icon(
            name='las la-angle-right'
          )
        q-breadcrumbs-el(icon='las la-home', to='/', aria-label='Home')
          q-tooltip Home
        q-breadcrumbs-el(
          v-for='brd of pageStore.breadcrumbs'
          :key='brd.id'
          :icon='brd.icon'
          :label='brd.title'
          :aria-label='brd.title'
          :to='brd.path'
          )
    .col-auto.flex.items-center.justify-end
      template(v-if='!pageStore.publishState === `draft`')
        .text-caption.text-accent: strong Unpublished
        q-separator.q-mx-sm(vertical)
      .text-caption.text-grey-6 Last modified on #[strong {{lastModified}}]
  page-header
  .page-container.row.no-wrap.items-stretch(style='flex: 1 1 100%;')
    .col(style='order: 1;')
      q-no-ssr(
        v-if='editorStore.isActive'
        )
        component(:is='editorComponents[editorStore.editor]')
      q-scroll-area.page-container-scrl(
        v-else
        :thumb-style='thumbStyle'
        :bar-style='barStyle'
        style='height: 100%;'
        )
        .q-pa-md
          .page-contents(v-html='pageStore.render')
          template(v-if='pageStore.relations && pageStore.relations.length > 0')
            q-separator.q-my-lg
            .row.align-center
              .col.text-left(v-if='relationsLeft.length > 0')
                q-btn.q-mr-sm.q-mb-sm(
                  padding='sm md'
                  outline
                  :icon='rel.icon'
                  no-caps
                  color='primary'
                  v-for='rel of relationsLeft'
                  :key='`rel-id-` + rel.id'
                  )
                  .column.text-left.q-pl-md
                    .text-body2: strong {{rel.label}}
                    .text-caption {{rel.caption}}
              .col.text-center(v-if='relationsCenter.length > 0')
                .column
                  q-btn(
                    :label='rel.label'
                    color='primary'
                    flat
                    no-caps
                    :icon='rel.icon'
                    v-for='rel of relationsCenter'
                    :key='`rel-id-` + rel.id'
                  )
              .col.text-right(v-if='relationsRight.length > 0')
                q-btn.q-ml-sm.q-mb-sm(
                  padding='sm md'
                  outline
                  :icon-right='rel.icon'
                  no-caps
                  color='primary'
                  v-for='rel of relationsRight'
                  :key='`rel-id-` + rel.id'
                  )
                  .column.text-left.q-pr-md
                    .text-body2: strong {{rel.label}}
                    .text-caption {{rel.caption}}
    .page-sidebar(
      v-if='showSidebar'
      style='order: 2;'
      )
      template(v-if='pageStore.showToc')
        //- TOC
        .q-pa-md.flex.items-center
          q-icon.q-mr-sm(name='las la-stream', color='grey')
          .text-caption.text-grey-7 Contents
        .q-px-md.q-pb-sm
          q-tree.page-toc(
            :nodes='pageStore.toc'
            icon='las la-caret-right'
            node-key='key'
            dense
            v-model:expanded='state.tocExpanded'
            v-model:selected='state.tocSelected'
          )
      //- Tags
      template(v-if='pageStore.showTags')
        q-separator(v-if='pageStore.showToc')
        .q-pa-md(
          @mouseover='state.showTagsEditBtn = true'
          @mouseleave='state.showTagsEditBtn = false'
          )
          .flex.items-center
            q-icon.q-mr-sm(name='las la-tags', color='grey')
            .text-caption.text-grey-7 Tags
            q-space
            transition(name='fade')
              q-btn(
                v-show='state.showTagsEditBtn'
                size='sm'
                padding='none xs'
                icon='las la-pen'
                color='deep-orange-9'
                flat
                label='Edit'
                no-caps
                @click='state.tagEditMode = !state.tagEditMode'
              )
          page-tags.q-mt-sm(:edit='state.tagEditMode')
      template(v-if='siteStore.features.ratingsMode !== `off` && pageStore.allowRatings')
        q-separator(v-if='pageStore.showToc || pageStore.showTags')
        //- Rating
        .q-pa-md.flex.items-center
          q-icon.q-mr-sm(name='las la-star-half-alt', color='grey')
          .text-caption.text-grey-7 Rate this page
        .q-px-md
          q-rating(
            v-if='siteStore.features.ratingsMode === `stars`'
            v-model='state.currentRating'
            icon='las la-star'
            color='secondary'
            size='sm'
          )
          .flex.items-center(v-else-if='siteStore.features.ratingsMode === `thumbs`')
            q-btn.acrylic-btn(
              flat
              icon='las la-thumbs-down'
              color='secondary'
            )
            q-btn.acrylic-btn.q-ml-sm(
              flat
              icon='las la-thumbs-up'
              color='secondary'
            )
    page-actions-col

  side-dialog
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'

import { useEditorStore } from 'src/stores/editor'
import { useFlagsStore } from 'src/stores/flags'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

// COMPONENTS

import LoadingGeneric from 'src/components/LoadingGeneric.vue'
import PageActionsCol from 'src/components/PageActionsCol.vue'
import PageHeader from 'src/components/PageHeader.vue'
import PageTags from 'src/components/PageTags.vue'
import SideDialog from 'src/components/SideDialog.vue'

const editorComponents = {
  markdown: defineAsyncComponent({
    loader: () => import('../components/EditorMarkdown.vue'),
    loadingComponent: LoadingGeneric
  }),
  wysiwyg: defineAsyncComponent({
    loader: () => import('../components/EditorWysiwyg.vue'),
    loadingComponent: LoadingGeneric
  })
}

// QUASAR

const $q = useQuasar()

// STORES

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
  tocExpanded: ['h1-0', 'h1-1'],
  tocSelected: [],
  currentRating: 3
})
const thumbStyle = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: $q.dark.isActive ? '#FFF' : '#000',
  width: '5px',
  opacity: 0.15
}
const barStyle = {
  backgroundColor: $q.dark.isActive ? '#161b22' : '#FAFAFA',
  width: '9px',
  opacity: 1
}

// COMPUTED

const showSidebar = computed(() => {
  return pageStore.showSidebar && siteStore.showSidebar && !editorStore.isActive
})
const relationsLeft = computed(() => {
  return pageStore.relations ? pageStore.relations.filter(r => r.position === 'left') : []
})
const relationsCenter = computed(() => {
  return pageStore.relations ? pageStore.relations.filter(r => r.position === 'center') : []
})
const relationsRight = computed(() => {
  return pageStore.relations ? pageStore.relations.filter(r => r.position === 'right') : []
})
const lastModified = computed(() => {
  return pageStore.updatedAt ? DateTime.fromISO(pageStore.updatedAt).toLocaleString(DateTime.DATETIME_MED) : 'N/A'
})

// WATCHERS

watch(() => route.path, async (newValue) => {
  if (newValue.startsWith('/_')) { return }
  try {
    await pageStore.pageLoad({ path: newValue })
    if (editorStore.isActive) {
      editorStore.$patch({
        isActive: false
      })
    }
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
        $q.notify({
          type: 'negative',
          message: 'This page does not exist (yet)!'
        })
      }
    } else {
      $q.notify({
        type: 'negative',
        message: err.message
      })
    }
  }
}, { immediate: true })

watch(() => pageStore.toc, () => { refreshTocExpanded() }, { immediate: true })
watch(() => pageStore.tocDepth, () => { refreshTocExpanded() })

// METHODS

function refreshTocExpanded (baseToc, lvl) {
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
  min-height: 95px;

  @at-root .body--light & {
    background: linear-gradient(to bottom, $grey-2 0%, $grey-1 100%);
    border-bottom: 1px solid $grey-4;
    border-top: 1px solid #FFF;
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
      color: #FFF;
    }
  }
  &-subtitle {
    @at-root .body--light & {
      color: $grey-7;
    }
    @at-root .body--dark & {
      color: rgba(255,255,255,.6);
    }
  }
}
.page-container {
  @at-root .body--light & {
    border-top: 1px solid #FFF;
  }
  // @at-root .body--dark & {
  //   border-top: 1px solid $dark-6;
  // }

  .page-container-scrl > .q-scrollarea__container > .q-scrollarea__content {
    width: 100%;
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

  .q-separator {
    background-color: rgba(0,0,0,.05);
    border-bottom: 1px solid;

    @at-root .body--light & {
      background-color: rgba(0,0,0,.05);
      border-bottom-color: #FFF;
    }
    @at-root .body--dark & {
      background-color: rgba(255,255,255,.04);
      border-bottom-color: #070a0d;
    }
  }
}

.floating-syncpanel {
  .q-dialog__inner {
    margin-top: 14px;
    right: 140px;
    left: auto;

    .q-card {
      border-radius: 17px;
    }
  }

  &-msg {
    padding-top: 1px;
    font-weight: 500;
    font-size: .75rem;
    padding-right: 16px;
    display: flex;
    align-items: center;
  }
}

.q-card {
  @at-root .body--light & {
    background-color: #FFF;
  }
  @at-root .body--dark & {
    background-color: $dark-3;
  }
}

.page-toc {
  &.q-tree--dense .q-tree__node {
    padding-bottom: 5px;
  }
}
</style>
