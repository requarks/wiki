import fs from 'node:fs/promises'
import path from 'node:path'
import { dump as dumpYaml, load as loadYaml } from 'js-yaml'
import { pageEditorForExtension, pageFileExtension } from '../models/pages.ts'
import type { StoragePageContent, StoragePageRef, StorageTarget } from '../models/storage.ts'

/**
 * What a storage module needs in order to keep the wiki's content as a tree of ordinary files.
 *
 * Shared by every target that addresses content by path — the local disk and git today — because the
 * two have to agree about it exactly. A page written by one and read back by the other has to come
 * back as the same page, so the front matter, the file name a page is filed under, the rule for what
 * makes a file a page rather than an attachment and the walk that reads a folder back all live here
 * rather than in either module.
 *
 * What does *not* live here is anything about where the root is or what happens after a file is
 * written: the disk target is finished at that point, and git has a commit to make.
 *
 * Not under `modules/storage/` deliberately. `refreshFromDisk` reads every directory there and
 * expects a `definition.yml` in it, and a directory without one takes every storage module down with
 * it.
 */

/** Leading YAML front matter, as `serializePage` writes it. */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** The extension whose pages are written as one JSON document rather than front matter and a body. */
export const JSON_EXTENSION = 'json'

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
export const ROOT_PAGE_NAME = 'index'

/**
 * Names never walked by an import.
 *
 * Anything starting with a dot, which covers a half-written `.tmp`, the `.DS_Store` a Mac leaves in
 * every folder it has looked at, and — the reason this is tested against every segment of the path
 * rather than only the file name — the whole of a `.git` directory. None of that is content somebody
 * meant to put in their wiki, and a repository's own internals least of all.
 */
const IGNORED_SEGMENT = /^\.|\.tmp$/

/**
 * A configured root as an absolute path.
 *
 * A relative setting is resolved from the install directory rather than from the working directory,
 * so that `./data/content` means the same folder whichever way the server was started.
 */
export function resolveRoot(configured: string | undefined, fallback: string): string {
  return path.resolve(WIKI.ROOTPATH, configured || fallback)
}

/**
 * Where an asset belongs under the root, as a slash-separated relative path.
 *
 * What brackets the tree — the site, the locale, both or neither — is the site's own answer and is
 * `pathPrefixFor`'s to give; everything below it is the tree as the file manager shows it.
 *
 * @returns Null for content this site's layout has no place for, which a caller reads as "this target
 *   does not hold that": a secondary locale on a site storing only its primary one
 */
export function assetRelPath(
  target: StorageTarget,
  ref: { locale: string; folderPath: string; fileName: string }
): string | null {
  const prefix = WIKI.models.storage.pathPrefixFor(target.siteId, ref.locale)
  if (!prefix) {
    return null
  }
  return [...prefix, ...ref.folderPath.split('/').filter(Boolean), ref.fileName].join('/')
}

/**
 * Where a page's copy belongs, alongside the assets of the same folder.
 *
 * The extension is the one its editor writes, and is exactly what the wiki reserves against uploads —
 * `models/assets.ts` refuses an attachment that would take this name, so the two never meet here.
 *
 * @returns Null under the same circumstances as `assetRelPath`
 */
export function pageRelPath(target: StorageTarget, ref: StoragePageRef): string | null {
  const prefix = WIKI.models.storage.pathPrefixFor(target.siteId, ref.locale)
  if (!prefix) {
    return null
  }
  const segments = ref.path.split('/').filter(Boolean)
  const fileName = segments.pop() ?? ROOT_PAGE_NAME
  return [...prefix, ...segments, `${fileName}.${pageFileExtension(ref.contentType)}`].join('/')
}

/**
 * The absolute path of a stored file, refusing anything that would land outside the root.
 *
 * Every segment reaching this is either a UUID or a name the tree has already normalized, so this
 * catches a stored path that has been tampered with rather than an ordinary mistake — but it is the
 * only thing between a `..` in the database and the rest of the file system.
 */
