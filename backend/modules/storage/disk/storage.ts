import fs from 'node:fs/promises'
import path from 'node:path'
import { dump as dumpYaml, load as loadYaml } from 'js-yaml'
import { pageEditorForExtension, pageFileExtension } from '../../../models/pages.ts'
import type {
  StorageModule,
  StoragePageContent,
  StoragePageRef,
  StorageTarget
} from '../../../models/storage.ts'

/** Where files go when the target has no path configured, matching the definition's default. */
const DEFAULT_PATH = './data/content'

/** Leading YAML front matter, as `serializePage` writes it. */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** The extension whose pages are written as one JSON document rather than front matter and a body. */
const JSON_EXTENSION = 'json'

/**
 * The editor an imported page falls back to.
 *
 * Only reached for a file the site reserves as a page extension but which no editor writes — `txt` on
 * a default site. Markdown renders plain prose as prose, so it is the least surprising answer.
 */
const DEFAULT_PAGE_EDITOR = 'markdown'

/**
 * What the site's root page is filed as.
 *
 * A page path may be empty, which is the page a site serves at `/`. It still needs a name of its own
 * on disk, and `index` is the one every other tool that writes a tree of documents picks.
 */
const ROOT_PAGE_NAME = 'index'

/**
 * Names never picked up by `importAll`.
 *
 * A half-written file carries the first, and the second is what a Mac leaves in every folder it has
 * ever looked at — neither is content somebody meant to put in their wiki.
 */
const IGNORED_FILES = /^\.|\.tmp$/

/**
 * The root this target writes under, as an absolute path.
 *
 * A relative setting is resolved from the install directory rather than from the working directory,
 * so that `./data/content` means the same folder whichever way the server was started.
 */
function baseDir(target: StorageTarget): string {
  return path.resolve(WIKI.ROOTPATH, target.config.path || DEFAULT_PATH)
}

/**
 * Where an asset belongs under the root, as a slash-separated relative path.
 *
 * The locale brackets the tree because the tree repeats itself across locales — `guides/logo.png` can
 * exist once in each, and all of them would otherwise be the same file.
 *
 * The site does not, and this is the one thing to know about this layout: a target belongs to exactly
 * one site, so the folder an administrator configured IS this site's folder. A level for the site
 * inside it would be a folder that never has a sibling, and it would put the tree one step further
 * down than the path they typed.
 */
function relPathFor(ref: { locale: string; folderPath: string; fileName: string }): string {
  return [ref.locale, ...ref.folderPath.split('/').filter(Boolean), ref.fileName].join('/')
}

/**
 * Where a page's copy belongs, alongside the assets of the same folder.
 *
 * The extension is the one its editor writes, and is exactly what the wiki reserves against uploads —
 * `models/assets.ts` refuses an attachment that would take this name, so the two never meet here.
 */
function pagePathFor(ref: StoragePageRef): string {
  const segments = ref.path.split('/').filter(Boolean)
  const fileName = segments.pop() ?? ROOT_PAGE_NAME
  return [ref.locale, ...segments, `${fileName}.${pageFileExtension(ref.contentType)}`].join('/')
}

/**
 * The absolute path of a stored file, refusing anything that would land outside the root.
 *
 * Every segment reaching this is either a UUID or a name the tree has already normalized, so this
 * catches a stored path that has been tampered with rather than an ordinary mistake — but it is the
 * only thing between a `..` in the database and the rest of the file system.
 */
function absPathFor(target: StorageTarget, relPath: string): string {
  const base = baseDir(target)
  const resolved = path.resolve(base, relPath)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`The stored path "${relPath}" resolves outside the storage folder.`)
  }
  return resolved
}

/**
 * Remove the folders a deleted file leaves behind, stopping at the first one still in use.
 *
 * Best effort throughout: a folder that turns out not to be empty, or that another request is
 * writing into at that moment, is simply left alone.
 */
async function pruneEmptyDirs(target: StorageTarget, fromDir: string): Promise<void> {
  const base = baseDir(target)
  let dir = fromDir
  while (dir !== base && dir.startsWith(base + path.sep)) {
    try {
      await fs.rmdir(dir)
    } catch {
      return
    }
    dir = path.dirname(dir)
  }
}

