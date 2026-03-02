<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide', persistent)
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-add-key.svg', left, size='sm')
      span {{t(`profile.passkeysAdd`)}}
    .q-py-sm
      .text-body2.q-px-md.q-py-sm {{t(`profile.passkeysNameHint`)}}
      q-item
        blueprint-icon(icon='key')
        q-item-section
          q-input(
            outlined
            v-model='state.name'
            dense
            hide-bottom-space
            :label='t(`profile.passkeysName`)'
            :aria-label='t(`profile.passkeysName`)'
            autofocus
            @keyup.enter='save'
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
        :label='t(`common.actions.save`)'
        color='primary'
        padding='xs md'
        @click='save'
        )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive } from 'vue'

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
  name: ''
})

// METHODS

async function save () {
  try {
    if (!state.name || state.name.trim().length < 1 || state.name.length > 255) {
      throw new Error(t('profile.passkeysInvalidName'))
    }
    onDialogOK({
      name: state.name
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
}
</script>
