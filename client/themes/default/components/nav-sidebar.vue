<template lang="pug">
  div
    .pa-3.d-flex(v-if='navMode === `MIXED`', :class='$vuetify.theme.dark ? `grey darken-5` : `blue darken-3`')
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
    v-list.py-2(v-if='currentMode === `custom`', dense, :class='color', :dark='dark')
      template(v-for='item of items')
        v-list-item(
          v-if='item.k === `link`'
          :href='item.t'
          :target='item.y === `externalblank` ? `_blank` : `_self`'
          :rel='item.y === `externalblank` ? `noopener` : ``'
          )
          v-list-item-avatar(size='24', tile)
            v-icon(v-if='item.c.match(/fa[a-z] fa-/)', size='19') {{ item.c }}
            v-icon(v-else) {{ item.c }}
          v-list-item-title {{ item.l }}
        v-divider.my-2(v-else-if='item.k === `divider`')
        v-subheader.pl-4(v-else-if='item.k === `header`') {{ item.l }}
    //-> Browse (Dynamic Tree)
    template(v-else-if='currentMode === `browse`')
      .px-3.pt-3.pb-2
        v-text-field.sidebar-search-box(
          v-model='searchQuery'
          dense
          outlined
          clearable
          hide-details
          prepend-inner-icon='mdi-magnify'
          :placeholder='searchPlaceholder'
          @input='onSearchInput'
          )
        v-switch.sidebar-folders-toggle.mt-2(
          v-model='foldersOnly'
          dense
          hide-details
          inset
          :label='foldersOnlyLabel'
        )
      v-list.sidebar-search-results.py-0.mx-3.mb-3(
        v-if='showSearchResults'
        dense
        :class='color'
        :dark='dark'
        )
        v-list-item(
          v-for='result of searchResults'
          :key='`search-` + result.id'
          @click='navigateToSearchResult(result)'
          style='min-height: 36px;'
          )
          v-list-item-avatar(size='20')
            v-icon(small) mdi-file-document-outline
          v-list-item-content
            v-list-item-title.body-2 {{ result.title }}
      v-list.py-1(dense, :class='color', :dark='dark')
        v-treeview.sidebar-tree(
          ref='browseTree'
          :active.sync='activeNodes'
          :open.sync='openNodes'
          :items='tree'
          :load-children='fetchTreeChildren'
          item-id='id'
          item-text='title'
          expand-icon='mdi-menu-down-outline'
          transition
          activatable
          open-on-click
          hoverable
          dense
          )
          template(slot='prepend', slot-scope='{ item, open }')
            v-icon(v-if='item.isFolder', small) mdi-{{ open ? 'folder-open' : 'folder' }}
            v-icon(v-else, small) mdi-text-box
          template(slot='label', slot-scope='{ item }')
            .sidebar-tree-label(
              :class='{"is-current-page": isCurrentPageNode(item), "is-current-path": isCurrentPathNode(item)}'
              :data-tree-node='item.id'
              )
              span {{ getNodeTitle(item) }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'

/* global siteLangs */

const PAGE_TREE_QUERY = gql`
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
`

const PAGE_TREE_FROM_PATH_QUERY = gql`
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
`

const PAGE_LIST_QUERY = gql`
  query ($locale: String) {
    pages {
      list(locale: $locale, orderBy: PATH, orderByDirection: ASC) {
        id
        path
        title
        locale
      }
    }
  }
`

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
  data () {
    return {
      currentMode: 'custom',
      tree: [],
      openNodes: [],
      activeNodes: [],
      currentPathNodeIds: [],
      loadedFolderIds: [],
      nodeIndexById: {},
      browseReady: false,
      isInitializingBrowse: false,
      searchQuery: '',
      searchResults: [],
      allPagesCache: [],
      allPagesLoaded: false,
      foldersOnly: false,
      performSearchDebounced: null
    }
  },
  computed: {
    path: get('page/path'),
    locale: get('page/locale'),
    currentPageId: get('page/id'),
    showSearchResults () {
      return _.trim(this.searchQuery).length >= 2 && this.searchResults.length > 0
    },
    navTreeOpenKey () {
      return `navTreeOpen:${this.locale || 'default'}`
    },
    navTreeFoldersOnlyKey () {
      return 'navTreeFoldersOnly'
    },
    foldersOnlyLabel () {
      return 'Nur Ordner'
    },
    searchPlaceholder () {
      return 'Quick Jump...'
    }
  },
  watch: {
    openNodes (newValue) {
      if (this.currentMode === 'browse') {
        this.saveOpenNodes(newValue)
      }
    },
    activeNodes (newValue, oldValue) {
      if (!_.isEqual(newValue, oldValue)) {
        this.handleActiveNodeChange(newValue)
      }
    },
    path (newValue, oldValue) {
      if (newValue !== oldValue && this.currentMode === 'browse' && this.browseReady && !this.isInitializingBrowse) {
        this.syncCurrentPath().then(() => this.scrollToCurrentNode())
      }
    },
    locale (newValue, oldValue) {
      if (newValue !== oldValue && this.currentMode === 'browse') {
        this.allPagesLoaded = false
        this.allPagesCache = []
        this.initializeBrowseTree()
      }
    },
    foldersOnly (newValue, oldValue) {
      if (newValue === oldValue) {
        return
      }
      this.saveFoldersOnlyPreference(newValue)
      if (this.currentMode === 'browse') {
        this.initializeBrowseTree()
      }
    }
  },
  methods: {
    getNodeTitle (item) {
      const rawTitle = _.trim(_.toString(_.get(item, 'title', '')))
      if (rawTitle.length > 0) {
        return rawTitle
      }

      const rawPath = _.trim(_.toString(_.get(item, 'path', '')))
      if (rawPath.length > 0) {
        const pathSegments = _.filter(rawPath.split('/'), seg => _.trim(seg).length > 0)
        if (pathSegments.length > 0) {
          return _.last(pathSegments)
        }
        return rawPath
      }

      return 'Untitled'
    },
    async withBrowseLoading (key, handler) {
      this.$store.commit('loadingStart', key)
      try {
        return await handler()
      } finally {
        this.$store.commit('loadingStop', key)
      }
    },
    switchMode (mode) {
      this.currentMode = mode
      window.localStorage.setItem('navPref', mode)
      if (mode === 'browse') {
        this.initializeBrowseTree()
      }
    },
    saveFoldersOnlyPreference (enabled) {
      try {
        window.localStorage.setItem(this.navTreeFoldersOnlyKey, enabled ? '1' : '0')
      } catch (err) {
        console.warn('Failed to persist tree folders-only preference:', err)
      }
    },
    restoreFoldersOnlyPreference () {
      try {
        return window.localStorage.getItem(this.navTreeFoldersOnlyKey) === '1'
      } catch (err) {
        console.warn('Failed to restore tree folders-only preference:', err)
        return false
      }
    },
    filterTreeEntries (items) {
      if (!this.foldersOnly) {
        return items
      }
      return _.filter(items, ['isFolder', true])
    },
    parseFolderIds (ids) {
      if (!_.isArray(ids)) {
        return []
      }
      return _.uniq(_.filter(_.map(ids, val => _.toInteger(val)), val => val > 0))
    },
    normalizeFolderIds (ids) {
      const parsed = this.parseFolderIds(ids)
      return _.filter(parsed, folderId => {
        const node = this.nodeIndexById[folderId]
        return !!node && node.isFolder
      })
    },
    saveOpenNodes (ids) {
      try {
        window.localStorage.setItem(this.navTreeOpenKey, JSON.stringify(this.normalizeFolderIds(ids)))
      } catch (err) {
        console.warn('Failed to persist open site tree folders:', err)
      }
    },
    restoreOpenNodes () {
      try {
        const raw = window.localStorage.getItem(this.navTreeOpenKey)
        if (!raw) {
          return []
        }
        return this.parseFolderIds(JSON.parse(raw))
      } catch (err) {
        console.warn('Failed to restore open site tree folders:', err)
        return []
      }
    },
    buildPageHref (item) {
      if (!item || !item.path) {
        return '/'
      }
      if (siteLangs.length > 0) {
        return `/${item.locale}/${item.path}`
      }
      return `/${item.path}`
    },
    buildTreeNode (item) {
      const treeNode = {
        id: item.id,
        path: item.path,
        title: this.getNodeTitle(item),
        isFolder: item.isFolder,
        pageId: item.pageId || 0,
        parent: item.parent || 0,
        locale: item.locale || this.locale
      }
      if (item.isFolder) {
        treeNode.children = []
      }
      return treeNode
    },
    registerTreeNodes (nodes) {
      _.forEach(nodes, node => {
        this.$set(this.nodeIndexById, node.id, node)
        if (_.isArray(node.children) && node.children.length > 0) {
          this.registerTreeNodes(node.children)
        }
      })
    },
    resetBrowseState () {
      this.tree = []
      this.openNodes = []
      this.activeNodes = []
      this.currentPathNodeIds = []
      this.loadedFolderIds = []
      this.nodeIndexById = {}
      this.searchQuery = ''
      this.searchResults = []
      this.browseReady = false
    },
    async fetchRootItems ({ withLoading = true } = {}) {
      const run = async () => {
        const resp = await this.$apollo.query({
          query: PAGE_TREE_QUERY,
          fetchPolicy: 'cache-first',
          variables: {
            parent: 0,
            locale: this.locale
          }
        })
        const items = this.filterTreeEntries(_.get(resp, 'data.pages.tree', []))
        this.tree = _.map(items, item => this.buildTreeNode(item))
        this.registerTreeNodes(this.tree)
        this.loadedFolderIds = _.union(this.loadedFolderIds, [0])
      }

      if (withLoading) {
        return this.withBrowseLoading('browse-load', run)
      }
      return run()
    },
    async fetchCurrentPathItems ({ withLoading = true } = {}) {
      const run = async () => {
        const resp = await this.$apollo.query({
          query: PAGE_TREE_FROM_PATH_QUERY,
          fetchPolicy: 'cache-first',
          variables: {
            path: this.path || 'home',
            locale: this.locale
          }
        })
        return _.get(resp, 'data.pages.tree', [])
      }
      if (withLoading) {
        return this.withBrowseLoading('browse-load', run)
      }
      return run()
    },
    findCurrentPageItem (items) {
      let currentPage = _.find(items, ['pageId', this.currentPageId])
      if (!currentPage) {
        currentPage = _.find(items, entry => {
          return !entry.isFolder && entry.path === this.path && entry.locale === this.locale
        })
      }
      return currentPage || null
    },
    buildAncestorChain (items, currentPage) {
      if (!currentPage) {
        return []
      }
      const itemById = _.keyBy(items, 'id')
      const chainIds = []
      let parentId = currentPage.parent || 0
      while (parentId > 0) {
        const parentNode = itemById[parentId]
        if (!parentNode || !parentNode.isFolder) {
          break
        }
        chainIds.unshift(parentNode.id)
        parentId = parentNode.parent || 0
      }
      return chainIds
    },
    async syncCurrentPath ({ withLoading = true } = {}) {
      const run = async () => {
        const items = await this.fetchCurrentPathItems({ withLoading: false })
        if (items.length < 1) {
          this.activeNodes = []
          this.currentPathNodeIds = []
          return []
        }

        const currentPage = this.findCurrentPageItem(items)
        if (!currentPage) {
          this.activeNodes = []
          this.currentPathNodeIds = []
          return []
        }

        const chainIds = this.buildAncestorChain(items, currentPage)
        for (const folderId of chainIds) {
          const folderNode = this.nodeIndexById[folderId]
          if (!folderNode || !folderNode.isFolder) {
            break
          }
          await this.fetchTreeChildren(folderNode, { withLoading: false })
        }

        if (currentPage.parent > 0) {
          const parentNode = this.nodeIndexById[currentPage.parent]
          if (parentNode && parentNode.isFolder) {
            await this.fetchTreeChildren(parentNode, { withLoading: false })
          }
        }

        if (this.nodeIndexById[currentPage.id]) {
          this.activeNodes = [currentPage.id]
        } else {
          this.activeNodes = []
        }
        this.currentPathNodeIds = _.uniq([...chainIds, currentPage.id])

        return chainIds
      }

      if (withLoading) {
        return this.withBrowseLoading('browse-load', run)
      }
      return run()
    },
    async fetchTreeChildren (item, { withLoading = true } = {}) {
      if (!item || !item.isFolder) {
        return []
      }
      if (_.includes(this.loadedFolderIds, item.id)) {
        return _.isArray(item.children) ? item.children : []
      }

      const run = async () => {
        const resp = await this.$apollo.query({
          query: PAGE_TREE_QUERY,
          fetchPolicy: 'cache-first',
          variables: {
            parent: item.id,
            locale: this.locale
          }
        })
        const items = this.filterTreeEntries(_.get(resp, 'data.pages.tree', []))
        const children = _.map(items, entry => this.buildTreeNode(entry))
        if (children.length > 0) {
          this.$set(item, 'children', children)
          this.registerTreeNodes(children)
        } else {
          this.$set(item, 'children', undefined)
        }
        this.loadedFolderIds = _.union(this.loadedFolderIds, [item.id])
        return children
      }

      if (withLoading) {
        return this.withBrowseLoading('browse-load', run)
      }
      return run()
    },
    async hydrateOpenNodes (ids, { withLoading = true } = {}) {
      const run = async () => {
        const pending = this.parseFolderIds(ids)
        let guard = 0
        while (pending.length > 0 && guard < 10) {
          let progressed = false
          for (let i = 0; i < pending.length; i++) {
            const folderId = pending[i]
            const folderNode = this.nodeIndexById[folderId]
            if (folderNode && folderNode.isFolder) {
              await this.fetchTreeChildren(folderNode, { withLoading: false })
              pending.splice(i, 1)
              i -= 1
              progressed = true
            }
          }
          if (!progressed) {
            break
          }
          guard += 1
        }
      }
      if (withLoading) {
        return this.withBrowseLoading('browse-load', run)
      }
      return run()
    },
    async initializeBrowseTree () {
      if (this.isInitializingBrowse) {
        return
      }
      this.isInitializingBrowse = true
      try {
        await this.withBrowseLoading('browse-load', async () => {
          this.resetBrowseState()
          await this.fetchRootItems({ withLoading: false })
          const pathChain = await this.syncCurrentPath({ withLoading: false })
          const persistedOpen = this.restoreOpenNodes()
          const candidateOpen = _.uniq([...persistedOpen, ...pathChain])
          await this.hydrateOpenNodes(candidateOpen, { withLoading: false })
          this.openNodes = this.normalizeFolderIds(candidateOpen)
          this.saveOpenNodes(this.openNodes)
          this.browseReady = true
        })
      } catch (err) {
        console.warn('Failed to initialize dynamic site tree:', err)
      } finally {
        this.isInitializingBrowse = false
        this.$nextTick(() => {
          this.scrollToCurrentNode()
        })
      }
    },
    handleActiveNodeChange (activeNodes) {
      const activeId = _.head(activeNodes)
      if (!activeId) {
        return
      }
      const activeNode = this.nodeIndexById[activeId]
      if (!activeNode || activeNode.isFolder || activeNode.pageId < 1) {
        return
      }
      if (activeNode.path === this.path && activeNode.locale === this.locale) {
        return
      }
      window.location.assign(this.buildPageHref(activeNode))
    },
    isCurrentPageNode (item) {
      return !item.isFolder && item.path === this.path && item.locale === this.locale
    },
    isCurrentPathNode (item) {
      return _.includes(this.currentPathNodeIds, item.id)
    },
    scrollToCurrentNode () {
      _.delay(() => {
        const currentNodeId = _.head(this.activeNodes)
        if (!currentNodeId || !this.$el) {
          return
        }
        const nodeEl = this.$el.querySelector(`[data-tree-node="${currentNodeId}"]`)
        if (nodeEl && _.isFunction(nodeEl.scrollIntoView)) {
          nodeEl.scrollIntoView({
            block: 'center',
            behavior: 'smooth'
          })
        }
      }, 80)
    },
    onSearchInput () {
      if (_.trim(this.searchQuery).length < 2) {
        this.searchResults = []
        return
      }
      this.performSearchDebounced()
    },
    async ensureAllPagesCache () {
      if (this.allPagesLoaded) {
        return
      }
      await this.withBrowseLoading('browse-search-load', async () => {
        const resp = await this.$apollo.query({
          query: PAGE_LIST_QUERY,
          fetchPolicy: 'network-only',
          variables: {
            locale: this.locale
          }
        })
        this.allPagesCache = _.map(_.get(resp, 'data.pages.list', []), page => ({
          id: page.id,
          path: page.path,
          title: this.getNodeTitle(page),
          locale: page.locale || this.locale
        }))
        this.allPagesLoaded = true
      })
    },
    applySearchQuery () {
      const normalizedQuery = _.trim(_.toLower(this.searchQuery))
      if (normalizedQuery.length < 2) {
        this.searchResults = []
        return
      }
      const tokens = _.filter(normalizedQuery.split(/\s+/), token => token.length > 0)
      const results = []
      for (const page of this.allPagesCache) {
        const haystack = `${_.toLower(page.title || '')} ${_.toLower(page.path || '')}`
        if (_.every(tokens, token => haystack.indexOf(token) >= 0)) {
          results.push(page)
          if (results.length >= 30) {
            break
          }
        }
      }
      this.searchResults = results
    },
    async refreshSearchResults () {
      try {
        await this.ensureAllPagesCache()
        this.applySearchQuery()
      } catch (err) {
        console.warn('Failed to load quick-jump search index:', err)
        this.searchResults = []
      }
    },
    navigateToSearchResult (result) {
      if (!result) {
        return
      }
      if (result.path === this.path && result.locale === this.locale) {
        this.searchQuery = ''
        this.searchResults = []
        return
      }
      window.location.assign(this.buildPageHref(result))
    },
    goHome () {
      window.location.assign(siteLangs.length > 0 ? `/${this.locale}/home` : '/')
    }
  },
  mounted () {
    this.performSearchDebounced = _.debounce(() => {
      this.refreshSearchResults()
    }, 200)
    this.foldersOnly = this.restoreFoldersOnlyPreference()

    if (this.navMode === 'TREE') {
      this.currentMode = 'browse'
    } else if (this.navMode === 'STATIC') {
      this.currentMode = 'custom'
    } else {
      this.currentMode = window.localStorage.getItem('navPref') || 'custom'
    }
    if (this.currentMode === 'browse') {
      this.initializeBrowseTree()
    }
  },
  beforeDestroy () {
    if (this.performSearchDebounced && _.isFunction(this.performSearchDebounced.cancel)) {
      this.performSearchDebounced.cancel()
    }
  }
}
</script>

