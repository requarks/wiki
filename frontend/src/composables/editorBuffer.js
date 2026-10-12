import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { debounce } from 'es-toolkit/function'
import { pick } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import { confirm } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import {
  bufferKey,
  deleteBufferEntry,
  readBufferEntry,
  readBufferFiles,
  writeBufferEntry
} from '@/helpers/editorBuffer'
import { useCollabStore } from '@/stores/collab'
import { useEditorStore } from '@/stores/editor'
import { SAVED_PAGE_FIELDS, usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * Keep what is typed into an editor in this browser until it is saved, and offer it back if it never
 * was -- a closed tab, a crashed browser, a laptop that ran out of battery.
 *
 * Phase 1 of `dev/specs/drafts.md` (§11): the server keeps nothing until a save, so this browser is
 * the only place an unsaved edit can survive the document that holds it. The storage is
 * `helpers/editorBuffer.js`; this decides when to write to it and what to do with what is there.
 *
 * **Only the editors that hold a document.** Markdown, AsciiDoc, Visual and Excalidraw. A redirection
 * and a blog's settings are a handful of fields each, quicker typed again than restored, and neither
 * editor is asked to take a document from outside.
 *
 * **Only for a signed-in account.** Every guest is the same nobody, and a suggestion typed on a shared
 * computer by one of them is not something to offer to the next.
 *
 * The life of an entry:
 *
 *   - **Written** a second after a change, while there is anything unsaved, and once more when the
 *     editor closes or the document is hidden -- the last chance a closing tab gives.
 *   - **Deleted** when nothing is unsaved any more: a save, somebody else saving the room this author
 *     is in, a submitted suggestion, and Discard, which settles the editor first so that this sees
 *     nothing left to keep.
 *   - **Offered back** when the editor next opens on the same page, once it is ready to take a
 *     document -- after a collaborative room has synced, since the room's binding would otherwise
 *     overwrite it. An entry that matches what was loaded says nothing and is dropped in silence.
 *
 * Restoring goes through the editor (`restoreEditorContent`) rather than into the page store, so that
 * it is an edit like any other: undoable where the editor allows it, and carried into a collaborative
 * room by the binding as this author's change.
 *
 * Called once, from the page view, which is what mounts the editors.
 */

/** How long after a change the buffer is written. The window an unsaved keystroke can be lost in. */
const WRITE_DELAY = 1000

/** The editors whose work is kept. See the note above on why not the other two. */
const BUFFERED_EDITORS = new Set(['markdown', 'asciidoc', 'visual', 'excalidraw'])

/**
 * The page fields kept beside the source: what a save sends, less the render -- the editor makes that
 * again from the source -- and the password, which is not written to disk for the sake of a restore.
 */
const BUFFERED_FIELDS = SAVED_PAGE_FIELDS.filter(
  (field) => !['content', 'render', 'password'].includes(field)
)

/**
 * And for a page being created, where it was going to go. An edit has a path already, and changing
 * it is a move, which is not something a save does.
 */
const BUFFERED_CREATE_FIELDS = [...BUFFERED_FIELDS, 'path', 'locale']

/**
 * Ask whether to throw away what is unsaved in the editor, before something closes it.
 *
 * Resolves true straight away when there is nothing to lose. A yes is settled before it resolves, so
 * that the buffer does not keep what the author has just said to throw away, and so that the router's
 * guard, which asks this same question, does not ask it a second time on the navigation that follows.
 *
 * The router's guard in `pages/Index.vue` is the usual caller. Anything that closes the editor WITHOUT
 * a navigation the router would see has to ask here itself -- the header logo, clicked on the page the
 * author is already at.
 *
 * @param {Function} t The caller's `t`; there is no i18n instance to reach from outside a component.
 * @returns {Promise<boolean>} Whether the editor may close.
 */
export function confirmDiscardUnsaved(t) {
  const editorStore = useEditorStore()
  if (!editorStore.isActive || !editorStore.hasUnsavedEdits) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    confirm({
      title: t('editor.unsaved.title'),
      message: t('editor.unsaved.body'),
      cancel: true,
      color: 'negative',
      okLabel: t('common.actions.discard')
    })
      .onOk(() => {
        editorStore.settleChanges()
        resolve(true)
      })
      .onCancel(() => resolve(false))
  })
}