export function absPathIn(root: string, relPath: string): string {
  const resolved = path.resolve(root, relPath)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
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
export async function pruneEmptyDirs(root: string, fromDir: string): Promise<void> {
  let dir = fromDir
  while (dir !== root && dir.startsWith(root + path.sep)) {
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
export async function writeFileAtomic(filePath: string, data: Buffer | string): Promise<void> {
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
export async function moveFile(from: string, to: string): Promise<boolean> {
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

/**
 * Follow a rename, given where the file was and where it now belongs.
 *
 * Either end may be nowhere: the layout can have no place for a locale, and a move may cross into or
 * out of it. Moving *into* it has nothing to move — the copy was never written — whereas moving out
 * of it leaves a file behind at the old path, so that one is a delete.
 *
 * @returns What actually happened, which a target keeping history needs in order to record it
 */
export async function moveStored(
  root: string,
  fromRelPath: string | null,
  toRelPath: string | null
): Promise<'moved' | 'deleted' | 'nothing'> {
  if (!fromRelPath) {
    return 'nothing'
  }
  const from = absPathIn(root, fromRelPath)
  if (!toRelPath) {
    await fs.rm(from, { force: true })
    await pruneEmptyDirs(root, path.dirname(from))
    return 'deleted'
  }
  if (await moveFile(from, absPathIn(root, toRelPath))) {
    await pruneEmptyDirs(root, path.dirname(from))
    return 'moved'
  }
  return 'nothing'
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
export function serializePage(ref: StoragePageRef, page: StoragePageContent): string {
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
 * attachment share a folder without a module having to guess which is which from an extension, and
 * it is how every file written here comes back.
 *
 * Returning null does not settle it. A file whose extension the site reserves for pages is a page
 * whatever it does or does not declare — see `importTree`, which owns that rule and fills the editor
 * in from the extension. This only reports whether the file said so itself.
 *
 * Beyond the one key it is forgiving: a file may have been hand-written or generated by something
 * that has never seen this wiki, so a missing title or date is filled in by the caller, and front
 * matter that is not YAML is treated as no declaration rather than as a fault.
 *
 * @returns The declaration and the source, or null for a file that does not declare itself a page
 */
export function deserializePage(
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
export function parseFileDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** One stored file, as `walkStored` reports it. */
export interface StoredFile {
  /** Absolute. */
  filePath: string
  /** Relative to the root, split — the whole path including the file name. */
  segments: string[]
}

/**
 * Every file under a root, with anything hidden — and so a repository's `.git` — left out.
 *
 * @returns Null when the root does not exist yet, which is not a fault: a target can be configured
 *   long before anything is written to it
 */
export async function walkStored(root: string): Promise<StoredFile[] | null> {
  let entries
  try {
    entries = await fs.readdir(root, { recursive: true, withFileTypes: true })
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err
    }
    return null
  }
  const files: StoredFile[] = []
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }
    const filePath = path.join(entry.parentPath, entry.name)
    const segments = path.relative(root, filePath).split(path.sep)
    if (segments.some((segment) => IGNORED_SEGMENT.test(segment))) {
      continue
    }
    files.push({ filePath, segments })
  }
  return files
}

/**
 * How a run of `importTree` went, for the module to report in its own words.
 *
 * A module says what the run *was* — an import from a folder, a pull from a remote — and this says
 * what it did, which is the same either way.
 */
export interface ImportSummary {
  pages: number
  assets: number
  /** Left alone because the wiki already had something at that path and `overwrite` was off. */
  skipped: number
  /** Unusable: an empty body, an editor this wiki does not have, a path it cannot address. */
  failed: number
}

/**
 * Take a tree of files into the wiki, either filling in what is missing or letting the files win.
 *
 * **Two ways a file is a page**, and everything else is an attachment, read where it lies and adopted
 * in place rather than copied:
 *
 * 1. **Its extension is one the site reserves for pages.** Those extensions address a page by URL and
 *    cannot be uploaded as attachments, so nothing else can be sitting under one — which makes a
 *    hand-written `.md` dropped into the folder a page, as whoever dropped it meant.
 * 2. **It declares an editor**, in its front matter or at the top level of its JSON. This is what
 *    every file a target writes carries, and it is the only way in for an extension the site does not
 *    reserve — `.adoc` on a default site, where an attachment could just as well be sitting.
 *
 * Which editor it belongs to comes from that declaration, and only falls back to the extension for a
 * reserved one that made none.
 *
 * `overwrite` is the only thing separating the safe direction from the authoritative one. Off, a path
 * the wiki already has is left alone on both sides, which makes the run repeatable and makes it no
 * use for a file edited on both sides — reconciling those is a merge, and a target without history
 * cannot do one. On, the file wins: for a restore, or for a target whose remote is the authority.
 *
 * @param files What to take in, or null to walk the root
 * @param readFile How to read one, for a tree that is not on this machine — the SFTP target hands in
 *   its own and everything else about the walk is the same
 */
export async function importTree({
  target,
  root,
  actorId,
  overwrite,
  files,
  readFile = (filePath) => fs.readFile(filePath)
}: {
  target: StorageTarget
  root: string
  actorId: string
  overwrite: boolean
  files?: StoredFile[] | null
  readFile?: (filePath: string) => Promise<Buffer>
}): Promise<ImportSummary | null> {
  const found = files === undefined ? await walkStored(root) : files
  if (!found) {
    return null
  }

  const reserved: string[] = WIKI.sites[target.siteId]?.config?.pageExtensions ?? []
  const summary: ImportSummary = { pages: 0, assets: 0, skipped: 0, failed: 0 }

  for (const { filePath, segments } of found) {
    // -> The prefix the site's layout writes, read back off the path. Null for a file that is not
    //    part of this site's tree: another site's folder, or one sitting outside the layout.
    const stored = WIKI.models.storage.parseStoredPath(target.siteId, segments)
    if (!stored) {
      continue
    }
    const locale = stored.locale
    const rest = stored.segments
    const fileName = rest.pop()!
    const ext = path.extname(fileName).replace(/^\./, '').toLowerCase()
    const folderPath = rest.join('/')

    let raw: Buffer
    try {
      raw = await readFile(filePath)
    } catch (err: any) {
      // -> A path a diff named but that is no longer there. Nothing to import and nothing wrong.
      if (err.code === 'ENOENT') {
        continue
      }
      throw err
    }
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
        summary.assets++
      } else {
        summary.skipped++
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
        createdAt: parseFileDate(meta.dateCreated),
        updatedAt: parseFileDate(meta.date),
        authorId: actorId,
        overwrite
      })
      if (imported) {
        summary.pages++
      } else {
        summary.skipped++
      }
    } catch (err: any) {
      // -> One unusable file must not stop the rest of the tree from being imported
      summary.failed++
      WIKI.logger.warn(`Could not import the page at ${filePath} [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
    }
  }

  return summary
}
