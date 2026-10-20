<template>
  <w-page class="flex flex-col h-full min-h-0">
    <!--
      The bar above the editor, in the page header's own chrome (`.page-header` in `_page-chrome.scss`)
      so that it is the height the editor's stylesheet subtracts for one. What it holds is what a note
      has instead of a page's header: a title read off the note's first heading rather than a field,
      who else is writing, and the note's history. No Save -- the room stores the note as it is typed.
    -->
    <div
      v-if="state.status === `ready`"
      class="page-header flex flex-nowrap"
      :lang="commonStore.locale"
      :dir="siteStore.localeDir(commonStore.locale)">
      <div class="flex-none ps-4 flex items-center">
        <w-icon name="img:/_assets/icons/blueprint-note.svg" :size="iconSize" />
      </div>
      <div class="min-w-0 flex-1 flex flex-col justify-center p-2 sm:p-4">
        <!--
          The note's title, edited where it sits as a page's is in its header -- and written into the
          note as its opening H1, which is all a note's title is. See `setNoteTitle` in the editor.

          Editable once the room has answered and not before: until then the editor is holding no
          document, and an H1 written into it would be replaced by the note the moment one arrived.

          The text is not interpolated, for the reason the page header's is not: Vue would rewrite the
          text node on every keystroke as the store echoes it back, putting the caret at its start.
          `syncTitle` writes it instead.
        -->
        <div class="text-h4 page-header-title truncate">
          <span
            ref="titleEl"
            class="note-title-editable"
            :class="{ 'is-empty': !state.titleText, 'is-editable': titleEditable }"
            :contenteditable="titleEditable ? `plaintext-only` : `false`"
            role="textbox"
            aria-multiline="false"
            :aria-label="t(`liveNote.titleLabel`)"
            :data-placeholder="t(`liveNote.untitled`)"
            @input="onTitleInput"
            @blur="onTitleBlur"
            @keydown.enter.prevent="$event.target.blur()"
            @keydown.esc.prevent="$event.target.blur()" />
        </div>
        <!-- -> Caption type rather than the subtitle's: this is a status line, not a description -->
        <div class="text-caption page-header-subtitle truncate">
          {{ editedLabel }}
        </div>
      </div>
      <!--
        Editor or Reader, in a notch hanging from the site header above: the one switch that is about
        the whole screen rather than about the note, so it sits apart from the actions, centered.

        Laid over the top of the bar rather than in a column of its own, so that it takes no width
        from the title and the line under it. A title long enough to reach the middle of the bar runs
        under it rather than being cut short where it starts.

        Only for somebody who may write in the note, and not on a phone: see `canSwitchMode`.
      -->
      <div v-if="canSwitchMode" class="note-mode-slot">
        <div class="note-mode-notch">
          <w-tabs
            :model-value="mode"
            no-caps
            inline-label
            dense
            dark
            :aria-label="t(`liveNote.mode.title`)"
            @update:model-value="setMode">
            <!-- -> Icons alone below 900px, where a title is likelier to reach the middle of the bar
                    and a narrower notch covers less of it; the name is then the tab's accessible name
                    and its tooltip -->
            <w-tab
              name="editor"
              icon="la:pen"
              :label="isAtLeast900 ? t(`liveNote.mode.editor`) : null"
              :aria-label="t(`liveNote.mode.editor`)">
              <w-tooltip v-if="!isAtLeast900">{{ t('liveNote.mode.editor') }}</w-tooltip>
            </w-tab>
            <w-tab
              name="reader"
              icon="la:book-open"
              :label="isAtLeast900 ? t(`liveNote.mode.reader`) : null"
              :aria-label="t(`liveNote.mode.reader`)">
              <w-tooltip v-if="!isAtLeast900">{{ t('liveNote.mode.reader') }}</w-tooltip>
            </w-tab>
          </w-tabs>
        </div>
      </div>
      <div class="page-header-actions flex-none p-4 flex items-center justify-end">
        <!--
          Only while the room is not answering. Live is the ordinary state and says nothing; anything
          else matters, since a note that is not connected is a note that is not being stored.
        -->
        <w-badge
          v-if="statusLabel"
          class="me-3"
          :color="collabStore.status === `connecting` ? `grey-7` : `negative`"
          :label="statusLabel" />
        <!--
          What this note is to whoever is looking: View Only to a reader of a locked note, and to its
          owners whether they have locked it or made it private -- neither of which an owner would
          otherwise see, since they can still do everything.
        -->
        <w-badge v-else-if="accessLabel" class="me-3" color="grey-7" :label="accessLabel" />
        <!--
          Below 900px the menu stands alone, so that the title keeps the width: who else is in the note
          and copying its link (which the address bar does as well) are left out, and Publish to Page
          goes into the menu.
        -->
        <template v-if="isAtLeast900">
          <collab-presence class="me-2" show-alone />
          <w-btn
            class="ms-2 acrylic-btn"
            flat
            icon="la:link"
            color="emerald-600"
            :aria-label="t(`liveNote.copyLink`)"
            @click="copyLink">
            <w-tooltip>{{ t('liveNote.copyLink') }}</w-tooltip>
          </w-btn>
          <!-- -> Once the room has answered: until then there is no text to publish -->
          <w-btn
            v-if="canPublish"
            class="ms-2 acrylic-btn"
            flat
            icon="la:file-export"
            color="blue"
            :disabled="!collabStore.hasSynced"
            :aria-label="t(`liveNote.publish.title`)"
            @click="publishToPage">
            <w-tooltip>{{ t('liveNote.publish.title') }}</w-tooltip>
          </w-btn>
        </template>
        <w-btn
          class="ms-2 acrylic-btn"
          flat
          icon="la:ellipsis-v"
          :color="dark.isActive ? `indigo-4` : `indigo`"
          :aria-label="t(`liveNote.menu`)">
          <w-tooltip>{{ t('liveNote.menu') }}</w-tooltip>
          <!-- -> `!min-w-0 !pr-2` and literal colour classes, as the page history's version menu has them -->
          <w-menu class="translucent-menu" auto-close anchor="bottom right" self="top right">
            <w-list dense padding style="min-width: 200px">
              <!-- -> The bar's button, below 900px where the bar has no room for it -->
              <template v-if="!isAtLeast900 && canPublish">
                <w-item clickable :disabled="!collabStore.hasSynced" @click="publishToPage">
                  <w-item-section avatar class="!min-w-0 !pr-2">
                    <w-icon name="la:file-export" class="text-blue-7" />
                  </w-item-section>
                  <w-item-section>{{ t('liveNote.publish.title') }}</w-item-section>
                </w-item>
                <w-separator class="my-1" />
              </template>
              <w-item clickable @click="openRevisions">
                <w-item-section avatar class="!min-w-0 !pr-2">
                  <w-icon name="la:history" class="text-blue-7" />
                </w-item-section>
                <w-item-section>{{ t('liveNote.revisions') }}</w-item-section>
              </w-item>
              <w-item clickable @click="download">
                <w-item-section avatar class="!min-w-0 !pr-2">
                  <w-icon name="la:download" class="text-blue-7" />
                </w-item-section>
                <w-item-section>{{ t('liveNote.download') }}</w-item-section>
              </w-item>
              <!-- -> Both the owners' alone -- the creator and `manage:system`; the server asks the same -->
              <template v-if="liveNoteStore.canManage">
                <w-separator class="my-1" />
                <w-item clickable @click="changeAccess">
                  <w-item-section avatar class="!min-w-0 !pr-2">
                    <w-icon name="la:user-lock" class="text-blue-7" />
                  </w-item-section>
                  <w-item-section>{{ t('liveNote.access.title') }}</w-item-section>
                </w-item>
                <w-separator class="my-1" />
                <w-item clickable @click="deleteNote">
                  <w-item-section avatar class="!min-w-0 !pr-2">
                    <w-icon name="la:trash" class="text-negative" />
                  </w-item-section>
                  <w-item-section class="text-negative">{{ t('liveNote.delete') }}</w-item-section>
                </w-item>
              </template>
            </w-list>
          </w-menu>
        </w-btn>
      </div>
    </div>
    <!-- -> Keyed by the note, so that following a link from one note to another is a new editor
            rather than the old note's model bound to the new note's room -- and by which view, since
            two branches of one `v-if` may not share a key -->
    <editor-markdown
      v-if="state.status === `ready` && mode === `editor`"
      :key="`editor:${liveNoteStore.key}`"
      :note-key="liveNoteStore.key" />
    <live-note-reader v-else-if="state.status === `ready`" :key="`reader:${liveNoteStore.key}`" />
    <div v-else-if="state.status === `loading`" class="page-placeholder">
      <w-spinner color="primary" size="48px" />
    </div>
    <!-- -> Every way of not getting to the note: the same shape as the page view's missing-page screen -->
    <div v-else class="page-placeholder">
      <w-icon class="page-placeholder-icon" name="la:sticky-note" />
      <div class="text-h6">{{ placeholder.title }}</div>
      <div class="text-body2 mt-1 opacity-60">{{ placeholder.hint }}</div>
      <w-btn
        v-if="state.status === `signin`"
        class="mt-6"
        unelevated
        icon="la:sign-in-alt"
        color="primary"
        padding="xs lg"
        :label="t(`common.actions.login`)"
        :to="loginLocation(route.fullPath)" />
      <w-btn
        v-else
        class="mt-6"
        outline
        icon="la:arrow-left"
        color="primary"
        padding="xs lg"
        :label="t(`common.newpage.goback`)"
        @click="close" />
    </div>
  </w-page>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { fileSave } from 'browser-fs-access'

