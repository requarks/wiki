<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="page-save-dialog" style="width: 860px; max-width: 90vw">
      <w-card-section v-if="props.mode === `savePage`" class="card-header">
        <w-icon name="img:/_assets/icons/fluent-save-as.svg" size="sm" class="mr-2" />
        <span>{{ t('pageSaveDialog.title') }}</span>
      </w-card-section>
      <w-card-section v-else-if="props.mode === `duplicatePage`" class="card-header">
        <w-icon name="img:/_assets/icons/color-documents.svg" size="sm" class="mr-2" />
        <span>{{ t('pageDuplicateDialog.title') }}</span>
      </w-card-section>
      <w-card-section v-else-if="props.mode === `renamePage`" class="card-header">
        <w-icon name="img:/_assets/icons/fluent-rename.svg" size="sm" class="mr-2" />
        <span>{{ t('pageRenameDialog.title') }}</span>
      </w-card-section>
      <div class="page-save-dialog-browser flex flex-nowrap">
        <div class="w-1/3">
          <w-scroll-area style="height: 300px">
            <div class="px-2">
              <tree
                ref="treeComp"
                v-model:selected="state.currentFolderId"
                :nodes="state.treeNodes"
                :roots="state.treeRoots"
                :use-lazy-load="true"
                :context-action-list="[`newFolder`]"
                :display-mode="state.displayMode"
                @lazy-load="treeLazyLoad"
                @context-action="treeContextAction" />
            </div>
          </w-scroll-area>
        </div>
        <div class="w-2/3">
          <w-list class="page-save-dialog-filelist" dense>
            <w-item
              v-for="item of files"
              :key="item.id"
              clickable
              active-class="active"
              :active="item.id === state.currentFileId"
              @click="selectItem(item)">
              <w-item-section side>
                <w-icon :name="item.icon" size="sm" />
              </w-item-section>
              <w-item-section>
                <w-item-label>{{ item.title }}</w-item-label>
              </w-item-section>
            </w-item>
          </w-list>
        </div>
      </div>
      <div class="page-save-dialog-path font-robotomono">{{ currentFolderPath }}</div>
      <w-list class="py-2">
        <w-item>
          <blueprint-icon icon="new-document" />
          <w-item-section>
            <w-input
              v-model="state.title"
              :label="t(`pageSaveDialog.pageTitle`)"
              dense
              outlined
              autofocus
              @focus="state.currentFileId = null"
              @keyup:enter="save" />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="file-submodule" />
          <w-item-section>
            <w-input
              v-model="state.path"
              :label="t(`pageSaveDialog.pathName`)"
              dense
              outlined
              @focus="onPathFocus"
              @keyup:enter="save" />
          </w-item-section>
        </w-item>
      </w-list>
      <w-card-actions class="card-actions px-4">
        <w-btn class="acrylic-btn" icon="la:ellipsis-h" color="blue-grey" padding="xs sm" flat>
          <w-tooltip anchor="center right" self="center left">Display Options</w-tooltip>
          <w-menu auto-close anchor="top left" self="bottom left">
            <w-card class="p-2">
              <w-list dense>
                <w-item clickable @click="state.displayMode = `path`">
                  <w-item-section side>
                    <w-icon
                      :name="state.displayMode === `path` ? `la:check-circle` : `la:circle`"
                      :color="state.displayMode === `path` ? `positive` : `grey`"
                      size="xs" />
                  </w-item-section>
                  <w-item-section class="pr-2">{{
                    t('pageSaveDialog.displayModePath')
                  }}</w-item-section>
                </w-item>
                <w-item clickable @click="state.displayMode = `title`">
                  <w-item-section side>
                    <w-icon
                      :name="
                        state.displayMode === `title` ? `la:check-circle` : `la:circle`
                      "
                      :color="state.displayMode === `title` ? `positive` : `grey`"
                      size="xs" />
                  </w-item-section>
                  <w-item-section class="pr-2">{{
                    t('pageSaveDialog.displayModeTitle')
                  }}</w-item-section>
                </w-item>
              </w-list>
            </w-card>
          </w-menu>
        </w-btn>
        <w-space />
        <w-btn
          class="acrylic-btn"
          icon="la:times"
          :label="t(`common.actions.cancel`)"
          color="grey-7"
          padding="xs md"
          flat
          @click="onDialogCancel" />
        <w-btn
          icon="la:check"
          :label="t(`common.actions.save`)"
          unelevated
          color="primary"
          padding="xs md"
          @click="save" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialog, dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { computed, onMounted, reactive, ref, watch } from 'vue'

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

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

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

