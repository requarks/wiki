<template lang="pug">
.page-actions.column.items-stretch.order-last(:class='editorStore.isActive ? `is-editor` : ``')
  template(v-if='userStore.can(`edit:pages`)')
    q-btn.q-py-md(
      flat
      icon='las la-pen-nib'
      :color='editorStore.isActive ? `white` : `deep-orange-9`'
      aria-label='Page Properties'
      @click='togglePageProperties'
      )
      q-tooltip(anchor='center left' self='center right') Page Properties
    q-btn.q-py-md(
      v-if='flagsStore.experimental'
      flat
      icon='las la-project-diagram'
      :color='editorStore.isActive ? `white` : `deep-orange-9`'
      aria-label='Page Data'
      @click='togglePageData'
      disable
      )
      q-tooltip(anchor='center left' self='center right') Page Data
    q-separator.q-my-sm(inset)
  q-btn.q-py-md(
    flat
    icon='las la-history'
    :color='editorStore.isActive ? `white` : `grey`'
    aria-label='Page History'
    )
    q-tooltip(anchor='center left' self='center right') Page History
  q-btn.q-py-md(
    flat
    icon='las la-code'
    :color='editorStore.isActive ? `white` : `grey`'
    aria-label='Page Source'
    )
    q-tooltip(anchor='center left' self='center right') Page Source
  template(v-if='!(editorStore.isActive && editorStore.mode === `create`)')
    q-separator.q-my-sm(inset)
    q-btn.q-py-sm(
      flat
      icon='las la-ellipsis-h'
      :color='editorStore.isActive ? `deep-orange-2` : `grey`'
      aria-label='Page Actions'
      )
      q-tooltip(anchor='center left' self='center right') Page Actions
      q-menu(
        anchor='top left'
        self='top right'
        auto-close
        transition-show='jump-left'
        )
        q-list(padding, style='min-width: 225px;')
          q-item(clickable, v-if='userStore.can(`manage:pages`)')
            q-item-section.items-center(avatar)
              q-icon(color='deep-orange-9', name='las la-atom', size='sm')
            q-item-section
              q-item-label Convert Page
          q-item(clickable, v-if='userStore.can(`edit:pages`)')
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
  template(v-if='!(editorStore.isActive && editorStore.mode === `create`)')
    q-btn.q-py-sm(
      v-if='userStore.can(`create:pages`)'
      flat
      icon='las la-copy'
      :color='editorStore.isActive ? `deep-orange-2` : `grey`'
      aria-label='Duplicate Page'
      @click='duplicatePage'
      )
      q-tooltip(anchor='center left' self='center right') Duplicate Page
    q-btn.q-py-sm(
      v-if='userStore.can(`manage:pages`)'
      flat
      icon='las la-share'
      :color='editorStore.isActive ? `deep-orange-2` : `grey`'
      aria-label='Rename / Move Page'
      @click='renamePage'
      )
      q-tooltip(anchor='center left' self='center right') Rename / Move Page
    q-btn.q-py-sm(
      v-if='userStore.can(`delete:pages`)'
      flat
      icon='las la-trash'
      :color='editorStore.isActive ? `deep-orange-2` : `grey`'
      aria-label='Delete Page'
      @click='deletePage'
      :class='editorStore.isActive ? `q-pb-md` : ``'
      )
      q-tooltip(anchor='center left' self='center right') Delete Page
  span.page-actions-mode(v-else) {{ t('common.actions.newPage') }}
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useEditorStore } from 'src/stores/editor'
import { useFlagsStore } from 'src/stores/flags'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

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

// METHODS

function togglePageProperties () {
  siteStore.$patch({
    sideDialogComponent: 'PagePropertiesDialog',
    sideDialogShown: true
  })
}

function togglePageData () {
  siteStore.$patch({
    sideDialogComponent: 'PageDataDialog',
    sideDialogShown: true
  })
}

function duplicatePage () {
  $q.dialog({
    component: defineAsyncComponent(() => import('../components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'duplicatePage',
      folderPath: '',
      itemId: pageStore.id,
      itemTitle: pageStore.title,
      itemFileName: pageStore.path
    }
  }).onOk(() => {
    // TODO: change route to new location
  })
}

function renamePage () {
  $q.dialog({
    component: defineAsyncComponent(() => import('../components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'renamePage',
      folderPath: '',
      itemId: pageStore.id,
      itemTitle: pageStore.title,
      itemFileName: pageStore.path
    }
  }).onOk(() => {
    // TODO: change route to new location
  })
}

function deletePage () {
  $q.dialog({
    component: defineAsyncComponent(() => import('../components/PageDeleteDialog.vue')),
    componentProps: {
      pageId: pageStore.id,
      pageName: pageStore.title
    }
  }).onOk(() => {
    router.replace('/')
  })
}
</script>

<style lang="scss">
.page-actions {
  flex: 0 0 56px;

  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-4;
  }

  &.is-editor {
    @at-root .body--light & {
      background-color: $deep-orange-9;
    }
    @at-root .body--dark & {
      background-color: $deep-orange-9;
    }
  }

  &-mode {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    padding: 1.75rem 1rem 1.75rem 0;
    color: $deep-orange-3;
    font-weight: 500;
  }
}
</style>
