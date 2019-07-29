<template lang="pug">
  v-card.wiki-form
    v-card-title(:class='$vuetify.dark ? `grey darken-3-d3` : `grey lighten-5`')
      v-text-field(
        outline
        flat
        prepend-inner-icon='search'
        v-model='search'
        label='Search Group Users...'
        hide-details
      )
      v-spacer
      v-btn(color='primary', depressed, @click='searchUserDialog = true', :disabled='group.id === 2')
        v-icon(left) assignment_ind
        | Assign User
    v-data-table(
      :items='group.users',
      :headers='headers',
      :search='search'
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
                v-list-item(:to='`/users/` + props.item.id')
                  v-list-item-action: v-icon(color='primary') person
                  v-list-item-content
                    v-list-item-title View User Profile
                template(v-if='props.item.id !== 2')
                  v-divider
                  v-list-item(@click='unassignUser(props.item.id)')
                    v-list-item-action: v-icon(color='orange') highlight_off
                    v-list-item-content
                      v-list-item-title Unassign
      template(slot='no-data')
        v-alert.ma-3(icon='warning', :value='true', outline) No users to display.
    .text-xs-center.py-2(v-if='group.users.length > 15')
      v-pagination(v-model='pagination.page', :length='pages')

    user-search(v-model='searchUserDialog', @select='assignUser')
</template>

<script>
import UserSearch from '../common/user-search.vue'

import assignUserMutation from 'gql/admin/groups/groups-mutation-assign.gql'
import unassignUserMutation from 'gql/admin/groups/groups-mutation-unassign.gql'

export default {
  props: {
    value: {
      type: Object
    }
  },
  components: {
    UserSearch
  },
  data() {
    return {
      headers: [
        { text: 'ID', value: 'id', width: 50, align: 'right' },
        { text: 'Name', value: 'name' },
        { text: 'Email', value: 'email' },
        { text: '', value: 'actions', sortable: false, width: 50 }
      ],
      searchUserDialog: false,
      pagination: {},
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
