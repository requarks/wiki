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
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, onMounted, reactive } from 'vue'

import { useEditorStore } from 'src/stores/editor'
import { useSiteStore } from 'src/stores/site'
import { usePageStore } from 'src/stores/page'

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
      const resp = await APOLLO_CLIENT.mutate({
        context: {
          uploadMode: true
        },
        mutation: gql`
          mutation uploadAssets (
            $folderId: UUID
            $locale: String
            $siteId: UUID
            $files: [Upload!]!
          ) {
            uploadAssets (
              folderId: $folderId
              locale: $locale
              siteId: $siteId
              files: $files
            ) {
              operation {
                succeeded
                message
              }
            }
          }
        `,
        variables: {
          folderId: null, // TODO: Upload to page specific folder
          siteId: siteStore.id,
          locale: 'en', // TODO: use current locale
          files: [item.file]
        }
      })
      if (!resp?.data?.uploadAssets?.operation?.succeeded) {
        throw new Error(resp?.data?.uploadAssets?.operation?.message || 'An unexpected error occured.')
      }
      pageStore.content = pageStore.content.replaceAll(item.blobUrl, `/${item.fileName}`)
      URL.revokeObjectURL(item.blobUrl)
    }
    editorStore.pendingAssets = []
    EVENT_BUS.emit('reloadEditorContent')
    onDialogOK()
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
    onDialogCancel()
  }
})
</script>
