<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-plus-plus.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.api.newKeyTitle`) }}</span>
      </w-card-section>
      <w-form ref="createKeyForm" class="py-2" @submit="create">
        <w-item>
          <blueprint-icon icon="grand-master-key" class="self-start" />
          <w-item-section>
            <w-input
              ref="iptName"
              v-model="state.keyName"
              outlined
              dense
              :rules="keyNameValidation"
              hide-bottom-space
              :label="t(`admin.api.newKeyName`)"
              :hint="t(`admin.api.newKeyNameHint`)"
              lazy-rules="ondemand"
              autofocus />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="schedule" class="self-start" />
          <w-item-section>
            <!--
              Single-select: a key has one lifetime. It was declared `multiple` against a string
              model, which showed the default as a stray chip and let several be picked at once.
            -->
            <w-select
              v-model="state.keyExpiration"
              outlined
              :options="expirations"
              map-options
              option-value="value"
              option-label="text"
              emit-value
              options-dense
              dense
              hide-bottom-space
              :label="t(`admin.api.newKeyExpiration`)"
              :hint="t(`admin.api.newKeyExpirationHint`)" />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="access" class="self-start" />
          <w-item-section>
            <w-select
              v-model="state.keyGroups"
              outlined
              :options="state.groups"
              multiple
              map-options
              emit-value
              option-value="id"
              option-label="name"
              options-dense
              dense
              :rules="keyGroupsValidation"
              hide-bottom-space
              :label="t(`admin.api.permissionGroups`)"
              :hint="t(`admin.api.newKeyGroupHint`)"
              lazy-rules="ondemand"
              :loading="state.loadingGroups">
              <template #selected>
                <span v-if="state.keyGroups.length > 1" class="text-caption">
                  <i18n-t keypath="admin.api.groupsSelected" scope="global">
                    <template #count>
                      <strong>{{ state.keyGroups.length }}</strong>
                    </template>
                  </i18n-t>
                </span>
                <span v-else-if="state.keyGroups.length === 1" class="text-caption">
                  <i18n-t keypath="admin.api.groupSelected" scope="global">
                    <template #group>
                      <strong>{{ selectedGroupName }}</strong>
                    </template>
                  </i18n-t>
                </span>
                <span v-else />
              </template>
            </w-select>
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
          :loading="state.loading > 0"
          @click="create" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialog, dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { computed, onMounted, reactive, ref } from 'vue'

import ApiKeyCopyDialog from './ApiKeyCopyDialog.vue'
import { apiErrorMessage } from '@/helpers/apiError'

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  keyName: '',
  keyExpiration: '90d',
  keyGroups: [],
  groups: [],
  loadingGroups: false,
  loading: 0
})

/**
 * The guests group is anonymous access, so a key carrying its permissions would grant nothing a
 * caller cannot already do. Its ID is fixed at install (`systemIds.guestsGroupId` in base.yml), and
 * the API rejects it too.
 */
const GUESTS_GROUP_ID = '10000000-0000-4000-8000-000000000001'

const expirations = [
  { value: '30d', text: t('admin.api.expiration30d') },
  { value: '90d', text: t('admin.api.expiration90d') },
  { value: '180d', text: t('admin.api.expiration180d') },
  { value: '1y', text: t('admin.api.expiration1y') },
  { value: '3y', text: t('admin.api.expiration3y') }
]

// REFS

const createKeyForm = ref(null)
const iptName = ref(null)

// COMPUTED

const selectedGroupName = computed(() => {
  return state.groups.filter((g) => g.id === state.keyGroups[0])[0]?.name
})

// VALIDATION RULES

const keyNameValidation = [
  (val) => val.length > 0 || t('admin.api.nameMissing'),
  (val) => /^[^<>"]+$/.test(val) || t('admin.api.nameInvalidChars')
]

const keyGroupsValidation = [(val) => val.length > 0 || t('admin.api.groupsMissing')]

// METHODS

async function loadGroups() {
  state.loading++
  state.loadingGroups = true
  try {
    const resp = await API_CLIENT.get('groups').json()
    state.groups = (resp ?? []).filter((g) => g.id !== GUESTS_GROUP_ID)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.users.groupsLoadFailed'),
      caption: err.message
    })
  }
  state.loadingGroups = false
  state.loading--
}

async function create() {
  state.loading++
  try {
    const isFormValid = await createKeyForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.api.createInvalidData'))
    }
    const resp = await API_CLIENT.post('api-keys', {
      json: {
        name: state.keyName,
        expiration: state.keyExpiration,
        groups: state.keyGroups
      }
    }).json()
    if (!resp?.ok || !resp?.key) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.api.createSuccess')
    })
    // -> The token exists only in this response, so hand it straight to the copy dialog
    dialog({
      component: ApiKeyCopyDialog,
      componentProps: {
        keyValue: resp.key
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

// MOUNTED

onMounted(loadGroups)
</script>
