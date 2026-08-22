import path from 'node:path'
import SftpClient from 'ssh2-sftp-client'
import {
  assetRelPath,
  importTree,
  pageRelPath,
  serializePage
} from '../../../helpers/storageFiles.ts'
import type { ImportSummary, StoredFile } from '../../../helpers/storageFiles.ts'
import type { StorageModule, StorageTarget } from '../../../models/storage.ts'

/** Where files go when the target has no base path configured, matching the definition default. */
const DEFAULT_BASE_PATH = '/var/wiki'

/** Names never walked by an import, as on the local disk. */
const IGNORED_NAME = /^\./

/** One live connection, plus the queue that keeps it to one operation at a time. */
interface Connection {
  client: SftpClient
  fingerprint: string
  queue: Promise<unknown>
}

const connections = new Map<string, Connection>()

/** The remote root this target writes under, without a trailing slash. */
function baseDir(target: StorageTarget): string {
  return (target.config.basePath || DEFAULT_BASE_PATH).replace(/\/+$/, '') || '/'
}

/** Everything a connection is made from — a change to any of it needs a new one. */
function configFingerprint(target: StorageTarget): string {
  const c = target.config
  return JSON.stringify([
    c.host,
    c.port,
    c.authMode,
    c.username,
    c.privateKey,
    c.passphrase,
    c.password
  ])
}

/**
 * The absolute remote path of a stored file, refusing anything that would land outside the root.
 *
 * `path.posix` throughout rather than `path`, because the shape of the remote file system has nothing
 * to do with the shape of this one: a wiki running on Windows still talks to an SSH server in
 * slashes, and `path.win32.resolve` would turn every one of these into a backslash path the server
 * has never heard of.
 */
function remotePath(target: StorageTarget, relPath: string): string {
  const base = baseDir(target)
  const resolved = path.posix.resolve(base, relPath)
  if (resolved !== base && !resolved.startsWith(base === '/' ? '/' : `${base}/`)) {
    throw new Error(`The stored path "${relPath}" resolves outside the base directory.`)
  }
  return resolved
}

/**
 * Run something against this target's connection, one operation at a time.
 *
 * A single SFTP client multiplexes badly — `ssh2-sftp-client` is explicit that concurrent operations
 * on one instance are not supported — so the queue is what makes two simultaneous uploads safe. Per
 * target, because two targets are two servers.
 *
 * A connection that fails is dropped rather than reused: the failure may be the connection itself,
 * and the next operation is what re-establishes it. This is also the reconnect path after the server
 * has timed the session out, which for a wiki that uploads a file once a week it always will have.
 */
async function withClient<T>(
  target: StorageTarget,
  run: (client: SftpClient) => Promise<T>
): Promise<T> {
  const fingerprint = configFingerprint(target)
  let connection = connections.get(target.id)
  if (connection && connection.fingerprint !== fingerprint) {
    await connection.client.end().catch(() => {})
    connections.delete(target.id)
    connection = undefined
  }
  if (!connection) {
    connection = { client: new SftpClient(), fingerprint, queue: Promise.resolve() }
    connections.set(target.id, connection)
    connection.queue = connect(target, connection.client).catch((err) => {
      connections.delete(target.id)
      throw err
    })
  }

  const entry = connection
  const result = entry.queue.then(
    () => run(entry.client),
    // -> The previous operation failed; this one still gets its turn, on a connection that may well
    //    have been replaced underneath it
    () => run(entry.client)
  )
  entry.queue = result.catch(() => {})
  try {
    return await result
  } catch (err: any) {
    if (isConnectionError(err)) {
      await entry.client.end().catch(() => {})
      connections.delete(target.id)
    }
    throw err
  }
}

