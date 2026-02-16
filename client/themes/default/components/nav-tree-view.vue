<template lang="pug">
  .tree-navigation
    .tree-content-wrapper
      v-treeview(
        v-if='pageTree.length > 0'
        :key='`navTree-` + treeViewCacheId'
        :active.sync='activeNodes'
        :open.sync='openNodes'
        :items='pageTree'
        :load-children='loadChildren'
        dense
        open-on-click
        item-key='path'
        item-text='title'
        item-children='children'
        activatable
        hoverable
        return-object
        @update:active='onNodeActivated'
      )
          template(v-slot:prepend='{ item, open }')
            v-icon(
              v-if='item.isFolder || item.hasChildren || (item.children && item.children.length > 0)'
              :color='getIconColor(item)'
              size='20'
              @mouseenter='preloadChildren(item)'
            ) {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
            v-icon(
              v-else
              :color='getIconColor(item)'
              size='20'
              @click.stop='navigateToPage(item)'
            ) mdi-file-document-outline
          
          template(v-slot:label='{ item }')
            .tree-node-label(
              :class='getNodeClasses(item)'
              :title='item.description || item.title'
              @click.stop='handleLabelClick(item)'
              @mouseenter='preloadChildren(item)'
            )
              span.node-title {{ item.title }}
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import colors from '@/themes/default/js/color-scheme'
import pageTreeQuery from '@/graph/common/common-pages-query-tree.gql'
import childPagesQuery from '@/graph/common/common-pages-query-child-pages.gql'

export default {
  name: 'NavTreeView',
  props: {
    dark: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      pageTree: [],
      activeNodes: [],
      openNodes: [],
      treeViewCacheId: 0,
      loadedPaths: new Set(),
      saveStateTimeout: null,
      preloadTimeout: null,
      isLoading: false,
      isRestoringState: false, // Flag to prevent saving during restoration
      colors: colors
    }
  },
  computed: {
    pageId: get('page/id'),
    path: get('page/path'),
    locale: get('page/locale'),
    sitePath: get('page/sitePath'),
    siteId: get('page/siteId'),
    currentPagePath() {
      return this.path || ''
    }
  },
  watch: {
    openNodes: {
      deep: true,
      handler(newOpenNodes) {
        if (!this.isRestoringState) {
          this.saveTreeState()
        }
      }
    },
    path: {
      immediate: false,
      async handler(newPath, oldPath) {
        if (newPath && newPath !== oldPath) {
          this.setActivePage(newPath)
          await this.scrollToActivePage()
        }
      }
    }
  },
  mounted() {
    // Load full tree first
    if (this.siteId && this.locale) {
      this.loadInitialTree().then(async () => {
        this.isRestoringState = true // Disable watcher during restoration
        
        // Restore expanded state after tree is built
        this.restoreExpandedState()
        
        // Load children for all restored open nodes
        await this.loadChildrenForOpenNodes()
        
        if (this.path) {
          await this.expandToCurrentPage(this.path)
          this.setActivePage(this.path)
          await this.scrollToActivePage()
        }
        
        this.isRestoringState = false // Re-enable watcher AFTER everything is done
        
        // Save the final state once
        this.saveTreeState()
      })
    }
    
    // Listen for page tree refresh events
    this.$root.$on('reloadPageTree', this.reloadTree)
  },
  beforeDestroy() {
    this.$root.$off('reloadPageTree', this.reloadTree)
  },
  methods: {
    async reloadTree(options = {}) {
      try {
        // Save current expanded paths before reload (openNodes contains objects due to return-object)
        const savedPaths = this.openNodes.map(node => {
          if (typeof node === 'string') return node
          if (node && typeof node === 'object') return node.path || ''
          return ''
        }).filter(p => p !== '')
        
        // Add the expand path from options if provided (for page moves)
        if (options.expandPath && !savedPaths.includes(options.expandPath)) {
          savedPaths.push(options.expandPath)
        }
        
        this.isRestoringState = true
        
        // Reset loaded paths so children will reload
        this.loadedPaths.clear()
        
        // Clear open nodes before reload
        this.openNodes = []
        
        // Reload the tree (loadInitialTree uses network-only already)
        await this.loadInitialTree()
        
        // Wait for tree to render
        await this.$nextTick()
        
        // Restore expanded nodes by finding nodes with matching paths
        const nodesToOpen = []
        for (const path of savedPaths) {
          const node = this.findPageInTree(path)
          if (node) {
            nodesToOpen.push(node)
            // Also load children for this node with force network to get fresh data
            if (node.pageId && (node.isFolder || node.hasChildren)) {
              await this.loadChildren(node, true) // Force network fetch
            }
          }
        }
        
        // Set open nodes with the new node references
        this.openNodes = nodesToOpen
        
        // Restore active page
        if (this.path) {
          this.setActivePage(this.path)
        }
        
        this.isRestoringState = false
        
        // Trigger a re-render by incrementing cache ID
        this.treeViewCacheId++
      } catch (error) {
        console.error('Nav tree view reload failed:', error)
        this.isRestoringState = false
      }
    },
    saveTreeState() {
      if (this.saveStateTimeout) {
        clearTimeout(this.saveStateTimeout)
      }
      
      this.saveStateTimeout = setTimeout(() => {
        if (this.isRestoringState) {
          return
        }
        
        try {
          // Extract paths from openNodes (which contains objects due to return-object)
          const pathsToSave = this.openNodes.map(node => {
            if (typeof node === 'string') {
              return node
            } else if (node && typeof node === 'object') {
              return node.path || node.id || ''
            }
            return ''
          }).filter(p => p !== '')
          
          localStorage.setItem('wiki-tree-expanded', JSON.stringify(pathsToSave))
        } catch (error) {
          console.warn('Failed to save tree state to localStorage:', error)
        }
      }, 100)
    },
    
    async scrollToActivePage() {
      if (!this.currentPagePath) return
      
      // Ensure path is expanded first
      await this.expandToCurrentPage(this.currentPagePath)
      
      // Wait for Vue to render the expanded nodes
      await this.$nextTick()

      // Find and scroll to element
      const targetElement = this.$el.querySelector('.tree-node-current')
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    },
    
    async loadChildrenForOpenNodes() {
      // Load children for all nodes that are in openNodes
      if (this.openNodes.length === 0) return
      
      const pathsToLoad = [...this.openNodes] // Copy to avoid mutation issues
      
      for (const nodePath of pathsToLoad) {
        const node = this.findPageInTree(nodePath)
        if (node && node.pageId && (node.isFolder || node.hasChildren) && !this.loadedPaths.has(nodePath)) {
          await this.loadChildren(node)
        }
      }
    },

    restoreExpandedState() {
      try {
        const savedState = localStorage.getItem('wiki-tree-expanded')
        
        if (savedState) {
          const parsed = JSON.parse(savedState)
          
          // Check if it's corrupted (objects instead of strings)
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
            localStorage.removeItem('wiki-tree-expanded')
            this.openNodes = []
            return false
          }
          
          if (Array.isArray(parsed)) {
            // Ensure only valid string paths are restored
            const pathsOnly = parsed.filter(item => typeof item === 'string')
            
            // Don't validate yet - we'll load children and validate after
            this.openNodes = [...pathsOnly]
            return true
          }
        }
        this.openNodes = []
        return false
      } catch (error) {
        console.warn('Failed to restore tree state from localStorage:', error)
        localStorage.removeItem('wiki-tree-expanded')
        this.openNodes = []
        return false
      }
    },
    async loadInitialTree() {
      try {
        if (!this.$apollo) {
          console.warn('Apollo client not available yet')
          return
        }
        
        if (!this.siteId || !this.locale) {
          return
        }
        
        this.isLoading = true
        
        // Load FULL tree on initial load to support state restoration
        const pageTreeResp = await this.$apollo.query({
          query: pageTreeQuery,
          fetchPolicy: 'network-only',
          variables: {
            path: '',  // Empty path = load from root
            mode: 'ALL',
            locale: this.locale,
            includeAncestors: false, // Load everything, not just ancestors
            siteId: this.siteId
          }
        })
        
        const items = _.get(pageTreeResp, 'data.tree', [])
        
        const filteredItems = items.filter(item => item.siteId === this.siteId)
        
        // Build tree structure
        this.pageTree = this.buildTreeStructure(filteredItems)
        
        this.treeViewCacheId++
        this.isLoading = false
      } catch (error) {
        console.error('Failed to load initial tree:', error)
        this.isLoading = false
        this.pageTree = []
      }
    },

    // Convert flat GraphQL response into hierarchical tree structure
    buildTreeStructure(flatItems) {
      const tree = []
      const nodeMapById = new Map()
      
      // First pass: Create all nodes and index by ID
      flatItems.forEach(item => {
        const node = {
          ...item,
          children: item.children || [],
          isFolder: item.isFolder || false,
          hasChildren: item.hasChildren || false // Preserve server flag
        }
        nodeMapById.set(item.id, node)
      })
      
      // Second pass: Build parent-child relationships using ID
      flatItems.forEach(item => {
        const node = nodeMapById.get(item.id)
        
        if (item.parent) {
          // Parent is an ID, look it up in the ID map
          const parentNode = nodeMapById.get(item.parent)
          
          if (parentNode) {
            parentNode.children.push(node)
            parentNode.hasChildren = true
          } else {
            // Parent not in tree, treat as root level
            tree.push(node)
          }
        } else {
          // No parent = root level item
          tree.push(node)
        }
      })
      
      // Sort children by child_position to preserve custom order
      this.sortTreeNodes(tree)
      
      return tree
    },
    
    // Recursively sort tree nodes by child_position
    sortTreeNodes(nodes) {
      nodes.sort((a, b) => {
        // Sort by child_position only
        return (a.child_position || 0) - (b.child_position || 0)
      })
      
      // Recursively sort children
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          this.sortTreeNodes(node.children)
        }
      })
    },

    async loadChildren(node, forceNetwork = false) {
      // Smart lazy loading - only load if not already loaded (unless force)
      if (!forceNetwork && this.loadedPaths.has(node.path)) {
        return Promise.resolve()
      }
      
      if (!node.pageId) {
        return Promise.resolve()
      }
      
      try {
        const childrenResp = await this.$apollo.query({
          query: childPagesQuery,
          fetchPolicy: forceNetwork ? 'network-only' : 'cache-first',
          variables: {
            pageId: node.pageId,
            locale: this.locale,
            siteId: this.siteId
          }
        })
        
        const children = _.get(childrenResp, 'data.childPages', [])
        
        if (children.length > 0) {
          // Set children with proper structure
          node.children = children.map(child => ({
            ...child,
            children: [],
            isFolder: child.isFolder || false,
            hasChildren: child.hasChildren || false
          }))
          
          // Mark as loaded
          this.loadedPaths.add(node.path)
          
          // Don't increment treeViewCacheId - it destroys the component and resets openNodes!
          // Vuetify's reactivity will handle the update
        }
        
        return Promise.resolve()
      } catch (error) {
        console.error('Failed to load children for node:', node.path, error)
        return Promise.resolve()
      }
    },

    getIconColor(item) {
      if (this.isCurrentPage(item)) {
        return this.dark ? colors.blue[300] : colors.blue[700]
      }
      return this.dark ? colors.textDark.primary : colors.textLight.primary
    },

    getNodeClasses(item) {
      const hasAnyChildren = item.hasChildren || (item.children && item.children.length > 0)
      
      return {
        'tree-node': true,
        'tree-node-page': !hasAnyChildren,
        'tree-node-folder': hasAnyChildren,
        'tree-node-virtual-folder': hasAnyChildren && !item.isFolder,
        'tree-node-true-folder': item.isFolder,
        'tree-node-current': this.isCurrentPage(item)
      }
    },

    isCurrentPage(item) {
      const normalize = (path) => {
        if (!path) return ''
        let normalized = (path || '').trim()
        // Remove leading slashes
        while (normalized.length > 0 && normalized[0] === '/') {
          normalized = normalized.substring(1)
        }
        // Remove trailing slashes
        while (normalized.length > 0 && normalized[normalized.length - 1] === '/') {
          normalized = normalized.substring(0, normalized.length - 1)
        }
        return normalized
      }
      const currentPath = normalize(this.currentPagePath)
      const itemPath = normalize(item.path)

      return currentPath && itemPath && currentPath === itemPath
    },

    onNodeActivated(nodes) {
      if (nodes.length > 0) {
        const selectedNode = nodes[0]
        // Navigate to any selected page (leaf or parent page)
        if (selectedNode.path) {
          this.navigateToPage(selectedNode)
        }
      }
    },
    
    preloadChildren(item) {
      // Instant preload on hover - seamless UX
      if (this.preloadTimeout) {
        clearTimeout(this.preloadTimeout)
      }
      
      this.preloadTimeout = setTimeout(() => {
        // Preload children on hover if not already loaded
        if (!this.loadedPaths.has(item.path) && item.pageId && (item.isFolder || item.hasChildren)) {
          this.loadChildren(item)
        }
      }, 0)
    },
    
    handleLabelClick(item) {
      const hasChildren = item.isFolder || item.hasChildren || (item.children && item.children.length > 0)
      
      if (hasChildren && !item.path) {
        // True folder with no page - just toggle expansion
        this.toggleNode(item)
      } else if (item.path) {
        // Has a path (either a page or virtual folder) - navigate to it
        this.navigateToPage(item)
      }
    },

    navigateToPage(item) {
      if (item.path && item.path !== this.currentPagePath) {
        const url = `/${this.sitePath}/${item.locale}/${item.path}`
        window.location.assign(url)
      }
    },
    
    // Find a page in the tree by path (recursively search)
    findPageInTree(targetPath, items = null) {
      const searchItems = items || this.pageTree
      
      for (const item of searchItems) {
        if (item.path === targetPath) {
          return item
        }
        if (item.children && item.children.length > 0) {
          const found = this.findPageInTree(targetPath, item.children)
          if (found) return found
        }
      }
      
      return null
    },

    // Auto-expand tree to show the currently active page
    async expandToCurrentPage(targetPath) {
      if (!targetPath) return
      
      const pathParts = targetPath.split('/').filter(Boolean)
      const nodesToExpand = []
      
      let currentPath = ''
      for (const part of pathParts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        
        // Find the actual node object in the tree
        let node = this.findPageInTree(currentPath)
        
        // If node not found, try to load its parent's children first
        if (!node && nodesToExpand.length > 0) {
          const parentNode = nodesToExpand[nodesToExpand.length - 1]
          if (parentNode && (parentNode.isFolder || parentNode.hasChildren) && !this.loadedPaths.has(parentNode.path)) {
            await this.loadChildren(parentNode)
            // Try to find the node again after loading parent's children
            node = this.findPageInTree(currentPath)
          }
        }
        
        if (node) {
          nodesToExpand.push(node) // Push the object, not the string!
        }
      }
      
      // Merge with existing openNodes (which are also objects)
      const existingPaths = this.openNodes.map(n => n.path || n)
      const newPaths = nodesToExpand.map(n => n.path)
      const allUniquePaths = [...new Set([...existingPaths, ...newPaths])]
      
      // Find all node objects for these paths
      const allNodes = []
      allUniquePaths.forEach(path => {
        const node = this.findPageInTree(path)
        if (node) {
          allNodes.push(node)
        }
      })
      
      this.openNodes = allNodes
    },

    setActivePage(targetPath) {
      this.activeNodes = [targetPath]
      
      // Set hasChildren in store for export functionality
      const currentNode = this.findPageInTree(targetPath)
      if (currentNode) {
        const hasChildren = currentNode.isFolder || currentNode.hasChildren || (currentNode.children && currentNode.children.length > 0)
        this.$store.set('page/hasChildren', hasChildren)
      }
    },

    toggleNode(item) {
      const index = this.openNodes.indexOf(item.path)
      if (index > -1) {
        this.openNodes.splice(index, 1)
      } else {
        this.openNodes.push(item.path)
        // No need to lazy load - all children are already loaded
      }
      
      this.saveTreeState()
    }
  }
}
</script>

