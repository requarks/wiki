<template lang='pug'>
  v-container.admin-pages-list(fluid, :class='containerClass')
    v-layout(row wrap)
      v-flex(xs12)
        .admin-pages-list__header(v-if='isMobile')
          .admin-pages-list__topbar
            .admin-pages-list__title Pages
            .admin-pages-list__actions
              v-btn(icon, small, outlined, color='grey', @click='refresh', aria-label='Refresh')
                v-icon.grey--text mdi-refresh
              v-btn(icon, small, color='primary', depressed, to='pages/visualize', aria-label='Visualize')
                v-icon mdi-graph
        .admin-header(v-else)
          .admin-header__brand
            img.admin-header__icon.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Page')
            .admin-header-title
              .headline.blue--text.text--darken-2.animated.fadeInLeft Pages
              .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Manage pages
          .admin-header__actions
            v-btn.animated.fadeInDown.wait-p1s(icon, color='grey', outlined, @click='refresh', aria-label='Refresh')
              v-icon.grey--text mdi-refresh
            v-btn.animated.fadeInDown(color='primary', depressed, large, to='pages/visualize')
              v-icon(left) mdi-graph
              span Visualize
        v-card(:class='isMobile ? `mt-2` : `mt-3`', flat, :outlined='isMobile')
          .admin-pages-toolbar.pa-2(:class='$vuetify.theme.dark ? `grey darken-3-d5` : `grey lighten-3`')
            v-text-field.admin-pages-toolbar__search(
              solo
              flat
              v-model='search'
              prepend-inner-icon='mdi-file-search-outline'
              label='Search Pages...'
              hide-details
              dense
              )
            .admin-pages-toolbar__filters
              v-select.admin-pages-toolbar__filter(
                solo
                flat
                hide-details
                dense
                label='Locale'
                :items='langs'
                v-model='selectedLang'
              )
              v-select.admin-pages-toolbar__filter(
                solo
                flat
                hide-details
                dense
                label='Publish State'
                :items='states'
                v-model='selectedState'
              )
              .admin-pages-toolbar__sort
                v-select.admin-pages-toolbar__filter.admin-pages-toolbar__sort-select(
                  solo
                  flat
                  hide-details
                  dense
                  label='Sort By'
                  :items='sortOptions'
                  v-model='sortBy'
                )
                v-btn.admin-pages-toolbar__sort-toggle(
                  icon
                  small
                  :aria-label='sortDesc ? `Sort descending` : `Sort ascending`'
                  @click='toggleSortDirection'
                )
                  v-icon {{ sortDesc ? 'mdi-sort-descending' : 'mdi-sort-ascending' }}
          v-divider
          .admin-pages-table-wrap
            v-data-table.admin-pages-table(
              :items='filteredPages'
              :headers='tableHeaders'
              :search='search'
              :page.sync='pagination'
              :items-per-page='15'
              :loading='loading'
              :mobile-breakpoint='0'
              :disable-sort='isMobile'
              :sort-by='sortBy'
              :sort-desc='sortDesc'
              hide-default-footer
              @page-count="pageTotal = $event"
            )
              template(slot='item', slot-scope='props')
                tr.is-clickable(:active='props.selected', @click='$router.push(`/pages/` + props.item.id)')
                  td.text-xs-right(v-if='!isMobile') {{ props.item.id }}
                  td.admin-pages-title
                    .body-2: strong {{ props.item.title }}
                    .caption {{ props.item.description }}
                  td.admin-pages-path
                    v-chip(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`') {{ props.item.locale }}
                    span.ml-2.grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-2`') / {{ props.item.path }}
                  td {{ props.item.createdAt | moment('calendar') }}
                  td {{ props.item.updatedAt | moment('calendar') }}
              template(slot='no-data')
                v-alert.ma-3(icon='mdi-alert', :value='true', outlined) No pages to display.
          .admin-pages-pagination.animated.fadeInDown(v-if='pageTotal > 1')
            v-pagination(v-model='pagination', :length='pageTotal', :total-visible='paginationTotalVisible')
</template>

<script>
import _ from 'lodash'
import pagesQuery from 'gql/admin/pages/pages-query-list.gql'

export default {
  data() {
    return {
      selectedPage: {},
      pagination: 1,
      adminPagesList: [],
      pageTotal: 0,
      headers: [
        { text: 'ID', value: 'id', width: 80, sortable: true, align: 'end' },
        { text: 'Title', value: 'title', width: 360, sortable: true },
        { text: 'Path', value: 'path', width: 220, sortable: true },
        { text: 'Created', value: 'createdAt', width: 160, sortable: true },
        { text: 'Last Updated', value: 'updatedAt', width: 160, sortable: true }
      ],
      search: '',
      selectedLang: null,
      selectedState: null,
      sortBy: 'updatedAt',
      sortDesc: true,
      sortOptions: [
        { text: 'Last Updated', value: 'updatedAt' },
        { text: 'Created', value: 'createdAt' },
        { text: 'Title', value: 'title' },
        { text: 'ID', value: 'id' }
      ],
      states: [
        { text: 'All Publishing States', value: null },
        { text: 'Published', value: true },
        { text: 'Not Published', value: false }
      ],
      loading: false
    }
  },
  computed: {
    isMobile () {
      return this.$vuetify.breakpoint.smAndDown
    },
    containerClass () {
      return {
        'grid-list-lg': this.$vuetify.breakpoint.mdAndUp,
        'pa-2': this.isMobile,
        'admin-pages-container': true
      }
    },
    tableHeaders () {
      if (this.isMobile) {
        return [
          { text: 'Title', value: 'title', width: 280, sortable: false },
          { text: 'Path', value: 'path', width: 200, sortable: false },
          { text: 'Created', value: 'createdAt', width: 140, sortable: false },
          { text: 'Last Updated', value: 'updatedAt', width: 140, sortable: false }
        ]
      }
      return this.headers
    },
    filteredPages () {
      return _.filter(this.adminPagesList, pg => {
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
      }, _.uniqBy(this.adminPagesList, 'locale').map(pg => ({
        text: pg.locale,
        value: pg.locale
      })))
    },
    paginationTotalVisible () {
      return this.isMobile ? 5 : 9
    }
  },
  methods: {
    toggleSortDirection () {
      this.sortDesc = !this.sortDesc
    },
    async refresh() {
      await this.$apollo.queries.adminPagesList.refetch()
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
    adminPagesList: {
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
.admin-pages-list {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;

  &__header {
    margin-bottom: 8px;
  }

  &__topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  &__title {
    font-size: 1.125rem;
    font-weight: 500;
    color: mc('theme', 'primary');

    @at-root .theme--dark & {
      color: mc('blue', '300');
    }
  }

  &__actions {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
  }

  > .layout {
    margin-left: 0 !important;
    margin-right: 0 !important;
    width: 100%;
    max-width: 100%;
  }

  > .layout > .flex {
    padding-left: 0 !important;
    padding-right: 0 !important;
    max-width: 100%;
    min-width: 0;
  }
}

.admin-pages-path {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  flex-wrap: wrap;
  font-family: 'Roboto Mono', monospace;
  word-break: break-word;
}

.admin-pages-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;

  &__search {
    flex: 1 1 220px;
    min-width: 0;
  }

  &__filters {
    display: flex;
    flex: 1 1 320px;
    gap: 8px;
    min-width: 0;
  }

  &__filter {
    flex: 1 1 140px;
    min-width: 0;
  }

  &__sort {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 220px;
    min-width: 0;
  }

  &__sort-select {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__sort-toggle {
    flex-shrink: 0;
  }
}

.admin-pages-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
  width: 100%;
}

.admin-pages-table {
  width: 100%;

  .v-data-table__wrapper {
    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      height: 48px !important;
      padding: 0 16px !important;
      background-color: mc('blue-grey', '50') !important;
      border-bottom: 1px solid mc('blue-grey', '100') !important;
      white-space: nowrap;
      vertical-align: middle;

      @at-root .theme--dark & {
        background-color: mc('grey', '800') !important;
        border-bottom-color: mc('grey', '700') !important;
      }
    }

    .v-data-table-header {
      font-size: 0.8125rem !important;
      font-weight: 600 !important;
      letter-spacing: 0.02em;
      color: mc('blue-grey', '800') !important;

      @at-root .theme--dark & {
        color: mc('grey', '300') !important;
      }
    }

    .v-data-table-header__icon {
      opacity: 0.7;
    }

    tbody td {
      padding: 12px 16px !important;
      vertical-align: top;
    }
  }

  .admin-pages-title {
    min-width: 280px;
  }
}

.admin-pages-pagination {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 4px 12px;
  overflow-x: hidden;

  .v-pagination {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }
}

@media #{map-get($display-breakpoints, 'sm-and-down')} {
  .admin-pages-toolbar {
    flex-direction: column;
    align-items: stretch;

    &__search,
    &__filters,
    &__filter {
      flex: 1 1 auto;
      width: 100%;
      max-width: none;
      min-width: 0;
    }

    &__filters {
      flex-direction: column;
    }

    &__sort {
      width: 100%;
      flex: 0 0 auto;
      min-height: 0;
    }
  }

  .admin-pages-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .admin-pages-table {
    width: max-content;
    min-width: 100%;

    table {
      width: max-content !important;
      min-width: 100%;
    }

    .v-data-table__wrapper thead th {
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);

      @at-root .theme--dark & {
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
      }
    }

    th,
    td {
      white-space: normal;
      vertical-align: top;
    }

    .admin-pages-title {
      min-width: 280px;
    }

    .admin-pages-path {
      min-width: 200px;
    }

    th:nth-child(3),
    td:nth-child(3),
    th:nth-child(4),
    td:nth-child(4) {
      min-width: 140px;
    }
  }

  .admin-pages-pagination {
    padding-left: 0;
    padding-right: 0;

    .v-pagination__item,
    .v-pagination__navigation {
      min-width: 34px !important;
      width: 34px !important;
      height: 34px !important;
      margin: 2px;
      font-size: 0.8125rem !important;
    }

    .v-pagination__navigation .v-icon {
      font-size: 18px !important;
    }
  }
}
</style>
