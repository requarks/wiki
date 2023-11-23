<template lang="pug">
q-layout.fileman(view='hHh lpR lFr', container)
  q-header.card-header
    q-toolbar(dark)
      q-icon(name='img:/_assets/icons/fluent-folder.svg', left, size='md')
      span {{t(`fileman.title`)}}
    q-toolbar(dark)
      q-btn.q-mr-sm.acrylic-btn(
        flat
        color='white'
        :label='commonStore.locale'
        :aria-label='commonStore.locale'
        style='height: 40px;'
        )
        locale-selector-menu
      q-input(
        dark
        v-model='state.search'
        standout='bg-white text-dark'
        dense
        ref='searchField'
        style='width: 100%;'
        :label='t(`fileman.searchFolder`)'
        :debounce='500'
        )
        template(v-slot:prepend)
          q-icon(name='las la-search')
        template(v-slot:append)
          q-icon.cursor-pointer(
            name='las la-times'
            @click='state.search=``'
            v-if='state.search.length > 0'
            :color='$q.dark.isActive ? `blue` : `grey-4`'
            )
    q-toolbar(dark)
      q-space
      q-btn(
        flat
        dense
        no-caps
        color='red-3'
        :aria-label='t(`common.actions.close`)'
        icon='las la-times'
        @click='close'
        )
        q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.close`)}}
  q-drawer.fileman-left(:model-value='true', :width='350')
    q-scroll-area(
      :thumb-style='thumbStyle'
      :bar-style='barStyle'
      style='height: 100%;'
      )
      .q-px-md.q-pb-sm
        tree(
          ref='treeComp'
          :nodes='state.treeNodes'
          :roots='state.treeRoots'
          v-model:selected='state.currentFolderId'
          @lazy-load='treeLazyLoad'
          :use-lazy-load='true'
          @context-action='treeContextAction'
          :display-mode='state.displayMode'
        )
  q-drawer.fileman-right(:model-value='$q.screen.gt.md', :width='350', side='right')
    q-scroll-area(
      :thumb-style='thumbStyle'
      :bar-style='barStyle'
      style='height: 100%;'
      )
      .q-pa-md
        template(v-if='currentFileDetails')
          q-img.rounded-borders.q-mb-md(
            :src='currentFileDetails.thumbnail'
            width='100%'
            fit='cover'
            :ratio='16/10'
            no-spinner
          )
          .fileman-details-row(
            v-for='item of currentFileDetails.items'
            )
            label {{item.label}}
            span {{item.value}}
          template(v-if='insertMode')
            q-separator.q-my-md
            q-btn.full-width(
              @click='insertItem()'
              :label='t(`common.actions.insert`)'
              color='primary'
              icon='las la-plus-circle'
              push
              padding='sm'
              )
  q-page-container
    q-page.fileman-center.column
      //- TOOLBAR -----------------------------------------------------
      q-toolbar.fileman-toolbar
        template(v-if='state.isUploading')
          .fileman-progressbar
            div(:style='`width: ` + state.uploadPercentage + `%`') {{state.uploadPercentage}}%
          q-btn.acrylic-btn.q-ml-sm(
            flat
            dense
            no-caps
            color='negative'
            :aria-label='t(`common.actions.cancel`)'
            icon='las la-square'
            @click='uploadCancel'
            v-if='state.uploadPercentage < 100'
            )
        template(v-else)
          q-space
          q-btn.q-mr-sm(
            flat
            dense
            no-caps
            color='grey'
            :aria-label='t(`fileman.viewOptions`)'
            icon='las la-th-list'
            @click=''
            )
            q-tooltip(anchor='bottom middle', self='top middle') {{t(`fileman.viewOptions`)}}
            q-menu(
              transition-show='jump-down'
              transition-hide='jump-up'
              anchor='bottom right'
              self='top right'
              )
              q-card.q-pa-sm
                .text-center
                  small.text-grey {{t(`fileman.viewOptions`)}}
                q-list(dense)
                  q-separator.q-my-sm
                  q-item(clickable)
                    q-item-section(side)
                      q-icon(name='las la-list', color='grey', size='xs')
                    q-item-section.q-pr-sm Browse using...
                    q-item-section(side)
                      q-icon(name='las la-angle-right', color='grey', size='xs')
                    q-menu(
                      anchor='top end'
                      self='top start'
                      )
                      q-list.q-pa-sm(dense)
                        q-item(clickable, @click='state.displayMode = `path`')
                          q-item-section(side)
                            q-icon(
                              :name='state.displayMode === `path` ? `las la-check-circle` : `las la-circle`'
                              :color='state.displayMode === `path` ? `positive` : `grey`'
                              size='xs'
                              )
                          q-item-section.q-pr-sm Browse Using Paths
                        q-item(clickable, @click='state.displayMode = `title`')
                          q-item-section(side)
                            q-icon(
                              :name='state.displayMode === `title` ? `las la-check-circle` : `las la-circle`'
                              :color='state.displayMode === `title` ? `positive` : `grey`'
                              size='xs'
                              )
                          q-item-section.q-pr-sm Browse Using Titles
                  q-item(clickable, @click='state.isCompact = !state.isCompact')
                    q-item-section(side)
                      q-icon(
                        :name='state.isCompact ? `las la-check-square` : `las la-stop`'
                        :color='state.isCompact ? `positive` : `grey`'
                        size='xs'
                      )
                    q-item-section.q-pr-sm Compact List
                  q-item(clickable, @click='state.shouldShowFolders = !state.shouldShowFolders')
                    q-item-section(side)
                      q-icon(
                        :name='state.shouldShowFolders ? `las la-check-square` : `las la-stop`'
                        :color='state.shouldShowFolders ? `positive` : `grey`'
                        size='xs'
                      )
                    q-item-section.q-pr-sm Show Folders
          q-btn.q-mr-sm(
            flat
            dense
            no-caps
            color='grey'
            :aria-label='t(`common.actions.refresh`)'
            icon='las la-redo-alt'
            @click='reloadFolder(state.currentFolderId)'
            )
            q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.refresh`)}}
          q-separator.q-mr-sm(inset, vertical)
          q-btn.q-mr-sm(
            flat
            dense
            no-caps
            color='blue'
            :label='t(`common.actions.new`)'
            :aria-label='t(`common.actions.new`)'
            icon='las la-plus-circle'
            @click=''
            )
            new-menu(
              :hide-asset-btn='true'
              :show-new-folder='true'
              @new-folder='() => newFolder(state.currentFolderId)'
              @new-page='() => close()'
              :base-path='folderPath'
              )
          q-btn(
            flat
            dense
            no-caps
            color='positive'
            :label='t(`common.actions.upload`)'
            :aria-label='t(`common.actions.upload`)'
            icon='las la-cloud-upload-alt'
            @click='uploadFile'
            )

      .row(style='flex: 1 1 100%;')
        .col
          q-scroll-area(
            :thumb-style='thumbStyle'
            :bar-style='barStyle'
            style='height: 100%;'
            )
            .fileman-loadinglist(v-if='state.fileListLoading')
              q-spinner.q-mr-sm(color='primary', size='64px', :thickness='1')
              span.text-primary Fetching folder contents...
            .fileman-emptylist(v-else-if='files.length < 1')
              img(src='/_assets/icons/carbon-copy-empty-box.svg')
              span This folder is empty.
            q-list.fileman-filelist(
              v-else
              :class='state.isCompact && `is-compact`'
              )
              q-item(
                v-for='item of files'
                :key='item.id'
                clickable
                active-class='active'
                :active='item.id === state.currentFileId'
                @click.native='selectItem(item)'
                @dblclick.native='doubleClickItem(item)'
                )
                q-item-section.fileman-filelist-icon(avatar)
                  q-icon(:name='item.icon', :size='state.isCompact ? `md` : `xl`')
                q-item-section.fileman-filelist-label
                  q-item-label {{usePathTitle ? item.fileName : item.title}}
                  q-item-label(caption, v-if='!state.isCompact') {{item.caption}}
                q-item-section.fileman-filelist-side(side, v-if='item.side')
                  .text-caption {{item.side}}
                //- RIGHT-CLICK MENU
                q-menu.translucent-menu(
                  touch-position
                  context-menu
                  auto-close
                  transition-show='jump-down'
                  transition-hide='jump-up'
                  )
                  q-card.q-pa-sm
                    q-list(dense, style='min-width: 150px;')
                      q-item(clickable, v-if='insertMode && item.type !== `folder`', @click='insertItem(item)')
                        q-item-section(side)
                          q-icon(name='las la-plus-circle', color='primary')
                        q-item-section {{ t(`common.actions.insert`) }}
                      q-item(clickable, v-if='item.type === `page`', @click='editItem(item)')
                        q-item-section(side)
                          q-icon(name='las la-edit', color='orange')
                        q-item-section {{ t(`common.actions.edit`) }}
                      q-item(clickable, v-if='item.type === `page`', @click='rerenderPage(item)')
                        q-item-section(side)
                          q-icon(name='las la-magic', color='orange')
                        q-item-section {{ t(`common.actions.rerender`) }}
                      q-item(clickable, v-if='item.type !== `folder`', @click='openItem(item)')
                        q-item-section(side)
                          q-icon(name='las la-eye', color='primary')
                        q-item-section {{ t(`common.actions.view`) }}
                      template(v-if='item.type === `asset` && item.imageEdit')
                        q-item(clickable)
                          q-item-section(side)
                            q-icon(name='las la-edit', color='orange')
                          q-item-section Edit Image...
                        q-item(clickable)
                          q-item-section(side)
                            q-icon(name='las la-crop', color='orange')
                          q-item-section Resize Image...
                      q-item(clickable, v-if='item.type !== `folder`', @click='copyItemURL(item)')
                        q-item-section(side)
                          q-icon(name='las la-clipboard', color='primary')
                        q-item-section {{ t(`common.actions.copyURL`) }}
                      q-item(clickable, v-if='item.type !== `folder`', @click='downloadItem(item)')
                        q-item-section(side)
                          q-icon(name='las la-download', color='primary')
                        q-item-section {{ t(`common.actions.download`) }}
                      q-item(clickable)
                        q-item-section(side)
                          q-icon(name='las la-copy', color='teal')
                        q-item-section Duplicate...
                      q-item(clickable, @click='renameItem(item)')
                        q-item-section(side)
                          q-icon(name='las la-redo', color='teal')
                        q-item-section Rename...
                      q-item(clickable)
                        q-item-section(side)
                          q-icon(name='las la-arrow-right', color='teal')
                        q-item-section Move to...
                      q-item(clickable, @click='delItem(item)')
                        q-item-section(side)
                          q-icon(name='las la-trash-alt', color='negative')
                        q-item-section.text-negative {{ t(`common.actions.delete`) }}
  q-footer
    q-bar.fileman-path
      small.text-caption.text-grey-7 {{folderPath}}

  input(
    type='file'
    ref='fileIpt'
    multiple
    @change='uploadNewFiles'
    style='display: none'
    )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, defineAsyncComponent, nextTick, onMounted, reactive, ref, toRaw, watch } from 'vue'
