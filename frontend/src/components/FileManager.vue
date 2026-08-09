<template>
  <w-layout class="fileman" view="hHh lpR lFr" container>
    <w-header class="card-header">
      <w-toolbar dark>
        <w-icon name="img:/_assets/icons/fluent-folder.svg" left size="md" />
        <span>{{ t(`fileman.title`) }}</span>
      </w-toolbar>
      <w-toolbar dark>
        <!-- -> Same gate the sidebar's locale button uses in `MainLayout`: with the site's locale menu
             off, switching locale is not something a reader is offered anywhere -->
        <w-btn
          v-if="siteStore.locales.showMenu"
          class="fileman-locale mr-2 acrylic-btn"
          flat
          color="white"
          :label="commonStore.locale"
          :aria-label="commonStore.locale"
          style="height: 40px">
          <locale-selector-menu />
        </w-btn>
        <!--
          The same pill the site header uses, rather than a `w-input`.

          It was a `w-input` carrying `dark`, `standout="bg-white text-dark"` and `debounce`, none of
          which that component has -- they fell through as bare attributes and styled nothing. What
          rendered was the FILLED variant: a 4%-black wash holding white text, on a near-black header,
          with its label stranded above the toolbar. Written out here so it matches HeaderSearch,
          which is what a search field in this app looks like.
        -->
        <div class="fileman-search" :class="{ 'is-focused': state.searchIsFocused }">
          <w-icon class="fileman-search-lead" name="la:search" />
          <input
            ref="searchField"
            v-model="state.search"
            type="text"
            class="fileman-search-input"
            :placeholder="t(`fileman.searchFolder`)"
            :aria-label="t(`fileman.searchFolder`)"
            autocomplete="off"
            @focus="state.searchIsFocused = true"
            @blur="state.searchIsFocused = false" />
          <button
            v-if="state.search.length > 0"
            type="button"
            class="fileman-search-clear"
            :aria-label="t(`common.actions.clear`)"
            @click="state.search = ``">
            <w-icon name="la:times" />
          </button>
        </div>
      </w-toolbar>
      <!--
        The same chrome the editing overlays close themselves with -- see `NavEditOverlay`: a flat round
        help button, then the pushed group. One button in the group here, since there is nothing to save;
        `push` goes on the buttons, which is where `WBtn` reads it, not on the group.

        -> No right margin on the last control: the toolbar's own 12px is already close to the 9-10px the
           header leaves above and below.
      -->
      <w-toolbar dark>
        <w-space />
        <w-btn
          class="mr-2"
          flat
          rounded
          color="white"
          :aria-label="t(`common.actions.viewDocs`)"
          icon="la:question-circle"
          :href="siteStore.docsBase + `/editor/file-manager`"
          target="_blank">
          <!-- -> `WTooltip` already defaults to below-the-trigger, which is where a header wants it -->
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn-group>
          <w-btn
            push
            color="white"
            text-color="grey-7"
            :label="t(`common.actions.close`)"
            :aria-label="t(`common.actions.close`)"
            icon="la:times"
            @click="close" />
        </w-btn-group>
      </w-toolbar>
    </w-header>
    <w-drawer class="fileman-left" :model-value="true" :width="350">
      <w-scroll-area :thumb-style="thumbStyle" :bar-style="barStyle" style="height: 100%">
        <!--
          -> No side padding: the tree's rows run the full width of the drawer, so a hovered or
             selected row reads as a band across it rather than a floating pill. `pt-2` is the gap
             above the root entry that the padding used to imply.
        -->
        <div class="pt-2 pb-2">
          <tree
            ref="treeComp"
            :nodes="state.treeNodes"
            :roots="state.treeRoots"
            v-model:selected="state.currentFolderId"
            @lazy-load="treeLazyLoad"
            :use-lazy-load="true"
            @context-action="treeContextAction"
            :display-mode="state.displayMode" />
        </div>
      </w-scroll-area>
    </w-drawer>
    <w-drawer class="fileman-right" :model-value="screen.gt.md" :width="350" side="right">
      <w-scroll-area :thumb-style="thumbStyle" :bar-style="barStyle" style="height: 100%">
        <div class="p-4">
          <template v-if="currentFileDetails">
            <img
              class="w-full object-cover rounded mb-4"
              v-if="currentFileDetails.thumbnail"
              :src="currentFileDetails.thumbnail"
              width="100%"
              :ratio="16 / 10" />
            <div
              class="fileman-details-row"
              v-for="item of currentFileDetails.items"
              :key="item.id">
              <label>{{ item.label }}</label>
              <span>{{ item.value }}</span>
            </div>
            <template v-if="insertMode">
              <w-separator class="my-4" />
              <w-btn
                class="w-full"
                @click="insertItem()"
                :label="t(`common.actions.insert`)"
                color="primary"
                icon="la:plus-circle"
                push
                padding="sm" />
            </template>
          </template>
        </div>
      </w-scroll-area>
    </w-drawer>
    <w-page-container>
      <w-page class="fileman-center column">
        <!-- TOOLBAR ----------------------------------------------------- -->
        <w-toolbar class="fileman-toolbar">
          <template v-if="state.isUploading">
            <div class="fileman-progressbar">
              <div :style="`width: ` + state.uploadPercentage + `%`">
                {{ state.uploadPercentage }}%
              </div>
            </div>
            <w-btn
              class="acrylic-btn ml-2"
              flat
              dense
              no-caps
              color="negative"
              :aria-label="t(`common.actions.cancel`)"
              icon="la:square"
              @click="uploadCancel"
              v-if="state.uploadPercentage < 100" />
          </template>
          <template v-else>
            <w-space />
            <w-btn
              class="mr-2"
              flat
              dense
              no-caps
              color="grey"
              :aria-label="t(`fileman.viewOptions`)"
              icon="la:th-list">
              <w-tooltip anchor="bottom middle" self="top middle">{{
                t(`fileman.viewOptions`)
              }}</w-tooltip>
              <w-menu
                transition-show="jump-down"
                transition-hide="jump-up"
                anchor="bottom right"
                self="top right">
                <w-card class="p-2">
                  <div class="text-center">
                    <small class="text-grey">{{ t(`fileman.viewOptions`) }}</small>
                  </div>
                  <w-list dense>
                    <w-separator class="my-2" />
                    <w-item clickable>
                      <w-item-section side>
                        <w-icon name="la:list" color="grey" size="xs" />
                      </w-item-section>
                      <w-item-section class="pr-2">Browse using...</w-item-section>
                      <w-item-section side>
                        <w-icon name="la:angle-right" color="grey" size="xs" />
                      </w-item-section>
                      <w-menu anchor="top end" self="top start">
                        <w-list class="p-2" dense>
                          <w-item clickable @click="state.displayMode = `path`">
                            <w-item-section side>
                              <w-icon
                                :name="
                                  state.displayMode === `path` ? `la:check-circle` : `la:circle`
                                "
                                :color="state.displayMode === `path` ? `positive` : `grey`"
                                size="xs" />
                            </w-item-section>
                            <w-item-section class="pr-2">Browse Using Paths</w-item-section>
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
                            <w-item-section class="pr-2">Browse Using Titles</w-item-section>
                          </w-item>
                        </w-list>
                      </w-menu>
                    </w-item>
                    <w-item clickable @click="state.isCompact = !state.isCompact">
                      <w-item-section side>
                        <w-icon
                          :name="state.isCompact ? `la:check-square` : `la:stop`"
                          :color="state.isCompact ? `positive` : `grey`"
                          size="xs" />
                      </w-item-section>
                      <w-item-section class="pr-2">Compact List</w-item-section>
                    </w-item>
                    <w-item clickable @click="state.shouldShowFolders = !state.shouldShowFolders">
                      <w-item-section side>
                        <w-icon
                          :name="state.shouldShowFolders ? `la:check-square` : `la:stop`"
                          :color="state.shouldShowFolders ? `positive` : `grey`"
                          size="xs" />
                      </w-item-section>
                      <w-item-section class="pr-2">Show Folders</w-item-section>
                    </w-item>
                  </w-list>
                </w-card>
              </w-menu>
            </w-btn>
            <w-btn
              class="mr-2"
              flat
              dense
              no-caps
              color="grey"
              :aria-label="t(`common.actions.refresh`)"
              icon="la:redo-alt"
              @click="reloadFolder(state.currentFolderId)">
              <w-tooltip anchor="bottom middle" self="top middle">{{
                t(`common.actions.refresh`)
              }}</w-tooltip>
            </w-btn>
            <w-separator class="mr-2" inset vertical />
            <w-btn
              class="mr-2"
              flat
              dense
              no-caps
              color="blue"
              :label="t(`common.actions.new`)"
              :aria-label="t(`common.actions.new`)"
              icon="la:plus-circle">
              <new-menu
                :hide-asset-btn="true"
                :show-new-folder="true"
                @new-folder="() => newFolder(state.currentFolderId)"
                @new-page="() => close()"
                :base-path="folderPath" />
            </w-btn>
            <w-btn
              flat
              dense
              no-caps
              color="positive"
              :label="t(`common.actions.upload`)"
              :aria-label="t(`common.actions.upload`)"
              icon="la:cloud-upload-alt"
              @click="uploadFile" />
          </template>
        </w-toolbar>
        <div class="flex flex-wrap" style="flex: 1 1 100%">
          <div class="min-w-0 flex-1">
            <w-scroll-area :thumb-style="thumbStyle" :bar-style="barStyle" style="height: 100%">
              <div class="fileman-loadinglist" v-if="state.fileListLoading">
                <w-spinner class="mr-2" color="primary" size="64px" />
                <span class="text-primary">Fetching folder contents...</span>
              </div>
              <div class="fileman-emptylist" v-else-if="files.length < 1">
                <img src="/_assets/icons/carbon-copy-empty-box.svg" />
                <span>This folder is empty.</span>
              </div>
              <w-list class="fileman-filelist" v-else :class="state.isCompact && `is-compact`">
                <w-item
                  v-for="item of files"
                  :key="item.id"
                  clickable
                  active-class="active"
                  :active="item.id === state.currentFileId"
                  @click="selectItem(item)"
                  @dblclick="doubleClickItem(item)">
                  <w-item-section class="fileman-filelist-icon" avatar>
                    <w-icon :name="item.icon" :size="state.isCompact ? `md` : `xl`" />
                  </w-item-section>
                  <w-item-section class="fileman-filelist-label">
                    <w-item-label>{{ usePathTitle ? item.fileName : item.title }}</w-item-label>
                    <w-item-label caption v-if="!state.isCompact">{{ item.caption }}</w-item-label>
                  </w-item-section>
                  <w-item-section class="fileman-filelist-side" side v-if="item.side">
                    <div class="text-caption">{{ item.side }}</div>
                  </w-item-section>
                  <!-- RIGHT-CLICK MENU -->
                  <w-menu
                    class="translucent-menu"
                    touch-position
                    context-menu
                    auto-close
                    transition-show="jump-down"
                    transition-hide="jump-up">
                    <w-card class="p-2">
                      <w-list dense style="min-width: 150px">
                        <w-item
                          clickable
                          v-if="insertMode && item.type !== `folder`"
                          @click="insertItem(item)">
                          <w-item-section side>
                            <w-icon name="la:plus-circle" color="primary" />
                          </w-item-section>
                          <w-item-section>{{ t(`common.actions.insert`) }}</w-item-section>
                        </w-item>
                        <w-item clickable v-if="item.type === `page`" @click="editItem(item)">
                          <w-item-section side>
                            <w-icon name="la:edit" color="orange" />
                          </w-item-section>
                          <w-item-section>{{ t(`common.actions.edit`) }}</w-item-section>
                        </w-item>
                        <!-- -> Nothing to render on a redirection: it has a target where a page has
                                content, and the endpoint behind this refuses any editor but markdown -->
                        <w-item
                          clickable
                          v-if="item.type === `page` && item.pageType !== `redirect`"
                          @click="rerenderPage(item)">
                          <w-item-section side>
                            <w-icon name="la:magic" color="orange" />
                          </w-item-section>
                          <w-item-section>{{ t(`common.actions.rerender`) }}</w-item-section>
                        </w-item>
                        <w-item clickable v-if="item.type !== `folder`" @click="openItem(item)">
                          <w-item-section side>
                            <w-icon name="la:eye" color="primary" />
                          </w-item-section>
                          <w-item-section>{{ t(`common.actions.view`) }}</w-item-section>
                        </w-item>
                        <template v-if="item.type === `asset` && item.imageEdit">
                          <w-item clickable>
                            <w-item-section side>
                              <w-icon name="la:edit" color="orange" />
                            </w-item-section>
                            <w-item-section>Edit Image...</w-item-section>
                          </w-item>
                          <w-item clickable>
                            <w-item-section side>
                              <w-icon name="la:crop" color="orange" />
                            </w-item-section>
                            <w-item-section>Resize Image...</w-item-section>
                          </w-item>
                        </template>
                        <w-item clickable v-if="item.type !== `folder`" @click="copyItemURL(item)">
                          <w-item-section side>
                            <w-icon name="la:clipboard" color="primary" />
                          </w-item-section>
                          <w-item-section>{{ t(`common.actions.copyURL`) }}</w-item-section>
                        </w-item>
                        <w-item clickable v-if="item.type === `asset`" @click="downloadItem(item)">
                          <w-item-section side>
                            <w-icon name="la:download" color="primary" />
                          </w-item-section>
                          <w-item-section>{{ t(`common.actions.download`) }}</w-item-section>
                        </w-item>
                        <w-item clickable @click="duplicateItem(item)">
                          <w-item-section side>
                            <w-icon name="la:copy" color="teal" />
                          </w-item-section>
                          <w-item-section>Duplicate...</w-item-section>
                        </w-item>
                        <!--
                          One entry for a page: its name and its place are picked in the same dialog
                          the page view's own action rail opens, so offering them as two actions
                          would be offering two ways into one form.
                        -->
                        <w-item clickable v-if="item.type === `page`" @click="renameMovePage(item)">
                          <w-item-section side>
                            <w-icon name="la:share" color="teal" />
                          </w-item-section>
                          <w-item-section>Rename / Move Page...</w-item-section>
                        </w-item>
                        <template v-else>
                          <w-item clickable @click="renameItem(item)">
                            <w-item-section side>
                              <w-icon name="la:redo" color="teal" />
                            </w-item-section>
                            <w-item-section>Rename...</w-item-section>
                          </w-item>
                          <w-item clickable>
                            <w-item-section side>
                              <w-icon name="la:arrow-right" color="teal" />
                            </w-item-section>
                            <w-item-section>Move to...</w-item-section>
                          </w-item>
                        </template>
                        <w-item clickable @click="delItem(item)">
                          <w-item-section side>
                            <w-icon name="la:trash-alt" color="negative" />
                          </w-item-section>
                          <w-item-section class="text-negative">{{
                            t(`common.actions.delete`)
                          }}</w-item-section>
                        </w-item>
                      </w-list>
                    </w-card>
                  </w-menu>
                </w-item>
              </w-list>
            </w-scroll-area>
          </div>
        </div>
      </w-page>
    </w-page-container>
    <w-footer>
      <w-bar class="fileman-path">
        <small class="text-caption text-grey-7">{{ folderPath }}</small>
      </w-bar>
    </w-footer>
    <input type="file" ref="fileIpt" multiple @change="uploadNewFiles" style="display: none" />
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRaw,
  watch
} from 'vue'
import { useRouter } from 'vue-router'

import { dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { useScreen } from '@/composables/screen'
import { useDark } from '@/composables/dark'

import { useCommonStore } from '@/stores/common'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { filesize } from 'filesize'
import Fuse from 'fuse.js/basic'
import NewMenu from './PageNewMenu.vue'
import Tree from './TreeNav.vue'
import { apiErrorMessage } from '@/helpers/apiError'
import { assetUrl } from '@/helpers/assets'
import fileTypes from '@/helpers/fileTypes'
import FolderCreateDialog from '@/components/FolderCreateDialog.vue'
import FolderDeleteDialog from '@/components/FolderDeleteDialog.vue'
import FolderRenameDialog from '@/components/FolderRenameDialog.vue'
import AssetRenameDialog from '@/components/AssetRenameDialog.vue'
import LocaleSelectorMenu from '@/components/LocaleSelectorMenu.vue'

// COMPOSABLES

const dark = useDark()
const screen = useScreen()

// STORES

const commonStore = useCommonStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// DATA

/**
 * Where the view options are remembered. The browser rather than the account, deliberately: how
 * densely a list should be drawn is a property of the screen it is being read on, and the same person
 * on a laptop and on a large monitor will not want the same answer.
 */
const VIEW_OPTIONS_KEY = 'wiki.fileman.viewOptions'

/**
 * The remembered view options, each taken only if it is still a value this component understands.
 *
 * Field by field rather than wholesale: the entry outlives the code that wrote it, and an option that
 * has since changed shape -- or been hand-edited in devtools -- must not be able to put the file list
 * into a state it has no way back out of.
 */
function storedViewOptions() {
  let stored = null
  try {
    stored = JSON.parse(globalThis.localStorage?.getItem(VIEW_OPTIONS_KEY) ?? 'null')
  } catch {
    // -> Unreadable is the same as absent: the defaults below stand
  }
  if (!stored || typeof stored !== 'object') {
    return {}
  }
  return {
    ...(['title', 'path'].includes(stored.displayMode) ? { displayMode: stored.displayMode } : {}),
    ...(typeof stored.isCompact === 'boolean' ? { isCompact: stored.isCompact } : {}),
    ...(typeof stored.shouldShowFolders === 'boolean'
      ? { shouldShowFolders: stored.shouldShowFolders }
      : {})
  }
}

const state = reactive({
  loading: 0,
  isFetching: false,
  search: '',
  /** Drives the search pill's inversion, as HeaderSearch does it. */
  searchIsFocused: false,
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

// -> Over the defaults just above, which is what the view falls back to on a first visit
Object.assign(state, storedViewOptions())

/*
  Written on every change rather than when the overlay closes: the file manager is also opened from
  the editor's insert flow, which can be dismissed in ways that never reach a teardown here.
*/
watch(
  () => [state.displayMode, state.isCompact, state.shouldShowFolders],
  ([displayMode, isCompact, shouldShowFolders]) => {
    try {
      globalThis.localStorage?.setItem(
        VIEW_OPTIONS_KEY,
        JSON.stringify({ displayMode, isCompact, shouldShowFolders })
      )
    } catch {
      // -> Full, or storage denied. Not worth a word to the reader: the options still work, they
      //    just will not be there next time.
    }
  }
)

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
const searchField = ref(null)
const treeComp = ref(null)

// COMPUTED

const insertMode = computed(() => siteStore.overlayOpts?.insertMode ?? false)

const folderPath = computed(() => {
  if (!state.currentFolderId) {
    return '/'
  } else {
    const folderNode = state.treeNodes[state.currentFolderId] ?? {}
    return folderNode.folderPath
      ? `/${folderNode.folderPath}/${folderNode.fileName}/`
      : `/${folderNode.fileName}/`
  }
})

const usePathTitle = computed(() => state.displayMode === 'path')

const filteredFiles = computed(() => {
  if (state.search) {
    const fuse = new Fuse(state.fileList, {
      keys: ['title', 'fileName']
    })
    return fuse.search(state.search).map((n) => n.item)
  } else {
    return state.fileList
  }
})

const files = computed(() => {
  return filteredFiles.value
    .filter((f) => {
      // -> Show Folders Filter
      if (f.type === 'folder' && !state.shouldShowFolders) {
        return false
      }
      return true
    })
    .map((f) => {
      switch (f.type) {
        case 'folder': {
          f.icon = fileTypes.folder.icon
          f.caption = t('fileman.folderChildrenCount', { count: f.children }, f.children)
          break
        }
        case 'page': {
          // -> A redirection has a target where a page has content, so it reads as its own kind of row
          f.icon = f.pageType === 'redirect' ? fileTypes.redirect.icon : fileTypes.page.icon
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
  if (!state.currentFileId) {
    return null
  }
  const item = state.fileList.find((f) => f.id === state.currentFileId)
  if (!item || item.type === 'folder') {
    return null
  }

  const items = [
    {
      label: t('fileman.detailsTitle'),
      value: item.title
    }
  ]
  let thumbnail = null
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
        value: formatDateTime(item.updatedAt)
      })
      items.push({
        label: t('fileman.detailsPageCreated'),
        value: formatDateTime(item.createdAt)
      })
      break
    }
    case 'asset': {
      // -> Only images get one, and the endpoint answers 404 for anything else
      thumbnail = item.mimeType?.startsWith('image/') ? `/_thumb/${item.id}.webp` : null
      items.push({
        label: t('fileman.detailsAssetType'),
        value: fileTypes[item.fileExt]
          ? t(`fileman.${item.fileExt}FileType`)
          : t('fileman.unknownFileType', { type: item.fileExt.toUpperCase() })
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
})

// WATCHERS

watch(
  () => state.currentFolderId,
  async (newValue) => {
    await loadTree({ parentId: newValue })
  }
)

// METHODS

function close() {
  siteStore.overlay = null
}

function formatDateTime(value) {
  if (!value) {
    return ''
  }
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toLocaleString(commonStore.locale, { dateStyle: 'medium', timeStyle: 'short' })
}

function insertItem(item) {
  if (!item) {
    item = state.fileList.find((f) => f.id === state.currentFileId)
  }
  EVENT_BUS.emit('insertAsset', toRaw(item))
  close()
}

async function treeLazyLoad(nodeId, isCurrent, { done, fail }) {
  await loadTree({ parentId: nodeId, types: isCurrent ? null : ['folder'] })
  done()
}

async function loadTree({ parentId = null, parentPath = null, types, initLoad = false }) {
  if (state.isFetching) {
    return
  }
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
    const items = await API_CLIENT.get(`sites/${siteStore.id}/tree`, {
      searchParams: {
        ...(parentId ? { parentId } : {}),
        ...(parentPath ? { parentPath } : {}),
        ...(types?.length > 0 ? { types: types.join(',') } : {}),
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
          case 'asset': {
            if (parentId === state.currentFolderId) {
              state.fileList.push({
                id: item.id,
                type: 'asset',
                title: item.title,
                fileExt: item.fileExt,
                fileSize: item.fileSize,
                mimeType: item.mimeType,
                folderPath: item.folderPath,
                fileName: item.fileName,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
              })
            }
            break
          }
          case 'page': {
            if (parentId === state.currentFolderId) {
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
      message: 'Failed to load folder tree.',
      caption: apiErrorMessage(err, 'An unexpected error occured.')
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

function treeContextAction(nodeId, action) {
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

function renameFolder(folderId) {
  dialog({
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

function delFolder(folderId, mustReload = false) {
  dialog({
    component: FolderDeleteDialog,
    componentProps: {
      folderId,
      folderName: state.treeNodes[folderId].title
    }
  }).onOk(() => {
    for (const nodeId in state.treeNodes) {
      if (state.treeNodes[nodeId].children.includes(folderId)) {
        state.treeNodes[nodeId].children = state.treeNodes[nodeId].children.filter(
          (c) => c !== folderId
        )
      }
    }
    delete state.treeNodes[folderId]
    if (state.treeRoots.includes(folderId)) {
      state.treeRoots = state.treeRoots.filter((n) => n !== folderId)
    }
    if (mustReload) {
      loadTree({ parentId: state.currentFolderId })
    }
  })
}

function reloadFolder(folderId) {
  loadTree({ parentId: folderId })
  treeComp.value.resetLoaded()
}

// --------------------------------------
// PAGE METHODS
// --------------------------------------

function rerenderPage(item) {
  dialog({
    component: defineAsyncComponent(() => import('@/components/RerenderPageDialog.vue')),
    componentProps: {
      id: item.id
    }
  })
}

/**
 * Copy a page, through the same dialog the page view's action rail opens.
 *
 * The copy is not written here: what comes back is where it should go, and the store opens the editor
 * on an unsaved page holding the source's content -- so the author lands in the same place they would
 * have from the page itself, and nothing exists until they save it.
 */
function duplicatePage(item) {
  dialog({
    component: defineAsyncComponent(() => import('@/components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'duplicatePage',
      itemId: item.id,
      itemTitle: item.title,
      folderPath: item.folderPath,
      itemFileName: item.fileName
    }
  }).onOk(async (opts) => {
    try {
      await pageStore.pageDuplicate({
        sourcePageId: item.id,
        path: opts.path,
        title: opts.title
      })
      // -> The editor is now underneath this overlay, as it is after opening a page to edit
      close()
    } catch (err) {
      notify({
        type: 'negative',
        message: 'Failed to duplicate page.',
        caption: apiErrorMessage(err, 'An unexpected error occured.')
      })
    }
  })
}

/**
 * Rename a page, move it, or both.
 *
 * One action rather than two, through the same dialog the page view's action rail opens: what it
 * hands back is a title and the full path the page should sit at, and only the path decides which of
 * the two endpoints that is -- a page whose title changed in place was never moved.
 */
function renameMovePage(item) {
  const currentPath = item.folderPath ? `${item.folderPath}/${item.fileName}` : item.fileName
  dialog({
    component: defineAsyncComponent(() => import('@/components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'renamePage',
      itemId: item.id,
      itemTitle: item.title,
      folderPath: item.folderPath,
      itemFileName: item.fileName
    }
  }).onOk(async (opts) => {
    try {
      if (opts.path === currentPath) {
        await pageStore.pageRename({ id: item.id, title: opts.title })
        notify({
          type: 'positive',
          message: 'Page renamed successfully.'
        })
      } else {
        await pageStore.pageMove({ id: item.id, path: opts.path, title: opts.title })
        notify({
          type: 'positive',
          message: 'Page moved successfully.'
        })
      }
      // -> Reload current view
      await loadTree({ parentId: state.currentFolderId })
    } catch (err) {
      notify({
        type: 'negative',
        message: 'Failed to rename or move page.',
        caption: apiErrorMessage(err, 'An unexpected error occured.')
      })
    }
  })
}

function delPage(pageId, pageName) {
  dialog({
    component: defineAsyncComponent(() => import('@/components/PageDeleteDialog.vue')),
    componentProps: {
      pageId,
      pageName
    }
  }).onOk(() => {
    // -> Reload current view
    loadTree({ parentId: state.currentFolderId })
  })
}

// --------------------------------------
// ASSET METHODS
// --------------------------------------

function renameAsset(assetId) {
  dialog({
    component: AssetRenameDialog,
    componentProps: {
      assetId
    }
  }).onOk(async () => {
    // -> Reload current view
    await loadTree({ parentId: state.currentFolderId })
  })
}

function delAsset(assetId, assetName) {
  dialog({
    component: defineAsyncComponent(() => import('@/components/AssetDeleteDialog.vue')),
    componentProps: {
      assetId,
      assetName
    }
  }).onOk(async () => {
    // -> Reload current view
    await loadTree({ parentId: state.currentFolderId })
  })
}

// --------------------------------------
// UPLOAD METHODS
// --------------------------------------

function uploadFile() {
  fileIpt.value.click()
}

async function uploadNewFiles() {
  if (!fileIpt.value.files?.length) {
    return
  }

  state.isUploading = true
  state.shouldCancelUpload = false
  state.uploadPercentage = 0

  state.loading++

  nextTick(() => {
    setTimeout(async () => {
      try {
        const filesToUpload = [...fileIpt.value.files]
        const totalFiles = filesToUpload.length
        let idx = 0
        for (const fileToUpload of filesToUpload) {
          // -> A cancel can only take effect between files: a request already in flight is left to
          //    finish, since the server has the bytes either way
          if (state.shouldCancelUpload) {
            break
          }
          idx++
          state.uploadPercentage = totalFiles > 1 ? Math.round((idx / totalFiles) * 100) : 90
          // -> The body is the file itself rather than a multipart form, and the locale is left to the
          //    server, which uses the site's primary one
          const resp = await API_CLIENT.post(`sites/${siteStore.id}/assets`, {
            searchParams: {
              fileName: fileToUpload.name,
              ...(state.currentFolderId ? { folderId: state.currentFolderId } : {})
            },
            headers: {
              'content-type': fileToUpload.type || 'application/octet-stream'
            },
            body: fileToUpload
          }).json()
          // -> The API client does not throw on 400, so a refused file comes back as a parsed error
          if (resp?.ok === false) {
            throw new Error(resp.message || 'An unexpected error occured.')
          }
        }
        state.uploadPercentage = 100
        loadTree({ parentId: state.currentFolderId })
        if (!state.shouldCancelUpload) {
          notify({
            type: 'positive',
            message: t('fileman.uploadSuccess')
          })
        }
      } catch (err) {
        notify({
          type: 'negative',
          message: 'Failed to upload file.',
          caption: apiErrorMessage(err, 'An unexpected error occured.')
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

function uploadCancel() {
  state.shouldCancelUpload = true
}

// --------------------------------------
// ITEM LIST ACTIONS
// --------------------------------------

function selectItem(item) {
  if (item.type === 'folder') {
    state.currentFolderId = item.id
    treeComp.value.setOpened(item.id)
  } else {
    state.currentFileId = item.id
  }
}

function doubleClickItem(item) {
  if (insertMode.value) {
    insertItem(item)
  } else {
    openItem(item)
  }
}

function openItem(item) {
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

async function copyItemURL(item) {
  try {
    switch (item.type) {
      case 'page': {
        const pagePath = item.folderPath ? `${item.folderPath}/${item.fileName}` : item.fileName
        await navigator.clipboard.writeText(`${window.location.origin}/${pagePath}`)
        break
      }
      case 'asset': {
        // -> Under `/_files/`, which is where a file is served from: the page tree it is listed
        //    alongside in here is not a place a browser can fetch it from
        await navigator.clipboard.writeText(
          `${window.location.origin}${assetUrl(item.folderPath, item.fileName)}`
        )
        break
      }
      default: {
        throw new Error('Invalid Item Type')
      }
    }
    notify({
      type: 'positive',
      message: t('fileman.copyURLSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to copy URL to clipboard.',
      caption: err.message
    })
  }
}

async function editItem(item) {
  router.push(
    item.folderPath ? `/_edit/${item.folderPath}/${item.fileName}` : `/_edit/${item.fileName}`
  )
  close()
}

async function downloadItem(item) {
  try {
    // -> Fetched rather than linked to: the content route is behind the API client, which is what
    //    carries the token
    const blob = await API_CLIENT.get(`sites/${siteStore.id}/assets/${item.id}/content`).blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.fileName
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to download file.',
      caption: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
}

function renameItem(item) {
  switch (item.type) {
    case 'folder': {
      renameFolder(item.id)
      break
    }
    case 'page': {
      renameMovePage(item)
      break
    }
    case 'asset': {
      renameAsset(item.id)
      break
    }
  }
}

/**
 * Duplicating a folder or an asset has no endpoint behind it yet, so those two keep the inert entry
 * they already had rather than being offered something that would fail.
 */
function duplicateItem(item) {
  switch (item.type) {
    case 'page': {
      duplicatePage(item)
      break
    }
  }
}

function delItem(item) {
  switch (item.type) {
    case 'asset': {
      delAsset(item.id, item.title)
      break
    }
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

/**
 * Ctrl+K reaches THIS search field while the overlay is up.
 *
 * HeaderSearch owns the same shortcut and steps aside for an overlay (see the note there), so the two
 * never both answer it. Bound and unbound with the component, which only exists while the overlay is
 * open -- the listener's lifetime is the window in which it should win.
 */
function handleKeyPress(ev) {
  if (ev.ctrlKey && ev.key === 'k') {
    ev.preventDefault()
    searchField.value?.focus()
  }
}

// MOUNTED

onMounted(async () => {
  window.addEventListener('keydown', handleKeyPress)

  const pathParts = pageStore.path.split('/')
  const parentPath = pathParts.slice(0, -1).join('/')

  await loadTree({
    parentPath,
    initLoad: true
  })

  // -> Open tree up to current folder
  const folderFolderPath = pathParts.slice(0, -2).join('/')
  const folderFileName = pathParts.at(-2)

  for (const [id, node] of Object.entries(state.treeNodes)) {
    if (
      parentPath.startsWith(node.folderPath ? `${node.folderPath}/${node.fileName}` : node.fileName)
    ) {
      treeComp.value.setOpened(id)
    }
  }

  // -> Switch to current folder (from page path)
  const currentNode = Object.entries(state.treeNodes).find(
    ([, n]) => n.folderPath === folderFolderPath && n.fileName === folderFileName
  )
  if (currentNode) {
    state.currentFolderId = currentNode[0]
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyPress)
})
</script>

<style lang="scss">
.fileman {
  /*
    The locale button is cut to the same 7px as the search field and Close, where `WBtn`'s flat variant
    is 3px. Unlayered, because an SFC style block is not a Tailwind layer -- which is what lets it beat
    the `rounded-[3px]` utility the component carries, the same way `.w-btn.acrylic-btn` in `_base.scss`
    beats its hover utility. Specificity alone would not do it: both selectors are one class.
  */
  &-locale {
    border-radius: 7px;
  }

  /*
    The search field, following `.header-search-field` in HeaderSearch: 40px tall, dark fill on the
    dark header, inverting to white ink-on-white in use. Stated here rather than borrowing that
    component's class, so a change to the site header cannot silently restyle this overlay -- and the
    two have since parted company on both of the things that tie a control to its surroundings.

    The FILL: HeaderSearch sits on the site header, which is black, so its neutral `#212121` reads as
    a lift out of it. This header is `.card-header` -- `$dark-3` graded towards `$dark-5`, all of them
    blue-tinted -- and a neutral grey on a blue-grey ground reads as a different, muddier colour
    rather than a raised surface. One step up the same ramp, `$dark-2`, is the lift without the clash.

    The CORNERS: 7px, which is `WBtn`'s `push` radius, so the field and the Close button at the other
    end of the header are cut to the same shape. A full pill next to a 7px button read as two
    unrelated controls that happened to share a row.
  */
  &-search {
    display: flex;
    flex: 1 1;
    min-width: 0;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 8px 0 12px;
    border-radius: 7px;
    background-color: $dark-2;
    color: rgba(255, 255, 255, 0.85);
    transition:
      background-color 0.25s var(--ease-standard),
      color 0.25s var(--ease-standard);

    // -> Driven by a class rather than `:focus-within`, matching HeaderSearch
    &.is-focused {
      background-color: #fff;
      color: rgba(0, 0, 0, 0.87);
    }

    &-lead {
      flex-shrink: 0;
      font-size: 20px;
      opacity: 0.7;
    }

    &-input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      outline: none;

      &::placeholder {
        color: currentColor;
        opacity: 0.55;
      }
    }

    &-clear {
      flex-shrink: 0;
      display: inline-flex;
      padding: 4px;
      border-radius: 9999px;
      border: 0;
      background: none;
      color: inherit;
      opacity: 0.6;
      cursor: pointer;

      &:hover {
        opacity: 1;
      }
    }
  }

  /*
    Each pane states its own ink alongside its fill. Nothing above these sets a text color for dark
    mode -- the app has no global `body--dark { color }` rule, and the panes are not `w-card`s, which
    is where that pairing normally lives -- so anything that just inherits (the folder tree's labels,
    a file's title, the size in the right-hand column) came out black on the dark fill.
  */
  &-left {
    @at-root .body--light & {
      background-color: $blue-grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      color: #fff;
    }
  }

  &-center {
    @at-root .body--light & {
      background-color: #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-6;
      color: #fff;
    }
  }

  &-right {
    @at-root .body--light & {
      background-color: $grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
      color: #fff;
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
      opacity: 0.25;
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

    > .w-item {
      padding: 4px 6px;
      border-radius: 8px;

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

    &.is-compact {
      > .w-item {
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
      font-size: 0.7rem;
      font-weight: 500;

      @at-root .body--light & {
        color: $grey-6;
      }
      @at-root .body--dark & {
        color: $blue-grey-4;
      }
    }
    span {
      font-size: 0.85rem;

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
      color: #fff;
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
