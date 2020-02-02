<template lang="pug">
  div
    .blue.darken-3.pa-3.d-flex
      v-btn(depressed, color='blue darken-2', style='min-width:0;', href='/')
        v-icon(size='20') mdi-home
      v-btn.ml-3(v-if='currentMode === `custom`', depressed, color='blue darken-2', style='flex: 1 1 100%;', @click='switchMode(`browse`)')
        v-icon(left) mdi-file-tree
        .body-2.text-none Browse
      v-btn.ml-3(v-else-if='currentMode === `browse`', depressed, color='blue darken-2', style='flex: 1 1 100%;', @click='switchMode(`custom`)')
        v-icon(left) mdi-navigation
        .body-2.text-none Main Menu
    v-divider
    //-> Custom Navigation
    v-list.py-2(v-if='currentMode === `custom`', dense, :class='color', :dark='dark')
      template(v-for='item of items')
        v-list-item(
          v-if='item.kind === `link`'
          :href='item.target'
          )
          v-list-item-avatar(size='24', tile)
            v-icon {{ item.icon }}
          v-list-item-title {{ item.label }}
        v-divider.my-2(v-else-if='item.kind === `divider`')
        v-subheader.pl-4(v-else-if='item.kind === `header`') {{ item.label }}
    //-> Browse
    v-list.py-2(v-else-if='currentMode === `browse`', dense, :class='color', :dark='dark')
      template(v-if='currentParent.id > 0')
        v-list-item(v-for='(item, idx) of parents', :key='`parent-` + item.id', @click='fetchBrowseItems(item)', style='min-height: 30px;')
          v-list-item-avatar(size='18', :style='`padding-left: ` + (idx * 8) + `px; width: auto; margin: 0 5px 0 0;`')
            v-icon(small) mdi-folder-open
          v-list-item-title {{ item.title }}
        v-divider.mt-2
        v-subheader.pl-4 Current Directory
      template(v-for='item of currentItems')
        v-list-item(v-if='item.isFolder', :key='`childfolder-` + item.id', @click='fetchBrowseItems(item)')
          v-list-item-avatar(size='24')
            v-icon mdi-folder
          v-list-item-title {{ item.title }}
        v-list-item(v-else, :href='`/` + item.path', :key='`childpage-` + item.id', :input-value='path === item.path')
          v-list-item-avatar(size='24')
            v-icon mdi-file-document-box
          v-list-item-title {{ item.title }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'

export default {
  props: {
    color: {
      type: String,
      default: 'primary'
    },
    dark: {
      type: Boolean,
      default: true
    },
    items: {
      type: Array,
      default: () => []
    },
    mode: {
      type: String,
      default: 'browse'
    }
  },
  data() {
    return {
      currentMode: 'browse',
      currentItems: [],
      currentParent: {
        id: 0,
        title: '/ (root)'
      },
      all: []
    }
  },
  computed: {
    path: get('page/path'),
    locale: get('page/locale')
  },
  methods: {
    switchMode (mode) {
      this.currentMode = mode
      if (mode === `browse`) {
        this.fetchBrowseItems()
      }
    },
    async fetchBrowseItems (item) {
      this.$store.commit(`loadingStart`, 'browse-load')
      if (!item) {
        item = this.currentParent
      } else {
        if (!_.some(this.parents, ['id', item.id])) {
          this.parents.push(this.currentParent)
        }
        this.currentParent = item
      }
      const resp = await this.$apollo.query({
        query: gql`
          query ($parent: Int!, $locale: String!) {
            pages {
              tree(parent: $parent, mode: ALL, locale: $locale, includeParents: true) {
                id
                path
                title
                isFolder
                pageId
                parent
              }
            }
          }
        `,
        fetchPolicy: 'cache-first',
        variables: {
          parent: item.id,
          locale: this.locale
        }
      })
      this.currentItems = _.get(resp, 'data.pages.tree', [])
      this.all.push(...this.currentItems)
      this.$store.commit(`loadingStop`, 'browse-load')
    }
  },
  mounted () {
    this.currentMode = this.mode
    if (this.mode === 'browse') {
      this.fetchBrowseItems()
    }
  }
}
</script>
