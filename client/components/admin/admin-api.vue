<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-rest-api.svg', alt='API', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2 API Access
            .subtitle-1.grey--text Manage keys to access the API #[v-chip(label, color='primary', small).white--text coming soon]
          v-spacer
          v-btn(outline, color='grey', large, @click='refresh', disabled)
            v-icon refresh
          v-btn(color='green', disabled, depressed, large, @click='globalSwitch')
            v-icon(left) power_settings_new
            | Enable API
          v-btn(color='primary', depressed, large, @click='newKey', disabled)
            v-icon(left) add
            | New API Key
        v-card.mt-3
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
                td {{ props.item.name }}
                td {{ props.item.key }}
                td {{ props.item.createdOn }}
                td {{ props.item.updatedOn }}
                td: v-btn(icon): v-icon.grey--text.text--darken-1 more_horiz
            template(slot='no-data')
              v-alert.mt-3(icon='info', :value='true', outline, color='info') No API keys have been generated yet.
          .text-xs-center.py-2
            v-pagination(v-model='pagination.page', :length='pages')
</template>

<script>
export default {
  data() {
    return {
      selected: [],
      pagination: {},
      items: [],
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'Key', value: 'key' },
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
    },
    async refresh() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    },
    async globalSwitch() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    },
    async newKey() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    }
  }
}
</script>

<style lang='scss'>

</style>
