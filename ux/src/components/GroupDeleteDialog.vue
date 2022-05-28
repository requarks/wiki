<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-delete-bin.svg', left, size='sm')
      span {{t(`admin.groups.delete`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='admin.groups.deleteConfirm')
          template(#groupName)
            strong {{props.group.name}}
      .text-body2.q-mt-md
        strong.text-negative {{t(`admin.groups.deleteConfirmWarn`)}}
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
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'

// PROPS

const props = defineProps({
  group: {
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

// I18N

const { t } = useI18n()

// METHODS

async function confirm () {
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation deleteGroup ($id: UUID!) {
          deleteGroup(id: $id) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: props.group.id
      }
    })
    if (resp?.data?.deleteGroup?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.groups.deleteSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.deleteGroup?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
}
</script>