/** Open the connection and check the base directory is actually there. */
async function connect(target: StorageTarget, client: SftpClient): Promise<void> {
  const { host, port, authMode, username, privateKey, passphrase, password } = target.config
  WIKI.logger.info(`(STORAGE/SFTP) Connecting to ${username}@${host}...`)
  await client.connect({
    host,
    port: Number(port) || 22,
    username,
    ...(authMode === 'password'
      ? { password }
      : { privateKey, ...(passphrase ? { passphrase } : {}) })
  })
  const base = baseDir(target)
  if (!(await client.exists(base))) {
    // -> Not created: the base path is where somebody has decided this site's content belongs, and
    //    a typo in it should be a refusal rather than a new directory nobody meant
    throw new Error(
      `The base directory ${base} does not exist on the remote server, or the user cannot see it.`
    )
  }
}

/** Whether this looks like the session rather than the file being the problem. */
function isConnectionError(err: any): boolean {
  const message = String(err?.message ?? '')
  return (
    /connect|closed|ECONNRESET|ETIMEDOUT|EPIPE|not connected|handshake|authentication/i.test(
      message
    ) && !isMissing(err)
  )
}

/** Whether the server is telling us the file simply is not there. */
function isMissing(err: any): boolean {
  return err?.code === 2 || /no such file|ENOENT/i.test(String(err?.message ?? ''))
}

/** Read every file under a remote directory, skipping anything hidden. */
async function walkRemote(client: SftpClient, root: string, dir: string): Promise<StoredFile[]> {
  const found: StoredFile[] = []
  let entries
  try {
    entries = await client.list(dir)
  } catch (err: any) {
    if (isMissing(err)) {
      return found
    }
    throw err
  }
  for (const entry of entries) {
    if (IGNORED_NAME.test(entry.name)) {
      continue
    }
    const full = path.posix.join(dir, entry.name)
    if (entry.type === 'd') {
      found.push(...(await walkRemote(client, root, full)))
    } else if (entry.type === '-') {
      found.push({
        filePath: full,
        segments: path.posix.relative(root, full).split('/')
      })
    }
  }
  return found
}

/** Write a file, creating the directories above it. */
async function writeRemote(
  client: SftpClient,
  target: StorageTarget,
  relPath: string,
  data: Buffer
): Promise<void> {
  const filePath = remotePath(target, relPath)
  const dir = path.posix.dirname(filePath)
  // -> `true` is recursive, and an existing directory is not an error to this client
  await client.mkdir(dir, true).catch(() => {})
  await client.put(data, filePath)
}

/** Remove a file, and any directories it leaves empty, stopping at the first one still in use. */
async function removeRemote(
  client: SftpClient,
  target: StorageTarget,
  relPath: string
): Promise<void> {
  const base = baseDir(target)
  const filePath = remotePath(target, relPath)
  try {
    await client.delete(filePath)
  } catch (err: any) {
    if (!isMissing(err)) {
      throw err
    }
  }
  let dir = path.posix.dirname(filePath)
  while (dir !== base && dir.startsWith(`${base}/`)) {
    try {
      await client.rmdir(dir)
    } catch {
      // -> Not empty, or another request is writing into it. Best effort, exactly as on disk.
      return
    }
    dir = path.posix.dirname(dir)
  }
}

/** Follow a rename, where either end may be a locale this site does not store. */
async function moveRemote(
  client: SftpClient,
  target: StorageTarget,
  fromRel: string | null,
  toRel: string | null
): Promise<void> {
  if (!fromRel) {
    return
  }
  if (!toRel) {
    await removeRemote(client, target, fromRel)
    return
  }
  const from = remotePath(target, fromRel)
  const to = remotePath(target, toRel)
  await client.mkdir(path.posix.dirname(to), true).catch(() => {})
  try {
    await client.rename(from, to)
  } catch (err: any) {
    // -> Nothing there to move: this target was enabled after the file was uploaded
    if (!isMissing(err)) {
      throw err
    }
    return
  }
  let dir = path.posix.dirname(from)
  const base = baseDir(target)
  while (dir !== base && dir.startsWith(`${base}/`)) {
    try {
      await client.rmdir(dir)
    } catch {
      return
    }
    dir = path.posix.dirname(dir)
  }
}

