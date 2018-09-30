<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          v-icon(size='80', color='grey lighten-2') insert_drive_file
          .admin-header-title
            .headline.blue--text.text--darken-2 Pages
            .subheading.grey--text Manage pages
          v-spacer
          v-btn(color='grey', outline, @click='refresh', large)
            v-icon.grey--text refresh
          v-btn(color='primary', depressed, @click='save', large)
            v-icon(left) add
            span New Page
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
              tr.is-clickable(:active='props.selected', @click='$router.push("/e/" + props.item.id)')
                td.text-xs-right {{ props.item.id }}
                td {{ props.item.name }}
                td {{ props.item.userCount }}
                td {{ props.item.createdAt | moment('calendar') }}
                td {{ props.item.updatedAt | moment('calendar') }}
            template(slot='no-data')
              v-alert.ma-3(icon='warning', :value='true', outline) No pages to display.
          .text-xs-center.py-2(v-if='groups.length > 15')
            v-pagination(v-model='pagination.page', :length='pages')
</template>

<script>

export default {
  data() {
    return {
      selectedGroup: {},
      pagination: {},
      groups: [],
      headers: [
        { text: 'ID', value: 'id', width: 50, align: 'right' },
        { text: 'Title', value: 'title' },
        { text: 'Path', value: 'path' },
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
      // await this.$apollo.queries.groups.refetch()
      this.$store.commit('showNotification', {
        message: 'Pages have been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    }
  }
}
</script>

<style lang='scss'>

</style>
