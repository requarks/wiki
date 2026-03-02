<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide', persistent)
  q-card(style='min-width: 600px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-key-2.svg', left, size='sm')
      span {{t(`admin.api.copyKeyTitle`)}}
    q-card-section.card-negative
      i18n-t(tag='span', keypath='admin.api.newKeyCopyWarn', scope='global')
        template(#bold)
          strong {{t('admin.api.newKeyCopyWarnBold')}}
    q-form.q-py-sm
      q-item
        blueprint-icon.self-start(icon='binary-file')
        q-item-section
          q-input(
            type='textarea'
            outlined
            :model-value='props.keyValue'
            dense
            hide-bottom-space
            :label='t(`admin.api.key`)'
            :aria-label='t(`admin.api.key`)'
            autofocus
            )
    q-card-actions.card-actions
      q-space
      q-btn(
        unelevated
        :label='t(`common.actions.close`)'
        color='primary'
        padding='xs md'
        @click='onDialogOK'
        )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'

// PROPS

const props = defineProps({
  keyValue: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent()
const $q = useQuasar()

// I18N

const { t } = useI18n()
</script>