/**
 * Write a file, creating its folder and leaving nothing half-written behind.
 *
 * Written under a temporary name and renamed, so a reader either finds the previous contents or the
 * new ones — never the middle of a write. That matters here more than it does for a cache: this is
 * the only copy of an asset once the database target has been purged.
 */
async function writeFileAtomic(filePath: string, data: Buffer | string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.tmp`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  try {
    await fs.writeFile(tempPath, data)
    await fs.rename(tempPath, filePath)
  } catch (err) {
    await fs.rm(tempPath, { force: true }).catch(() => {})
    throw err
  }
}

/**
 * Move a file, coping with a root that spans devices and with the file not being there.
 *
 * @returns Whether anything was moved
 */
async function moveFile(from: string, to: string): Promise<boolean> {
  await fs.mkdir(path.dirname(to), { recursive: true })
  try {
    await fs.rename(from, to)
    return true
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return false
    }
    if (err.code !== 'EXDEV') {
      throw err
    }
    // -> `rename` cannot cross a mount point
    await fs.copyFile(from, to)
    await fs.rm(from, { force: true })
    return true
  }
}

/** The metadata every page file carries, whichever of the two forms it is written in. */
function pageMeta(page: StoragePageContent): Record<string, any> {
  return {
    title: page.title,
    description: page.description,
    published: page.isPublished,
    date: page.updatedAt.toISOString(),
    tags: page.tags,
    // -> The declaration that makes this a page rather than a file that happens to sit here. Nothing
    //    is imported as a page without it, so it is the one key that must always be written.
    editor: page.editor,
    dateCreated: page.createdAt.toISOString()
  }
}

/**
 * A page as a file that stands on its own, in one of two forms.
 *
 * A **text** page is YAML front matter and then the source as the author wrote it — the convention
 * every static site generator reads and the one Wiki.js 2.x wrote, so the folder is worth something
 * to tools that have never heard of this wiki.
 *
 * A **JSON** page — a redirection today — is a single JSON document with the same metadata at its top
 * level and the source under `content`. Front matter would leave a `.json` file that is not JSON,
 * which is worth avoiding for the one editor whose source is already structured.
 *
 * Either way the metadata is the point: a bare body says nothing about whether it was published or
 * what it was called, and none of that is recoverable from the prose.
 */
function serializePage(ref: StoragePageRef, page: StoragePageContent): string {
  if (pageFileExtension(ref.contentType) === JSON_EXTENSION) {
    let content: any = page.content
    try {
      content = JSON.parse(page.content)
    } catch {
      // -> Kept as the string it is. The column is written by the editor and should always parse,
      //    and a file that says what it holds beats one this refused to write.
    }
    return `${JSON.stringify({ ...pageMeta(page), content }, null, 2)}\n`
  }
  return `---\n${dumpYaml(pageMeta(page))}---\n\n${page.content}\n`
}

/**
 * Read a page file back: its declaration, and the source below it.
 *
 * A page file says it is one by carrying an `editor` — in its front matter, or at the top level of
 * the JSON document for the one editor written that way. That declaration is what lets a page and an
 * attachment share a folder without this module having to guess which is which from an extension,
 * and it is how every file this module writes comes back.
 *
 * Returning null does not settle it. A file whose extension the site reserves for pages is a page
 * whatever it does or does not declare — see `importAll`, which owns that rule and fills the editor
 * in from the extension. This only reports whether the file said so itself.
 *
 * Beyond the one key it is forgiving: a file may have been hand-written or generated by something
 * that has never seen this wiki, so a missing title or date is filled in by the caller, and front
 * matter that is not YAML is treated as no declaration rather than as a fault.
 *
 * @returns The declaration and the source, or null for a file that does not declare itself a page
 */
function deserializePage(
  raw: string,
  ext: string
): { meta: Record<string, any>; content: string } | null {
  if (ext === JSON_EXTENSION) {
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    if (!parsed || typeof parsed !== 'object' || typeof parsed.editor !== 'string') {
      return null
    }
    const { content, ...meta } = parsed
    return {
      meta,
      content: typeof content === 'string' ? content : JSON.stringify(content ?? {})
    }
  }

  const match = FRONT_MATTER.exec(raw)
  if (!match) {
    return null
  }
  let meta: Record<string, any>
  try {
    const parsed = loadYaml(match[1])
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    meta = parsed as Record<string, any>
  } catch {
    return null
  }
  if (typeof meta.editor !== 'string' || !meta.editor) {
    return null
  }
  return { meta, content: raw.slice(match[0].length).trim() }
}

/** A front matter date, or undefined for one that is missing or not a date at all. */
function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Take everything in a target's folder into the wiki, either filling in what is missing or letting
 * the folder win.
 *
 * The body of both import actions. They differ by one flag and by the verb they report with, because
 * the walk, what counts as a page, and what is done with a file that is neither are the same
 * question whichever way a collision is settled — see `importAll` for that walk, and the two models'
 * `adoptStoredPage` / `adoptStoredFile` for what `overwrite` means once a file has landed on
 * something.
 */
async function runImport(
  target: StorageTarget,
  actorId: string,
  { overwrite }: { overwrite: boolean }
): Promise<string> {
  const root = baseDir(target)
  let entries
  try {
    entries = await fs.readdir(root, { recursive: true, withFileTypes: true })
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err
    }
    return 'There is nothing in the storage folder for this site yet.'
  }

  const reserved: string[] = WIKI.sites[target.siteId]?.config?.pageExtensions ?? []
  let pages = 0
  let assets = 0
  let skipped = 0
  let failed = 0

  for (const entry of entries) {
    if (!entry.isFile() || IGNORED_FILES.test(entry.name)) {
      continue
    }
    const filePath = path.join(entry.parentPath, entry.name)
    // -> `<locale>/<folders…>/<file>`, so a file sitting straight in the root is outside the
    //    layout and belongs to no locale
    const segments = path.relative(root, filePath).split(path.sep)
    if (segments.length < 2) {
      continue
    }
    const [locale, ...rest] = segments
    const fileName = rest.pop()!
    const ext = path.extname(fileName).replace(/^\./, '').toLowerCase()
    const folderPath = rest.join('/')

    const raw = await fs.readFile(filePath)
    const declared = deserializePage(raw.toString('utf8'), ext)
    const isReservedExtension = Boolean(ext) && reserved.includes(ext)

    if (!declared && !isReservedExtension) {
      const asset = await WIKI.models.assets.adoptStoredFile({
        siteId: target.siteId,
        locale,
        folderPath,
        fileName,
        data: raw,
        authorId: actorId,
        overwrite
      })
      if (asset) {
        assets++
      } else {
        skipped++
      }
      continue
    }

    // -> A page is addressed without its extension: `guides/setup.md` is the page at `guides/setup`
    const name = fileName.slice(0, fileName.length - (ext ? ext.length + 1 : 0))
    const meta = declared?.meta ?? {}
    try {
      const imported = await WIKI.models.pages.adoptStoredPage({
        siteId: target.siteId,
        locale,
        // -> The root page is filed under a name of its own, and takes the empty path back
        path: [...rest, ...(name === ROOT_PAGE_NAME ? [] : [name])].join('/'),
        // -> The declaration first, then the file itself: a page written by hand carries no title,
        //    and its name is the next best thing
        title: typeof meta.title === 'string' && meta.title ? meta.title : name,
        description: typeof meta.description === 'string' ? meta.description : '',
        editor:
          typeof meta.editor === 'string' && meta.editor
            ? meta.editor
            : (pageEditorForExtension(ext) ?? DEFAULT_PAGE_EDITOR),
        tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
        isPublished: meta.published !== false,
        // -> Undeclared means there was no front matter to strip, so the file is all body
        content: declared?.content ?? raw.toString('utf8').trim(),
        createdAt: parseDate(meta.dateCreated),
        updatedAt: parseDate(meta.date),
        authorId: actorId,
        overwrite
      })
      if (imported) {
        pages++
      } else {
        skipped++
      }
    } catch (err: any) {
      // -> One unusable file — an empty body, an editor this wiki does not have, a path it cannot
      //    address — must not stop the rest of the folder from being imported
      failed++
      WIKI.logger.warn(`Could not import the page at ${filePath} [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
    }
  }

  WIKI.logger.info(`Imported ${pages} page(s) and ${assets} asset(s) from ${root} [ OK ]`)
  // -> Nothing is reported as merely imported when a run could have replaced something: an
  //    administrator reading "Imported 40 pages" has to be able to tell which of the two they ran
  const verb = overwrite ? 'Imported or replaced' : 'Imported'
  const parts = []
  if (pages > 0) {
    parts.push(`${verb} ${pages} page(s).`)
  }
  if (assets > 0) {
    parts.push(`${verb} ${assets} asset(s).`)
  }
  if (parts.length < 1) {
    parts.push(overwrite ? 'There was nothing to import.' : 'There was nothing new to import.')
  }
  if (skipped > 0) {
    // -> With `overwrite` the only thing left to skip is a name a page or a folder owns, which is not
    //    something this action was ever going to take over
    parts.push(
      overwrite
        ? `${skipped} could not replace what is at their path and were left alone.`
        : `${skipped} were already in the wiki and were left alone.`
    )
  }
  if (failed > 0) {
    parts.push(`${failed} could not be imported - see the server log.`)
  }
  return parts.join(' ')
}

