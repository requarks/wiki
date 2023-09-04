<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide' position='bottom', persistent)
  q-card(style='width: 350px;')
    q-linear-progress(query, color='page')
    q-card-section.text-center {{ t('renderPageDialog.loading') }}
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, onMounted, reactive } from 'vue'
import { usePageStore } from 'src/stores/page'

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// STORES

const pageStore = usePageStore()

// I18N

const { t } = useI18n()

// METHODS

async function rerenderPage () {
  await new Promise(resolve => setTimeout(resolve, 1000)) // allow for dialog to show
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation rerenderPage(
          $id: UUID!
        ) {
          rerenderPage (
            id: $id
          ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: pageStore.id
      }
    })
    if (resp?.data?.rerenderPage?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('renderPageDialog.success')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.rerenderPage?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
    onDialogCancel()
  }
}

// MOUNTED

onMounted(() => {
  rerenderPage()
})
</script>