import { filesize } from 'filesize'
import { useQuasar } from 'quasar'
import { DateTime } from 'luxon'
import { cloneDeep, dropRight, find, findKey, initial, last, nth } from 'lodash-es'
import { useRoute, useRouter } from 'vue-router'
import gql from 'graphql-tag'
import Fuse from 'fuse.js/basic'

import NewMenu from './PageNewMenu.vue'
import Tree from './TreeNav.vue'

import fileTypes from '../helpers/fileTypes'

import { useCommonStore } from 'src/stores/common'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

import FolderCreateDialog from 'src/components/FolderCreateDialog.vue'
import FolderDeleteDialog from 'src/components/FolderDeleteDialog.vue'
import FolderRenameDialog from 'src/components/FolderRenameDialog.vue'
import LocaleSelectorMenu from 'src/components/LocaleSelectorMenu.vue'

// QUASAR

const $q = useQuasar()

// STORES

const commonStore = useCommonStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  isFetching: false,
  search: '',
  currentFolderId: null,
  currentFileId: null,
  treeNodes: {},
  treeRoots: [],
  displayMode: 'title',
  isCompact: false,
  shouldShowFolders: true,
  isUploading: false,
  shouldCancelUpload: false,
  uploadPercentage: 0,
  fileList: [],
  fileListLoading: false
})

