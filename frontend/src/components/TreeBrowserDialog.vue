<template lang='pug'>
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card.page-save-dialog(style='width: 860px; max-width: 90vw;')
    q-card-section.card-header(v-if='props.mode === `savePage`')
      q-icon(name='img:/_assets/icons/fluent-save-as.svg', left, size='sm')
      span {{ t('pageSaveDialog.title') }}
    q-card-section.card-header(v-else-if='props.mode === `duplicatePage`')
      q-icon(name='img:/_assets/icons/color-documents.svg', left, size='sm')
      span {{ t('pageDuplicateDialog.title') }}
    q-card-section.card-header(v-else-if='props.mode === `renamePage`')
      q-icon(name='img:/_assets/icons/fluent-rename.svg', left, size='sm')
      span {{ t('pageRenameDialog.title') }}
    .row.page-save-dialog-browser
      .col-4
        q-scroll-area(
          :thumb-style='thumbStyle'
          :bar-style='barStyle'
          style='height: 300px'
          )
          .q-px-sm
            tree(
              ref='treeComp'
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
            @click='selectItem(item)'
            )
            q-item-section(side)
              q-icon(:name='item.icon', size='sm')
            q-item-section
              q-item-label {{item.title}}
    .page-save-dialog-path.font-robotomono {{ currentFolderPath }}
    q-list.q-py-sm
      q-item
        blueprint-icon(icon='new-document')
        q-item-section
          q-input(
            v-model='state.title'
            :label='t(`pageSaveDialog.pageTitle`)'
            :aria-label='t(`pageSaveDialog.pageTitle`)'
            dense
            outlined
            autofocus
            @focus='state.currentFileId = null'
            @keyup.enter='save'
          )
      q-item
        blueprint-icon(icon='file-submodule')
        q-item-section
          q-input(
            v-model='state.path'
            :label='t(`pageSaveDialog.pathName`)'
            :aria-label='t(`pageSaveDialog.pathName`)'
            dense
            outlined
            @focus='state.pathDirty = true; state.currentFileId = null'
            @keyup.enter='save'
            )
            //- template(#append)
            //-   q-badge(outline, color='grey', label='valid')
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
      )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'

import slugify from 'slugify'

import fileTypes from '../helpers/fileTypes'

import FolderCreateDialog from '@/components/FolderCreateDialog.vue'
import Tree from '@/components/TreeNav.vue'

