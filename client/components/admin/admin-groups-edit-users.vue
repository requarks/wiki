<template lang="pug">
  v-card(flat)
    v-card-title.pb-4(:class='$vuetify.theme.dark ? `grey darken-3-d3` : `grey lighten-5`')
      v-text-field(
        outlined
        flat
        prepend-inner-icon='mdi-magnify'
        v-model='search'
        label='Search Group Users...'
        hide-details
        dense
        style='max-width: 450px;'
      )
      v-spacer
      v-btn(color='primary', depressed, @click='searchUserDialog = true', :disabled='group.id === 2')
        v-icon(left) mdi-clipboard-account
        | Assign User
    v-data-table(
      :items='group.users',
      :headers='headers',
      :search='search'
      :page.sync='pagination'
      :items-per-page='15'
      @page-count='pageCount = $event'
      must-sort,
      hide-default-footer
    )
      template(v-slot:item.actions='{ item }')
        v-menu(bottom, right, min-width='200')
          template(v-slot:activator='{ on }')
            v-btn(icon, v-on='on', small)
              v-icon.grey--text.text--darken-1 mdi-dots-horizontal
          v-list(dense, nav)
            v-list-item(:to='`/users/` + item.id')
              v-list-item-action: v-icon(color='primary') mdi-account-outline
              v-list-item-content
                v-list-item-title View User Profile
            template(v-if='item.id !== 2')
              v-list-item(@click='unassignUser(item.id)')
                v-list-item-action: v-icon(color='orange') mdi-account-remove-outline
                v-list-item-content
                  v-list-item-title Unassign
      template(slot='no-data')
        v-alert.ma-3(icon='mdi-alert', outlined) No users to display.
    .text-center.py-2(v-if='group.users.length > 15')
      v-pagination(v-model='pagination', :length='pageCount')

    user-search(
      v-model="searchUserDialog"
      :default-group="group.id"
      @select="assignUser"
      @user-created-and-assigned="refreshGroupPage"
    )
    page-last-group(
      v-model='warningPageModel', :sites='affectedSites', :user-name='pendingUnassignUserName', @discard='resetUnassignState', @confirm='finalUnassignUser(pendingUnassignUser)'
    )
</template>

<script>
import UserSearch from '../common/user-search.vue'

import assignUserMutation from 'gql/admin/groups/groups-mutation-assign.gql'
import unassignUserMutation from 'gql/admin/groups/groups-mutation-unassign.gql'
import groupsQueryLastGroupOfSite from 'gql/admin/groups/groups-query-last-group-site.gql'
import gql from 'graphql-tag'
export default {
  props: {
    value: {
      type: Object,
      default: () => ({})
    }
  },
  components: {
    UserSearch,
    PageLastGroup: () => import('../common/page-last-group.vue')
  },
  data() {
    return {
      headers: [
        { text: 'ID', value: 'id', width: 70 },
        { text: 'Name', value: 'name' },
        { text: 'Email', value: 'email' },
        { text: 'Actions', value: 'actions', sortable: false, width: 50 }
      ],
      searchUserDialog: false,
      pagination: 1,
      pageCount: 0,
      search: '',
      warningPageModel: false,
      pendingUnassignUser: null,
      pendingUnassignUserName: '',
      affectedSites: []
    }
  },
  computed: {
    group: {
      get() { return this.value },
      set(val) { this.$set('input', val) }
    },
    pages () {
      if (this.pagination.rowsPerPage == null || this.pagination.totalItems == null) {
        return 0
      }

      return Math.ceil(this.pagination.totalItems / this.pagination.rowsPerPage)
    }
  },
  methods: {
    async assignUser(user) {
      try {
        // Assign the user to the group
        await this.$apollo.mutate({
          mutation: assignUserMutation,
          variables: {
            groupId: this.group.id,
            userId: user.id
          }
        })

        this.$store.commit('showNotification', {
          style: 'success',
          message: `${user.name} has been added to the group and notified by email.`,
          icon: 'check'
        })

        // Add this line to refresh the group user list
        this.$emit('refresh')
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async unassignUser(id) {
      const { data } = await this.isLastGroupOfSite(id)
      const lastGroupInfo = data.isLastGroupForSiteGeneric

      if (lastGroupInfo.isLastGroupForAnySite) {
        this.pendingUnassignUser = id
        const user = this.group.users.find(u => u.id === id)
        this.pendingUnassignUserName = user ? user.name : 'The user'
        this.affectedSites = lastGroupInfo.affectedSites
        this.warningPageModel = true
        return
      }
      this.finalUnassignUser(id)
    },
    async finalUnassignUser(id) {
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
        this.pendingUnassignUser = null
        this.pendingUnassignUserName = ''
        this.affectedSites = []
        this.$emit('refresh')
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'warning'
        })
      }
    },
    async isLastGroupOfSite(userId) {
      return this.$apollo.query({
        query: groupsQueryLastGroupOfSite,
        variables: {
          userId: userId,
          groupIds: this.group.id
        },
        fetchPolicy: 'network-only'
      })
    },
    resetUnassignState() {
      this.warningPageModel = false
      this.pendingUnassignUser = null
      this.pendingUnassignUserName = ''
      this.affectedSites = []
    },
    async loadGroupData() {
      try {
        const { data } = await this.$apollo.query({
          query: gql`
            query GetGroup($id: Int!) {
              groupById(id: $id) {
                id
                name
                users {
                  id
                  name
                  email
                }
                # add other fields as needed
              }
            }
          `,
          variables: { id: this.group.id },
          fetchPolicy: 'network-only'
        })
        // Update the group data
        this.$emit('input', data.groupById)
      } catch (err) {
        console.error('Error refreshing group data:', err) // Log the error for debugging
        this.$store.commit('showNotification', {
          style: 'error',
          message: 'Failed to refresh group data. Please try again later.',
          icon: 'alert'
        })
        // Optionally, you can implement a fallback action here
      }
    },
    refreshGroupPage() {
      this.loadGroupData()
    }
  }
}
</script>
