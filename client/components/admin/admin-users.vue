<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          v-icon(size='80', color='grey lighten-2') perm_identity
          .admin-header-title
            .headline.blue--text.text--darken-2 Users
            .subheading.grey--text Manage users
          v-spacer
          v-btn(outline, color='grey', large, @click='refresh')
            v-icon refresh
          v-btn(color='primary', large, depressed, @click='authorizeUser')
            v-icon(left) lock_outline
            span Authorize Social User
          v-btn(color='primary', large, depressed, @click='createUser')
            v-icon(left) add
            span New Local User
        v-card.mt-3
          v-data-table(
            v-model='selected'
            :items='users',
            :headers='headers',
            :search='search',
            :pagination.sync='pagination',
            :rows-per-page-items='[15]'
            hide-actions,
            disable-initial-sort
          )
            template(slot='headers', slot-scope='props')
              tr
                //- th(width='50')
                th.text-xs-left(
                  v-for='header in props.headers'
                  :key='header.text'
                  :width='header.width'
                  :class='[`column`, header.sortable ? `sortable` : ``, pagination.descending ? `desc` : `asc`, header.value === pagination.sortBy ? `active` : ``]'
                  @click='changeSort(header.value)'
                )
                  | {{ header.text }}
                  v-icon(small, v-if='header.sortable') arrow_upward
            template(slot='items', slot-scope='props')
              tr(:active='props.selected')
                //- td
                  v-checkbox(hide-details, :input-value='props.selected', color='blue darken-2', @click='props.selected = !props.selected')
                td.text-xs-right {{ props.item.id }}
                td: strong {{ props.item.name }}
                td {{ props.item.email }}
                td {{ props.item.providerKey }}
                td {{ props.item.createdAt | moment('from') }}
                td
                  v-menu(bottom, right, min-width='200')
                    v-btn(icon, slot='activator'): v-icon.grey--text.text--darken-1 more_horiz
                    v-list
                      v-list-tile(@click='')
                        v-list-tile-action
                          v-icon(color='primary') edit
                        v-list-tile-content
                          v-list-tile-title Edit
                      v-list-tile(@click='')
                        v-list-tile-action
                          v-icon(color='red') block
                        v-list-tile-content
                          v-list-tile-title Block
            template(slot='no-data')
              .pa-3
                v-alert(icon='warning', :value='true', outline) No users to display!
          .text-xs-center.py-2
            v-pagination(v-model='pagination.page', :length='pages')

    user-authorize(v-model='isAuthorizeDialogShown')
    user-create(v-model='isCreateDialogShown')
</template>

<script>
import usersQuery from 'gql/admin/users/users-query-list.gql'

import UserAuthorize from './admin-users-authorize.vue'
import UserCreate from './admin-users-create.vue'

export default {
  components: {
    UserAuthorize,
    UserCreate
  },
  data() {
    return {
      selected: [],
      pagination: {},
      users: [],
      headers: [
        { text: 'ID', value: 'id', width: 80, sortable: true },
        { text: 'Name', value: 'name', sortable: true },
        { text: 'Email', value: 'email', sortable: true },
        { text: 'Provider', value: 'provider', sortable: true },
        { text: 'Created', value: 'createdAt', sortable: true },
        { text: '', value: 'actions', sortable: false, width: 50 }
      ],
      search: '',
      isAuthorizeDialogShown: false,
      isCreateDialogShown: false
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
    authorizeUser() {
      this.isAuthorizeDialogShown = true
    },
    createUser() {
      this.isCreateDialogShown = true
    },
    async refresh() {
      await this.$apollo.queries.users.refetch()
      this.$store.commit('showNotification', {
        message: 'Users list has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    changeSort (column) {
      if (this.pagination.sortBy === column) {
        this.pagination.descending = !this.pagination.descending
      } else {
        this.pagination.sortBy = column
        this.pagination.descending = false
      }
    },
    toggleAll () {
      if (this.selected.length) {
        this.selected = []
      } else {
        this.selected = this.items.slice()
      }
    }
  },
  apollo: {
    users: {
      query: usersQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.users.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