import { isCollabActive, startCollabSession, stopCollabSession } from '@/composables/collab'
import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { confirm, dialog } from '@/composables/dialog'
import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'
import { useMinWidth } from '@/composables/screen'
import { apiErrorMessage } from '@/helpers/apiError'
import { assetPath, pastedAssetFolder } from '@/helpers/assets'
import { copyToClipboard } from '@/helpers/clipboard'
import { relativeDate } from '@/helpers/datetime'
import { loginLocation } from '@/helpers/loginRedirect'

import CollabPresence from '@/components/CollabPresence.vue'
import LiveNoteAccessDialog from '@/components/LiveNoteAccessDialog.vue'
import LiveNotePublishDialog from '@/components/LiveNotePublishDialog.vue'
import LiveNoteReader from '@/components/LiveNoteReader.vue'
import LoadingGeneric from '@/components/LoadingGeneric.vue'
import { MarkdownRenderer } from '@/renderers/markdown'

import { useCollabStore } from '@/stores/collab'
import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { NOTE_KEY_PATTERN, useLiveNoteStore } from '@/stores/liveNote'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * A live note, at `/n/<key>`: the Markdown editor on a document that whoever holds the URL is writing
 * in at the same time, and that stores itself as it changes. `/n` alone creates one and replaces
 * itself with its URL. Opening one takes `read:notes` -- which a guest may hold, and then only ever
 * reads -- and writing in one or creating one `write:notes`.
 *
 * Everything that makes it a note rather than a page is somewhere else. The server's half is
 * `models/liveNotes.ts` and the note room in `core/collab.ts`; the editor's is its `noteKey` prop.
 * This view decides whether there is a note to show, draws the bar above it, and holds the note's
 * collaboration session open while it is on screen.
 *
 * Shown in one of two modes: the Editor, or the Reader (`LiveNoteReader.vue`) -- the render alone,
 * following the room live. `?mode=reader` in the URL is which one, so that a reload keeps it and a link
 * can open straight into it. A reader of a locked note, who may not write in it, gets the Reader and
 * no choice, and so does everybody on a phone.
 */

