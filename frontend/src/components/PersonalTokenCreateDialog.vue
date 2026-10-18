<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-plus-plus.svg" size="sm" class="mr-2" />
        <span>{{ t(`profile.tokensNewTitle`) }}</span>
      </w-card-section>
      <w-form ref="createForm" class="py-2" @submit="create">
        <w-item>
          <blueprint-icon icon="grand-master-key" />
          <w-item-section>
            <w-input
              ref="iptName"
              v-model="state.name"
              outlined
              dense
              :rules="nameValidation"
              hide-bottom-space
              :label="t(`profile.tokensName`)"
              :hint="t(`profile.tokensNameHint`)"
              lazy-rules="ondemand" />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="schedule" />
          <w-item-section>
            <w-select
              v-model="state.expiration"
              outlined
              :options="expirations"
              map-options
              option-value="value"
              option-label="text"
              emit-value
              options-dense
              dense
              hide-bottom-space
              :label="t(`profile.tokensExpiration`)" />
          </w-item-section>
        </w-item>
      </w-form>
      <w-separator inset />
      <w-card-section class="pb-0">
        <div class="text-subtitle2">{{ t('profile.tokensScopes') }}</div>
        <div class="text-caption text-grey">{{ t('profile.tokensScopesHint') }}</div>
      </w-card-section>
      <w-list separator class="py-2">
        <w-item v-for="cat of TOKEN_SCOPE_CATEGORIES" :key="cat.key">
          <w-item-section side>
            <w-icon :name="cat.icon" />
          </w-item-section>
          <w-item-section>
            <w-item-label>{{ t(`profile.tokensScope.${cat.key}`) }}</w-item-label>
            <w-item-label caption>{{ t(`profile.tokensScopeHint.${cat.key}`) }}</w-item-label>
          </w-item-section>
          <w-item-section side>
            <w-btn-toggle
              v-model="state.scopes[cat.key]"
              push
              glossy
              no-caps
              toggle-color="primary"
              :aria-label="t(`profile.tokensScope.${cat.key}`)"
              :options="levels" />
          </w-item-section>
        </w-item>
      </w-list>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="cancel"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.create`)"
          color="primary"
          padding="xs md"
          :loading="state.loading > 0"
          @click="create" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, reactive, ref } from 'vue'

import { dialog, dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { TOKEN_SCOPE_CATEGORIES } from '@/helpers/personalTokens'

import ApiKeyCopyDialog from './ApiKeyCopyDialog.vue'

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const iptName = ref(null)
const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptName.value
})

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  name: '',
  expiration: '90d',
  // -> Nothing granted until somebody asks for it: a token is only as safe as the least it can do
  scopes: Object.fromEntries(TOKEN_SCOPE_CATEGORIES.map((cat) => [cat.key, 'none'])),
  loading: 0
})

/*
  Computed, not plain arrays: the locale strings are fetched after the app mounts, so a `t()` called
  once during `setup()` can resolve before they land and leave raw keys showing.

  The API key dialog's lifetimes, worded the same: the API takes the same values for both
  (`ApiKeyExpiration`), so the two kinds of key read alike.
*/
const expirations = computed(() => [
  { value: '7d', text: t('admin.api.expiration7d') },
  { value: '30d', text: t('admin.api.expiration30d') },
  { value: '90d', text: t('admin.api.expiration90d') },
  { value: '180d', text: t('admin.api.expiration180d') },
  { value: '1y', text: t('admin.api.expiration1y') },
  { value: '3y', text: t('admin.api.expiration3y') }
])

const levels = computed(() => [
  { label: t('profile.tokensLevel.none'), value: 'none' },
  { label: t('profile.tokensLevel.read'), value: 'read' },
  { label: t('profile.tokensLevel.write'), value: 'write' }
])

// REFS

const createForm = ref(null)

// VALIDATION RULES

const nameValidation = [
  (val) => val.length > 0 || t('profile.tokensNameMissing'),
  (val) => /^[^<>"]+$/.test(val) || t('profile.tokensNameInvalidChars')
]

// METHODS

async function create() {
  state.loading++
  try {
    const isFormValid = await createForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('profile.tokensCreateInvalidData'))
    }
    const scopes = Object.entries(state.scopes)
      .filter(([, level]) => level !== 'none')
      .map(([category, level]) => `${category}:${level}`)
    if (scopes.length < 1) {
      throw new Error(t('profile.tokensScopesMissing'))
    }
    const resp = await API_CLIENT.post('users/profile/tokens', {
      json: {
        name: state.name,
        expiration: state.expiration,
        scopes
      }
    }).json()
    if (!resp?.ok || !resp?.token) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('profile.tokensCreateSuccess')
    })
    // -> The token exists only in this response, so hand it straight to the copy dialog
    dialog({
      component: ApiKeyCopyDialog,
      componentProps: {
        keyValue: resp.token,
        title: t('profile.tokensCopyTitle'),
        label: t('profile.tokensToken'),
        successMessage: t('profile.tokensCopySuccess')
      }
    }).onDismiss(() => {
      onDialogOK()
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
  state.loading--
}
</script>
