<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card.page-save-dialog(style='width: 860px; max-width: 90vw;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-save-as.svg', left, size='sm')
      span {{t('pageSaveDialog.title')}}
    .row.page-save-dialog-browser
      .col-4
        q-scroll-area(
          :thumb-style='thumbStyle'
          :bar-style='barStyle'
          style='height: 300px'
          )
          .q-px-sm
            tree(
              :nodes='state.treeNodes'
              :roots='state.treeRoots'
              v-model:selected='state.currentFolderId'
              @lazy-load='treeLazyLoad'
              :use-lazy-load='true'
              @context-action='treeContextAction'
              :context-action-list='[`newFolder`]'
              :display-mode='state.displayMode'
            )
      .col-8
        q-list.page-save-dialog-filelist(dense)
          q-item(
            v-for='item of files'
            :key='item.id'
            clickable
            active-class='active'
            :active='item.id === state.currentFileId'
            @click.native='state.currentFileId = item.id'
            @dblclick.native='openItem(item)'
            )
            q-item-section(side)
              q-icon(:name='item.icon', size='sm')
            q-item-section
              q-item-label {{item.title}}
    .page-save-dialog-path.font-robotomono {{folderPath}}
    q-list.q-py-sm
      q-item
        blueprint-icon(icon='new-document')
        q-item-section
          q-input(
            v-model='state.title'
            label='Page Title'
            dense
            outlined
          )
      q-item
        blueprint-icon(icon='file-submodule')
        q-item-section
          q-input(
            v-model='state.path'
            label='Path Name'
            dense
            outlined
          )
    q-card-actions.card-actions.q-px-md
      q-btn.acrylic-btn(
        icon='las la-ellipsis-h'
        color='blue-grey'
        padding='xs sm'
        flat
        )
        q-tooltip(anchor='center right' self='center left') Display Options
        q-menu(
          auto-close
          transition-show='jump-down'
          transition-hide='jump-up'
          anchor='top left'
          self='bottom left'
          )
          q-card.q-pa-sm
            q-list(dense)
              q-item(clickable, @click='state.displayMode = `path`')
                q-item-section(side)
                  q-icon(
                    :name='state.displayMode === `path` ? `las la-check-circle` : `las la-circle`'
                    :color='state.displayMode === `path` ? `positive` : `grey`'
                    size='xs'
                    )
                q-item-section.q-pr-sm {{ t('pageSaveDialog.displayModePath') }}
              q-item(clickable, @click='state.displayMode = `title`')
                q-item-section(side)
                  q-icon(
                    :name='state.displayMode === `title` ? `las la-check-circle` : `las la-circle`'
                    :color='state.displayMode === `title` ? `positive` : `grey`'
                    size='xs'
                    )
                q-item-section.q-pr-sm {{ t('pageSaveDialog.displayModeTitle') }}
      q-space
      q-btn.acrylic-btn(
        icon='las la-times'
        :label='t(`common.actions.cancel`)'
        color='grey-7'
        padding='xs md'
        @click='onDialogCancel'
        flat
      )
      q-btn(
        icon='las la-check'
        :label='t(`common.actions.save`)'
        unelevated
        color='primary'
        padding='xs md'
        @click='save'
        v-close-popup
      )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { cloneDeep, find } from 'lodash-es'
import gql from 'graphql-tag'

import fileTypes from '../helpers/fileTypes'

import FolderCreateDialog from 'src/components/FolderCreateDialog.vue'
import Tree from 'src/components/TreeNav.vue'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// PROPS

const props = defineProps({
  mode: {
    type: String,
    required: false,
    default: 'pageSave'
  },
  itemId: {
    type: String,
    required: false,
    default: ''
  },
  folderPath: {
    type: String,
    required: false,
    default: ''
  },
  itemTitle: {
    type: String,
    required: false,
    default: ''
  },
  itemFileName: {
    type: String,
    required: false,
    default: ''
  }
})

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  displayMode: 'title',
  currentFolderId: '',
  currentFileId: '',
  treeNodes: {},
  treeRoots: [],
  fileList: [],
  title: '',
  path: '',
  typesToFetch: []
})

const thumbStyle = {
  right: '1px',
  borderRadius: '5px',
  backgroundColor: '#666',
  width: '5px',
  opacity: 0.5
}
const barStyle = {
  width: '7px'
}

// COMPUTED

const folderPath = computed(() => {
  if (!state.currentFolderId) {
    return '/'
  } else {
    const folderNode = state.treeNodes[state.currentFolderId] ?? {}
    return folderNode.folderPath ? `/${folderNode.folderPath}/${folderNode.fileName}/` : `/${folderNode.fileName}/`
  }
})

const files = computed(() => {
  return state.fileList.map(f => {
    switch (f.type) {
      case 'folder': {
        f.icon = fileTypes.folder.icon
        break
      }
      case 'page': {
        f.icon = fileTypes.page.icon
        break
      }
    }
    return f
  })
})

// METHODS

async function save () {
  onDialogOK()
}

async function treeLazyLoad (nodeId, { done, fail }) {
  await loadTree({
    parentId: nodeId,
    types: ['folder', 'page']
  })
  done()
}

async function loadTree ({ parentId = null, parentPath = null, types, initLoad = false }) {
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
              editor
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
            state.treeNodes[item.id] = {
              folderPath: item.folderPath,
              fileName: item.fileName,
              title: item.title,
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
    loadTree({ parentId })
  })
}

// MOUNTED

onMounted(() => {
  switch (props.mode) {
    case 'pageSave': {
      state.typesToFetch = ['folder', 'page']
      break
    }
  }
  loadTree({
    parentPath: props.folderPath,
    types: state.typesToFetch,
    initLoad: true
  })
  state.title = props.itemTitle || ''
  state.path = props.itemFileName || ''
})

</script>

<style lang="scss">
.page-save-dialog {

  &-browser {
    height: 300px;
    max-height: 90vh;
    border-bottom: 1px solid #FFF;

    @at-root .body--light & {
      border-bottom-color: $blue-grey-1;
    }
    @at-root .body--dark & {
      border-bottom-color: $dark-3;
    }

    > .col-4 {
      height: 300px;

      @at-root .body--light & {
        background-color: $blue-grey-1;
      }
      @at-root .body--dark & {
        background-color: $dark-4;
      }
    }
  }

  &-filelist {
    padding: 8px 12px;

    > .q-item {
      padding: 4px 6px;
      border-radius: 4px;

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

  &-path {
    padding: 5px 16px;
    font-size: 12px;
    border-bottom: 1px solid #FFF;

    @at-root .body--light & {
      background-color: lighten($blue-grey-1, 4%);
      border-bottom-color: $blue-grey-1;
      color: $blue-grey-9;
    }
    @at-root .body--dark & {
      background-color: darken($dark-4, 1%);
      border-bottom-color: $dark-1;
      color: $blue-grey-3;
    }
  }

}
</style>
