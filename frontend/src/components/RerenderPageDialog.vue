<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide' position='bottom', persistent)
  q-card(style='width: 350px;')
    q-linear-progress(query, color='page')
    q-card-section.text-center {{ t('renderPageDialog.loading') }}
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { onMounted } from 'vue'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  id: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS

async function rerenderPage () {
  await new Promise(resolve => setTimeout(resolve, 1000)) // allow for dialog to show
  try {
    const resp = await API_CLIENT.post(`sites/${siteStore.id}/pages/${props.id}/render`).json()
    // -> The page currently on screen is the one that was re-rendered, so show the new render rather
    //    than leaving the stale one until the next navigation
    if (resp?.page?.id === pageStore.id) {
      pageStore.$patch({
        render: resp.page.render,
        toc: resp.page.toc
      })
    }
    $q.notify({
      type: 'positive',
      message: t('renderPageDialog.success')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — without the Puppeteer extension the server answers 503, since it has
    //    no way to run the renderer
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
    onDialogCancel()
  }
}

// MOUNTED

onMounted(() => {
  rerenderPage()
})
</script>
