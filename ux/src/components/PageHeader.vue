<template lang="pug">
.page-header.row
  //- PAGE ICON
  .col-auto.q-pl-md.flex.items-center
    q-btn.rounded-borders(
      v-if='editorStore.isActive'
      padding='none'
      size='37px'
      :icon='pageStore.icon'
      color='primary'
      flat
      )
      q-badge(color='grey' floating rounded)
        q-icon(name='las la-pen', size='xs', padding='xs xs')
      q-menu(content-class='shadow-7')
        icon-picker-dialog(v-model='pageStore.icon')
    q-icon.rounded-borders(
      v-else
      :name='pageStore.icon'
      size='64px'
      color='primary'
    )
  //- PAGE HEADER
  .col.q-pa-md
    .text-h4.page-header-title
      span {{pageStore.title}}
      template(v-if='editorStore.isActive')
        span.text-grey(v-if='!pageStore.title') {{ t(`editor.props.title`)}}
        q-btn.acrylic-btn.q-ml-md(
          icon='las la-pen'
          flat
          padding='xs'
          size='sm'
          )
          q-popup-edit(
            v-model='pageStore.title'
            auto-save
            v-slot='scope'
            )
            q-input(
              outlined
              style='width: 450px;'
              v-model='scope.value'
              dense
              autofocus
              @keyup.enter='scope.set'
              :label='t(`editor.props.title`)'
              )
    .text-subtitle2.page-header-subtitle
      span {{ pageStore.description }}
      template(v-if='editorStore.isActive')
        span.text-grey(v-if='!pageStore.description') {{ t(`editor.props.shortDescription`)}}
        q-btn.acrylic-btn.q-ml-md(
          icon='las la-pen'
          flat
          padding='none xs'
          size='xs'
          )
          q-popup-edit(
            v-model='pageStore.description'
            auto-save
            v-slot='scope'
            )
            q-input(
              outlined
              style='width: 450px;'
              v-model='scope.value'
              dense
              autofocus
              @keyup.enter='scope.set'
              :label='t(`editor.props.shortDescription`)'
              )
  //- PAGE ACTIONS
  .col-auto.q-pa-md.flex.items-center.justify-end
    template(v-if='!editorStore.isActive')
      q-btn.q-ml-md(
        v-if='userStore.authenticated'
        flat
        dense
        icon='las la-bell'
        color='grey'
        aria-label='Watch Page'
        )
        q-tooltip Watch Page
      q-btn.q-ml-md(
        v-if='userStore.authenticated'
        flat
        dense
        icon='las la-bookmark'
        color='grey'
        aria-label='Bookmark Page'
        )
        q-tooltip Bookmark Page
      q-btn.q-ml-md(
        v-if='siteStore.theme.showSharingMenu'
        flat
        dense
        icon='las la-share-alt'
        color='grey'
        aria-label='Share'
        )
        q-tooltip Share
        social-sharing-menu
      q-btn.q-ml-md(
        v-if='siteStore.theme.showPrintBtn'
        flat
        dense
        icon='las la-print'
        color='grey'
        aria-label='Print'
        @click='printPage'
        )
        q-tooltip Print
    template(v-if='editorStore.isActive')
      q-btn.q-ml-md.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/editor/${editorStore.editor}`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-ml-sm.acrylic-btn(
        icon='las la-cog'
        flat
        color='grey'
        :aria-label='t(`editor.settings`)'
        @click='openEditorSettings'
        )
        q-tooltip {{ t(`editor.settings`) }}
    template(v-if='editorStore.isActive || editorStore.hasPendingChanges')
      q-btn.acrylic-btn.q-ml-sm(
        flat
        icon='las la-times'
        color='negative'
        :label='editorStore.hasPendingChanges ? t(`common.actions.discard`) : t(`common.actions.close`)'
        :aria-label='editorStore.hasPendingChanges ? t(`common.actions.discard`) : t(`common.actions.close`)'
        no-caps
        @click='discardChanges'
      )
      q-btn.acrylic-btn.q-ml-sm(
        v-if='editorStore.mode === `create`'
        flat
        icon='las la-check'
        color='positive'
        :label='t(`editor.createPage`)'
        :aria-label='t(`editor.createPage`)'
        no-caps
        @click='createPage'
      )
      q-btn-group.q-ml-sm(
        v-else
        flat
        )
        q-btn.acrylic-btn(
          flat
          icon='las la-check'
          color='positive'
          :label='t(`common.actions.saveChanges`)'
          :aria-label='t(`common.actions.saveChanges`)'
          :disabled='!editorStore.hasPendingChanges'
          no-caps
          @click.exact='saveChanges(false)'
          @click.ctrl.exact='saveChanges(true)'
          )
        template(v-if='editorStore.isActive')
          q-separator(vertical, dark)
          q-btn.acrylic-btn(
            flat
            icon='las la-check-double'
            color='positive'
            :aria-label='t(`common.actions.saveAndClose`)'
            :disabled='!editorStore.hasPendingChanges'
            @click='saveChanges(true)'
            )
            q-tooltip {{ t(`common.actions.saveAndClose`) }}
    template(v-else-if='userStore.can(`edit:pages`)')
      q-btn.acrylic-btn.q-ml-md(
        flat
        icon='las la-edit'
        color='deep-orange-9'
        :label='t(`common.actions.edit`)'
        :aria-label='t(`common.actions.edit`)'
        no-caps
        @click='editPage'
      )
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

import IconPickerDialog from 'src/components/IconPickerDialog.vue'
import SocialSharingMenu from 'src/components/SocialSharingMenu.vue'

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

function openEditorSettings () {
  EVENT_BUS.emit('openEditorSettings')
}

async function discardChanges () {
  // From create mode
  if (editorStore.mode === 'create') {
    editorStore.$patch({
      isActive: false,
      editor: ''
    })

    // Is it the home page in create mode?
    if ((pageStore.path === '' || pageStore.path === 'home') && pageStore.locale === 'en') {
      siteStore.overlay = 'Welcome'
    }

    router.replace('/')
    return
  }

  const hadPendingChanges = editorStore.hasPendingChanges

  $q.loading.show()
  try {
    editorStore.$patch({
      isActive: false,
      editor: ''
    })
    await pageStore.cancelPageEdit()
    if (hadPendingChanges) {
      $q.notify({
        type: 'positive',
        message: 'Page has been reverted to the last saved state.'
      })
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to reload page state.'
    })
  }
  $q.loading.hide()
}

async function saveChanges (closeAfter = false) {
  if (siteStore.features.reasonForChange !== 'off') {
    $q.dialog({
      component: defineAsyncComponent(() => import('../components/PageReasonForChangeDialog.vue')),
      componentProps: {
        required: siteStore.features.reasonForChange === 'required'
      }
    }).onOk(async ({ reason }) => {
      editorStore.$patch({
        reasonForChange: reason
      })
      saveChangesCommit(closeAfter)
    })
  } else {
    saveChangesCommit(closeAfter)
  }
}

async function saveChangesCommit (closeAfter = false) {
  await processPendingAssets()
  $q.loading.show()
  try {
    await pageStore.pageSave()
    $q.notify({
      type: 'positive',
      message: 'Page saved successfully.'
    })
    if (closeAfter) {
      editorStore.$patch({
        isActive: false,
        editor: ''
      })
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save page changes.',
      caption: err.message
    })
  }
  $q.loading.hide()
}

async function createPage () {
  // Handle home page creation flow
  if (pageStore.path === 'home') {
    await processPendingAssets()
    $q.loading.show()
    try {
      await pageStore.pageSave()
      $q.notify({
        type: 'positive',
        message: 'Homepage created successfully.'
      })
      editorStore.$patch({
        isActive: false
      })
      router.replace('/')
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: 'Failed to create homepage.',
        caption: err.message
      })
    }
    $q.loading.hide()
    return
  }

  // All other pages
  $q.dialog({
    component: defineAsyncComponent(() => import('../components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'savePage',
      folderPath: '',
      itemTitle: pageStore.title,
      itemFileName: pageStore.path
    }
  }).onOk(async ({ path, title }) => {
    await processPendingAssets()

    $q.loading.show()
    try {
      pageStore.$patch({
        title,
        path
      })
      await pageStore.pageSave()
      $q.notify({
        type: 'positive',
        message: 'Page created successfully.'
      })
      editorStore.$patch({
        isActive: false
      })
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: 'Failed to create page.',
        caption: err.message
      })
    }
    $q.loading.hide()
  })
}

async function processPendingAssets () {
  if (editorStore.pendingAssets?.length > 0) {
    return new Promise((resolve, reject) => {
      $q.dialog({
        component: defineAsyncComponent(() => import('../components/UploadPendingAssetsDialog.vue')),
        persistent: true
      }).onOk(resolve).onCancel(reject)
    })
  }
}

async function editPage () {
  $q.loading.show()
  await pageStore.pageEdit()
  $q.loading.hide()
}

function printPage () {
  window.print()
}
</script>
