<template lang="pug">
  v-dialog(
    v-model='isShown'
    max-width='850px'
    :overlay-color='colors.overlay.page'
    )
    v-card.page-selector
      .dialog-header(:style='`background-color: ${colors.blue[500]} !important;`')
        v-icon.mr-3(color='white') mdi-page-next-outline
        .body-1(v-if='mode === `create`') {{$t('common:pageSelector.createTitle')}}
        .body-1(v-else-if='mode === `move`') {{$t('common:pageSelector.moveTitle')}}
        .body-1(v-else-if='mode === `select`') {{$t('common:pageSelector.selectTitle')}}
        v-spacer
        v-progress-circular(
          indeterminate
          color='white'
          :size='20'
          :width='2'
          v-show='searchLoading'
          )
      .d-flex
        v-flex(xs5)
          v-toolbar(
            :color='$vuetify.theme.dark ? colors.surfaceDark.secondaryBlueHeavy : colors.surfaceLight.secondaryBlueHeavy',
            dark,
            dense,
            flat
            )
            .body-2 {{$t('common:pageSelector.virtualFolders')}}
            v-spacer
            v-btn(icon, tile, href='https://docs.requarks.io/guide/pages#folders', target='_blank')
              v-icon(color="#ffffff") mdi-help-box
          div(style='height:400px;')
            vue-scroll(:ops='scrollStyle')
              v-treeview(
                v-if='tree && tree.length > 0'
                :items='tree'
                :active.sync='activeNodes'
                :open='openNodes'
                item-key='id'
                activatable
                dense
                expand-icon=''
                open-on-click
                @update:active='onNodeActivate'
                @update:open='onNodesOpen'
              )
                template(v-slot:prepend='{ item, open }')
                  v-icon(
                    small
                    :color='item.id === selectedFolderId ? "primary" : ""'
                    @click.stop='onFolderIconClick(item)'
                    style='cursor: pointer;'
                  ) {{ getFolderIcon(item, open) }}
                template(v-slot:label='{ item }')
                  span(
                    @click.stop='onFolderNameClick(item)'
                    style='cursor: pointer;'
                    :class='{ "primary--text font-weight-medium": item.id === selectedFolderId }'
                  ) {{ item.name }}
              div(v-else)
                .pa-4 Loading tree data...
        v-flex(xs7)
          v-toolbar(
            :color='$vuetify.theme.dark ? colors.surfaceDark.secondaryBlueHeavy : colors.surfaceLight.secondaryBlueHeavy',
            dark,
            dense,
            flat
            )
            .body-2 {{$t('common:pageSelector.pages')}}
            //- v-spacer
            //- v-btn(icon, tile, disabled): v-icon mdi-content-save-move-outline
            //- v-btn(icon, tile, disabled): v-icon mdi-trash-can-outline
          div(v-if='currentPages.length > 0', style='height:400px;')
            vue-scroll(:ops='scrollStyle')
              v-list.py-0(dense)
                v-list-item-group(
                  v-model='currentPage'
                  color='primary'
                  )
                  template(v-for='(page, idx) of currentPages')
                    v-list-item(
                      :key='`page-` + page.id',
                      :value='page',
                      @click='onPageClick(page)',
                      :disabled='isPageDisabled(page)'
                    )
                      v-list-item-icon: v-icon mdi-text-box
                      v-list-item-title {{page.title}}
                    v-divider(v-if='idx < pages.length - 1')
          v-alert.animated.fadeIn(
            v-else
            text
            color='orange'
            prominent
            icon='mdi-alert'
            )
            .body-2 {{$t('common:pageSelector.folderEmptyWarning')}}
      v-card-chin
        v-spacer
        v-btn.btn-rounded(
          outlined
          rounded
          :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
          @click='close'
          ) {{$t('common:actions.cancel')}}
        v-btn.px-4.btn-rounded(
          rounded
          dark
          :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
          @click='open'
          :disabled='!isValidPath'
          )
          v-icon(left, color='white') mdi-check
          span.text-none SELECT
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import colors from '@/themes/default/js/color-scheme'

const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i

/* global siteLangs, siteConfig */

