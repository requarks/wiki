<template lang="pug">
.page-actions.column.items-stretch.order-last(:class='editorStore.isActive ? `is-editor` : ``')
  template(v-if='userStore.can(`edit:pages`)')
    q-btn.q-py-md(
      flat
      icon='las la-pen-nib'
      :color='editorStore.isActive ? `white` : `deep-orange-9`'
      :aria-label='t(`editor.props.pageProperties`)'
      @click='togglePageProperties'
      )
      q-tooltip(anchor='center left' self='center right') {{ t('editor.props.pageProperties') }}
    q-btn.q-py-md(
      v-if='flagsStore.experimental'
      flat
      icon='las la-project-diagram'
      :color='editorStore.isActive ? `white` : `deep-orange-9`'
      :aria-label='t(`editor.pageData.title`)'
      @click='togglePageData'
      disable
      )
      q-tooltip(anchor='center left' self='center right') {{ t('editor.pageData.title') }}
    q-btn.q-py-md(
      v-if='editorStore.isActive'
      flat
      color='white'
      :text-color='hasPendingAssets ? `white` : `deep-orange-3`'
      :aria-label='t(`pageActions.pendingAssetUploads`)'
      )
      q-icon(name='mdi-image-sync-outline')
        q-badge.page-actions-pending-badge(
          v-if='hasPendingAssets'
          color='white'
          text-color='orange-9'
          rounded
          floating
          )
          strong {{ editorStore.pendingAssets.length * 1 }}
      q-tooltip(anchor='center left' self='center right') {{ t('pageActions.pendingAssetUploads') }}
      q-menu(
        ref='menuPendingAssets'
        anchor='top left'
        self='top right'
        :offset='[10, 0]'
        )
        q-card(style='width: 450px;')
          q-card-section.card-header
            q-icon(name='img:/_assets/icons/color-data-pending.svg', left, size='sm')
            span {{ t('pageActions.pendingAssetUploads') }}
          q-card-section(v-if='!hasPendingAssets') {{ t('pageActions.noPendingAssetUploads') }}
          q-list(v-else, separator)
            q-item(
              v-for='item of editorStore.pendingAssets'
              :key='item.id'
              )
              q-item-section(side)
                q-icon(name='las la-file-image')
              q-item-section {{ item.fileName }}
              q-item-section(side)
                q-btn.acrylic-btn(
                  color='negative'
                  round
                  icon='las la-times'
                  size='xs'
                  flat
                  @click='removePendingAsset(item)'
                  )
          q-card-section.card-actions
            em.text-caption {{ t('pageActions.pendingAssetUploadsHint') }}
    q-separator.q-my-sm(inset)
  q-btn.q-py-md(
    flat
    icon='las la-history'
    :color='editorStore.isActive ? `white` : `grey`'
    :aria-label='t(`common.header.history`)'
    @click='notImplemented'
    )
    q-tooltip(anchor='center left' self='center right') {{ t('common.header.history') }}
  q-btn.q-py-md(
    flat
    icon='las la-code'
    :color='editorStore.isActive ? `white` : `grey`'
    :aria-label='t(`common.header.viewSource`)'
    @click='viewPageSource'
    )
    q-tooltip(anchor='center left' self='center right') {{ t('common.header.viewSource') }}
  template(v-if='!(editorStore.isActive && editorStore.mode === `create`)')
    q-separator.q-my-sm(inset)
    q-btn.q-py-sm(
      flat
      icon='las la-ellipsis-h'
      :color='editorStore.isActive ? `deep-orange-2` : `grey`'
      :aria-label='t(`common.header.pageActions`)'
      )
      q-tooltip(anchor='center left' self='center right') {{ t('common.header.pageActions') }}
      q-menu.translucent-menu(
        anchor='top left'
        self='top right'
        auto-close
        transition-show='jump-left'
        )
        q-list(padding, style='min-width: 225px;')
          q-item(clickable, disabled, v-if='userStore.can(`manage:pages`)')
            q-item-section.items-center(avatar)
              q-icon(color='deep-orange-9', name='las la-atom', size='sm')
            q-item-section
              q-item-label {{ t('pageActions.convertPage') }}
          q-item(clickable, v-if='userStore.can(`edit:pages`)', @click='rerenderPage')
            q-item-section.items-center(avatar)
              q-icon(color='deep-orange-9', name='las la-magic', size='sm')
            q-item-section
              q-item-label {{ t('common.actions.rerender') }}
          q-item(clickable, disabled)
            q-item-section.items-center(avatar)
              q-icon(color='deep-orange-9', name='las la-sun', size='sm')
            q-item-section
              q-item-label {{ t('pageActions.viewBacklinks') }}
  q-space
  template(v-if='!(editorStore.isActive && editorStore.mode === `create`)')
    q-btn.q-py-sm(
      v-if='userStore.can(`create:pages`)'
      flat
      icon='las la-copy'
      :color='editorStore.isActive ? `deep-orange-2` : `grey`'
      :aria-label='t(`pageActions.duplicatePage`)'
      @click='duplicatePage'
      )
      q-tooltip(anchor='center left' self='center right') {{ t('pageActions.duplicatePage') }}
    q-btn.q-py-sm(
      v-if='userStore.can(`manage:pages`)'
      flat
      icon='las la-share'
      :color='editorStore.isActive ? `deep-orange-2` : `grey`'
      :aria-label='t(`pageActions.renameMovePage`)'
      @click='renamePage'
      )
      q-tooltip(anchor='center left' self='center right') {{ t('pageActions.renameMovePage') }}
    q-btn.q-py-sm(
      v-if='userStore.can(`delete:pages`)'
      flat
      icon='las la-trash'
      :color='editorStore.isActive ? `deep-orange-2` : `grey`'
      :aria-label='t(`common.page.delete`)'
      @click='deletePage'
      :class='editorStore.isActive ? `q-pb-md` : ``'
      )
      q-tooltip(anchor='center left' self='center right') {{ t('common.page.delete') }}
  span.page-actions-mode(v-else) {{ t('common.actions.newPage') }}
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

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