/** What an import run did, in the words the two import actions report it with. */
function describeImport(summary: ImportSummary | null, overwrite: boolean): string {
  if (!summary) {
    return 'There is nothing in the base directory for this site yet.'
  }
  const verb = overwrite ? 'Imported or replaced' : 'Imported'
  const parts = []
  if (summary.pages > 0) {
    parts.push(`${verb} ${summary.pages} page(s).`)
  }
  if (summary.assets > 0) {
    parts.push(`${verb} ${summary.assets} asset(s).`)
  }
  if (parts.length < 1) {
    parts.push(overwrite ? 'There was nothing to import.' : 'There was nothing new to import.')
  }
  if (summary.skipped > 0) {
    parts.push(
      overwrite
        ? `${summary.skipped} could not replace what is at their path and were left alone.`
        : `${summary.skipped} were already in the wiki and were left alone.`
    )
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} could not be imported - see the server log.`)
  }
  return parts.join(' ')
}

/**
 * SFTP storage module
 *
 * The local disk target, on a machine that is not this one. The same tree, laid out the same way and
 * bracketed by whatever the site's `pathPrefixFor` says, written over SSH — so a wiki can keep its
 * content on a NAS or a backup host without that machine having to run anything but sshd.
 *
 * Everything about the shape of the tree is `helpers/storageFiles.ts`, shared with `disk` and `git`.
 * What this module adds is the connection: one at a time per target, re-established when it drops,
 * and posix paths throughout however this server spells its own.
 *
 * **It reads as well as writes**, which the 2.x module did not — it declared no streaming support and
 * had no way back out. Here `getAsset` is part of the contract, so a site can serve files from the
 * remote host, and the two import actions can take a tree on it into the wiki.
 */
const sftpStorage: StorageModule = {
  canStore(target, ref) {
    return WIKI.models.storage.pathPrefixFor(target.siteId, ref.locale) !== null
  },

  async putAsset(target, ref, data) {
    const relPath = assetRelPath(target, ref)
    // -> Guarded rather than skipped: the model asks `canStore` before dispatching a write, so
    //    reaching this means somebody wrote without asking, and an asset may have no other copy
    if (!relPath) {
      throw new Error(
        `${target.title} has no path for ${ref.locale} content, so ${ref.fileName} cannot be stored there.`
      )
    }
    await withClient(target, (client) => writeRemote(client, target, relPath, data))
  },

  async getAsset(target, ref) {
    const relPath = assetRelPath(target, ref)
    if (!relPath) {
      return null
    }
    return withClient(target, async (client) => {
      try {
        return (await client.get(remotePath(target, relPath))) as Buffer
      } catch (err: any) {
        if (isMissing(err)) {
          // -> This target does not have the file: enabled after the upload, or removed from
          //    outside the wiki. Not a fault — the caller asks the next target.
          return null
        }
        throw err
      }
    })
  },

  async deleteAsset(target, ref) {
    const relPath = assetRelPath(target, ref)
    if (!relPath) {
      return
    }
    await withClient(target, (client) => removeRemote(client, target, relPath))
  },

  async moveAsset(target, ref, previous) {
    await withClient(target, (client) =>
      moveRemote(
        client,
        target,
        assetRelPath(target, { ...ref, ...previous }),
        assetRelPath(target, ref)
      )
    )
  },

  async putPage(target, ref, page) {
    const relPath = pageRelPath(target, ref)
    // -> Unlike an asset, a page with no place here is not worth failing over: it is in the
    //    database, which is where a page always is, and this copy is the thing the site declined
    if (!relPath) {
      return
    }
    await withClient(target, (client) =>
      writeRemote(client, target, relPath, Buffer.from(serializePage(ref, page), 'utf8'))
    )
  },

  async deletePage(target, ref) {
    // -> Exactly one name, taken from the page's own content type: in a folder where pages and
    //    attachments sit together, guessing at the others would delete whatever is beside it
    const relPath = pageRelPath(target, ref)
    if (!relPath) {
      return
    }
    await withClient(target, (client) => removeRemote(client, target, relPath))
  },

  async movePage(target, ref, previousPath) {
    await withClient(target, (client) =>
      moveRemote(
        client,
        target,
        pageRelPath(target, { ...ref, path: previousPath }),
        pageRelPath(target, ref)
      )
    )
  },

  /**
   * Write a copy of everything this target is configured to hold to the remote server.
   *
   * A plain copy: content is read from wherever it currently lives and written here, overwriting
   * whatever is at each path. Nothing in the database is touched, so this is how content that
   * predates the target being enabled gets onto it, and running it twice does the same work.
   */
  async exportAll(target: StorageTarget): Promise<string> {
    let assets = 0
    let unreadable = 0
    let unstored = 0
    let pages = 0

    await withClient(target, async (client) => {
      for (const asset of await WIKI.models.assets.listStoredAssets(target.siteId)) {
        const contentType = WIKI.models.storage.contentTypeFor(
          target.siteId,
          asset.kind,
          asset.fileSize
        )
        if (!target.contentTypes.activeTypes.includes(contentType)) {
          continue
        }
        const relPath = assetRelPath(target, asset)
        if (!relPath) {
          unstored++
          continue
        }
        const data = await WIKI.models.storage.getAsset(asset)
        if (!data) {
          unreadable++
          continue
        }
        await writeRemote(client, target, relPath, data)
        assets++
      }

      if (target.contentTypes.activeTypes.includes('pages')) {
        for (const { ref, content } of await WIKI.models.pages.listForStorage(target.siteId)) {
          const relPath = pageRelPath(target, ref)
          if (!relPath) {
            unstored++
            continue
          }
          await writeRemote(
            client,
            target,
            relPath,
            Buffer.from(serializePage(ref, content), 'utf8')
          )
          pages++
        }
      }
    })

    WIKI.logger.info(
      `(STORAGE/SFTP) Exported ${assets} asset(s) and ${pages} page(s) to ${baseDir(target)} [ OK ]`
    )
    const parts = []
    if (assets > 0 || pages > 0) {
      parts.push(`Exported ${pages} page(s) and ${assets} asset(s).`)
    } else {
      parts.push('There was nothing to export.')
    }
    if (unreadable > 0) {
      parts.push(`${unreadable} asset(s) could not be read and were skipped.`)
    }
    if (unstored > 0) {
      const { primaryLocale } = WIKI.models.storage.pathLayoutFor(target.siteId)
      parts.push(
        `${unstored} item(s) are not in the ${primaryLocale} locale, which is the only one this site stores.`
      )
    }
    return parts.join(' ')
  },

  /**
   * Take everything on the remote server that the wiki does not know about yet into the wiki.
   *
   * The direction that makes the remote host a store rather than a dumping ground: content arrives
   * there from outside — restored from a backup, dropped in over scp — and this is what turns it back
   * into pages and assets. What counts as a page is `importTree`'s to say, exactly as it is for the
   * local disk; the only difference here is where the bytes are read from.
   */
  async importAll(target: StorageTarget, actorId: string): Promise<string> {
    return describeImport(await runImport(target, actorId, false), false)
  },

  /**
   * The same walk, with the remote server winning every collision.
   *
   * For a restore, or a tree edited on the server that is meant to be taken as the new truth. A page
   * it replaces keeps its previous version in its history; an asset has none.
   */
  async importAllOverwrite(target: StorageTarget, actorId: string): Promise<string> {
    return describeImport(await runImport(target, actorId, true), true)
  }
}

/**
 * Walk the remote tree and hand it to the shared adoption code.
 *
 * One connection for the whole run — the walk and every read go through the same queued client,
 * rather than a fresh operation per file.
 */
async function runImport(
  target: StorageTarget,
  actorId: string,
  overwrite: boolean
): Promise<ImportSummary | null> {
  const root = baseDir(target)
  return withClient(target, async (client) => {
    const files = await walkRemote(client, root, root)
    return importTree({
      target,
      root,
      actorId,
      overwrite,
      files,
      // -> `filePath` here is already an absolute remote path, put there by the walk above
      readFile: async (filePath) => (await client.get(filePath)) as Buffer
    })
  })
}

export default sftpStorage
