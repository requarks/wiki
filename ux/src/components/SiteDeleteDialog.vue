<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-delete-bin.svg', left, size='sm')
      span {{t(`admin.sites.delete`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='admin.sites.deleteConfirm')
          template(v-slot:siteTitle)
            strong {{props.site.title}}
      .text-body2.q-mt-md
        strong.text-negative {{t(`admin.sites.deleteConfirmWarn`)}}
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        @click='onDialogCancel'
        )
      q-btn(
        unelevated
        :label='t(`common.actions.delete`)'
        color='negative'
        padding='xs md'
        @click='confirm'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive } from 'vue'

import { useAdminStore } from '../stores/admin'

// PROPS

const props = defineProps({
  site: {
    type: Object,
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

const adminStore = useAdminStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isLoading: false
})

// METHODS

async function confirm () {
  state.isLoading = true
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation deleteSite ($id: UUID!) {
          deleteSite(id: $id) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: props.site.id
      }
    })
    if (resp?.data?.deleteSite?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.sites.deleteSuccess')
      })
      adminStore.$patch({
        sites: adminStore.sites.filter(s => s.id !== props.site.id)
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.deleteSite?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}
</script>
