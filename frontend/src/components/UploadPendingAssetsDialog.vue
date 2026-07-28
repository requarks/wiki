<template>
  <w-dialog v-model="dialogVisible" max-width="450px" persistent @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-upload.svg" size="sm" class="mr-2" />
        <span>{{ t(`editor.pendingAssetsUploading`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="p-4 text-center">
          <img src="/_assets/illustrations/undraw_upload.svg" style="width: 150px" />
        </div>
        <w-linear-progress indeterminate size="lg" rounded />
        <div class="mt-2 text-center text-caption">{{ state.current }} / {{ state.total }}</div>
      </w-card-section>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { computed, onMounted, reactive } from 'vue'

import { useEditorStore } from '@/stores/editor'
import { useSiteStore } from '@/stores/site'
import { usePageStore } from '@/stores/page'

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  current: 1,
  total: 1
})

// MOUNTED

onMounted(async () => {
  state.total = editorStore.pendingAssets.length ?? 0
  state.current = 0

  await new Promise((resolve) => setTimeout(resolve, 500))

  try {
    for (const item of editorStore.pendingAssets) {
      state.current++
      // -> The body is the file itself rather than a multipart form, and the locale is left to the
      //    server, which uses the site's primary one
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/assets`, {
        searchParams: {
          fileName: item.fileName
          // TODO: Upload to page specific folder
        },
        headers: {
          'content-type': item.file.type || 'application/octet-stream'
        },
        body: item.file
      }).json()
      if (resp?.ok === false) {
        throw new Error(resp.message || 'An unexpected error occured.')
      }
      // -> The stored name is not always the one asked for: a file already in the folder gets the
      //    next free `name-1.ext`, and the content has to point at what was actually stored
      const storedPath = resp?.asset?.folderPath
        ? `${resp.asset.folderPath}/${resp.asset.fileName}`
        : resp?.asset?.fileName
      pageStore.content = pageStore.content.replaceAll(item.blobUrl, `/${storedPath}`)
      URL.revokeObjectURL(item.blobUrl)
    }
    editorStore.pendingAssets = []
    EVENT_BUS.emit('reloadEditorContent')
    onDialogOK()
  } catch (err) {
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: apiMessage || err.message
    })
    onDialogCancel()
  }
})
</script>
