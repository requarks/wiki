import { defineStore } from 'pinia'

/**
 * Who else is editing the page that is open, and whether we are still hearing from them.
 *
 * The reactive face of `composables/collab.js`, which owns the Yjs document and the websocket and is
 * the only thing that writes here. Split off so that components — the avatars in the page header, the
 * editor itself — can read the session without touching any of that machinery.
 */
export const useCollabStore = defineStore('collab', {
  state: () => ({
    /**
     * - `off` — not collaborating: no session, or the site has the feature turned off
     * - `connecting` — the socket is up but the document has not been synced yet
     * - `connected` — live
     * - `disconnected` — the connection dropped and is being retried; edits are still safe locally
     * - `denied` — the server refused the session and retrying will not help
     */
    status: 'off',
    /**
     * Whether the document has been synced at least once this session.
     *
     * A reconnection goes back through `connecting`, and the editor must not lock itself again over
     * it: by then there is a document in front of the author and edits made while the socket is down
     * are merged when it comes back. Only the very first sync is worth waiting for.
     */
    hasSynced: false,
    /** One entry per open editor, so the same person in two tabs appears twice. */
    participants: [],
    /**
     * When each person was last seen typing, as epoch milliseconds keyed by user id -- what the
     * avatars in the header rank people by, to decide whose faces are shown (`CollabPresence.vue`).
     * Absent for somebody who has not typed this session. Replaced rather than mutated, so that a
     * watcher on it hears every change.
     */
    activeAt: {},
    /**
     * Whose faces the header shows besides the reader's own, by user id, in the order they are drawn --
     * kept by `CollabPresence.vue`, which decides it. Here rather than in the component so that it
     * outlives the component: the header drops the row below a width and draws it again above it, and
     * a row that started over each time would reshuffle every face on a resize.
     */
    shownIds: [],
    /**
     * The last save anyone made to this page while the session has been open, as the server reported
     * it. Set only for a save that arrives during the session — the value a joining editor inherits
     * from the room is history, not news.
     */
    lastSave: null
  }),
  getters: {
    isLive: (state) => state.status === 'connected',
    /**
     * One entry per person rather than per editor, which is what the header shows: two tabs are still
     * one face. Ordered with yourself first, as Google Docs and friends do.
     */
    people: (state) => {
      const seen = new Map()
      for (const participant of state.participants) {
        const existing = seen.get(participant.id)
        if (existing) {
          // -> Two tabs are one face, and that face is typing if either of them is
          existing.typing = existing.typing || participant.typing
        } else {
          // -> Copied, since the merge above would otherwise write into the awareness snapshot
          seen.set(participant.id, { ...participant })
        }
      }
      return [...seen.values()].sort((a, b) => Number(b.isSelf) - Number(a.isSelf))
    }
  },
  actions: {
    /**
     * Who is in the room now, as `composables/collab.js` reads it off the awareness states -- and when
     * each of them was last active. Typing is broadcast as two transitions rather than per keystroke,
     * so somebody is stamped both as they start and as they stop: the stop is the last moment they
     * were seen at it.
     */
    setParticipants(participants) {
      const wasTyping = new Set(this.participants.filter((p) => p.typing).map((p) => p.id))
      const now = Date.now()
      let activeAt = null
      for (const participant of participants) {
        if (participant.typing || wasTyping.has(participant.id)) {
          activeAt ??= { ...this.activeAt }
          activeAt[participant.id] = now
        }
      }
      this.participants = participants
      if (activeAt) {
        this.activeAt = activeAt
      }
    },
    reset() {
      this.$patch({
        status: 'off',
        hasSynced: false,
        participants: [],
        activeAt: {},
        shownIds: [],
        lastSave: null
      })
    }
  }
})
