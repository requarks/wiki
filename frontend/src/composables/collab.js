import { watch } from 'vue'

import { MonacoBinding } from 'y-monaco'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

import { useCollabStore } from '@/stores/collab'
import { useEditorStore } from '@/stores/editor'
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
let binding = null
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
 * Open a session on a page.
 *
 * Returns without waiting for the socket: the editor stays usable throughout, and the store's status
 * is what says whether anything is live yet.
 */
export function startCollabSession({ siteId, pageId }) {
  if (doc) {
    stopCollabSession()
  }

  const collabStore = useCollabStore()
  const pageStore = usePageStore()
  const userStore = useUserStore()

  doc = new Y.Doc()
  const ytext = doc.getText('content')
  const yprops = doc.getMap('props')
  const ymeta = doc.getMap('meta')

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  provider = new WebsocketProvider(
    `${protocol}//${window.location.host}/_collab`,
    `${siteId}/${pageId}`,
    doc
  )

  collabStore.$patch({
    status: 'connecting',
    hasSynced: false,
    participants: [],
    lastSave: null
  })

  provider.awareness.setLocalStateField('user', {
    id: userStore.id,
    name: userStore.name,
    hasAvatar: userStore.hasAvatar,
    color: collabUserColor(userStore.id)
  })

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
  })

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
    /*
      The room may have been holding header fields somebody else changed and has not saved. Those are
      the current state of this edit, so they win over what this browser loaded from the API.
    */
    adoptProps()
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

  // -> A header field somebody else edited, arriving mid-session
  yprops.observe((event, transaction) => {
    if (!transaction.local) {
      adoptProps()
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

  ensureStyleElement()

  return { doc, ytext }
}

/**
 * Hand the Monaco model over to the session.
 *
 * Called once the document has synced, and not before: the binding starts by making the model say
 * what the document says, and a document that has not synced yet says nothing at all.
 */
export function bindCollabEditor(editor) {
  if (!doc || binding) {
    return
  }
  const model = editor.getModel()
  if (!model) {
    return
  }
  binding = new MonacoBinding(doc.getText('content'), model, new Set([editor]), provider.awareness)
}

/** Close the session and put everything back the way an ordinary editor leaves it. */
export function stopCollabSession() {
  clearTimeout(syncTimer)
  syncTimer = null
  clearTimeout(typingTimer)
  typingTimer = null
  typing = false
  for (const stop of stopWatchers) {
    stop()
  }
  stopWatchers = []
  if (binding) {
    binding.destroy()
    binding = null
  }
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

function writeProp(yprops, key, value) {
  const next = value ?? ''
  if (yprops.get(key) !== next) {
    yprops.set(key, next)
  }
}

/** Copy the shared header fields into the page store, without echoing them back out. */
function adoptProps() {
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
  const participants = []
  for (const [clientId, state] of provider.awareness.getStates()) {
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
  useCollabStore().participants = participants
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
 */
function renderCursorStyles(participants) {
  ensureStyleElement()
  styleEl.textContent = participants
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
        }`
    )
    .join('\n')
}

/** A user-supplied name, safe to sit inside a single-quoted CSS string. */
function cssString(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\r\n]+/g, ' ')
}
