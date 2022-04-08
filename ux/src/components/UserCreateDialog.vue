<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
      span {{$t(`admin.users.create`)}}
    q-form.q-py-sm(ref='createUserForm', @submit='create')
      q-item
        blueprint-icon(icon='person')
        q-item-section
          q-input(
            outlined
            v-model='userName'
            dense
            :rules=`[
              val => val.length > 0 || $t('admin.users.nameMissing'),
              val => /^[^<>"]+$/.test(val) || $t('admin.users.nameInvalidChars')
            ]`
            hide-bottom-space
            :label='$t(`common.field.name`)'
            :aria-label='$t(`common.field.name`)'
            lazy-rules='ondemand'
            autofocus
            ref='iptName'
            )
      q-item
        blueprint-icon(icon='email')
        q-item-section
          q-input(
            outlined
            v-model='userEmail'
            dense
            type='email'
            :rules=`[
              val => val.length > 0 || $t('admin.users.emailMissing'),
              val => /^.+\@.+\..+$/.test(val) || $t('admin.users.emailInvalid')
            ]`
            hide-bottom-space
            :label='$t(`admin.users.email`)'
            :aria-label='$t(`admin.users.email`)'
            lazy-rules='ondemand'
            autofocus
            )
      q-item
        blueprint-icon(icon='password')
        q-item-section
          q-input(
            outlined
            v-model='userPassword'
            dense
            :rules=`[
              val => val.length > 0 || $t('admin.users.passwordMissing'),
              val => val.length >= 8 || $t('admin.users.passwordTooShort')
            ]`
            hide-bottom-space
            :label='$t(`admin.users.password`)'
            :aria-label='$t(`admin.users.password`)'
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
            :options='groups'
            v-model='userGroups'
            multiple
            map-options
            emit-value
            option-value='id'
            option-label='name'
            options-dense
            dense
            :rules=`[
              val => val.length > 0 || $t('admin.users.groupsMissing')
            ]`
            hide-bottom-space
            :label='$t(`admin.users.groups`)'
            :aria-label='$t(`admin.users.groups`)'
            lazy-rules='ondemand'
            :loading='loadingGroups'
            )
            template(v-slot:selected)
              .text-caption(v-if='userGroups.length > 1')
                i18n-t(keypath='admin.users.groupsSelected')
                  template(#count)
                    strong {{ userGroups.length }}
              .text-caption(v-else-if='userGroups.length === 1')
                i18n-t(keypath='admin.users.groupSelected')
                  template(#group)
                    strong {{ selectedGroupName }}
              span(v-else)
            template(v-slot:option='{ itemProps, itemEvents, opt, selected, toggleOption }')
              q-item(
                v-bind='itemProps'
                v-on='itemEvents'
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
          q-item-label {{$t(`admin.users.mustChangePwd`)}}
          q-item-label(caption) {{$t(`admin.users.mustChangePwdHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='userMustChangePassword'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='$t(`admin.users.mustChangePwd`)'
            )
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='email-open')
        q-item-section
          q-item-label {{$t(`admin.users.sendWelcomeEmail`)}}
          q-item-label(caption) {{$t(`admin.users.sendWelcomeEmailHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='userSendWelcomeEmail'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='$t(`admin.users.sendWelcomeEmail`)'
            )
    q-card-actions.card-actions
      q-checkbox(
        v-model='keepOpened'
        color='primary'
        :label='$t(`admin.users.createKeepOpened`)'
        size='sm'
      )
      q-space
      q-btn.acrylic-btn(
        flat
        :label='$t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        @click='hide'
        )
      q-btn(
        unelevated
        :label='$t(`common.actions.create`)'
        color='primary'
        padding='xs md'
        @click='create'
        :loading='loading > 0'
        )
</template>

<script>
import gql from 'graphql-tag'
import sampleSize from 'lodash/sampleSize'
import zxcvbn from 'zxcvbn'
import cloneDeep from 'lodash/cloneDeep'

export default {
  emits: ['ok', 'hide'],
  data () {
    return {
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
    }
  },
  computed: {
    passwordStrength () {
      if (this.userPassword.length < 8) {
        return {
          color: 'negative',
          label: this.$t('admin.users.pwdStrengthWeak')
        }
      } else {
        switch (zxcvbn(this.userPassword).score) {
          case 1:
            return {
              color: 'deep-orange-7',
              label: this.$t('admin.users.pwdStrengthPoor')
            }
          case 2:
            return {
              color: 'purple-7',
              label: this.$t('admin.users.pwdStrengthMedium')
            }
          case 3:
            return {
              color: 'blue-7',
              label: this.$t('admin.users.pwdStrengthGood')
            }
          case 4:
            return {
              color: 'green-7',
              label: this.$t('admin.users.pwdStrengthStrong')
            }
          default:
            return {
              color: 'negative',
              label: this.$t('admin.users.pwdStrengthWeak')
            }
        }
      }
    },
    selectedGroupName () {
      return this.groups.filter(g => g.id === this.userGroups[0])[0]?.name
    }
  },
  methods: {
    async show () {
      this.$refs.dialog.show()

      this.loading++
      this.loadingGroups = true
      const resp = await this.$apollo.query({
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
      this.groups = cloneDeep(resp?.data?.groups?.filter(g => g.id !== '10000000-0000-4000-0000-000000000001') ?? [])
      this.loadingGroups = false
      this.loading--
    },
    hide () {
      this.$refs.dialog.hide()
    },
    onDialogHide () {
      this.$emit('hide')
    },
    randomizePassword () {
      const pwdChars = 'abcdefghkmnpqrstuvwxyzABCDEFHJKLMNPQRSTUVWXYZ23456789_*=?#!()+'
      this.userPassword = sampleSize(pwdChars, 16).join('')
    },
    async create () {
      this.loading++
      try {
        const isFormValid = await this.$refs.createUserForm.validate(true)
        if (!isFormValid) {
          throw new Error(this.$t('admin.users.createInvalidData'))
        }
        const resp = await this.$apollo.mutate({
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
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            name: this.userName,
            email: this.userEmail,
            password: this.userPassword,
            groups: this.userGroups,
            mustChangePassword: this.userMustChangePassword,
            sendWelcomeEmail: this.userSendWelcomeEmail
          }
        })
        if (resp?.data?.createUser?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.users.createSuccess')
          })
          if (this.keepOpened) {
            this.userName = ''
            this.userEmail = ''
            this.userPassword = ''
            this.$refs.iptName.focus()
          } else {
            this.$emit('ok')
            this.hide()
          }
        } else {
          throw new Error(resp?.data?.createUser?.status?.message || 'An unexpected error occured.')
        }
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: err.message
        })
      }
      this.loading--
    }
  }
}
</script>
