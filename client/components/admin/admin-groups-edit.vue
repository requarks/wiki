<template lang='pug'>
  v-card
    v-card(flat, color='grey lighten-5').pa-3.pt-4
      .headline.blue--text.text--darken-2 Edit Group
      .subheading.grey--text {{group.name}}
      v-btn(color='primary', fab, absolute, bottom, right, small, to='/groups'): v-icon arrow_upward
    v-tabs(v-model='tab', color='grey lighten-4', fixed-tabs, slider-color='primary', show-arrows)
      v-tab(key='properties') Properties
      v-tab(key='rights') Permissions
      v-tab(key='users') Users

      v-tab-item(key='properties', :transition='false', :reverse-transition='false')
        v-card
          v-card-text
            v-text-field(v-model='group.name', label='Group Name', counter='255', prepend-icon='people')
          v-card-actions.pa-3
            v-btn(color='primary', @click='')
              v-icon(left) check
              | Save Changes
            .caption.ml-4.grey--text ID: {{group.id}}
            v-spacer
            v-dialog(v-model='deleteGroupDialog', max-width='500')
              v-btn(color='red', flat, @click='', slot='activator')
                v-icon(left) delete
                | Delete Group
              v-card
                .dialog-header.is-red Delete Group?
                v-card-text Are you sure you want to delete group #[strong {{ group.name }}]? All users will be unassigned from this group.
                v-card-actions
                  v-spacer
                  v-btn(flat, @click='deleteGroupDialog = false') Cancel
                  v-btn(color='red', dark, @click='deleteGroup') Delete

      v-tab-item(key='rights', :transition='false', :reverse-transition='false')
        v-card
          v-card-title.pb-0
            v-subheader
              v-icon.mr-2 border_color
              .subheading Read and Write
            v-spacer
            v-btn(flat, outline)
              v-icon(left) arrow_drop_down
              | Load Preset
            v-btn(flat, outline)
              v-icon(left) vertical_align_bottom
              | Import Rules
          .pa-3.pl-4
            criterias
          v-divider.my-0
          v-card-title.pb-0
            v-subheader
              v-icon.mr-2 pageview
              .subheading Read Only
            v-spacer
            v-btn(flat, outline)
              v-icon(left) arrow_drop_down
              | Load Preset
            v-btn(flat, outline)
              v-icon(left) vertical_align_bottom
              | Import Rules
          .pa-3.pl-4
            criterias
          v-divider.my-0
          v-card-title.pb-0
            v-subheader Legend
          .px-4.pb-4
            .body-1.px-1.py-2 Any number of rules can be used at the same time. However, some rules requires more processing time than others. Rule types are color-coded as followed:
            .caption
              v-icon(color='blue') stop
              span Fast rules. None or insignificant latency introduced to all page loads.
            .caption
              v-icon(color='orange') stop
              span Medium rules. Some latency added to all page loads.
            .caption
              v-icon(color='red') stop
              span Slow rules. May adds noticeable latency to all page loads. Avoid using in multiple rules.

      v-tab-item(key='users', :transition='false', :reverse-transition='false')
        v-card
          v-card-title.pb-0
            v-btn(color='primary', @click='assignUser')
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
                      v-list-tile(@click='deleteGroupConfirm(props.item)')
                        v-list-tile-action: v-icon(color='orange') highlight_off
                        v-list-tile-content
                          v-list-tile-title Unassign
            template(slot='no-data')
              v-alert.ma-3(icon='warning', :value='true', outline) No users to display.
          .text-xs-center.py-2(v-if='users.length > 15')
            v-pagination(v-model='pagination.page', :length='pages')

    user-search(v-model='searchUserDialog')
</template>

<script>
import Criterias from '../common/criterias.vue'
import UserSearch from '../common/user-search.vue'

import groupQuery from 'gql/admin-groups-query-single.gql'
import deleteGroupMutation from 'gql/admin-groups-mutation-delete.gql'

export default {
  components: {
    Criterias,
    UserSearch
  },
  data() {
    return {
      group: {
        id: 7,
        name: 'Editors',
        users: []
      },
      deleteGroupDialog: false,
      searchUserDialog: false,
      pagination: {},
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
  methods: {
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
    assignUser() {
      this.searchUserDialog = true
    }
  },
  apollo: {
    group: {
      query: groupQuery,
      variables() {
        return {
          id: this.$route.params.id
        }
      },
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
