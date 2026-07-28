<template>
  <w-dialog v-model="dialogVisible" max-width="450px" @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon
          name="img:/_assets/icons/fluent-downloading-updates.svg"
          size="sm"
          class="mr-2" />
        <span>{{ t(`admin.system.checkingForUpdates`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="p-4 text-center">
          <img src="/_assets/illustrations/undraw_going_up.svg" style="width: 150px" />
        </div>
        <template v-if="state.isLoading">
          <w-linear-progress indeterminate size="lg" rounded />
          <div class="mt-2 text-center text-caption">
            {{ $t('admin.system.fetchingLatestVersionInfo') }}
          </div>
        </template>
        <template v-else>
          <div class="text-center">
            <strong v-if="isLatest" class="text-positive">{{
              $t('admin.system.runningLatestVersion')
            }}</strong>
            <strong v-else class="text-pink">{{ $t('admin.system.newVersionAvailable') }}</strong>
            <div class="text-body2 mt-4">
              Current: <strong>{{ state.current }}</strong>
            </div>
            <div class="text-body2">
              Latest: <strong>{{ state.latest }}</strong>
            </div>
            <div class="text-body2">
              Release Date: <strong>{{ state.latestDate }}</strong>
            </div>
          </div>
        </template>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="state.isLoading ? t(`common.actions.cancel`) : t(`common.actions.close`)"
          color="grey"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          v-if="state.canUpgrade"
          unelevated
          :label="t(`admin.system.upgrade`)"
          color="primary"
          padding="xs md"
          :loading="state.isLoading"
          @click="upgrade" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { computed, onMounted, reactive } from 'vue'
import { DateTime } from 'luxon'

import { useUserStore } from '@/stores/user'

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

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

async function check() {
  state.isLoading = true
  try {
    const resp = await API_CLIENT.post('system/checkForUpdate').json()
    if (resp?.current) {
      state.current = resp.current
      state.latest = resp.latest
      state.latestDate = DateTime.fromISO(resp.latestDate).toFormat(userStore.preferredDateFormat)
    } else {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    notify({
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
