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
            .admin-pages-toolbar__search
              v-text-field(
                solo
                flat
                v-model='search'
                prepend-inner-icon='mdi-file-search-outline'
                label='Search Pages...'
                hide-details
                dense
                )
            .admin-pages-toolbar__filters
              .admin-pages-toolbar__filter
                v-select(
                  solo
                  flat
                  hide-details
                  dense
                  label='Locale'
                  :items='langs'
                  v-model='selectedLang'
                )
              .admin-pages-toolbar__filter
                v-select(
                  solo
                  flat
                  hide-details
                  dense
                  label='Publish State'
                  :items='states'
                  v-model='selectedState'
                )
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
              :sort-by.sync='sortBy'
              :sort-desc.sync='sortDesc'
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
                    .admin-pages-path__content
                      v-chip(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`') {{ props.item.locale }}
                      span.grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-2`') / {{ props.item.path }}
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
          { text: 'Title', value: 'title', width: 280, sortable: true },
          { text: 'Path', value: 'path', width: 200, sortable: true },
          { text: 'Created', value: 'createdAt', width: 140, sortable: true },
          { text: 'Last Updated', value: 'updatedAt', width: 140, sortable: true }
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
  vertical-align: middle;

  &__content {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    font-family: 'Roboto Mono', monospace;
    word-break: break-word;
  }
}

.admin-pages-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: stretch;

  &__search,
  &__filter {
    display: flex;
    align-items: stretch;
    min-width: 0;

    > .v-input {
      flex: 1 1 auto;
      width: 100%;
    }
  }

  &__search {
    flex: 1 1 220px;
  }

  &__filters {
    display: flex;
    flex: 1 1 320px;
    gap: 8px;
    min-width: 0;
    align-items: stretch;
  }

  &__filter {
    flex: 1 1 140px;
  }

  .v-input__control,
  .v-input__slot {
    min-height: 40px !important;
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

    tbody tr {
      border-bottom: 1px solid mc('blue-grey', '100');

      @at-root .theme--dark & {
        border-bottom-color: mc('grey', '700');
      }
    }

    tbody td {
      padding: 12px 16px !important;
      vertical-align: middle;
      border-bottom: none !important;
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
      vertical-align: middle;
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
