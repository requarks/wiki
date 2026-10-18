import { randomInt, randomUUID } from 'node:crypto'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import * as Y from 'yjs'

import {
  liveNoteImages as imagesTable,
  liveNoteRevisions as revisionsTable,
  liveNotes as liveNotesTable,
  users as usersTable
} from '../db/schema.ts'
import { CustomError, NOTE_IMAGES_FOLDER } from '../helpers/common.ts'
import { detectImageMime, detectSvg, svgMimeType } from '../helpers/images.ts'

/** What a note's URL is made of: `/n/<key>`. */
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-'
export const KEY_LENGTH = 24
const KEY_PATTERN = /^[A-Za-z0-9-]{24}$/

/**
 * The shortest gap between two revisions of a note while it is being written.
 *
 * A revision is a whole copy of the note, so one per keystroke — or per persist, every couple of
 * seconds — would bury the history the dialog is there to make readable. The last participant leaving
 * takes one regardless, so a session always ends on a revision.
 */
export const REVISION_INTERVAL_MS = 5 * 60 * 1000

/**
 * The extension an image added to a note is stored under, by what its bytes are. The formats a
 * browser draws inline, and nothing else: a note's images go into its text as `![](…)`.
 */
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  [svgMimeType]: 'svg'
}

/** How many revisions the dialog is given. The newest, since that is the end it is read from. */
const MAX_LISTED_REVISIONS = 500

/**
 * What a note lets everybody but its owners do -- see {@link LiveNotes.rightsFor}. `editable` is the
 * default: holding the key is enough to read and write.
 */
export const LIVE_NOTE_ACCESS = ['editable', 'locked', 'private'] as const
export type LiveNoteAccess = (typeof LIVE_NOTE_ACCESS)[number]

/** What one account may do with one note. */
export interface NoteRights {
  /** Change its access, and delete it: its creator, and `manage:system`. */
  manage: boolean
  read: boolean
  write: boolean
}

export interface LiveNoteSummary {
  id: string
  siteId: string
  key: string
  title: string
  access: LiveNoteAccess
  creatorId: string | null
  lastEditorId: string | null
  createdAt: Date
  /** When somebody last typed into it. */
  updatedAt: Date
}

/** A person a note names, as the API answers with one. */
export interface NotePerson {
  id: string
  name: string
}

/**
 * A note as the API describes it: the summary, with its creator and last editor named, and what the
 * account asking may do with it -- which the editor needs to know before the room would tell it.
 */
export interface LiveNoteDescription {
  id: string
  key: string
  title: string
  access: LiveNoteAccess
  canManage: boolean
  canWrite: boolean
  createdAt: string
  updatedAt: string
  /** Who created it. Null once that account is deleted. */
  creator: NotePerson | null
  /** Who typed into it last. Null for a note nobody has typed into yet, or a deleted account. */
  lastEditor: NotePerson | null
}

export interface PersistResult {
  /**
   * When the next revision falls due, if what is stored now differs from the last revision and was
   * not taken as one. The room arranges to persist again at that moment, so that a note somebody
   * stops typing into in the middle of an interval still gets its revision without waiting for the
   * room to close.
   */
  revisionDueAt: number | null
}

/**
 * The note's title: its first heading, the way HedgeDoc names a note.
 *
 * Any level, and the first one found rather than the first line, since a note often opens with
 * something other than its heading. Front matter and fenced code are not looked inside — a `#`
 * comment in a shell snippet is not a title.
 */
export function titleOf(content: string): string {
  let fence: string | null = null
  for (const line of content.split('\n')) {
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
      return heading[1].slice(0, 255)
    }
  }
  return ''
}

/**
 * Live notes model
 *
 * A live note is a markdown document edited together in real time, reached at `/n/<key>` by anyone
 * signed in who holds the URL. It is deliberately NOT a page: it has no place in the tree, no page
 * rules, no render and no save. The URL is the whole of its access control, which is why the key is 24
 * characters drawn from a cryptographic source — about 143 bits, nothing anybody guesses.
 *
 * **The collaboration room is what writes it.** Every other room is a scratch space that empties when
 * its last participant leaves; a note's room instead persists its document as it changes, and starts
 * from what it persisted. See `core/collab.ts`, which calls {@link LiveNotes.persist} on a debounce and
 * once more on the way out, and {@link LiveNotes.loadState} to seed itself.
 *
 * **The stored state is the Yjs document, not the text.** A client that drops off holds the document as
 * it last saw it and pushes its offline edits back on reconnecting, so the room it reconnects to must
 * hold the SAME document — seeding one afresh from the text would be a second, unrelated set of
 * insertions, and merging the two duplicates the note. `content` and `title` are read off the document
 * on every write so that nothing else has to decode a CRDT.
 *
 * **Several instances may hold the note open at once**, each with a room and each persisting, so a
 * write merges into what is stored rather than replacing it — merging Yjs updates is idempotent — and
 * whether to take a revision is decided under the note's row lock, against the revisions table rather
 * than anything one instance remembers.
 *
 * **An image added to a note is uploaded the moment it is added** ({@link LiveNotes.addImage}), since
 * there is no save to upload it on. It is an ordinary asset, stored and served wherever the site keeps
 * its images, but in the hidden `n` folder under a random name (`NOTE_IMAGES_FOLDER`): out of the File
 * Manager and every listing, and loaded by anybody signed in who has its URL — the same footing as
 * the note itself. `liveNoteImages` lists each note's, and deleting the note deletes them.
 *
 * Publishing a note as a page is done by the browser (`publishToPage` in `LiveNote.vue`), from
 * `content`, through the ordinary page and asset routes.
 */