<style lang="scss" scoped>
.tree-navigation {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  
  .tree-content-wrapper {
    min-width: min-content;
    display: inline-block;
    width: 100%;
    flex: 1;
  }
  
  .tree-node-label {
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
    
    &:hover {
      background-color: rgba(mc('blue', '500'), 0.1);
      
      @at-root .theme--dark & {
        background-color: rgba(mc('blue', '300'), 0.1);
      }
    }
    
    &.tree-node-current {
      background-color: rgba(mc('blue', '500'), 0.2);
      font-weight: 500;
      
      @at-root .theme--dark & {
        background-color: rgba(mc('blue', '300'), 0.2);
      }
      
      .node-title {
        color: mc('blue', '700');
        
        @at-root .theme--dark & {
          color: mc('blue', '300');
        }
      }
    }
    
    &.tree-node-folder .node-title {
      font-weight: 500;
      
      &:hover {
        color: mc('blue', '600');
        
        @at-root .theme--dark & {
          color: mc('blue', '300');
        }
      }
    }
    
    &.tree-node-page {
      cursor: pointer;
      
      &:hover .node-title {
        color: mc('blue', '600');
        text-decoration: underline;
        
        @at-root .theme--dark & {
          color: mc('blue', '200');
        }
      }
    }
    
    &.tree-node-virtual-folder {
      cursor: pointer;
      
      .node-title {
        font-weight: 500;
        font-style: italic;
      }
      
      &:hover .node-title {
        color: mc('blue', '600');
        
        @at-root .theme--dark & {
          color: mc('blue', '300');
        }
      }
    }
    
    &.tree-node-true-folder {
      .node-title {
        font-weight: 500;
      }
      
      &:hover .node-title {
        color: mc('blue', '600');
        
        @at-root .theme--dark & {
          color: mc('blue', '300');
        }
      }
    }
  }
  
  .node-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: mc('neutral', '1000') !important;
    
    @at-root .theme--dark & {
      color: mc('neutral', '50') !important;
    }
  }
  
  .tree-node-label .node-title {
    color: mc('neutral', '1000') !important;
    
    @at-root .theme--dark & {
      color: mc('neutral', '50') !important;
    }
  }
  
  .tree-node-current .node-title {
    color: mc('blue', '600') !important;
    
    @at-root .theme--dark & {
      color: mc('blue', '300') !important;
    }
  }
}
</style>