const thumbStyle = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: '#000',
  width: '5px',
  opacity: 0.15
}
const barStyle = {
  backgroundColor: '#FAFAFA',
  width: '9px',
  opacity: 1
}

// REFS

const fileIpt = ref(null)
const treeComp = ref(null)

// COMPUTED

const insertMode = computed(() => siteStore.overlayOpts?.insertMode ?? false)

const folderPath = computed(() => {
  if (!state.currentFolderId) {
    return '/'
  } else {
    const folderNode = state.treeNodes[state.currentFolderId] ?? {}
    return folderNode.folderPath ? `/${folderNode.folderPath}/${folderNode.fileName}/` : `/${folderNode.fileName}/`
  }
})

const usePathTitle = computed(() => state.displayMode === 'path')

const filteredFiles = computed(() => {
  if (state.search) {
    const fuse = new Fuse(state.fileList, {
      keys: [
        'title',
        'fileName'
      ]
    })
    return fuse.search(state.search).map(n => n.item)
  } else {
    return state.fileList
  }
})

const files = computed(() => {
  return filteredFiles.value.filter(f => {
    // -> Show Folders Filter
    if (f.type === 'folder' && !state.shouldShowFolders) {
      return false
    }
    return true
  }).map(f => {
    switch (f.type) {
      case 'folder': {
        f.icon = fileTypes.folder.icon
        f.caption = t('fileman.folderChildrenCount', { count: f.children }, f.children)
        break
      }
      case 'page': {
        f.icon = fileTypes.page.icon
        f.caption = t(`fileman.${f.pageType}PageType`)
        break
      }
      case 'asset': {
        f.icon = fileTypes[f.fileExt]?.icon ?? ''
        f.side = filesize(f.fileSize, { round: 0 })
        f.imageEdit = fileTypes[f.fileExt]?.imageEdit
        if (fileTypes[f.fileExt]) {
          f.caption = t(`fileman.${f.fileExt}FileType`)
        } else {
          f.caption = t('fileman.unknownFileType', { type: f.fileExt.toUpperCase() })
        }
        break
      }
    }
    return f
  })
})