// COMPONENTS

// -> The editor carries Monaco, which nothing else on this screen needs before the note is found
const EditorMarkdown = defineAsyncComponent({
  loader: () => import('@/components/EditorMarkdown.vue'),
  loadingComponent: LoadingGeneric
})

// STORES

const collabStore = useCollabStore()
const commonStore = useCommonStore()
const editorStore = useEditorStore()
const liveNoteStore = useLiveNoteStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// DARK MODE

const dark = useDark()

// ROUTER

const route = useRoute()
const router = useRouter()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  /**
   * - `loading` — asking whether the note exists, or creating one
   * - `ready` — it does, and the editor is up
   * - `signin` — this reader is a guest, and guests may not do what was asked here
   * - `disabled` — the site does not have live notes
   * - `forbidden` — this account may not open live notes here (`read:notes`)
   * - `nocreate` — this account may not create live notes here (`write:notes`)
   * - `notfound` — no note has this key, and none is to be created under it
   * - `invalidkey` — the URL holds something no note could be called
   * - `private` — the note is private, and this reader is not one of its owners
   * - `createfailed` — `/n` could not create a note; `errorMessage` says why
   * - `error` — anything else; `errorMessage` says what
   */
  status: 'loading',
  errorMessage: '',
  /** What the title field holds right now, which is what decides whether it shows its placeholder. */
  titleText: ''
})

const titleEl = ref(null)

/**
 * Whether the title has been typed into since the field took focus. Leaving it untouched writes
 * nothing: on a note whose title is an H2 further down, a blur that wrote anyway would insert an H1
 * nobody asked for.
 */
let titleEdited = false

/** Set while this reader is deleting the note, so that its room closing on them is not news to them. */
let deleting = false

/** Guards against a slow answer for a note the reader has already left. */
let loadToken = 0

/**
 * The time the "5 minutes ago" line is measured against, moved on every half minute so that the line
 * ages while nobody types. Its own clock rather than `Temporal.Now` read in place, which a computed
 * would read once and never again.
 */
const now = ref(Temporal.Now.instant())
const clockTimer = setInterval(() => {
  now.value = Temporal.Now.instant()
}, 30 * 1000)

/** Under this, "just now": the seconds would be stale by up to a tick of the clock above anyway. */
const JUST_NOW_SECONDS = 60

// META

useMeta(() => ({
  title:
    state.status === 'ready' ? liveNoteStore.title || t('liveNote.untitled') : t('liveNote.title')
}))

// COMPUTED

