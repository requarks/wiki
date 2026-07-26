<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
      span {{t(`admin.api.newKeyTitle`)}}
    q-form.q-py-sm(ref='createKeyForm', @submit='create')
      q-item
        blueprint-icon.self-start(icon='grand-master-key')
        q-item-section
          q-input(
            outlined
            v-model='state.keyName'
            dense
            :rules='keyNameValidation'
            hide-bottom-space
            :label='t(`admin.api.newKeyName`)'
            :aria-label='t(`admin.api.newKeyName`)'
            :hint='t(`admin.api.newKeyNameHint`)'
            lazy-rules='ondemand'
            autofocus
            ref='iptName'
            )
      q-item
        blueprint-icon.self-start(icon='schedule')
        q-item-section
          //- Single-select: a key has one lifetime. It was declared `multiple` against a string
          //- model, which showed the default as a stray chip and let several be picked at once.
          q-select(
            outlined
            :options='expirations'
            v-model='state.keyExpiration'
            map-options
            option-value='value'
            option-label='text'
            emit-value
            options-dense
            dense
            hide-bottom-space
            :label='t(`admin.api.newKeyExpiration`)'
            :aria-label='t(`admin.api.newKeyExpiration`)'
            :hint='t(`admin.api.newKeyExpirationHint`)'
            )
      q-item
        blueprint-icon.self-start(icon='access')
        q-item-section
          q-select(
            outlined
            :options='state.groups'
            v-model='state.keyGroups'
            multiple
            map-options
            emit-value
            option-value='id'
            option-label='name'
            options-dense
            dense
            :rules='keyGroupsValidation'
            hide-bottom-space
            :label='t(`admin.api.permissionGroups`)'
            :aria-label='t(`admin.api.permissionGroups`)'
            :hint='t(`admin.api.newKeyGroupHint`)'
            lazy-rules='ondemand'
            :loading='state.loadingGroups'
            )
            template(v-slot:selected)
              .text-caption(v-if='state.keyGroups.length > 1')
                i18n-t(keypath='admin.api.groupsSelected', scope='global')
                  template(#count)
                    strong {{ state.keyGroups.length }}
              .text-caption(v-else-if='state.keyGroups.length === 1')
                i18n-t(keypath='admin.api.groupSelected', scope='global')
                  template(#group)
                    strong {{ selectedGroupName }}
              span(v-else)
            template(v-slot:option='{ itemProps, opt, selected, toggleOption }')
              q-item(
                v-bind='itemProps'
                )
                q-item-section(side)
                  q-checkbox(
                    size='sm'
                    :model-value='selected'
                    @update:model-value='toggleOption(opt)'
                    )
                q-item-section
                  q-item-label {{opt.name}}
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
        :label='t(`common.actions.create`)'
        color='primary'
        padding='xs md'
        @click='create'
        :loading='state.loading > 0'
        )
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref } from 'vue'

import ApiKeyCopyDialog from './ApiKeyCopyDialog.vue'

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

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
  return state.groups.filter(g => g.id === state.keyGroups[0])[0]?.name
})

// VALIDATION RULES

const keyNameValidation = [
  val => val.length > 0 || t('admin.api.nameMissing'),
  val => /^[^<>"]+$/.test(val) || t('admin.api.nameInvalidChars')
]

const keyGroupsValidation = [
  val => val.length > 0 || t('admin.api.groupsMissing')
]

// METHODS

async function loadGroups () {
  state.loading++
  state.loadingGroups = true
  try {
    const resp = await API_CLIENT.get('groups').json()
    state.groups = (resp ?? []).filter(g => g.id !== GUESTS_GROUP_ID)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.users.groupsLoadFailed'),
      caption: err.message
    })
  }
  state.loadingGroups = false
  state.loading--
}

async function create () {
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
    $q.notify({
      type: 'positive',
      message: t('admin.api.createSuccess')
    })
    // -> The token exists only in this response, so hand it straight to the copy dialog
    $q.dialog({
      component: ApiKeyCopyDialog,
      componentProps: {
        keyValue: resp.key
      }
    }).onDismiss(() => {
      onDialogOK()
    })
  } catch (err) {
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(loadGroups)
</script>
