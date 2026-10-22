import { watch } from 'vue'

import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

import { useCollabStore } from '@/stores/collab'
import { useEditorStore } from '@/stores/editor'
import { useLiveNoteStore } from '@/stores/liveNote'
import { usePageStore } from '@/stores/page'
import { useUserStore } from '@/stores/user'

/**
 * Live collaborative editing, browser side.
 *
 * One session at a time — there is one editor open at a time — so this is a module singleton rather
 * than a per-component composable. The Yjs document, the websocket and the Monaco binding are held
 * here, deliberately outside of Vue's reactivity: a CRDT is a graph of mutable nodes and wrapping one
 * in a proxy is both pointless and slow. What components need is mirrored into `stores/collab.js`.
 *
 * What is shared is the markdown source and the three fields in the page header. Everything else about
 * a page — its tags, its path, the properties panel — is not, and the last save wins on those, exactly
 * as it did before any of this existed.
 *
 * Saving is unchanged and still explicit. All this session does about it is listen: the server writes
 * the fact of a save into the document, and the editors that did not make it stop calling themselves
 * unsaved.
 *
 * A live note is the other kind of session (`noteKey` rather than `pageId`). It shares the text and
 * nothing else — a note has no header fields and no save, its room storing it as it changes — so none
 * of the page store is touched. And it is held by the note's view rather than by an editor
 * (`pages/LiveNote.vue`): the note can be on screen with no editor at all, in its Reader view, which
 * reads the text straight off the document. The editor binds to that session and unbinds from it.
 */

/** How long to wait for the first sync before giving up and letting the author type offline. */
const SYNC_TIMEOUT = 5000

/**
 * How long after someone's last change they still count as typing.
 *
 * Long enough to ride out the pause between two words, short enough that the indicator means "right
 * now" rather than "recently". Only the two transitions are broadcast, not each keystroke.
 */
const TYPING_IDLE = 2000

/**
 * Cursor colours. Picked by hashing the user id, so one person is the same colour on everyone's screen
 * and stays that colour across sessions. Chosen to stay legible as a cursor label and as the
 * background of an avatar with white initials on it — hence no yellows or pastels.
 */
const USER_COLORS = [
  '#D32F2F',
  '#C2185B',
  '#7B1FA2',
  '#512DA8',
  '#303F9F',
  '#1976D2',
  '#0288D1',
  '#00796B',
  '#388E3C',
  '#E64A19',
  '#5D4037',
  '#455A64'
]

let doc = null
let provider = null
/**
 * The Monaco binding, once there is one. `pending` while it is being fetched, which is what keeps two
 * calls arriving in the same tick from each making one — see `bindCollabEditor`.
 */
let binding = null
/**
 * Where each other participant last typed, as a pair of relative positions keyed by their Yjs client
 * id — see `noteRemoteInsert` — and the Monaco decorations that underline it.
 */
const recentEdits = new Map()
let editDecorations = null
let styleEl = null
let syncTimer = null
/** Whether this author is mid-edit, and the timer that decides when they have stopped. */
let typing = false
let typingTimer = null
/** Unsubscribe callbacks for the page store watchers, which have no component to be bound to. */
let stopWatchers = []
/**
 * Set while a remote change is being written into the page store, so the watcher that mirrors that
 * store back into the document does not send it round again.
 */
let applyingRemote = false
/**
 * Whether the room's opening state has been taken in yet.
 *
 * Everything that arrives before this is the room as it already was, and a new room is not empty: the
 * server seeds one with the page's stored title, description and icon (`core/collab.ts`). So until it
 * is set, an incoming header field is measured against what the page store loaded from the API and
 * ignored where the two agree — see `adoptProps`. After it, anything arriving is somebody's edit.
 */
let initialSyncDone = false
/** Whether the session is a live note's, which shares only the text. */
let isNoteSession = false

/**
 * A stable colour for a user.
 *
 * Exported because an avatar with no picture behind it is drawn in the same colour as its owner's
 * cursor — the whole point being that the face in the header and the caret in the text read as the
 * same person.
 */