export function useEditorBuffer() {
  const { t } = useI18n()

  const collabStore = useCollabStore()
  const editorStore = useEditorStore()
  const pageStore = usePageStore()
  const siteStore = useSiteStore()
  const userStore = useUserStore()

  /**
   * The editor being kept: the key it is filed under, decided when it opened -- a page that is
   * created mid-session gets an id, and the entry is still the one it started as -- and whether
   * writing has begun. Not before an entry already there has been dealt with, since the first write
   * would replace it.
   */
  let session = null

  // -> Bumped per session, so that an answer arriving for one that has since closed is dropped
  let sessionSeq = 0

  function fieldsFor(mode) {
    // -> A suggestion is the source and nothing else; the page's fields are not the submitter's to change
    if (mode === 'suggest') {
      return []
    }
    return mode === 'create' ? BUFFERED_CREATE_FIELDS : BUFFERED_FIELDS
  }

  /**
   * The edit as it stands, as plain data.
   *
   * The fields go through JSON: they are what a save sends as JSON anyway, and a store's arrays and
   * objects are reactive proxies that IndexedDB refuses to clone.
   */
  function snapshot(key, mode) {
    return {
      key,
      userId: userStore.id,
      siteId: siteStore.id,
      pageId: pageStore.id || null,
      mode,
      editor: editorStore.editor,
      savedAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' }),
      baseUpdatedAt: pageStore.updatedAt || null,
      content: pageStore.content ?? '',
      fields: JSON.parse(JSON.stringify(pick(pageStore, fieldsFor(mode)))),
      assets: editorStore.pendingAssets.map(({ id, kind, fileName, blobUrl }) => ({
        id,
        kind,
        fileName,
        blobUrl
      }))
    }
  }

  /** Write what is unsaved, or forget the entry when nothing is. */
  function persist() {
    if (!session?.armed) {
      return
    }
    // -> Signed out since the editor opened: what was kept for that account has just been cleared,
    //    and a write landing now would put it straight back
    if (!userStore.authenticated || userStore.id !== session.userId) {
      return
    }
    if (editorStore.hasUnsavedEdits) {
      // -> Taken now, synchronously: by the time the write lands the store may hold another page
      const entry = snapshot(session.key, session.mode)
      const files = editorStore.pendingAssets.map(({ id, file }) => ({ id, file }))
      writeBufferEntry(entry, files)
    } else {
      deleteBufferEntry(session.key)
    }
  }

  const schedulePersist = debounce(persist, WRITE_DELAY)

  function arm() {
    session.armed = true
    if (editorStore.hasUnsavedEdits) {
      schedulePersist()
    }
  }

  /** Whether an entry holds anything the editor that just opened does not. */
  function differsFromLoaded(entry) {
    if ((entry.content ?? '') !== (pageStore.content ?? '')) {
      return true
    }
    const fields = JSON.parse(JSON.stringify(pick(pageStore, fieldsFor(entry.mode))))
    return !isEqual(entry.fields ?? {}, fields)
  }

  /** Two instants as the API or the room spelled them, compared as instants rather than as strings. */
  function sameInstant(a, b) {
    try {
      return Temporal.Instant.compare(Temporal.Instant.from(a), Temporal.Instant.from(b)) === 0
    } catch {
      return a === b
    }
  }

  /** Ask whether to put an entry back. Resolves true to restore, false to throw it away. */
  function ask(entry) {
    const date = userStore.formatDateTime(t, entry.savedAt)
    const message = [
      entry.mode === 'create'
        ? t('editor.restore.bodyNewPage', { date })
        : t('editor.restore.body', { date })
    ]
    // -> Saved by somebody since: the entry is the whole page as this author had it, so restoring it
    //    puts back what was there before that save as well
    if (
      entry.mode === 'edit' &&
      entry.baseUpdatedAt &&
      pageStore.updatedAt &&
      !sameInstant(entry.baseUpdatedAt, pageStore.updatedAt)
    ) {
      message.push(t('editor.restore.stale'))
    }
    // -> And replaced for everybody in the room, who may well have carried on without this author
    if (collabStore.participants.some((participant) => !participant.isSelf)) {
      message.push(t('editor.restore.othersEditing'))
    }
    return new Promise((resolve) => {
      confirm({
        title: t('editor.restore.title'),
        message,
        cancel: true,
        persistent: true,
        okLabel: t('editor.restore.restore'),
        cancelLabel: t('common.actions.discard')
      })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false))
    })
  }

  /**
   * Put an entry back into the open editor.
   *
   * Pending assets come first: their old `blob:` URLs died with the document that made them, so each
   * file gets a new one and the source is rewritten to match before the editor sees it. Then the page
   * fields, straight into the store as the properties panel writes them -- the three a room shares go
   * on from there through its own watcher. Then the source, through the editor.
   */
  async function restore(entry) {
    let content = entry.content ?? ''
    const files = new Map((await readBufferFiles(entry.key)).map(({ id, file }) => [id, file]))
    for (const asset of entry.assets ?? []) {
      const file = files.get(asset.id)
      if (!file || editorStore.pendingAssets.some((item) => item.id === asset.id)) {
        continue
      }
      const blobUrl = URL.createObjectURL(file)
      content = content.split(asset.blobUrl).join(blobUrl)
      editorStore.pendingAssets.push({
        id: asset.id,
        kind: asset.kind,
        file,
        fileName: asset.fileName,
        blobUrl
      })
    }
    if (Object.keys(entry.fields ?? {}).length > 0) {
      pageStore.$patch(entry.fields)
    }
    EVENT_BUS.emit('restoreEditorContent', { content })
    // -> Unsaved again, whatever the editor makes of the source: the fields alone are a change
    editorStore.lastChangeTimestamp = Temporal.Now.instant()
    notify({ type: 'positive', message: t('editor.restore.restored') })
  }

  /** The editor is ready: deal with what is kept for it, then start keeping. */
  async function begin() {
    const seq = ++sessionSeq
    const mode = editorStore.mode
    const key =
      userStore.authenticated && BUFFERED_EDITORS.has(editorStore.editor)
        ? bufferKey({
            userId: userStore.id,
            siteId: siteStore.id,
            mode,
            pageId: pageStore.id,
            editor: editorStore.editor
          })
        : null
    session = { key, mode, userId: userStore.id, armed: false }
    if (!key) {
      return
    }

    const entry = await readBufferEntry(key)
    if (seq !== sessionSeq) {
      return
    }
    // -> A page converted to another editor since: that source would mean nothing to this one
    if (!entry || entry.editor !== editorStore.editor || !differsFromLoaded(entry)) {
      if (entry) {
        await deleteBufferEntry(key)
      }
      arm()
      return
    }

    const accepted = await ask(entry)
    if (seq !== sessionSeq) {
      return
    }
    if (accepted) {
      await restore(entry)
      if (seq !== sessionSeq) {
        return
      }
    } else {
      await deleteBufferEntry(key)
    }
    arm()
  }

  /** The editor has closed: one last write, or the entry goes if there is nothing left to keep. */
  function end() {
    sessionSeq++
    schedulePersist.cancel()
    persist()
    session = null
  }

  /*
    Synchronous, because the moment the editor closes is the moment that matters and it does not last:
    leaving the editor closes it BEFORE the next page is loaded into the store (see the route watcher
    in `pages/Index.vue`), so in this tick the store still holds the page that was being edited.
  */
  watch(
    () => editorStore.isReady,
    (ready) => (ready ? begin() : session && end()),
    { flush: 'sync' }
  )

  watch(
    () => [
      editorStore.lastChangeTimestamp,
      editorStore.lastSaveTimestamp,
      editorStore.pendingAssets.length
    ],
    () => {
      if (session?.armed) {
        schedulePersist()
      }
    }
  )

  /*
    A tab being closed, or put away on a phone that may never bring it back: write now rather than in a
    second's time, which is the one chance there is. IndexedDB may not finish before the document goes,
    but it usually does, and the browser's own leave warning covers the rest.
  */
  function onHidden() {
    if (document.visibilityState === 'hidden') {
      flushNow()
    }
  }

  function flushNow() {
    if (session?.armed) {
      schedulePersist.flush()
    }
  }

  /*
    And the warning itself, for a document being unloaded with something in the editor that has not
    been saved. The browser writes the words; all a page can do is ask for the prompt. Raised for every
    editor, the two that keep nothing included -- the prompt costs nothing to dismiss, and the loss it
    stops is silent.
  */
  function onBeforeUnload(event) {
    if (editorStore.isActive && editorStore.hasUnsavedEdits) {
      event.preventDefault()
      // -> Still what some browsers look at, in place of `preventDefault` alone
      event.returnValue = ''
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flushNow)
    window.addEventListener('beforeunload', onBeforeUnload)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onHidden)
    window.removeEventListener('pagehide', flushNow)
    window.removeEventListener('beforeunload', onBeforeUnload)
    if (session) {
      end()
    }
  })
}
