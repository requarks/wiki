<template>
  <w-menu class="translucent-menu" auto-close anchor="bottom right" self="top right">
    <w-list padding>
      <!--
        The editors this site writes pages with, in the order the store lists them -- which is where
        the rule lives, so that what can be created here and what a search can be filtered by cannot
        drift apart. Each still carries its own icon and wording: `redirect` makes a redirection
        rather than a page, and both Markdown and Visual say which of the two they open.

        Narrowed by `only` where a caller has a reason to offer fewer -- see the prop.
      -->
      <template v-for="editor of entries" :key="editor">
        <!-- -> Where the editors that write an article end; see `dividedAt` -->
        <w-separator v-if="editor === dividedAt" class="my-2" inset />
        <!-- -> Not an editor: a note is not a page, and opens at a URL of its own -- see `createLiveNote` -->
        <w-item v-if="editor === LIVE_NOTE" clickable @click="createLiveNote">
          <blueprint-icon icon="note" />
          <w-item-section class="pr-2">{{ t('common.createPage.liveNote') }}</w-item-section>
        </w-item>
        <w-item v-else clickable @click="create(editor)">
          <blueprint-icon :icon="EDITOR_ICONS[editor]" />
          <w-item-section class="pr-2">{{ t(`common.createPage.${editor}`) }}</w-item-section>
        </w-item>
      </template>
      <template v-if="props.hideAssetBtn === false && !notesOnly">
        <w-separator class="my-2" inset />
        <w-item clickable @click="openFileManager">
          <blueprint-icon icon="add-image" />
          <w-item-section class="pr-2">{{ t('common.createPage.uploadAsset') }}</w-item-section>
        </w-item>
      </template>
      <template v-if="props.showNewFolder">
        <w-separator class="my-2" inset />
        <w-item clickable @click="newFolder">
          <blueprint-icon icon="add-folder" />
          <w-item-section class="pr-2">{{ t('common.actions.newFolder') }}</w-item-section>
        </w-item>
      </template>
    </w-list>
  </w-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
/*
  The icons, shared with the other two screens that offer editors. WHICH are offered, and in what
  order, is still `siteStore.activeEditors` alone. The wording lives in the locale file as
  `common.createPage.<editor>`, keyed by the same ids, so an editor added to that list needs an icon
  there and a string there.
*/
import { EDITOR_ICONS } from '@/helpers/editors'

import { useEditorStore } from '@/stores/editor'
import { useLiveNoteStore } from '@/stores/liveNote'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/** The menu's one entry that is not an editor, listed among them by this name. */
const LIVE_NOTE = 'liveNote'

/** The editors whose pages list the pages under them, which New Live Note is placed after. */
const LISTING_EDITORS = ['blog', 'feedback']

// PROPS

const props = defineProps({
  hideAssetBtn: {
    type: Boolean,
    default: false
  },
  showNewFolder: {
    type: Boolean,
    default: false
  },
  basePath: {
    type: String,
    default: null
  },
  /**
   * Offer only these editors, where the menu is opened somewhere that not every kind of page makes
   * sense — a blog's New Post button, which wants the editors that write an article and not the ones
   * that write a redirection or a second blog.
   *
   * A filter over `siteStore.activeEditors` rather than a list drawn instead of it, so a site that
   * has switched an editor off still does not see it here. Empty means no restriction, which is what
   * every other caller wants.
   */
  only: {
    type: Array,
    default: () => []
  },
  /**
   * The locale to write the new page in. The page store's current one when absent, which is right
   * from the page view and wrong from the file manager -- there the reader is looking at whichever
   * locale the picker is on, not at the page behind the overlay.
   */
  locale: {
    type: String,
    default: null
  },
  /**
   * Offer New Live Note as well. Only the header's menus do: a note belongs to no folder and no blog,
   * so it has no place in a menu opened on one -- the file manager's, or a blog's New Post.
   */
  offerLiveNote: {
    type: Boolean,
    default: false
  }
})

