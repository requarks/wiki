<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="link-picker" style="width: 860px; max-width: 90vw">
      <w-card-section class="card-header">
        <w-icon name="la:link" size="sm" class="mr-2" />
        <span>{{ props.title ?? t('linkPicker.title') }}</span>
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
          <w-tooltip>{{ t(`linkPicker.localeHint`) }}</w-tooltip>
          <locale-selector-menu
            :selected="state.locale"
            :navigate="false"
            anchor="bottom right"
            self="top right"
            @select="switchLocale" />
        </w-btn>
      </w-card-section>
      <!-- -> Inset from the card's edges, as in the icon picker: the strip is a segmented control with
              a track of its own, so it sits ON the card rather than spanning it edge to edge -->
      <w-tabs class="m-2" v-model="state.currentTab" no-caps inline-label>
        <w-tab name="page" icon="la:file-alt" :label="t(`linkPicker.page`)" />
        <w-tab name="url" icon="la:globe" :label="t(`linkPicker.url`)" />
      </w-tabs>
      <w-separator />
      <w-tab-panels v-model="state.currentTab">
        <!-- ----------------------- -->
        <!-- A page of this wiki -->
        <!-- ----------------------- -->
        <w-tab-panel class="p-0" name="page">
          <div class="link-picker-browser flex flex-nowrap">
            <div class="link-picker-tree w-1/3">
              <w-scroll-area style="height: 300px">
                <!-- -> No side padding: the rows carry their own and span the column, as in the File
                        Manager. Padding here would inset the highlight band as well. -->
                <div>
                  <tree
                    ref="treeComp"
                    v-model:selected="state.currentFolderId"
                    :nodes="state.treeNodes"
                    :roots="state.treeRoots"
                    :use-lazy-load="true"
                    :context-action-list="[]"
                    @lazy-load="treeLazyLoad" />
                </div>
              </w-scroll-area>
            </div>
            <div class="w-2/3">
              <w-scroll-area style="height: 300px">
                <w-list class="link-picker-list" dense>
                  <w-item
                    v-for="item of state.items"
                    :key="item.id"
                    clickable
                    active-class="active"
                    :active="item.type === `page` && item.path === state.path"
                    @click="selectItem(item)">
                    <w-item-section side>
                      <w-icon :name="item.icon" size="sm" />
                    </w-item-section>
                    <w-item-section>
                      <w-item-label>{{ item.title }}</w-item-label>
                      <w-item-label caption class="font-robotomono">/{{ item.path }}</w-item-label>
                    </w-item-section>
                  </w-item>
                </w-list>
                <div
                  v-if="state.items.length < 1 && !state.isFetching"
                  class="text-caption text-center p-6 text-black/60 dark:text-white/70">
                  {{ t('linkPicker.emptyFolder') }}
                </div>
              </w-scroll-area>
            </div>
          </div>
        </w-tab-panel>
        <!-- ----------------------- -->
        <!-- Anywhere else -->
        <!-- ----------------------- -->
        <w-tab-panel class="p-4" name="url">
          <w-input
            ref="iptUrl"
            v-model="state.url"
            outlined
            dense
            hide-bottom-space
            :label="t(`linkPicker.linkUrl`)"
            :aria-label="t(`linkPicker.linkUrl`)"
            placeholder="https://example.com/page" />
          <w-checkbox
            v-if="props.newTabOption"
            class="mt-4"
            v-model="state.openInNewTab"
            :label="t(`linkPicker.openInNewTab`)" />
        </w-tab-panel>
      </w-tab-panels>
      <w-separator />
      <!-- -> The same footer the icon picker has: what is about to be committed, spelled out, since
              both tabs can be half-filled and only one of them is the answer -->
      <w-card-section class="flex flex-nowrap items-center py-2">
        <w-icon
          :name="state.currentTab === `page` ? `la:file-alt` : `la:globe`"
          size="sm"
          color="primary" />
        <div class="min-w-0 flex-1 pl-3">
          <div class="text-caption text-grey">{{ t('linkPicker.selection') }}</div>
          <div class="text-body2 font-robotomono link-picker-href">{{ href || '—' }}</div>
        </div>
      </w-card-section>
      <w-separator />
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          icon="la:times"
          :label="t(`common.actions.cancel`)"
          color="grey-7"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          icon="la:check"
          :label="props.okLabel ?? t(`common.actions.insert`)"
          unelevated
          color="primary"
          padding="xs md"
          :disabled="!canSubmit"
          @click="submit" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { apiErrorMessage } from '@/helpers/apiError'
import fileTypes from '@/helpers/fileTypes'
import { splitLocalePath } from '@/helpers/pagePaths'

