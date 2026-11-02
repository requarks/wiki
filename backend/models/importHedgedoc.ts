import { and, eq, inArray, or } from 'drizzle-orm'
import pg from 'pg'
import { v5 as uuidv5 } from 'uuid'
import * as Y from 'yjs'

import {
  liveNoteLegacyRefs as legacyRefsTable,
  liveNoteRevisions as revisionsTable,
  liveNotes as liveNotesTable,
  userGroups as userGroupsTable,
  users as usersTable
} from '../db/schema.ts'
import { patchApply, patchFromText } from '../helpers/diffMatchPatch.ts'
import { fetchPublic } from '../helpers/publicFetch.ts'
import { titleOf } from './liveNotes.ts'

import type { LiveNoteAccess, LiveNoteSummary } from './liveNotes.ts'

/**
 * The root every import's namespace is derived from, so that a note's id here is a function of the
 * site and of its id in HedgeDoc — see {@link HedgedocImport.run}.
 */
const IMPORT_NAMESPACE_ROOT = '7b1e5c2a-93d4-4f60-8a1e-0c6f2d9b4e57'

/** How many notes are read from the source, with their revisions, at a time. */
const NOTE_BATCH_SIZE = 50

/** How many addresses are asked about at once when matching HedgeDoc accounts to this wiki's. */
const EMAIL_BATCH_SIZE = 500

/** How long one image download may take. */
const IMAGE_TIMEOUT_MS = 30_000

/**
 * What HedgeDoc's note permissions become. A live note has three settings where HedgeDoc has six, and
 * no setting lets a guest write, which `freely` did — such a note becomes `editable`, and the import
 * says how many there were.
 *
 * - `editable`, `limited`: any signed-in account reads and writes
 * - `locked`, `protected`: only the owner writes
 * - `private`: only the owner reads
 */
const ACCESS_MAP: Record<string, LiveNoteAccess> = {
  freely: 'editable',
  editable: 'editable',
  limited: 'editable',
  locked: 'locked',
  protected: 'locked',
  private: 'private'
}

/** One line of the progress log: a key under `admin.utilities.hedgedocImport.log` and its values. */
export interface HedgedocImportLog {
  type: 'log'
  level: 'info' | 'success' | 'warn' | 'error'
  key: string
  params?: Record<string, string | number>
}

export type HedgedocImportEvent =
  | HedgedocImportLog
  | { type: 'progress'; value: number }
  | { type: 'done'; summary: HedgedocImportSummary }

export interface HedgedocImportSummary {
  usersCreated: number
  usersMatched: number
  notesImported: number
  notesReplaced: number
  notesSkippedEmpty: number
  /** Brought in by an earlier run, and left as they are with overwrite off. */
  notesAlreadyImported: number
  notesSkippedConflict: number
  notesFailed: number
  revisions: number
  images: number
  imagesFailed: number
}

export interface HedgedocImportOptions {
  /** A PostgreSQL connection string to the HedgeDoc 1.x database. Never logged. */
  connectionString: string
  siteId: string
  /** Replace a note already on the site under the same key, rather than skipping it. */
  overwrite: boolean
  /**
   * The URL prefixes HedgeDoc served its uploads from, e.g. `https://notes.example.org/uploads/`.
   * Only images under one of them are copied into the wiki; every other URL is left as it is.
   */
  uploadPrefixes: string[]
  /** Who is running the import: the author of the images it stores. */
  actorId: string
}

/** A row of HedgeDoc's `Notes`, as read. */
interface SourceNote {
  id: string
  ownerId: string | null
  content: string | null
  createdAt: Date
  updatedAt: Date
  shortid: string
  permission: string | null
  lastchangeuserId: string | null
  lastchangeAt: Date | null
  alias: string | null
  authorship: string | null
}

