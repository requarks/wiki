import * as Y from 'yjs'

import { toLiveUrl, toStoredPath } from './index.js'

/**
 * Collaborative editing for the Excalidraw editor.
 *
 * Read `core/collab.ts` on the server and `editor/visual/collab.js` beside this first — between them
 * they set out what a room is, why a seed has to be deterministic, and why two editors can share one
 * room through different shared types. This is the third such type and the second one the server
 * cannot build.
 *
 * ## The shape it is shared in
 *
 * A `Y.Map` of elements keyed by their id, not a `Y.Array` of them. A drawing is a SET of shapes whose
 * order is carried by each shape's own fractional `index` — that is how Excalidraw itself stores z
 * order — so there is no array position for two authors to disagree about. Dragging a shape forward is
 * a change to that one shape, and two people reordering different shapes at once merge instead of
 * fighting over the same slot, which is exactly the case a `Y.Array` handles worst.
 *
 * Each element is written as ONE value rather than a nested `Y.Map` of its fields. Two people dragging
 * the same shape should not produce a shape with one person's x and the other's y; last writer wins,
 * per shape, is both the honest answer and the one Excalidraw already gives itself. Elements are also
 * small and rewritten wholesale by the editor on every change, so there is nothing finer to preserve.
 *
 * A delete is not a removal. Excalidraw tombstones what it deletes (`isDeleted`), which is what lets a
 * delete travel and be undone; the tombstone is dropped when the page is SAVED, by `serializeScene`.
 *
 * ## Awareness
 *
 * Excalidraw draws other people's cursors itself, given a `collaborators` map — so unlike the two text
 * editors there is no cursor styling to inject, and `collabParticipants` below is only a translation
 * between the wiki's awareness states and the shape Excalidraw wants.
 */

/** The shared types this editor uses, named so the room can also hold the other editors'. */
const ELEMENTS = 'excalidrawElements'
const FILES = 'excalidrawFiles'
const SCENE = 'excalidrawScene'

/**
 * The document-level parts of `appState`, which are the only parts that are shared.
 *
 * Everything else in there is one person's view of the drawing — where they have scrolled, how far
 * they have zoomed, what they have selected, which tool they are holding — and sharing any of it would
 * mean dragging everyone's canvas about as one person works.
 */
const SHARED_APP_STATE = ['viewBackgroundColor', 'gridSize']

/**
 * The client id this seed is written under.
 *
 * Pinned so that two browsers opening the same empty room in the same instant produce byte-identical
 * operations and the room ends up with one drawing rather than two — the reasoning is
 * `editor/visual/collab.js`'s, in full.
 *
 * And a THIRD distinct value, for the reason that file gives for needing a second: an update is
 * identified by its client id and a clock counting from there, so a seed reusing an id the document
 * has already seen is discarded in silence. The server's is 0, the Visual editor's is 1. A page has
 * one editor so these can never meet in one room, but they are one constant apiece and getting it
 * wrong looks like a page that opens blank and then saves over itself.
 */
const SEED_CLIENT_ID = 2

export function collabElements(ydoc) {
  return ydoc.getMap(ELEMENTS)
}

export function collabFiles(ydoc) {
  return ydoc.getMap(FILES)
}

export function collabScene(ydoc) {
  return ydoc.getMap(SCENE)
}

/**
 * Fill the room from this browser's copy of the drawing, if nobody has filled it yet.
 *
 * Asked once the document has synced, so "empty" means the room genuinely holds nothing rather than
 * that this browser has not heard about it yet. A room somebody is already in is left alone: what it
 * holds is the drawing as it stands, unsaved changes and all, and it outranks what this browser loaded
 * from the API.
 *
 * @returns {boolean} Whether this call was the one that seeded it.
 */
export function seedIfEmpty(ydoc, scene) {
  if (collabElements(ydoc).size > 0 || collabScene(ydoc).size > 0) {
    return false
  }
  const scratch = new Y.Doc()
  scratch.clientID = SEED_CLIENT_ID
  scratch.transact(() => {
    const elements = scratch.getMap(ELEMENTS)
    for (const element of scene.elements ?? []) {
      elements.set(element.id, element)
    }
    const files = scratch.getMap(FILES)
    for (const [id, file] of Object.entries(scene.files ?? {})) {
      files.set(id, { ...file, dataURL: toStoredPath(file?.dataURL) })
    }
    const state = scratch.getMap(SCENE)
    for (const key of SHARED_APP_STATE) {
      state.set(key, scene.appState?.[key] ?? null)
    }
  })
  Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(scratch))
  scratch.destroy()
  return true
}

