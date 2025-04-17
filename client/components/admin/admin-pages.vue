<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Page', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Pages
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Manage pages
          v-spacer
          v-btn.animated.fadeInDown.wait-p1s(icon, color='grey', outlined, @click='refresh')
            v-icon.grey--text mdi-refresh
          v-btn.animated.fadeInDown.mx-3(color='primary', outlined, @click='recyclebin', disabled)
            v-icon(left) mdi-delete-outline
            span Recycle Bin
          v-btn.animated.fadeInDown(color='primary', depressed, large, to='pages/visualize')
            v-icon(left) mdi-graph
            span Visualize
        v-card.mt-3.animated.fadeInUp
          .pa-2.d-flex.align-center(:class='$vuetify.theme.dark ? `grey darken-3-d5` : `grey lighten-3`')
            v-text-field(
              solo
              flat
              v-model='search'
              prepend-inner-icon='mdi-file-search-outline'
              label='Search Pages...'
              hide-details
              dense
              style='max-width: 400px;'
              )
            v-select.ml-2(
              solo
              flat
              hide-details
              dense
              label='Paths'
              :items='paths'
              v-model='selectedPath'
              style='max-width: 250px;'
            )
            v-spacer
            v-select.ml-2(
              solo
              flat
              hide-details
              dense
              label='Locale'
              :items='langs'
              v-model='selectedLang'
              style='max-width: 250px;'
            )
            v-select.ml-2(
              solo
              flat
              hide-details
              dense
              label='Publish State'
              :items='states'
              v-model='selectedState'
              style='max-width: 250px;'
            )
          v-divider
          v-data-table(
            :items='filteredPages'
            :headers='headers'
            :search='search'
            :page.sync='pagination'
            :items-per-page='50'
            :loading='loading'
            must-sort,
            sort-by='updatedAt',
            sort-desc,
            hide-default-footer
            @page-count="pageTotal = $event"
          )
            template(slot='item', slot-scope='props')
              tr.is-clickable(:active='props.selected', @click='$router.push(`/pages/` + props.item.id)')
                td.text-xs-right {{ props.item.id }}
                td
                  .body-2: strong {{ props.item.title }}
                  .caption {{ props.item.description }}
                td.admin-pages-path
                  v-chip(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`') {{ props.item.locale }}
                  span.ml-2.grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-2`') / {{ props.item.path }}
                td {{ props.item.createdAt | moment('calendar') }}
                td {{ props.item.updatedAt | moment('calendar') }}
                td
                  v-edit-dialog(
                    :return-value.sync='props.item.orderPriority'
                    @save='savePriority(props.item)'
                    large
                  )
                    div {{ props.item.orderPriority }}
                    template(v-slot:input)
                      v-text-field(
                        v-model='props.item.orderPriority'
                        type='number'
                        label='Edit Priority'
                        single-line
                        autofocus
                        :rules='[v => !!v || "Priority is required", v => v >= 0 || "Must be positive"]'
                      )
            template(slot='no-data')
              v-alert.ma-3(icon='mdi-alert', :value='true', outlined) No pages to display.
          .text-center.py-2.animated.fadeInDown(v-if='this.pageTotal > 1')
            v-pagination(v-model='pagination', :length='pageTotal')
</template>

<script>
import _ from 'lodash'
import pagesQuery from 'gql/admin/pages/pages-query-list.gql'

export default {
  data() {
    return {
      selectedPage: {},
      pagination: 1,
      pages: [],
      pageTotal: 0,
      headers: [
        { text: 'ID', value: 'id', width: 80, sortable: true },
        { text: 'Title', value: 'title' },
        { text: 'Path', value: 'path' },
        { text: 'Created', value: 'createdAt', width: 250 },
        { text: 'Last Updated', value: 'updatedAt', width: 250 },
        { text: 'Order Priority', value: 'orderPriority', width: 150 }
      ],
      search: '',
      selectedLang: null,
      selectedState: null,
      selectedPath: null,
      states: [
        { text: 'All Publishing States', value: null },
        { text: 'Published', value: true },
        { text: 'Not Published', value: false }
      ],
      paths: [],
      loading: false
    }
  },
  computed: {
    filteredPages () {
      return _.filter(this.pages, pg => {
        if (this.selectedPath !== null && !pg.path.startsWith(this.selectedPath)) {
          return false
        }
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

      this.paths = [{ text: 'aaa', value: null }]
    },
    updatePathSelector(pages) {
      const paths = Array.from(new Set(pages.filter(p => p.path.includes('/')).map(p => p.path.split('/')[0])))

      this.paths = [
        { text: 'Select path', value: null },
        ...paths.sort().map(p => ({ text: p, value: p }))
      ]
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
      update: function (data) {
        const pages = data.pages.list.map(p => {
          console.log('randomed')
          p.orderPriority = Math.round(Math.random() * 100)
          return p
        })

        this.updatePathSelector(pages)

        return pages
      },
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

.v-edit-dialog {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;

  &__input {
    padding: 16px;
  }
}
</style>
