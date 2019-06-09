<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-customer.svg', alt='Users', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Users
            .subheading.grey--text.animated.fadeInLeft.wait-p2s Manage users
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s(outline, color='grey', large, @click='refresh')
            v-icon refresh
          v-btn.animated.fadeInDown(color='primary', large, depressed, @click='createUser')
            v-icon(left) add
            span New User
        v-card.wiki-form.mt-3.animated.fadeInUp
          v-toolbar(flat, :color='$vuetify.dark ? `grey darken-3-d5` : `grey lighten-5`', height='80')
            v-spacer
            v-text-field(
              outline
              v-model='search'
              prepend-inner-icon='search'
              label='Search Users...'
              hide-details
              )
            v-select.ml-2(
              outline
              hide-details
              label='Identity Provider'
              :items='strategies'
              v-model='filterStrategy'
              item-text='title'
              item-value='key'
            )
            v-spacer
          v-divider
          v-data-table(
            v-model='selected'
            :items='usersFiltered',
            :headers='headers',
            :search='search',
            :pagination.sync='pagination',
            :rows-per-page-items='[15]'
            :loading='loading'
            hide-actions,
            disable-initial-sort
          )
            template(slot='headers', slot-scope='props')
              tr
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
              tr.is-clickable(:active='props.selected', @click='$router.push("/users/" + props.item.id)')
                //- td
                  v-checkbox(hide-details, :input-value='props.selected', color='blue darken-2', @click='props.selected = !props.selected')
                td.text-xs-right {{ props.item.id }}
                td: strong {{ props.item.name }}
                td {{ props.item.email }}
                td {{ props.item.providerKey }}
                td {{ props.item.createdAt | moment('from') }}
                td
                  v-tooltip(left, v-if='props.item.isSystem')
                    v-icon(slot='activator') lock_outline
                    span System User
            template(slot='no-data')
              .pa-3
                v-alert(icon='warning', :value='true', outline) No users to display!
          v-card-chin(v-if='this.pages > 1')
            v-spacer
            v-pagination(v-model='pagination.page', :length='pages')
            v-spacer

    user-create(v-model='isCreateDialogShown')
</template>

<script>
import _ from 'lodash'

import usersQuery from 'gql/admin/users/users-query-list.gql'
import providersQuery from 'gql/admin/users/users-query-strategies.gql'

import UserCreate from './admin-users-create.vue'

export default {
  components: {
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
      strategies: [],
      filterStrategy: 'all',
      search: '',
      loading: false,
      isCreateDialogShown: false
    }
  },
  computed: {
    usersFiltered () {
      const all = this.filterStrategy === 'all' || this.filterStrategy === ''
      return _.filter(this.users, u => all || u.providerKey === this.filterStrategy)
    },
    pages () {
      if (this.pagination.rowsPerPage == null || this.usersFiltered.length < 1) {
        return 0
      }

      return Math.ceil(this.usersFiltered.length / this.pagination.rowsPerPage)
    }
  },
  methods: {
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
        this.loading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-refresh')
      }
    },
    strategies: {
      query: providersQuery,
      fetchPolicy: 'network-only',
      update: (data) => {
        return _.concat({
          key: 'all',
          title: 'All'
        }, data.authentication.strategies)
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-strategies-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
