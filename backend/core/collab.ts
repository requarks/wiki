import { sql } from 'drizzle-orm'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as Y from 'yjs'

import { createNotifier } from '../helpers/pubsub.ts'

import type { PoolClient } from 'pg'
import type { WebSocket } from 'ws'

/**
 * Live collaborative editing.
 *
 * A room is one page being edited by more than one person at a time. It holds a Yjs document — the
 * markdown source as a `Y.Text`, the header fields as a `Y.Map` — and the awareness state that carries
 * everyone's cursor and identity. Clients speak the y-websocket protocol to it, which is why the
 * message framing below is byte-compatible with `y-websocket`'s client rather than something of our
 * own: the browser side is that library, unmodified.
 *
 * **A room is not storage.** Nothing here is ever written back to the page — saving is still an
 * explicit act, `PATCH /pages/:id` as it always was, and a room that empties out takes any unsaved text
 * with it exactly as closing the editor always has. What a room adds is that the text survives *one*
 * participant leaving, because the others are still holding it.
 *
 * ## Across instances
 *
 * Rooms live in memory, so two people served by different instances would otherwise never meet. Their
 * updates are relayed over postgres LISTEN/NOTIFY on a channel of this module's own, separate from the
 * `wiki` channel that carries the general event bus: these are frequent, binary, and worthless a
 * second after they are sent, and none of that describes an event bus message.
 *
 * NOTIFY caps a payload at 8000 bytes, so a relayed message is base64'd and split into chunks that fit
 * — see {@link relay}. Chunks of one message arrive in order, postgres guaranteeing that much per
 * connection.
 *
 * ## Where a room's starting state comes from
 *
 * This is the one genuinely delicate part. A Yjs document cannot simply be seeded twice: two instances
 * that each insert the page's text into their own replica produce two *different* sets of operations
 * that both say "insert this text", and merging those replicas concatenates them — the document ends
 * up holding the page twice. So a room being created asks the cluster first ({@link peerState}) and
 * only falls back to the stored page when nobody answers.
 *
 * Two instances cold-starting the same room in the same instant would still both fall back, so that
 * seed is made *deterministic*: it is built in a scratch document pinned to client id 0, and two seeds
 * of identical text therefore produce byte-identical operations, which merge as one. That is also what
 * lets a client reconnect after a network blip and push back the edits it made while it was away — its
 * local copy of the seed is the same seed a freshly created room builds.
 *
 * ## Live notes
 *
 * The one kind of room that IS storage. A live note (`models/liveNotes.ts`) has no save: its room
 * writes its document to the note as it changes — {@link NOTE_PERSIST_DELAY} after the last edit, and
 * at least every {@link NOTE_PERSIST_MAX_WAIT} while edits keep coming — and once more when the last
 * participant leaves, before the room is dropped. It starts from that stored document rather than from
 * a seed, which is what keeps a reconnecting client's offline edits mergeable after the room was gone.
 * A note room's id is the note's id with {@link NOTE_ROOM_PREFIX} in front, so it can never be taken
 * for a page's.
 */

/** y-websocket message types. The values are that protocol's, not ours. */
const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

const NOTIFY_CHANNEL = 'wiki_collab'

/**
 * Base64 characters per NOTIFY payload. Postgres refuses a payload over 8000 bytes, and the JSON
 * envelope around the chunk fits comfortably in the slack this leaves.
 */
const RELAY_CHUNK_SIZE = 5000

/** How long a half-assembled relay message waits for the rest of its chunks before being dropped. */
const RELAY_REASSEMBLY_TIMEOUT = 10 * 1000

/**
 * How long a new room waits for a peer to hand over the state it already has, before seeding itself
 * from the stored page. Only paid when this instance does not already have the room open, and skipped
 * entirely when no other instance is running — which is the ordinary case.
 */
const PEER_STATE_TIMEOUT = 500

/** How long the "is anyone else running?" answer is trusted before it is looked up again. */
const PEER_PRESENCE_TTL = 15 * 1000

/** Keepalive interval. An idle websocket is what a reverse proxy cuts first. */
const PING_INTERVAL = 30 * 1000

/** How long a live note waits after the last edit before writing itself to the database. */
const NOTE_PERSIST_DELAY = 2 * 1000

/** The longest a live note goes unwritten while somebody is typing into it without pause. */
const NOTE_PERSIST_MAX_WAIT = 10 * 1000

/** What a live note's room id starts with — the rest is the note's id. */
const NOTE_ROOM_PREFIX = 'note:'

/**
 * Marks a document or awareness change as having arrived over the relay, so that applying it here does
 * not send it straight back out to the instance it came from.
 */
const RELAYED = Symbol('collabRelayed')

