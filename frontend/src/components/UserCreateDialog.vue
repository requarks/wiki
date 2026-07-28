<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-plus-plus.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.users.create`) }}</span>
      </w-card-section>
      <w-form ref="createUserForm" class="py-2" @submit="create">
        <w-item>
          <blueprint-icon icon="person" />
          <w-item-section>
            <w-input
              ref="iptName"
              v-model="state.userName"
              outlined
              dense
              :rules="userNameValidation"
              hide-bottom-space
              :label="t(`common.field.name`)"
              lazy-rules="ondemand"
              autofocus />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="email" />
          <w-item-section>
            <w-input
              v-model="state.userEmail"
              outlined
              dense
              type="email"
              :rules="userEmailValidation"
              hide-bottom-space
              :label="t(`admin.users.email`)"
              lazy-rules="ondemand"
              autofocus />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="password" />
          <w-item-section>
            <w-input
              v-model="state.userPassword"
              outlined
              dense
              :rules="userPasswordValidation"
              hide-bottom-space
              :label="t(`admin.users.password`)"
              lazy-rules="ondemand"
              autofocus>
              <template #append>
                <div class="flex flex-nowrap items-center">
                  <w-badge :color="passwordStrength.color" :label="passwordStrength.label" />
                  <w-separator vertical class="mx-2 self-stretch" />
                  <w-btn flat dense padding="none xs" color="brown" @click="randomizePassword">
                    <w-icon name="la:dice-d6" />
                    <div class="pl-1 text-caption"><strong>Generate</strong></div>
                  </w-btn>
                </div>
              </template>
            </w-input>
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="team" />
          <w-item-section>
            <w-select
              v-model="state.userGroups"
              outlined
              :options="state.groups"
              multiple
              map-options
              emit-value
              option-value="id"
              option-label="name"
              options-dense
              dense
              :rules="userGroupsValidation"
              hide-bottom-space
              :label="t(`admin.users.groups`)"
              lazy-rules="ondemand"
              :loading="state.loadingGroups">
              <template #selected>
                <span v-if="state.userGroups.length > 1" class="text-caption">
                  <i18n-t keypath="admin.users.groupsSelected">
                    <template #count>
                      <strong>{{ state.userGroups.length }}</strong>
                    </template>
                  </i18n-t>
                </span>
                <span v-else-if="state.userGroups.length === 1" class="text-caption">
                  <i18n-t keypath="admin.users.groupSelected">
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
        <w-item clickable @click="state.userMustChangePassword = !state.userMustChangePassword">
          <blueprint-icon icon="password-reset" />
          <w-item-section>
            <w-item-label>{{ t(`admin.users.mustChangePwd`) }}</w-item-label>
            <w-item-label caption>{{ t(`admin.users.mustChangePwdHint`) }}</w-item-label>
          </w-item-section>
          <w-item-section avatar>
            <w-toggle
              v-model="state.userMustChangePassword"
              :aria-label="t(`admin.users.mustChangePwd`)"
              @click.stop />
          </w-item-section>
        </w-item>
        <w-item clickable @click="state.userSendWelcomeEmail = !state.userSendWelcomeEmail">
          <blueprint-icon icon="email-open" />
          <w-item-section>
            <w-item-label>{{ t(`admin.users.sendWelcomeEmail`) }}</w-item-label>
            <w-item-label caption>{{ t(`admin.users.sendWelcomeEmailHint`) }}</w-item-label>
          </w-item-section>
          <w-item-section avatar>
            <w-toggle
              v-model="state.userSendWelcomeEmail"
              :aria-label="t(`admin.users.sendWelcomeEmail`)"
              @click.stop />
          </w-item-section>
        </w-item>
        <w-item v-if="state.userSendWelcomeEmail">
          <blueprint-icon icon="web-design" />
          <w-item-section>
            <w-select
              v-model="state.userSendWelcomeEmailFromSiteId"
              outlined
              :options="adminStore.sites"
              multiple
              map-options
              emit-value
              option-value="id"
              option-label="title"
              options-dense
              dense
              hide-bottom-space
              :label="t(`admin.users.sendWelcomeEmailFromSiteId`)" />
          </w-item-section>
        </w-item>
      </w-form>
      <w-card-actions class="card-actions">
        <w-checkbox
          v-model="state.keepOpened"
          color="primary"
          :label="t(`admin.users.createKeepOpened`)" />
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
import { sample, sampleSize } from 'es-toolkit/array'
import zxcvbn from 'zxcvbn'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { computed, onMounted, reactive, ref } from 'vue'

import { useAdminStore } from '@/stores/admin'

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
  userName: '',
  userEmail: '',
  userPassword: '',
  userGroups: [],
  userMustChangePassword: false,
  userSendWelcomeEmail: false,
  userSendWelcomeEmailFromSiteId: null,
  keepOpened: false,
  groups: [],
  loadingGroups: false,
  loading: false
})

// REFS

const createUserForm = ref(null)
const iptName = ref(null)

// COMPUTED

const passwordStrength = computed(() => {
  if (state.userPassword.length < 8) {
    return {
      color: 'negative',
      label: t('admin.users.pwdStrengthWeak')
    }
  } else {
    switch (zxcvbn(state.userPassword).score) {
      case 1:
        return {
          color: 'deep-orange-7',
          label: t('admin.users.pwdStrengthPoor')
        }
      case 2:
        return {
          color: 'purple-7',
          label: t('admin.users.pwdStrengthMedium')
        }
      case 3:
        return {
          color: 'blue-7',
          label: t('admin.users.pwdStrengthGood')
        }
      case 4:
        return {
          color: 'green-7',
          label: t('admin.users.pwdStrengthStrong')
        }
      default:
        return {
          color: 'negative',
          label: t('admin.users.pwdStrengthWeak')
        }
    }
  }
})
const selectedGroupName = computed(() => {
  return state.groups.filter((g) => g.id === state.userGroups[0])[0]?.name
})

// VALIDATION RULES

const userNameValidation = [
  (val) => val.length > 0 || t('admin.users.nameMissing'),
  (val) => /^[^<>"]+$/.test(val) || t('admin.users.nameInvalidChars')
]

const userEmailValidation = [
  (val) => val.length > 0 || t('admin.users.emailMissing'),
  (val) => /^.+@.+\..+$/.test(val) || t('admin.users.emailInvalid')
]

const userPasswordValidation = [
  (val) => val.length > 0 || t('admin.users.passwordMissing'),
  (val) => val.length >= 8 || t('admin.users.passwordTooShort')
]

const userGroupsValidation = [(val) => val.length > 0 || t('admin.users.groupsMissing')]

// METHODS

async function loadGroups() {
  state.loading++
  state.loadingGroups = true
  try {
    const groups = await API_CLIENT.get('groups').json()
    state.groups = (groups ?? []).filter((g) => g.id !== '10000000-0000-4000-8000-000000000001')
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

function randomizePassword() {
  const pwdChars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // omit easily confused chars like O,0 or I,1,l
  const withSymbols = `${pwdChars}_*=?#!()+-$%&.`
  state.userPassword = `${sample(pwdChars)}${sampleSize(withSymbols, 15).join('')}`
}

async function create() {
  state.loading++
  try {
    const isFormValid = await createUserForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.users.createInvalidData'))
    }
    if (state.userSendWelcomeEmail && !state.userSendWelcomeEmailFromSiteId) {
      throw new Error(t('admin.users.createSendEmailMissingSiteId'))
    }
    const resp = await API_CLIENT.post('users', {
      json: {
        name: state.userName,
        email: state.userEmail,
        password: state.userPassword,
        groups: state.userGroups,
        mustChangePassword: state.userMustChangePassword,
        sendWelcomeEmail: state.userSendWelcomeEmail,
        ...(state.userSendWelcomeEmailFromSiteId
          ? { sendWelcomeEmailFromSiteId: state.userSendWelcomeEmailFromSiteId }
          : {})
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.users.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    notify({
      type: 'positive',
      message: t('admin.users.createSuccess')
    })
    if (state.keepOpened) {
      state.userName = ''
      state.userEmail = ''
      state.userPassword = ''
      iptName.value.focus()
    } else {
      onDialogOK()
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  state.userSendWelcomeEmailFromSiteId = adminStore.currentSiteId
  loadGroups()
})
</script>