const isAtLeastSm = useMinWidth(600)
const isPhoneViewport = computed(() => !isAtLeastSm.value)
const iconSize = computed(() => (isPhoneViewport.value ? '32px' : '64px'))
/**
 * Where the bar starts giving things up for the title: the names on the Editor / Reader tabs, which
 * keep their icons, and everything beside the menu -- the avatars, Copy Link, and Publish to Page,
 * which moves into the menu.
 */
const isAtLeast900 = useMinWidth(900)

/**
 * "Created by John Doe. Last edited 5 minutes ago by Jane Doe." -- or, for a note nobody has typed into
 * yet, who created it and when. Follows the note live: `markEdited` in the live note store moves it as
 * edits arrive.
 */
const editedLabel = computed(() => {
  const edited = Boolean(liveNoteStore.lastEditor)
  const at = edited ? liveNoteStore.updatedAt : liveNoteStore.createdAt
  const seconds = at ? Temporal.Instant.from(at).until(now.value).total('seconds') : 0
  const when = seconds < JUST_NOW_SECONDS ? t('liveNote.justNow') : relativeDate(at)
  const creator = liveNoteStore.creator?.name || t('liveNote.deletedUser')
  if (!edited) {
    return t('liveNote.created', { when, name: creator })
  }
  const name = liveNoteStore.lastEditor.name || t('liveNote.deletedUser')
  return t('liveNote.lastEdited', { when, name, creator })
})

/**
 * Whether this reader has the Editor to switch to: anybody who may write in the note -- except on a
 * phone, where the note is only ever read. A two-pane code editor has no room there, and a window
 * narrowed past this width while in the Editor lands in the Reader, the URL left as it was so that
 * widening it again goes back.
 */
const canSwitchMode = computed(() => liveNoteStore.canWrite && !isPhoneViewport.value)

/**
 * Whether Publish to Page is offered: to anybody signed in. A guest could read the note but never
 * create the page -- the guests group may not be granted `write:pages`.
 */
const canPublish = computed(() => userStore.authenticated)

/** `editor` or `reader`. Read off the URL, and always the Reader for somebody who may only read. */
const mode = computed(() =>
  canSwitchMode.value && route.query.mode !== 'reader' ? 'editor' : 'reader'
)

/**
 * The title is a field once the room has answered, for whoever may write in the note -- and in the
 * Editor only: the Reader is for reading, and the title is written through the editor besides (see
 * `setNoteTitle` there).
 */
const titleEditable = computed(
  () => collabStore.hasSynced && liveNoteStore.canWrite && mode.value === 'editor'
)

const accessLabel = computed(() => {
  if (!liveNoteStore.canWrite) {
    return t('liveNote.access.viewOnly')
  }
  switch (liveNoteStore.access) {
    case 'locked':
      return t('liveNote.access.locked')
    case 'private':
      return t('liveNote.access.private')
    default:
      return ''
  }
})

const statusLabel = computed(() => {
  switch (collabStore.status) {
    case 'connecting':
      return t('liveNote.status.connecting')
    case 'disconnected':
      return t('liveNote.status.disconnected')
    case 'denied':
      return t('liveNote.status.denied')
    default:
      return ''
  }
})

const placeholder = computed(() => {
  switch (state.status) {
    case 'signin':
      return { title: t('liveNote.signInRequired'), hint: t('liveNote.signInRequiredHint') }
    case 'disabled':
      return { title: t('liveNote.disabled'), hint: t('liveNote.disabledHint') }
    case 'forbidden':
      return { title: t('liveNote.forbidden'), hint: t('liveNote.forbiddenHint') }
    case 'nocreate':
      return { title: t('liveNote.noCreate'), hint: t('liveNote.noCreateHint') }
    case 'notfound':
      return { title: t('liveNote.notFound'), hint: t('liveNote.notFoundHint') }
    case 'invalidkey':
      return { title: t('liveNote.invalidKey'), hint: t('liveNote.invalidKeyHint') }
    case 'private':
      return { title: t('liveNote.privateTitle'), hint: t('liveNote.privateHint') }
    case 'createfailed':
      return { title: t('liveNote.createFailedTitle'), hint: state.errorMessage }
    default:
      return { title: t('liveNote.loadFailed'), hint: state.errorMessage }
  }
})

// WATCHERS

/*
  The note's title into the field, as somebody else's edit or the room's first answer brings it -- but
  not while this reader is typing in the field. What they type comes back as the title half a second
  later, normalized (`noteTitleOf` trims it), and writing that over the field would move the caret. The
  field catches up when it loses focus instead.

  On the content as well as the title, because the title can settle while the field has focus and then
  not change again: cleared, the H1 stops counting as one at once and the title is already the next
  heading by the time leaving the field removes the line -- so only the text changes after that.
*/
watch(
  () => [liveNoteStore.title, liveNoteStore.content, state.status],
  async () => {
    await nextTick()
    if (titleEl.value && document.activeElement !== titleEl.value) {
      syncTitle(liveNoteStore.title)
    }
  }
)