interface CollabConn {
  /** Awareness client ids this socket is responsible for, so a disconnect can retract exactly those. */
  clients: Set<number>
  /** Answered the last keepalive ping. */
  alive: boolean
  /**
   * Who is on the other end — what a live note records as having written into it. Null for a guest
   * reading a live note, who is always `readOnly` and so never writes anything to record.
   */
  userId: string | null
  /**
   * May read the room and not write to it: in a live note, anybody who may not write in it — a reader
   * of a locked note, an account without `write:notes`, a guest. Their edits are dropped here rather
   * than trusted to the editor to have been read-only.
   */
  readOnly: boolean
  /** One of a live note's owners, whom changing its access never disconnects. See `noteAccessChanged`. */
  manager: boolean
}

/** Who a socket joining a room is, and what they may do in it — decided by the caller. */
export interface RoomMember {
  userId: string | null
  readOnly?: boolean
  manager?: boolean
}

/** What a room is gathered around: a page being edited, or a live note. */
export interface RoomTarget {
  kind: 'page' | 'note'
  id: string
  siteId: string
}

/** What a live note's room carries on top of an ordinary one: its write-back. */
interface NoteRoomState {
  noteId: string
  /** Who has typed into this room since its last persist. */
  authors: Set<string>
  /** Which of them typed most recently — the note's last editor, once written. */
  lastAuthor: string | null
  /** The debounced persist, and when the first edit it is holding was made. */
  persistTimer: NodeJS.Timeout | null
  firstUnpersistedAt: number | null
  /** A persist arranged for when the next revision falls due. See `PersistResult.revisionDueAt`. */
  revisionTimer: NodeJS.Timeout | null
  /** The persist in flight, so that they run one at a time and closing can wait for the last. */
  writing: Promise<void>
  /** Something was typed into this room since its last persist. */
  dirty: boolean
  /** The last persist left a revision for this room to take when its interval is up. */
  revisionDue: boolean
}

interface CollabSession {
  /** The room this socket ended up in, or null while it is still being decided. */
  room: CollabRoom | null
  /** Frames that arrived before there was a room to hand them to. */
  pending: Uint8Array[]
}

interface CollabRoom {
  /** The page's id, or the note's behind {@link NOTE_ROOM_PREFIX}. What the relay addresses it by. */
  id: string
  target: RoomTarget
  /** Set for a live note's room, and only for one. */
  note: NoteRoomState | null
  doc: Y.Doc
  awareness: awarenessProtocol.Awareness
  conns: Map<WebSocket, CollabConn>
  /** Resolves once the document holds its starting state and clients may be synced against it. */
  ready: Promise<void>
  /** Whether this room is still filling itself, i.e. has nothing worth handing to a peer yet. */
  provisional: boolean
}

interface SaveInfo {
  versionDate: string
  authorId: string
  authorName: string
}

interface RelayEnvelope {
  /** Instance the message came from. */
  i: string
  /** Room: a page id, or a note's id behind `NOTE_ROOM_PREFIX`. */
  r: string
  t: 'update' | 'awareness' | 'hello' | 'state' | 'saved' | 'deleted' | 'access'
  /** Payload: base64 for the binary kinds, JSON for `saved`, absent for `hello`. */
  p?: string
  /** Instance this is addressed to, when it is a reply rather than a broadcast. */
  to?: string
  /** Chunking: message id, chunk index, chunk count. Absent on a message that fits in one. */
  m?: string
  c?: number
  n?: number
}

interface PartialRelay {
  parts: (string | undefined)[]
  remaining: number
  timer: NodeJS.Timeout
}

/**
 * A websocket frame as bytes, whatever shape `ws` handed it over in.
 *
 * A fragmented message arrives as an array of buffers, and a whole one as a single `Buffer` — which is
 * a view into a larger pool, so its offset and length matter. The result is a view over that same
 * memory and is only safe to read during the event that delivered it; anything held on to has to be
 * copied first.
 */
function toBytes(data: unknown): Uint8Array {
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data))
  }
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  return new Uint8Array(data as ArrayBuffer)
}

/**
 * The editors whose source is not text, and whose shared document the server therefore cannot build.
 *
 * A room holds the header fields for every editor, and the `content` text for the ones that edit one.
 * Markdown and AsciiDoc are bound straight to that text. The Visual editor is not — a ProseMirror
 * document is a tree, shared as a `Y.XmlFragment` — but its SOURCE is still the markdown in `content`,
 * so seeding the text costs nothing and the two live side by side.
 *
 * Excalidraw is the case where seeding it is wrong rather than merely unused. Its source is a JSON
 * scene, routinely tens of kilobytes of it, and putting that in a `Y.Text` nobody binds would push a
 * dead copy of the whole drawing through the sync, through the relay and into every participant — a
 * second representation of the page, growing with it, that no client ever reads. So the room gets the
 * header fields and nothing else, and the drawing is seeded by the first browser in, the way the
 * Visual editor seeds its fragment. See `editor/excalidraw/collab.js`.
 */
