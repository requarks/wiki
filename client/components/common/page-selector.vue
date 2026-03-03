<template lang="pug">
  v-dialog(
    v-model='isShown'
    max-width='900px'
    :overlay-color='colors.overlay.page'
    )
    v-card.page-selector
      .dialog-header(:style='`background-color: ${colors.blue[500]} !important;`')
        v-icon.mr-3(color='white') mdi-page-next-outline
        .body-1(v-if='mode === `create`') {{$t('common:pageSelector.createTitle')}}
        .body-1(v-else-if='mode === `move`') Move/Reorder
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
          div.folder-tree-container(
            ref='folderTreeContainer'
            style='height:400px;'
            @dragover.prevent='onTreeDragOver'
            @drop.prevent='onTreeDrop($event, null)'
            :class='{ "drop-target-active": draggedPage, "drop-target-folder-selected": dropTargetFolder }'
          )
            .drop-hint(v-if='draggedPage')
              v-icon(color='white', small) mdi-folder-move
              span.ml-2 {{ dropTargetFolder ? `Move to "${dropTargetFolder.name || 'Root'}"` : 'Drag here to move' }}
            vue-scroll(ref='treeScroll', :ops='scrollStyle')
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
                    :color='getTreeItemColor(item, open)'
                    @click.stop='onFolderIconClick(item)'
                    style='cursor: pointer;'
                  ) {{ getFolderIcon(item, open) }}
                template(v-slot:label='{ item }')
                  .tree-folder-label(
                    :ref="'treeNode-' + item.id"
                    :data-folder-id='item.id'
                    @click.stop='onFolderNameClick(item)'
                    @dragover.prevent.stop='onFolderDragOver($event, item)'
                    @dragleave='onFolderDragLeave(item)'
                    @drop.prevent.stop='onTreeDrop($event, item)'
                    :class='getTreeLabelClass(item)'
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
            v-spacer
            v-chip.mr-2(v-if='draggedPage', small, color='primary', dark)
              v-icon(left, small) mdi-cursor-move
              | Drag to folder or reorder
          v-alert.ma-2.move-instruction-alert(v-if='mode === "move" && hasCurrentPageInList', outlined, color='primary', icon='mdi-information')
            .body-2.font-weight-medium Select a folder/page to relocate current page or drag item to move it to new location.
          .pages-container(v-if='mode === "move" && currentPages.length > 0', style='height:400px; overflow-y: auto;')
            draggable.page-list(
              v-model='draggablePages'
              tag='div'
              :animation='200'
              ghost-class='ghost'
              chosen-class='chosen'
              drag-class='dragging'
              @start='onDragStart'
              @end='onDragEnd'
              handle='.drag-handle'
              :force-fallback='true'
              fallback-class='sortable-fallback'
              :swap-threshold='0.65'
              :fallback-on-body='true'
              :fallback-tolerance='3'
              :scroll='true'
              :scroll-sensitivity='100'
              :move='onDragMove'
              :delay='0'
              :touch-start-threshold='3'
            )
              .page-item(
                v-for='(page, idx) in draggablePages'
                :key='page.id'
                :data-page-id='page.id'
                :class='{ "current-page-item": isCurrentPage(page) }'
              )
                v-list-item.drag-item(
                  :class='{ "page-being-dragged": draggedPage && draggedPage.id === page.id, "current-page-editing": isCurrentPage(page) }'
                )
                  v-list-item-icon.drag-handle(
                    style='cursor: grab;'
                    v-tooltip='isCurrentPage(page) ? { content: "This is the page you are currently editing", delay: { show: 500 } } : {}'
                  )
                    v-icon(:color='isCurrentPage(page) ? "primary" : null') mdi-drag
                  v-list-item-icon
                    v-icon(v-if='page.hasSubpages', color='#338091') mdi-folder
                    v-icon(v-else, color='primary') mdi-file-document-outline
                  v-list-item-content
                    v-list-item-title.font-weight-medium {{ page.title }}
                    v-list-item-subtitle
                      span.text--secondary {{ page.path }}
                      v-chip.ml-2(v-if='isCurrentPage(page)', x-small, color='primary', dark) Current Page
                v-divider(v-if='idx < draggablePages.length - 1')
          div(v-else-if='mode !== "move" && currentPages.length > 0', style='height:400px;')
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
                      v-list-item-icon
                        v-icon(v-if='page.hasSubpages', color='#338091') mdi-folder
                        v-icon(v-else) mdi-text-box
                      v-list-item-content
                        v-list-item-title {{ page.title }}
                    v-divider(v-if='idx < currentPages.length - 1', :key='`div-` + page.id')
          v-alert.ma-4(v-if='currentPages.length === 0', text, color='orange', prominent, icon='mdi-alert')
            .body-2 {{$t('common:pageSelector.folderEmptyWarning')}}
      v-card-chin
        v-spacer
        template(v-if='mode === "move"')
          v-btn.btn-rounded.mr-2(
            rounded
            dark
            :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
            @click='close'
            ) {{$t('common:actions.close')}}
          v-btn.px-4.btn-rounded(
            v-if='currentPagePath && selectedFolderId !== null'
            rounded
            :outlined='!canMoveCurrentPage'
            dark
            color='success'
            @click='moveCurrentPageToSelectedFolder'
            :disabled='!canMoveCurrentPage'
          )
            v-icon(left, color='white') mdi-folder-move
            span.text-none Move Current Page Here
        template(v-else)
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
            span.text-none Create Page
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import colors from '@/themes/default/js/color-scheme'
import draggable from 'vuedraggable'

const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i

/* global siteLangs, siteConfig */

export default {
  components: {
    draggable
  },
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
      draggablePages: [],
      draggedPage: null,
      dropTargetFolder: null,
      initialOrder: null,
      lastMouseX: 0,
      lastMouseY: 0,
      currentPageMovedTo: null, // Track new path if current page was moved
      currentPageReordered: false, // Track if current page was reordered
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
    hasCurrentPageInList() {
      return this.currentPagePath && this.draggablePages.some(p => this.isCurrentPage(p))
    },
    currentPageTitle() {
      const currentPage = this.draggablePages.find(p => this.isCurrentPage(p))
      return currentPage ? currentPage.title : ''
    },
    canMoveCurrentPage() {
      if (!this.currentPagePath || this.selectedFolderId === null) return false

      // Find current page from all pages, not just visible ones
      const currentPage = this.pages.find(p => p.path === this.currentPagePath)
      if (!currentPage) return false

      // Get the selected folder
      const targetFolder = this.findFolderById(this.selectedFolderId)
      if (!targetFolder) return false

      // Calculate new path
      const pageName = this.currentPagePath.split('/').pop()
      const newPath = targetFolder.path ? `${targetFolder.path}/${pageName}` : pageName

      // Don't allow move to same location
      if (this.currentPagePath === newPath) return false

      // Don't allow moving into itself or its children
      if (newPath.startsWith(this.currentPagePath + '/')) return false

      return true
    },
    currentPages() {
      const parentId = this.selectedFolderId !== null ? this.selectedFolderId : 0
      const filtered = _.filter(this.pages, ['parent', parentId])
      return _.sortBy(filtered, ['child_position'])
    },
    // In move mode, show pages in the left tree section as potential drop targets
    showPagesInTree() {
      return this.mode === 'move'
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
    },
    currentPages: {
      handler(newVal) {
        // Keep draggablePages in sync with currentPages
        this.draggablePages = [...newVal]
      },
      immediate: true
    }
  },
  beforeDestroy() {
    // Clean up global mouse listener if component is destroyed during drag
    document.removeEventListener('mousemove', this.onGlobalMouseMove)
  },
  methods: {
    close() {
      // If current page was moved, redirect to new location
      if (this.currentPageMovedTo) {
        const { isEditMode, sitePath } = this.parseCurrentUrl()

        const newUrl = isEditMode
          ? `/e/${sitePath}/${this.currentLocale}/${this.currentPageMovedTo}`
          : `/${sitePath}/${this.currentLocale}/${this.currentPageMovedTo}`

        this.$store.commit('showNotification', {
          style: 'info',
          message: 'Redirecting to new page location...',
          icon: 'refresh'
        })

        setTimeout(() => {
          window.location.replace(newUrl)
        }, 300)
        return
      }

      // If current page was reordered, reload to refresh
      if (this.currentPageReordered) {
        this.$store.commit('showNotification', {
          style: 'info',
          message: 'Refreshing page...',
          icon: 'refresh'
        })

        setTimeout(() => {
          window.location.reload()
        }, 300)
        return
      }

      this.isShown = false
    },
    parseCurrentUrl() {
      // Helper to parse current URL and determine edit mode
      const currentUrl = window.location.pathname
      const urlParts = currentUrl.split('/').filter(p => p)
      const isEditMode = urlParts[0] === 'e'
      const sitePathIndex = isEditMode ? 1 : 0
      const sitePath = urlParts[sitePathIndex] || ''

      return { isEditMode, sitePath, urlParts }
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

      // Load pages for initial folder
      await this.fetchPages()
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

      // Load pages for initial folder
      await this.fetchPages()
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
    onDragStart(evt) {
      const pageId = parseInt(evt.item.dataset.pageId)
      const page = this.draggablePages.find(p => p.id === pageId)

      this.draggedPage = page
      this.initialOrder = this.draggablePages.map(p => p.id)
      this.lastMouseX = 0
      this.lastMouseY = 0

      // Track mouse position over folder tree for drag-to-folder functionality
      document.addEventListener('mousemove', this.onGlobalMouseMove)
    },
    onGlobalMouseMove(evt) {
      // Store last known mouse position for use in dragEnd
      this.lastMouseX = evt.clientX
      this.lastMouseY = evt.clientY

      // Delegate to shared folder detection logic
      if (this.draggedPage) {
        this.checkFolderTreeHover(evt.clientX, evt.clientY)
      }
    },
    onDragMove(evt, originalEvent) {
      // This is called by Sortable during drag movement
      // Use it to track mouse position over folder tree
      if (originalEvent && this.draggedPage) {
        // Store mouse position
        this.lastMouseX = originalEvent.clientX
        this.lastMouseY = originalEvent.clientY
        this.checkFolderTreeHover(originalEvent.clientX, originalEvent.clientY)
      }
      return true // Allow the move
    },
    checkFolderTreeHover(clientX, clientY) {
      const treeContainer = this.$refs.folderTreeContainer
      if (!treeContainer) return

      const rect = treeContainer.getBoundingClientRect()
      const isOverTree = clientX >= rect.left && clientX <= rect.right &&
                        clientY >= rect.top && clientY <= rect.bottom

      if (isOverTree) {
        // Find which folder element we're over
        const folderLabels = treeContainer.querySelectorAll('.tree-folder-label')
        let foundFolder = null

        for (const label of folderLabels) {
          const labelRect = label.getBoundingClientRect()
          if (clientY >= labelRect.top && clientY <= labelRect.bottom &&
              clientX >= labelRect.left && clientX <= labelRect.right) {
            const refId = label.getAttribute('data-folder-id')
            if (refId) {
              foundFolder = this.findFolderById(parseInt(refId))
              break
            }
          }
        }

        if (foundFolder) {
          // Check if this is a valid drop target (not self or child of dragged page)
          const isInvalidTarget = this.draggedPage && (
            this.draggedPage.id === foundFolder.id ||
            this.draggedPage.path === foundFolder.path ||
            (foundFolder.path && foundFolder.path.startsWith(this.draggedPage.path + '/'))
          )

          if (!isInvalidTarget) {
            this.dropTargetFolder = foundFolder
          } else {
            this.dropTargetFolder = null
          }
        } else {
          // Over tree but not a specific folder - target root
          this.dropTargetFolder = { id: 0, path: '', name: 'Root' }
        }
      } else {
        this.dropTargetFolder = null
      }
    },
    findFolderById(id) {
      const searchTree = (node) => {
        if (node.id === id) return node
        if (node.children) {
          for (const child of node.children) {
            const found = searchTree(child)
            if (found) return found
          }
        }
        return null
      }

      for (const root of this.tree) {
        const found = searchTree(root)
        if (found) return found
      }
      return null
    },
    async onDragEnd(evt) {
      // Remove global listener first
      document.removeEventListener('mousemove', this.onGlobalMouseMove)

      // Try to detect folder at final position if not already detected
      if (!this.dropTargetFolder && this.lastMouseX && this.lastMouseY) {
        this.checkFolderTreeHover(this.lastMouseX, this.lastMouseY)
      }

      // Capture values before resetting
      const draggedPage = this.draggedPage
      const movedToFolder = this.dropTargetFolder
      const isDraggingCurrentPage = draggedPage && this.isCurrentPage(draggedPage)

      // Check if current page is a child of the dragged page/folder
      const isCurrentPageChildOfDragged = draggedPage && this.currentPagePath &&
        this.currentPagePath.startsWith(draggedPage.path + '/')

      const currentOrder = this.draggablePages.map(p => p.id)
      const orderChanged = this.initialOrder && JSON.stringify(this.initialOrder) !== JSON.stringify(currentOrder)

      // Reset state first to prevent interference with next drag
      this.dropTargetFolder = null
      this.draggedPage = null
      this.initialOrder = null

      // Get current URL context
      const { isEditMode, sitePath } = this.parseCurrentUrl()

      // If dropped on a folder, move the page
      if (movedToFolder && draggedPage) {
        const moveSuccess = await this.movePageToFolder(draggedPage, movedToFolder, true)

        if (moveSuccess) {
          // Navigate to target folder to show the moved page (for all moves)
          await this.navigateToFolderAfterMove(movedToFolder)

          // If we moved the current page OR current page is a child of moved page
          if (isDraggingCurrentPage || isCurrentPageChildOfDragged) {
            const pageName = draggedPage.path.split('/').pop()
            const newParentPath = movedToFolder.path ? `${movedToFolder.path}/${pageName}` : pageName

            let newPath
            if (isDraggingCurrentPage) {
              // Moving the exact page we're on
              newPath = newParentPath
            } else {
              // Moving a parent folder - calculate new path for current child page
              const relativePath = this.currentPagePath.substring(draggedPage.path.length)
              newPath = newParentPath + relativePath
            }

            // Track the move for redirect on close (both edit and view mode)
            this.currentPageMovedTo = newPath

            this.$store.commit('showNotification', {
              style: 'success',
              message: 'Page moved. Close dialog to navigate to new location.',
              icon: 'check'
            })
          } else {
            this.$store.commit('showNotification', {
              style: 'success',
              message: 'Page moved successfully.',
              icon: 'check'
            })
          }
        }
      } else if (orderChanged) {
        // Reorder within same folder (array order changed)
        await this.savePageOrder()

        // If reordering the current page, track that we need to reload on close
        if (isDraggingCurrentPage) {
          // Set a flag to reload on close (reordering doesn't change path)
          this.currentPageReordered = true

          this.$store.commit('showNotification', {
            style: 'success',
            message: 'Page reordered. Close dialog to refresh.',
            icon: 'check'
          })
        }
      }
    },
    onTreeDragOver(evt) {
      if (this.draggedPage) {
        evt.dataTransfer.dropEffect = 'move'
      }
    },
    onFolderDragOver(evt, folder) {
      if (this.draggedPage && folder) {
        // Prevent dropping a page onto itself
        if (this.draggedPage.id === folder.id || this.draggedPage.path === folder.path) {
          evt.dataTransfer.dropEffect = 'none'
          return
        }
        // Prevent dropping into own children (creating circular reference)
        if (folder.path && folder.path.startsWith(this.draggedPage.path + '/')) {
          evt.dataTransfer.dropEffect = 'none'
          return
        }
        this.dropTargetFolder = folder
      }
    },
    onFolderDragLeave(folder) {
      if (this.dropTargetFolder && this.dropTargetFolder.id === folder.id) {
        this.dropTargetFolder = null
      }
    },
    async onTreeDrop(evt, folder) {
      if (!this.draggedPage) return

      const targetFolder = folder || { id: 0, path: '', name: 'Root' }

      // Prevent dropping a page onto itself
      if (this.draggedPage.id === targetFolder.id || this.draggedPage.path === targetFolder.path) {
        this.dropTargetFolder = null
        return
      }

      // Prevent dropping into own children
      if (targetFolder.path && targetFolder.path.startsWith(this.draggedPage.path + '/')) {
        this.dropTargetFolder = null
        return
      }

      this.dropTargetFolder = null

      await this.movePageToFolder(this.draggedPage, targetFolder)
      this.draggedPage = null
    },
    getTreeItemColor(item, open) {
      // Check if this is an invalid drop target (dropping onto self)
      if (this.draggedPage && (this.draggedPage.id === item.id || this.draggedPage.path === item.path)) {
        return 'grey'
      }
      if (this.dropTargetFolder && this.dropTargetFolder.id === item.id) {
        return 'success'
      }
      // Use different color for pages vs folders
      if (item.isPageTarget) {
        return item.id === this.selectedFolderId ? 'primary' : 'blue-grey'
      }
      return item.id === this.selectedFolderId ? 'primary' : ''
    },
    getTreeLabelClass(item) {
      const classes = ['tree-folder-label-inner']
      if (item.id === this.selectedFolderId) {
        classes.push('primary--text', 'font-weight-medium')
      }
      if (this.dropTargetFolder && this.dropTargetFolder.id === item.id) {
        classes.push('drop-target-highlight')
      }
      // Style page targets differently from folders
      if (item.isPageTarget) {
        classes.push('tree-page-target')
      }
      // Mark invalid drop target (dragging page onto itself)
      if (this.draggedPage && (this.draggedPage.id === item.id || this.draggedPage.path === item.path)) {
        classes.push('invalid-drop-target')
      }
      return classes
    },
    async moveCurrentPageToSelectedFolder() {
      if (!this.canMoveCurrentPage) return

      // Find current page from all pages, not just visible ones
      const currentPage = this.pages.find(p => p.path === this.currentPagePath)
      const targetFolder = this.findFolderById(this.selectedFolderId)

      if (!currentPage || !targetFolder) {
        this.$store.commit('showNotification', {
          style: 'error',
          message: 'Invalid selection for move operation',
          icon: 'alert'
        })
        return
      }

      const newPath = targetFolder.path ? `${targetFolder.path}/${this.currentPagePath.split('/').pop()}` : this.currentPagePath.split('/').pop()

      const moveSuccess = await this.movePageToFolder(currentPage, targetFolder, true)

      if (moveSuccess) {
        // Store the new path for redirect on close
        this.currentPageMovedTo = newPath

        // Navigate to the target folder in the dialog so user can verify/reorder
        await this.navigateToFolderAfterMove(targetFolder)

        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Page moved successfully. Close dialog to navigate to new location.',
          icon: 'check'
        })
      }
    },
    async movePageToFolder(page, targetFolder, fromButtonClick = false) {
      if (!page || !page.pageId) {
        console.error('Invalid page for move', page)
        this.$store.commit('showNotification', {
          style: 'error',
          message: 'Invalid page selected for move',
          icon: 'alert'
        })
        return false
      }

      // Calculate new path
      const pageName = page.path.split('/').pop()
      const newPath = targetFolder.path ? `${targetFolder.path}/${pageName}` : pageName

      // Don't move if same location
      if (page.path === newPath) {
        this.$store.commit('showNotification', {
          style: 'warning',
          message: 'Page is already in this location',
          icon: 'info'
        })
        return false
      }

      // Check if page is being moved into itself or its children
      if (newPath.startsWith(page.path + '/')) {
        this.$store.commit('showNotification', {
          style: 'error',
          message: 'Cannot move a page into itself or its children',
          icon: 'alert'
        })
        return false
      }

      // Check if this is the current page being edited
      const isMovingCurrentPage = this.currentPagePath && page.path === this.currentPagePath

      this.searchLoading = true

      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation($id: Int!, $destinationPath: String!, $destinationLocale: String!) {
              pages {
                move(id: $id, destinationPath: $destinationPath, destinationLocale: $destinationLocale) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: page.pageId,
            destinationPath: newPath,
            destinationLocale: this.currentLocale
          },
          // Force refetch of page queries to clear cache
          refetchQueries: ['pages', 'tree'],
          awaitRefetchQueries: false
        })

        if (resp?.data?.pages?.move?.responseResult?.succeeded) {
          // Clear Apollo cache to prevent stale data issues
          try {
            await this.$apollo.provider.defaultClient.clearStore()
          } catch (e) {
            console.warn('Failed to clear Apollo cache:', e)
          }

          // Don't show notification if called from button (button will show its own message)
          if (!fromButtonClick) {
            this.$store.commit('showNotification', {
              style: 'success',
              message: `Page "${page.title}" moved to ${targetFolder.name || 'Root'}`,
              icon: 'check'
            })
          }

          // If moving current page in view mode, we still need to refresh the tree
          // but we stay in the current dialog (don't navigate away)
          // The redirect will happen on close
          if (isMovingCurrentPage && !fromButtonClick) {
            const { isEditMode } = this.parseCurrentUrl()

            // In view mode, refresh tree but stay in dialog
            // In edit mode, do nothing here (redirect handled in onDragEnd)
            if (!isEditMode) {
              await this.navigateToFolderAfterMove(targetFolder)
            }
          } else if (!fromButtonClick) {
            // Not moving current page - navigate to target folder and refresh
            await this.navigateToFolderAfterMove(targetFolder)
          }

          return true
        } else {
          const errMsg = resp?.data?.pages?.move?.responseResult?.message || 'Move failed'
          throw new Error(errMsg)
        }
      } catch (err) {
        console.error('Move failed:', err)
        this.$store.commit('showNotification', {
          style: 'error',
          message: err.message || 'Failed to move page',
          icon: 'alert'
        })
        return false
      } finally {
        this.searchLoading = false
      }
    },
    async savePageOrder() {
      const orders = this.draggablePages.map((page, index) => ({
        pageId: page.id,  // This is the pageTree ID
        position: index
      }))

      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($parentId: Int!, $orders: [PageReorderInput!]!) {
              pages {
                reorderPages(parentId: $parentId, orders: $orders) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            parentId: this.selectedFolderId || 0,
            orders
          }
        })

        if (resp?.data?.pages?.reorderPages?.responseResult?.succeeded) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: 'Pages reordered successfully',
            icon: 'check'
          })

          // Update local page positions without full refresh
          this.draggablePages.forEach((page, index) => {
            page.child_position = index
          })

          // Update the pages array to match new order
          const parentId = this.selectedFolderId !== null ? this.selectedFolderId : 0
          this.pages = this.pages.filter(p => p.parent !== parentId).concat(this.draggablePages)

          // Trigger sidebar tree refresh
          this.$root.$emit('reloadPageTree')

          return true
        } else {
          const errorMsg = resp?.data?.pages?.reorderPages?.responseResult?.message || 'Failed to reorder pages'
          throw new Error(errorMsg)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'error',
          message: err.message || 'Failed to reorder pages',
          icon: 'alert'
        })
        // Reload to revert changes
        await this.fetchPages()
        return false
      }
    },
    async navigateToFolderAfterMove(targetFolder) {
      // Rebuild the tree first
      this.treeDataLoaded = false
      this.all = []
      this.pages = []
      await this.loadTreeData()

      // Navigate to target folder by path (since IDs may change after tree rebuild)
      if (!targetFolder.path) {
        // Root folder
        this.selectedFolderId = 0
        this.activeNodes = [0]
        await this.fetchPages()
      } else {
        // Expand to target folder path - this will set selectedFolderId correctly
        await this.expandToFolder(targetFolder.path)
        // expandToFolder already calls selectFinalFolder which sets selectedFolderId
        // and fetchFolders, but we need to also fetch pages
        await this.fetchPages()
      }

      // Trigger sidebar tree refresh with target folder path so it gets expanded
      this.$root.$emit('reloadPageTree', { expandPath: targetFolder.path })
    },
    isPageDisabled(page) {
      // Disable page if it's the same as the current page being edited
      // This prevents creating a subpage inside the same page
      if (this.currentPagePath && page.path) {
        return page.path === this.currentPagePath
      }
      return false
    },
    isCurrentPage(page) {
      // Check if this is the page currently being edited
      return this.currentPagePath && page.path === this.currentPagePath
    },
    findFolderById(folderId) {
      const search = (items) => {
        for (const item of items) {
          if (item.id === folderId) return item
          if (item.children) {
            const found = search(item.children)
            if (found) return found
          }
        }
        return null
      }
      return search(this.tree)
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

        // Load pages for this folder
        this.fetchPages()
      }
    },
    onFolderNameClick(item) {
      // Handle clicking the folder name directly
      if (item && item.id !== undefined) {
        const isAlreadySelected = this.selectedFolderId === item.id

        // Select the folder
        this.selectedFolderId = item.id
        this.activeNodes = [item.id]

        // Reset clicked page
        this.clickedPagePath = null

        // Load pages for this folder
        this.fetchPages()

        // Only toggle open/close if clicking the already selected folder
        // Otherwise, just open it (single-click to open behavior)
        const isOpen = this.openNodes.includes(item.id)

        if (isAlreadySelected && isOpen) {
          // Clicking selected open folder -> close it
          this.openNodes = this.openNodes.filter(id => id !== item.id)
        } else if (!isOpen) {
          // Folder is closed -> open it and load children
          this.openNodes = [...this.openNodes, item.id]

          const folderData = this.all.find(i => i.id === item.id)
          if (folderData && folderData.isFolder) {
            const treeNode = this.findTreeNode(this.tree[0], item.id)
            if (treeNode && (!treeNode.children || treeNode.children.length === 0)) {
              this.fetchFolders(folderData, treeNode)
            }
          }
        }
        // If folder is already open and we're just clicking to select it, do nothing with open state

        this.scrollActiveNodeIntoView()
      }
    },
    async onFolderIconClick(item) {
      // Handle clicking the folder icon - just toggle open/close
      if (item && item.id !== undefined) {
        const isOpen = this.openNodes.includes(item.id)
        if (isOpen) {
          // Close it
          this.openNodes = this.openNodes.filter(id => id !== item.id)
        } else {
          // Load children first if needed
          const folderData = this.all.find(i => i.id === item.id)
          if (folderData && folderData.isFolder) {
            const treeNode = this.findTreeNode(this.tree[0], item.id)
            if (treeNode && (!treeNode.children || treeNode.children.length === 0)) {
              await this.fetchFolders(folderData, treeNode)
            }
          }

          // Now open it (after children are loaded)
          this.openNodes = [...this.openNodes, item.id]
        }
      }
    },
    getFolderIcon(item, isOpen) {
      // Return the appropriate icon based on item type and state
      if (item.id === 0) {
        // Root folder - always use home icon
        return 'mdi-home'
      }
      // Page target (page acting as potential parent)
      if (item.isPageTarget) {
        return 'mdi-file-document-outline'
      }
      // Page that is also a folder (has subpages)
      if (item.pageId) {
        return isOpen ? 'mdi-folder-open' : 'mdi-folder'
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
        // In move mode, include pages as potential drop targets
        const rootFolders = _.filter(sortedItems, ['isFolder', true]).map(f => ({
          id: f.id,
          name: f.title,
          path: f.path,
          isFolder: true,
          pageId: f.pageId || null,
          children: [],
          icon: f.pageId ? 'mdi-file-document-outline' : 'mdi-folder'
        }))

        // Store pages separately
        const rootPages = _.filter(sortedItems, i => i.pageId > 0)
        this.pages = rootPages

        // In move mode, also add non-folder pages to the tree as drop targets
        let rootTreeItems = [...rootFolders]
        if (this.showPagesInTree) {
          const rootPagesForTree = rootPages
            .filter(p => !p.isFolder) // Exclude folder-pages (already in rootFolders)
            .map(p => ({
              id: p.id,
              name: p.title,
              path: p.path,
              isFolder: false,
              pageId: p.pageId,
              isPageTarget: true, // Mark as page (not folder) for styling
              children: [], // Pages can accept children (become folders)
              icon: 'mdi-file-document-outline'
            }))
          rootTreeItems = [...rootFolders, ...rootPagesForTree]
        }

        // Build tree with root node
        this.tree = [
          {
            id: 0,
            name: this.siteName || 'Root',
            path: '',
            isFolder: true,
            children: rootTreeItems,
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
    async fetchPages() {
      if (this.selectedFolderId === undefined) {
        return
      }

      this.searchLoading = true
      try {
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
            parent: this.selectedFolderId !== null ? this.selectedFolderId : 0,
            mode: 'ALL',
            locale: this.currentLocale,
            siteId: this.siteId
          }
        })

        const items = _.get(resp, 'data.tree', [])

        // Filter by siteId
        const filteredItems = items.filter(i => {
          const itemSiteId = String(i.siteId)
          const currentSiteId = String(this.siteId)
          return itemSiteId === currentSiteId
        })

        // Update pages - only keep pages from this folder
        const parentId = this.selectedFolderId !== null ? this.selectedFolderId : 0
        const otherPages = this.pages.filter(p => p.parent !== parentId)

        // Get pages with child count
        // Include items that have a pageId (actual pages), even if they're also folders (page-as-folder)
        const newPages = filteredItems.filter(i => i.pageId > 0).map(p => {
          // Count children (for page-as-folder indicator)
          const childCount = filteredItems.filter(i => i.parent === p.id).length
          return {
            ...p,
            childCount,
            hasSubpages: p.isFolder  // Mark if this page has subpages
          }
        })

        this.pages = [...otherPages, ...newPages]

        // Update all array
        this.all = _.unionBy(this.all, filteredItems, 'id')

      } catch (error) {
        console.error('Error loading pages:', error)
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
        pageId: f.pageId || null,
        children: [],
        icon: f.pageId ? 'mdi-file-document-outline' : 'mdi-folder'
      }))

      const itemPages = _.filter(sortedItems, i => i.pageId > 0)

      // In move mode, also add non-folder pages as drop targets
      let treeChildren = [...itemFolders]
      if (this.showPagesInTree) {
        const pagesForTree = itemPages
          .filter(p => !p.isFolder) // Exclude folder-pages (already in itemFolders)
          .map(p => ({
            id: p.id,
            name: p.title,
            path: p.path,
            isFolder: false,
            pageId: p.pageId,
            isPageTarget: true, // Mark as page (not folder) for styling
            children: [], // Pages can accept children (become folders)
            icon: 'mdi-file-document-outline'
          }))
        treeChildren = [...itemFolders, ...pagesForTree]
      }

      // Update the tree node's children if treeNode provided
      if (treeNode && treeChildren.length > 0) {
        this.$set(treeNode, 'children', treeChildren)
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

        // Wait for DOM to update and node to be rendered
        await this.$nextTick()
        const maxAttempts = 20 //1s
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(resolve => setTimeout(resolve, 50))
          const treeNode = this.findTreeNode(this.tree[0], folderId)
          if (treeNode && treeNode.children) {
            break
          }
        }
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
      await this.scrollActiveNodeIntoView()

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
    },
    async scrollActiveNodeIntoView() {
      if (!this.$refs.treeScroll || this.selectedFolderId === null) return

      await this.$nextTick()
      const refKey = 'treeNode-' + this.selectedFolderId
      const activeNodeRef = this.$refs[refKey]
      const activeNode = Array.isArray(activeNodeRef) ? activeNodeRef[0] : activeNodeRef

      if (!activeNode) return

      // Find nearest scrollable container (fall back to vuescroll element)
      let container = activeNode.parentNode
      while (container && container !== document && container !== this.$el) {
        try {
          const style = window.getComputedStyle(container)
          if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) break
        } catch (e) {
          // ignore cross-origin or other errors
        }
        container = container.parentNode
      }
      if (!container || container === document) {
        container = this.$refs.treeScroll && this.$refs.treeScroll.$el ? this.$refs.treeScroll.$el : this.$el
      }

      const rect = activeNode.getBoundingClientRect()
      const crect = container.getBoundingClientRect()
      const targetTop = rect.top - crect.top + container.scrollTop - (crect.height / 2 - rect.height / 2)

      // Preserve horizontal scroll position
      const prevLeft = container.scrollLeft || 0

      if (container && typeof container.scrollTo === 'function') {
        container.scrollTo({ top: targetTop, behavior: 'smooth' })
      } else if (container) {
        container.scrollTop = targetTop
      }

      // Restore horizontal scroll after vertical scroll completes
      try {
        setTimeout(() => {
          if (!container) return
          if (typeof container.scrollTo === 'function') {
            container.scrollTo({ left: prevLeft })
          } else {
            container.scrollLeft = prevLeft
          }
        }, 60)
      } catch (e) {
        /* noop */
      }
    }
  }
}
</script>
<style lang="scss">
.page-selector {
  // Folder tree drop zone
  .folder-tree-container {
    position: relative;

    &.drop-target-active::after {
      content: '';
      position: absolute;
      inset: 4px;
      border: 2px dashed #0070ad;
      border-radius: 4px;
      pointer-events: none;
      z-index: 1;
      animation: pulse-border 1s infinite;
    }

    &.drop-target-folder-selected::after {
      border-color: #12abdb;
      border-style: solid;
      animation: none;
    }
  }

  @keyframes pulse-border {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  // Drop hint indicator
  .drop-hint {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 112, 173, 0.9);
    color: white;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    z-index: 10;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    white-space: nowrap;
  }

  // Folder tree labels
  .tree-folder-label {
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
    transition: all 0.2s ease;

    &.drop-target-highlight {
      background-color: rgba(18, 171, 219, 0.15);
      box-shadow: 0 0 0 2px #12abdb;
    }
  }

  // Pages list container
  .pages-container {
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #999;
      border-radius: 4px;

      &:hover {
        background: #64B5F6;
      }
    }
  }

  .page-list {
    min-height: 50px;
  }

  .page-item {
    transition: transform 0.3s ease;
  }

  // Drag and drop styles
  .drag-item {
    transition: background-color 0.2s ease, box-shadow 0.2s ease;
    border-radius: 4px;
    margin: 2px 4px;

    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
  }

  .page-being-dragged {
    opacity: 0.5;
  }

  // Sortable.js states
  .ghost {
    opacity: 0.5;
    background: #e9f4fc !important;
    border: 2px dashed #12abdb !important;
    border-radius: 4px;

    * {
      visibility: hidden;
    }
  }

  .chosen {
    background: #fff8eb;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .dragging {
    opacity: 1;
    background: white !important;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2) !important;
    border-radius: 4px;
    transform: rotate(1deg) scale(1.02);
    z-index: 9999;
  }

  .sortable-fallback {
    opacity: 1 !important;
    background: white !important;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2) !important;
  }

  .drag-handle {
    cursor: grab !important;
    opacity: 0.6;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }

    &:active {
      cursor: grabbing !important;
    }
  }

  // List item spacing
  .v-list-item__icon {
    margin-right: 12px !important;
  }

  .v-list-item__content .v-list-item__title {
    margin-bottom: 2px;
  }

  // Page targets in tree (pages that can accept children)
  .tree-page-target {
    opacity: 0.9;

    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 4px;
      background-color: #64B5F6;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
    }
  }

  // Invalid drop target (dragging page onto itself)
  .invalid-drop-target {
    opacity: 0.4;
    cursor: not-allowed !important;
    text-decoration: line-through;

    &:hover {
      background-color: rgba(244, 67, 54, 0.1) !important;
    }
  }

  // Current page indicator
  .current-page-item .current-page-editing {
    background-color: rgba(0, 112, 173, 0.08) !important;
    border-left: 3px solid #0070ad;

    &:hover {
      background-color: rgba(0, 112, 173, 0.12) !important;
    }
  }

  // Move instruction alert compact padding
  .move-instruction-alert {
    padding: 10px !important;

    .v-alert__content {
      padding: 0 !important;
    }
  }

  .v-btn.v-btn--disabled.theme--dark {
    .theme--light & {
      color: rgba(0, 0, 0, 0.5) !important;

      .v-icon {
        color: rgba(0, 0, 0, 0.5) !important;
      }
    }

    .theme--dark & {
      color: rgba(255, 255, 255, 0.5) !important;

      .v-icon {
        color: rgba(255, 255, 255, 0.5) !important;
      }
    }
  }
}
</style>
