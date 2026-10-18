import { defineStore } from 'pinia'

import { useSiteStore } from './site'

/**
 * The note's title: its first heading, the way HedgeDoc names a note.
 *
 * Mirrors `titleOf` in the backend's `models/liveNotes.ts`, which stores the same answer for the note
 * as a whole. Read here off the text being typed, so that the tab and the bar above the editor follow
 * the heading as it is written rather than a persist later.
 */
export function noteTitleOf(content) {
  let fence = null
  for (const line of (content ?? '').split('\n')) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      if (fence === null) {
        fence = fenceMatch[1][0]
      } else if (fenceMatch[1][0] === fence) {
        fence = null
      }
      continue
    }
    if (fence !== null) {
      continue
    }
    const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      return heading[1]
    }
  }
  return ''
}

/**
 * The live note that is open, if one is.
 *
 * What the page store is to the page editor: where the Markdown editor puts the source it is holding
 * and the render it made of it, when it is editing a note rather than a page — see `noteKey` in
 * `EditorMarkdown.vue`. Kept apart from the page store on purpose. A note is not a page, and nothing
 * that watches the page store — the unsaved-changes guard, the editor buffer, the header's Save
 * button — has any business reacting to one.
 *
 * The content is never loaded from the API. The collaboration room holds it, and the editor's binding
 * is what writes it here.
 */
export const useLiveNoteStore = defineStore('liveNote', {
  state: () => ({
    id: '',
    key: '',
    /** The title the server last stored, used until the room has delivered the text itself. */
    storedTitle: '',
    /** `editable`, `locked` or `private`: what everybody but the note's owners may do with it. */
    access: 'editable',
    /** Whether this reader is one of its owners: may change its access, and delete it. */
    canManage: false,
    /** Whether this reader may write in it -- false for a locked note that is not theirs. */
    canWrite: false,
    createdAt: null,
    /** When somebody last typed into the note: as loaded, then as edits arrive — see `markEdited`. */
    updatedAt: null,
    /** `{ id, name }` of whoever created the note, or null once that account is gone. */
    creator: null,
    /** `{ id, name }` of whoever typed into it last, or null for a note nobody has typed into. */
    lastEditor: null,
    content: '',
    render: ''
  }),
  getters: {
    title: (state) => (state.content ? noteTitleOf(state.content) : state.storedTitle)
  },
  actions: {
    /**
     * Read the note behind a key. Throws what the API threw, so the caller can tell a note that does
     * not exist (404) from a site without notes (403) and a reader who is not signed in (401).
     */
    async load(key) {
      const siteStore = useSiteStore()
      const note = await API_CLIENT.get(`sites/${siteStore.id}/notes/${key}`).json()
      this.$patch({
        id: note.id,
        key: note.key,
        storedTitle: note.title,
        access: note.access,
        canManage: note.canManage,
        canWrite: note.canWrite,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        creator: note.creator ?? null,
        lastEditor: note.lastEditor ?? null,
        content: '',
        render: ''
      })
    },
    /** Create an empty note, answering with its key — the 24 characters of its URL. */
    async create() {
      const siteStore = useSiteStore()
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/notes`).json()
      return resp.note.key
    },
    /**
     * Somebody just typed into the note -- this reader or another, as `composables/collab.js` tells
     * them apart. What the server stores is the same answer, worked out by the room; this is only so
     * that the line above the editor follows it live instead of from the load.
     *
     * The same person still typing moves the time on at most every few seconds, since the line reads
     * "just now" for a minute anyway and every keystroke would otherwise be a store write.
     */
    markEdited(person) {
      const now = Temporal.Now.instant()
      if (
        this.lastEditor?.id === person.id &&
        this.updatedAt &&
        Temporal.Instant.from(this.updatedAt).until(now).total('seconds') < 5
      ) {
        return
      }
      this.$patch({
        lastEditor: { id: person.id, name: person.name },
        updatedAt: now.toString({ smallestUnit: 'millisecond' })
      })
    },
    /** Change who besides its owners may read and write the note. Owners only; the server checks. */
    async setAccess(access) {
      const siteStore = useSiteStore()
      await API_CLIENT.put(`sites/${siteStore.id}/notes/${this.key}/access`, { json: { access } })
      this.access = access
    },
    setRender(html) {
      this.render = html
    },
    close() {
      this.$reset()
    }
  }
})
