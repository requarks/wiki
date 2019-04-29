<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-male-user.svg', alt='Edit User', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Edit User
            .subheading.grey--text.animated.fadeInLeft.wait-p2s {{user.name}}
          v-spacer
          .caption.grey--text.animated.fadeInRight.wait-p5s ID #[strong {{user.id}}]
          v-divider.animated.fadeInRight.wait-p3s.mx-3(vertical)
          v-btn.animated.fadeInDown.wait-p2s(color='grey', large, outline, to='/users')
            v-icon arrow_back
          v-dialog(v-model='deleteUserDialog', max-width='500', v-if='user.id !== currentUserId && !user.isSystem')
            v-btn.animated.fadeInDown.wait-p1s(color='red', large, outline, slot='activator')
              v-icon(color='red') delete
            v-card
              .dialog-header.is-red Delete User?
              v-card-text Are you sure you want to delete user #[strong {{ user.name }}]?
              v-card-actions
                v-spacer
                v-btn(flat, @click='deleteUserDialog = false') Cancel
                v-btn(color='red', dark, @click='deleteUser') Delete
          v-btn.animated.fadeInDown(color='primary', large, depressed, @click='updateUser')
            v-icon(left) check
            span Update User
      v-flex(xs5)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 directions_run
            span Basic Info
          v-list.py-0(two-line, dense)
            v-list-tile
              v-list-tile-avatar
                v-icon alternate_email
              v-list-tile-content
                v-list-tile-title Email
                v-list-tile-sub-title {{ user.email }}
              v-list-tile-action(v-if='!user.isSystem')
                  v-btn(icon, color='grey', flat)
                    v-icon edit
            v-divider
            v-list-tile
              v-list-tile-avatar
                v-icon person
              v-list-tile-content
                v-list-tile-title Display Name
                v-list-tile-sub-title {{ user.name }}
              v-list-tile-action
                  v-btn(icon, color='grey', flat)
                    v-icon edit
        v-card.mt-3.animated.fadeInUp.wait-p2s(v-if='!user.isSystem')
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 lock_outline
            span Authentication
          v-list.py-0(two-line, dense)
            v-list-tile
              v-list-tile-avatar
                v-icon business
              v-list-tile-content
                v-list-tile-title Provider
                v-list-tile-sub-title {{ user.providerKey }}
              v-list-tile-action
                v-img(src='https://static.requarks.io/logo/wikijs.svg', alt='')
            template(v-if='user.providerKey === `local`')
              v-divider
              v-list-tile
                v-list-tile-avatar
                  v-icon security
                v-list-tile-content
                  v-list-tile-title Password
                  v-list-tile-sub-title ********
                v-list-tile-action
                    v-btn(icon, color='grey', flat)
                      v-icon cached
                v-list-tile-action
                    v-btn(icon, color='grey', flat)
                      v-icon email
              v-divider
              v-list-tile
                v-list-tile-avatar
                  v-icon screen_lock_portrait
                v-list-tile-content
                  v-list-tile-title Two Factor Authentication (2FA)
                  v-list-tile-sub-title.red--text Inactive
                v-list-tile-action
                    v-btn(icon, color='grey', flat)
                      v-icon power_settings_new
              template(v-if='user.providerId')
                v-divider
                v-list-tile
                  v-list-tile-avatar
                    v-icon person
                  v-list-tile-content
                    v-list-tile-title Provider Id
                    v-list-tile-sub-title {{ user.providerId }}
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 people
            span User Groups
          v-list(dense)
            template(v-for='(group, idx) in user.groups')
              v-list-tile
                v-list-tile-avatar
                  v-icon people_outline
                v-list-tile-content
                  v-list-tile-title {{group.name}}
                v-list-tile-action
                  v-btn(icon, color='red', flat)
                    v-icon clear
              v-divider(v-if='idx < user.groups.length - 1')
          v-card-chin
            v-spacer
            v-btn(small, color='primary', flat)
              v-icon(left) how_to_reg
              span Assign to group
      v-flex(xs7)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 directions_walk
            span Extended Metadata
          v-list.py-0(two-line, dense)
            v-list-tile
              v-list-tile-avatar
                v-icon public
              v-list-tile-content
                v-list-tile-title Location
                v-list-tile-sub-title {{ user.location }}
              v-list-tile-action
                  v-btn(icon, color='grey', flat)
                    v-icon edit
            v-divider
            v-list-tile
              v-list-tile-avatar
                v-icon local_library
              v-list-tile-content
                v-list-tile-title Job Title
                v-list-tile-sub-title {{ user.jobTitle }}
              v-list-tile-action
                  v-btn(icon, color='grey', flat)
                    v-icon edit
            v-divider
            v-list-tile
              v-list-tile-avatar
                v-icon map
              v-list-tile-content
                v-list-tile-title Timezone
                v-list-tile-sub-title {{ user.timezone }}
              v-list-tile-action
                  v-btn(icon, color='grey', flat)
                    v-icon edit
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 insert_drive_file
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
