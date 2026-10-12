/**
 * The browser's copy of an edit nobody has saved yet, in IndexedDB.
 *
 * This file is the storage alone; when to write, when to offer an entry back and how it is put into
 * an editor are `composables/editorBuffer.js`. See `dev/specs/drafts.md` §11 for the design.
 *
 * **Every call here fails quietly.** A private window, blocked site data, a full disk and a browser
 * with no IndexedDB at all each make it throw, and none of them is a reason for the editor to stop
 * working -- losing the buffer is losing a safety net, not the edit in front of the author. So each
 * export catches, warns once, and answers as though there were nothing stored.
 *
 * Two object stores, because the pictures pasted into an edit are kept too:
 *
 *   - `entries` -- one per user and page (see `bufferKey`): the source, the page fields and a list of
 *     the pending assets. Rewritten whole on every write, a second after a change.
 *   - `files` -- one per pending asset, holding its `File`. Separate so that the entry can be
 *     rewritten every second without copying a 20 MB screenshot along with it each time: a file is
 *     written once, when it first appears, and deleted with the entry or once the edit stops using it.
 *     Their `blob:` URLs die with the document that made them, so the file is the only thing worth
 *     keeping; a restore makes new URLs and rewrites the source to match.
 */

const DB_NAME = 'wiki-editor-buffer'
const DB_VERSION = 1
const ENTRIES = 'entries'
const FILES = 'files'

/** The open database, or the failure to open it -- kept either way, so a refusal is not retried every second. */
let dbPromise = null
let warned = false

function warnOnce(err) {
  if (!warned) {
    warned = true
    console.warn(`Unsaved edits cannot be kept in this browser: ${err?.message ?? err}`)
  }
}

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        db.createObjectStore(ENTRIES, { keyPath: 'key' }).createIndex('userId', 'userId')
        db.createObjectStore(FILES, { keyPath: 'id' }).createIndex('key', 'key')
      }
      request.onsuccess = () => {
        const db = request.result
        // -> Another tab opening a newer version of this database has to be able to; this one goes
        //    on without a buffer rather than blocking it
        db.onversionchange = () => db.close()
        resolve(db)
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('The editor buffer database is blocked.'))
    })
  }
  return dbPromise
}

/** One request as a promise. */
function done(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Run `work` in one transaction, resolving with what it returned once the transaction has COMMITTED
 * rather than once its last request answered -- a write is only kept when the whole of it is.
 */
async function transact(stores, mode, work) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    let result
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('The editor buffer write was aborted.'))
    Promise.resolve(work(tx)).then(
      (value) => {
        result = value
      },
      (err) => {
        try {
          tx.abort()
        } catch {
          // -> Already finished, which the handlers above have dealt with
        }
        reject(err)
      }
    )
  })
}

/** Delete one entry's files, keeping those named in `keep`. Part of a transaction already open. */
async function pruneFiles(tx, key, keep = new Set()) {
  const files = tx.objectStore(FILES)
  const ids = await done(files.index('key').getAllKeys(key))
  await Promise.all(ids.filter((id) => !keep.has(id)).map((id) => done(files.delete(id))))
}

/**
 * Where an edit is kept.
 *
 * Per user, so that an account signed in after another on the same browser is never offered what the
 * first one wrote. Per site and page, and per MODE, because a suggestion and an edit of the same page
 * are two different pieces of work that happen to share a source.
 *
 * A page being created has no id to be filed under, nor a path that is settled -- the save-as dialog
 * is where that is decided, and the create route carries no path of its own to come back to after a
 * crash. So it is filed under its editor: opening a new page with the same editor is what offers it
 * back, with the path it was going to have.
 *
 * @returns {?string} Null when there is nobody to file it under.
 */
export function bufferKey({ userId, siteId, mode, pageId, editor }) {
  if (!userId || !siteId) {
    return null
  }
  if (mode === 'create') {
    return editor ? `${userId}:${siteId}:create:${editor}` : null
  }
  return pageId ? `${userId}:${siteId}:${mode}:${pageId}` : null
}

/** @returns {Promise<?object>} The entry, or null for none -- and for a buffer that cannot be read. */
export async function readBufferEntry(key) {
  try {
    return (
      (await transact([ENTRIES], 'readonly', (tx) => done(tx.objectStore(ENTRIES).get(key)))) ??
      null
    )
  } catch (err) {
    warnOnce(err)
    return null
  }
}

/** @returns {Promise<Array<{ id: string, file: File }>>} The files kept with an entry. */
export async function readBufferFiles(key) {
  try {
    const rows = await transact([FILES], 'readonly', (tx) =>
      done(tx.objectStore(FILES).index('key').getAll(key))
    )
    return (rows ?? []).map(({ id, file }) => ({ id, file }))
  } catch (err) {
    warnOnce(err)
    return []
  }
}

/**
 * Keep an edit, replacing whatever was kept for it before.
 *
 * Files already stored are left where they are, and the ones the edit no longer uses go. When the
 * files are what will not fit -- a quota is the likely failure, and a video is the likely cause -- the
 * entry is written again without them: the text is the part worth keeping, and a restored page with a
 * broken image in it is far better than no restore at all.
 *
 * @param {object} entry Plain data; nothing reactive survives being cloned into IndexedDB.
 * @param {Array<{ id: string, file: File }>} files The pending assets the entry lists.
 * @returns {Promise<boolean>} Whether it was kept.
 */
export async function writeBufferEntry(entry, files = []) {
  const write = (withFiles) =>
    transact([ENTRIES, FILES], 'readwrite', async (tx) => {
      const store = tx.objectStore(FILES)
      const keep = new Set()
      if (withFiles) {
        const stored = new Set(await done(store.index('key').getAllKeys(entry.key)))
        for (const { id, file } of files) {
          keep.add(id)
          if (!stored.has(id)) {
            await done(store.put({ id, key: entry.key, file }))
          }
        }
      }
      await pruneFiles(tx, entry.key, keep)
      await done(tx.objectStore(ENTRIES).put(entry))
    })

  try {
    await write(true)
    return true
  } catch (err) {
    if (files.length < 1) {
      warnOnce(err)
      return false
    }
  }
  try {
    await write(false)
    return true
  } catch (err) {
    warnOnce(err)
    return false
  }
}

/** Forget an edit and its files. */
export async function deleteBufferEntry(key) {
  try {
    await transact([ENTRIES, FILES], 'readwrite', async (tx) => {
      await pruneFiles(tx, key)
      await done(tx.objectStore(ENTRIES).delete(key))
    })
  } catch (err) {
    warnOnce(err)
  }
}

/**
 * Forget everything kept for one user -- what signing out does, since the next person at this browser
 * has no business finding somebody else's unsaved pages in it.
 */
export async function clearBufferForUser(userId) {
  if (!userId) {
    return
  }
  try {
    await transact([ENTRIES, FILES], 'readwrite', async (tx) => {
      const keys = await done(tx.objectStore(ENTRIES).index('userId').getAllKeys(userId))
      for (const key of keys) {
        await pruneFiles(tx, key)
        await done(tx.objectStore(ENTRIES).delete(key))
      }
    })
  } catch (err) {
    warnOnce(err)
  }
}
