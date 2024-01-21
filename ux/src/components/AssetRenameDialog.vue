<template lang='pug'>
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-rename.svg', left, size='sm')
      span {{ t(`fileman.assetRename`) }}
    q-form.q-py-sm(@submit='rename')
      q-item
        blueprint-icon.self-start(icon='image')
        q-item-section
          q-input(
            autofocus
            outlined
            v-model='state.path'
            dense
            hide-bottom-space
            :label='t(`fileman.assetFileName`)'
            :aria-label='t(`fileman.assetFileName`)'
            :hint='t(`fileman.assetFileNameHint`)'
            lazy-rules='ondemand'
            @keyup.enter='rename'
            )
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
        :label='t(`common.actions.rename`)'
        color='primary'
        padding='xs md'
        @click='rename'
        :loading='state.loading > 0'
        )
    q-inner-loading(:showing='state.loading > 0')
      q-spinner(color='accent', size='lg')
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { onMounted, reactive, ref } from 'vue'

// PROPS

const props = defineProps({
  assetId: {
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

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  path: '',
  loading: false
})

// METHODS

async function rename () {
  state.loading++
  try {
    if (state.path?.length < 2 || !state.path?.includes('.')) {
      throw new Error(t('fileman.renameAssetInvalid'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation renameAsset (
          $id: UUID!
          $fileName: String!
          ) {
          renameAsset (
            id: $id
            fileName: $fileName
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: props.assetId,
        fileName: state.path
      }
    })
    if (resp?.data?.renameAsset?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('fileman.renameAssetSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.renameAsset?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(async () => {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query fetchAssetForRename (
          $id: UUID!
          ) {
          assetById (
            id: $id
            ) {
            id
            fileName
          }
        }
      `,
      fetchPolicy: 'network-only',
      variables: {
        id: props.assetId
      }
    })
    if (resp?.data?.assetById?.id !== props.assetId) {
      throw new Error('Failed to fetch asset data.')
    }
    state.path = resp.data.assetById.fileName
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
    onDialogCancel()
  }
  state.loading--
})
</script>
