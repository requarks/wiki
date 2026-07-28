<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 450px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-plus-plus.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.sites.new`) }}</span>
      </w-card-section>
      <w-form ref="createSiteForm" class="py-2">
        <w-item>
          <blueprint-icon icon="home" />
          <w-item-section>
            <w-input
              v-model="state.siteName"
              outlined
              dense
              :rules="siteNameValidation"
              hide-bottom-space
              :label="t(`common.field.name`)"
              lazy-rules="ondemand"
              autofocus />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="dns" class="self-start" />
          <w-item-section>
            <w-input
              v-model="state.siteHostname"
              outlined
              dense
              :rules="siteHostnameValidation"
              :hint="t(`admin.sites.hostnameHint`)"
              hide-bottom-space
              :label="t(`admin.sites.hostname`)"
              lazy-rules="ondemand" />
          </w-item-section>
        </w-item>
      </w-form>
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
          :label="t(`common.actions.create`)"
          color="primary"
          padding="xs md"
          :loading="state.isLoading"
          @click="create" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { reactive, ref } from 'vue'

import { useAdminStore } from '../stores/admin'

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
  siteName: '',
  siteHostname: 'wiki.example.com',
  isLoading: false
})

// REFS

const createSiteForm = ref(null)

// VALIDATION RULES

const siteNameValidation = [
  (val) => val.length > 0 || t('admin.sites.nameMissing'),
  (val) => /^[^<>"]+$/.test(val) || t('admin.sites.nameInvalidChars')
]
const siteHostnameValidation = [
  (val) => val.length > 0 || t('admin.sites.hostnameMissing'),
  (val) => /^(\\*)|([a-z0-9\-.:]+)$/.test(val) || t('admin.sites.hostnameInvalidChars')
]

// METHODS

async function create() {
  state.isLoading = true
  try {
    const isFormValid = await createSiteForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.sites.createInvalidData'))
    }
    const resp = await API_CLIENT.post('sites', {
      json: {
        hostname: state.siteHostname,
        title: state.siteName
      }
    }).json()
    if (resp?.ok) {
      notify({
        type: 'positive',
        message: t('admin.sites.createSuccess')
      })
      await adminStore.fetchSites()
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
