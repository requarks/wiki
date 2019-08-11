<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-male-user.svg', alt='Edit User', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Edit User
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{user.name}}
          v-spacer
          .caption.grey--text.animated.fadeInRight.wait-p5s ID #[strong {{user.id}}]
          v-divider.animated.fadeInRight.wait-p3s.ml-3(vertical)
          v-btn.ml-3.animated.fadeInDown.wait-p2s(color='grey', large, outlined, to='/users')
            v-icon mdi-arrow-left
          v-dialog(v-model='deleteUserDialog', max-width='500', v-if='user.id !== currentUserId && !user.isSystem')
            template(v-slot:activator='{ on }')
              v-btn.ml-3.animated.fadeInDown.wait-p1s(color='red', large, outlined, v-on='on')
                v-icon(color='red') mdi-trash-can-outline
            v-card
              .dialog-header.is-red Delete User?
              v-card-text Are you sure you want to delete user #[strong {{ user.name }}]?
              v-card-actions
                v-spacer
                v-btn(text, @click='deleteUserDialog = false') Cancel
                v-btn(color='red', dark, @click='deleteUser') Delete
          v-btn.ml-3.animated.fadeInDown(color='primary', large, depressed, @click='updateUser')
            v-icon(left) mdi-check
            span Update User
      v-flex(xs5)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-information-variant
            span Basic Info
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-email-variant
              v-list-item-content
                v-list-item-title Email
                v-list-item-subtitle {{ user.email }}
              v-list-item-action(v-if='!user.isSystem')
                  v-btn(icon, color='grey', flat, x-small)
                    v-icon mdi-pencil
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-account
              v-list-item-content
                v-list-item-title Display Name
                v-list-item-subtitle {{ user.name }}
              v-list-item-action
                  v-btn(icon, color='grey', flat, x-small)
                    v-icon mdi-pencil
        v-card.mt-3.animated.fadeInUp.wait-p2s(v-if='!user.isSystem')
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-lock-outline
            span Authentication
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-domain
              v-list-item-content
                v-list-item-title Provider
                v-list-item-subtitle {{ user.providerKey }}
              //- v-list-item-action
              //-   v-img(src='https://static.requarks.io/logo/wikijs.svg', alt='', contain, max-height='32', position='center right')
            template(v-if='user.providerKey === `local`')
              v-divider
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-textbox-password
                v-list-item-content
                  v-list-item-title Password
                  v-list-item-subtitle &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                v-list-item-action
                  v-tooltip(top)
                    template(v-slot:activator='{ on }')
                      v-btn(icon, color='grey', flat, x-small, v-on='on')
                        v-icon mdi-cached
                    span Change Password
                v-list-item-action
                  v-tooltip(top)
                    template(v-slot:activator='{ on }')
                      v-btn(icon, color='grey', flat, x-small, v-on='on')
                        v-icon mdi-email
                    span Send Password Reset Email
              v-divider
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-two-factor-authentication
                v-list-item-content
                  v-list-item-title Two Factor Authentication (2FA)
                  v-list-item-subtitle.red--text Inactive
                v-list-item-action
                  v-tooltip(top)
                    template(v-slot:activator='{ on }')
                      v-btn(icon, color='grey', flat, x-small, v-on='on')
                        v-icon mdi-power
                    span Toggle 2FA
              template(v-if='user.providerId')
                v-divider
                v-list-item
                  v-list-item-avatar(size='32')
                    v-icon mdi-account
                  v-list-item-content
                    v-list-item-title Provider Id
                    v-list-item-subtitle {{ user.providerId }}
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-account-group
            span User Groups
          v-list(dense)
            template(v-for='(group, idx) in user.groups')
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-account-group-outline
                v-list-item-content
                  v-list-item-title {{group.name}}
                v-list-item-action(v-if='!user.isSystem')
                  v-btn(icon, color='red', x-small)
                    v-icon mdi-close
              v-divider(v-if='idx < user.groups.length - 1')
          v-alert.mx-3(v-if='user.groups.length < 1', outlined, color='grey darken-1', icon='mdi-alert')
            .caption This user is not assigned to any group yet. You must assign at least 1 group to a user.
          v-card-chin(v-if='!user.isSystem')
            v-spacer
            v-btn(color='primary', text)
              v-icon(left) mdi-clipboard-account
              span Assign to group
      v-flex(xs7)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-account-badge-outline
            span Extended Metadata
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-marker
              v-list-item-content
                v-list-item-title Location
                v-list-item-subtitle {{ user.location }}
              v-list-item-action
                  v-btn(icon, color='grey', flat, x-small)
                    v-icon mdi-pencil
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-account-badge-horizontal-outline
              v-list-item-content
                v-list-item-title Job Title
                v-list-item-subtitle {{ user.jobTitle }}
              v-list-item-action
                  v-btn(icon, color='grey', flat, x-small)
                    v-icon mdi-pencil
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-clock-outline
              v-list-item-content
                v-list-item-title Timezone
                v-list-item-subtitle {{ user.timezone }}
              v-list-item-action
                  v-btn(icon, color='grey', flat, x-small)
                    v-icon mdi-pencil
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-file-document-box-multiple-outline
            span Content
          v-card-text
            em.caption.grey--text Coming soon

</template>
<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'

import userQuery from 'gql/admin/users/users-query-single.gql'

export default {
  data() {
    return {
      deleteUserDialog: false,
      user: {

      }
    }
  },
  computed: {
    currentUserId: get('user/id')
  },
  methods: {
    deleteUser() {},
    updateUser() {}
  },
  apollo: {
    user: {
      query: userQuery,
      variables() {
        return {
          id: _.toSafeInteger(this.$route.params.id)
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => data.users.single,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
