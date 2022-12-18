<template lang="pug">
q-layout.fileman(view='hHh lpR lFr', container)
  q-header.card-header
    q-toolbar(dark)
      q-icon(name='img:/_assets/icons/fluent-folder.svg', left, size='md')
      span {{t(`fileman.title`)}}
    q-toolbar(dark)
      q-input(
        dark
        v-model='state.search'
        standout='bg-white text-dark'
        dense
        ref='searchField'
        style='width: 100%;'
        label='Search folder...'
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
    .q-px-md.q-pb-sm
      tree(
        :nodes='state.treeNodes'
        :roots='state.treeRoots'
        v-model:selected='state.currentFolderId'
        @lazy-load='treeLazyLoad'
        :use-lazy-load='true'
        @context-action='treeContextAction'
        :display-mode='state.displayMode'
      )
  q-drawer.fileman-right(:model-value='true', :width='350', side='right')
    .q-pa-md
      template(v-if='currentFileDetails')
        q-img.rounded-borders.q-mb-md(
          src='https://picsum.photos/id/134/340/340'
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
  q-page-container
    q-page.fileman-center
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
                  q-item(clickable)
                    q-item-section(side)
                      q-icon(name='las la-stop', color='grey', size='xs')
                    q-item-section.q-pr-sm Compact List
                  q-item(clickable)
                    q-item-section(side)
                      q-icon(name='las la-check-square', color='positive', size='xs')
                    q-item-section.q-pr-sm Show Folders
          q-btn.q-mr-sm(
            flat
            dense
            no-caps
            color='grey'
            :aria-label='t(`common.actions.refresh`)'
            icon='las la-redo-alt'
            @click=''
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
      q-list.fileman-filelist
        q-item(
          v-for='item of files'
          :key='item.id'
          clickable
          active-class='active'
          :active='item.id === state.currentFileId'
          @click.native='state.currentFileId = item.id'
          @dblclick.native='openItem(item)'
          )
          q-item-section.fileman-filelist-icon(avatar)
            q-icon(:name='item.icon', size='xl')
          q-item-section.fileman-filelist-label
            q-item-label {{item.title}}
            q-item-label(caption) {{item.caption}}
          q-item-section.fileman-filelist-side(side, v-if='item.side')
            .text-caption {{item.side}}
          //- RIGHT-CLICK MENU
          q-menu(
            touch-position
            context-menu
            auto-close
            transition-show='jump-down'
            transition-hide='jump-up'
            )
            q-card.q-pa-sm
              q-list(dense, style='min-width: 150px;')
                q-item(clickable, v-if='item.type === `page`')
                  q-item-section(side)
                    q-icon(name='las la-edit', color='orange')
                  q-item-section Edit
                q-item(clickable, v-if='item.type !== `folder`')
                  q-item-section(side)
                    q-icon(name='las la-eye', color='primary')
                  q-item-section View
                q-item(clickable, v-if='item.type !== `folder`')
                  q-item-section(side)
                    q-icon(name='las la-clipboard', color='primary')
                  q-item-section Copy URL
                q-item(clickable)
                  q-item-section(side)
                    q-icon(name='las la-copy', color='teal')
                  q-item-section Duplicate...
                q-item(clickable)
                  q-item-section(side)
                    q-icon(name='las la-redo', color='teal')
                  q-item-section Rename...
                q-item(clickable)
                  q-item-section(side)
                    q-icon(name='las la-arrow-right', color='teal')
                  q-item-section Move to...
                q-item(clickable)
                  q-item-section(side)
                    q-icon(name='las la-trash-alt', color='negative')
                  q-item-section.text-negative Delete
  q-footer
    q-bar.fileman-path
      small.text-caption.text-grey-7 / foo / bar

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
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { filesize } from 'filesize'
import { useQuasar } from 'quasar'
import { DateTime } from 'luxon'
import { cloneDeep, find } from 'lodash-es'
import gql from 'graphql-tag'

import NewMenu from './PageNewMenu.vue'
import Tree from './TreeNav.vue'

import fileTypes from '../helpers/fileTypes'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

import FolderCreateDialog from 'src/components/FolderCreateDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  search: '',
  currentFolderId: '',
  currentFileId: '',
  treeNodes: {},
  treeRoots: [],
  displayMode: 'title',
  isUploading: false,
  shouldCancelUpload: false,
  uploadPercentage: 0,
  fileList: [
    {
      id: '1',
      type: 'folder',
      title: 'Beep Boop',
      children: 19
    },
    {
      id: '2',
      type: 'folder',
      title: 'Second Folder',
      children: 0
    },
    {
      id: '3',
      type: 'page',
      title: 'Some Page',
      pageType: 'markdown',
      updatedAt: '2022-11-24T18:27:00Z'
    },
    {
      id: '4',
      type: 'file',
      title: 'Important Document',
      fileType: 'pdf',
      fileSize: 19000
    }
  ]
})

// REFS

const fileIpt = ref(null)

// COMPUTED

const files = computed(() => {
  return state.fileList.map(f => {
    switch (f.type) {
      case 'folder': {
        f.icon = fileTypes.folder.icon
        f.caption = t('fileman.folderChildrenCount', f.children, { count: f.children })
        break
      }
      case 'page': {
        f.icon = fileTypes.page.icon
        f.caption = t(`fileman.${f.pageType}PageType`)
        break
      }
      case 'file': {
        f.icon = fileTypes[f.fileType]?.icon ?? ''
        f.side = filesize(f.fileSize)
        if (fileTypes[f.fileType]) {
          f.caption = t(`fileman.${f.fileType}FileType`)
        } else {
          f.caption = t('fileman.unknownFileType', { type: f.fileType.toUpperCase() })
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
    switch (item.type) {
      case 'page': {
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
      case 'file': {
        items.push({
          label: t('fileman.detailsAssetType'),
          value: fileTypes[item.fileType] ? t(`fileman.${item.fileType}FileType`) : t('fileman.unknownFileType', { type: item.fileType.toUpperCase() })
        })
        items.push({
          label: t('fileman.detailsAssetSize'),
          value: filesize(item.fileSize)
        })
        break
      }
    }
    return {
      thumbnail: '',
      items
    }
  } else {
    return null
  }
})

// WATCHERS

watch(() => state.currentFolderId, (newValue) => {
  state.currentFileId = null
})

// METHODS

function close () {
  siteStore.overlay = null
}

async function treeLazyLoad (nodeId, { done, fail }) {
  await loadTree(nodeId, ['folder'])
  done()
}

async function loadTree (parentId, types) {
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query loadTree (
          $siteId: UUID!
          $parentId: UUID
          $types: [TreeItemType]
        ) {
          tree (
            siteId: $siteId
            parentId: $parentId
            types: $types
          ) {
            __typename
            ... on TreeItemFolder {
              id
              folderPath
              fileName
              title
              childrenCount
            }
            ... on TreeItemPage {
              id
              folderPath
              fileName
              title
              createdAt
              updatedAt
              pageEditor
            }
            ... on TreeItemAsset {
              id
              folderPath
              fileName
              title
              createdAt
              updatedAt
              fileSize
            }
          }
        }
      `,
      variables: {
        siteId: siteStore.id,
        parentId,
        types
      },
      fetchPolicy: 'network-only'
    })
    const items = cloneDeep(resp?.data?.tree)
    if (items?.length > 0) {
      const newTreeRoots = []
      for (const item of items) {
        switch (item.__typename) {
          case 'TreeItemFolder': {
            state.treeNodes[item.id] = {
              text: item.title,
              fileName: item.fileName,
              children: []
            }
            if (!item.folderPath) {
              newTreeRoots.push(item.id)
            } else {
              state.treeNodes[parentId].children.push(item.id)
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
}

function treeContextAction (nodeId, action) {
  console.info(nodeId, action)
  switch (action) {
    case 'newFolder': {
      newFolder(nodeId)
      break
    }
  }
}

function newFolder (parentId) {
  $q.dialog({
    component: FolderCreateDialog,
    componentProps: {
      parentId
    }
  }).onOk(() => {
    loadTree(parentId)
  })
}

// -> Upload Methods

function uploadFile () {
  fileIpt.value.click()
}

async function uploadNewFiles () {
  if (!fileIpt.value.files?.length) {
    return
  }

  console.info(fileIpt.value.files)

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
            mutation: gql`
              mutation uploadAssets (
                $siteId: UUID!
                $files: [Upload!]!
              ) {
                uploadAssets (
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
              siteId: siteStore.id,
              files: [fileToUpload]
            }
          })
          if (!resp?.data?.uploadAssets?.operation?.succeeded) {
            throw new Error(resp?.data?.uploadAssets?.operation?.message || 'An unexpected error occured.')
          }
        }
        state.uploadPercentage = 100
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

function openItem (item) {
  console.info(item.id)
}

// MOUNTED

onMounted(() => {
  loadTree()
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

  &-filelist {
    padding: 8px 12px;

    > .q-item {
      padding: 8px 6px;
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
