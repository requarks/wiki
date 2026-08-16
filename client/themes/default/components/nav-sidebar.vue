<template lang="pug">
  div.nav-sidebar
    .pa-3.d-flex(v-if='navMode === `MIXED`', :class='mixedNavHeaderClass')
      v-btn(
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='min-width:0;'
        @click='goHome'
        :aria-label='$t(`common:header.home`)'
        )
        v-icon(size='20') mdi-home
      v-btn.ml-3(
        v-if='currentMode === `custom`'
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='flex: 1 1 100%;'
        @click='switchMode(`browse`)'
        )
        v-icon(left) mdi-file-tree
        .body-2.text-none {{$t('common:sidebar.browse')}}
      v-btn.ml-3(
        v-else-if='currentMode === `browse`'
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='flex: 1 1 100%;'
        @click='switchMode(`custom`)'
        )
        v-icon(left) mdi-navigation
        .body-2.text-none {{$t('common:sidebar.mainMenu')}}
    v-divider
    //-> Custom Navigation
    v-list.py-1(v-if='currentMode === `custom`', dense, :class='color', :dark='dark')
      template(v-for='row in flatCustomNavRows')
        v-divider.my-1(v-if='row.type === `divider`', :key='row.rowKey')
        v-subheader.pl-4(v-else-if='row.type === `header`', :key='row.rowKey') {{ row.item.l }}
        v-list-item.nav-sidebar-parent(
          v-else-if='row.type === `parent`'
          :key='row.rowKey'
          @click='toggleParent(row.id)'
          )
          v-list-item-icon
            v-icon(v-if='isFaIcon(row.item.c)', size='19') {{ row.item.c }}
            v-icon(v-else, small) {{ row.item.c || 'mdi-flower' }}
          v-list-item-content
            v-list-item-title {{ row.item.l }}
          v-list-item-action
            v-icon(small) {{ isParentExpanded(row.id) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
        v-list-item(
          v-else-if='row.type === `child` || row.type === `link`'
          :key='row.rowKey'
          :href='row.item.t'
          :target='row.item.y === `externalblank` ? `_blank` : `_self`'
          :rel='row.item.y === `externalblank` ? `noopener` : ``'
          :style='subNavItemStyle(row.item.c)'
          @click='onNavigate'
          )
          v-list-item-icon
            v-icon(v-if='isFaIcon(row.item.c)', size='19') {{ row.item.c }}
            v-icon(v-else, small) {{ row.item.c || 'mdi-link-variant' }}
          v-list-item-content
            v-list-item-title {{ row.item.l }}
    //-> Browse
    v-list.py-1(v-else-if='currentMode === `browse`', dense, :class='color', :dark='dark')
      template(v-if='currentParent.id > 0')
        v-list-item(v-for='(item, idx) of parents', :key='`parent-` + item.id', @click='fetchBrowseItems(item)', :style='{ paddingLeft: (8 + idx * 8) + `px` }')
          v-list-item-icon
            v-icon(small) mdi-folder-open
          v-list-item-content
            v-list-item-title {{ item.title }}
        v-divider.mt-1
        v-list-item.mt-1(v-if='currentParent.pageId > 0', :href='`/` + currentParent.locale + `/` + currentParent.path', :key='`directorypage-` + currentParent.id', :input-value='path === currentParent.path', @click='onNavigate')
          v-list-item-icon
            v-icon(small) mdi-text-box
          v-list-item-content
            v-list-item-title {{ currentParent.title }}
        v-subheader.pl-4 {{$t('common:sidebar.currentDirectory')}}
      template(v-for='item of currentItems')
        v-list-item(v-if='item.isFolder', :key='`childfolder-` + item.id', @click='fetchBrowseItems(item)')
          v-list-item-icon
            v-icon(small) mdi-folder
          v-list-item-content
            v-list-item-title {{ item.title }}
        v-list-item(v-else, :href='`/` + item.locale + `/` + item.path', :key='`childpage-` + item.id', :input-value='path === item.path', @click='onNavigate')
          v-list-item-icon
            v-icon(small) mdi-text-box
          v-list-item-content
            v-list-item-title {{ item.title }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'

/* global siteLangs, siteConfig */

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
    navMode: {
      type: String,
      default: 'MIXED'
    }
  },
  data() {
    return {
      currentMode: 'custom',
      currentItems: [],
      currentParent: {
        id: 0,
        title: '/ (root)'
      },
      parents: [],
      loadedCache: [],
      expandedParents: {}
    }
  },
  computed: {
    path: get('page/path'),
    locale: get('page/locale'),
    sideNavSettings: get('page/sideNavSettings'),
    sideNavEnabled () {
      return !!(this.sideNavSettings && this.sideNavSettings.enabled)
    },
    customNavEntries () {
      const entries = []
      const navItems = this.items || []
      let index = 0

      while (index < navItems.length) {
        const item = navItems[index]

        if (item.k === 'divider' || item.k === 'header') {
          entries.push({ type: item.k, item, id: item.i })
          index++
          continue
        }

        if (item.k !== 'link') {
          index++
          continue
        }

        if (this.sideNavEnabled && this.isParentIcon(item.c)) {
          const children = []
          let childIndex = index + 1

          while (childIndex < navItems.length && navItems[childIndex].k === 'link' && this.isSubNavIcon(navItems[childIndex].c)) {
            children.push(navItems[childIndex])
            childIndex++
          }

          if (children.length > 0) {
            entries.push({ type: 'parent', item, children, id: item.i })
            index = childIndex
            continue
          }
        }

        entries.push({ type: 'link', item, id: item.i })
        index++
      }

      return entries
    },
    flatCustomNavRows () {
      const rows = []

      for (const entry of this.customNavEntries) {
        rows.push({
          ...entry,
          rowKey: entry.id
        })

        if (entry.type === 'parent' && this.isParentExpanded(entry.id)) {
          for (const child of entry.children) {
            rows.push({
              type: 'child',
              item: child,
              id: child.i,
              rowKey: `${entry.id}-${child.i}`
            })
          }
        }
      }

      return rows
    },
    mixedNavHeaderClass () {
      if (this.$vuetify.breakpoint.smAndDown) {
        return this.$vuetify.theme.dark ? 'blue darken-4' : 'blue darken-2'
      }
      return this.$vuetify.theme.dark ? 'grey darken-5' : 'blue darken-3'
    }
  },
  watch: {
    items: {
      handler () {
        this.syncExpandedParents()
      },
      deep: true
    },
    path () {
      this.syncExpandedParents()
    }
  },
  methods: {
    isFaIcon (icon) {
      return icon && /fa[a-z] fa-/.test(String(icon))
    },
    iconMatches (icon, pattern) {
      if (!icon || !pattern) { return false }
      return String(icon).includes(String(pattern))
    },
    isParentIcon (icon) {
      const pattern = _.get(this.sideNavSettings, 'parentIconMatch', 'mdi-flower')
      return this.iconMatches(icon, pattern)
    },
    isSubNavIcon (icon) {
      const pattern = _.get(this.sideNavSettings, 'childIconMatch', 'mdi-chevron-right')
      return this.iconMatches(icon, pattern)
    },
    subNavItemStyle (icon) {
      if (!this.isSubNavIcon(icon)) { return null }
      const indent = _.get(this.sideNavSettings, 'childIndentPx', 36)
      return { paddingInlineStart: `${indent}px` }
    },
    loadExpandedParents () {
      try {
        const raw = window.localStorage.getItem('navExpandedParents')
        this.expandedParents = raw ? JSON.parse(raw) : {}
      } catch (err) {
        this.expandedParents = {}
      }
    },
    saveExpandedParents () {
      window.localStorage.setItem('navExpandedParents', JSON.stringify(this.expandedParents))
    },
    isParentExpanded (id) {
      if (this.expandedParents[id] === undefined) {
        return true
      }
      return !!this.expandedParents[id]
    },
    toggleParent (id) {
      this.$set(this.expandedParents, id, !this.isParentExpanded(id))
      this.saveExpandedParents()
    },
    syncExpandedParents () {
      for (const entry of this.customNavEntries) {
        if (entry.type !== 'parent') { continue }
        if (entry.children.some(child => this.isActiveLink(child))) {
          this.$set(this.expandedParents, entry.id, true)
        }
      }
      this.saveExpandedParents()
    },
    isActiveLink (item) {
      if (!item || !item.t) { return false }

      if (/^https?:\/\//.test(item.t)) {
        return window.location.href === item.t
      }

      const targetPath = item.t.startsWith('/') ? item.t : `/${item.t}`
      const currentPath = window.location.pathname.replace(/\/$/, '') || '/'
      const normalizedTarget = targetPath.replace(/\/$/, '') || '/'

      return currentPath === normalizedTarget
    },
    switchMode (mode) {
      this.currentMode = mode
      window.localStorage.setItem('navPref', mode)
      if (mode === `browse` && this.loadedCache.length < 1) {
        this.loadFromCurrentPath()
      }
    },
    async fetchBrowseItems (item) {
      this.$store.commit(`loadingStart`, 'browse-load')
      if (!item) {
        item = this.currentParent
      }

      if (this.loadedCache.indexOf(item.id) < 0) {
        this.currentItems = []
      }

      if (item.id === 0) {
        this.parents = []
      } else {
        const flushRightIndex = _.findIndex(this.parents, ['id', item.id])
        if (flushRightIndex >= 0) {
          this.parents = _.take(this.parents, flushRightIndex)
        }
        if (this.parents.length < 1) {
          this.parents.push(this.currentParent)
        }
        this.parents.push(item)
      }

      this.currentParent = item

      const resp = await this.$apollo.query({
        query: gql`
          query ($parent: Int, $locale: String!) {
            pages {
              tree(parent: $parent, mode: ALL, locale: $locale) {
                id
                path
                title
                isFolder
                pageId
                parent
                locale
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
      this.loadedCache = _.union(this.loadedCache, [item.id])
      this.currentItems = _.get(resp, 'data.pages.tree', [])
      this.$store.commit(`loadingStop`, 'browse-load')
    },
    async loadFromCurrentPath() {
      this.$store.commit(`loadingStart`, 'browse-load')
      const resp = await this.$apollo.query({
        query: gql`
          query ($path: String, $locale: String!) {
            pages {
              tree(path: $path, mode: ALL, locale: $locale, includeAncestors: true) {
                id
                path
                title
                isFolder
                pageId
                parent
                locale
              }
            }
          }
        `,
        fetchPolicy: 'cache-first',
        variables: {
          path: this.path,
          locale: this.locale
        }
      })
      const items = _.get(resp, 'data.pages.tree', [])
      const curPage = _.find(items, ['pageId', this.$store.get('page/id')])
      if (!curPage) {
        console.warn('Could not find current page in page tree listing!')
        return
      }

      let curParentId = curPage.parent
      let invertedAncestors = []
      while (curParentId) {
        const curParent = _.find(items, ['id', curParentId])
        if (!curParent) {
          break
        }
        invertedAncestors.push(curParent)
        curParentId = curParent.parent
      }

      this.parents = [this.currentParent, ...invertedAncestors.reverse()]
      this.currentParent = _.last(this.parents)

      this.loadedCache = [curPage.parent]
      this.currentItems = _.filter(items, ['parent', curPage.parent])
      this.$store.commit(`loadingStop`, 'browse-load')
    },
    onNavigate () {
      this.$emit('navigate')
    },
    getHomeLocale () {
      const urlSegment = _.get(window.location.pathname.split('/'), '[1]')
      if (urlSegment && siteLangs.some(lc => lc.code === urlSegment)) {
        return urlSegment
      }
      if (this.locale && siteLangs.some(lc => lc.code === this.locale)) {
        return this.locale
      }
      return siteConfig.lang
    },
    goHome () {
      const locale = this.getHomeLocale()
      window.location.assign(siteLangs.length > 0 ? `/${locale}/home` : '/')
    }
  },
  mounted () {
    this.currentParent.title = `/ ${this.$t('common:sidebar.root')}`
    this.loadExpandedParents()
    if (this.navMode === 'TREE') {
      this.currentMode = 'browse'
    } else if (this.navMode === 'STATIC') {
      this.currentMode = 'custom'
    } else {
      this.currentMode = window.localStorage.getItem('navPref') || 'custom'
    }
    if (this.currentMode === 'browse') {
      this.loadFromCurrentPath()
    }
    this.syncExpandedParents()
  }
}
</script>