<style lang="scss">
// Unscoped styles to properly target Vuetify-generated v-treeview DOM elements
.tree-navigation .v-treeview {
  padding-left: 12px;
  
  .v-treeview-node__root {
    padding-left: 0 !important;
  }
  
  .v-treeview-node__content {
    margin-left: 0 !important;
  }
  
  .v-treeview-node__level {
    width: 16px !important;
  }
  
  // Hide the default Vuetify chevron toggle completely - we use folder icons instead
  .v-treeview-node__toggle {
    display: none !important;
  }
  
  .v-treeview-node__prepend {
    width: 24px !important;
  }
  
  .v-treeview-node__label {
    padding: 0 !important;
    flex: 1 !important;
    color: mc('neutral', '1000') !important;
  }

  .v-icon {
    color: mc('neutral', '1000') !important;
  }

  .v-treeview-node--active {
    .v-treeview-node__label {
      color: mc('blue', '600') !important;
    }
    
    .v-icon {
      color: mc('blue', '600') !important;
    }
  }
}

// Dark theme overrides
.theme--dark .tree-navigation .v-treeview,
.v-application.theme--dark .tree-navigation .v-treeview {
  .v-treeview-node__label {
    color: mc('neutral', '50') !important;
  }

  .v-icon {
    color: mc('neutral', '50') !important;
  }

  .v-treeview-node--active {
    .v-treeview-node__label {
      color: mc('blue', '300') !important;
    }
    
    .v-icon {
      color: mc('blue', '300') !important;
    }
  }
}
</style>