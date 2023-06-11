<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-downloading-updates.svg', left, size='sm')
      span {{t(`admin.system.checkingForUpdates`)}}
    q-card-section
      .q-pa-md.text-center
        img(src='/_assets/illustrations/undraw_going_up.svg', style='width: 150px;')
      template(v-if='state.isLoading')
        q-linear-progress(
          indeterminate
          size='lg'
          rounded
          )
        .q-mt-sm.text-center.text-caption {{ $t('admin.system.fetchingLatestVersionInfo') }}
      template(v-else)
        .text-center
          strong.text-positive(v-if='isLatest') {{ $t('admin.system.runningLatestVersion') }}
          strong.text-pink(v-else) {{ $t('admin.system.newVersionAvailable') }}
          .text-body2.q-mt-md Current: #[strong {{ state.current }}]
          .text-body2 Latest: #[strong {{ state.latest }}]
          .text-body2 Release Date: #[strong {{ state.latestDate }}]
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='state.isLoading ? t(`common.actions.cancel`) : t(`common.actions.close`)'
        color='grey'
        padding='xs md'
        @click='onDialogCancel'
        )
      q-btn(
        v-if='state.canUpgrade'
        unelevated
        :label='t(`admin.system.upgrade`)'
        color='primary'
        padding='xs md'
        @click='upgrade'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, onMounted, reactive } from 'vue'
import { DateTime } from 'luxon'

import { useUserStore } from 'src/stores/user'

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// STORES

const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isLoading: false,
  canUpgrade: false,
  current: '',
  latest: '',
  latestDate: ''
})

const isLatest = computed(() => {
  return true
})

// METHODS

async function check () {
  state.isLoading = true
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation checkForUpdates {
          checkForUpdates {
            operation {
              succeeded
              message
            }
            current
            latest
            latestDate
          }
        }
      `
    })
    if (resp?.data?.checkForUpdates?.operation?.succeeded) {
      state.current = resp?.data?.checkForUpdates?.current
      state.latest = resp?.data?.checkForUpdates?.latest
      state.latestDate = DateTime.fromISO(resp?.data?.checkForUpdates?.latestDate).toFormat(userStore.preferredDateFormat)
    } else {
      throw new Error(resp?.data?.checkForUpdates?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
    onDialogCancel()
  }
  state.isLoading = false
}

// MOUNTED

onMounted(() => {
  check()
})
</script>