export default {
  components: {},
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
    },
    mustExist: {
      type: Boolean,
      default: false
    },
    currentPagePath: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      searchLoading: false,
      isAutoExpanding: false,
      currentLocale: siteConfig.lang,
      pageName: 'unnamedpage-' + Date.now(),
      currentPage: null,
      clickedPagePath: null,
      selectedFolderId: null,
      tree: [],
      treeDataLoaded: false,
      activeNodes: [],
      openNodes: [],
      pages: [],
      all: [],
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollX: 0.01, // fix scrollbar not disappearing on load
          scrollingX: false,
          speed: 50
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#999',
          hoverStyle: {
            background: '#64B5F6'
          }
        }
      },
      siteId: this.$store.get('page/siteId'),
      siteName: this.$store.get('page/siteName'),
      colors: colors
    }
  },
  computed: {
    isShown: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    currentPages() {
      const parentId = this.selectedFolderId !== null ? this.selectedFolderId : 0
      const filtered = _.filter(this.pages, ['parent', parentId])
      return _.sortBy(filtered, ['child_position'])
    },
    currentFolder() {
      // If user clicked a page in create mode, use that page's path as the folder
      if (this.clickedPagePath) {
        return this.clickedPagePath
      }
      // Otherwise use the selected folder from tree
      if (this.selectedFolderId === null || this.selectedFolderId === 0) {
        return ''
      }
      const current = _.find(this.all, ['id', this.selectedFolderId])
      return _.get(current, 'path', '')
    },
    isValidPath() {
      // Build full path from folder + page name
      const fullPath = this.currentFolder ? `${this.currentFolder}/${this.pageName}` : this.pageName
      if (!fullPath || !this.pageName) {
        return false
      }
      if (this.mustExist && !this.currentPage) {
        return false
      }
      const firstSection = _.head(fullPath.split('/'))
      if (firstSection.length <= 1) {
        return false
      } else if (localeSegmentRegex.test(firstSection)) {
        return false
      } else if (
        _.some(
          [
            'login',
            'logout',
            'register',
            'verify',
            'favicons',
            'fonts',
            'img',
            'js',
            'svg'
          ],
          p => {
            return p === firstSection
          }
        )
      ) {
        return false
      } else {
        return true
      }
    }
  },
  watch: {
    tree: {
      handler(newVal) {
        // Tree updated
      },
      deep: true
    },
    async isShown(newValue, oldValue) {
      if (newValue && !oldValue) {
        // Reset clicked page path
        this.clickedPagePath = null
        
        const pathSegments = this.path.split('/').filter(s => s.length > 0)
        
        if (this.mode === 'create') {
          await this.handleCreateModeOpen(pathSegments)
        } else {
          await this.handleMoveSelectModeOpen(pathSegments)
        }
        
        this.currentLocale = this.locale
      }
    },
    async currentLocale(newValue, oldValue) {
      if (newValue !== oldValue) {
        // Reset tree when locale changes
        this.tree = []
        this.selectedFolderId = null
        this.pages = []
        this.all = []
        this.treeDataLoaded = false
        
        // Reload tree data
        await this.loadTreeData()
      }
    }
  },
  methods: {
    close() {
      this.isShown = false
    },
    async handleCreateModeOpen(pathSegments) {
      // Generate temp name with 13-digit timestamp
      const tempName = 'unnamedpage-' + Date.now()
      this.pageName = tempName
      
      await this.loadTreeData()
      
      if (pathSegments.length >= 1) {
        await this.tryExpandToPath(pathSegments)
      } else {
        this.selectedFolderId = 0
      }
    },
    async handleMoveSelectModeOpen(pathSegments) {
      // For move/select mode, the path is already the folder path
      await this.loadTreeData()
      
      if (pathSegments.length >= 1) {
        const folderPath = pathSegments.join('/')
        await this.expandToFolder(folderPath)
        
        // If expansion didn't work, try parent folder
        if (!this.selectedFolderId && pathSegments.length > 1) {
          const parentPath = pathSegments.slice(0, -1).join('/')
          if (parentPath) {
            await this.expandToFolder(parentPath)
          }
        }
      } else {
        this.selectedFolderId = 0
      }
    },
    async tryExpandToPath(pathSegments) {
      // Try to expand to the full path first
      const fullPath = pathSegments.join('/')
      await this.expandToFolder(fullPath)
      
      // If expansion failed, try parent folder
      if (!this.selectedFolderId) {
        const parentPath = pathSegments.slice(0, -1).join('/')
        if (parentPath) {
          await this.expandToFolder(parentPath)
        } else {
          this.selectedFolderId = 0
        }
      }
    },
    onPageClick(page) {
      // Allow clicking pages in all modes to use them as parent folders
      if (page && page.path) {
        // Store the clicked page's path as the folder
        this.clickedPagePath = page.path
      }
    },
    isPageDisabled(page) {
      // Disable page if it's the same as the current page being edited
      // This prevents creating a subpage inside the same page
      if (this.currentPagePath && page.path) {
        return page.path === this.currentPagePath
      }
      return false
    },
    onNodeActivate(nodes) {
      // Handle tree node activation (selection)
      if (nodes && nodes.length > 0) {
        const nodeId = nodes[0]
        this.selectedFolderId = nodeId
        // Reset clicked page when navigating folders
        this.clickedPagePath = null
        
        // Load children if not loaded yet
        const item = this.all.find(i => i.id === nodeId)
        if (item && item.isFolder) {
          const treeNode = this.findTreeNode(this.tree[0], nodeId)
          if (treeNode && (!treeNode.children || treeNode.children.length === 0)) {
            this.fetchFolders(item, treeNode)
          }
        }
      }
    },
    onFolderNameClick(item) {
      // Handle clicking the folder name directly
      if (item && item.id !== undefined) {
        // Select the folder
        this.selectedFolderId = item.id
        this.activeNodes = [item.id]
        
        // Reset clicked page
        this.clickedPagePath = null
        
        // Load children if not loaded yet
        const folderData = this.all.find(i => i.id === item.id)
        if (folderData && folderData.isFolder) {
          const treeNode = this.findTreeNode(this.tree[0], item.id)
          if (treeNode && (!treeNode.children || treeNode.children.length === 0)) {
            this.fetchFolders(folderData, treeNode)
          }
        }
        
        // Toggle open/close state
        const isOpen = this.openNodes.includes(item.id)
        if (isOpen) {
          // Already open, close it
          this.openNodes = this.openNodes.filter(id => id !== item.id)
        } else {
          // Closed, open it
          this.openNodes = [...this.openNodes, item.id]
        }
      }
    },
    onFolderIconClick(item) {
      // Handle clicking the folder icon - just toggle open/close
      if (item && item.id !== undefined) {
        const isOpen = this.openNodes.includes(item.id)
        if (isOpen) {
          // Close it
          this.openNodes = this.openNodes.filter(id => id !== item.id)
        } else {
          // Open it and load children if needed
          this.openNodes = [...this.openNodes, item.id]
          
          const folderData = this.all.find(i => i.id === item.id)
          if (folderData && folderData.isFolder) {
            const treeNode = this.findTreeNode(this.tree[0], item.id)
            if (treeNode && (!treeNode.children || treeNode.children.length === 0)) {
              this.fetchFolders(folderData, treeNode)
            }
          }
        }
      }
    },
    getFolderIcon(item, isOpen) {
      // Return the appropriate icon based on folder type and state
      if (item.id === 0) {
        // Root folder - always use home icon
        return 'mdi-home'
      }
      // Regular folder - show open or closed based on state
      return isOpen ? 'mdi-folder-open' : 'mdi-folder'
    },
    onNodesOpen(openNodeIds) {
      // Handle when user manually opens/closes nodes
      // Only update if not currently auto-expanding
      if (!this.isAutoExpanding) {
        this.openNodes = openNodeIds
      }
    },
    open() {
      // For create mode, build full path with page name
      // For move mode or other modes, return just the folder path
      let pathToReturn
      if (this.mode === 'create') {
        // For create mode, append the temporary page name to the selected folder
        pathToReturn = this.currentFolder ? `${this.currentFolder}/${this.pageName}` : this.pageName
      } else if (this.mode === 'move') {
        // For move mode, return just the folder path without any page name
        pathToReturn = this.currentFolder || ''
      } else if (!this.mustExist) {
        // Return just the selected folder path (used for Select Path button)
        pathToReturn = this.currentFolder || ''
      } else {
        // Build full path from current folder + page name
        pathToReturn = this.currentFolder ? `${this.currentFolder}/${this.pageName}` : this.pageName
      }
      // Replace all "." with "-" to simplify the path format for the end user
      const sanitizedPath = pathToReturn.replace(/\./g, '-')
      const exit = this.openHandler({
        locale: this.currentLocale,
        path: sanitizedPath,
        id: this.mustExist && this.currentPage ? this.currentPage.pageId : 0
      })
      if (exit !== false) {
        this.close()
      }
    },
    async loadTreeData() {
      if (this.treeDataLoaded) return
      
      this.searchLoading = true
      
      try {
        // Fetch root level folders
        const resp = await this.$apollo.query({
          query: gql`
            query(
              $parent: Int!
              $mode: PageTreeMode!
              $locale: String!
              $siteId: String!
            ) {
                tree(
                  parent: $parent
                  mode: $mode
                  locale: $locale
                  siteId: $siteId
                ) {
                  id
                  path
                  title
                  isFolder
                  pageId
                  parent
                  siteId
                  child_position
                }
            }
          `,
          fetchPolicy: 'network-only',
          variables: {
            parent: 0,
            mode: 'ALL',
            locale: this.currentLocale,
            siteId: this.siteId
          }
        })

      const items = _.get(resp, 'data.tree', [])
      const filteredItems = items.filter(i => {
        const itemSiteId = String(i.siteId)
        const currentSiteId = String(this.siteId)
        return itemSiteId === currentSiteId
      })

      // Sort by child_position
      const sortedItems = _.sortBy(filteredItems, ['child_position'])
      // Store all items
        this.all = [
          { id: 0, path: '', title: this.siteName, isFolder: true, parent: null },
          ...sortedItems
        ]

        // Convert to v-treeview format
        const rootFolders = _.filter(sortedItems, ['isFolder', true]).map(f => ({
          id: f.id,
          name: f.title,
          path: f.path,
          isFolder: true,
          children: [],
          icon: 'mdi-folder'
        }))
        
        // Store pages separately
        const rootPages = _.filter(sortedItems, i => i.pageId > 0)
        this.pages = rootPages

        // Build tree with root node
        this.tree = [
          {
            id: 0,
            name: this.siteName || 'Root',
            path: '',
            isFolder: true,
            children: rootFolders,
            icon: 'mdi-home'
          }
        ]
        
        // Open root by default
        this.openNodes = [0]
        
        this.treeDataLoaded = true
      } catch (error) {
        console.error('Error loading tree data:', error)
        // Initialize with empty tree to prevent errors
        this.tree = [
          {
            id: 0,
            name: this.siteName || 'Root',
            path: '',
            isFolder: true,
            children: [],
            icon: 'mdi-home'
          }
        ]
        this.openNodes = [0]
        this.treeDataLoaded = true
      } finally {
        this.searchLoading = false
      }
    },
    async fetchFolders(item, treeNode = null) {
      if (!item || item.id === undefined) {
        return
      }
      
      this.searchLoading = true
      const resp = await this.$apollo.query({
        query: gql`
          query(
            $parent: Int!
            $mode: PageTreeMode!
            $locale: String!
            $siteId: String!
          ) {
              tree(
                parent: $parent
                mode: $mode
                locale: $locale
                siteId: $siteId
              ) {
                id
                path
                title
                isFolder
                pageId
                parent
                siteId
                child_position
              }
          }
        `,
        fetchPolicy: 'network-only',
        variables: {
          parent: item.id,
          mode: 'ALL',
          locale: this.currentLocale,
          siteId: this.siteId
        }
      })

      const items = _.get(resp, 'data.tree', [])

      const filteredItems = items.filter(i => {
        const itemSiteId = String(i.siteId)
        const currentSiteId = String(this.siteId)
        return itemSiteId === currentSiteId
      })

      // Sort by child_position
      const sortedItems = _.sortBy(filteredItems, ['child_position'])

      // Convert folders to v-treeview format
      const itemFolders = _.filter(sortedItems, ['isFolder', true]).map(f => ({
        id: f.id,
        name: f.title,
        path: f.path,
        isFolder: true,
        children: [],
        icon: 'mdi-folder'
      }))
      
      const itemPages = _.filter(sortedItems, i => i.pageId > 0)
      
      // Update the tree node's children if treeNode provided
      if (treeNode && itemFolders.length > 0) {
        this.$set(treeNode, 'children', itemFolders)
      }
      
      // Store in flat arrays
      this.pages = _.unionBy(this.pages, itemPages, 'id')
      this.all = _.unionBy(this.all, sortedItems, 'id')

      this.searchLoading = false
      return itemFolders
    },
    buildPathHierarchy(folderPath) {
      // Build the path hierarchy (e.g., "Tree/Branch/Leaf" -> ["Tree", "Tree/Branch", "Tree/Branch/Leaf"])
      const pathSegments = folderPath.split('/').filter(s => s.length > 0)
      const pathHierarchy = []
      for (let i = 0; i < pathSegments.length; i++) {
        pathHierarchy.push(pathSegments.slice(0, i + 1).join('/'))
      }
      return pathHierarchy
    },
    async loadFolderIfNeeded(targetPath) {
      // Try to load the folder from parent if not in cache
      const parentPathSegments = targetPath.split('/').slice(0, -1)
      const parentPath = parentPathSegments.join('/')
      
      const parentFolder = parentPath 
        ? this.all.find(item => item.path === parentPath && item.isFolder)
        : { id: 0, path: '', isFolder: true }
      
      if (parentFolder) {
        const parentNode = this.findTreeNode(this.tree[0], parentFolder.id || 0)
        if (parentNode) {
          await this.fetchFolders(parentFolder, parentNode)
          await this.$nextTick()
        }
      }
    },
    async expandFolderNode(folderId) {
      // Add folder to openNodes and wait for rendering
      if (!this.openNodes.includes(folderId)) {
        this.openNodes = [...this.openNodes, folderId]
        await this.$nextTick()
        await this.$nextTick()
        await this.$nextTick()
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    },
    async preloadChildrenIfNeeded(folder, treeNode) {
      // Preload children for intermediate folders
      if (!treeNode.children || treeNode.children.length === 0) {
        await this.fetchFolders(folder, treeNode)
        await this.$nextTick()
      }
    },
    async selectFinalFolder(folder, treeNode) {
      // Select and load final destination folder
      this.selectedFolderId = folder.id
      this.activeNodes = [folder.id]
      if (treeNode) {
        await this.fetchFolders(folder, treeNode)
      }
    },
    async expandToFolder(folderPath) {
      if (!folderPath) {
        this.selectedFolderId = 0
        this.activeNodes = [0]
        return
      }

      this.isAutoExpanding = true
      this.searchLoading = true
      
      const pathHierarchy = this.buildPathHierarchy(folderPath)
      
      // Expand each level sequentially
      for (let i = 0; i < pathHierarchy.length; i++) {
        const targetPath = pathHierarchy[i]
        let folder = this.all.find(item => item.path === targetPath && item.isFolder)
        
        if (!folder) {
          await this.loadFolderIfNeeded(targetPath)
          folder = this.all.find(item => item.path === targetPath && item.isFolder)
        }
        
        if (!folder) {
          break // Could not find folder, stop expansion
        }
        
        await this.expandFolderNode(folder.id)
        
        const treeNode = this.findTreeNode(this.tree[0], folder.id)
        const isLastInHierarchy = (i === pathHierarchy.length - 1)
        
        if (isLastInHierarchy) {
          await this.selectFinalFolder(folder, treeNode)
        } else if (treeNode) {
          await this.preloadChildrenIfNeeded(folder, treeNode)
        }
      }
      
      this.searchLoading = false
      this.isAutoExpanding = false
    },
    findTreeNode(node, id) {
      if (node.id === id) return node
      if (node.children) {
        for (const child of node.children) {
          const found = this.findTreeNode(child, id)
          if (found) return found
        }
      }
      return null
    }
  }
}
</script>
