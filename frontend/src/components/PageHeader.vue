<template>
  <div class="page-header flex flex-wrap">
    <!-- PAGE ICON -->
    <div class="flex-none pl-4 flex items-center">
      <w-btn
        class="rounded"
        v-if="editorStore.isActive"
        padding="none"
        size="37px"
        color="primary"
        flat
        :aria-label="t(`editor.props.icon`)">
        <w-icon :name="pageStore.icon" size="37px" />
        <w-badge color="grey" floating rounded>
          <w-icon name="la:pen" size="xs" padding="xs xs" />
        </w-badge>
        <w-menu content-class="shadow-7"><icon-picker-dialog v-model="pageStore.icon" /></w-menu>
      </w-btn>
      <w-icon class="rounded" v-else :name="pageStore.icon" size="64px" color="primary" />
    </div>
    <!-- PAGE HEADER -->
    <div class="min-w-0 flex-1 p-4">
      <div class="text-h4 page-header-title">
        <span>{{pageStore.title}}</span>
        <template v-if="editorStore.isActive">
          <span class="text-grey" v-if="!pageStore.title">{{ t(`editor.props.title`)}}</span>
          <w-btn class="acrylic-btn ml-4" icon="la:pen" flat padding="xs" size="sm">
            <w-popup-edit v-model="pageStore.title" auto-save v-slot="scope">
              <w-input
                outlined
                style="width: 450px;"
                v-model="scope.value"
                dense
                autofocus
                @keyup.enter="scope.set"
                :label="t(`editor.props.title`)" />
            </w-popup-edit>
          </w-btn>
        </template>
      </div>
      <div class="text-subtitle2 page-header-subtitle">
        <span>{{ pageStore.description }}</span>
        <template v-if="editorStore.isActive">
          <span class="text-grey" v-if="!pageStore.description">{{ t(`editor.props.shortDescription`)}}</span>
          <w-btn class="acrylic-btn ml-4" icon="la:pen" flat padding="none xs" size="xs">
            <w-popup-edit v-model="pageStore.description" auto-save v-slot="scope">
              <w-input
                outlined
                style="width: 450px;"
                v-model="scope.value"
                dense
                autofocus
                @keyup.enter="scope.set"
                :label="t(`editor.props.shortDescription`)" />
            </w-popup-edit>
          </w-btn>
        </template>
      </div>
    </div>
    <!-- PAGE ACTIONS -->
    <div class="flex-none p-4 flex items-center justify-end">
      <template v-if="!editorStore.isActive">
        <w-btn
          class="ml-4"
          v-if="userStore.authenticated"
          flat
          dense
          icon="la:bell"
          color="grey"
          aria-label="Watch Page"
          @click="notImplemented">
          <w-tooltip>Watch Page</w-tooltip>
        </w-btn>
        <w-btn
          class="ml-4"
          v-if="userStore.authenticated"
          flat
          dense
          icon="la:bookmark"
          color="grey"
          aria-label="Bookmark Page"
          @click="notImplemented">
          <w-tooltip>Bookmark Page</w-tooltip>
        </w-btn>
        <w-btn
          class="ml-4"
          v-if="siteStore.theme.showSharingMenu"
          flat
          dense
          icon="la:share-alt"
          color="grey"
          aria-label="Share">
          <w-tooltip>Share</w-tooltip>
          <social-sharing-menu />
        </w-btn>
        <w-btn
          class="ml-4"
          v-if="siteStore.theme.showPrintBtn"
          flat
          dense
          icon="la:print"
          color="grey"
          aria-label="Print"
          @click="printPage">
          <w-tooltip>Print</w-tooltip>
        </w-btn>
      </template>
      <template v-if="editorStore.isActive">
        <w-btn
          class="ml-4 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :href="siteStore.docsBase + `/editor/${editorStore.editor}`"
          target="_blank"
          type="a">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="ml-2 acrylic-btn"
          icon="la:cog"
          flat
          color="grey"
          :aria-label="t(`editor.settings`)"
          @click="openEditorSettings">
          <w-tooltip>{{ t(`editor.settings`) }}</w-tooltip>
        </w-btn>
      </template>
      <template v-if="editorStore.isActive || editorStore.hasPendingChanges">
        <w-btn
          class="acrylic-btn ml-2"
          flat
          icon="la:times"
          color="negative"
          :label="editorStore.hasPendingChanges ? t(`common.actions.discard`) : t(`common.actions.close`)"
          :aria-label="editorStore.hasPendingChanges ? t(`common.actions.discard`) : t(`common.actions.close`)"
          no-caps
          @click="discardChanges" />
        <w-btn
          class="acrylic-btn ml-2"
          v-if="editorStore.mode === `create`"
          flat
          icon="la:check"
          color="positive"
          :label="t(`editor.createPage`)"
          :aria-label="t(`editor.createPage`)"
          no-caps
          @click="createPage" />
        <w-btn-group class="ml-2" v-else flat>
          <w-btn
            class="acrylic-btn"
            flat
            icon="la:check"
            color="positive"
            :label="t(`common.actions.saveChanges`)"
            :aria-label="t(`common.actions.saveChanges`)"
            :disabled="!editorStore.hasPendingChanges"
            no-caps
            @click.exact="saveChanges(false)"
            @click.ctrl.exact="saveChanges(true)" />
          <template v-if="editorStore.isActive">
            <w-separator vertical dark />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:check-double"
              color="positive"
              :aria-label="t(`common.actions.saveAndClose`)"
              :disabled="!editorStore.hasPendingChanges"
              @click="saveChanges(true)">
              <w-tooltip>{{ t(`common.actions.saveAndClose`) }}</w-tooltip>
            </w-btn>
          </template>
        </w-btn-group>
      </template>
      <template v-else-if="userStore.can(`edit:pages`)">
        <w-btn
          class="acrylic-btn ml-4"
          flat
          icon="la:edit"
          color="deep-orange-9"
          :label="t(`common.actions.edit`)"
          :aria-label="t(`common.actions.edit`)"
          no-caps
          @click="editPage" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { dialog } from '@/composables/dialog'
