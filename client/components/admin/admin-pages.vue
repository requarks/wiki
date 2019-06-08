<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-file.svg', alt='Page', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2 Pages
            .subheading.grey--text Manage pages #[v-chip(label, color='primary', small).white--text coming soon]
          v-spacer
          v-btn(color='grey', outline, @click='refresh', large)
            v-icon.grey--text refresh
          v-btn(color='primary', depressed, large, @click='newpage', disabled)
            v-icon(left) add
            span New Page
        v-card.wiki-form.mt-3
          v-toolbar(flat, :color='$vuetify.dark ? `grey darken-3-d5` : `grey lighten-5`', height='80')
            v-spacer
            v-text-field(
              outline
              v-model='search'
              append-icon='search'
              label='Search Pages...'
              single-line
              hide-details
              )
            v-select.ml-2(
              outline
              hide-details
              single-line
              label='Locale'
            )
            v-select.ml-2(
              outline
              hide-details
              single-line
              label='Publish State'
            )
            v-spacer
          v-divider
          v-data-table(
            :items='pages'
            :headers='headers'
            :search='search'
            :pagination.sync='pagination'
            :rows-per-page-items='[15]'
            :loading='loading'
            must-sort,
            hide-actions
          )
            template(slot='items', slot-scope='props')
              tr.is-clickable(:active='props.selected', @click='$router.push(`/pages/` + props.item.id)')
                td.text-xs-right {{ props.item.id }}
                td
                  .body-2 {{ props.item.title }}
                  .caption {{ props.item.description }}
                td.admin-pages-path
                  v-chip(label, small, :color='$vuetify.dark ? `grey darken-4` : `grey lighten-4`') {{ props.item.locale }}
                  span.ml-2.grey--text(:class='$vuetify.dark ? `text--lighten-1` : `text--darken-2`') {{ props.item.path }}
                td {{ props.item.createdAt | moment('calendar') }}
                td {{ props.item.updatedAt | moment('calendar') }}
            template(slot='no-data')
              v-alert.ma-3(icon='warning', :value='true', outline) No pages to display.
          .text-xs-center.py-2(v-if='this.pageTotal > 1')
            v-pagination(v-model='pagination.page', :length='pageTotal')
</template>

<script>
import pagesQuery from 'gql/admin/pages/pages-query-list.gql'

export default {
  data() {
    return {
      selectedPage: {},
      pagination: {},
      pages: [],
      headers: [
        { text: 'ID', value: 'id', width: 50, align: 'right' },
        { text: 'Title', value: 'title' },
        { text: 'Path', value: 'path' },
        { text: 'Created', value: 'createdAt', width: 250 },
        { text: 'Last Updated', value: 'updatedAt', width: 250 }
      ],
      search: '',
      loading: false
    }
  },
  computed: {
    pageTotal () {
      if (this.pagination.rowsPerPage == null || this.pagination.totalItems == null) {
        return 0
      }

      return Math.ceil(this.pages.length / this.pagination.rowsPerPage)
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.pages.refetch()
      this.$store.commit('showNotification', {
        message: 'Page list has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    newpage() {
      this.pageSelectorShown = true
    }
  },
  apollo: {
    pages: {
      query: pagesQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.pages.list,
      watchLoading (isLoading) {
        this.loading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-pages-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.admin-pages-path {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  font-family: 'Roboto Mono', monospace;
}
</style>