/*
  On the path rather than on the key alone: the route changing to somewhere else entirely also leaves
  the key empty, a moment before this view is unmounted, and that must not read as `/n` -- it would
  create a note on the way out.
*/
watch(
  () => route.path,
  () => {
    if (!/^\/n(\/|$)/.test(route.path)) {
      return
    }
    if (route.params.noteKey) {
      load(route.params.noteKey, { createIfMissing: true })
    } else {
      create()
    }
  },
  { immediate: true }
)

/*
  The note's collaboration session, held here rather than by the editor: the Reader needs it as much,
  and switching between the two must not be a reconnect. Opened as the note is ready -- before either
  view mounts, this watcher running ahead of the render -- and closed as it stops being, which is also
  what a reload after a refusal goes through, and following a link to another note.
*/
watch(
  () => (state.status === 'ready' ? liveNoteStore.key : ''),
  (key) => {
    if (key) {
      startCollabSession({ siteId: siteStore.id, noteKey: key })
    } else if (isCollabActive()) {
      stopCollabSession()
    }
  }
)

/*
  The room refusing this reader for good -- the note deleted under them, live notes switched off, the
  session ended. Which one it was is the note's own route's answer, so the note is asked for again and
  the screen says whatever it finds in place of an editor that has nothing left to write to.
*/
watch(
  () => collabStore.status,
  (status) => {
    if (status === 'denied' && state.status === 'ready' && !deleting && route.params.noteKey) {
      load(route.params.noteKey)
    }
  }
)

// METHODS

/** Into the Editor or the Reader. Replaced rather than pushed: Back leaves the note, as it always did. */
function setMode(next) {
  const query = { ...route.query }
  if (next === 'reader') {
    query.mode = 'reader'
  } else {
    delete query.mode
  }
  router.replace({ path: route.path, query, hash: route.hash })
}

/**
 * Whether the site has live notes, saying so when it does not. Whether this reader may read them is
 * the note's own route's answer -- a guest may, where the guests group holds `read:notes` -- so it is
 * left to that.
 */
function siteHasNotes() {
  if (!siteStore.features.liveNotes || !siteStore.features.collaborativeEditing) {
    state.status = 'disabled'
    return false
  }
  return true
}

/**
 * Whether this reader may create a note here, saying why not when they may not: signed in, with
 * `write:notes`. The server asks the same; asked here first so that the screen can say which it is
 * without a round trip.
 */
async function mayCreateNotes() {
  if (!siteHasNotes()) {
    return false
  }
  if (!userStore.authenticated) {
    state.status = 'signin'
    return false
  }
  await liveNoteStore.ensureAccess()
  if (!liveNoteStore.canCreate) {
    state.status = 'nocreate'
    return false
  }
  return true
}

/**
 * `/n` with no key: a new note, and this URL replaced by its own.
 *
 * Replaced rather than pushed, which is the whole of what keeps this from making a second note: with
 * `/n` left in the history, Back from the note would arrive here again and create another one. Signing
 * in from here comes back to `/n` (`loginLocation`), which is what it was asked for.
 */
async function create() {
  const token = ++loadToken
  liveNoteStore.close()
  state.status = 'loading'
  if (!(await mayCreateNotes())) {
    return
  }
  if (token !== loadToken) {
    return
  }
  try {
    const key = await liveNoteStore.create()
    if (token === loadToken) {
      await router.replace({ path: `/n/${key}`, hash: route.hash })
    }
  } catch (err) {
    if (token === loadToken) {
      showCreateFailure(err)
    }
  }
}

/**
 * `/n/<key>` for a key no note on the site has yet: a new note under it, the way HedgeDoc's free URLs
 * work. Somebody else creating it first (409) is no failure -- it is the note they both meant, and it
 * is joined like any other.
 */
async function createUnder(key, token) {
  try {
    await liveNoteStore.create(key)
  } catch (err) {
    if (token !== loadToken) {
      return
    }
    if (err?.response?.status !== 409) {
      showCreateFailure(err)
      return
    }
  }
  if (token === loadToken) {
    await load(key)
  }
}

function showCreateFailure(err) {
  switch (err?.response?.status) {
    case 401:
      state.status = 'signin'
      break
    case 403:
      state.status = refusalStatus(err)
      break
    default:
      state.status = 'createfailed'
      state.errorMessage = apiErrorMessage(err)
  }
}

/**
 * What a 403 from the notes API is: each refusal about the reader has a code of its own, and any other
 * 403 is notes being switched off.
 */