import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'

import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import IconPickerDialog from '@/components/IconPickerDialog.vue'
import SocialSharingMenu from '@/components/SocialSharingMenu.vue'


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

function openEditorSettings() {
  EVENT_BUS.emit('openEditorSettings')
}

async function discardChanges() {
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

  loading.show()
  try {
    editorStore.$patch({
      isActive: false,
      editor: ''
    })
    await pageStore.cancelPageEdit()
    if (hadPendingChanges) {
      notify({
        type: 'positive',
        message: 'Page has been reverted to the last saved state.'
      })
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to reload page state.'
    })
  }
  loading.hide()
}

async function saveChanges(closeAfter = false) {
  if (siteStore.features.reasonForChange !== 'off') {
    dialog({
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

async function saveChangesCommit(closeAfter = false) {
  await processPendingAssets()
  loading.show()
  try {
    await pageStore.pageSave()
    notify({
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
    notify({
      type: 'negative',
      message: 'Failed to save page changes.',
      caption: err.message
    })
  }
  loading.hide()
}

async function createPage() {
  // Handle home page creation flow
  if (pageStore.path === 'home') {
    await processPendingAssets()
    loading.show()
    try {
      await pageStore.pageSave()
      notify({
        type: 'positive',
        message: 'Homepage created successfully.'
      })
      editorStore.$patch({
        isActive: false
      })
      router.replace('/')
    } catch (err) {
      notify({
        type: 'negative',
        message: 'Failed to create homepage.',
        caption: err.message
      })
    }
    loading.hide()
    return
  }

  // All other pages
  dialog({
    component: defineAsyncComponent(() => import('../components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'savePage',
      folderPath: '',
      itemTitle: pageStore.title,
      itemFileName: pageStore.path
    }
  }).onOk(async ({ path, title }) => {
    await processPendingAssets()

    loading.show()
    try {
      pageStore.$patch({
        title,
        path
      })
      await pageStore.pageSave()
      notify({
        type: 'positive',
        message: 'Page created successfully.'
      })
      editorStore.$patch({
        isActive: false
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: 'Failed to create page.',
        caption: err.message
      })
    }
    loading.hide()
  })
}

async function processPendingAssets() {
  if (editorStore.pendingAssets?.length > 0) {
    return new Promise((resolve, reject) => {
      dialog({
        component: defineAsyncComponent(
          () => import('../components/UploadPendingAssetsDialog.vue')
        ),
        persistent: true
      })
        .onOk(resolve)
        .onCancel(reject)
    })
  }
}

async function editPage() {
  loading.show()
  await pageStore.pageEdit()
  loading.hide()
}

function printPage() {
  window.print()
}

function notImplemented() {
  notify({
    type: 'negative',
    message: 'Not implemented'
  })
}
</script>
