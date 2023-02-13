<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 850px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/ultraviolet-markdown.svg', left, size='sm')
      span {{t(`admin.editors.markdownName`)}}
    q-card-section.q-pa-none
      span Test
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
        :loading='state.loading > 0'
        )

    q-inner-loading(:showing='state.loading > 0')
      q-spinner(color='accent', size='lg')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive, ref } from 'vue'

import { useAdminStore } from '../stores/admin'

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
  config: [],
  loading: 0
})

// METHODS

async function save () {

}
</script>