/**
 * Write what this author has just done into the shared document.
 *
 * Diffed against the last state this function was given rather than sent wholesale: Excalidraw calls
 * `onChange` for everything, a pointer moving included, and re-setting two hundred unchanged elements
 * on every frame would put all of them through the sync and the postgres relay. `version` is
 * Excalidraw's own counter and is bumped on every change to an element, so comparing it is both
 * cheaper and more accurate than comparing the objects.
 *
 * One transaction, so the whole of a change reaches the others as one update.
 *
 * @param {object} previous The elements by id as they were last time, which this returns the next of.
 * @returns {Map<string, object>} What to pass as `previous` next time.
 */
export function publishScene(ydoc, scene, previous) {
  const next = new Map()
  for (const element of scene.elements ?? []) {
    next.set(element.id, element)
  }

  const yElements = collabElements(ydoc)
  const yFiles = collabFiles(ydoc)
  const yScene = collabScene(ydoc)

  ydoc.transact(() => {
    for (const [id, element] of next) {
      const before = previous.get(id)
      if (!before || before.version !== element.version) {
        yElements.set(id, element)
      }
    }
    /*
      An element this author no longer has is REMOVED from the map, which is not the same thing as
      deleting a shape -- a delete arrives as a tombstone above, and is a change like any other. This
      is the case where an element left the scene without one, which is what an undo of its creation
      does, and leaving it in the map would put it back on everybody else's canvas.
    */
    for (const id of previous.keys()) {
      if (!next.has(id)) {
        yElements.delete(id)
      }
    }
    for (const [id, file] of Object.entries(scene.files ?? {})) {
      if (!yFiles.has(id)) {
        yFiles.set(id, { ...file, dataURL: toStoredPath(file?.dataURL) })
      }
    }
    for (const key of SHARED_APP_STATE) {
      const value = scene.appState?.[key] ?? null
      if (yScene.get(key) !== value) {
        yScene.set(key, value)
      }
    }
  })

  return next
}

/**
 * The drawing as the shared document has it.
 *
 * Sorted by each element's fractional index, which is what z order means here. An element with none is
 * one Excalidraw has not indexed yet; those keep the order the map gives them and are put at the back,
 * where the editor assigns them an index of their own on the next change.
 */
export function readScene(ydoc) {
  const elements = [...collabElements(ydoc).values()].sort((a, b) => {
    if (a.index == null || b.index == null) {
      return a.index == null ? (b.index == null ? 0 : 1) : -1
    }
    return a.index < b.index ? -1 : a.index > b.index ? 1 : 0
  })
  const files = Object.fromEntries(
    [...collabFiles(ydoc).entries()].map(([id, file]) => [
      id,
      { ...file, dataURL: toLiveUrl(file?.dataURL) }
    ])
  )
  const appState = {}
  for (const key of SHARED_APP_STATE) {
    const value = collabScene(ydoc).get(key)
    if (value !== undefined) {
      appState[key] = value
    }
  }
  return { elements, files, appState }
}

/**
 * Everyone else in the room, in the shape Excalidraw draws cursors from.
 *
 * Keyed by the awareness client id turned into a string, which is what Excalidraw calls a socket id
 * and only ever uses as a key. This author is left out: the editor knows where its own pointer is.
 *
 * @param {object} awareness The provider's, which carries the same `user` field the other editors set
 *   — see `composables/collab.js`, which is where the colour and the name come from.
 */
export function collabParticipants(awareness) {
  const collaborators = new Map()
  for (const [clientId, state] of awareness.getStates()) {
    if (clientId === awareness.clientID || !state?.user) {
      continue
    }
    collaborators.set(String(clientId), {
      id: state.user.id,
      username: state.user.name,
      // -> The same picture the presence bar draws, so the face on the cursor and the face in the
      //    header are the same person. Absent where there is none: Excalidraw draws initials then,
      //    where an `<img>` at a URL answering 404 would draw a broken one
      ...(state.user.hasAvatar && { avatarUrl: `/_user/${state.user.id}/avatar` }),
      color: { background: state.user.color, stroke: state.user.color },
      ...(state.pointer && { pointer: { ...state.pointer, tool: 'pointer' } }),
      ...(state.button && { button: state.button })
    })
  }
  return collaborators
}