function refusalStatus(err) {
  switch (err?.data?.error) {
    case 'notePrivate':
      return 'private'
    case 'notesForbidden':
      return 'forbidden'
    case 'noteWriteForbidden':
      return 'nocreate'
    default:
      return 'disabled'
  }
}

/**
 * Open the note behind a key.
 *
 * `createIfMissing` is for the key the reader navigated to, which creates the note when there is none
 * -- and only for that. A note deleted while somebody is in it is reloaded without it, so that they are
 * told it is gone rather than handed an empty one of the same name.
 */
async function load(key, { createIfMissing = false } = {}) {
  const token = ++loadToken
  liveNoteStore.close()
  state.status = 'loading'
  if (!siteHasNotes()) {
    return
  }
  if (!NOTE_KEY_PATTERN.test(key)) {
    state.status = 'invalidkey'
    return
  }
  try {
    // -> The editor reads the site's markdown settings off the editor store as it mounts
    await Promise.all([
      editorStore.configIsLoaded ? null : editorStore.fetchConfigs(),
      liveNoteStore.load(key)
    ])
    if (token === loadToken) {
      state.status = 'ready'
    }
  } catch (err) {
    if (token !== loadToken) {
      return
    }
    switch (err?.response?.status) {
      case 401:
        state.status = 'signin'
        break
      case 403:
        state.status = refusalStatus(err)
        break
      case 404:
        // -> Only for somebody who may create one: anybody else is told there is no such note
        if (createIfMissing) {
          await liveNoteStore.ensureAccess()
        }
        if (token !== loadToken) {
          return
        }
        if (createIfMissing && liveNoteStore.canCreate) {
          await createUnder(key, token)
        } else {
          state.status = 'notfound'
        }
        break
      default:
        state.status = 'error'
        state.errorMessage = apiErrorMessage(err)
    }
  }
}

/**
 * The note's URL, which is the whole of sharing it: whoever has it and may use live notes here can
 * read it, and write in it as far as its access and their `write:notes` allow.
 */
async function copyLink() {
  try {
    await copyToClipboard(window.location.href.split('#')[0])
    notify({ type: 'positive', message: t('liveNote.linkCopied') })
  } catch (err) {
    notify({ type: 'negative', message: t('liveNote.linkCopyFailed'), caption: err.message })
  }
}

/**
 * The note as a markdown file, named for its title -- or `live-note.md` for one with no heading yet.
 *
 * What the editor holds, which is the note as the room has it: the same text everyone else in it is
 * looking at, rather than what was last stored.
 */
async function download() {
  const name =
    liveNoteStore.title
      // -> Without what Windows, macOS or Linux refuse in a file name; the rest of a title is fine as it is
      // oxlint-disable-next-line no-control-regex -- matching control characters is the point
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'live-note'
  try {
    // -> A bare MIME type: the save picker refuses one with parameters. See `saveVersionSource`
    await fileSave(new Blob([liveNoteStore.content], { type: 'text/markdown' }), {
      fileName: `${name}.md`,
      extensions: ['.md']
    })
  } catch (err) {
    // -> Dismissing the file picker is not a failure, and nothing should be said about it
    if (err.name !== 'AbortError') {
      notify({ type: 'negative', message: t('liveNote.downloadFailed'), caption: err.message })
    }
  }
}

function syncTitle(value) {
  if (titleEl.value && titleEl.value.textContent !== (value ?? '')) {
    titleEl.value.textContent = value ?? ''
  }
  state.titleText = value ?? ''
}

function onTitleInput(event) {
  // -> A cleared field keeps a browser-inserted `<br>`, which would hold a second line open under the
  //    placeholder. See the same in `PageHeader.vue`
  if (event.target.textContent === '' && event.target.innerHTML !== '') {
    event.target.innerHTML = ''
  }
  state.titleText = event.target.textContent
  titleEdited = true
  EVENT_BUS.emit('setNoteTitle', { title: state.titleText })
}

/*
  Tidied on the way out rather than as it is typed, as the page header does: collapsing spaces under
  the caret would move it while someone is still going. An empty title takes its heading away here.
*/
function onTitleBlur(event) {
  if (!titleEdited) {
    syncTitle(liveNoteStore.title)
    return
  }
  titleEdited = false
  const tidied = event.target.textContent.replace(/\s+/g, ' ').trim()
  EVENT_BUS.emit('setNoteTitle', { title: tidied, final: true })
  syncTitle(tidied)
}

/**
 * Delete the note, everyone's copy of it and its history, and leave it. Whoever else is in it is
 * disconnected by the server and shown that it is gone.
 */
