<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
      span {{t(`admin.users.create`)}}
    q-form.q-py-sm(ref='createUserForm', @submit='create')
      q-item
        blueprint-icon(icon='person')
        q-item-section
          q-input(
            outlined
            v-model='state.userName'
            dense
            :rules='userNameValidation'
            hide-bottom-space
            :label='t(`common.field.name`)'
            :aria-label='t(`common.field.name`)'
            lazy-rules='ondemand'
            autofocus
            ref='iptName'
            )
      q-item
        blueprint-icon(icon='email')
        q-item-section
          q-input(
            outlined
            v-model='state.userEmail'
            dense
            type='email'
            :rules='userEmailValidation'
            hide-bottom-space
            :label='t(`admin.users.email`)'
            :aria-label='t(`admin.users.email`)'
            lazy-rules='ondemand'
            autofocus
            )
      q-item
        blueprint-icon(icon='password')
        q-item-section
          q-input(
            outlined
            v-model='state.userPassword'
            dense
            :rules='userPasswordValidation'
            hide-bottom-space
            :label='t(`admin.users.password`)'
            :aria-label='t(`admin.users.password`)'
            lazy-rules='ondemand'
            autofocus
            )
            template(#append)
              .flex.items-center
                q-badge(
                  :color='passwordStrength.color'
                  :label='passwordStrength.label'
                )
                q-separator.q-mx-sm(vertical)
                q-btn(
                  flat
                  dense
                  padding='none xs'
                  color='brown'
                  @click='randomizePassword'
                  )
                  q-icon(name='las la-dice-d6')
                  .q-pl-xs.text-caption: strong Generate
      q-item
        blueprint-icon(icon='team')
        q-item-section
          q-select(
            outlined
            :options='state.groups'
            v-model='state.userGroups'
            multiple
            map-options
            emit-value
            option-value='id'
            option-label='name'
            options-dense
            dense
            :rules='userGroupsValidation'
            hide-bottom-space
            :label='t(`admin.users.groups`)'
            :aria-label='t(`admin.users.groups`)'
            lazy-rules='ondemand'
            :loading='state.loadingGroups'
            )
            template(v-slot:selected)
              .text-caption(v-if='state.userGroups.length > 1')
                i18n-t(keypath='admin.users.groupsSelected')
                  template(#count)
                    strong {{ state.userGroups.length }}
              .text-caption(v-else-if='state.userGroups.length === 1')
                i18n-t(keypath='admin.users.groupSelected')
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
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='password-reset')
        q-item-section
          q-item-label {{t(`admin.users.mustChangePwd`)}}
          q-item-label(caption) {{t(`admin.users.mustChangePwdHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='state.userMustChangePassword'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='t(`admin.users.mustChangePwd`)'
            )
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='email-open')
        q-item-section
          q-item-label {{t(`admin.users.sendWelcomeEmail`)}}
          q-item-label(caption) {{t(`admin.users.sendWelcomeEmailHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='state.userSendWelcomeEmail'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='t(`admin.users.sendWelcomeEmail`)'
            )
    q-card-actions.card-actions
      q-checkbox(
        v-model='state.keepOpened'
        color='primary'
        :label='t(`admin.users.createKeepOpened`)'
        size='sm'
      )
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
import gql from 'graphql-tag'
import sampleSize from 'lodash/sampleSize'
import zxcvbn from 'zxcvbn'
import cloneDeep from 'lodash/cloneDeep'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref } from 'vue'

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()
defineExpose({ $q })

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
  return state.groups.filter(g => g.id === state.userGroups[0])[0]?.name
})

// VALIDATION RULES

const userNameValidation = [
  val => val.length > 0 || t('admin.users.nameMissing'),
  val => /^[^<>"]+$/.test(val) || t('admin.users.nameInvalidChars')
]

const userEmailValidation = [
  val => val.length > 0 || t('admin.users.emailMissing'),
  val => /^.+@.+\..+$/.test(val) || t('admin.users.emailInvalid')
]

const userPasswordValidation = [
  val => val.length > 0 || t('admin.users.passwordMissing'),
  val => val.length >= 8 || t('admin.users.passwordTooShort')
]

const userGroupsValidation = [
  val => val.length > 0 || t('admin.users.groupsMissing')
]

// METHODS

async function loadGroups () {
  state.loading++
  state.loadingGroups = true
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getGroupsForCreateUser {
        groups {
          id
          name
        }
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.groups = cloneDeep(resp?.data?.groups?.filter(g => g.id !== '10000000-0000-4000-8000-000000000001') ?? [])
  state.loadingGroups = false
  state.loading--
}

function randomizePassword () {
  const pwdChars = 'abcdefghkmnpqrstuvwxyzABCDEFHJKLMNPQRSTUVWXYZ23456789_*=?#!()+'
  state.userPassword = sampleSize(pwdChars, 16).join('')
}

async function create () {
  state.loading++
  try {
    const isFormValid = await createUserForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.users.createInvalidData'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation createUser (
          $name: String!
          $email: String!
          $password: String!
          $groups: [UUID]!
          $mustChangePassword: Boolean!
          $sendWelcomeEmail: Boolean!
          ) {
          createUser (
            name: $name
            email: $email
            password: $password
            groups: $groups
            mustChangePassword: $mustChangePassword
            sendWelcomeEmail: $sendWelcomeEmail
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        name: state.userName,
        email: state.userEmail,
        password: state.userPassword,
        groups: state.userGroups,
        mustChangePassword: state.userMustChangePassword,
        sendWelcomeEmail: state.userSendWelcomeEmail
      }
    })
    if (resp?.data?.createUser?.operation?.succeeded) {
      $q.notify({
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
    } else {
      throw new Error(resp?.data?.createUser?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(loadGroups)
</script>
