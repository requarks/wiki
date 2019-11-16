<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-social-group.svg', alt='Edit Group', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2 Edit Group
            .subtitle-1.grey--text {{group.name}}
          v-spacer
          .caption.grey--text ID #[strong {{group.id}}]
          v-divider.mx-3(vertical)
          v-btn(color='grey', large, outlined, to='/groups')
            v-icon mdi-arrow-left
          v-dialog(v-model='deleteGroupDialog', max-width='500', v-if='!group.isSystem')
            template(v-slot:activator='{ on }')
              v-btn.ml-2(color='red', large, outlined, v-on='on')
                v-icon(color='red') mdi-trash-can-outline
            v-card
              .dialog-header.is-red Delete Group?
              v-card-text.pa-4 Are you sure you want to delete group #[strong {{ group.name }}]? All users will be unassigned from this group.
              v-card-actions
                v-spacer
                v-btn(text, @click='deleteGroupDialog = false') Cancel
                v-btn(color='red', dark, @click='deleteGroup') Delete
          v-btn.ml-2(color='success', large, depressed, @click='updateGroup')
            v-icon(left) mdi-check
            span Update Group
        v-card.mt-3
          v-tabs.grad-tabs(v-model='tab', :color='$vuetify.theme.dark ? `blue` : `primary`', fixed-tabs, show-arrows, icons-and-text)
            v-tab(key='permissions')
              span Permissions
              v-icon mdi-lock-pattern
            v-tab(key='rules')
              span Page Rules
              v-icon mdi-file-lock
            v-tab(key='users')
              span Users
              v-icon mdi-account-group

            v-tab-item(key='permissions', :transition='false', :reverse-transition='false')
              group-permissions(v-model='group', @refresh='refresh')

            v-tab-item(key='rules', :transition='false', :reverse-transition='false')
              group-rules(v-model='group', @refresh='refresh')

            v-tab-item(key='users', :transition='false', :reverse-transition='false')
              group-users(v-model='group', @refresh='refresh')
</template>

<script>
import _ from 'lodash'

import GroupPermissions from './admin-groups-edit-permissions.vue'
import GroupRules from './admin-groups-edit-rules.vue'
import GroupUsers from './admin-groups-edit-users.vue'

import groupQuery from 'gql/admin/groups/groups-query-single.gql'
import deleteGroupMutation from 'gql/admin/groups/groups-mutation-delete.gql'
import updateGroupMutation from 'gql/admin/groups/groups-mutation-update.gql'

export default {
  components: {
    GroupPermissions,
    GroupRules,
    GroupUsers
  },
  data() {
    return {
      group: {
        id: 0,
        name: '',
        isSystem: false,
        permissions: [],
        pageRules: [],
        users: []
      },
      deleteGroupDialog: false,
      tab: null
    }
  },
  methods: {
    async updateGroup() {
      try {
        await this.$apollo.mutate({
          mutation: updateGroupMutation,
          variables: {
            id: this.group.id,
            name: this.group.name,
            permissions: this.group.permissions,
            pageRules: this.group.pageRules
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Group changes have been saved.`,
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async deleteGroup() {
      this.deleteGroupDialog = false
      try {
        await this.$apollo.mutate({
          mutation: deleteGroupMutation,
          variables: {
            id: this.group.id
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-delete')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Group ${this.group.name} has been deleted.`,
          icon: 'delete'
        })
        this.$router.replace('/groups')
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async refresh() {
      return this.$apollo.queries.group.refetch()
    }
  },
  apollo: {
    group: {
      query: groupQuery,
      variables() {
        return {
          id: _.toSafeInteger(this.$route.params.id)
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.groups.single),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