<style lang='scss'>
.sidebar-search-box {
  .v-input__slot {
    min-height: 36px !important;
  }
}

.sidebar-folders-toggle {
  margin-top: 6px;

  .v-label {
    color: rgba(255, 255, 255, .9) !important;
    font-size: 12px;
  }
}

.sidebar-search-results {
  border-radius: 6px;
}

.sidebar-tree {
  .v-treeview-node__level {
    min-width: 0 !important;
    width: 0 !important;
  }

  .v-treeview-node__content {
    min-height: 30px;
  }

  .v-treeview-node__label {
    width: 100%;
  }

  .v-treeview-node__children {
    background: linear-gradient(180deg, rgba(255, 255, 255, .12) 0%, rgba(255, 255, 255, .03) 100%);
    border-radius: 6px;
    margin: 2px 0 4px 0;
    padding: 2px 0;
  }

  .sidebar-tree-label.is-current-path {
    background: linear-gradient(90deg, rgba(255, 255, 255, .18) 0%, rgba(255, 255, 255, .08) 100%);
    box-shadow: inset 2px 0 0 rgba(255, 255, 255, .55);
  }

  .v-treeview-node--active > .v-treeview-node__root .sidebar-tree-label,
  .sidebar-tree-label.is-current-page {
    background: linear-gradient(90deg, rgba(255, 255, 255, .34) 0%, rgba(255, 255, 255, .16) 70%, rgba(255, 255, 255, .06) 100%);
    box-shadow: inset 3px 0 0 rgba(255, 255, 255, .9);
    font-weight: 700;
  }

  .v-treeview-node--active > .v-treeview-node__root .v-icon {
    color: #fff !important;
  }
}

.sidebar-tree-label {
  align-items: baseline;
  border-radius: 6px;
  display: flex;
  gap: .4rem;
  overflow: hidden;
  padding: 2px 8px 2px 4px;
  transition: background-color .15s ease, box-shadow .15s ease;
  width: 100%;
}

.sidebar-tree-label.is-current-page {
  font-weight: 600;
}
</style>
