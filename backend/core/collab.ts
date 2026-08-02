import { sql } from 'drizzle-orm'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as Y from 'yjs'

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
}

interface CollabSession {
  /** The room this socket ended up in, or null while it is still being decided. */
  room: CollabRoom | null
  /** Frames that arrived before there was a room to hand them to. */
  pending: Uint8Array[]
}

interface CollabRoom {
  pageId: string
  siteId: string
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
  /** Room, i.e. page id. */
  r: string
  t: 'update' | 'awareness' | 'hello' | 'state' | 'saved'
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
 * The state a room starts from when it has to build one itself, as a Yjs update.
 *
 * Built in a scratch document whose client id is pinned to 0, so that the bytes depend on nothing but
 * the page — see the note at the top of this file on why that matters.
 */
function buildSeed(page: {
  content?: string | null
  title?: string | null
  description?: string | null
  icon?: string | null
}): Uint8Array {
  const seed = new Y.Doc()
  seed.clientID = 0
  seed.transact(() => {
    seed.getText('content').insert(0, page.content ?? '')
    const props = seed.getMap('props')
    props.set('title', page.title ?? '')
    props.set('description', page.description ?? '')
    props.set('icon', page.icon ?? '')
  })
  const update = Y.encodeStateAsUpdate(seed)
  seed.destroy()
  return update
}

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
    for (const room of this.rooms.values()) {
      for (const conn of room.conns.keys()) {
        conn.close(1001, 'Server is shutting down')
      }
      room.awareness.destroy()
      room.doc.destroy()
    }
    this.rooms.clear()
    if (this.listenClient) {
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
   * Put a socket into a page's room, syncing it against whatever state that room holds.
   *
   * The caller is responsible for having decided that this user may edit this page — see
   * `controllers/collab.ts`. Nothing below re-checks it.
   */
  async join(
    conn: WebSocket,
    page: { id: string; siteId: string },
    session: CollabSession
  ): Promise<void> {
    /*
      Asked for repeatedly, because a room can be dropped while this socket was waiting for it: another
      socket that gave up during the same setup takes the still-empty room down with it. Joining that
      one would put this editor in a room nothing else can find.
    */
    let room = await this.ensureRoom(page)
    for (let attempt = 0; this.rooms.get(page.id) !== room && attempt < 3; attempt++) {
      room = await this.ensureRoom(page)
    }

    // -> The socket may well have gone away while the room was being set up
    if (conn.readyState !== conn.OPEN) {
      this.closeRoomIfEmpty(room)
      return
    }

    const state: CollabConn = { clients: new Set(), alive: true }
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
   * The room for a page, creating and populating it if this instance does not have it open.
   *
   * Concurrent joiners share one room *and one initialization*: the room goes into the map before it
   * has any state, and `ready` is what everything else waits on.
   */
  async ensureRoom(page: { id: string; siteId: string }): Promise<CollabRoom> {
    const existing = this.rooms.get(page.id)
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
      pageId: page.id,
      siteId: page.siteId,
      doc,
      awareness,
      conns: new Map(),
      ready: Promise.resolve(),
      provisional: true
    }
    this.rooms.set(page.id, room)

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      const message = encoding.toUint8Array(encoder)
      for (const conn of room.conns.keys()) {
        this.send(conn, message)
      }
      if (origin !== RELAYED) {
        this.relay({ r: room.pageId, t: 'update', p: Buffer.from(update).toString('base64') })
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
            r: room.pageId,
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
      const fromPeer = (await this.hasPeers()) ? await this.peerState(room.pageId) : null
      if (fromPeer) {
        Y.applyUpdate(room.doc, fromPeer, RELAYED)
      } else {
        const page = await WIKI.models.pages.getPage({
          siteId: room.siteId,
          id: room.pageId,
          withContent: true
        })
        // -> A page that went away between the permission check and here leaves an empty room, which
        //    the first disconnect clears away again
        Y.applyUpdate(room.doc, buildSeed(page ?? {}), RELAYED)
      }
    } catch (err: any) {
      WIKI.logger.warn(
        `Failed to initialize the collaboration room for page ${room.pageId}: ${err.message}`
      )
    } finally {
      room.provisional = false
      this.awaitingState.delete(room.pageId)
    }
  },

  /** Ask the cluster for a room's current state, resolving to null if nobody answers in time. */
  peerState(pageId: string): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.awaitingState.delete(pageId)
        resolve(null)
      }, PEER_STATE_TIMEOUT)
      this.awaitingState.set(pageId, (update) => {
        clearTimeout(timer)
        this.awaitingState.delete(pageId)
        resolve(update)
      })
      this.relay({ r: pageId, t: 'hello' })
    })
  },

  onMessage(room: CollabRoom, conn: WebSocket, message: Uint8Array): void {
    try {
      const decoder = decoding.createDecoder(message)
      const encoder = encoding.createEncoder()
      switch (decoding.readVarUint(decoder)) {
        case MESSAGE_SYNC: {
          encoding.writeVarUint(encoder, MESSAGE_SYNC)
          // -> The socket is the origin, which is how the awareness bookkeeping above knows whose
          //    cursors an update carries
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn)
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
        `Failed to handle a collaboration message on page ${room.pageId}: ${err.message}`
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
   */
  closeRoomIfEmpty(room: CollabRoom): void {
    if (room.conns.size > 0 || this.rooms.get(room.pageId) !== room) {
      return
    }
    this.rooms.delete(room.pageId)
    room.awareness.destroy()
    room.doc.destroy()
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

  publish(envelope: RelayEnvelope): void {
    this.listenClient
      ?.query('SELECT pg_notify($1, $2)', [NOTIFY_CHANNEL, JSON.stringify(envelope)])
      .catch((err: any) => {
        WIKI.logger.warn(`Failed to relay a collaboration message: ${err.message}`)
      })
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
