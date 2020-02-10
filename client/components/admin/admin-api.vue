<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-rest-api.svg', alt='API', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft API Access
            .subtitle-1.grey--text.animated.fadeInLeft Manage keys to access the API
          v-spacer
          template(v-if='enabled')
            status-indicator.mr-3(positive, pulse)
            .caption.green--text.animated.fadeInLeft {{$t('admin:api.enabled')}}
          template(v-else)
            status-indicator.mr-3(negative, pulse)
            .caption.red--text.animated.fadeInLeft {{$t('admin:api.disabled')}}
          v-spacer
          v-btn.mr-3.animated.fadeInDown.wait-p2s(outlined, color='grey', large, @click='refresh')
            v-icon mdi-refresh
          v-btn.mr-3.animated.fadeInDown.wait-p1s(color='green', depressed, large, @click='globalSwitch', dark)
            v-icon(left) mdi-power
            | Enable API
          v-btn.animated.fadeInDown(color='primary', depressed, large, @click='newKey', dark)
            v-icon(left) mdi-plus
            | New API Key
        v-card.mt-3.animated.fadeInUp
          v-data-table(
            v-model='selected'
            :items='items',
            :headers='headers',
            :search='search',
            :pagination.sync='pagination',
            :rows-per-page-items='[-1]'
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
              v-alert.mt-3(icon='mdi-information', :value='true', outlined, color='info') No API keys have been generated yet.
          .text-xs-center.py-2
            v-pagination(v-model='pagination.page', :length='pages')
</template>

<script>
import { StatusIndicator } from 'vue-status-indicator'

export default {
  components: {
    StatusIndicator
  },
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