import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  mode: {
    type: String,
    required: false,
    default: 'savePage'
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

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  displayMode: 'title',
  currentFolderId: null,
  currentFileId: null,
  isFetching: false,
  treeNodes: {},
  treeRoots: [],
  fileList: [],
  title: '',
  path: '',
  typesToFetch: [],
  pathDirty: false
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

// REFS

const treeComp = ref(null)

// COMPUTED

const currentFolderPath = computed(() => {
  const folderNode = state.currentFolderId ? state.treeNodes[state.currentFolderId] : null
  if (!folderNode?.fileName) {
    return '/'
  }
  return folderNode.folderPath ? `/${folderNode.folderPath}/${folderNode.fileName}/` : `/${folderNode.fileName}/`
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

// WATCHERS

watch(() => state.currentFolderId, async (newValue) => {
  await loadTree({ parentId: newValue })
})

watch(() => state.title, (newValue) => {
  if (state.pathDirty && !state.path) {
    state.pathDirty = false
  }
  if (!state.pathDirty) {
    state.path = slugify(newValue, { lower: true, strict: true })
  }
})

// METHODS

async function save () {
  if (!state.title?.trim()) {
    $q.notify({
      type: 'negative',
      message: t('pageSaveDialog.titleMissing')
    })
    return
  }
  if (!/^[a-z0-9-]+$/.test(state.path)) {
    $q.notify({
      type: 'negative',
      message: t('pageSaveDialog.pathInvalid')
    })
    return
  }
  onDialogOK({
    title: state.title.trim(),
    path: currentFolderPath.value.length > 1 ? `${currentFolderPath.value.substring(1)}${state.path}` : state.path
  })
}

/**
 * The message an API failure should be reported with — the server's own if it sent one, since ky
 * throws before the caller ever sees the body.
 */
async function apiErrorMessage (err, fallback) {
  const message = await err.response?.json().then(b => b?.message).catch(() => null)
  return message || err.message || fallback
}

async function treeLazyLoad (nodeId, isCurrent, { done }) {
  await loadTree({ parentId: nodeId })
  done()
}

/**
 * Loads one folder into the tree, and — when that folder is the selected one — into the file list.
 *
 * `initLoad` asks for the folders above the one being listed as well, so that opening the dialog on a
 * page buried a few levels down draws its whole branch from a single request. Those extra entries come
 * back flagged `isAncestor` and belong in the tree only, never in the file list.
 */
async function loadTree ({ parentId = null, parentPath = null, initLoad = false }) {
  if (state.isFetching) { return }
  state.isFetching = true
  if (!parentId) {
    parentId = null
  }
  const isCurrentFolder = parentId === state.currentFolderId
  if (isCurrentFolder) {
    state.currentFileId = null
    state.fileList = []
  }
  try {
    const items = await API_CLIENT.get(`sites/${siteStore.id}/tree`, {
      searchParams: {
        ...(parentId ? { parentId } : {}),
        ...(parentPath ? { parentPath } : {}),
        ...(state.typesToFetch?.length > 0 ? { types: state.typesToFetch.join(',') } : {}),
        includeAncestors: initLoad,
        includeRootFolders: initLoad
      }
    }).json()
    if (items?.length > 0) {
      const newTreeRoots = []
      for (const item of items) {
        switch (item.type) {
          case 'folder': {
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
                const parentFolder = items.find(i =>
                  i.folderPath === parentFolderParts.slice(0, -1).join('/') &&
                  i.fileName === parentFolderParts.at(-1)
                )
                folderParentId = parentFolder?.id
              }
              if (item.id !== folderParentId && !state.treeNodes[folderParentId]?.children?.includes(item.id)) {
                state.treeNodes[folderParentId]?.children?.push(item.id)
              }
            } else {
              newTreeRoots.push(item.id)
            }

            // -> File List
            if (isCurrentFolder && !item.isAncestor) {
              state.fileList.push({
                id: item.id,
                type: 'folder',
                title: item.title,
                fileName: item.fileName
              })
            }
            break
          }
          case 'page': {
            if (isCurrentFolder) {
              state.fileList.push({
                id: item.id,
                type: 'page',
                title: item.title,
                pageType: item.editor || 'markdown',
                folderPath: item.folderPath,
                fileName: item.fileName,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
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
      message: t('pageSaveDialog.loadFailed'),
      caption: await apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  if (parentId) {
    treeComp.value?.setLoaded(parentId)
  }
  state.isFetching = false
}

function treeContextAction (nodeId, action) {
  switch (action) {
    case 'newFolder': {
      newFolder(nodeId)
      break
    }
  }
}

function selectItem (item) {
  // -> A folder is somewhere to save into, not something to overwrite
  if (item.type === 'folder') {
    state.currentFolderId = item.id
    treeComp.value?.setOpened(item.id)
    return
  }
  state.currentFileId = item.id
  state.pathDirty = true
  state.title = item.title
  state.path = item.fileName
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

/** The id of an already-loaded folder, addressed the way a path addresses it. */
function findFolderIdByPath (path) {
  if (!path) { return null }
  const entry = Object.entries(state.treeNodes).find(([, node]) =>
    (node.folderPath ? `${node.folderPath}/${node.fileName}` : node.fileName) === path
  )
  return entry?.[0] ?? null
}

// MOUNTED

onMounted(async () => {
  let fPath = props.folderPath
  let fName = props.itemFileName
  if (props.itemFileName?.includes('/')) {
    const fParts = props.itemFileName.split('/')
    fPath = fParts.slice(0, -1).join('/')
    fName = fParts.at(-1)
  }
  switch (props.mode) {
    case 'savePage':
    case 'duplicatePage': {
      state.typesToFetch = ['folder', 'page']
      break
    }
    case 'renamePage': {
      state.typesToFetch = ['folder', 'page']
      state.pathDirty = true
      break
    }
  }
  state.title = props.itemTitle || ''
  state.path = fName || ''
  await loadTree({
    parentPath: fPath,
    initLoad: true
  })
  // -> A page that lives in a subfolder opens the browser on that subfolder rather than on the root.
  //    The initial request asked for the ancestors too, so the whole branch is already here.
  const startFolderId = findFolderIdByPath(fPath)
  if (startFolderId) {
    const parts = fPath.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const ancestorId = findFolderIdByPath(parts.slice(0, i).join('/'))
      if (ancestorId) {
        treeComp.value?.setOpened(ancestorId)
      }
    }
    state.currentFolderId = startFolderId
  }
})

</script>

<style lang="scss">
@use 'sass:color';

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
      background-color: color.adjust($blue-grey-1, $lightness: 4%);
      border-bottom-color: $blue-grey-1;
      color: $blue-grey-9;
    }
    @at-root .body--dark & {
      background-color: color.adjust($dark-4, $lightness: -1%);
      border-bottom-color: $dark-1;
      color: $blue-grey-3;
    }
  }

}
</style>