function deleteNote() {
  confirm({
    title: t('liveNote.delete'),
    message: [
      t('liveNote.deleteConfirm', { title: liveNoteStore.title || t('liveNote.untitled') }),
      t('liveNote.deleteConfirmHint')
    ],
    cancel: true,
    color: 'negative',
    okLabel: t('liveNote.delete')
  }).onOk(async () => {
    deleting = true
    try {
      await API_CLIENT.delete(`sites/${siteStore.id}/notes/${liveNoteStore.key}`)
      notify({ type: 'positive', message: t('liveNote.deleteSuccess') })
      close()
    } catch (err) {
      deleting = false
      notify({
        type: 'negative',
        message: t('liveNote.deleteFailed'),
        caption: apiErrorMessage(err)
      })
    }
  })
}

/**
 * Who besides its owners may read and write the note. Everybody else in it is disconnected by the
 * server and comes back as whatever they now are; this reader, being an owner, carries on.
 */
function changeAccess() {
  dialog({
    component: LiveNoteAccessDialog,
    componentProps: { access: liveNoteStore.access }
  }).onOk(async (access) => {
    try {
      await liveNoteStore.setAccess(access)
      notify({ type: 'positive', message: t('liveNote.access.saved') })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('liveNote.access.saveFailed'),
        caption: apiErrorMessage(err)
      })
    }
  })
}

/**
 * A note image as the note's source points at it -- `/_files/n/<uuid>.<ext>`, what
 * `liveNotes.addImage` answers with. Global, for `replaceAll` and `matchAll`.
 */
const NOTE_IMAGE_URL_RE = /\/_files\/n\/([0-9a-f-]{36}\.(?:png|jpg|gif|webp|svg))/gi

/**
 * The note's source as a page's: without the opening H1, which is all a note's title is and which the
 * page carries as its title instead -- left in, the page would show it twice.
 */
