<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          v-icon(size='80', color='grey lighten-2') people
          .admin-header-title
            .headline.blue--text.text--darken-2 Groups
            .subheading.grey--text Manage groups and their permissions
          v-spacer
          v-btn(color='grey', outline, @click='refresh', large)
            v-icon refresh
          v-dialog(v-model='newGroupDialog', max-width='500')
            v-btn(color='primary', depressed, slot='activator', large)
              v-icon(left) add
              span New Group
            v-card
              .dialog-header.is-short New Group
              v-card-text
                v-text-field(v-model='newGroupName', label='Group Name', autofocus, counter='255', @keyup.enter='createGroup')
              v-card-chin
                v-spacer
                v-btn(flat, @click='newGroupDialog = false') Cancel
                v-btn(color='primary', @click='createGroup') Create
        v-card.mt-3
          v-data-table(
            :items='groups'
            :headers='headers'
            :search='search'
            :pagination.sync='pagination'
            :rows-per-page-items='[15]'
            hide-actions
          )
            template(slot='items', slot-scope='props')
              tr.is-clickable(:active='props.selected', @click='$router.push("/groups/" + props.item.id)')
                td.text-xs-right {{ props.item.id }}
                td {{ props.item.name }}
                td {{ props.item.userCount }}
                td {{ props.item.createdAt | moment('calendar') }}
                td {{ props.item.updatedAt | moment('calendar') }}
            template(slot='no-data')
              v-alert.ma-3(icon='warning', :value='true', outline) No groups to display.
          .text-xs-center.py-2(v-if='groups.length > 15')
            v-pagination(v-model='pagination.page', :length='pages')
</template>

<script>
import _ from 'lodash'

import groupsQuery from 'gql/admin/groups/groups-query-list.gql'
import createGroupMutation from 'gql/admin/groups/groups-mutation-create.gql'
import deleteGroupMutation from 'gql/admin/groups/groups-mutation-delete.gql'

export default {
  data() {
    return {
      newGroupDialog: false,
      newGroupName: '',
      selectedGroup: {},
      pagination: {},
      groups: [],
      headers: [
        { text: 'ID', value: 'id', width: 50, align: 'right' },
        { text: 'Name', value: 'name' },
        { text: 'Users', value: 'userCount', width: 200 },
        { text: 'Created', value: 'createdAt', width: 250 },
        { text: 'Last Updated', value: 'updatedAt', width: 250 }
      ],
      search: ''
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
  methods: {
    async refresh() {
      await this.$apollo.queries.groups.refetch()
      this.$store.commit('showNotification', {
        message: 'Groups have been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    async createGroup() {
      this.newGroupDialog = false
      try {
        await this.$apollo.mutate({
          mutation: createGroupMutation,
          variables: {
            name: this.newGroupName
          },
          update (store, resp) {
            const data = _.get(resp, 'data.groups.create', { responseResult: {} })
            if (data.responseResult.succeeded === true) {
              const apolloData = store.readQuery({ query: groupsQuery })
              data.group.userCount = 0
              apolloData.groups.list.push(data.group)
              store.writeQuery({ query: groupsQuery, data: apolloData })
            } else {
              throw new Error(data.responseResult.message)
            }
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-create')
          }
        })
        this.newGroupName = ''
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Group has been created successfully.`,
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
    async deleteGroupConfirm(group) {
      this.deleteGroupDialog = true
      this.selectedGroup = group
    },
    async deleteGroup() {
      this.deleteGroupDialog = false
      try {
        await this.$apollo.mutate({
          mutation: deleteGroupMutation,
          variables: {
            id: this.selectedGroup.id
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-delete')
          }
        })
        await this.$apollo.queries.groups.refetch()
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Group ${this.selectedGroup.name} has been deleted.`,
          icon: 'delete'
        })
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
    groups: {
      query: groupsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.groups.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
