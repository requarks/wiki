<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subtitle-1 {{ $t('admin:utilities.authTitle') }}
    v-card-text
      .subtitle-1.pb-3.primary--text Generate New Authentication Public / Private Key Certificates
      .body-2 This will invalidate all current session tokens and cause all users to be logged out.
      .body-2.red--text You will need to log back in after the operation.
      v-btn(outlined, color='primary', @click='regenCerts', :disabled='loading').ml-0.mt-3
        v-icon(left) mdi-gesture-double-tap
        span Proceed
      v-divider.my-5
      .subtitle-1.pb-3.primary--text Reset Guest User
      .body-2 This will reset the guest user to its default parameters and permissions.
      v-btn(outlined, color='primary', @click='resetGuest', :disabled='loading').ml-0.mt-3
        v-icon(left) mdi-gesture-double-tap
        span Proceed
</template>

<script>
import _ from 'lodash'
import Cookies from 'js-cookie'
import utilityAuthRegencertsMutation from 'gql/admin/utilities/utilities-mutation-auth-regencerts.gql'
import utilityAuthResetguestMutation from 'gql/admin/utilities/utilities-mutation-auth-resetguest.gql'

export default {
  data: () => {
    return {
      loading: false
    }
  },
  methods: {
    async regenCerts() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-auth-regencerts')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityAuthRegencertsMutation
        })
        const resp = _.get(respRaw, 'data.authentication.regenerateCertificates.responseResult', {})
        if (resp.succeeded) {
          this.$store.commit('showNotification', {
            message: 'New Certificates generated successfully.',
            style: 'success',
            icon: 'check'
          })
          Cookies.remove('jwt')
          _.delay(() => {
            window.location.assign('/login')
          }, 1000)
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'admin-utilities-auth-regencerts')
      this.loading = false
    },
    async resetGuest() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-auth-resetguest')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityAuthResetguestMutation
        })
        const resp = _.get(respRaw, 'data.authentication.resetGuestUser.responseResult', {})
        if (resp.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Guest user was reset successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'admin-utilities-auth-resetguest')
      this.loading = false
    }
  }
}
</script>

<style lang='scss'>

</style>
