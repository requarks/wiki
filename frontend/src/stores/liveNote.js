import { defineStore } from 'pinia'

import { useSiteStore } from './site'
import { useUserStore } from './user'

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
 * What a note key may be: letters, digits and hyphens, 1 to 64 of them. Mirrors `KEY_PATTERN` in the
 * backend's `models/liveNotes.ts`. A generated key is 24 of them; a longer or shorter one is a key
 * somebody picked by visiting `/n/<key>`.
 */
export const NOTE_KEY_PATTERN = /^[A-Za-z0-9-]{1,64}$/

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
    render: '',
    /**
     * What this session may do with the site's live notes at all, before any one note:
     * `read:notes` and `write:notes`, asked once per site and session (`notes/_access`). Not part of
     * `userStore.pagePermissions`, for the reason the glossary's is not -- the rules' path is
     * ignored, and the New menu and the profile have to know on routes that are not a page. Kept
     * across `close`, which is about the note that was open.
     */
    siteAccess: { loadedFor: null, canRead: false, canWrite: false }
  }),
  getters: {
    title: (state) => (state.content ? noteTitleOf(state.content) : state.storedTitle),
    /**
     * Everything the access answer depends on: the site, who is asking, and the two switches that
     * make up whether the site has notes. Whatever changes it is a reason to ask again.
     */
    accessKey() {
      const siteStore = useSiteStore()
      const userStore = useUserStore()
      return [
        siteStore.id,
        userStore.authenticated ? userStore.id : 'guest',
        siteStore.features.liveNotes ? 'on' : 'off',
        siteStore.features.collaborativeEditing ? 'on' : 'off'
      ].join(':')
    },
    /** Whether the site has live notes and this session may open one. */
    canRead: (state) => state.siteAccess.canRead,
    /** Whether the site has live notes and this session may create them and write in them. */
    canCreate: (state) => state.siteAccess.canWrite
  },
  actions: {
    /**
     * Fetch the access answer, unless it is already the one for `accessKey`. A failure leaves notes
     * unavailable rather than throwing: a missing menu row is the right answer to not knowing.
     */
    async ensureAccess() {
      const siteStore = useSiteStore()
      if (!siteStore.id) {
        return
      }
      const key = this.accessKey
      if (this.siteAccess.loadedFor === key) {
        return
      }
      this.siteAccess = { loadedFor: key, canRead: false, canWrite: false }
      if (!siteStore.features.liveNotes || !siteStore.features.collaborativeEditing) {
        return
      }
      try {
        const resp = await API_CLIENT.get(`sites/${siteStore.id}/notes/_access`).json()
        // -> Asked again for somebody else while this was in flight: that answer is the one to keep
        if (this.siteAccess.loadedFor === key) {
          this.siteAccess = {
            loadedFor: key,
            canRead: resp.enabled && resp.canRead,
            canWrite: resp.enabled && resp.canWrite
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch live notes access: ${err.message}`)
      }
    },
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
    /**
     * Create an empty note, answering with its key — what its URL is made of. Under `key` when one is
     * given, which the server refuses with 409 if a note already has it; generated otherwise.
     */
    async create(key) {
      const siteStore = useSiteStore()
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/notes`, {
        json: key ? { key } : {}
      }).json()
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
      const siteAccess = this.siteAccess
      this.$reset()
      this.siteAccess = siteAccess
    }
  }
})