class LiveNotes {
  /**
   * Whether a site offers live notes: `features.liveNotes`, which needs `collaborativeEditing` as well,
   * since a note is nothing but a collaboration room that keeps its contents.
   */
  isEnabled(siteId: string): boolean {
    const features = WIKI.sites[siteId]?.config?.features
    return Boolean(features?.liveNotes && features?.collaborativeEditing)
  }

  /** Whether `key` has the shape of a note key — checked before anything is looked up with it. */
  isValidKey(key: string): boolean {
    return KEY_PATTERN.test(key)
  }

  /** A fresh key, from `crypto` rather than `Math.random`: the key is the only thing guarding the note. */
  generateKey(): string {
    let key = ''
    for (let index = 0; index < KEY_LENGTH; index++) {
      key += KEY_ALPHABET[randomInt(KEY_ALPHABET.length)]
    }
    return key
  }

  /** Create an empty note. Nothing is stored in it until somebody types. */
  async create({
    siteId,
    creatorId
  }: {
    siteId: string
    creatorId: string
  }): Promise<LiveNoteSummary> {
    /*
      A collision on 143 bits does not happen, but the unique index is what would say so, and a retry
      costs one line. 23505 is that index: the key is the only unique column being written.
    */
    for (let attempt = 0; ; attempt++) {
      try {
        const [note] = await WIKI.db
          .insert(liveNotesTable)
          .values({ siteId, key: this.generateKey(), creatorId })
          .returning()
        return this.summarize(note)
      } catch (err: any) {
        if (attempt >= 2 || (err.cause ?? err).code !== '23505') {
          throw err
        }
      }
    }
  }

  async getByKey(siteId: string, key: string): Promise<LiveNoteSummary | null> {
    if (!this.isValidKey(key)) {
      return null
    }
    const [note] = await WIKI.db
      .select()
      .from(liveNotesTable)
      .where(and(eq(liveNotesTable.siteId, siteId), eq(liveNotesTable.key, key)))
      .limit(1)
    return note ? this.summarize(note) : null
  }

  /** A note with the people it names looked up, and the asker's rights in it, for the API. */
  async describe(note: LiveNoteSummary, rights: NoteRights): Promise<LiveNoteDescription> {
    const names = await this.namesOf([note.creatorId, note.lastEditorId])
    const person = (id: string | null): NotePerson | null =>
      id && names.has(id) ? { id, name: names.get(id)! } : null
    return {
      id: note.id,
      key: note.key,
      title: note.title,
      access: note.access,
      canManage: rights.manage,
      canWrite: rights.write,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      creator: person(note.creatorId),
      lastEditor: person(note.lastEditorId)
    }
  }

  /**
   * What an account may do with a note, which every route and the room ask and nothing works out for
   * itself.
   *
   * Its owners -- whoever created it, and `manage:system`, which passes every check -- may do
   * everything, whatever the note's access says: changing it, deleting the note, and reading and
   * writing it when it is locked or private. Everybody else holding the key gets what `access` allows.
   * Holding the key is what lets somebody in; it is no claim to the note itself.
   */
  rightsFor(note: LiveNoteSummary, userId: string, permissions: string[]): NoteRights {
    const manage = note.creatorId === userId || permissions.includes('manage:system')
    return {
      manage,
      read: manage || note.access !== 'private',
      write: manage || note.access === 'editable'
    }
  }

  /**
   * Change who besides its owners may read and write a note. Whoever this takes rights away from while
   * they are in it is disconnected by the caller, through `collab.noteAccessChanged`.
   */
  async setAccess(id: string, access: LiveNoteAccess): Promise<void> {
    await WIKI.db.update(liveNotesTable).set({ access }).where(eq(liveNotesTable.id, id))
  }