function pageSourceOf(content) {
  return content.replace(/^\s*#[ \t]+[^\n]*(?:\n+|$)/, '')
}

/**
 * Copy the note's images out of the note image folder, beside the page about to use them, and point
 * the source at the copies.
 *
 * Copied, never moved: the note carries on after it is published, and its revisions still show them.
 * And copied at all because `n/` is not a folder a page can use -- `/_files/` serves it to signed-in
 * readers only, and no page rule reaches it. Filed where an image pasted into the page would be
 * (`pastedAssetFolder`), in the page's locale, under the name the note gave it with the page's own
 * name in front -- `foobar-<uuid>.png` for a page published to `guides/foobar` -- so that a folder of
 * them says which page each one came with.
 *
 * @returns {{ content: string, assetIds: string[] }} The rewritten source, and the copies made, for
 *   the caller to take back out should the page then not be created.
 */
async function copyNoteImages(content, { path, locale }) {
  const names = [...new Set([...content.matchAll(NOTE_IMAGE_URL_RE)].map((m) => m[1]))]
  const folderPath = pastedAssetFolder(
    siteStore.uploads.pastedDestination,
    path.split('/').slice(0, -1).join('/')
  )
  const pageName = path.split('/').at(-1)
  const assetIds = []
  try {
    for (const name of names) {
      const source = await fetch(`/_files/n/${name}`, { credentials: 'same-origin' })
      if (!source.ok) {
        throw new Error(t('liveNote.publish.imageFailed', { name }))
      }
      const blob = await source.blob()
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/assets`, {
        searchParams: {
          fileName: `${pageName}-${name}`,
          locale,
          ...(folderPath ? { folderPath } : {})
        },
        headers: { 'content-type': blob.type || 'application/octet-stream' },
        body: blob
      }).json()
      assetIds.push(resp.asset.id)
      // -> What the server stored, which the site's upload conflict behavior may have renamed
      content = content.replaceAll(
        `/_files/n/${name}`,
        assetPath(resp.asset.folderPath, resp.asset.fileName)
      )
    }
  } catch (err) {
    await removeAssets(assetIds)
    throw err
  }
  return { content, assetIds }
}

/** Take back copies made for a page that was not created. Best effort: what fails stays behind. */
async function removeAssets(assetIds) {
  await Promise.allSettled(
    assetIds.map((id) => API_CLIENT.delete(`sites/${siteStore.id}/assets/${id}`))
  )
}

/**
 * Make a page of the note: its properties, then where it goes, then the page -- and the reader is
 * taken to it. The note itself is left as it was.
 *
 * The source is the note as the room has it right now, the same as Download. Rendered here, as every
 * save is, and for where the page is going -- see `renderFor` in `PageVersion.vue`.
 */
function publishToPage() {
  dialog({
    component: LiveNotePublishDialog,
    componentProps: { title: liveNoteStore.title }
  }).onOk((props) => {
    dialog({
      component: defineAsyncComponent(() => import('@/components/TreeBrowserDialog.vue')),
      componentProps: {
        mode: 'savePage',
        folderPath: '',
        itemTitle: props.title,
        itemFileName: '',
        locale: commonStore.locale
      }
    }).onOk(async ({ path, title, locale }) => {
      loading.show()
      let assetIds = []
      try {
        const copied = await copyNoteImages(pageSourceOf(liveNoteStore.content), { path, locale })
        assetIds = copied.assetIds
        const render = await new MarkdownRenderer(editorStore.editors.markdown ?? {}).render(
          copied.content,
          { pagePath: path }
        )
        const resp = await API_CLIENT.post(`sites/${siteStore.id}/pages`, {
          json: {
            ...props,
            title,
            path,
            locale,
            editor: 'markdown',
            content: copied.content,
            render
          }
        }).json()
        const page = resp?.page
        if (!page?.id) {
          throw new Error(resp?.message || 'An unexpected error occured.')
        }
        assetIds = []
        notify({ type: 'positive', message: t('liveNote.publish.success') })
        if (props.tags.length > 0) {
          siteStore.staleTags()
        }
        router.push(`/${page.path}`)
      } catch (err) {
        await removeAssets(assetIds)
        notify({
          type: 'negative',
          message: t('liveNote.publish.failed'),
          caption: apiErrorMessage(err)
        })
      } finally {
        loading.hide()
      }
    })
  })
}

function openRevisions() {
  siteStore.$patch({ overlay: 'LiveNoteRevisions' })
}

/** Back to wherever the reader came from, or the site root for a note opened straight from a link. */
function close() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/')
  }
}

onBeforeUnmount(() => {
  clearInterval(clockTimer)
  loadToken++
  // -> Before the editor goes, which the binding is holding: this hook runs ahead of the children's
  stopCollabSession()
  // -> The revisions belong to this note, and must not be left standing over whatever is next
  if (siteStore.overlay === 'LiveNoteRevisions') {
    siteStore.$patch({ overlay: '' })
  }
  liveNoteStore.close()
})
</script>

<style scoped lang="scss">
/*
  The Editor / Reader switch's place in the bar: over the middle of its top edge, out of the row the
  title and the actions share. `.page-header` is the positioning context already (`hairline-edge` in
  `_page-chrome.scss`). Pulled up through the bar's top border, where the hairline along it is painted
  by a pseudo-element the notch has to sit above, so that the notch starts where the site header ends
  with nothing between the two.
*/
.note-mode-slot {
  position: absolute;
  top: -1px;
  left: 50%;
  z-index: 1;
  transform: translateX(-50%);
}

/*
  A notch shaped like a bathtub, coming out of the bottom of the site header: the header's own fill,
  rounded at the bottom, and flared into the header at the top by a concave corner either side -- the
  two pseudo-elements, each a square of the fill with a quarter circle cut out of it.

  The radius is the track's inside it plus the padding between them (`rounded-lg` on `WTabs`, then
  this box's own 4px), so the two curves at each bottom corner run parallel.
*/
.note-mode-notch {
  --note-notch-radius: 12px;
  position: relative;
  padding: 0 4px 4px;
  border-radius: 0 0 var(--note-notch-radius) var(--note-notch-radius);
  background-color: var(--color-header);

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    width: var(--note-notch-radius);
    height: var(--note-notch-radius);
    pointer-events: none;
  }
  &::before {
    right: 100%;
    background: radial-gradient(
      circle at 0 100%,
      transparent var(--note-notch-radius),
      var(--color-header) calc(var(--note-notch-radius) + 0.5px)
    );
  }
  &::after {
    left: 100%;
    background: radial-gradient(
      circle at 100% 100%,
      transparent var(--note-notch-radius),
      var(--color-header) calc(var(--note-notch-radius) + 0.5px)
    );
  }
}

/*
  The title while it is also a field: the page header's treatment (`.page-header-editable` in
  `PageHeader.vue`, whose styles are scoped to it). No border and no focus ring -- at rest it reads as
  the heading it is, and the hover tint and the caret are what say "type here".
*/
.note-title-editable {
  display: inline-block;
  max-width: 100%;
  padding: 0 4px;
  margin: 0 -4px;
  border-radius: 4px;
  outline: none;
  transition: background-color 0.15s var(--ease-standard);

  &.is-editable {
    cursor: text;

    &:hover {
      background-color: rgb(0 0 0 / 0.06);
    }
    &:focus {
      background-color: rgb(0 0 0 / 0.09);
    }

    @at-root .body--dark & {
      &:hover {
        background-color: rgb(255 255 255 / 0.08);
      }
      &:focus {
        background-color: rgb(255 255 255 / 0.12);
      }
    }
  }

  // -> Keyed off the state rather than `:empty`, which a cleared field can fail -- see `onTitleInput`
  &.is-empty::before {
    content: attr(data-placeholder);
    opacity: 0.4;
    pointer-events: none;
    user-select: none;
  }
}
</style>
