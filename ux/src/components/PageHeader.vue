<template lang="pug">
.page-header-clean(v-if='!editorStore.isActive')
  .page-header-row
    .page-header-text
      h1.page-header-title {{ pageStore.title }}
      p.page-header-desc(v-if='pageStore.description') {{ pageStore.description }}
    q-btn.page-header-edit(
      v-if='userStore.authenticated && userStore.can(`write:pages`)'
      flat
      no-caps
      icon='las la-edit'
      label='Editar'
      color='primary'
      size='sm'
      style='border-radius: 8px; padding: 4px 14px;'
      @click='editPage'
    )
.page-header.row(v-else)
  .col-auto.q-pl-md.flex.items-center
    q-icon.rounded-borders(:name='pageStore.icon' size='64px' color='primary')
  .col.q-pa-md
    .text-h4.page-header-title
      span {{pageStore.title}}
      q-btn.acrylic-btn.q-ml-md(icon='las la-pen' flat padding='xs' size='sm')
        q-popup-edit(v-model='pageStore.title' auto-save v-slot='scope')
          q-input(outlined style='width: 450px;' v-model='scope.value' dense autofocus @keyup.enter='scope.set' :label='t(`editor.props.title`)')
    .text-subtitle2.page-header-subtitle
      span {{ pageStore.description }}
      q-btn.acrylic-btn.q-ml-md(icon='las la-pen' flat padding='none xs' size='xs')
        q-popup-edit(v-model='pageStore.description' auto-save v-slot='scope')
          q-input(outlined style='width: 450px;' v-model='scope.value' dense autofocus @keyup.enter='scope.set' :label='t(`editor.props.shortDescription`)')
  .col-auto.q-pa-md.flex.items-center.justify-end
    q-btn.acrylic-btn.q-ml-sm(flat icon='las la-question-circle' color='grey' :href='siteStore.docsBase + `/editor/${editorStore.editor}`' target='_blank' type='a')
    q-btn.acrylic-btn.q-ml-sm(flat icon='las la-cog' color='grey' @click='openEditorSettings')
    q-btn.acrylic-btn.q-ml-sm(flat icon='las la-times' color='negative' :label='editorStore.hasPendingChanges ? t(`common.actions.discard`) : t(`common.actions.close`)' no-caps @click='discardChanges')
    q-btn-group.q-ml-sm(v-if='editorStore.mode !== `create`' flat)
      q-btn.acrylic-btn(flat icon='las la-check' color='positive' :label='t(`common.actions.saveChanges`)' :disabled='!editorStore.hasPendingChanges' no-caps @click.exact='saveChanges(false)' @click.ctrl.exact='saveChanges(true)')
      q-separator(vertical dark)
      q-btn.acrylic-btn(flat icon='las la-check-double' color='positive' :disabled='!editorStore.hasPendingChanges' @click='saveChanges(true)')
    q-btn.acrylic-btn.q-ml-sm(v-else flat icon='las la-check' color='positive' :label='t(`editor.createPage`)' no-caps @click='createPage')
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

const $q = useQuasar()
const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

function openEditorSettings () { EVENT_BUS.emit('openEditorSettings') }

async function discardChanges () {
  if (editorStore.mode === 'create') {
    editorStore.$patch({ isActive: false, editor: '' })
    if ((pageStore.path === '' || pageStore.path === 'home') && pageStore.locale === 'en') {
      siteStore.overlay = 'Welcome'
    }
    router.replace('/')
    return
  }
  const hadPendingChanges = editorStore.hasPendingChanges
  $q.loading.show()
  try {
    editorStore.$patch({ isActive: false, editor: '' })
    await pageStore.cancelPageEdit()
    if (hadPendingChanges) { $q.notify({ type: 'positive', message: 'Page reverted.' }) }
  } catch (err) { $q.notify({ type: 'negative', message: 'Failed to reload.' }) }
  $q.loading.hide()
}

async function saveChanges (closeAfter = false) {
  if (siteStore.features.reasonForChange !== 'off') {
    $q.dialog({
      component: defineAsyncComponent(() => import('../components/PageReasonForChangeDialog.vue')),
      componentProps: { required: siteStore.features.reasonForChange === 'required' }
    }).onOk(async ({ reason }) => {
      editorStore.$patch({ reasonForChange: reason })
      saveChangesCommit(closeAfter)
    })
  } else { saveChangesCommit(closeAfter) }
}

async function saveChangesCommit (closeAfter = false) {
  $q.loading.show()
  try {
    await pageStore.pageSave()
    $q.notify({ type: 'positive', message: 'Page saved.' })
    if (closeAfter) { editorStore.$patch({ isActive: false, editor: '' }) }
  } catch (err) { $q.notify({ type: 'negative', message: 'Save failed.', caption: err.message }) }
  $q.loading.hide()
}

async function createPage () {
  if (pageStore.path === 'home') {
    $q.loading.show()
    try {
      await pageStore.pageSave()
      $q.notify({ type: 'positive', message: 'Homepage created.' })
      editorStore.$patch({ isActive: false })
      router.replace('/')
    } catch (err) { $q.notify({ type: 'negative', message: 'Failed.', caption: err.message }) }
    $q.loading.hide()
    return
  }
  $q.dialog({
    component: defineAsyncComponent(() => import('../components/TreeBrowserDialog.vue')),
    componentProps: { mode: 'savePage', folderPath: '', itemTitle: pageStore.title, itemFileName: pageStore.path }
  }).onOk(async ({ path, title }) => {
    $q.loading.show()
    try {
      pageStore.$patch({ title, path })
      await pageStore.pageSave()
      $q.notify({ type: 'positive', message: 'Page created.' })
      editorStore.$patch({ isActive: false })
    } catch (err) { $q.notify({ type: 'negative', message: 'Failed.', caption: err.message }) }
    $q.loading.hide()
  })
}

async function editPage () {
  $q.loading.show()
  await pageStore.pageEdit()
  $q.loading.hide()
}

function printPage () { window.print() }
</script>

<style lang="scss">
.page-header-clean {
  padding: 32px 32px 0;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}

.page-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-header-text {
  flex: 1;
}

.page-header-edit {
  flex-shrink: 0;
  margin-top: 4px;
}

.page-header-title {
  font-size: 2rem;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -0.5px;
  margin: 0 !important;
  border: none !important;
  padding: 0 !important;
}

.page-header-desc {
  font-size: 0.95rem;
  color: #64748B;
  margin: 4px 0 0 !important;
  line-height: 1.5;
}
</style>
