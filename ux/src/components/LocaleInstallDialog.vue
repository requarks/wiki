<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 850px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-down.svg', left, size='sm')
      span {{t(`admin.locale.downloadTitle`)}}
    q-card-section.q-pa-none
      q-table.no-border-radius(
        :data='state.locales'
        :columns='headers'
        row-name='code'
        flat
        hide-bottom
        :rows-per-page-options='[0]'
        :loading='state.loading > 0'
        )
        template(v-slot:body-cell-code='props')
          q-td(:props='props')
            q-chip(
              square
              color='teal'
              text-color='white'
              dense
              ): span.text-caption {{props.value}}
        template(v-slot:body-cell-name='props')
          q-td(:props='props')
            strong {{props.value}}
        template(v-slot:body-cell-isRTL='props')
          q-td(:props='props')
            q-icon(
              v-if='props.value'
              name='las la-check'
              color='brown'
              size='xs'
              )
        template(v-slot:body-cell-availability='props')
          q-td(:props='props')
            q-circular-progress(
              size='md'
              show-value
              :value='props.value'
              :thickness='0.1'
              :color='props.value <= 33 ? `negative` : (props.value <= 66) ? `warning` : `positive`'
            ) {{ props.value }}%
        template(v-slot:body-cell-isInstalled='props')
          q-td(:props='props')
            q-spinner(
              v-if='props.row.isDownloading'
              color='primary'
              size='20px'
              :thickness='2'
              )
            q-btn(
              v-else-if='props.value && props.row.installDate < props.row.updatedAt'
              flat
              round
              dense
              @click='download(props.row)'
              icon='las la-redo-alt'
              color='accent'
              )
            q-btn(
              v-else-if='props.value'
              flat
              round
              dense
              @click='download(props.row)'
              icon='las la-check-circle'
              color='positive'
              )
            q-btn(
              v-else
              flat
              round
              dense
              @click='download(props.row)'
              icon='las la-cloud-download-alt'
              color='primary'
              )
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='t(`common.actions.close`)'
        color='grey'
        padding='xs md'
        @click='onDialogCancel'
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
  locales: [],
  loading: 0
})

const headers = [
  {
    label: t('admin.locale.code'),
    align: 'left',
    field: 'code',
    name: 'code',
    sortable: true,
    style: 'width: 90px'
  },
  {
    label: t('admin.locale.name'),
    align: 'left',
    field: 'name',
    name: 'name',
    sortable: true
  },
  {
    label: t('admin.locale.nativeName'),
    align: 'left',
    field: 'nativeName',
    name: 'nativeName',
    sortable: true
  },
  {
    label: t('admin.locale.rtl'),
    align: 'center',
    field: 'isRTL',
    name: 'isRTL',
    sortable: false,
    style: 'width: 10px'
  },
  {
    label: t('admin.locale.availability'),
    align: 'center',
    field: 'availability',
    name: 'availability',
    sortable: false,
    style: 'width: 120px'
  },
  {
    label: t('admin.locale.download'),
    align: 'center',
    field: 'isInstalled',
    name: 'isInstalled',
    sortable: false,
    style: 'width: 100px'
  }
]

// METHODS

async function download (lc) {

}
</script>
