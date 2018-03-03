<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.blue--text.text--darken-2 Users
        .subheading.grey--text Manage users
        v-card.mt-3.elevation-1
          v-card-title
            v-btn() New User
            v-btn() Authorize User
            v-spacer
            v-text-field(append-icon='search', label='Search', single-line, hide-details, v-model='search')
          v-data-table(
            v-model='selected'
            :items='items',
            :headers='headers',
            :search='search',
            :pagination.sync='pagination',
            select-all,
            hide-actions
          )
            template(slot='items', slot-scope='props')
              tr(:active='props.selected', @click='props.selected = !props.selected')
                td
                  v-checkbox(hide-details, :input-value='props.selected')
                td.text-xs-right {{ props.item.id }}
                td {{ props.item.email }}
                td {{ props.item.name }}
                td {{ props.item.provider }}
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
        { id: 1, email: 'user@test.com', name: 'John Doe', provider: 'local' }
      ],
      headers: [
        {
          text: 'ID',
          align: 'right',
          value: 'id',
          width: 80
        },
        { text: 'Email', value: 'email' },
        { text: 'Name', value: 'name' },
        { text: 'Provider', value: 'provider' },
        { text: 'Created On', value: 'createdOn' },
        { text: 'Updated On', value: 'updatedOn' },
        { text: 'Actions', value: 'actions', sortable: false }
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
  }
}
</script>

<style lang='scss'>

</style>
