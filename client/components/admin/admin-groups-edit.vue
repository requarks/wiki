<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          v-icon(size='80', color='grey lighten-2') people
          .admin-header-title
            .headline.blue--text.text--darken-2 Edit Group
            .subheading.grey--text {{name}}
          v-spacer
          v-btn(color='indigo', large, outline, to='/groups')
            v-icon arrow_back
          v-dialog(v-model='deleteGroupDialog', max-width='500', v-if='!group.isSystem')
            v-btn(color='red', large, outline, slot='activator')
              v-icon(color='red') delete
            v-card
              .dialog-header.is-red Delete Group?
              v-card-text Are you sure you want to delete group #[strong {{ name }}]? All users will be unassigned from this group.
              v-card-actions
                v-spacer
                v-btn(flat, @click='deleteGroupDialog = false') Cancel
                v-btn(color='red', dark, @click='deleteGroup') Delete
          v-btn(color='primary', large, depressed, @click='updateGroup')
            v-icon(left) check
            span Update Group
        v-card.mt-3
          v-tabs(v-model='tab', :color='$vuetify.dark ? "primary" : "grey lighten-4"', fixed-tabs, :slider-color='$vuetify.dark ? "white" : "primary"', show-arrows)
            v-tab(key='properties') Properties
            v-tab(key='permissions') Permissions
            v-tab(key='rules') Page Rules
            v-tab(key='users') Users

            v-tab-item(key='properties', :transition='false', :reverse-transition='false')
              v-card
                v-card-text
                  v-text-field(
                    outline
                    background-color='grey lighten-3'
                    v-model='name'
                    label='Group Name'
                    counter='255'
                    prepend-icon='people'
                    )
                  v-divider
                  .caption.mt-3.grey--text ID: {{group.id}}

            v-tab-item(key='permissions', :transition='false', :reverse-transition='false')
              v-container.pa-3(fluid, grid-list-md)
                v-layout(row, wrap)
                  v-flex(xs12, md6, lg4, v-for='pmGroup in permissions')
                    v-card.md2.grey.lighten-5(flat)
                      v-subheader {{pmGroup.category}}
                      v-card-text.pt-0
                        template(v-for='(pm, idx) in pmGroup.items')
                          v-checkbox.pt-0(
                            :key='pm.permission'
                            :label='pm.permission'
                            :hint='pm.hint'
                            persistent-hint
                            color='primary'
                            v-model='group.permissions'
                            :value='pm.permission'
                            :append-icon='pm.warning ? "warning" : null',
                            :disabled='(group.isSystem && pm.restrictedForSystem) || group.id === 1 || pm.disabled'
                          )
                          v-divider.mt-3(v-if='idx < pmGroup.items.length - 1')

            v-tab-item(key='rules', :transition='false', :reverse-transition='false')
              v-card
                v-card-title.pb-0
                  v-spacer
                  v-btn(flat, outline)
                    v-icon(left) arrow_drop_down
                    | Load Preset
                  v-btn(flat, outline)
                    v-icon(left) vertical_align_bottom
                    | Import Rules
                .pa-3.pl-4
                  criterias

            v-tab-item(key='users', :transition='false', :reverse-transition='false')
              v-card
                v-card-title.pb-0
                  v-spacer
                  v-btn(color='primary', outline, flat, @click='searchUserDialog = true')
                    v-icon(left) assignment_ind
                    | Assign User
                v-data-table(
                  :items='group.users',
                  :headers='headers',
                  :search='search',
                  :pagination.sync='pagination',
                  :rows-per-page-items='[15]'
                  hide-actions
                )
                  template(slot='items', slot-scope='props')
                    tr(:active='props.selected')
                      td.text-xs-right {{ props.item.id }}
                      td {{ props.item.name }}
                      td {{ props.item.email }}
                      td
                        v-menu(bottom, right, min-width='200')
                          v-btn(icon, slot='activator'): v-icon.grey--text.text--darken-1 more_horiz
                          v-list
                            v-list-tile(@click='unassignUser(props.item.id)')
                              v-list-tile-action: v-icon(color='orange') highlight_off
                              v-list-tile-content
                                v-list-tile-title Unassign
                  template(slot='no-data')
                    v-alert.ma-3(icon='warning', :value='true', outline) No users to display.
                .text-xs-center.py-2(v-if='users.length > 15')
                  v-pagination(v-model='pagination.page', :length='pages')

    user-search(v-model='searchUserDialog', @select='assignUser')
