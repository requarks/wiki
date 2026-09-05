<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="page-save-dialog" style="width: 860px; max-width: 90vw">
      <!--
        One header rather than one per mode: the locale picker sits in it, and three copies of the
        same button is three places to keep in step.
      -->
      <w-card-section class="card-header">
        <w-icon :name="header.icon" size="sm" class="mr-2" />
        <div class="min-w-0">
          <div>{{ t(header.title) }}</div>
          <!-- -> Which folder is being moved: the form below is a destination and nothing else, so
                  without this the dialog never says what it is acting on -->
          <div class="text-caption truncate" v-if="isFolderMode">{{ itemTitle }}</div>
        </div>
        <w-space />
        <!-- -> Only where there is a choice to make: one active locale is most wikis, and a button
                that can only say `en` is noise on all of them -->
        <w-btn
          v-if="siteStore.locales.active.length > 1"
          class="acrylic-btn -my-2"
          flat
          dense
          padding="xs md"
          color="white"
          :label="siteStore.localeAlias(state.locale)"
          :aria-label="siteStore.localeAlias(state.locale)">
          <w-tooltip>{{
            t(isAssetMode ? `fileman.assetLocaleHint` : `pageSaveDialog.localeHint`)
          }}</w-tooltip>
          <locale-selector-menu
            :selected="state.locale"
            :navigate="false"
            anchor="bottom right"
            self="top right"
            @select="switchLocale" />
        </w-btn>
      </w-card-section>
      <div class="page-save-dialog-browser flex flex-nowrap">
        <div class="page-save-dialog-tree w-1/3">
          <w-scroll-area style="height: 300px">
            <!-- -> No side padding: the rows carry their own 12px and span the column, as in the
                    File Manager. Padding here would inset the highlight band as well. -->
            <div>
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
          <!--
            Scrolls on its own, as the tree beside it does: this row is a fixed 300px, and a folder
            with more entries than that holds simply drew straight over the path bar, the two fields
            and the buttons underneath.
          -->
          <w-scroll-area style="height: 300px">
            <w-list class="page-save-dialog-filelist" dense>
              <w-item
                v-for="item of files"
                :key="item.id"
                clickable
                active-class="active"
                :active="item.id === state.currentFileId"
                @click="selectItem(item)">
                <w-item-section side>
                  <w-icon :name="item.icon" size="sm" :style="item.iconStyle" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ item.title }}</w-item-label>
                </w-item-section>
              </w-item>
            </w-list>
          </w-scroll-area>
        </div>
      </div>
      <div class="page-save-dialog-path font-robotomono">{{ currentFolderPath }}</div>
      <w-list class="py-2" v-if="!isFolderMode">
        <!--
          A folder is named twice over -- what it is called, and the segment its children's paths are
          built from -- so a copy asks for both, the way the create and rename dialogs do. The path
          follows the title until that field is touched, which is what makes `Guides copy` arrive as
          `guides-copy` without anybody typing it.
        -->
        <w-item v-if="isFolderCopyMode">
          <blueprint-icon icon="folder" />
          <w-item-section>
            <w-input
              v-model="state.title"
              :label="t(`fileman.folderTitle`)"
              dense
              outlined
              autofocus
              @keyup:enter="save" />
          </w-item-section>
        </w-item>
        <!--
          A page has a title and, separately, the path segment it is addressed by; a file has one
          name that is both, so the asset mode asks for that alone.
        -->
        <w-item v-if="!isAssetMode && !isFolderCopyMode">
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
          <blueprint-icon :icon="isAssetMode ? `image` : `file-submodule`" />
          <w-item-section>
            <w-input
              v-model="state.path"
              :label="t(pathField.label)"
              :hint="pathField.hint ? t(pathField.hint) : undefined"
              dense
              outlined
              :autofocus="isAssetMode"
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
                      :name="state.displayMode === `title` ? `la:check-circle` : `la:circle`"
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
import { folderIconStyle } from '@/helpers/folderColors'

import FolderCreateDialog from '@/components/FolderCreateDialog.vue'
import LocaleSelectorMenu from '@/components/LocaleSelectorMenu.vue'
import Tree from '@/components/TreeNav.vue'

