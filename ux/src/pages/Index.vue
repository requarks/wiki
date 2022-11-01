<template lang='pug'>
q-page.column
  .page-breadcrumbs.q-py-sm.q-px-md.row
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
      template(v-if='!pageStore.isPublished')
        .text-caption.text-accent: strong Unpublished
        q-separator.q-mx-sm(vertical)
      .text-caption.text-grey-6 Last modified on #[strong {{lastModified}}]
  .page-header.row
    //- PAGE ICON
    .col-auto.q-pl-md.flex.items-center
      q-icon.rounded-borders(
        :name='pageStore.icon'
        size='64px'
        color='primary'
      )
    //- PAGE HEADER
    .col.q-pa-md
      .text-h4.page-header-title {{pageStore.title}}
      .text-subtitle2.page-header-subtitle {{pageStore.description}}

    //- PAGE ACTIONS
    .col-auto.q-pa-md.flex.items-center.justify-end
      q-btn.q-mr-md(
        flat
        dense
        icon='las la-bell'
        color='grey'
        aria-label='Watch Page'
        )
        q-tooltip Watch Page
      q-btn.q-mr-md(
        flat
        dense
        icon='las la-bookmark'
        color='grey'
        aria-label='Bookmark Page'
        )
        q-tooltip Bookmark Page
      q-btn.q-mr-md(
        flat
        dense
        icon='las la-share-alt'
        color='grey'
        aria-label='Share'
        )
        q-tooltip Share
        social-sharing-menu
      q-btn.q-mr-md(
        flat
        dense
        icon='las la-print'
        color='grey'
        aria-label='Print'
        )
        q-tooltip Print
      q-btn.acrylic-btn(
        flat
        icon='las la-edit'
        color='deep-orange-9'
        label='Edit'
        aria-label='Edit'
        no-caps
        :href='editUrl'
      )
  .page-container.row.no-wrap.items-stretch(style='flex: 1 1 100%;')
    .col(style='order: 1;')
      q-scroll-area(
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
      template(v-if='pageStore.allowRatings && pageStore.ratingsMode !== `off`')
        q-separator(v-if='pageStore.showToc || pageStore.showTags')
        //- Rating
        .q-pa-md.flex.items-center
          q-icon.q-mr-sm(name='las la-star-half-alt', color='grey')
          .text-caption.text-grey-7 Rate this page
        .q-px-md
          q-rating(
            v-if='pageStore.ratingsMode === `stars`'
            v-model='state.currentRating'
            icon='las la-star'
            color='secondary'
            size='sm'
          )
          .flex.items-center(v-else-if='pageStore.ratingsMode === `thumbs`')
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
    .page-actions.column.items-stretch.order-last
      q-btn.q-py-md(
        flat
        icon='las la-pen-nib'
        color='deep-orange-9'
        aria-label='Page Properties'
        @click='togglePageProperties'
        )
        q-tooltip(anchor='center left' self='center right') Page Properties
      q-btn.q-py-md(
        flat
        icon='las la-project-diagram'
        color='deep-orange-9'
        aria-label='Page Data'
        @click='togglePageData'
        )
        q-tooltip(anchor='center left' self='center right') Page Data
      q-separator.q-my-sm(inset)
      q-btn.q-py-sm(
        flat
        icon='las la-history'
        color='grey'
        aria-label='Page History'
        )
        q-tooltip(anchor='center left' self='center right') Page History
      q-btn.q-py-sm(
        flat
        icon='las la-code'
        color='grey'
        aria-label='Page Source'
        )
        q-tooltip(anchor='center left' self='center right') Page Source
      q-btn.q-py-sm(
        flat
        icon='las la-ellipsis-h'
        color='grey'
        aria-label='Page Actions'
        )
        q-menu(
          anchor='top left'
          self='top right'
          auto-close
          transition-show='jump-left'
          )
          q-list(padding, style='min-width: 225px;')
            q-item(clickable)
              q-item-section.items-center(avatar)
                q-icon(color='deep-orange-9', name='las la-atom', size='sm')
              q-item-section
                q-item-label Convert Page
            q-item(clickable)
              q-item-section.items-center(avatar)
                q-icon(color='deep-orange-9', name='las la-magic', size='sm')
              q-item-section
                q-item-label Re-render Page
            q-item(clickable)
              q-item-section.items-center(avatar)
                q-icon(color='deep-orange-9', name='las la-sun', size='sm')
              q-item-section
                q-item-label View Backlinks
      q-space
      q-btn.q-py-sm(
        flat
        icon='las la-copy'
        color='grey'
        aria-label='Duplicate Page'
        )
        q-tooltip(anchor='center left' self='center right') Duplicate Page
      q-btn.q-py-sm(
        flat
        icon='las la-share'
        color='grey'
        aria-label='Rename / Move Page'
        )
        q-tooltip(anchor='center left' self='center right') Rename / Move Page
      q-btn.q-py-sm(
        flat
        icon='las la-trash'
        color='grey'
        aria-label='Delete Page'
        @click='savePage'
        )
        q-tooltip(anchor='center left' self='center right') Delete Page

  q-dialog(
    v-model='state.showSideDialog'
    position='right'
    full-height
    transition-show='jump-left'
    transition-hide='jump-right'
    class='floating-sidepanel'
    no-shake
    )
    component(:is='sideDialogs[state.sideDialogComponent]')

  q-dialog(
    v-model='state.showGlobalDialog'
    transition-show='jump-up'
    transition-hide='jump-down'
    )
    component(:is='globalDialogs[state.globalDialogComponent]')
</template>

<script setup>
import { useMeta, useQuasar, setCssVar } from 'quasar'
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// COMPONENTS

import SocialSharingMenu from '../components/SocialSharingMenu.vue'
import PageTags from '../components/PageTags.vue'

const sideDialogs = {
  PageDataDialog: defineAsyncComponent(() => import('../components/PageDataDialog.vue')),
  PagePropertiesDialog: defineAsyncComponent(() => import('../components/PagePropertiesDialog.vue'))
}
const globalDialogs = {
  PageSaveDialog: defineAsyncComponent(() => import('../components/PageSaveDialog.vue'))
}

// QUASAR

const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

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
  backgroundColor: '#000',
  width: '5px',
  opacity: 0.15
}
const barStyle = {
  backgroundColor: '#FAFAFA',
  width: '9px',
  opacity: 1
}