  /**
   * Delete a note, its revisions and its images. Its room, wherever one is open, is closed by the
   * caller through `collab.noteDeleted` -- the row going is not something an open room would otherwise
   * notice.
   *
   * The images are read and the row deleted under the row's lock, which is what closes the race with
   * an image still uploading: recording one takes a share lock on the note row for its foreign key, so
   * it either lands before the lock and is read here, or waits for the delete and fails on a note that
   * is gone — and `addImage` deletes what it uploaded. The files themselves go afterwards, outside the
   * transaction, since removing one may be a round trip to a storage target.
   */
  async delete(note: { id: string; siteId: string }, actorId?: string): Promise<void> {
    const assetIds = await WIKI.db.transaction(async (trx) => {
      await trx
        .select({ id: liveNotesTable.id })
        .from(liveNotesTable)
        .where(eq(liveNotesTable.id, note.id))
        .for('update')
      const images = await trx
        .select({ assetId: imagesTable.assetId })
        .from(imagesTable)
        .where(eq(imagesTable.noteId, note.id))
      await trx.delete(liveNotesTable).where(eq(liveNotesTable.id, note.id))
      return images.map((image) => image.assetId)
    })

    for (const assetId of assetIds) {
      try {
        await WIKI.models.assets.deleteAsset(note.siteId, assetId, actorId)
      } catch (err: any) {
        // -> The note is gone either way, and the next image should not be left behind with this one
        WIKI.logger.warn(
          `Failed to delete image ${assetId} of live note ${note.id}: ${err.message}`
        )
      }
    }
  }

  /**
   * Upload an image into a note, and answer with the URL its markdown is to point at:
   * `/_files/n/<uuid>.<ext>`.
   *
   * What the image IS is read off its bytes, never the request: PNG, JPEG, GIF, WebP or SVG, refused
   * otherwise, and stored under the extension that matches. An SVG goes through the upload's scan like
   * any other (`uploadScanSVG`). The name is a fresh UUID, which is what keeps it unguessable, and the
   * file goes into the site's primary locale, which is where `/_files/` looks first.
   */
  async addImage({
    note,
    data,
    authorId
  }: {
    note: LiveNoteSummary
    data: Buffer
    authorId: string
  }): Promise<{ url: string }> {
    const mimeType = detectImageMime(data) ?? (detectSvg(data) ? svgMimeType : null)
    if (!mimeType) {
      throw new CustomError(
        'noteImageInvalid',
        'Only images can be added to a note: PNG, JPEG, GIF, WebP or SVG.'
      )
    }

    const asset = await WIKI.models.assets.upload({
      siteId: note.siteId,
      locale: WIKI.sites[note.siteId]?.config?.locales?.primary ?? 'en',
      folderPath: NOTE_IMAGES_FOLDER,
      fileName: `${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`,
      mimeType,
      data,
      authorId
    })

    try {
      await WIKI.db.insert(imagesTable).values({ assetId: asset.id, noteId: note.id })
    } catch (err: any) {
      // -> Unlisted, nothing would ever delete it. 23503 is the note having been deleted meanwhile.
      await WIKI.models.assets.deleteAsset(note.siteId, asset.id, authorId)
      if ((err.cause ?? err).code === '23503') {
        throw new CustomError('noteNotFound', 'This note does not exist.', 404)
      }
      throw err
    }

    return { url: `/_files/${NOTE_IMAGES_FOLDER}/${asset.fileName}` }
  }

  /** The document a room starts from, or null for a note nobody has typed into yet. */
  async loadState(id: string): Promise<Uint8Array | null> {
    const [row] = await WIKI.db
      .select({ state: liveNotesTable.state })
      .from(liveNotesTable)
      .where(eq(liveNotesTable.id, id))
      .limit(1)
    return row?.state ? new Uint8Array(row.state) : null
  }