import LocaleSelectorMenu from '@/components/LocaleSelectorMenu.vue'
import Tree from '@/components/TreeNav.vue'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * Picks a link target: a page of this wiki, or any URL.
 *
 * Written to be opened from anywhere that needs one — the markdown editor's Insert Link, the target of
 * a page relation — so it decides nothing about what the link is FOR. It answers with
 * `{ href, openInNewTab, title }` and leaves the caller to render that as markdown, store it on a
 * relation, or whatever else.
 *
 *   dialog({ component: LinkPickerDialog }).onOk(({ href }) => ...)
 */

// PROPS

const props = defineProps({
  /** Card heading. The insert-a-link wording by default. */
  title: {
    type: String,
    default: null
  },
  /** Label on the confirm button, for a caller that is selecting rather than inserting. */
  okLabel: {
    type: String,
    default: null
  },
  /** An href to open on, so re-opening the picker starts where the last choice left it. */
  initialHref: {
    type: String,
    default: ''
  },
  /**
   * Whether the URL tab offers "open in a new tab". Off for a caller with nowhere to put the answer —
   * a control whose effect is discarded is worse than no control.
   */
  newTabOption: {
    type: Boolean,
    default: true
  },
  /**
   * The locale to browse, and the one a chosen page's link is prefixed for. The page the picker was
   * opened from by default, which is what every caller is editing — its content, its relations, its
   * redirect target, its sidebar.
   */
  locale: {
    type: String,
    default: null
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// REFS

const treeComp = ref(null)
const iptUrl = ref(null)

// DATA

const state = reactive({
  currentTab: 'page',
  /*
    Which locale's pages are listed, and what a chosen one's link is prefixed for. The tree holds
    every translation side by side, so unfiltered this listed all of them at once and linked to
    whichever page of that name the PRIMARY locale had.
  */
  locale: props.locale || pageStore.locale,
  /** Folder whose contents the right-hand pane lists. Null is the site root. */
  currentFolderId: null,
  treeNodes: {},
  treeRoots: [],
  items: [],
  /** The chosen page, as a slash path with no leading slash. Only a row in the list sets it. */
  path: '',
  /** Title of the page the path came from, which a caller can use as the link's text. */
  pageTitle: '',
  isFetching: false,
  url: 'https://',
  openInNewTab: false
})

// COMPUTED

const href = computed(() => {
  if (state.currentTab !== 'page') {
    return state.url.trim()
  }
  // -> Prefixed for the locale being browsed: an unprefixed path addresses the PRIMARY locale's page
  //    of that name, which for a link picked out of the French tree is a different page or none
  return state.path ? `${siteStore.localeUrlPrefix(state.locale)}/${state.path}` : ''
})

const canSubmit = computed(() => {
  if (state.currentTab === 'page') {
    return state.path.length > 0
  }
  // -> The scheme alone is what the field is prefilled with, so it does not count as an answer
  return href.value.length > 0 && !/^[a-z][a-z0-9+.-]*:\/*$/i.test(href.value)
})

// WATCHERS

watch(
  () => state.currentFolderId,
  (folderId) => loadTree({ parentId: folderId })
)

// METHODS

/**
 * Browse another locale.
 *
 * Back to its root, and the chosen page is dropped with it: the tree being left and the one being
 * entered share no ids, and a path picked out of one names a different page — or none — in the other.
 */
async function switchLocale(locale) {
  if (locale === state.locale) {
    return
  }
  state.locale = locale
  state.treeNodes = {}
  state.treeRoots = []
  state.currentFolderId = null
  state.items = []
  state.path = ''
  state.pageTitle = ''
  treeComp.value?.resetLoaded()
  await loadTree({ initLoad: true })
}

/**
 * Loads one folder into the tree, and — when that folder is the selected one — into the list beside it.
 *
 * `initLoad` also asks for the folders above the one being listed, so that opening on a page buried a
 * few levels down draws its whole branch from a single request. Those extra entries come back flagged
 * `isAncestor` and belong in the tree only, never in the list.
 */
async function loadTree({ parentId = null, parentPath = null, initLoad = false }) {
  if (state.isFetching) {
    return
  }
  state.isFetching = true
  const isCurrentFolder = (parentId ?? null) === state.currentFolderId
  if (isCurrentFolder) {
    state.items = []
  }
  try {
    const entries = await API_CLIENT.get(`sites/${siteStore.id}/tree`, {
      searchParams: {
        locale: state.locale,
        ...(parentId ? { parentId } : {}),
        ...(parentPath ? { parentPath } : {}),
        types: 'folder,page',
        includeAncestors: initLoad,
        includeRootFolders: initLoad
      }
    }).json()
    for (const entry of entries ?? []) {
      const path = entry.folderPath ? `${entry.folderPath}/${entry.fileName}` : entry.fileName
      if (entry.type === 'folder') {
        state.treeNodes[entry.id] = {
          folderPath: entry.folderPath,
          fileName: entry.fileName,
          title: entry.title,
          children: state.treeNodes[entry.id]?.children ?? []
        }
        if (entry.folderPath) {
          const parentOfEntry = parentId ?? findFolderIdByPath(entry.folderPath)
          if (
            entry.id !== parentOfEntry &&
            !state.treeNodes[parentOfEntry]?.children?.includes(entry.id)
          ) {
            state.treeNodes[parentOfEntry]?.children?.push(entry.id)
          }
        } else if (!state.treeRoots.includes(entry.id)) {
          state.treeRoots.push(entry.id)
        }
      }
      // -> An ancestor is drawn in the tree to give the branch its shape; it is not IN this folder
      if (isCurrentFolder && !entry.isAncestor) {
        state.items.push({
          id: entry.id,
          type: entry.type,
          title: entry.title,
          path,
          icon: entry.type === 'folder' ? fileTypes.folder.icon : fileTypes.page.icon
        })
      }
    }
    // -> Folders first, as the File Manager lists them, then by what they are called
    state.items.sort((a, b) =>
      a.type === b.type ? a.title.localeCompare(b.title) : a.type === 'folder' ? -1 : 1
    )
  } catch (err) {
    notify({
      type: 'negative',
      message: t('linkPicker.loadFailed'),
      caption: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  if (parentId) {
    treeComp.value?.setLoaded(parentId)
  }
  state.isFetching = false
}

function treeLazyLoad(nodeId, isCurrent, { done }) {
  loadTree({ parentId: nodeId }).then(done)
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

/** A folder is somewhere to look; a page is the answer. */
function selectItem(item) {
  if (item.type === 'folder') {
    state.currentFolderId = item.id
    treeComp.value?.setOpened(item.id)
    return
  }
  state.path = item.path
  state.pageTitle = item.title
}

function submit() {
  onDialogOK({
    href: href.value,
    /*
      Which tab answered, so a caller that stores the two kinds differently does not have to work it
      out from the string afterwards. It cannot be worked out reliably: `/help` is a page of this wiki
      and a perfectly good relative URL elsewhere. This is the choice somebody made.
    */
    kind: state.currentTab,
    // -> Only ever true for a URL: a page of this wiki opens in the tab the reader is already in
    openInNewTab: state.currentTab === 'url' && props.newTabOption && state.openInNewTab,
    title: state.currentTab === 'page' ? state.pageTitle : ''
  })
}

// MOUNTED

onMounted(async () => {
  /*
    An href that is already set decides which tab opens and what it starts on, so re-opening the picker
    on a link that exists starts from that link rather than from nothing. A page shows up as the
    highlighted row once its folder is listed, and in the footer either way.
  */
  if (props.initialHref) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(props.initialHref) || props.initialHref.startsWith('//')) {
      state.currentTab = 'url'
      state.url = props.initialHref
    } else {
      /*
        Re-opening on a link that already carries a prefix: the locale comes off it, so the picker
        starts in the tree the link points into rather than in the page's own.
      */
      const split = splitLocalePath(props.initialHref, siteStore.localePrefixes)
      if (split) {
        state.locale = split.locale
      }
      state.path = (split?.path ?? props.initialHref).replace(/^\/+/, '')
    }
  }

  // -> Opens on the folder holding the page being edited, which is where a link is most often going
  const startFolder = pageStore.folderPath
  await loadTree({ parentPath: startFolder, initLoad: true })
  const startFolderId = findFolderIdByPath(startFolder)
  if (startFolderId) {
    const parts = startFolder.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const ancestorId = findFolderIdByPath(parts.slice(0, i).join('/'))
      if (ancestorId) {
        treeComp.value?.setOpened(ancestorId)
      }
    }
    state.currentFolderId = startFolderId
  } else {
    // -> Already at the root, which the watcher above will not fire for
    await loadTree({})
  }

  if (state.currentTab === 'url') {
    await nextTick()
    iptUrl.value?.focus()
  }
})
</script>

<style lang="scss">
.link-picker {
  &-browser {
    height: 300px;
    max-height: 90vh;
  }

  /* -> The tree column carries the recessed surface, as it does in the File Manager */
  &-tree {
    height: 300px;

    @at-root .body--light & {
      background-color: $blue-grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
    }
  }

  &-list {
    padding: 8px 12px;

    > .w-item {
      padding: 4px 6px;
      border-radius: 4px;

      &.active {
        background-color: var(--color-primary);
        color: #fff;

        .w-item-label--caption {
          color: rgba(255, 255, 255, 0.7);
        }
      }
    }
  }

  &-href {
    overflow-wrap: anywhere;
  }
}
</style>