// REFS

const menuPendingAssets = ref(null)

// COMPUTED

const hasPendingAssets = computed(() => editorStore.pendingAssets?.length > 0)

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

function viewPageSource () {
  siteStore.$patch({ overlay: 'PageSource', overlayOpts: { } })
}

function rerenderPage () {
  $q.dialog({
    component: defineAsyncComponent(() => import('../components/RerenderPageDialog.vue')),
    componentProps: {
      id: pageStore.id
    }
  }).onOk(() => {
    pageStore.pageLoad({ id: pageStore.id })
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
  }).onOk((newPageOpts) => {
    pageStore.pageDuplicate({ sourecePageId: pageStore.id, path: newPageOpts.path, title: newPageOpts.title })
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
  }).onOk(async (renamedPageOpts) => {
    try {
      if (renamedPageOpts.path === pageStore.path) {
        await pageStore.pageRename({ id: pageStore.id, title: renamedPageOpts.title })
        $q.notify({
          type: 'positive',
          message: t('page.notify.renameSuccess')
        })
      } else {
        await pageStore.pageMove({ id: pageStore.id, path: renamedPageOpts.path, title: renamedPageOpts.title })
        $q.notify({
          type: 'positive',
          message: t('page.notify.moveSuccess')
        })
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: err.message
      })
    }
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

function removePendingAsset (item) {
  URL.revokeObjectURL(item.blobUrl)
  editorStore.pendingAssets = editorStore.pendingAssets.filter(a => a.id !== item.id)
  if (editorStore.pendingAssets.length < 1) {
    menuPendingAssets.value.hide()
  }
}

function notImplemented () {
  $q.notify({
    type: 'negative',
    message: t('common.error.notImplemented')
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

  &-pending-badge {
    animation: pageActionsBadgePulsate 2s ease infinite;
  }
}

@keyframes pageActionsBadgePulsate {
  0% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(3px, -3px);
  }
  100% {
    transform: translate(0, 0);
  }
}
</style>