  /**
   * Write a room's document into the note, and take a revision if one is due.
   *
   * One transaction under the note's row lock, so that two instances persisting the same note cannot
   * interleave: each merges into what the other wrote, and only one of them can find a revision due.
   *
   * @param update The room's whole document, `Y.encodeStateAsUpdate`.
   * @param authorIds Who typed into the room since its last persist. Empty for a write made only to
   *   take a revision that fell due, which leaves `updatedAt` and `lastEditorId` alone: nobody edited.
   * @param lastEditorId Which of them typed last.
   * @param final The room is closing: take a revision whatever the interval, if anything changed.
   */
  async persist({
    id,
    update,
    authorIds,
    lastEditorId = null,
    final = false
  }: {
    id: string
    update: Uint8Array
    authorIds: string[]
    lastEditorId?: string | null
    final?: boolean
  }): Promise<PersistResult> {
    return WIKI.db.transaction(async (trx) => {
      const [note] = await trx
        .select({
          state: liveNotesTable.state,
          pendingAuthorIds: liveNotesTable.pendingAuthorIds,
          createdAt: liveNotesTable.createdAt
        })
        .from(liveNotesTable)
        .where(eq(liveNotesTable.id, id))
        .for('update')
      // -> Deleted from under an open room; there is nothing left to write into
      if (!note) {
        return { revisionDueAt: null }
      }

      const state = note.state ? Y.mergeUpdates([new Uint8Array(note.state), update]) : update
      const doc = new Y.Doc()
      Y.applyUpdate(doc, state)
      const content = doc.getText('content').toString()
      doc.destroy()

      let pending = [...new Set([...note.pendingAuthorIds, ...authorIds])]

      const [latest] = await trx
        .select({ content: revisionsTable.content, createdAt: revisionsTable.createdAt })
        .from(revisionsTable)
        .where(eq(revisionsTable.noteId, id))
        .orderBy(desc(revisionsTable.createdAt))
        .limit(1)

      // -> A note whose first revision has not been taken counts its interval from its creation, so
      //    that the first few characters typed into it are not a revision of their own
      const changed = content !== (latest?.content ?? '')
      const now = Date.now()
      const dueAt = (latest?.createdAt ?? note.createdAt).getTime() + REVISION_INTERVAL_MS
      const takeRevision = changed && (final || now >= dueAt)

      if (takeRevision) {
        await trx.insert(revisionsTable).values({
          noteId: id,
          content,
          authorIds: pending,
          createdAt: new Date(now)
        })
        pending = []
      }

      await trx
        .update(liveNotesTable)
        .set({
          state: Buffer.from(state),
          content,
          title: titleOf(content),
          pendingAuthorIds: pending,
          ...(authorIds.length > 0
            ? { updatedAt: new Date(now), lastEditorId: lastEditorId ?? authorIds.at(-1)! }
            : {})
        })
        .where(eq(liveNotesTable.id, id))

      return { revisionDueAt: changed && !takeRevision ? dueAt : null }
    })
  }

  /** A note's revisions, newest first, with the names of who wrote each — but not their content. */
  async listRevisions(noteId: string) {
    const revisions = await WIKI.db
      .select({
        id: revisionsTable.id,
        authorIds: revisionsTable.authorIds,
        length: sql<number>`char_length(${revisionsTable.content})`.mapWith(Number),
        createdAt: revisionsTable.createdAt
      })
      .from(revisionsTable)
      .where(eq(revisionsTable.noteId, noteId))
      .orderBy(desc(revisionsTable.createdAt))
      .limit(MAX_LISTED_REVISIONS)

    const names = await this.namesOf(revisions.flatMap((revision) => revision.authorIds))

    return revisions.map((revision) => ({
      id: revision.id,
      length: revision.length,
      createdAt: revision.createdAt.toISOString(),
      // -> An account deleted since is left out rather than named as somebody it no longer is
      authors: revision.authorIds
        .filter((userId) => names.has(userId))
        .map((userId) => ({ id: userId, name: names.get(userId)! }))
    }))
  }

  async getRevision(noteId: string, revisionId: string) {
    const [revision] = await WIKI.db
      .select({
        id: revisionsTable.id,
        content: revisionsTable.content,
        createdAt: revisionsTable.createdAt
      })
      .from(revisionsTable)
      .where(and(eq(revisionsTable.noteId, noteId), eq(revisionsTable.id, revisionId)))
      .limit(1)
    return revision
      ? { id: revision.id, content: revision.content, createdAt: revision.createdAt.toISOString() }
      : null
  }

  /** The names of some accounts, by id. An id whose account is gone is simply absent. */
  private async namesOf(ids: (string | null)[]): Promise<Map<string, string>> {
    const userIds = [...new Set(ids.filter((id): id is string => Boolean(id)))]
    const names = new Map<string, string>()
    if (userIds.length > 0) {
      const rows = await WIKI.db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds))
      for (const row of rows) {
        names.set(row.id, row.name)
      }
    }
    return names
  }

  private summarize(note: typeof liveNotesTable.$inferSelect): LiveNoteSummary {
    return {
      id: note.id,
      siteId: note.siteId,
      key: note.key,
      title: note.title,
      // -> Only ever written by `setAccess`, which takes nothing else
      access: note.access as LiveNoteAccess,
      creatorId: note.creatorId,
      lastEditorId: note.lastEditorId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    }
  }
}

export const liveNotes = new LiveNotes()
