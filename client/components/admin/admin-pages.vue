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
              label='Groups'
              :items='groups'
              v-model='selectedGroup'
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
            v-btn.ml-2(
              color='primary'
              depressed
              @click='saveNewOrder'
            )
              v-icon(left) mdi-content-save
              span Save Order
          v-divider
          v-data-table(
            :items='filteredPages'
            :headers='headers'
            :search='search'
            :page.sync='pagination'
            :items-per-page='500'
            :loading='loading'
            must-sort,
            sort-by='orderPriority',
            sort,
            hide-default-footer
            @page-count="pageTotal = $event"
          )
            template(slot='item', slot-scope='props')
              tr.is-clickable(
                :active='props.selected',
                draggable="true"
                @dragstart="dragStart($event, props.item, props.index)"
                @dragover.prevent="dragOver($event, props.item, props.index)"
                @dragenter.prevent="dragEnter($event, props.index)"
                @dragleave="dragLeave($event)"
                @drop="drop($event, props.item, props.index)"
                @click='$router.push(`/pages/` + props.item.id)'
                :class="{'drag-over': dragOverIndex === props.index}"
              )
                td.text-xs-right {{ props.item.id }}
                td.text-xs-right {{ props.item.orderPriority }}
                td
                  .body-2: strong {{ props.item.title }}
                  .caption {{ props.item.description }}
                td.admin-pages-path
                  v-chip(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`') {{ props.item.locale }}
                  span.ml-2.grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-2`') / {{ props.item.path }}
                td {{ props.item.createdAt | moment('calendar') }}
                td {{ props.item.updatedAt | moment('calendar') }}
            template(slot='no-data')
              v-alert.ma-3(icon='mdi-alert', :value='true', outlined) No pages to display.
          .text-center.py-2.animated.fadeInDown(v-if='this.pageTotal > 1')
            v-pagination(v-model='pagination', :length='pageTotal')
</template>

<script>
import _ from 'lodash'
import pagesQuery from 'gql/admin/pages/pages-query-list.gql'
import updatePagePriorityMutation from 'gql/admin/pages/update-page-priority.gql'

export default {
  data() {
    return {
      selectedPage: {},
      pagination: 1,
      pages: [],
      pageTotal: 0,
      headers: [
        { text: 'ID', value: 'id', width: 80, sortable: true },
        { text: 'Order', value: 'orderPriority', width: 100 },
        { text: 'Title', value: 'title' },
        { text: 'Path', value: 'path' },
        { text: 'Created', value: 'createdAt', width: 250 },
        { text: 'Last Updated', value: 'updatedAt', width: 250 }
      ],
      search: '',
      selectedLang: null,
      selectedState: null,
      selectedGroup: null,
      states: [
        { text: 'All Publishing States', value: null },
        { text: 'Published', value: true },
        { text: 'Not Published', value: false }
      ],
      groups: [],
      loading: false,
      draggedItem: null,
      draggedIndex: null,
      dragOverIndex: null
    }
  },
  computed: {
    filteredPages () {
      return _.filter(this.pages, pg => {
        if (this.selectedGroup !== null && pg.group !== this.selectedGroup) {
          return false
        }
        if (this.selectedLang !== null && this.selectedLang !== pg.locale) {
          return false
        }
        if (this.selectedState !== null && this.selectedState !== pg.isPublished) {
          return false
        }
        return true
      }).sort((a, b) => a.orderPriority - b.orderPriority)
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
    async saveNewOrder() {
      try {
        const pagesToUpdate = this.filteredPages.map((page, index) => ({
          id: page.id,
          orderPriority: index + 1
        }))

        await this.$apollo.mutate({
          mutation: updatePagePriorityMutation,
          variables: { pages: pagesToUpdate }
        })

        this.$store.commit('showNotification', {
          message: 'Order updated successfully',
          style: 'success',
          icon: 'check'
        })

        await this.refresh()
      } catch (error) {
        this.$store.commit('showNotification', {
          message: 'Failed to update order',
          style: 'error',
          icon: 'error'
        })
      }
    },

    async refresh() {
      await this.$apollo.queries.pages.refetch()
      this.$store.commit('showNotification', {
        message: 'Page list has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },

    dragStart(event, item, index) {
      this.draggedItem = item
      this.draggedIndex = index
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/html', event.target.parentNode)
    },

    dragOver(event, item, index) {
      event.preventDefault()
      if (this.draggedItem && this.draggedItem.id !== item.id) {
        this.dragOverIndex = index
        event.dataTransfer.dropEffect = 'move'
      }
    },

    dragEnter(event, index) {
      event.preventDefault()
      this.dragOverIndex = index
    },

    dragLeave(event) {
      this.dragOverIndex = null
    },

    drop(event, item, index) {
      event.preventDefault()
      this.dragOverIndex = null

      if (!this.draggedItem || this.draggedItem.id === item.id) {
        return
      }

      // Создаем копию массива страниц
      const pagesCopy = [...this.pages]

      // Находим индекс перетаскиваемого элемента в основном массиве
      const draggedPageIndex = pagesCopy.findIndex(p => p.id === this.draggedItem.id)
      if (draggedPageIndex === -1) return

      // Удаляем перетаскиваемый элемент из массива
      const [draggedPage] = pagesCopy.splice(draggedPageIndex, 1)

      // Находим индекс целевого элемента в основном массиве
      const targetPageIndex = pagesCopy.findIndex(p => p.id === item.id)
      if (targetPageIndex === -1) return

      // Вставляем перетаскиваемый элемент перед целевым
      pagesCopy.splice(targetPageIndex, 0, draggedPage)

      // Обновляем orderPriority для всех элементов в группе
      let currentPriority = 1
      pagesCopy.forEach(page => {
        if (page.group === this.selectedGroup) {
          page.orderPriority = currentPriority++
        }
      })

      // Обновляем основной массив
      this.pages = pagesCopy
    },

    updateGroupSelector(pages) {
      const groups = Array.from(new Set(pages.filter(p => p.group).map(p => p.group)))

      this.groups = [
        { text: 'Select group', value: null },
        ...groups.sort().map(p => ({ text: p, value: p }))
      ]
    },
    newpage() {
      this.pageSelectorShown = true
    },
    recyclebin () { }
  },
  mounted() {},
  watch: {
    selectedGroup() {}
  },
  apollo: {
    pages: {
      query: pagesQuery,
      fetchPolicy: 'network-only',
      update: function (data) {
        const pages = data.pages.list.map(p => {
          p.group = p.path.includes('/') ? p.path.split('/')[0] : null
          return p
        })

        this.updateGroupSelector(pages)

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

tr.is-clickable[draggable="true"] {
  cursor: move;

  &.drag-over {
    td {
      border-top: 2px solid #1976D2;
      border-bottom: 2px solid #1976D2;
    }
  }
}
</style>
