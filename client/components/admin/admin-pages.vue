<template lang='pug'>
  v-card(flat)
    v-card(flat, tile, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"').pa-3.pt-4
      .admin-header-icon: v-icon(size='80', color='grey lighten-2') insert_drive_file
      .headline.blue--text.text--darken-2 Pages
      .subheading.grey--text Manage pages
    v-card
      v-card-title
        v-btn(color='primary', dark, slot='activator')
          v-icon(left) add
          | New Page
        v-btn(icon, @click='refresh')
          v-icon.grey--text refresh
        v-spacer
        v-text-field(solo, append-icon='search', label='Search', single-line, hide-details, v-model='search')
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
