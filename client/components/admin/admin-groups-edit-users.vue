<template lang="pug">
  v-card
    v-card-title.pb-4(:class='$vuetify.theme.dark ? `grey darken-3-d3` : `grey lighten-5`')
      v-text-field(
        outlined
        flat
        prepend-inner-icon='mdi-magnify'
        v-model='search'
        label='Search Group Users...'
        hide-details
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

    user-search(v-model='searchUserDialog', @select='assignUser')
</template>

<script>
import UserSearch from '../common/user-search.vue'

import assignUserMutation from 'gql/admin/groups/groups-mutation-assign.gql'
import unassignUserMutation from 'gql/admin/groups/groups-mutation-unassign.gql'

export default {
  props: {
    value: {
      type: Object,
      default: () => ({})
    }
  },
  components: {
    UserSearch
  },
  data() {
    return {
      headers: [
        { text: 'ID', value: 'id', width: 50 },
        { text: 'Name', value: 'name' },
        { text: 'Email', value: 'email' },
        { text: 'Actions', value: 'actions', sortable: false, width: 50 }
      ],
      searchUserDialog: false,
      pagination: 1,
      pageCount: 0,
      search: ''
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
        this.$emit('refresh')
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
        this.$emit('refresh')
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'warning'
        })
      }
    }
  }
}
</script>
