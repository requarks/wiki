<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide', persistent)
  q-card(style='min-width: 350px; max-width: 550px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/ultraviolet-github.svg', left, size='sm')
      span {{t(`admin.storage.githubSetupInstallApp`)}}
    q-card-section
      .text-body2 {{t(`admin.storage.githubSetupInstallAppInfo`)}}
      .text-body2.q-mt-md: strong.text-deep-orange {{t('admin.storage.githubSetupInstallAppSelect')}}
      .text-body2.q-mt-md {{t(`admin.storage.githubSetupInstallAppReturn`)}}
    q-card-actions.card-actions
      q-space
      q-btn(
        unelevated
        :label='t(`admin.storage.githubSetupContinue`)'
        color='positive'
        padding='xs md'
        @click='onDialogOK'
        )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// I18N

const { t } = useI18n()

</script>
