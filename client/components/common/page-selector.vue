<template lang="pug">
  v-dialog(v-model='isShown', max-width='850px')
    v-card.page-selector
      .dialog-header.is-blue
        v-icon.mr-3(color='white') mdi-page-next-outline
        .body-1 Select Page Location
        v-spacer
        v-progress-circular(
          indeterminate
          color='white'
          :size='20'
          :width='2'
          v-show='searchLoading'
          )
      .d-flex(style='min-height:400px;')
        v-flex.grey(xs4, :class='darkMode ? `darken-4` : `lighten-3`')
          v-toolbar(color='grey darken-3', dark, dense, flat)
            .body-2 Virtual Folders
            v-spacer
            v-btn(icon, tile, href='https://docs.requarks.io/', target='_blank')
              v-icon mdi-help-box
          v-treeview(
            :active.sync='currentNode'
            :open.sync='openNodes'
            :items='tree'
            :load-children='fetchFolders'
            dense
            expand-icon='mdi-menu-down-outline'
            item-id='path'
            item-text='title'
            activatable
            hoverable
            )
            template(slot='prepend', slot-scope='{ item, open, leaf }')
              v-icon mdi-{{ open ? 'folder-open' : 'folder' }}
        v-flex(xs8)
          v-toolbar(color='blue darken-2', dark, dense, flat)
            .body-2 Pages
            v-spacer
            v-btn(icon, tile, disabled): v-icon mdi-content-save-move-outline
            v-btn(icon, tile, disabled): v-icon mdi-trash-can-outline
          v-list.py-0(dense, v-if='currentPages.length > 0')
            v-list-item-group(
              v-model='currentPage'
              color='primary'
              )
              template(v-for='(page, idx) of currentPages')
                v-list-item(:key='page.id', :value='page.path')
                  v-list-item-icon: v-icon mdi-file-document-box
                  v-list-item-title {{page.title}}
                v-divider(v-if='idx < pages.length - 1')
          v-alert.animated.fadeIn(
            v-else
            text
            color='orange'
            prominent
            icon='mdi-alert'
            )
            .body-2 This folder is empty.
      v-card-actions.grey.pa-2(:class='darkMode ? `darken-2` : `lighten-1`')
        v-select(
          solo
          dark
          flat
          background-color='grey darken-3-d2'
          hide-details
          single-line
          :items='namespaces'
          style='flex: 0 0 100px; border-radius: 4px 0 0 4px;'
          v-model='currentLocale'
          )
        v-text-field(
          ref='pathIpt'
          solo
          hide-details
          prefix='/'
          v-model='currentPath'
          flat
          clearable
          style='border-radius: 0 4px 4px 0;'
        )
      v-card-chin
        v-spacer
        v-btn(text, @click='close') Cancel
        v-btn.px-4(color='primary', @click='open', :disabled='!isValidPath')
          v-icon(left) mdi-check
          span Select
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import pageTreeQuery from 'gql/common/common-pages-query-tree.gql'

/* global siteLangs, siteConfig */

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    },
    path: {
      type: String,
      default: 'new-page'
    },
    locale: {
      type: String,
      default: 'en'
    },
    mode: {
      type: String,
      default: 'create'
    },
    openHandler: {
      type: Function,
      default: () => {}
    }
  },
  data() {
    return {
      searchLoading: false,
      currentLocale: siteConfig.lang,
      currentPath: 'new-page',
      currentPage: null,
      currentNode: [0],
      openNodes: [0],
      tree: [{
        id: 0,
        title: '/ (root',
        children: []
      }],
      pages: [],
      all: [],
      namespaces: siteLangs.length ? siteLangs.map(ns => ns.code) : [siteConfig.lang]
    }
  },
  computed: {
    darkMode: get('site/dark'),
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    currentPages () {
      return _.filter(this.pages, ['parent', _.head(this.currentNode) || 0])
    },
    isValidPath () {
      return this.currentPath && this.currentPath.length > 2
    }
  },
  watch: {
    isShown (newValue, oldValue) {
      if (newValue && !oldValue) {
        this.currentPath = this.path
        this.currentLocale = this.locale
        _.delay(() => {
          this.$refs.pathIpt.focus()
        })
      }
    },
    currentNode (newValue, oldValue) {
      if (newValue.length < 1) { // force a selection
        this.$nextTick(() => {
          this.currentNode = oldValue
        })
      } else {
        if (this.openNodes.indexOf(newValue[0]) < 0) { // auto open and load children
          const current = _.find(this.all, ['id', newValue[0]])
          if (current) {
            if (this.openNodes.indexOf(current.parent) < 0) {
              this.$nextTick(() => {
                this.openNodes.push(current.parent)
              })
            }
          }
          this.$nextTick(() => {
            this.openNodes.push(newValue[0])
          })
        }
      }
    },
    currentPage (newValue, oldValue) {
      if (!_.isEmpty(newValue)) {
        this.currentPath = newValue
      }
    }
  },
  methods: {
    close() {
      this.isShown = false
    },
    open() {
      const exit = this.openHandler({
        locale: this.currentLocale,
        path: this.currentPath
      })
      if (exit !== false) {
        this.close()
      }
    },
    async fetchFolders (item) {
      this.searchLoading = true
      const resp = await this.$apollo.query({
        query: pageTreeQuery,
        fetchPolicy: 'network-only',
        variables: {
          parent: item.id,
          mode: 'ALL',
          locale: this.currentLocale
        }
      })
      const items = _.get(resp, 'data.pages.tree', [])
      const itemFolders = _.filter(items, ['isFolder', true]).map(f => ({...f, children: []}))
      const itemPages = _.filter(items, ['isFolder', false])
      if (itemFolders.length > 0) {
        item.children = itemFolders
      } else {
        item.children = undefined
      }
      this.pages.push(...itemPages)

      this.all.push(...items)

      this.searchLoading = false
    }
  }
}
</script>

<style lang='scss'>

.page-selector {
  .v-treeview-node__label {
    font-size: 13px;
  }
}

</style>
