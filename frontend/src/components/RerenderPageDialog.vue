<template>
  <w-dialog v-model="dialogVisible" position="bottom" persistent @hide="onDialogHide">
    <w-card style="width: 350px">
      <w-linear-progress query />
      <w-card-section class="text-center">
        {{ t('renderPageDialog.loading') }}
      </w-card-section>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  id: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS

async function rerenderPage() {
  await new Promise((resolve) => setTimeout(resolve, 1000)) // allow for dialog to show
  try {
    // -> Answers 202: rendering means a headless browser on the server, so the page joins a queue that
    //    is drained one page at a time and there is no new render to show yet
    await API_CLIENT.post(`sites/${siteStore.id}/pages/${props.id}/render`)
    notify({
      type: 'positive',
      message: t('renderPageDialog.queued')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — without the Puppeteer extension the server answers 503, since it has
    //    no way to run the renderer, and saying so is the whole point of showing this
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
    onDialogCancel()
  }
}

// MOUNTED

onMounted(() => {
  rerenderPage()
})
</script>