// COMPUTED

const showSidebar = computed(() => {
  return pageStore.showSidebar && siteStore.showSidebar
})
const editorComponent = computed(() => {
  return pageStore.editor ? `editor-${pageStore.editor}` : null
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
const editMode = computed(() => {
  return pageStore.mode === 'edit'
})
const editCreateMode = computed(() => {
  return pageStore.mode === 'edit' && pageStore.mode === 'create'
})
const editUrl = computed(() => {
  let pagePath = siteStore.useLocales ? `${pageStore.locale}/` : ''
  pagePath += !pageStore.path ? 'home' : pageStore.path
  return `/_edit/${pagePath}`
})
const lastModified = computed(() => {
  return pageStore.updatedAt ? DateTime.fromISO(pageStore.updatedAt).toLocaleString(DateTime.DATETIME_MED) : 'N/A'
})

// WATCHERS

watch(() => route.path, async (newValue) => {
  if (newValue.startsWith('/_')) { return }
  try {
    await pageStore.pageLoad({ path: newValue })
  } catch (err) {
    if (err.message === 'ERR_PAGE_NOT_FOUND') {
      $q.notify({
        type: 'negative',
        message: 'This page does not exist (yet)!'
      })
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

function togglePageProperties () {
  state.sideDialogComponent = 'PagePropertiesDialog'
  state.showSideDialog = true
}

function togglePageData () {
  state.sideDialogComponent = 'PageDataDialog'
  state.showSideDialog = true
}

function savePage () {
  state.globalDialogComponent = 'PageSaveDialog'
  state.showGlobalDialog = true
}

function refreshTocExpanded (baseToc, lvl) {
  console.info(pageStore.tocDepth.min, lvl, pageStore.tocDepth.max)
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
.page-actions {
  flex: 0 0 56px;

  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-4;
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

.floating-sidepanel {
  .q-dialog__inner {
    right: 24px;

    .q-card {
      border-radius: 4px !important;
      min-width: 450px;

      .q-card__section {
        border-radius: 0;
      }
    }
  }

  .alt-card {
    @at-root .body--light & {
      background-color: $grey-2;
      border-top: 1px solid $grey-4;
      box-shadow: inset 0 1px 0 0 #FFF, inset 0 -1px 0 0 #FFF;
      border-bottom: 1px solid $grey-4;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-top: 1px solid lighten($dark-3, 8%);
      box-shadow: inset 0 1px 0 0 $dark-6, inset 0 -1px 0 0 $dark-6;
      border-bottom: 1px solid lighten($dark-3, 8%);
    }
  }

  &-quickaccess {
    width: 40px;
    border-radius: 4px !important;
    background-color: rgba(0,0,0,.75);
    color: #FFF;
    position: fixed;
    right: 486px;
    top: 74px;
    z-index: -1;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 5px 0 rgba(0,0,0,.5) !important;

    @at-root .q-transition--jump-left-enter-active & {
      display: none !important;
    }

    @at-root .q-transition--jump-right-leave-active & {
      display: none !important;
    }
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