const currentFileDetails = computed(() => {
  if (state.currentFileId) {
    const item = find(state.fileList, ['id', state.currentFileId])
    if (item.type === 'folder') {
      return null
    }

    const items = [
      {
        label: t('fileman.detailsTitle'),
        value: item.title
      }
    ]
    let thumbnail = ''
    switch (item.type) {
      case 'page': {
        thumbnail = '/_assets/illustrations/fileman-page.svg'
        items.push({
          label: t('fileman.detailsPageType'),
          value: t(`fileman.${item.pageType}PageType`)
        })
        items.push({
          label: t('fileman.detailsPageEditor'),
          value: item.pageType
        })
        items.push({
          label: t('fileman.detailsPageUpdated'),
          value: DateTime.fromISO(item.updatedAt).toFormat('yyyy-MM-dd \'at\' h:mm ZZZZ')
        })
        items.push({
          label: t('fileman.detailsPageCreated'),
          value: DateTime.fromISO(item.updatedAt).toFormat('yyyy-MM-dd \'at\' h:mm ZZZZ')
        })
        break
      }
      case 'asset': {
        thumbnail = `/_thumb/${item.id}.webp`
        items.push({
          label: t('fileman.detailsAssetType'),
          value: fileTypes[item.fileExt] ? t(`fileman.${item.fileExt}FileType`) : t('fileman.unknownFileType', { type: item.fileExt.toUpperCase() })
        })
        items.push({
          label: t('fileman.detailsAssetSize'),
          value: filesize(item.fileSize)
        })
        break
      }
    }
    return {
      thumbnail,
      items
    }
  } else {
    return null
  }
})