const CANVAS_EDITORS = new Set(['excalidraw'])

/** The key a room is held and relayed under. A page's is its id, for `pageSaved` to find it by. */
function roomIdOf(target: RoomTarget): string {
  return target.kind === 'note' ? `${NOTE_ROOM_PREFIX}${target.id}` : target.id
}

/**
 * The state a room starts from when it has to build one itself, as a Yjs update.
 *
 * Built in a scratch document whose client id is pinned to 0, so that the bytes depend on nothing but
 * the page — see the note at the top of this file on why that matters.
 */
function buildSeed(page: {
  editor?: string | null
  content?: string | null
  title?: string | null
  description?: string | null
  icon?: string | null
}): Uint8Array {
  const seed = new Y.Doc()
  seed.clientID = 0
  seed.transact(() => {
    if (!CANVAS_EDITORS.has(page.editor ?? '')) {
      seed.getText('content').insert(0, page.content ?? '')
    }
    const props = seed.getMap('props')
    props.set('title', page.title ?? '')
    props.set('description', page.description ?? '')
    props.set('icon', page.icon ?? '')
  })
  const update = Y.encodeStateAsUpdate(seed)
  seed.destroy()
  return update
}

/**
 * Sends this instance's relay messages, one at a time.
 *
 * Every one of them starts in a Yjs handler that cannot wait for postgres, and a single edit can
 * produce several — see `publish`.
 */
const notifier = createNotifier(() => WIKI.collab.listenClient, 'collaboration relay')