export function collabUserColor(userId) {
  let hash = 0
  for (let index = 0; index < userId.length; index++) {
    hash = (hash * 31 + userId.charCodeAt(index)) | 0
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

/** Whether a session is currently open. */
export function isCollabActive() {
  return doc !== null
}

/**
 * Open a session on a page, or on a live note.
 *
 * Returns without waiting for the socket: the editor stays usable throughout, and the store's status
 * is what says whether anything is live yet.
 *
 * @param {object} target
 * @param {string} target.siteId
 * @param {string} [target.pageId] The page being edited.
 * @param {string} [target.noteKey] The live note being edited, by its key — in place of `pageId`.
 */
export function startCollabSession({ siteId, pageId, noteKey }) {
  if (doc) {
    stopCollabSession()
  }

  const collabStore = useCollabStore()
  const pageStore = usePageStore()
  const userStore = useUserStore()

  isNoteSession = Boolean(noteKey)
  doc = new Y.Doc()
  const ytext = doc.getText('content')
  const yprops = doc.getMap('props')
  const ymeta = doc.getMap('meta')

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  provider = new WebsocketProvider(
    `${protocol}//${window.location.host}/_collab`,
    isNoteSession ? `${siteId}/notes/${noteKey}` : `${siteId}/${pageId}`,
    doc
  )

  collabStore.$patch({
    status: 'connecting',
    hasSynced: false,
    participants: [],
    lastSave: null
  })

  // -> Not for a guest, who can only be reading a live note: every guest shares the one placeholder
  //    id, so they would all draw as the same avatar. A state with no `user` is not a participant.
  if (userStore.authenticated) {
    provider.awareness.setLocalStateField('user', {
      id: userStore.id,
      name: userStore.name,
      hasAvatar: userStore.hasAvatar,
      color: collabUserColor(userStore.id)
    })
  }

  provider.awareness.on('change', refreshParticipants)

  /*
    What makes an avatar pulse on everyone else's screen. `transaction.local` is the whole test: an
    edit this browser made is local, and one that arrived over the socket is not — so this fires for
    the author's own typing and never for the changes they are merely receiving. Header fields count
    too, being edits like any other.
  */
  doc.on('update', (update, origin, updated, transaction) => {
    if (transaction?.local) {
      markTyping()
    }
    // -> Not the room's opening state, which is the note as it was rather than anybody's edit
    if (isNoteSession && initialSyncDone && transaction) {
      noteEditedIn(transaction)
    }
  })

  // -> Not before the first sync, whose "insert" is the whole text as the room already held it
  ytext.observe((event, transaction) => {
    if (!transaction.local && initialSyncDone) {
      noteRemoteInsert(event, transaction)
    }
  })
  // -> After every type's observers have run, y-monaco's included, so the model already says what the
  //    document says by the time the underlines are measured against it
  doc.on('afterTransaction', renderRecentEdits)

  provider.on('status', ({ status }) => {
    /*
      `connected` here means the socket is up, which is not the same as the session being live — that
      is what `sync` below reports, and it is the only thing allowed to say `connected`. A refusal is
      final and outranks both.
    */
    if (collabStore.status === 'denied' || status === 'connected') {
      return
    }
    collabStore.status = status === 'connecting' ? 'connecting' : 'disconnected'
  })

  provider.on('sync', (isSynced) => {
    if (!isSynced) {
      return
    }
    clearTimeout(syncTimer)
    collabStore.$patch({ status: 'connected', hasSynced: true })
    initialSyncDone = true
    if (isNoteSession) {
      refreshParticipants()
      return
    }
    /*
      The room may have been holding header fields somebody else changed and has not saved. Those are
      the current state of this edit, so they win over what this browser loaded from the API.

      `initial`, because a room nobody was in is not silent: the server seeds a new one with the
      page's STORED title, description and icon (`core/collab.ts`), so on this first exchange a value
      equal to the stored one carries no edit at all — see `adoptProps`.
    */
    adoptProps({ initial: true })
    /*
      And then this browser's own, which the watcher below will never publish: it fires on change, and
      anything typed into the properties panel before the editor was opened changed before there was a
      room to tell. Second, so that a genuine edit adopted just above is what gets written back.
    */
    publishProps()
    refreshParticipants()
  })

  provider.on('connection-close', (event) => {
    /*
      Codes in the 4000 range are the server's own (see `controllers/collab.ts`) and all mean the same
      thing: this session is not allowed, and reconnecting will be refused just as fast. Anything else
      is an ordinary drop, which the provider is right to retry.
    */
    if (event?.code >= 4000) {
      collabStore.status = 'denied'
      provider.shouldConnect = false
      provider.disconnect()
    }
  })

  /*
    Nothing is coming. A websocket that cannot be established — a proxy that does not forward upgrades
    is the usual reason — must not leave the author staring at an editor they are not allowed to type
    in, so the session gives up and the editor carries on as a plain one.
  */
  syncTimer = setTimeout(() => {
    if (collabStore.status === 'connecting') {
      collabStore.status = 'disconnected'
    }
  }, SYNC_TIMEOUT)

  ensureStyleElement()

  // -> Everything below is the page's header fields and its saves, neither of which a note has
  if (isNoteSession) {
    return { doc, ytext }
  }

  /*
    A header field somebody else edited, arriving mid-session — or the room's own opening state, which
    lands here as a remote update too and reaches this observer BEFORE the provider says it has
    synced. `initialSyncDone` is what tells the two apart.
  */
  yprops.observe((event, transaction) => {
    if (!transaction.local) {
      adoptProps({ initial: !initialSyncDone })
    }
  })

  // -> The server's word that the page has been saved. See `pageSaved` in `core/collab.ts`.
  ymeta.observe(() => {
    const info = ymeta.get('lastSave')
    if (info) {
      applySave(info)
    }
  })

  /*
    The other direction: what this author types into the title, description or icon goes into the
    document. Watched on the store rather than bound to the inputs because those are three separate
    contenteditable elements in the page header, and the store is the one place all three meet.
  */
  stopWatchers.push(
    watch(
      () => [pageStore.title, pageStore.description, pageStore.icon],
      ([title, description, icon]) => {
        if (applyingRemote || !doc) {
          return
        }
        doc.transact(() => {
          writeProp(yprops, 'title', title)
          writeProp(yprops, 'description', description)
          writeProp(yprops, 'icon', icon)
        })
      }
    )
  )

  return { doc, ytext }
}

/**
 * The session's shared document and awareness, for an editor that binds itself.
 *
 * The Markdown editor hands its model to `bindCollabEditor` below and this composable owns the
 * binding. ProseMirror cannot be bound that way: y-prosemirror is a set of PLUGINS, so joining a
 * session means rebuilding the editor's state around them, which only the editor can do. So it takes
 * the two things it needs and does the binding itself — see `enableCollab` in `editor/visual`.
 *
 * @returns {?{ ydoc: object, awareness: object }} Null before a session has started.
 */
export function collabHandles() {
  return doc && provider ? { ydoc: doc, awareness: provider.awareness } : null
}

/**
 * Hand the Monaco model over to the session.
 *
 * Called once the document has synced, and not before: the binding starts by making the model say
 * what the document says, and a document that has not synced yet says nothing at all.
 */
export async function bindCollabEditor(editor) {
  if (!doc || binding) {
    return
  }
  const model = editor.getModel()
  if (!model) {
    return
  }
  /*
    Fetched here rather than imported at the top of this file, and the reason is nothing to do with
    this function: `y-monaco` pulls in Monaco, and a static import would put the whole code editor
    into the chunk of EVERY editor that collaborates. The Visual editor was downloading it to draw a
    ProseMirror document, and the Excalidraw one would download it to draw a picture — some 650 kB
    gzipped apiece, for a module neither of them has any use for.

    Nothing is paid for it here: the two editors that call this are the two built ON Monaco, so by the
    time they do, the module is loaded and this resolves from cache.
  */
  binding = 'pending'
  const { MonacoBinding } = await import('y-monaco')
  // -> The session may have been closed while that was in the air, and `stopCollabSession` cannot
  //    destroy a binding that did not exist yet
  if (binding !== 'pending' || !doc) {
    binding = null
    return
  }
  binding = new MonacoBinding(doc.getText('content'), model, new Set([editor]), provider.awareness)
  editDecorations = editor.createDecorationsCollection()
  renderRecentEdits()
}

/**
 * Take the Monaco binding off the session, and leave the session open: a live note's editor going
 * away while the note stays on screen in its Reader view. A page's editor stops the whole session
 * instead.
 */
export function unbindCollabEditor() {
  if (!binding) {
    return
  }
  // -> A string here means the import in `bindCollabEditor` is still in flight; clearing it is what
  //    tells that call there is no longer an editor to bind
  binding.destroy?.()
  binding = null
  editDecorations?.clear()
  editDecorations = null
  // -> y-monaco publishes the caret and never takes it back, so without this everyone else would go
  //    on seeing it in the text, marking a place nobody is
  provider?.awareness.setLocalStateField('selection', null)
}

/** Close the session and put everything back the way an ordinary editor leaves it. */
export function stopCollabSession() {
  clearTimeout(syncTimer)
  syncTimer = null
  clearTimeout(typingTimer)
  typingTimer = null
  typing = false
  initialSyncDone = false
  isNoteSession = false
  for (const stop of stopWatchers) {
    stop()
  }
  stopWatchers = []
  if (binding) {
    // -> A string here means the import above is still in flight; clearing it is what tells that call
    //    the session it was binding is gone
    binding.destroy?.()
    binding = null
  }
  editDecorations?.clear()
  editDecorations = null
  recentEdits.clear()
  if (provider) {
    // -> Retracts this editor's awareness state before the socket goes, so the others see the avatar
    //    leave immediately rather than when the server notices the connection is gone
    provider.awareness.setLocalState(null)
    provider.destroy()
    provider = null
  }
  if (doc) {
    doc.destroy()
    doc = null
  }
  if (styleEl) {
    styleEl.remove()
    styleEl = null
  }
  applyingRemote = false
  useCollabStore().reset()
}

// ----------------------------------------
// Internals
// ----------------------------------------

/**
 * Say that this author is typing, and arrange to say when they have stopped.
 *
 * Carried as an awareness field of its own rather than folded into `user`, so that a burst of typing
 * does not republish the name, colour and avatar with every change. Two messages per burst: one when
 * it starts, one when it ends.
 */
function markTyping() {
  if (!provider) {
    return
  }
  if (!typing) {
    typing = true
    provider.awareness.setLocalStateField('typing', true)
  }
  clearTimeout(typingTimer)
  typingTimer = setTimeout(() => {
    typing = false
    provider?.awareness.setLocalStateField('typing', false)
  }, TYPING_IDLE)
}

/**
 * Tell the live note store who made a change to the note.
 *
 * This author for a change made here. For one that arrived, whoever's Yjs client wrote it: a
 * transaction advances the clock of every client whose operations it applied, and a participant's
 * awareness state is keyed by that same client id. A change from a client no longer in the room — an
 * offline edit merged on reconnect by somebody who has since left — names nobody, and changes nothing.
 */
function noteEditedIn(transaction) {
  const liveNoteStore = useLiveNoteStore()
  if (transaction.local) {
    const userStore = useUserStore()
    liveNoteStore.markEdited({ id: userStore.id, name: userStore.name })
    return
  }
  const states = provider?.awareness.getStates()
  for (const [clientId, clock] of transaction.afterState) {
    if ((transaction.beforeState.get(clientId) ?? 0) >= clock) {
      continue
    }
    const user = states?.get(clientId)?.user
    if (user?.id) {
      liveNoteStore.markEdited({ id: user.id, name: user.name })
      return
    }
  }
}

/**
 * Remember where somebody else just typed, so it can be underlined in their colour.
 *
 * One stretch per participant, the last one they wrote: typing on from it, or anywhere inside it,
 * grows it, and typing anywhere else moves it there. Held as relative positions so that it stays on
 * the same characters regardless of what anybody else then writes around it — and its ends are
 * anchored INWARDS (the first character, and the last one from the right), so text somebody else
 * types against either edge is not taken into it.
 *
 * Who wrote it is whose clock the transaction advanced, as in `noteEditedIn` — not the items in
 * `event.changes.added`, which a `Y.Text` event always leaves empty. An update holding several
 * people's work at once — what a reconnect brings in — names nobody, and is left alone rather than
 * credited to one of them.
 */
function noteRemoteInsert(event, transaction) {
  const authors = []
  for (const [clientId, clock] of transaction.afterState) {
    if ((transaction.beforeState.get(clientId) ?? 0) < clock) {
      authors.push(clientId)
    }
  }
  if (authors.length !== 1) {
    return
  }
  const [clientId] = authors
  // -> The last insertion in the change, which for typing is the only one
  let inserted = null
  let index = 0
  for (const op of event.delta) {
    if (op.retain !== undefined) {
      index += op.retain
    } else if (op.insert !== undefined) {
      inserted = { from: index, to: index + op.insert.length }
      index += op.insert.length
    }
  }
  if (!inserted) {
    return
  }
  const current = absoluteRange(recentEdits.get(clientId))
  if (current && inserted.from <= current.to && inserted.to >= current.from) {
    inserted = {
      from: Math.min(current.from, inserted.from),
      to: Math.max(current.to, inserted.to)
    }
  }
  const ytext = event.target
  recentEdits.set(clientId, {
    start: Y.createRelativePositionFromTypeIndex(ytext, inserted.from),
    end: Y.createRelativePositionFromTypeIndex(ytext, inserted.to, -1)
  })
}

/** A stretch kept by `noteRemoteInsert`, as offsets into the text as it now stands. */
function absoluteRange(edit) {
  if (!edit || !doc) {
    return null
  }
  const start = Y.createAbsolutePositionFromRelativePosition(edit.start, doc)
  const end = Y.createAbsolutePositionFromRelativePosition(edit.end, doc)
  if (!start || !end || start.index >= end.index) {
    return null
  }
  return { from: start.index, to: end.index }
}

/**
 * Underline everybody's last stretch in the Monaco editor, when there is one bound.
 *
 * Measured afresh on every change rather than left to Monaco's own decoration tracking, which only
 * knows about edits as they reach the model and would drift from the relative positions the stretches
 * are actually kept as. A stretch whose text has all been deleted measures as empty and draws nothing.
 * The colour is in the generated stylesheet — see `renderCursorStyles`.
 */
function renderRecentEdits() {
  // -> Made with the binding and dropped with it, so this is also the test for there being one
  if (!editDecorations) {
    return
  }
  const model = binding.monacoModel
  const decorations = []
  for (const [clientId, edit] of recentEdits) {
    const range = absoluteRange(edit)
    if (!range) {
      continue
    }
    const start = model.getPositionAt(range.from)
    const end = model.getPositionAt(range.to)
    decorations.push({
      range: {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column
      },
      options: { inlineClassName: `yRemoteEdit yRemoteEdit-${clientId}` }
    })
  }
  editDecorations.set(decorations)
}

/** This browser's header fields into the room, whatever they are. See the call in the sync handler. */
function publishProps() {
  const pageStore = usePageStore()
  const yprops = doc.getMap('props')
  doc.transact(() => {
    writeProp(yprops, 'title', pageStore.title)
    writeProp(yprops, 'description', pageStore.description)
    writeProp(yprops, 'icon', pageStore.icon)
  })
}

function writeProp(yprops, key, value) {
  const next = value ?? ''
  if (yprops.get(key) !== next) {
    yprops.set(key, next)
  }
}

/**
 * Copy the shared header fields into the page store, without echoing them back out.
 *
 * @param {object} [options]
 * @param {boolean} [options.initial] Whether this is the first exchange with the room, where a value
 *        matching the stored one is the server's seed rather than anybody's edit — and so must not
 *        overwrite a field this author changed in the properties panel before opening the editor.
 *        Once the session is live, any value arriving IS an edit and wins as it did before.
 */
function adoptProps({ initial = false } = {}) {
  const pageStore = usePageStore()
  const yprops = doc.getMap('props')
  const patch = {}
  for (const key of ['title', 'description', 'icon']) {
    const value = yprops.get(key)
    // -> An icon is never legitimately empty, and blanking one because a room was seeded from a page
    //    that had none would be a visible regression on every other screen
    if (typeof value !== 'string' || (key === 'icon' && !value)) {
      continue
    }
    if (initial && value === pageStore.storedProps[key]) {
      continue
    }
    if (value !== pageStore[key]) {
      patch[key] = value
    }
  }
  if (Object.keys(patch).length < 1) {
    return
  }
  applyingRemote = true
  pageStore.$patch(patch)
  // -> Released after the watchers have run, which they do synchronously only for `flush: 'sync'`
  //    watchers; this one is deferred, so the flag has to outlive the tick
  queueMicrotask(() => {
    applyingRemote = false
  })
}

/**
 * Somebody saved the page. Everyone else is now looking at what is stored, so their editor stops
 * claiming otherwise.
 */
function applySave(info) {
  const collabStore = useCollabStore()
  const editorStore = useEditorStore()
  const pageStore = usePageStore()

  // -> The same instant in both, because "no pending changes" is those two fields being the same value
  const now = Temporal.Now.instant()
  editorStore.$patch({ lastChangeTimestamp: now, lastSaveTimestamp: now })
  pageStore.$patch({
    updatedAt: info.versionDate,
    authorId: info.authorId,
    authorName: info.authorName
  })
  collabStore.lastSave = info
}

function refreshParticipants() {
  if (!provider || !doc) {
    return
  }
  const states = provider.awareness.getStates()
  // -> Somebody who has left has nobody's colour to be underlined in
  let pruned = false
  for (const clientId of recentEdits.keys()) {
    if (!states.has(clientId)) {
      recentEdits.delete(clientId)
      pruned = true
    }
  }
  if (pruned) {
    renderRecentEdits()
  }
  const participants = []
  for (const [clientId, state] of states) {
    if (!state?.user?.id) {
      continue
    }
    participants.push({
      clientId,
      id: state.user.id,
      name: state.user.name || '',
      hasAvatar: Boolean(state.user.hasAvatar),
      color: state.user.color || collabUserColor(state.user.id),
      typing: Boolean(state.typing),
      isSelf: clientId === doc.clientID
    })
  }
  useCollabStore().setParticipants(participants)
  renderCursorStyles(participants)
}

function ensureStyleElement() {
  if (styleEl) {
    return
  }
  styleEl = document.createElement('style')
  styleEl.dataset.collabCursors = 'true'
  document.head.appendChild(styleEl)
}

/**
 * The stylesheet behind the remote cursors.
 *
 * y-monaco draws each remote selection as a decoration whose class carries the client id and nothing
 * else — `yRemoteSelection-42` — leaving what it looks like entirely to CSS. So one rule per
 * participant is generated here, which is also the only way the name can appear beside the caret: it
 * is drawn as generated content, there being no element to put it in.
 *
 * The name is shown only while the caret is hovered: standing over the line above, it covers what
 * somebody else is trying to read. The caret is two pixels wide, which is too narrow to aim at, so
 * `::before` widens what the pointer can find without widening what is drawn.
 */
function renderCursorStyles(participants) {
  ensureStyleElement()
  const shared = `
    .yRemoteSelectionHead::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: -4px;
      width: 8px;
    }
    .yRemoteSelectionHead::after {
      opacity: 0;
      transition: opacity 0.15s;
    }
    .yRemoteSelectionHead:hover::after {
      opacity: 1;
    }`
  const perParticipant = participants
    .filter((participant) => !participant.isSelf)
    .map(
      (participant) => `
        .yRemoteSelection-${participant.clientId} {
          background-color: ${participant.color}44;
        }
        .yRemoteSelectionHead-${participant.clientId} {
          position: relative;
          border-left: 2px solid ${participant.color};
          border-top: 2px solid ${participant.color};
          border-bottom: 2px solid ${participant.color};
        }
        .yRemoteSelectionHead-${participant.clientId}::after {
          content: '${cssString(participant.name)}';
          position: absolute;
          top: -1.4em;
          left: -2px;
          padding: 0 4px;
          border-radius: 2px 2px 2px 0;
          background-color: ${participant.color};
          color: #fff;
          font-size: 0.7rem;
          line-height: 1.4em;
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
        }
        .yRemoteEdit-${participant.clientId} {
          text-decoration: underline dotted ${participant.color};
          text-decoration-thickness: 1px;
          text-decoration-skip-ink: none;
          text-underline-offset: 3px;
        }`
    )
    .join('\n')
  styleEl.textContent = shared + perParticipant
}

/** A user-supplied name, safe to sit inside a single-quoted CSS string. */
function cssString(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\r\n]+/g, ' ')
}