// REFS

const treeComp = ref(null)

// COMPUTED

const currentFolderPath = computed(() => {
  const folderNode = state.currentFolderId ? state.treeNodes[state.currentFolderId] : null
  if (!folderNode?.fileName) {
    return '/'
  }
  return folderNode.folderPath
    ? `/${folderNode.folderPath}/${folderNode.fileName}/`
    : `/${folderNode.fileName}/`
})

const files = computed(() => {
  return state.fileList.map((f) => {
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

watch(
  () => state.currentFolderId,
  async (newValue) => {
    await loadTree({ parentId: newValue })
  }
)

watch(
  () => state.title,
  (newValue) => {
    if (state.pathDirty && !state.path) {
      state.pathDirty = false
    }
    if (!state.pathDirty) {
      state.path = slugify(newValue, { lower: true, strict: true })
    }
  }
)

// METHODS

/** Typing in the path field takes over from the tree selection that was driving it. */
function onPathFocus() {
  state.pathDirty = true
  state.currentFileId = null
}

async function save() {
  if (!state.title?.trim()) {
    notify({
      type: 'negative',
      message: t('pageSaveDialog.titleMissing')
    })
    return
  }
  if (!/^[a-z0-9-]+$/.test(state.path)) {
    notify({
      type: 'negative',
      message: t('pageSaveDialog.pathInvalid')
    })
    return
  }
  onDialogOK({
    title: state.title.trim(),
    path:
      currentFolderPath.value.length > 1
        ? `${currentFolderPath.value.substring(1)}${state.path}`
        : state.path
  })
}

/**
 * The message an API failure should be reported with — the server's own if it sent one, since ky
 * throws before the caller ever sees the body.
 */
async function apiErrorMessage(err, fallback) {
  const message = await err.response
    ?.json()
    .then((b) => b?.message)
    .catch(() => null)
  return message || err.message || fallback
}

async function treeLazyLoad(nodeId, isCurrent, { done }) {
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
async function loadTree({ parentId = null, parentPath = null, initLoad = false }) {
  if (state.isFetching) {
    return
  }
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
                const parentFolder = items.find(
                  (i) =>
                    i.folderPath === parentFolderParts.slice(0, -1).join('/') &&
                    i.fileName === parentFolderParts.at(-1)
                )
                folderParentId = parentFolder?.id
              }
              if (
                item.id !== folderParentId &&
                !state.treeNodes[folderParentId]?.children?.includes(item.id)
              ) {
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
    notify({
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

function treeContextAction(nodeId, action) {
  switch (action) {
    case 'newFolder': {
      newFolder(nodeId)
      break
    }
  }
}

function selectItem(item) {
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

function newFolder(parentId) {
  dialog({
    component: FolderCreateDialog,
    componentProps: {
      parentId
    }
  }).onOk(() => {
    loadTree({ parentId })
  })
}

/** The id of an already-loaded folder, addressed the way a path addresses it. */
function findFolderIdByPath(path) {
  if (!path) {
    return null
  }
  const entry = Object.entries(state.treeNodes).find(
    ([, node]) => (node.folderPath ? `${node.folderPath}/${node.fileName}` : node.fileName) === path
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
    border-bottom: 1px solid #fff;

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

    > .w-item {
      padding: 4px 6px;
      border-radius: 4px;

      &.active {
        background-color: var(--color-primary);
        color: #fff;

        .fileman-filelist-label .w-item-label--caption {
          color: rgba(255, 255, 255, 0.7);
        }

        .fileman-filelist-side .text-caption {
          color: rgba(255, 255, 255, 0.7);
        }
      }
    }
  }

  &-path {
    padding: 5px 16px;
    font-size: 12px;
    border-bottom: 1px solid #fff;

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