</template>

<script>
import _ from 'lodash'

import Criterias from '../common/criterias.vue'
import UserSearch from '../common/user-search.vue'

import groupQuery from 'gql/admin/groups/groups-query-single.gql'
import assignUserMutation from 'gql/admin/groups/groups-mutation-assign.gql'
import deleteGroupMutation from 'gql/admin/groups/groups-mutation-delete.gql'
import unassignUserMutation from 'gql/admin/groups/groups-mutation-unassign.gql'
import updateGroupMutation from 'gql/admin/groups/groups-mutation-update.gql'

export default {
  components: {
    Criterias,
    UserSearch
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
      name: '',
      deleteGroupDialog: false,
      searchUserDialog: false,
      pagination: {},
      permissions: [
        {
          category: 'Content',
          items: [
            {
              permission: 'read:pages',
              hint: 'Can view pages, as specified in the Page Rules',
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              permission: 'write:pages',
              hint: 'Can view and create new pages, as specified in the Page Rules',
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              permission: 'manage:pages',
              hint: 'Can view, create, edit and move existing pages as specified in the Page Rules',
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              permission: 'delete:pages',
              hint: 'Can delete existing pages, as specified in the Page Rules',
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              permission: 'write:assets',
              hint: 'Can upload assets (such as images and files), as specified in the Page Rules',
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              permission: 'read:comments',
              hint: 'Can view comments, as specified in the Page Rules',
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              permission: 'write:comments',
              hint: 'Can post new comments, as specified in the Page Rules',
              warning: false,
              restrictedForSystem: false,
              disabled: false
            }
          ]
        },
        {
          category: 'Users',
          items: [
            {
              permission: 'write:users',
              hint: 'Can create or authorize new users, but not modify existing ones',
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              permission: 'manage:users',
              hint: 'Can manage all users (but not users with administrative permissions)',
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              permission: 'write:groups',
              hint: 'Can manage groups and assign CONTENT permissions / page rules',
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              permission: 'manage:groups',
              hint: 'Can manage groups and assign ANY permissions (but not manage:system) / page rules',
              warning: true,
              restrictedForSystem: true,
              disabled: false
            }
          ]
        },
        {
          category: 'Administration',
          items: [
            {
              permission: 'manage:navigation',
              hint: 'Can manage the site navigation',
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              permission: 'manage:theme',
              hint: 'Can manage and modify themes',
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              permission: 'manage:api',
              hint: 'Can generate and revoke API keys',
              warning: true,
              restrictedForSystem: true,
              disabled: false
            },
            {
              permission: 'manage:system',
              hint: 'Can manage and access everything. Root administrator.',
              warning: true,
              restrictedForSystem: true,
              disabled: true

            }
          ]
        }
      ],
      users: [],
      headers: [
        { text: 'ID', value: 'id', width: 50, align: 'right' },
        { text: 'Name', value: 'name' },
        { text: 'Email', value: 'email' },
        { text: '', value: 'actions', sortable: false, width: 50 }
      ],
      search: '',
      tab: '1'
    }
  },
  computed: {
    pages () {
      if (this.pagination.rowsPerPage == null || this.pagination.totalItems == null) {
        return 0
      }

      return Math.ceil(this.pagination.totalItems / this.pagination.rowsPerPage)
    }
  },
  watch: {
    group(newValue, oldValue) {
      this.name = newValue.name
    }
  },
  methods: {
    async updateGroup() {
      try {
        await this.$apollo.mutate({
          mutation: updateGroupMutation,
          variables: {
            id: this.group.id,
            name: this.name
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
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'warning'
        })
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
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'warning'
        })
      }
    },
    async assignUser(id) {
      try {
        await this.$apollo.mutate({
          mutation: assignUserMutation,
          variables: {
            groupId: this.group.id,
            userId: id
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-assign')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `User has been assigned to ${this.group.name}.`,
          icon: 'assignment_ind'
        })
        this.$apollo.queries.group.refetch()
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'warning'
        })
      }
    },
    async unassignUser(id) {
      try {
        await this.$apollo.mutate({
          mutation: unassignUserMutation,
          variables: {
            groupId: this.group.id,
            userId: id
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-unassign')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `User has been unassigned from ${this.group.name}.`,
          icon: 'assignment_ind'
        })
        this.$apollo.queries.group.refetch()
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'warning'
        })
      }
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
      update: (data) => data.groups.single,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