// WATCHERS

watch(() => state.currentFolderId, async (newValue) => {
  await loadTree({ parentId: newValue })
})

// METHODS

function close () {
  siteStore.overlay = null
}

function insertItem (item) {
  if (!item) {
    item = find(state.fileList, ['id', state.currentFileId])
  }
  EVENT_BUS.emit('insertAsset', toRaw(item))
  close()
}

async function treeLazyLoad (nodeId, isCurrent, { done, fail }) {
  await loadTree({ parentId: nodeId, types: isCurrent ? null : ['folder'] })
  done()
}

async function loadTree ({ parentId = null, parentPath = null, types, initLoad = false }) {
  if (state.isFetching) { return }
  state.isFetching = true
  if (!parentId) {
    parentId = null
  }
  if (parentId === state.currentFolderId) {
    state.fileListLoading = true
    state.currentFileId = null
    state.fileList = []
  }
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query loadTree (
          $siteId: UUID!
          $parentId: UUID
          $parentPath: String
          $types: [TreeItemType]
          $includeAncestors: Boolean
          $includeRootFolders: Boolean
        ) {
          tree (
            siteId: $siteId
            parentId: $parentId
            parentPath: $parentPath
            types: $types
            includeAncestors: $includeAncestors
            includeRootFolders: $includeRootFolders
          ) {
            __typename
            id
            folderPath
            fileName
            title
            ... on TreeItemFolder {
              childrenCount
              isAncestor
            }
            ... on TreeItemPage {
              createdAt
              updatedAt
              editor
            }
            ... on TreeItemAsset {
              createdAt
              updatedAt
              fileSize
              fileExt
              mimeType
            }
          }
        }
      `,
      variables: {
        siteId: siteStore.id,
        parentId,
        parentPath,
        types,
        includeAncestors: initLoad,
        includeRootFolders: initLoad
      },
      fetchPolicy: 'network-only'
    })
    const items = cloneDeep(resp?.data?.tree)
    if (items?.length > 0) {
      const newTreeRoots = []
      for (const item of items) {
        switch (item.__typename) {
          case 'TreeItemFolder': {
            // -> Tree Nodes
            state.treeNodes[item.id] = {
              folderPath: item.folderPath,
              fileName: item.fileName,
              title: item.title,
              children: state.treeNodes[item.id]?.children ?? []
            }

            // -> Set Ancestors / Tree Roots
            if (item.folderPath) {
              let folderParentId = parentId
              if (!folderParentId) {
                const parentFolderParts = item.folderPath.split('/')
                const parentFolder = find(items, { folderPath: parentFolderParts.length > 1 ? initial(parentFolderParts).join('/') : '', fileName: last(parentFolderParts) })
                folderParentId = parentFolder.id
              }
              if (item.id !== folderParentId && !state.treeNodes[folderParentId]?.children?.includes(item.id)) {
                state.treeNodes[folderParentId]?.children?.push(item.id)
              }
            } else {
              newTreeRoots.push(item.id)
            }

            // -> File List
            if (parentId === state.currentFolderId && !item.isAncestor) {
              state.fileList.push({
                id: item.id,
                type: 'folder',
                title: item.title,
                fileName: item.fileName,
                children: item.childrenCount || 0
              })
            }
            break
          }
          case 'TreeItemAsset': {
            if (parentId === state.currentFolderId) {
              state.fileList.push({
                id: item.id,
                type: 'asset',
                title: item.title,
                fileExt: item.fileExt,
                fileSize: item.fileSize,
                mimeType: item.mimeType,
                folderPath: item.folderPath,
                fileName: item.fileName
              })
            }
            break
          }
          case 'TreeItemPage': {
            if (parentId === state.currentFolderId) {
              state.fileList.push({
                id: item.id,
                type: 'page',
                title: item.title,
                pageType: 'markdown',
                updatedAt: '2022-11-24T18:27:00Z',
                folderPath: item.folderPath,
                fileName: item.fileName
              })
            }
            break
          }
        }
      }
      if (newTreeRoots.length > 0) {
        state.treeRoots = newTreeRoots
      }
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to load folder tree.',
      caption: err.message
    })
  }
  if (parentId === state.currentFolderId) {
    nextTick(() => {
      state.fileListLoading = false
    })
  }
  if (parentId) {
    treeComp.value.setLoaded(parentId)
  }
  state.isFetching = false
}

function treeContextAction (nodeId, action) {
  switch (action) {
    case 'newFolder': {
      newFolder(nodeId)
      break
    }
    case 'rename': {
      renameFolder(nodeId)
      break
    }
    case 'del': {
      delFolder(nodeId)
      break
    }
  }
}

// --------------------------------------
// FOLDER METHODS
// --------------------------------------

function newFolder (parentId) {
  $q.dialog({
    component: FolderCreateDialog,
    componentProps: {
      parentId
    }
  }).onOk(() => {
    loadTree({ parentId })
  })
}

function renameFolder (folderId) {
  $q.dialog({
    component: FolderRenameDialog,
    componentProps: {
      folderId
    }
  }).onOk(async () => {
    treeComp.value.resetLoaded()
    // // -> Delete current folder and children from cache
    // const fPath = [state.treeNodes[folderId].folderPath, state.treeNodes[folderId].fileName].filter(p => !!p).join('/')
    // delete state.treeNodes[folderId]
    // for (const [nodeId, node] of Object.entries(state.treeNodes)) {
    //   if (node.folderPath.startsWith(fPath)) {
    //     delete state.treeNodes[nodeId]
    //   }
    // }
    // -> Reload tree
    await loadTree({ parentId: folderId, types: ['folder'], initLoad: true }) // Update tree
    // -> Reload current view (in case current folder is included)
    await loadTree({ parentId: state.currentFolderId })
  })
}

function delFolder (folderId, mustReload = false) {
  $q.dialog({
    component: FolderDeleteDialog,
    componentProps: {
      folderId,
      folderName: state.treeNodes[folderId].title
    }
  }).onOk(() => {
    for (const nodeId in state.treeNodes) {
      if (state.treeNodes[nodeId].children.includes(folderId)) {
        state.treeNodes[nodeId].children = state.treeNodes[nodeId].children.filter(c => c !== folderId)
      }
    }
    delete state.treeNodes[folderId]
    if (state.treeRoots.includes(folderId)) {
      state.treeRoots = state.treeRoots.filter(n => n !== folderId)
    }
    if (mustReload) {
      loadTree({ parentId: state.currentFolderId })
    }
  })
}

function reloadFolder (folderId) {
  loadTree({ parentId: folderId })
  treeComp.value.resetLoaded()
}

// PAGE METHODS
// --------------------------------------

function rerenderPage (item) {
  $q.dialog({
    component: defineAsyncComponent(() => import('src/components/RerenderPageDialog.vue')),
    componentProps: {
      id: item.id
    }
  })
}

function delPage (pageId, pageName) {
  $q.dialog({
    component: defineAsyncComponent(() => import('src/components/PageDeleteDialog.vue')),
    componentProps: {
      pageId,
      pageName
    }
  }).onOk(() => {
    loadTree(state.currentFolderId, null)
  })
}

// --------------------------------------
// UPLOAD METHODS
// --------------------------------------

function uploadFile () {
  fileIpt.value.click()
}

async function uploadNewFiles () {
  if (!fileIpt.value.files?.length) {
    return
  }

  state.isUploading = true
  state.uploadPercentage = 0

  state.loading++

  nextTick(() => {
    setTimeout(async () => {
      try {
        const totalFiles = fileIpt.value.files.length
        let idx = 0
        for (const fileToUpload of fileIpt.value.files) {
          idx++
          state.uploadPercentage = totalFiles > 1 ? Math.round(idx / totalFiles * 100) : 90
          const resp = await APOLLO_CLIENT.mutate({
            context: {
              uploadMode: true
            },
            mutation: gql`
              mutation uploadAssets (
                $folderId: UUID
                $locale: String
                $siteId: UUID
                $files: [Upload!]!
              ) {
                uploadAssets (
                  folderId: $folderId
                  locale: $locale
                  siteId: $siteId
                  files: $files
                ) {
                  operation {
                    succeeded
                    message
                  }
                }
              }
            `,
            variables: {
              folderId: state.currentFolderId,
              siteId: siteStore.id,
              locale: 'en', // TODO: use current locale
              files: [fileToUpload]
            }
          })
          if (!resp?.data?.uploadAssets?.operation?.succeeded) {
            throw new Error(resp?.data?.uploadAssets?.operation?.message || 'An unexpected error occured.')
          }
        }
        state.uploadPercentage = 100
        loadTree({ parentId: state.currentFolderId })
        $q.notify({
          type: 'positive',
          message: t('fileman.uploadSuccess')
        })
      } catch (err) {
        $q.notify({
          type: 'negative',
          message: 'Failed to upload file.',
          caption: err.message
        })
      }
      state.loading--
      fileIpt.value.value = null
      setTimeout(() => {
        state.isUploading = false
        state.uploadPercentage = 0
      }, 1500)
    }, 400)
  })
}

function uploadCancel () {
  state.isUploading = false
  state.uploadPercentage = 0
}

// --------------------------------------
// ITEM LIST ACTIONS
// --------------------------------------

function selectItem (item) {
  if (item.type === 'folder') {
    state.currentFolderId = item.id
    treeComp.value.setOpened(item.id)
  } else {
    state.currentFileId = item.id
  }
}

function doubleClickItem (item) {
  if (insertMode.value) {
    insertItem(item)
  } else {
    openItem(item)
  }
}

function openItem (item) {
  switch (item.type) {
    case 'folder': {
      return
    }
    case 'page': {
      const pagePath = item.folderPath ? `${item.folderPath}/${item.fileName}` : item.fileName
      router.push(`/${pagePath}`)
      close()
      break
    }
    case 'asset': {
      // TODO: Open asset
      close()
      break
    }
  }
}

async function copyItemURL (item) {
  try {
    switch (item.type) {
      case 'page': {
        const pagePath = item.folderPath ? `${item.folderPath}/${item.fileName}` : item.fileName
        await navigator.clipboard.writeText(`${window.location.origin}/${pagePath}`)
        break
      }
      case 'asset': {
        const assetPath = item.folderPath ? `${item.folderPath}/${item.fileName}` : item.fileName
        await navigator.clipboard.writeText(`${window.location.origin}/${assetPath}`)
        break
      }
      default: {
        throw new Error('Invalid Item Type')
      }
    }
    $q.notify({
      type: 'positive',
      message: t('fileman.copyURLSuccess')
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to copy URL to clipboard.',
      caption: err.message
    })
  }
}

async function editItem (item) {
  router.push(item.folderPath ? `/_edit/${item.folderPath}/${item.fileName}` : `/_edit/${item.fileName}`)
  close()
}

function downloadItem (item) {

}

function renameItem (item) {
  console.info(item)
  switch (item.type) {
    case 'folder': {
      renameFolder(item.id)
      break
    }
    case 'page': {
      // TODO: Rename page
      break
    }
    case 'asset': {
      // TODO: Rename asset
      break
    }
  }
}

function delItem (item) {
  switch (item.type) {
    case 'folder': {
      delFolder(item.id, true)
      break
    }
    case 'page': {
      delPage(item.id, item.title)
      break
    }
  }
}

// MOUNTED

onMounted(async () => {
  const pathParts = pageStore.path.split('/')
  const parentPath = initial(pathParts).join('/')

  await loadTree({
    parentPath,
    initLoad: true
  })

  // -> Open tree up to current folder
  const folderFolderPath = dropRight(pathParts, 2).join('/')
  const folderFileName = nth(pathParts, -2)

  for (const [id, node] of Object.entries(state.treeNodes)) {
    if (parentPath.startsWith(node.folderPath ? `${node.folderPath}/${node.fileName}` : node.fileName)) {
      treeComp.value.setOpened(id)
    }
  }

  // -> Switch to current folder (from page path)
  const currentNodeId = findKey(state.treeNodes, n => n.folderPath === folderFolderPath && n.fileName === folderFileName)
  if (currentNodeId) {
    state.currentFolderId = currentNodeId
  }
})

</script>

<style lang="scss">
.fileman {
  &-left {
    @at-root .body--light & {
      background-color: $blue-grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
    }
  }

  &-center {

    @at-root .body--light & {
      background-color: #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-6;
    }
  }

  &-right {
    @at-root .body--light & {
      background-color: $grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
    }
  }

  &-toolbar {
    @at-root .body--light & {
      background-color: $grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
    }
  }

  &-path {
    @at-root .body--light & {
      background-color: $blue-grey-1 !important;
    }
    @at-root .body--dark & {
      background-color: $dark-4 !important;
    }
  }

  &-main {
    height: 100%;
  }

  &-loadinglist {
    padding: 16px;
    font-style: italic;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    > span {
      margin-top: 16px;
    }
  }

  &-emptylist {
    padding: 16px;
    font-style: italic;
    font-size: 1.5em;
    font-weight: 300;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    > img {
      opacity: .25;
      width: 200px;
    }

    @at-root .body--light & {
      color: $grey-6;
    }
    @at-root .body--dark & {
      color: $grey-7;

      > img {
        filter: invert(1);
      }
    }
  }

  &-filelist {
    padding: 8px 12px;

    > .q-item {
      padding: 4px 6px;
      border-radius: 8px;

      &.active {
        background-color: var(--q-primary);
        color: #FFF;

        .fileman-filelist-label .q-item__label--caption {
          color: rgba(255,255,255,.7);
        }

        .fileman-filelist-side .text-caption {
          color: rgba(255,255,255,.7);
        }
      }
    }

    &.is-compact {
      > .q-item {
        padding: 0 6px;
        min-height: 36px;
      }

      .fileman-filelist-icon {
        padding-right: 6px;
        min-width: 0;
      }
    }
  }
  &-details-row {
    display: flex;
    flex-direction: column;
    padding: 5px 0;

    label {
      font-size: .7rem;
      font-weight: 500;

      @at-root .body--light & {
        color: $grey-6;
      }
      @at-root .body--dark & {
        color: $blue-grey-4;
      }
    }
    span {
      font-size: .85rem;

      @at-root .body--light & {
        color: $grey-8;
      }
      @at-root .body--dark & {
        color: $blue-grey-2;
      }
    }

    & + .fileman-details-row {
      margin-top: 5px;
    }
  }

  &-progressbar {
    width: 100%;
    flex: 1;
    height: 12px;
    border-radius: 3px;

    @at-root .body--light & {
      background-color: $blue-grey-2;
    }
    @at-root .body--dark & {
      background-color: $dark-4 !important;
    }

    > div {
      height: 12px;
      background-color: $positive;
      border-radius: 3px 0 0 3px;
      background-image: linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.3) 25%,
        transparent 25%,
        transparent 50%,
        rgba(255, 255, 255, 0.3) 50%,
        rgba(255, 255, 255, 0.3) 75%,
        transparent 75%,
        transparent
      );
      background-size: 50px 50px;
      background-position: 0 0;
      animation: fileman-progress 2s linear infinite;
      box-shadow: 0 0 5px 0 $positive;
      font-size: 9px;
      letter-spacing: 2px;
      font-weight: 700;
      color: #FFF;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      transition: all 1s ease;
    }
  }
}

@keyframes fileman-progress {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: -50px -50px;
  }
}
</style>
