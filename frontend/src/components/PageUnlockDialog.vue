<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 450px; max-width: 90vw">
      <w-card-section class="card-header">
        <w-icon name="la:lock" size="sm" class="mr-2" />
        <span>{{ t('common.page.unlockTitle') }}</span>
      </w-card-section>
      <w-form ref="unlockForm" class="py-2" @submit="unlock">
        <w-item>
          <blueprint-icon icon="key" />
          <w-item-section>
            <w-input
              ref="iptPassword"
              v-model="state.password"
              outlined
              dense
              type="password"
              autocomplete="current-password"
              revealable
              hide-bottom-space
              :label="t(`auth.fields.password`)"
              :rules="passwordValidation"
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
          icon="la:lock-open"
          :label="t(`common.page.unlock`)"
          color="primary"
          padding="xs md"
          :loading="state.isLoading"
          @click="unlock" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'

/**
 * Prompts for a password-protected page's password and asks the server to open it.
 *
 * Confirming resolves the dialog only once the server has accepted the password and the page store
 * holds the content — so whoever opened this can take `ok` to mean the page is readable, and a wrong
 * guess leaves the prompt up to try again.
 */

// EMITS

defineEmits([...dialogComponentEmits])

// REFS

const iptPassword = ref(null)
const unlockForm = ref(null)

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptPassword.value
})

// STORES

const pageStore = usePageStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  password: '',
  isLoading: false
})

// VALIDATION RULES

const passwordValidation = [(val) => val.length > 0 || t('auth.errors.missingPassword')]

// METHODS

async function unlock() {
  state.isLoading = true
  try {
    if (!(await unlockForm.value.validate(true))) {
      throw new Error(t('auth.errors.missingPassword'))
    }
    await pageStore.pageUnlock(state.password)
    onDialogOK()
  } catch (err) {
    notify({
      type: 'negative',
      // -> A rejected password is the expected outcome here, not a failure to report as one
      message: err.response?.status === 401 ? t('common.page.lockedWrongPassword') : err.message
    })
    // -> Cleared and refocused, because the next thing a reader does is type it again
    state.password = ''
    iptPassword.value?.focus()
  }
  state.isLoading = false
}
</script>