export default {
  rooms: new Map<string, CollabRoom>(),
  listenClient: null as PoolClient | null,
  /** Chunked relay messages still waiting for the rest of themselves, keyed by sender and message id. */
  partials: new Map<string, PartialRelay>(),
  /** Rooms this instance is waiting on a peer's state for, by page id. */
  awaitingState: new Map<string, (update: Uint8Array) => void>(),
  relaySeq: 0,
  peerPresence: { known: false, checkedAt: 0 },
  pingTimer: null as NodeJS.Timeout | null,

  /**
   * Open the relay connection.
   *
   * A client of its own rather than the event bus's: these messages are far more frequent than events
   * are, and a slow consumer on one channel should not hold up the other.
   */
  async init(): Promise<void> {
    this.listenClient = await WIKI.dbManager.pool!.connect()
    await this.listenClient.query(`SET application_name = 'Wiki.js - ${WIKI.INSTANCE_ID}:COLLAB'`)
    this.listenClient.on('notification', (msg) => {
      if (msg.channel !== NOTIFY_CHANNEL || !msg.payload) {
        return
      }
      try {
        this.receiveRelay(JSON.parse(msg.payload) as RelayEnvelope)
      } catch (err: any) {
        WIKI.logger.warn(`Malformed collaboration relay message: ${err.message}`)
      }
    })
    await this.listenClient.query(`LISTEN ${NOTIFY_CHANNEL}`)

    this.pingTimer = setInterval(() => {
      for (const room of this.rooms.values()) {
        for (const [conn, state] of room.conns) {
          // -> A socket whose peer stopped answering is dropped by the `close` handler that
          //    `terminate()` triggers, which is also what takes its cursor off everyone's screen
          if (!state.alive) {
            conn.terminate()
            continue
          }
          state.alive = false
          try {
            conn.ping()
          } catch {}
        }
      }
    }, PING_INTERVAL)

    WIKI.logger.info('Collaborative editing initialized successfully: [ OK ]')
  },

  async shutdown(): Promise<void> {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    for (const partial of this.partials.values()) {
      clearTimeout(partial.timer)
    }
    this.partials.clear()
    /*
      Live notes write themselves out before their sockets go: what a note's room holds past its last
      persist is otherwise only in the browsers, and those are about to be told to go elsewhere.
    */
    await Promise.all(
      [...this.rooms.values()]
        .filter((room) => room.note)
        .map((room) => this.persistNote(room, true))
    )
    for (const room of this.rooms.values()) {
      if (room.note) {
        this.cancelNoteTimers(room.note)
      }
      for (const conn of room.conns.keys()) {
        conn.close(1001, 'Server is shutting down')
      }
      room.awareness.destroy()
      room.doc.destroy()
    }
    this.rooms.clear()
    if (this.listenClient) {
      // -> Whatever is still on its way out goes out first: releasing the client from under a
      //    notification in flight would fail that one for no reason
      await notifier.drained()
      this.listenClient.release(true)
      this.listenClient = null
    }
  },

  /**
   * Whether another instance is currently running.
   *
   * Asked so that the single-instance case — very much the common one — does not spend
   * {@link PEER_STATE_TIMEOUT} waiting for an answer that cannot come. Instances are not registered
   * anywhere, so this reads what the admin area's instance list reads: our own connections name
   * themselves in `pg_stat_activity`.
   */
  async hasPeers(): Promise<boolean> {
    const now = Date.now()
    if (now - this.peerPresence.checkedAt < PEER_PRESENCE_TTL) {
      return this.peerPresence.known
    }
    const ownName = `Wiki.js - ${WIKI.INSTANCE_ID}:COLLAB`
    try {
      const result = await WIKI.db.execute(
        sql`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
              AND application_name LIKE 'Wiki.js - %:COLLAB'
              AND application_name <> ${ownName} LIMIT 1`
      )
      this.peerPresence = { known: result.rows.length > 0, checkedAt: now }
    } catch (err: any) {
      // -> Assume company: waiting 500ms is a far smaller mistake than duplicating a page's text
      WIKI.logger.warn(`Could not determine whether other instances are running: ${err.message}`)
      this.peerPresence = { known: true, checkedAt: now }
    }
    return this.peerPresence.known
  },

  /**
   * Start listening to a socket before anything is known about it.
   *
   * Called the instant the socket opens, and synchronously — the client does not wait to be welcomed.
   * y-websocket sends its first sync message immediately, while the route is still away asking the
   * database whether this user may edit this page at all, and an event nobody is listening for is
   * simply gone. That one message is the whole handshake: miss it and the client sits there holding an
   * empty document, because it is never going to ask twice.
   *
   * So the frames are collected here and replayed by {@link join} once there is a room to put them to.
   */
  capture(conn: WebSocket): CollabSession {
    const session: CollabSession = { room: null, pending: [] }
    conn.on('message', (data: unknown) => {
      if (session.room) {
        this.onMessage(session.room, conn, toBytes(data))
      } else {
        // -> Copied, not referenced: `toBytes` hands back a view into a buffer `ws` owns, which is
        //    only good for the length of this event
        session.pending.push(new Uint8Array(toBytes(data)))
      }
    })
    conn.on('close', () => {
      if (session.room) {
        this.onClose(session.room, conn)
      }
    })
    conn.on('error', (err: Error) => {
      WIKI.logger.debug(`Collaboration socket error: ${err.message}`)
    })
    return session
  },

  /**
   * Put a socket into a page's or a note's room, syncing it against whatever state that room holds.
   *
   * The caller is responsible for having decided that this user may edit what the room is about — see
   * `controllers/collab.ts`. Nothing below re-checks it.
   */
  async join(
    conn: WebSocket,
    target: RoomTarget,
    session: CollabSession,
    member: RoomMember
  ): Promise<void> {
    const roomId = roomIdOf(target)
    /*
      Asked for repeatedly, because a room can be dropped while this socket was waiting for it: another
      socket that gave up during the same setup takes the still-empty room down with it. Joining that
      one would put this editor in a room nothing else can find.
    */
    let room = await this.ensureRoom(target)
    for (let attempt = 0; this.rooms.get(roomId) !== room && attempt < 3; attempt++) {
      room = await this.ensureRoom(target)
    }

    // -> The socket may well have gone away while the room was being set up
    if (conn.readyState !== conn.OPEN) {
      this.closeRoomIfEmpty(room)
      return
    }

    const state: CollabConn = {
      clients: new Set(),
      alive: true,
      userId: member.userId,
      readOnly: member.readOnly ?? false,
      manager: member.manager ?? false
    }
    room.conns.set(conn, state)
    conn.on('pong', () => {
      state.alive = true
    })
    session.room = room

    // -> Sync step 1: what this room has, so the client can say what it is missing
    const syncEncoder = encoding.createEncoder()
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(syncEncoder, room.doc)
    this.send(conn, encoding.toUint8Array(syncEncoder))

    // -> And everyone already in the room, so their cursors are there from the first frame
    const states = room.awareness.getStates()
    if (states.size > 0) {
      const awarenessEncoder = encoding.createEncoder()
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...states.keys()])
      )
      this.send(conn, encoding.toUint8Array(awarenessEncoder))
    }

    for (const message of session.pending) {
      this.onMessage(room, conn, message)
    }
    session.pending = []
  },

  /**
   * The room for a page or a note, creating and populating it if this instance does not have it open.
   *
   * Concurrent joiners share one room *and one initialization*: the room goes into the map before it
   * has any state, and `ready` is what everything else waits on.
   */
  async ensureRoom(target: RoomTarget): Promise<CollabRoom> {
    const roomId = roomIdOf(target)
    const existing = this.rooms.get(roomId)
    if (existing) {
      await existing.ready
      return existing
    }

    const doc = new Y.Doc()
    const awareness = new awarenessProtocol.Awareness(doc)
    // -> The server is not a participant. Left as it comes, its own empty state would show up in the
    //    room as a cursor nobody owns, and be relayed to every other instance as one.
    awareness.setLocalState(null)

    const room: CollabRoom = {
      id: roomId,
      target,
      note:
        target.kind === 'note'
          ? {
              noteId: target.id,
              authors: new Set(),
              lastAuthor: null,
              persistTimer: null,
              firstUnpersistedAt: null,
              revisionTimer: null,
              writing: Promise.resolve(),
              dirty: false,
              revisionDue: false
            }
          : null,
      doc,
      awareness,
      conns: new Map(),
      ready: Promise.resolve(),
      provisional: true
    }
    this.rooms.set(roomId, room)

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      const message = encoding.toUint8Array(encoder)
      for (const conn of room.conns.keys()) {
        this.send(conn, message)
      }
      if (origin !== RELAYED) {
        this.relay({ r: room.id, t: 'update', p: Buffer.from(update).toString('base64') })
        /*
          A note writes back what was typed into it HERE. An update relayed from another instance is
          that instance's to write, and the room's own starting state is what was just read.
        */
        if (room.note) {
          const author = room.conns.get(origin as WebSocket)?.userId
          if (author) {
            room.note.authors.add(author)
            room.note.lastAuthor = author
          }
          this.scheduleNotePersist(room)
        }
      }
    })

    awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown
      ) => {
        const changed = [...added, ...updated, ...removed]
        // -> Remember whose cursors these are, so that a disconnect can retract exactly them
        const owner = room.conns.get(origin as WebSocket)
        if (owner) {
          for (const clientId of added) {
            owner.clients.add(clientId)
          }
          for (const clientId of removed) {
            owner.clients.delete(clientId)
          }
        }
        const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changed)
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
        encoding.writeVarUint8Array(encoder, update)
        const message = encoding.toUint8Array(encoder)
        for (const conn of room.conns.keys()) {
          this.send(conn, message)
        }
        if (origin !== RELAYED) {
          this.relay({
            r: room.id,
            t: 'awareness',
            p: Buffer.from(update).toString('base64')
          })
        }
      }
    )

    room.ready = this.initRoom(room)
    await room.ready
    return room
  },

  /**
   * Fill a newly created room with the state it should start from: a peer's copy if the cluster
   * already has this page open, and the stored page if not.
   */
  async initRoom(room: CollabRoom): Promise<void> {
    try {
      /*
        A note starts from what it stored, peer or no peer. Unlike a seed, the stored state is the same
        document every room of this note has ever held — so merging it under a peer's copy adds nothing
        that copy is missing and duplicates nothing it has, and covers a peer that is behind the
        database because the instance that wrote it last has since gone.
      */
      if (room.note) {
        const stored = await WIKI.models.liveNotes.loadState(room.note.noteId)
        if (stored) {
          Y.applyUpdate(room.doc, stored, RELAYED)
        }
      }
      const fromPeer = (await this.hasPeers()) ? await this.peerState(room.id) : null
      if (fromPeer) {
        Y.applyUpdate(room.doc, fromPeer, RELAYED)
      } else if (!room.note) {
        const page = await WIKI.models.pages.getPage({
          siteId: room.target.siteId,
          id: room.target.id,
          withContent: true
        })
        // -> A page that went away between the permission check and here leaves an empty room, which
        //    the first disconnect clears away again
        Y.applyUpdate(room.doc, buildSeed(page ?? {}), RELAYED)
      }
    } catch (err: any) {
      WIKI.logger.warn(`Failed to initialize the collaboration room ${room.id}: ${err.message}`)
    } finally {
      room.provisional = false
      this.awaitingState.delete(room.id)
    }
  },

  /** Ask the cluster for a room's current state, resolving to null if nobody answers in time. */
  peerState(roomId: string): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.awaitingState.delete(roomId)
        resolve(null)
      }, PEER_STATE_TIMEOUT)
      this.awaitingState.set(roomId, (update) => {
        clearTimeout(timer)
        this.awaitingState.delete(roomId)
        resolve(update)
      })
      this.relay({ r: roomId, t: 'hello' })
    })
  },

  onMessage(room: CollabRoom, conn: WebSocket, message: Uint8Array): void {
    try {
      const decoder = decoding.createDecoder(message)
      const encoder = encoding.createEncoder()
      switch (decoding.readVarUint(decoder)) {
        case MESSAGE_SYNC: {
          encoding.writeVarUint(encoder, MESSAGE_SYNC)
          if (room.conns.get(conn)?.readOnly) {
            // -> Asking for the document is all a reader may do; what they send of it is dropped
            if (decoding.readVarUint(decoder) === syncProtocol.messageYjsSyncStep1) {
              syncProtocol.readSyncStep1(decoder, encoder, room.doc)
            }
          } else {
            // -> The socket is the origin, which is how the awareness bookkeeping above knows whose
            //    cursors an update carries
            syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn)
          }
          if (encoding.length(encoder) > 1) {
            this.send(conn, encoding.toUint8Array(encoder))
          }
          break
        }
        case MESSAGE_AWARENESS: {
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            decoding.readVarUint8Array(decoder),
            conn
          )
          break
        }
      }
    } catch (err: any) {
      WIKI.logger.warn(
        `Failed to handle a collaboration message in room ${room.id}: ${err.message}`
      )
    }
  },

  onClose(room: CollabRoom, conn: WebSocket): void {
    const state = room.conns.get(conn)
    room.conns.delete(conn)
    if (state && state.clients.size > 0) {
      // -> Announced as an awareness change, which is what takes the avatar out of the header and the
      //    cursor out of the text for everyone else, here and on every other instance
      awarenessProtocol.removeAwarenessStates(room.awareness, [...state.clients], null)
    }
    this.closeRoomIfEmpty(room)
  },

  /**
   * Drop a room nobody on this instance is in.
   *
   * Immediately, with no grace period: an editor closed without saving has always lost its unsaved
   * text, and a room outliving its last participant would quietly resurrect it on the next visit.
   * Discarding an edit is that same act and needs nothing of its own — the socket closes and the state
   * goes with it.
   *
   * Peers are not told. A room elsewhere is a replica in its own right whose participants are still
   * editing; this instance simply asks for their state again next time someone here opens the page.
   *
   * A live note's room is the exception to "immediately": it writes itself out first — see
   * {@link closeNoteRoom}.
   */
  closeRoomIfEmpty(room: CollabRoom): void {
    if (room.conns.size > 0 || this.rooms.get(room.id) !== room) {
      return
    }
    if (room.note) {
      void this.closeNoteRoom(room)
      return
    }
    this.dropRoom(room)
  },

  dropRoom(room: CollabRoom): void {
    if (room.note) {
      this.cancelNoteTimers(room.note)
    }
    this.rooms.delete(room.id)
    room.awareness.destroy()
    room.doc.destroy()
  },

  // ----------------------------------------
  // Live notes
  // ----------------------------------------

  /**
   * Close a note's room once what it holds is stored.
   *
   * The room stays in the map while the last write is in flight, so that somebody opening the note in
   * that moment joins the room holding the latest text rather than a new one built from a database
   * that does not have it yet — and if anybody did, the room is theirs and stays.
   */
  async closeNoteRoom(room: CollabRoom): Promise<void> {
    this.cancelNoteTimers(room.note!)
    await this.persistNote(room, true)
    if (room.conns.size > 0 || this.rooms.get(room.id) !== room) {
      return
    }
    this.dropRoom(room)
  },

  /**
   * Arrange for a note to be written: {@link NOTE_PERSIST_DELAY} after this edit, unless edits have
   * been arriving for long enough that {@link NOTE_PERSIST_MAX_WAIT} comes first.
   */
  scheduleNotePersist(room: CollabRoom): void {
    const note = room.note!
    note.dirty = true
    const now = Date.now()
    note.firstUnpersistedAt ??= now
    if (note.persistTimer) {
      clearTimeout(note.persistTimer)
    }
    const wait = Math.min(
      NOTE_PERSIST_DELAY,
      Math.max(0, note.firstUnpersistedAt + NOTE_PERSIST_MAX_WAIT - now)
    )
    note.persistTimer = setTimeout(() => {
      note.persistTimer = null
      void this.persistNote(room)
    }, wait)
  },

  /**
   * Write a note's room into the note — see `liveNotes.persist` for what that does with it.
   *
   * Writes are chained, one at a time per room: two in flight would each read the stored state before
   * the other wrote it. A write with nothing to do is skipped, which is most of what a room that only
   * ever received relayed edits does — those are the instance where they were typed's to write.
   *
   * @param final The room is closing, so a revision is taken now if anything changed since the last.
   */
  persistNote(room: CollabRoom, final = false): Promise<void> {
    const note = room.note
    if (!note) {
      return Promise.resolve()
    }
    if (note.persistTimer) {
      clearTimeout(note.persistTimer)
      note.persistTimer = null
    }
    note.firstUnpersistedAt = null
    note.writing = note.writing.then(async () => {
      if (!note.dirty && !note.revisionDue) {
        return
      }
      const authorIds = [...note.authors]
      const lastEditorId = note.lastAuthor
      note.authors.clear()
      note.lastAuthor = null
      note.dirty = false
      try {
        const { revisionDueAt } = await WIKI.models.liveNotes.persist({
          id: note.noteId,
          update: Y.encodeStateAsUpdate(room.doc),
          authorIds,
          lastEditorId,
          final
        })
        if (note.revisionTimer) {
          clearTimeout(note.revisionTimer)
          note.revisionTimer = null
        }
        note.revisionDue = revisionDueAt !== null
        if (revisionDueAt !== null && !final) {
          note.revisionTimer = setTimeout(
            () => {
              note.revisionTimer = null
              void this.persistNote(room)
            },
            Math.max(0, revisionDueAt - Date.now())
          )
        }
      } catch (err: any) {
        /*
          Kept for the next write: what failed to be stored is still in the room, and so is the list
          of who typed it. Not retried on a timer of its own — the next edit schedules one, and the
          room closing makes a final attempt.
        */
        for (const authorId of authorIds) {
          note.authors.add(authorId)
        }
        // -> Unless somebody has typed since, in which case they are the last editor now
        note.lastAuthor ??= lastEditorId
        note.dirty = true
        WIKI.logger.warn(`Failed to store live note ${note.noteId}: ${err.message}`)
      }
    })
    return note.writing
  },

  /**
   * A note was deleted: close its room here and on every other instance.
   *
   * The room is dropped WITHOUT the write closing a room normally ends with -- there is no note left to
   * write to -- and its sockets are closed with 4404, which the browser hands to the page as final (see
   * `connection-close` in `composables/collab.js`): the note view asks for the note again, and finds
   * it gone.
   */
  noteDeleted(noteId: string): void {
    const roomId = `${NOTE_ROOM_PREFIX}${noteId}`
    this.dropDeletedNote(roomId)
    this.relay({ r: roomId, t: 'deleted' })
  },

  /**
   * A note's access changed: everybody in it who is not one of its owners is disconnected, here and on
   * every other instance, with 4409. Their rights may have gone up as well as down, and the handshake is
   * the one place rights are decided -- so they reconnect, the note view asks for the note again
   * (`pages/LiveNote.vue`), and they rejoin as whatever they now are, or are told the note is private.
   * The owners' own sessions are not touched.
   */
  noteAccessChanged(noteId: string): void {
    const roomId = `${NOTE_ROOM_PREFIX}${noteId}`
    this.disconnectNonManagers(roomId)
    this.relay({ r: roomId, t: 'access' })
  },

  disconnectNonManagers(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room?.note) {
      return
    }
    for (const [conn, state] of room.conns) {
      if (!state.manager) {
        conn.close(4409, 'Access to this note has changed')
      }
    }
  },

  dropDeletedNote(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room?.note) {
      return
    }
    const note = room.note
    this.cancelNoteTimers(note)
    // -> A write still queued finds nothing to do; one already under way finds no row, and stops
    note.dirty = false
    note.revisionDue = false
    // -> Out of the map first, so the closes below do not go looking for it to close it again
    this.rooms.delete(roomId)
    for (const conn of room.conns.keys()) {
      conn.close(4404, 'This note has been deleted')
    }
    // -> Not destroyed from under a write that is still reading it
    void note.writing.finally(() => {
      room.awareness.destroy()
      room.doc.destroy()
    })
  },

  cancelNoteTimers(note: NoteRoomState): void {
    if (note.persistTimer) {
      clearTimeout(note.persistTimer)
      note.persistTimer = null
    }
    if (note.revisionTimer) {
      clearTimeout(note.revisionTimer)
      note.revisionTimer = null
    }
  },

  /**
   * Tell everyone editing a page that it has just been saved.
   *
   * Written into the document rather than sent as a message of its own, so that it reaches the other
   * instances the way an edit does and a client joining a moment later sees the same thing. Nothing
   * about the text changes — this only tells the other editors that what they are looking at is now
   * what is stored, and their Save button can go quiet.
   *
   * The save does not necessarily land on an instance that has the room, so an instance without one
   * passes the news along instead.
   */
  pageSaved(pageId: string, info: SaveInfo): void {
    const room = this.rooms.get(pageId)
    if (room) {
      room.doc.getMap('meta').set('lastSave', info)
    } else {
      this.relay({ r: pageId, t: 'saved', p: JSON.stringify(info) })
    }
  },

  // ----------------------------------------
  // Relay
  // ----------------------------------------

  /** Publish a message to the other instances, split into chunks postgres will accept. */
  relay(message: Omit<RelayEnvelope, 'i'>): void {
    if (!this.listenClient) {
      return
    }
    const envelope: RelayEnvelope = { ...message, i: WIKI.INSTANCE_ID }
    const payload = envelope.p
    if (!payload || payload.length <= RELAY_CHUNK_SIZE) {
      this.publish(envelope)
      return
    }
    const count = Math.ceil(payload.length / RELAY_CHUNK_SIZE)
    const messageId = `${this.relaySeq++}`
    for (let index = 0; index < count; index++) {
      this.publish({
        ...envelope,
        p: payload.slice(index * RELAY_CHUNK_SIZE, (index + 1) * RELAY_CHUNK_SIZE),
        m: messageId,
        c: index,
        n: count
      })
    }
  },

  /**
   * Send one envelope to the other instances, behind whatever is already going out.
   *
   * Never awaited — every caller is a Yjs handler reacting to an edit or a cursor moving, and a
   * keystroke cannot wait for a round trip to postgres. `helpers/pubsub.ts` is what makes that safe on
   * a single client, which a burst of updates or one chunked message would otherwise breach.
   */
  publish(envelope: RelayEnvelope): void {
    notifier.send(NOTIFY_CHANNEL, JSON.stringify(envelope))
  },

  receiveRelay(envelope: RelayEnvelope): void {
    if (envelope.i === WIKI.INSTANCE_ID) {
      return
    }
    if (envelope.to && envelope.to !== WIKI.INSTANCE_ID) {
      return
    }
    if (envelope.m !== undefined && envelope.n !== undefined) {
      const assembled = this.reassemble(envelope)
      if (assembled === null) {
        return
      }
      envelope.p = assembled
    }
    switch (envelope.t) {
      case 'hello': {
        // -> Somewhere else is opening this page and has nothing yet. Only a room that is past its own
        //    setup is worth answering with; one still filling itself would hand over an empty document.
        const room = this.rooms.get(envelope.r)
        if (!room || room.provisional) {
          return
        }
        this.relay({
          r: envelope.r,
          t: 'state',
          to: envelope.i,
          p: Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString('base64')
        })
        break
      }
      case 'state': {
        const waiting = this.awaitingState.get(envelope.r)
        if (!waiting) {
          // -> Too late to be adopted, and merging it now is exactly the duplication this handshake
          //    exists to avoid. See the note at the top of this file.
          WIKI.logger.debug(
            `Ignoring a late collaboration state for page ${envelope.r} from instance ${envelope.i}`
          )
          return
        }
        waiting(Buffer.from(envelope.p ?? '', 'base64'))
        break
      }
      case 'update': {
        const room = this.rooms.get(envelope.r)
        if (room) {
          Y.applyUpdate(room.doc, Buffer.from(envelope.p ?? '', 'base64'), RELAYED)
        }
        break
      }
      case 'awareness': {
        const room = this.rooms.get(envelope.r)
        if (room) {
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            Buffer.from(envelope.p ?? '', 'base64'),
            RELAYED
          )
        }
        break
      }
      case 'deleted': {
        this.dropDeletedNote(envelope.r)
        break
      }
      case 'access': {
        this.disconnectNonManagers(envelope.r)
        break
      }
      case 'saved': {
        const room = this.rooms.get(envelope.r)
        if (room && envelope.p) {
          room.doc.getMap('meta').set('lastSave', JSON.parse(envelope.p) as SaveInfo)
        }
        break
      }
    }
  },

  /** Collect a chunked message, returning the whole payload once the last chunk lands. */
  reassemble(envelope: RelayEnvelope): string | null {
    const key = `${envelope.i}:${envelope.m}`
    let partial = this.partials.get(key)
    if (!partial) {
      partial = {
        parts: Array.from({ length: envelope.n! }),
        remaining: envelope.n!,
        timer: setTimeout(() => {
          // -> An instance that died mid-message would otherwise leave its chunks here for good
          this.partials.delete(key)
        }, RELAY_REASSEMBLY_TIMEOUT)
      }
      this.partials.set(key, partial)
    }
    if (partial.parts[envelope.c!] !== undefined) {
      return null
    }
    partial.parts[envelope.c!] = envelope.p ?? ''
    partial.remaining--
    if (partial.remaining > 0) {
      return null
    }
    clearTimeout(partial.timer)
    this.partials.delete(key)
    return partial.parts.join('')
  },

  send(conn: WebSocket, message: Uint8Array): void {
    if (conn.readyState !== conn.OPEN) {
      return
    }
    try {
      conn.send(message)
    } catch {
      conn.close()
    }
  }
}
