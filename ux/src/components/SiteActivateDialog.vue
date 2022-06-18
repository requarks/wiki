<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-shutdown.svg', left, size='sm')
      span {{props.targetState ? t(`admin.sites.activate`) : t(`admin.sites.deactivate`)}}
    q-card-section
      .text-body2
        i18n-t(:keypath='props.targetState ? `admin.sites.activateConfirm` : `admin.sites.deactivateConfirm`')
          template(v-slot:siteTitle)
            strong {{props.site.title}}
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
        :label='props.targetState ? t(`common.actions.activate`) : t(`common.actions.deactivate`)'
        :color='props.targetState ? `positive` : `negative`'
        padding='xs md'
        @click='confirm'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import cloneDeep from 'lodash/cloneDeep'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive, ref } from 'vue'

import { useAdminStore } from '../stores/admin'

// PROPS

const props = defineProps({
  site: {
    type: Object,
    required: true
  },
  targetState: {
    type: Boolean,
    default: false
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
        mutation updateSite (
          $id: UUID!
          $newState: Boolean
          ) {
          updateSite(
            id: $id
            patch: {
              isEnabled: $newState
            }
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: props.site.id,
        newState: props.targetState
      }
    })
    if (resp?.data?.updateSite?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.sites.updateSuccess')
      })
      adminStore.$patch({
        sites: adminStore.sites.map(s => {
          if (s.id === props.site.id) {
            const ns = cloneDeep(s)
            ns.isEnabled = props.targetState
            return ns
          } else {
            return s
          }
        })
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.updateSite?.operation?.message || 'An unexpected error occured.')
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
