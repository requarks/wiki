<template lang="pug">
  v-dialog(v-model='isShown', lazy, max-width='850px')
    v-card.page-selector
      .dialog-header.is-dark
        v-icon.mr-2(color='white') find_in_page
        span Select Page Location
        v-spacer
        v-progress-circular(
          indeterminate
          color='white'
          :size='20'
          :width='2'
          v-show='searchLoading'
          )
      //- .d-flex(style='min-height:400px;')
      //-   v-flex(xs4).grey(:class='darkMode ? `darken-4` : `lighten-3`')
      //-     v-toolbar(color='grey darken-3', dark, dense, flat)
      //-       .body-2 Folders
      //-       v-spacer
      //-       v-btn(icon): v-icon create_new_folder
      //-     v-treeview(
      //-       v-model='tree'
      //-       :items='treeFolders'
      //-       :load-children='fetchFolders'
      //-       activatable
      //-       open-on-click
      //-       hoverable
      //-       )
      //-       template(slot='prepend', slot-scope='{ item, open, leaf }')
      //-         v-icon {{ open ? 'folder_open' : 'folder' }}
      //-   v-flex(xs8)
      //-     v-toolbar(color='grey darken-2', dark, dense, flat)
      //-       .body-2 Pages
      //-       v-spacer
      //-       v-btn(icon): v-icon forward
      //-       v-btn(icon): v-icon delete
      //-     v-list(dense)
      //-       v-list-tile
      //-         v-list-tile-avatar: v-icon insert_drive_file
      //-         v-list-tile-title File A
      //-       v-divider
      //-       v-list-tile
      //-         v-list-tile-avatar: v-icon insert_drive_file
      //-         v-list-tile-title File B
      //-       v-divider
      //-       v-list-tile
      //-         v-list-tile-avatar: v-icon insert_drive_file
      //-         v-list-tile-title File C
      //-       v-divider
      //-       v-list-tile
      //-         v-list-tile-avatar: v-icon insert_drive_file
      //-         v-list-tile-title File D
      v-card-actions.grey.pa-2(:class='darkMode ? `darken-3-d5` : `lighten-1`')
        v-select(
          solo
          dark
          background-color='grey darken-3-d2'
          hide-details
          single-line
          :items='namespaces'
          style='flex: 0 0 100px;'
          v-model='currentLocale'
          )
        v-text-field(
          solo
          hide-details
          prefix='/'
          v-model='currentPath'
          flat
          clearable
        )
      v-card-chin
        v-spacer
        v-btn(outline, @click='close') Cancel
        v-btn(color='primary', @click='open')
          v-icon(left) check
          span Select
</template>

<script>
import { get } from 'vuex-pathify'

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
      currentLocale: 'en',
      currentPath: 'new-page',
      tree: [],
      treeChildren: [],
      namespaces: siteLangs.length ? siteLangs.map(ns => ns.code) : [siteConfig.lang]
    }
  },
  computed: {
    darkMode: get('site/dark'),
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    treeFolders() {
      return [
        {
          id: '/',
          name: '/ (root)',
          children: []
        }
      ]
    }
  },
  watch: {
    isShown(newValue, oldValue) {
      if (newValue && !oldValue) {
        this.currentPath = this.path
        this.currentLocale = this.locale
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
    async fetchFolders(item) {
      console.info(item)
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
