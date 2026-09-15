import * as Y from 'yjs'
import {
  prosemirrorToYXmlFragment,
  redo as yRedo,
  undo as yUndo,
  yCursorPlugin,
  ySyncPlugin,
  yUndoPlugin
} from 'y-prosemirror'

/**
 * Collaborative editing for the Visual editor.
 *
 * The Markdown editor shares a `Y.Text` of the page source, which is what a text editor binds to.
 * ProseMirror cannot: a document is a tree, and y-prosemirror shares it as a `Y.XmlFragment`. So the
 * two editors collaborate through different shared types in the same room — which is not a problem to
 * solve, because a page has exactly one editor and everybody who opens it gets that one. Two people
 * are never in the same room through different editors.
 *
 * The hard part is SEEDING, and it is worth reading `core/collab.ts` on this first. A room that
 * nobody is already in has to be filled from the page, and a Yjs document cannot simply be filled
 * twice: two instances doing it at once would produce two copies of the page. The server solves that
 * by making its seed deterministic — built in a scratch document pinned to a fixed client id, so the
 * bytes depend on nothing but the content — and two identical seeds merge to one document.
 *
 * The server cannot build this one. The fragment is a ProseMirror document, and turning markdown into
 * one means the whole parser, which lives in the browser and is deliberately not on the server. So the
 * seed is built HERE, by whichever clients arrive first — using the very same trick, for the very same
 * reason, under a client id of its own. See `SEED_CLIENT_ID`, which is where that gets interesting.
 */

/** The shared type the document lives in. Named, because the room also holds the Markdown editor's. */
const FRAGMENT = 'prosemirror'

export function collabFragment(ydoc) {
  return ydoc.getXmlFragment(FRAGMENT)
}

/**
 * The client id this seed is written under.
 *
 * Pinned, so the bytes are a function of the document and nothing else — that is what lets two
 * browsers seed the same page at the same instant and produce one document rather than two.
 *
 * NOT zero, and that is the whole of why this constant exists. `buildSeed` in `core/collab.ts` pins
 * ITS seed to client 0, and a Yjs update is identified by its client id and a clock counting from
 * there — so a second seed claiming client 0 describes changes the document has already seen, and Yjs
 * discards it in silence. The room ended up holding the server's `content` text and an empty
 * fragment, which reached the author as a page that opened blank and then saved over itself.
 *
 * Any id but the server's will do; 1 is simply the next one. A real client picks a random 32-bit id,
 * so the chance of meeting either of these is the same vanishing chance the server already lives with.
 */
const SEED_CLIENT_ID = 1

/**
 * The room's starting state, as a Yjs update.
 *
 * Deterministic, for the reason `SEED_CLIENT_ID` gives.
 */
export function buildSeed(doc) {
  const scratch = new Y.Doc()
  scratch.clientID = SEED_CLIENT_ID
  prosemirrorToYXmlFragment(doc, scratch.getXmlFragment(FRAGMENT))
  const update = Y.encodeStateAsUpdate(scratch)
  scratch.destroy()
  return update
}

/**
 * Fill the room from this browser's copy of the page, if nobody has filled it yet.
 *
 * Asked once the document has synced, so "empty" means the room genuinely holds no document rather
 * than that this browser has not heard about it yet. A room somebody is already in is left alone: what
 * it holds is the current state of the edit, including anything unsaved, and it outranks whatever this
 * browser loaded from the API.
 *
 * @returns {boolean} Whether this call was the one that seeded it.
 */
export function seedIfEmpty(ydoc, doc) {
  const fragment = collabFragment(ydoc)
  if (fragment.length > 0) {
    return false
  }
  Y.applyUpdate(ydoc, buildSeed(doc))
  return true
}

/**
 * The plugins that replace `history()` once the editor is collaborating.
 *
 * Undo has to come from Yjs rather than from ProseMirror: `prosemirror-history` would happily undo
 * whatever changed last, which in a shared document is very often somebody else's sentence. Yjs tracks
 * what THIS client did.
 *
 * The editor's state is created with NO document and `ySyncPlugin` fills it from the fragment. The
 * alternative — building the document with `initProseMirrorDoc` and handing the plugin its mapping —
 * reads better and is what the newer examples show, but here it left the binding and the document
 * disagreeing: the first click emptied the page. Letting the plugin be the one to produce the
 * document keeps the two in step by construction.
 */
export function collabPlugins({ ydoc, awareness }) {
  return [ySyncPlugin(collabFragment(ydoc)), yCursorPlugin(awareness), yUndoPlugin()]
}

/** Undo and redo, as the collaborative document means them. */
export const collabUndo = yUndo
export const collabRedo = yRedo