import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'
import { normalizePagePath } from '@/helpers/pagePaths'

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
  },
  /**
   * The locale to browse, and — where the mode allows it — the one the page ends up in. The caller's
   * to give: the page view means the page on screen, the file manager means whichever locale it is
   * listing. The site's primary when absent.
   */
  locale: {
    type: String,
    required: false,
    default: null
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
  locale: props.locale || siteStore.locales.primary,
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

const header = computed(() => {
  switch (props.mode) {
    case 'duplicatePage': {
      return { icon: 'img:/_assets/icons/color-documents.svg', title: 'pageDuplicateDialog.title' }
    }
    case 'renamePage': {
      return { icon: 'img:/_assets/icons/fluent-rename.svg', title: 'pageRenameDialog.title' }
    }
    case 'renameAsset': {
      return { icon: 'img:/_assets/icons/fluent-rename.svg', title: 'fileman.assetRenameMove' }
    }
    case 'moveFolder': {
      return { icon: 'img:/_assets/icons/fluent-folder-tree.svg', title: 'fileman.folderMove' }
    }
    case 'duplicateFolder': {
      return { icon: 'img:/_assets/icons/color-documents.svg', title: 'fileman.folderDuplicate' }
    }
    default: {
      return { icon: 'img:/_assets/icons/fluent-save-as.svg', title: 'pageSaveDialog.title' }
    }
  }
})

/** Whether this is browsing for somewhere to put a file rather than a page. */
const isAssetMode = computed(() => props.mode === 'renameAsset')

/**
 * Whether this is picking a destination and nothing else. A folder keeps its own name and title when
 * it moves -- renaming one is its own dialog -- so there is no field to fill in, and the browser is
 * the whole of the form.
 */
const isFolderMode = computed(() => props.mode === 'moveFolder')

/**
 * Whether a folder is being copied, which asks for a destination AND a name: the copy is a new folder
 * and needs one of its own, defaulted to the source's with `copy` on the end.
 */
const isFolderCopyMode = computed(() => props.mode === 'duplicateFolder')

/** What the one field every mode shares is asking for. */
const pathField = computed(() => {
  if (isAssetMode.value) {
    return { label: 'fileman.assetFileName', hint: 'fileman.assetFileNameHint' }
  }
  if (isFolderCopyMode.value) {
    return { label: 'fileman.folderFileName', hint: 'fileman.folderFileNameHint' }
  }
  return { label: 'pageSaveDialog.pathName', hint: null }
})

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
        f.iconStyle = folderIconStyle(f.hue)
        break
      }
      case 'page': {
        f.icon = fileTypes.page.icon
        break
      }
      case 'asset': {
        f.icon = fileTypes[f.fileExt]?.icon ?? ''
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
  // -> Nothing to validate: the destination is whatever folder the browser is open on, and the site
  //    root is a real answer
  if (isFolderMode.value) {
    onDialogOK({
      locale: state.locale,
      folderPath: currentFolderPath.value.slice(1, -1)
    })
    return
  }
  /*
    A folder is held to what a folder is held to everywhere else: a title that is shown, and a path
    segment that every page underneath is addressed through. The server checks both again, and it is
    the one that decides whether the name is free where the copy is going.
  */
  if (isFolderCopyMode.value) {
    if (!state.title?.trim()) {
      notify({ type: 'negative', message: t('fileman.folderTitleMissing') })
      return
    }
    state.path = normalizePagePath(state.path)
    if (!/^[a-z0-9-]+$/.test(state.path)) {
      notify({ type: 'negative', message: t('fileman.folderFileNameInvalid') })
      return
    }
    onDialogOK({
      locale: state.locale,
      folderPath: currentFolderPath.value.slice(1, -1),
      pathName: state.path,
      title: state.title.trim()
    })
    return
  }
  /*
    A file name is not a slug: it keeps its extension, which is what decides the type the file is
    served as, so the page rules below -- which refuse a dot -- cannot be applied to it. Held to what
    the rename dialog it replaces asked for, and left to the server to sanitize beyond that; the
    stored name comes back on the response.
  */
  if (isAssetMode.value) {
    const name = state.path?.trim() ?? ''
    if (name.length < 2 || !name.includes('.')) {
      notify({
        type: 'negative',
        message: t('fileman.renameAssetInvalid')
      })
      return
    }
    onDialogOK({
      locale: state.locale,
      folderPath: currentFolderPath.value.slice(1, -1),
      fileName: name
    })
    return
  }
  if (!state.title?.trim()) {
    notify({
      type: 'negative',
      message: t('pageSaveDialog.titleMissing')
    })
    return
  }
  // -> A path is a URL: casing and spaces are corrected rather than refused, the way the server does
  //    it, and the field is left showing what will actually be saved
  state.path = normalizePagePath(state.path)
  if (!/^[a-z0-9-]+$/.test(state.path)) {
    notify({
      type: 'negative',
      message: t('pageSaveDialog.pathInvalid')
    })
    return
  }
  onDialogOK({
    title: state.title.trim(),
    locale: state.locale,
    path:
      currentFolderPath.value.length > 1
        ? `${currentFolderPath.value.substring(1)}${state.path}`
        : state.path
  })
}