// EMITS

const emit = defineEmits(['newFolder', 'newPage'])

// STORES

const editorStore = useEditorStore()
const liveNoteStore = useLiveNoteStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// COMPUTED

/**
 * Whether this menu is open to somebody who may create live notes and write no page anywhere: the
 * header's New button is shown to them for the note alone, so the editors and the upload are left out.
 */
const notesOnly = computed(() => props.offerLiveNote && !userStore.can('write:pages'))

/** What this menu actually offers: the site's editors, narrowed by `only` where one was given. */
const offeredEditors = computed(() => {
  if (notesOnly.value) {
    return []
  }
  return props.only.length > 0
    ? siteStore.activeEditors.filter((editor) => props.only.includes(editor))
    : siteStore.activeEditors
})

/**
 * Whether New Live Note is on offer: where the caller asked for it, to somebody who may create notes
 * on this site -- `write:notes`, which the access answer only reports on a site that has live notes
 * (and collaborative editing with them), and never for a guest. The answer is fetched by the header
 * that opens this menu (`HeaderNav`), which shows its button on it.
 */
const offersLiveNote = computed(() => props.offerLiveNote && liveNoteStore.canCreate)

/**
 * Everything the menu lists, in order: the editors on offer, with New Live Note after New Blog and New
 * Feedback Board.
 *
 * Placed by the editors around it rather than by an index, because which of them a site has on is the
 * store's answer: after every article editor, the blog and the board, and ahead of whatever follows
 * them in the store's order -- a redirection, and the experimental editors.
 */
const entries = computed(() => {
  const editors = offeredEditors.value
  if (!offersLiveNote.value) {
    return editors
  }
  const at = editors.findIndex(
    (editor) => !LISTING_EDITORS.includes(editor) && !siteStore.articleEditors.includes(editor)
  )
  return at < 0
    ? [...editors, LIVE_NOTE]
    : [...editors.slice(0, at), LIVE_NOTE, ...editors.slice(at)]
})

/**
 * The editor the divider is drawn above, or null where there is nothing to divide.
 *
 * It separates the editors that put an author in front of a blank article from the ones that write a
 * settings document instead -- a blog, a redirection -- because those are a different kind of thing
 * to be choosing between. `siteStore.articleEditors` is where that partition lives; it is the
 * server's own, and the blog's New Post button is drawn from the same answer.
 *
 * Read off the list rather than fixed at a position, since which editors a site has on is the
 * store's answer and this menu can be narrowed further by `only`. The first offered editor that is
 * not an article editor -- and only when something above it was one, so the divider can never open
 * the menu.
 *
 * Null for a menu that is all of one kind: a blog's New Post button offers article editors and
 * nothing else, and a site with every article editor switched off has nothing above the line.
 */
const dividedAt = computed(() => {
  const offered = entries.value
  // -> A live note is not an article either, so on a site with no blog it is what opens the section
  const first = offered.findIndex((editor) => !siteStore.articleEditors.includes(editor))
  return first > 0 ? offered[first] : null
})

// METHODS

async function create(editor) {
  loading.show()
  emit('newPage')
  await pageStore.pageCreate({ editor, basePath: props.basePath, locale: props.locale })
  loading.hide()
}

/**
 * A new live note, and straight into it.
 *
 * Created by the server rather than at a URL made up here, so that the key is drawn from a
 * cryptographic source and nobody can open a note at an address of their choosing -- the key is the
 * only thing guarding it. See `models/liveNotes.ts`.
 */
async function createLiveNote() {
  loading.show()
  emit('newPage')
  try {
    const key = await liveNoteStore.create()
    await router.push(`/n/${key}`)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('liveNote.createFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    loading.hide()
  }
}

function openFileManager() {
  siteStore.openFileManager()
}

function newFolder() {
  emit('newFolder')
}
</script>
