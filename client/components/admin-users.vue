<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.blue--text.text--darken-2 Users
        .subheading.grey--text Manage users
        v-card.mt-3.elevation-1
          v-card-title
            v-btn(color='primary', dark)
              v-icon(left) add
              | New User
            v-btn(color='primary', dark)
              v-icon(left) lock_outline
              | Authorize User
            v-btn(icon)
              v-icon.grey--text refresh
            v-spacer
            v-text-field(append-icon='search', label='Search', single-line, hide-details, v-model='search')
          v-data-table(
            v-model='selected'
            :items='items',
            :headers='headers',
            :search='search',
            :pagination.sync='pagination',
            :rows-per-page-items='[15]'
            select-all,
            hide-actions,
            disable-initial-sort
          )
            template(slot='headers', slot-scope='props')
              tr
                th(width='50')
                th.text-xs-right(
                  width='80'
                  :class='[`column sortable`, pagination.descending ? `desc` : `asc`, pagination.sortBy === `id` ? `active` : ``]'
                  @click='changeSort(`id`)'
                )
                  v-icon(small) arrow_upward
                  | ID
                th.text-xs-left(
                  v-for='header in props.headers'
                  :key='header.text'
                  :width='header.width'
                  :class='[`column sortable`, pagination.descending ? `desc` : `asc`, header.value === pagination.sortBy ? `active` : ``]'
                  @click='changeSort(header.value)'
                )
                  | {{ header.text }}
                  v-icon(small) arrow_upward
            template(slot='items', slot-scope='props')
              tr(:active='props.selected')
                td
                  v-checkbox(hide-details, :input-value='props.selected', color='blue darken-2', @click='props.selected = !props.selected')
                td.text-xs-right {{ props.item.id }}
                td {{ props.item.email }}
                td {{ props.item.name }}
                td {{ props.item.provider }}
                td {{ props.item.createdOn }}
                td {{ props.item.updatedOn }}
                td: v-btn(icon): v-icon.grey--text.text--darken-1 more_horiz
            template(slot='no-data')
              v-alert(icon='warning', :value='true') No users to display!
          .text-xs-center.py-2
            v-pagination(v-model='pagination.page', :length='pages')
</template>

<script>
export default {
  data() {
    return {
      selected: [],
      pagination: {},
      items: [
        { id: 1, email: 'user@test.com', name: 'John Doe', provider: 'local' },
        { id: 2, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 3, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 4, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 5, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 6, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 7, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 8, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 9, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 10, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 11, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 12, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 13, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 14, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 15, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 16, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 17, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 18, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 19, email: 'dude@test.com', name: 'John Doe', provider: 'local' },
        { id: 20, email: 'dude@test.com', name: 'John Doe', provider: 'local' }
      ],
      headers: [
        { text: 'Email', value: 'email' },
        { text: 'Name', value: 'name' },
        { text: 'Provider', value: 'provider' },
        { text: 'Created On', value: 'createdOn' },
        { text: 'Updated On', value: 'updatedOn' },
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
  }
}
</script>

<style lang='scss'>

</style>