/**
 * Local file system storage module
 *
 * Mirrors the wiki's own tree onto disk under the folder the target is configured with, laid out
 * `<locale>/<folders…>/<file>` — so that what an administrator sees in the file manager is what they
 * find in the folder, and so that a wiki's content remains ordinary files: readable, backed up and
 * served by whatever else is on the machine. Pages and assets share that tree, a page filed under its
 * editor's extension; keeping the two from colliding belongs to the models, not here.
 *
 * The folder is the site's own, with no level inside it naming the site — see `relPathFor`. Two sites
 * therefore must not be pointed at the same path.
 *
 * Nothing records where a file went. Every path is derived from the ref it is given, the same way
 * every time, which is what lets a copy be read back, moved or deleted with nothing stored about
 * where it sits — and what makes a folder written by one instance mean the same thing to the next.
 *
 * Where assets and pages differ is in what a failure costs. An **asset** may have no copy anywhere
 * else, so writes are atomic and a failure is raised for the caller to fail the upload on. A **page**
 * is a database row and always will be, so what sits here is a rendering of it written after the
 * fact, never read back, and allowed to fail.
 */
const diskStorage: StorageModule = {
  async putAsset(target, ref, data) {
    await writeFileAtomic(absPathFor(target, relPathFor(ref)), data)
  },

  async getAsset(target, ref) {
    try {
      return await fs.readFile(absPathFor(target, relPathFor(ref)))
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err
      }
      // -> This target does not have the file: it was enabled after the asset was uploaded, or the
      //    folder was emptied from outside the wiki. Not a fault — the caller asks the next target.
      return null
    }
  },

  async deleteAsset(target, ref) {
    const filePath = absPathFor(target, relPathFor(ref))
    await fs.rm(filePath, { force: true })
    await pruneEmptyDirs(target, path.dirname(filePath))
  },

  async moveAsset(target, ref, previous) {
    const from = absPathFor(target, relPathFor({ ...ref, ...previous }))
    if (await moveFile(from, absPathFor(target, relPathFor(ref)))) {
      await pruneEmptyDirs(target, path.dirname(from))
    }
  },

  async putPage(target, ref, page) {
    await writeFileAtomic(absPathFor(target, pagePathFor(ref)), serializePage(ref, page))
  },

  async deletePage(target, ref) {
    // -> Exactly one name, taken from the page's own content type. Guessing at the others would mean
    //    deleting whatever happens to sit beside it: in this folder `readme.html` is as likely to be
    //    an attachment as it is to be the page `readme`.
    const filePath = absPathFor(target, pagePathFor(ref))
    await fs.rm(filePath, { force: true })
    await pruneEmptyDirs(target, path.dirname(filePath))
  },

  async movePage(target, ref, previousPath) {
    // -> Which editor wrote it does not change when a page moves, so both ends share an extension
    const from = absPathFor(target, pagePathFor({ ...ref, path: previousPath }))
    if (await moveFile(from, absPathFor(target, pagePathFor(ref)))) {
      await pruneEmptyDirs(target, path.dirname(from))
    }
  },

  /**
   * Write a copy of everything this target is configured to hold to the file system.
   *
   * A plain export, and deliberately nothing more: it reads content from wherever it currently lives
   * and writes it here, overwriting whatever is already at each path. Nothing in the database is
   * touched — no asset is repointed at this target, and none of the space they take up elsewhere is
   * freed. Run it twice and the second run does the same work to the same effect.
   *
   * What that makes it useful for is having the folder be a faithful copy of the wiki on demand: a
   * backup to archive, a tree to hand to a static site generator, a starting point for another
   * instance to import. What it deliberately does not do is migrate: an asset already stored in the
   * database goes on being served from the database afterwards, and only content uploaded while this
   * target is enabled is stored here in the first place.
   */
  async exportAll(target: StorageTarget): Promise<string> {
    let assets = 0
    let unreadable = 0
    for (const asset of await WIKI.models.assets.listStoredAssets(target.siteId)) {
      // -> Only what the current configuration says belongs here: an administrator who turned this
      //    target on for images alone did not ask for their videos to be written out as well
      const contentType = WIKI.models.storage.contentTypeFor(
        target.siteId,
        asset.kind,
        asset.fileSize
      )
      if (!target.contentTypes.activeTypes.includes(contentType)) {
        continue
      }
      const data = await WIKI.models.storage.getAsset(asset)
      if (!data) {
        unreadable++
        continue
      }
      await diskStorage.putAsset(target, asset, data)
      assets++
    }

    let pages = 0
    if (target.contentTypes.activeTypes.includes('pages')) {
      for (const { ref, content } of await WIKI.models.pages.listForStorage(target.siteId)) {
        await diskStorage.putPage(target, ref, content)
        pages++
      }
    }

    WIKI.logger.info(
      `Exported ${assets} asset(s) and ${pages} page(s) to ${baseDir(target)} [ OK ]`
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
    return parts.join(' ')
  },

  /**
   * Take everything in the folder that the wiki does not know about yet into the wiki.
   *
   * The direction that makes this folder a store rather than a dumping ground: content arrives here
   * from outside — restored from a backup, generated by another tool, unpacked from an archive — and
   * this is what turns it back into pages and assets.
   *
   * **Two ways a file is a page**, and everything else is an attachment, read where it lies and
   * adopted in place rather than copied:
   *
   * 1. **Its extension is one the site reserves for pages.** Those extensions address a page by URL
   *    and cannot be uploaded as attachments, so nothing else can be sitting under one — which makes
   *    a hand-written `.md` dropped into the folder a page, as whoever dropped it meant.
   * 2. **It declares an editor**, in its front matter or at the top level of its JSON. This is what
   *    every file written here carries, and it is the only way in for an extension the site does not
   *    reserve — `.adoc` on a default site, where an attachment could just as well be sitting.
   *
   * Which editor it belongs to comes from that declaration, and only falls back to the extension for
   * a reserved one that made none.
   *
   * A path the wiki already has an entry at is left alone in both directions: nothing on disk is
   * overwritten, and nothing in the wiki is. That makes this safe to run repeatedly, and makes it no
   * use for picking up a file that changed on both sides — reconciling those two is a merge, and this
   * module has no history to do one from. A target that does, git being the obvious one, is where
   * that belongs. `importAllOverwrite` is the answer for the case where there is nothing to reconcile
   * because the folder is simply right.
   */
  async importAll(target: StorageTarget, actorId: string): Promise<string> {
    return runImport(target, actorId, { overwrite: false })
  },

  /**
   * The same walk, with the folder winning every collision.
   *
   * For the case `importAll` deliberately refuses: not filling in what the wiki is missing but making
   * it say what the folder says — a restore onto an instance that already has content, or a tree
   * edited outside the wiki that is meant to be taken as the new truth. Nothing else about the import
   * changes; only what happens to a file that lands on something.
   *
   * The two halves are not equally recoverable, which is the thing to know before running it. A
   * **page** is replaced by an ordinary save, so its previous version is in its history. An **asset**
   * has no history: its bytes are overwritten on every target holding them and the ones they replaced
   * are gone.
   */
  async importAllOverwrite(target: StorageTarget, actorId: string): Promise<string> {
    return runImport(target, actorId, { overwrite: true })
  }
}

export default diskStorage
