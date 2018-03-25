<template lang='pug'>
  v-card(flat)
    v-card(flat, color='grey lighten-5').pa-3.pt-4
      .headline.blue--text.text--darken-2 Groups
      .subheading.grey--text Manage groups and their permissions
    v-card
      v-card-title
        v-dialog(v-model='newGroupDialog', max-width='500')
          v-btn(color='primary', dark, slot='activator')
            v-icon(left) add
            | New Group
          v-card
            .dialog-header.is-short New Group
            v-card-text
              v-text-field(v-model='newGroupName', label='Group Name', autofocus, counter='255')
            v-card-actions
              v-spacer
              v-btn(flat, @click='newGroupDialog = false') Cancel
              v-btn(color='primary', @click='createGroup') Create
        v-btn(icon, @click='refresh')
          v-icon.grey--text refresh
        v-spacer
        v-text-field(append-icon='search', label='Search', single-line, hide-details, v-model='search')
      v-data-table(
        v-model='selected'
        :items='groups',
        :headers='headers',
        :search='search',
        :pagination.sync='pagination',
        :rows-per-page-items='[15]'
        hide-actions,
        disable-initial-sort
      )
        template(slot='items', slot-scope='props')
          tr(:active='props.selected')
            td.text-xs-right {{ props.item.id }}
            td {{ props.item.name }}
            td {{ props.item.userCount }}
            td: v-btn(icon): v-icon.grey--text.text--darken-1 more_horiz
        template(slot='no-data')
          v-alert.ma-3(icon='warning', :value='true', outline) No groups to display.
      .text-xs-center.py-2(v-if='groups.length > 15')
        v-pagination(v-model='pagination.page', :length='pages')
</template>

<script>
import _ from 'lodash'

import groupsQuery from 'gql/admin-groups-query-list.gql'
import createGroupMutation from 'gql/admin-groups-mutation-create.gql'

export default {
  data() {
    return {
      newGroupDialog: false,
      newGroupName: '',
      selected: [],
      pagination: {},
      groups: [],
      headers: [
        { text: 'ID', value: 'id', width: 50, align: 'right' },
        { text: 'Name', value: 'name' },
        { text: 'Users', value: 'userCount', width: 200 },
        { text: '', value: 'actions', sortable: false, width: 50 }
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
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Group has been created successfully.`,
          icon: 'check'
        })
      } catch (err) {

      }
    }
  },
  apollo: {
    groups: {
      query: groupsQuery,
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
