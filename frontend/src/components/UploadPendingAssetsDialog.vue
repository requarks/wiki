<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide', persistent)
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-upload.svg', left, size='sm')
      span {{t(`editor.pendingAssetsUploading`)}}
    q-card-section
      .q-pa-md.text-center
        img(src='/_assets/illustrations/undraw_upload.svg', style='width: 150px;')
      q-linear-progress(
        indeterminate
        size='lg'
        rounded
        )
      .q-mt-sm.text-center.text-caption {{ state.current }} / {{ state.total }}
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, onMounted, reactive } from 'vue'

import { useEditorStore } from '@/stores/editor'
import { useSiteStore } from '@/stores/site'
import { usePageStore } from '@/stores/page'

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

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

  await new Promise(resolve => setTimeout(resolve, 500))

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
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
    onDialogCancel()
  }
})
</script>
