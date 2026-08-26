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
import { apiErrorMessage } from '@/helpers/apiError'
import { assetPath, pastedAssetFolder } from '@/helpers/assets'

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

  /*
    What the editor has to rewrite, collected as it goes. The editor makes these replacements against
    its own model rather than reloading the page's text, which is what keeps an upload from reading as
    a rewrite of the whole document -- see `reloadEditorContent` in `EditorMarkdown.vue`.
  */
  const replacements = []

  // -> Read once, not per file: every file in one save goes to the same place, and the page cannot
  //    move underneath this
  const folderPath = pastedAssetFolder(siteStore.uploads.pastedDestination, pageStore.folderPath)

  try {
    for (const item of editorStore.pendingAssets) {
      state.current++
      /*
        The body is the file itself rather than a multipart form.

        Addressed by path because a path is what the editor knows, and any folder in it that does not
        exist yet is created by the upload. Where that path leads is the site's to say -- see
        `pastedAssetFolder` -- and it defaults to the page's own folder. The site root is where these
        used to land regardless, which put every screenshot anybody ever pasted in one flat list beside
        the site's top-level pages.

        The locale is the page's, not the site's default: a folder belongs to one locale, so a file
        for the French page has to be filed in the French tree or it is not in the same folder at all.
      */
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/assets`, {
        searchParams: {
          fileName: item.fileName,
          locale: pageStore.locale,
          ...(folderPath ? { folderPath } : {})
        },
        headers: {
          'content-type': item.file.type || 'application/octet-stream'
        },
        body: item.file
      }).json()
      if (resp?.ok === false) {
        throw new Error(resp.message || 'An unexpected error occured.')
      }
      // -> The stored name is not always the one asked for: what happens to a file already in the
      //    folder is the site's upload conflict behavior to decide — it may be replaced, or the
      //    arrival may take the next free `name-1.ext` — so the content has to point at what the
      //    server says it stored
      const storedPath = assetPath(resp?.asset?.folderPath, resp?.asset?.fileName)
      pageStore.content = pageStore.content.replaceAll(item.blobUrl, storedPath)
      replacements.push({ from: item.blobUrl, to: storedPath })
      URL.revokeObjectURL(item.blobUrl)
    }
    editorStore.pendingAssets = []
    EVENT_BUS.emit('reloadEditorContent', { replacements })
    onDialogOK()
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
    onDialogCancel()
  }
})
</script>
