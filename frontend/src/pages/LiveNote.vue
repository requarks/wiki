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
        <collab-presence class="me-2" show-alone />
        <w-btn
          class="ms-2 acrylic-btn"
          flat
          icon="la:link"
          color="grey"
          :aria-label="t(`liveNote.copyLink`)"
          @click="copyLink">
          <w-tooltip>{{ t('liveNote.copyLink') }}</w-tooltip>
        </w-btn>
        <w-btn
          class="ms-2 acrylic-btn"
          flat
          icon="la:ellipsis-v"
          color="grey"
          :aria-label="t(`liveNote.menu`)">
          <w-tooltip>{{ t('liveNote.menu') }}</w-tooltip>
          <!-- -> `!min-w-0 !pr-2` and literal colour classes, as the page history's version menu has them -->
          <w-menu class="translucent-menu" auto-close anchor="bottom right" self="top right">
            <w-list dense padding style="min-width: 200px">
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
    <!-- -> Keyed by the note, so that following a link from one note to another is a new editor and a
            new room rather than the old room's document bound to the new note -->
    <editor-markdown
      v-if="state.status === `ready`"
      :key="liveNoteStore.key"
      :note-key="liveNoteStore.key"
      :read-only="!liveNoteStore.canWrite" />
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

import { useMeta } from '@/composables/meta'
import { confirm, dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { useMinWidth } from '@/composables/screen'
import { apiErrorMessage } from '@/helpers/apiError'
import { copyToClipboard } from '@/helpers/clipboard'
import { relativeDate } from '@/helpers/datetime'
import { loginLocation } from '@/helpers/loginRedirect'

import CollabPresence from '@/components/CollabPresence.vue'
import LiveNoteAccessDialog from '@/components/LiveNoteAccessDialog.vue'
import LoadingGeneric from '@/components/LoadingGeneric.vue'

import { useCollabStore } from '@/stores/collab'
import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useLiveNoteStore } from '@/stores/liveNote'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * A live note, at `/n/<key>`: the Markdown editor on a document that anybody signed in who holds the
 * URL is writing in at the same time, and that stores itself as it changes. `/n` alone creates one and
 * replaces itself with its URL.
 *
 * Everything that makes it a note rather than a page is somewhere else. The server's half is
 * `models/liveNotes.ts` and the note room in `core/collab.ts`; the editor's is its `noteKey` prop.
 * This view decides whether there is a note to show, and draws the bar above it.
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
   * - `signin` — a note is only for somebody signed in
   * - `disabled` — the site does not have live notes
   * - `notfound` — no note has this key
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

/** The title is a field once the room has answered, for whoever may write in the note. */
const titleEditable = computed(() => collabStore.hasSynced && liveNoteStore.canWrite)

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
    case 'notfound':
      return { title: t('liveNote.notFound'), hint: t('liveNote.notFoundHint') }
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
      load(route.params.noteKey)
    } else {
      create()
    }
  },
  { immediate: true }
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

/**
 * Whether this reader may have live notes here, saying why not when they may not. The server asks the
 * same questions; asked here first so that the screen can say which it is without a round trip.
 */
function mayUseNotes() {
  if (!userStore.authenticated) {
    state.status = 'signin'
    return false
  }
  if (!siteStore.features.liveNotes || !siteStore.features.collaborativeEditing) {
    state.status = 'disabled'
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
  if (!mayUseNotes()) {
    return
  }
  try {
    const key = await liveNoteStore.create()
    if (token === loadToken) {
      await router.replace({ path: `/n/${key}`, hash: route.hash })
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
        state.status = 'disabled'
        break
      default:
        state.status = 'createfailed'
        state.errorMessage = apiErrorMessage(err)
    }
  }
}

async function load(key) {
  const token = ++loadToken
  liveNoteStore.close()
  state.status = 'loading'
  if (!mayUseNotes()) {
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
        // -> The note's own refusal has a code of its own; any other 403 is notes being switched off
        state.status = err.data?.error === 'notePrivate' ? 'private' : 'disabled'
        break
      case 404:
        state.status = 'notfound'
        break
      default:
        state.status = 'error'
        state.errorMessage = apiErrorMessage(err)
    }
  }
}

/** The note's URL, which is the whole of sharing it: whoever is signed in and has it can write. */
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
  // -> The revisions belong to this note, and must not be left standing over whatever is next
  if (siteStore.overlay === 'LiveNoteRevisions') {
    siteStore.$patch({ overlay: '' })
  }
  liveNoteStore.close()
})
</script>

<style scoped lang="scss">
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
