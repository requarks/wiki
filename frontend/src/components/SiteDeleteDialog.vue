<template>
  <w-dialog v-model="dialogVisible" max-width="450px" @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-delete-bin.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.sites.delete`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">
          <i18n-t keypath="admin.sites.deleteConfirm">
            <template #siteTitle>
              <strong>{{ props.site.title }}</strong>
            </template>
          </i18n-t>
        </div>
        <div class="text-body2 mt-4">
          <strong class="text-negative">{{ t(`admin.sites.deleteConfirmWarn`) }}</strong>
        </div>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="grey"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.delete`)"
          color="negative"
          padding="xs md"
          :loading="state.isLoading"
          @click="confirm" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { reactive } from 'vue'

import { useAdminStore } from '../stores/admin'

// PROPS

const props = defineProps({
  site: {
    type: Object,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const adminStore = useAdminStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isLoading: false
})

// METHODS

async function confirm() {
  state.isLoading = true
  try {
    const resp = await API_CLIENT.delete(`sites/${props.site.id}`)
    if (resp?.ok) {
      notify({
        type: 'positive',
        message: t('admin.sites.deleteSuccess')
      })
      adminStore.$patch({
        sites: adminStore.sites.filter((s) => s.id !== props.site.id)
      })
      onDialogOK()
    } else {
      throw new Error(
        t(`admin.sites.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}
</script>