/**
 * Browse another locale.
 *
 * Back to its root: the folder that was open belongs to the tree being left, and a folder id from it
 * would list somebody else's contents under this locale's name.
 */
async function switchLocale(locale) {
  if (locale === state.locale) {
    return
  }
  state.locale = locale
  state.treeNodes = {}
  state.treeRoots = []
  state.currentFolderId = null
  state.currentFileId = null
  state.fileList = []
  treeComp.value?.resetLoaded()
  await loadTree({ initLoad: true })
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
        locale: state.locale,
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
              hue: item.hue,
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
                fileName: item.fileName,
                hue: item.hue
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
          // -> Only the asset mode asks for these, and it asks for them so that the folder being
          //    picked shows the files already in it -- which is where a name clash becomes visible
          case 'asset': {
            if (isCurrentFolder) {
              state.fileList.push({
                id: item.id,
                type: 'asset',
                title: item.title,
                fileExt: item.fileExt,
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
    notify({
      type: 'negative',
      message: t('pageSaveDialog.loadFailed'),
      caption: apiErrorMessage(err, 'An unexpected error occured.')
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
      parentId,
      locale: state.locale
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
    /*
      Assets rather than pages in the file list: this is browsing for a folder to put a file in, and
      what is worth seeing there is the other files already in it. `pathDirty` because an asset has
      no title of its own to derive a name from -- the two are the same string.
    */
    case 'renameAsset': {
      state.typesToFetch = ['folder', 'asset']
      state.pathDirty = true
      break
    }
    // -> Folders alone: the answer being picked is which one to move into, and a listing of the pages
    //    beside it is not part of that question
    case 'moveFolder': {
      state.typesToFetch = ['folder']
      state.pathDirty = true
      break
    }
    case 'duplicateFolder': {
      state.typesToFetch = ['folder']
      break
    }
  }
  /*
    A copy is offered the source's name with `copy` on the end, which the path field then slugs into
    `guides-copy`. Set before the watcher can see it -- it only follows the title while the path has
    not been touched, and this is one write, not a typed one.
  */
  state.title = isFolderCopyMode.value ? `${props.itemTitle} copy` : props.itemTitle || ''
  state.path = isFolderCopyMode.value ? `${fName}-copy` : fName || ''
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
  /*
    The header draws its separator as an OUTSET box-shadow, which is painted with the header's own
    background -- and a later sibling's background is painted after it. So the tinted tree column
    covered that 1px line while the untinted file list left it showing, and the two columns looked as
    though they started at different heights.

    Positioning the header puts it above both: a positioned element paints over its in-flow siblings,
    so the line survives across the full width.
  */
  .card-header {
    position: relative;
  }

  &-browser {
    height: 300px;
    max-height: 90vh;
    /* -> Belt and braces with the scroll areas inside: whatever either column ends up holding, the
          browser cannot spill over the fields and buttons below it */
    overflow: hidden;
    border-bottom: 1px solid #fff;

    @at-root .body--light & {
      border-bottom-color: $blue-grey-1;
    }
    @at-root .body--dark & {
      border-bottom-color: $dark-3;
    }
  }

  /*
    Tinted so the tree reads as a column of its own rather than running into the file list beside it.

    This was a `> .col-4` rule, which the layout migration left pointing at a class that no longer
    exists -- the columns are Tailwind fractions now -- so the pane had been plain white since.
  */
  &-tree {
    @at-root .body--light & {
      background-color: $blue-grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
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
