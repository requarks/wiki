<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-password-reset.svg', left, size='sm')
      span {{$t(`admin.users.changePassword`)}}
    q-form.q-py-sm(ref='changeUserPwdForm', @submit='save')
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
    q-card-actions.card-actions
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
        :label='$t(`common.actions.update`)'
        color='primary'
        padding='xs md'
        @click='save'
        :loading='isLoading'
        )
</template>

<script>
import gql from 'graphql-tag'
import sampleSize from 'lodash/sampleSize'
import zxcvbn from 'zxcvbn'

export default {
  props: {
    userId: {
      type: String,
      required: true
    }
  },
  emits: ['ok', 'hide'],
  data () {
    return {
      userPassword: '',
      userMustChangePassword: false,
      isLoading: false
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
    }
  },
  methods: {
    show () {
      this.$refs.dialog.show()
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
    async save () {
      this.isLoading = true
      try {
        const isFormValid = await this.$refs.changeUserPwdForm.validate(true)
        if (!isFormValid) {
          throw new Error(this.$t('admin.users.createInvalidData'))
        }
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation adminUpdateUserPwd (
              $id: UUID!
              $patch: UserUpdateInput!
              ) {
              updateUser (
                id: $id
                patch: $patch
                ) {
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            id: this.userId,
            patch: {
              newPassword: this.userPassword,
              mustChangePassword: this.userMustChangePassword
            }
          }
        })
        if (resp?.data?.updateUser?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.users.createSuccess')
          })
          this.$emit('ok', {
            mustChangePassword: this.userMustChangePassword
          })
          this.hide()
        } else {
          throw new Error(resp?.data?.updateUser?.status?.message || 'An unexpected error occured.')
        }
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: err.message
        })
      }
      this.isLoading = false
    }
  }
}
</script>