/**
 * A row of HedgeDoc's `Revisions`, as read.
 *
 * **Not a copy of the note.** HedgeDoc keeps the text whole in two places only: `lastContent` of a
 * note's first revision, and `content` of its latest. Every other revision holds `patch`, the
 * diff-match-patch text that turns the revision before it into this one, and a `content` that HedgeDoc
 * cleared when the next revision was taken — through a setter that turns `null` into the STRING
 * `'null'`, which is why that value means "no text here" rather than a note reading "null".
 */
interface SourceRevision {
  id: string
  noteId: string
  content: string | null
  lastContent: string | null
  patch: string | null
  createdAt: Date
  authorship: string | null
}

/** A revision as it is to be written here. */
interface PlannedRevision {
  id: string
  content: string
  authorIds: string[]
  createdAt: Date
}

/**
 * The address a HedgeDoc account is matched by: its own `email` for a local account, and the first
 * address its identity provider reported for an OAuth2 one — `profile.emails[0]`, or `profile.email`
 * where the provider reported a single one. Lowercased, since this wiki stores and matches them so.
 */
export function hedgedocEmailOf(row: { email: string | null; profile: string | null }): string {
  if (row.email?.trim()) {
    return row.email.trim().toLowerCase()
  }
  const profile = parseJson(row.profile)
  if (profile?.provider !== 'oauth2') {
    return ''
  }
  const email = Array.isArray(profile.emails) ? profile.emails[0] : profile.email
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

/** What a HedgeDoc account is called: its display name, its username, or failing both its address. */
function hedgedocNameOf(profile: string | null, email: string): string {
  const parsed = parseJson(profile)
  const name = [parsed?.displayName, parsed?.username].find(
    (value) => typeof value === 'string' && value.trim()
  )
  return (name ?? email).trim().slice(0, 255)
}

function parseJson(value: string | null): any {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * The id part of a HedgeDoc note's URL when it has no alias: its UUID as url-safe base64, the way
 * HedgeDoc's `Note.encodeNoteId` writes it — 22 characters, no padding.
 */
export function encodeHedgedocNoteId(id: string): string {
  return Buffer.from(id.replaceAll('-', ''), 'hex').toString('base64url')
}

/**
 * The key a HedgeDoc note is imported under, and every other name its old URLs used.
 *
 * Its alias when that is a valid key, otherwise its encoded id — which HedgeDoc opened the note from
 * whether or not it had an alias. An encoded id may start with `_`, which no key may (it is what
 * keeps `notes/_access` free); such a key is given a `-` in front, so that `/_x…` at the old host
 * maps to `/n/-_x…` here by one rewrite rule. That cannot collide with another imported note's
 * encoded id, which is 22 characters where this is 23, nor with a generated key, which has no `_`; an
 * alias starting with `-_` could, and the import's conflict check is what would catch it.
 *
 * The refs are what the old URLs carried that is not the key: the shortid (`/s/` and `/p/`), the
 * encoded id when the alias is the key, the alias when it is not a valid key, and the id itself when
 * it was prefixed.
 */
export function hedgedocKeyOf(
  note: { id: string; alias: string | null; shortid: string },
  isValidKey: (key: string) => boolean
): { key: string; refs: string[] } {
  const encoded = encodeHedgedocNoteId(note.id)
  const refs = new Set<string>()
  let key: string
  if (note.alias && isValidKey(note.alias)) {
    key = note.alias
    refs.add(encoded)
  } else {
    if (note.alias) {
      refs.add(note.alias)
    }
    key = encoded
  }
  if (key.startsWith('_')) {
    refs.add(key)
    key = `-${key}`
  }
  if (note.shortid) {
    refs.add(note.shortid)
  }
  refs.delete(key)
  return { key, refs: [...refs] }
}

/**
 * Who wrote into a note between two moments, by HedgeDoc's authorship spans:
 * `[userId, start, end, createdAt, updatedAt]`, the last two in epoch milliseconds. A span last
 * touched in `(after, upTo]` counts.
 */
function authorsBetween(authorship: string | null, after: number, upTo: number): string[] {
  const spans = parseJson(authorship)
  if (!Array.isArray(spans)) {
    return []
  }
  const ids = new Set<string>()
  for (const span of spans) {
    if (Array.isArray(span) && typeof span[0] === 'string') {
      const touched = Number(span[4] ?? span[3])
      if (touched > after && touched <= upTo) {
        ids.add(span[0])
      }
    }
  }
  return [...ids]
}

/** The Yjs document a note room would hold for this text, as `liveNotes.persist` stores one. */
function stateOf(content: string): Buffer {
  const doc = new Y.Doc()
  doc.getText('content').insert(0, content)
  const state = Y.encodeStateAsUpdate(doc)
  doc.destroy()
  return Buffer.from(state)
}

/**
 * The text of every revision of a note, oldest first, replayed the way HedgeDoc reads its own history
 * (`getRevision` in its `dmpWorker.js`): from the first revision's `lastContent`, each later one's
 * `patch` applied to the text before it. A revision with no patch but a `lastContent` starts over
 * from that text, as a first revision does.
 *
 * The latest revision still carries its text whole, which is what checks the replay: should the two
 * disagree, the stored text is the one kept, and `drifted` says so.
 */
function replayRevisions(revisions: SourceRevision[]): { texts: string[]; drifted: boolean } {
  const texts: string[] = []
  let text = ''
  for (const revision of revisions) {
    if (revision.patch) {
      text = patchApply(patchFromText(revision.patch), text)[0]
    } else if (revision.lastContent !== null) {
      text = revision.lastContent
    }
    texts.push(text)
  }
  const stored = revisions.at(-1)?.content
  let drifted = false
  if (revisions.length > 1 && stored !== null && stored !== undefined && stored !== 'null') {
    drifted = stored !== texts.at(-1)
    texts[texts.length - 1] = stored
  }
  return { texts, drifted }
}

/** Escape a string for use inside a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * HedgeDoc import model
 *
 * Brings a HedgeDoc 1.x instance into a site as live notes, reading its database directly — the
 * connection string is given for the length of one run and kept nowhere, not even in a job, since it
 * carries a password. Run by `POST /import/hedgedoc`, which streams what {@link HedgedocImport.run}
 * yields to the browser as it happens.
 *
 * **Accounts first.** Every HedgeDoc account becomes an account here, matched by address
 * ({@link hedgedocEmailOf}): one that is already here is used as it is, whatever the overwrite switch
 * says, and one that is not is created with no password — an OAuth2 account signs in through the
 * provider, which matches it by address (`users.loginWithProvider`); a local one would need a reset,
 * since HedgeDoc's scrypt hashes are not something this wiki checks. Several HedgeDoc accounts with
 * one address become the one account. Created directly rather than through `users.createUser`, as the
 * 2.x import does, so that a few thousand accounts arriving at once is not a few thousand `user:join`
 * webhook deliveries.
 *
 * **Then the notes**, each under the key its old URL had ({@link hedgedocKeyOf}) and with every other
 * name it answered to as a `liveNoteLegacyRefs` row. Revisions are replayed from HedgeDoc's patches
 * into the whole copies this wiki keeps ({@link replayRevisions}), with their authors read off the
 * authorship spans. A note empty now and
 * in every revision is skipped, as `liveNotes.purgeUntouched` would take it anyway.
 *
 * **A note's id here is derived** from the site and its HedgeDoc id, so running the import again
 * recognises what it brought in last time: skipped, or replaced with overwrite on. Every note is
 * written on its own, so a run that stops halfway is resumed by running it again.
 *
 * **Images under the given upload prefixes are copied**, into the note as one pasted there would be
 * (`liveNotes.addImage`), and every mention of the old URL — in the note and in all its revisions — is
 * rewritten to the copy. Downloaded through `fetchPublic`, since the URL comes from content somebody
 * else wrote: an upload server inside the wiki's network has to be in
 * `security.privateFetchAllowList`. One that cannot be copied keeps its old URL and is reported.
 */
class HedgedocImport {
  /**
   * Run an import, yielding its progress as it goes. Never throws: a failure is the last event.
   *
   * @param signal Aborted when whoever is watching goes away. The note being written is finished,
   *   and the run stops there — running it again picks up from where it was.
   */
  async *run(
    options: HedgedocImportOptions,
    signal: AbortSignal
  ): AsyncGenerator<HedgedocImportEvent> {
    const summary: HedgedocImportSummary = {
      usersCreated: 0,
      usersMatched: 0,
      notesImported: 0,
      notesReplaced: 0,
      notesSkippedEmpty: 0,
      notesAlreadyImported: 0,
      notesSkippedConflict: 0,
      notesFailed: 0,
      revisions: 0,
      images: 0,
      imagesFailed: 0
    }
    const log = (
      level: HedgedocImportLog['level'],
      key: string,
      params?: HedgedocImportLog['params']
    ): HedgedocImportLog => ({ type: 'log', level, key, params })

    const client = new pg.Client({
      connectionString: options.connectionString,
      connectionTimeoutMillis: 15_000,
      application_name: 'wikijs-hedgedoc-import'
    })
    // -> A dropped connection to the source mid-run arrives as an event, not a rejected query;
    //    unhandled, it would take the process down
    client.on('error', (err) => {
      WIKI.logger.warn(`HedgeDoc import: source connection error: ${err.message}`)
    })

    try {
      yield log('info', 'connecting')
      try {
        await client.connect()
        // -> One snapshot for the whole run, so that the notes and the revisions read minutes apart
        //    still agree, and nothing here can write to the source by mistake
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      } catch (err: any) {
        yield log('error', 'connectFailed', { error: err.message })
        return
      }

      const missing = await this.missingTables(client)
      if (missing.length > 0) {
        yield log('error', 'notHedgedoc', { tables: missing.join(', ') })
        return
      }

      if (!WIKI.models.liveNotes.isEnabled(options.siteId)) {
        yield log('warn', 'notesDisabled')
      }

      // ACCOUNTS ----------------------------------------------------------

      const { userMap, events } = await this.importUsers(client, summary)
      for (const event of events) {
        yield event
      }
      yield log('success', 'usersDone', {
        created: summary.usersCreated,
        matched: summary.usersMatched
      })
      yield { type: 'progress', value: 0.05 }

      // NOTES -------------------------------------------------------------

      const counts = await client.query<{ total: string; freely: string }>(
        `SELECT count(*) AS total, count(*) FILTER (WHERE "permission" = 'freely') AS freely
         FROM "Notes" WHERE "deletedAt" IS NULL`
      )
      const total = Number(counts.rows[0]?.total ?? 0)
      const freely = Number(counts.rows[0]?.freely ?? 0)
      yield log('info', 'notesStarting', { total })
      if (freely > 0) {
        yield log('warn', 'freelyNotes', { count: freely })
      }

      /*
        HedgeDoc does not hold an alias unique, and opens whichever note the database answers with
        first. Here a key is unique, so the alias goes to the note written most recently -- the one
        people are most likely still using -- and any other is keyed by its own encoded id, at which
        HedgeDoc served it as well.
      */
      const aliasTaken = new Set(
        (
          await client.query<{ id: string }>(
            `SELECT n."id" FROM "Notes" n
             WHERE n."alias" IS NOT NULL AND n."deletedAt" IS NULL AND EXISTS (
               SELECT 1 FROM "Notes" o
               WHERE o."alias" = n."alias" AND o."deletedAt" IS NULL
                 AND (o."updatedAt", o."id") > (n."updatedAt", n."id")
             )`
          )
        ).rows.map((row) => row.id)
      )

      const namespace = uuidv5(options.siteId, IMPORT_NAMESPACE_ROOT)
      const prefixes = options.uploadPrefixes
      let done = 0
      let lastId = '00000000-0000-0000-0000-000000000000'

      while (!signal.aborted) {
        const batch = await client.query<SourceNote>(
          `SELECT "id", "ownerId", "content", "createdAt", "updatedAt", "shortid", "permission",
                  "lastchangeuserId", "lastchangeAt", "alias", "authorship"
           FROM "Notes"
           WHERE "deletedAt" IS NULL AND "id" > $1
           ORDER BY "id"
           LIMIT $2`,
          [lastId, NOTE_BATCH_SIZE]
        )
        if (batch.rows.length === 0) {
          break
        }
        lastId = batch.rows.at(-1)!.id

        // -> No index on `noteId` in HedgeDoc's schema, so asked for once per batch rather than once
        //    per note
        const revisions = await client.query<SourceRevision>(
          `SELECT "id", "noteId", "content", "lastContent", "patch", "createdAt", "authorship"
           FROM "Revisions"
           WHERE "noteId" = ANY($1::uuid[])
           ORDER BY "noteId", "createdAt", "id"`,
          [batch.rows.map((note) => note.id)]
        )
        const revisionsByNote = Map.groupBy(revisions.rows, (revision) => revision.noteId)

        for (const note of batch.rows) {
          if (signal.aborted) {
            break
          }
          const events = await this.importNote({
            note,
            revisions: revisionsByNote.get(note.id) ?? [],
            namespace,
            userMap,
            aliasTaken,
            prefixes,
            options,
            summary
          })
          for (const event of events) {
            yield event
          }
          done++
          yield { type: 'progress', value: 0.05 + 0.95 * (total > 0 ? done / total : 1) }
        }
      }

      if (signal.aborted) {
        yield log('warn', 'aborted', { done, total })
      }
      yield log('success', 'notesDone', {
        imported: summary.notesImported,
        replaced: summary.notesReplaced,
        empty: summary.notesSkippedEmpty,
        already: summary.notesAlreadyImported,
        conflicts: summary.notesSkippedConflict,
        failed: summary.notesFailed,
        revisions: summary.revisions,
        images: summary.images,
        imagesFailed: summary.imagesFailed
      })
    } catch (err: any) {
      WIKI.logger.warn(`HedgeDoc import failed: ${err.message}`)
      yield log('error', 'failed', { error: err.message })
    } finally {
      await client.end().catch(() => {})
      yield { type: 'done', summary }
    }
  }

  /** The HedgeDoc tables the import reads that the source does not have. */
  private async missingTables(client: pg.Client): Promise<string[]> {
    const expected = ['Users', 'Notes', 'Revisions']
    const found = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
      [expected]
    )
    const present = new Set(found.rows.map((row) => row.table_name))
    return expected.filter((table) => !present.has(table))
  }

  /**
   * Match every HedgeDoc account to an account here, creating those that are missing.
   *
   * @returns HedgeDoc user id → user id here, for every account that has an address
   */
  private async importUsers(
    client: pg.Client,
    summary: HedgedocImportSummary
  ): Promise<{ userMap: Map<string, string>; events: HedgedocImportEvent[] }> {
    const events: HedgedocImportEvent[] = []
    const rows = await client.query<{
      id: string
      email: string | null
      profile: string | null
      createdAt: Date
    }>(`SELECT "id", "email", "profile", "createdAt" FROM "Users" ORDER BY "createdAt", "id"`)

    // -> By address, the oldest HedgeDoc account first: its name is the one an account created for
    //    several of them is given
    const byEmail = new Map<string, { sourceIds: string[]; name: string; createdAt: Date }>()
    let withoutEmail = 0
    for (const row of rows.rows) {
      const email = hedgedocEmailOf(row)
      if (!email || email.length > 255) {
        withoutEmail++
        continue
      }
      const entry = byEmail.get(email)
      if (entry) {
        entry.sourceIds.push(row.id)
      } else {
        byEmail.set(email, {
          sourceIds: [row.id],
          name: hedgedocNameOf(row.profile, email),
          createdAt: row.createdAt
        })
      }
    }
    if (withoutEmail > 0) {
      events.push({
        type: 'log',
        level: 'warn',
        key: 'usersWithoutEmail',
        params: { count: withoutEmail }
      })
    }
    events.push({
      type: 'log',
      level: 'info',
      key: 'usersFound',
      params: { accounts: rows.rows.length, people: byEmail.size }
    })

    const emails = [...byEmail.keys()]
    const existing = new Map<string, string>()
    for (let index = 0; index < emails.length; index += EMAIL_BATCH_SIZE) {
      const found = await WIKI.db
        .select({ id: usersTable.id, email: usersTable.email })
        .from(usersTable)
        .where(inArray(usersTable.email, emails.slice(index, index + EMAIL_BATCH_SIZE)))
      for (const user of found) {
        existing.set(user.email, user.id)
      }
    }

    const userMap = new Map<string, string>()
    const usersGroupId = WIKI.data.systemIds.usersGroupId
    for (const [email, entry] of byEmail) {
      let userId = existing.get(email)
      if (userId) {
        summary.usersMatched++
      } else {
        // -> The same shape `users.createUser` writes for an account with no password
        const [created] = await WIKI.db
          .insert(usersTable)
          .values({
            email,
            name: entry.name,
            auth: {},
            isSystem: false,
            isActive: true,
            isVerified: true,
            meta: { location: '', jobTitle: '', pronouns: '' },
            prefs: {
              locale: '',
              timezone: WIKI.config.userDefaults?.timezone ?? 'America/New_York',
              dateFormat: WIKI.config.userDefaults?.dateFormat ?? 'YYYY-MM-DD',
              timeFormat: WIKI.config.userDefaults?.timeFormat ?? '12h',
              appearance: 'site',
              cvd: 'none',
              reduceMotion: false,
              underlineLinks: false,
              contentTextSize: 'default'
            },
            createdAt: entry.createdAt
          })
          .onConflictDoNothing({ target: usersTable.email })
          .returning({ id: usersTable.id })
        if (created) {
          userId = created.id
          summary.usersCreated++
          await WIKI.db
            .insert(userGroupsTable)
            .values({ userId, groupId: usersGroupId })
            .onConflictDoNothing()
        } else {
          // -> Created by somebody signing in while this ran
          userId = (await WIKI.models.users.getByEmail(email))?.id
          summary.usersMatched++
        }
      }
      if (userId) {
        for (const sourceId of entry.sourceIds) {
          userMap.set(sourceId, userId)
        }
      }
    }

    return { userMap, events }
  }

  /** Bring one note across. Never throws: a note that fails is reported and the run goes on. */
  private async importNote({
    note,
    revisions,
    namespace,
    userMap,
    aliasTaken,
    prefixes,
    options,
    summary
  }: {
    note: SourceNote
    revisions: SourceRevision[]
    namespace: string
    userMap: Map<string, string>
    /** The notes whose alias another note with the same one is imported under. */
    aliasTaken: Set<string>
    prefixes: string[]
    options: HedgedocImportOptions
    summary: HedgedocImportSummary
  }): Promise<HedgedocImportEvent[]> {
    const events: HedgedocImportEvent[] = []
    const content = note.content ?? ''
    const title = titleOf(content)
    const mapUsers = (ids: string[]) => [
      ...new Set(ids.map((id) => userMap.get(id)).filter((id): id is string => Boolean(id)))
    ]

    /*
      The history as this wiki keeps it: a revision only where the text changed from the one before,
      none for an empty note, and the authors of a revision dropped in between carried to the next one
      that is kept -- what `liveNotes.persist` would have recorded had it been watching. The note's
      current text closes it when the last revision HedgeDoc took is older than its last edit.
    */
    let replayed: { texts: string[]; drifted: boolean }
    try {
      replayed = replayRevisions(revisions)
    } catch (err: any) {
      // -> A patch that cannot be read loses the history, not the note: its text is still whole
      events.push({
        type: 'log',
        level: 'warn',
        key: 'historyLost',
        params: { title, error: err.message }
      })
      replayed = { texts: [], drifted: false }
      revisions = []
    }
    if (replayed.drifted) {
      events.push({ type: 'log', level: 'warn', key: 'historyDrifted', params: { title } })
    }

    const planned: PlannedRevision[] = []
    let previous = ''
    let previousAt = 0
    let carried: string[] = []
    for (const [index, revision] of revisions.entries()) {
      const text = replayed.texts[index]
      const at = revision.createdAt.getTime()
      carried.push(...authorsBetween(revision.authorship, previousAt, at))
      previousAt = at
      if (text === previous) {
        continue
      }
      planned.push({
        id: uuidv5(`revision:${revision.id}`, namespace),
        content: text,
        authorIds: mapUsers(carried),
        createdAt: revision.createdAt
      })
      previous = text
      carried = []
    }
    if (content !== previous) {
      const at = note.lastchangeAt ?? note.updatedAt
      carried.push(...authorsBetween(note.authorship, previousAt, at.getTime()))
      planned.push({
        id: uuidv5(`current:${note.id}`, namespace),
        content,
        authorIds: mapUsers(carried),
        createdAt: at
      })
    }
    if (!content && planned.length === 0) {
      summary.notesSkippedEmpty++
      return events
    }

    const id = uuidv5(`note:${note.id}`, namespace)
    const { key, refs } = hedgedocKeyOf(
      aliasTaken.has(note.id) ? { ...note, alias: null } : note,
      (candidate) => WIKI.models.liveNotes.isValidKey(candidate)
    )
    if (aliasTaken.has(note.id)) {
      events.push({ type: 'log', level: 'warn', key: 'duplicateAlias', params: { title } })
    }

    try {
      // -> What is in the way: a note under this key, or this note from an earlier run, whatever key
      //    it has now
      const conflicts = await WIKI.db
        .select({ id: liveNotesTable.id, siteId: liveNotesTable.siteId })
        .from(liveNotesTable)
        .where(
          and(
            eq(liveNotesTable.siteId, options.siteId),
            or(eq(liveNotesTable.key, key), eq(liveNotesTable.id, id))
          )
        )
      if (conflicts.length > 0) {
        if (!options.overwrite) {
          // -> A note this import brought in last time is not news; somebody else's is
          if (conflicts.every((row) => row.id === id)) {
            summary.notesAlreadyImported++
          } else {
            summary.notesSkippedConflict++
            events.push({ type: 'log', level: 'warn', key: 'noteConflict', params: { title } })
          }
          return events
        }
        for (const row of conflicts) {
          await WIKI.models.liveNotes.delete(row, options.actorId)
          WIKI.collab.noteDeleted(row.id)
        }
        summary.notesReplaced++
      }

      const createdAt = note.createdAt
      const updatedAt = note.lastchangeAt ?? note.updatedAt
      const creatorId = (note.ownerId && userMap.get(note.ownerId)) || null
      const lastEditorId = (note.lastchangeuserId && userMap.get(note.lastchangeuserId)) || null

      // -> The note whole and as HedgeDoc had it first, so that it is never seen half-written; the
      //    image URLs are rewritten afterwards, since an image can only be added to a note that exists
      let refsTaken = 0
      await WIKI.db.transaction(async (trx) => {
        await trx.insert(liveNotesTable).values({
          id,
          siteId: options.siteId,
          key,
          title,
          access: ACCESS_MAP[note.permission ?? ''] ?? 'editable',
          content,
          state: stateOf(content),
          creatorId,
          lastEditorId,
          createdAt,
          updatedAt
        })
        if (planned.length > 0) {
          await trx
            .insert(revisionsTable)
            .values(planned.map((revision) => ({ ...revision, noteId: id })))
        }
        if (refs.length > 0) {
          const taken = await trx
            .insert(legacyRefsTable)
            .values(refs.map((ref) => ({ siteId: options.siteId, ref, noteId: id })))
            .onConflictDoNothing()
            .returning({ ref: legacyRefsTable.ref })
          refsTaken = taken.length
        }
      })
      summary.revisions += planned.length
      if (refsTaken < refs.length) {
        events.push({
          type: 'log',
          level: 'warn',
          key: 'refConflict',
          params: { title, count: refs.length - refsTaken }
        })
      }

      if (prefixes.length > 0) {
        events.push(
          ...(await this.copyImages({
            note: {
              id,
              siteId: options.siteId,
              key,
              title,
              access: 'editable',
              creatorId,
              lastEditorId,
              createdAt,
              updatedAt
            },
            content,
            planned,
            prefixes,
            options,
            summary
          }))
        )
      }

      summary.notesImported++
    } catch (err: any) {
      summary.notesFailed++
      WIKI.logger.warn(`HedgeDoc import: note ${id} failed: ${err.message}`)
      events.push({
        type: 'log',
        level: 'error',
        key: 'noteFailed',
        params: { title, error: err.message }
      })
    }
    return events
  }

  /**
   * Copy the images a note and its revisions show from HedgeDoc's upload server into the note, and
   * point every mention at the copy.
   */
  private async copyImages({
    note,
    content,
    planned,
    prefixes,
    options,
    summary
  }: {
    note: LiveNoteSummary
    content: string
    planned: PlannedRevision[]
    prefixes: string[]
    options: HedgedocImportOptions
    summary: HedgedocImportSummary
  }): Promise<HedgedocImportEvent[]> {
    const events: HedgedocImportEvent[] = []
    const texts = [content, ...planned.map((revision) => revision.content)]
    // -> Up to whatever ends a URL in markdown or HTML: whitespace, a bracket, a quote
    const pattern = new RegExp(
      `(?:${prefixes.map(escapeRegExp).join('|')})[^\\s()<>\\[\\]"'\`]+`,
      'g'
    )
    const urls = new Set<string>()
    for (const text of texts) {
      for (const match of text.matchAll(pattern)) {
        urls.add(match[0])
      }
    }
    if (urls.size === 0) {
      return events
    }

    const limit = WIKI.config.security?.uploadMaxFileSize ?? 10485760
    const allow = WIKI.models.security.privateFetchAllowList()
    const copies = new Map<string, string>()
    for (const url of urls) {
      try {
        const data = await fetchPublic(url, { limit, timeout: IMAGE_TIMEOUT_MS, allow })
        const { url: copy } = await WIKI.models.liveNotes.addImage({
          note,
          data,
          authorId: options.actorId
        })
        copies.set(url, copy)
        summary.images++
      } catch (err: any) {
        summary.imagesFailed++
        events.push({
          type: 'log',
          level: 'warn',
          key: 'imageFailed',
          params: { title: note.title, url, error: err.message }
        })
      }
    }
    if (copies.size === 0) {
      return events
    }

    // -> Longest first, so that a URL which is the start of another is not replaced inside it
    const ordered = [...copies.keys()].sort((a, b) => b.length - a.length)
    const rewrite = (text: string) =>
      ordered.reduce((result, url) => result.replaceAll(url, copies.get(url)!), text)

    const rewritten = rewrite(content)
    await WIKI.db.transaction(async (trx) => {
      await trx
        .update(liveNotesTable)
        .set({ content: rewritten, title: titleOf(rewritten), state: stateOf(rewritten) })
        .where(eq(liveNotesTable.id, note.id))
      for (const revision of planned) {
        const text = rewrite(revision.content)
        if (text !== revision.content) {
          await trx
            .update(revisionsTable)
            .set({ content: text })
            .where(eq(revisionsTable.id, revision.id))
        }
      }
    })
    return events
  }
}

export const hedgedocImporter = new HedgedocImport()
