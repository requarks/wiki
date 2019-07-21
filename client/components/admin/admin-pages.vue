<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-file.svg', alt='Page', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Pages
            .subheading.grey--text.animated.fadeInLeft.wait-p2s Manage pages
          v-spacer
          v-btn.animated.fadeInDown.wait-p1s(color='grey', outline, @click='refresh', large)
            v-icon.grey--text refresh
          v-btn.animated.fadeInDown(color='primary', outline, large, @click='recyclebin', disabled)
            v-icon(left) delete_outline
            span Recycle Bin
          v-btn.animated.fadeInDown(color='primary', depressed, large, @click='newpage', disabled)
            v-icon(left) add
            span New Page
        v-card.wiki-form.mt-3.animated.fadeInUp
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
              :items='langs'
              v-model='selectedLang'
            )
            v-select.ml-2(
              outline
              hide-details
              single-line
              label='Publish State'
              :items='states'
              v-model='selectedState'
            )
            v-spacer
          v-divider
          v-data-table(
            :items='filteredPages'
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
          .text-xs-center.py-2.animated.fadeInDown(v-if='this.pageTotal > 1')
            v-pagination(v-model='pagination.page', :length='pageTotal')
</template>

<script>
import _ from 'lodash'
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
      selectedLang: null,
      selectedState: null,
      states: [
        { text: 'All Publishing States', value: null },
        { text: 'Published', value: true },
        { text: 'Not Published', value: false }
      ],
      loading: false
    }
  },
  computed: {
    pageTotal () {
      if (this.pagination.rowsPerPage == null || this.pagination.totalItems == null) {
        return 0
      }

      return Math.ceil(this.filteredPages.length / this.pagination.rowsPerPage)
    },
    filteredPages () {
      return _.filter(this.pages, pg => {
        if (this.selectedLang !== null && this.selectedLang !== pg.locale) {
          return false
        }
        if (this.selectedState !== null && this.selectedState !== pg.isPublished) {
          return false
        }
        return true
      })
    },
    langs () {
      return _.concat({
        text: 'All Locales',
        value: null
      }, _.uniqBy(this.pages, 'locale').map(pg => ({
        text: pg.locale,
        value: pg.locale
      })))
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
    },
    recyclebin () { }
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
