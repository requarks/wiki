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

/** The extension a markdown page is filed under. */
const MARKDOWN_EXTENSION = 'md'

/** The extension an AsciiDoc page is filed under. */
const ASCIIDOC_EXTENSION = 'adoc'

/** An ATX H1 on the first line, without the optional closing run of `#`. */
const LEADING_ATX_H1 = /^#[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*(?:\r?\n|$)/

/** A setext H1 on the first two lines: the text, then a line of `=`. */
const LEADING_SETEXT_H1 = /^([^\r\n]+)\r?\n=+[ \t]*(?:\r?\n|$)/

/** An AsciiDoc document title on the first line: one `=`, where a section has two or more. */
const LEADING_ASCIIDOC_TITLE = /^=[ \t]+(.*?)[ \t]*(?:\r?\n|$)/

/** An AsciiDoc attribute entry, `:toc:` or `:imagesdir: images` or `:sectnums!:`. */
const ASCIIDOC_ATTRIBUTE_ENTRY = /^:!?\w[\w-]*!?:/

/**
 * The editor an imported page falls back to.
 *
 * Only reached for a file the site reserves as a page extension but which no editor writes — `txt` on
 * a default site. Markdown renders plain prose as prose, so it is the least surprising answer.
 */
const DEFAULT_PAGE_EDITOR = 'markdown'

/**
 * The page a site's root addresses, which is the page a root README stands for.
 *
 * Mirrors `HOME_PATH` in `helpers/appShell.ts`. Without `mapReadmeToHome` it is filed like any other
 * page, as `home.<ext>`.
 */
export const HOME_PATH = 'home'

/**
 * The names the home page goes by when the site's `mapReadmeToHome` setting is on, by the extension
 * its content type is filed under. A home page in a format with no entry here keeps `home.<ext>`.
 *
 * Only at the root of the tree — a README in a folder is an ordinary page or file of that folder — and
 * only spelled this way, which is also what keeps them apart from every page: a page path is always
 * lowercase, so no page is ever filed as `README`. The first of each is what a new file is called, and
 * the order of the rest is the order `matchStoredReadme` looks for them in.
 */
const README_FILE_NAMES: Record<string, string[]> = {
  md: ['README.md', 'README', 'README.MD'],
  adoc: ['README.adoc']
}

/** Every README name, in the order one is preferred when a tree holds more than one. */
const ALL_README_FILE_NAMES = Object.values(README_FILE_NAMES).flat()

/** The extension a README name stands for — `md` for a bare `README` — or null for any other name. */
export function readmeExtension(fileName: string): string | null {
  for (const [ext, names] of Object.entries(README_FILE_NAMES)) {
    if (names.includes(fileName)) {
      return ext
    }
  }
  return null
}

/**
 * Names never walked by an import.
 *
 * Anything starting with a dot, which covers a half-written `.tmp`, the `.DS_Store` a Mac leaves in
 * every folder it has looked at, and — the reason this is tested against every segment of the path
 * rather than only the file name — the whole of a `.git` directory. None of that is content somebody
 * meant to put in their wiki, and a repository's own internals least of all.
 */
const IGNORED_SEGMENT = /^\.|\.tmp$/

/** Whether a stored path is one of those, and so never content. */
export function isIgnoredPath(segments: string[]): boolean {
  return segments.some((segment) => IGNORED_SEGMENT.test(segment))
}

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
  const ext = pageFileExtension(ref.contentType)
  // -> Whichever of a format's READMEs is already there is the module's to find out, since this
  //    answers without looking — see `matchStoredReadme`
  const readmes = README_FILE_NAMES[ext]
  if (ref.path === HOME_PATH && readmes && WIKI.models.storage.mapReadmeToHomeFor(target.siteId)) {
    return [...prefix, readmes[0]].join('/')
  }
  return `${[...prefix, ...ref.path.split('/').filter(Boolean)].join('/')}.${ext}`
}

/**
 * Whether a stored path is a root README, read the way the site's layout writes one.
 *
 * Deliberately not gated on `mapReadmeToHome`: nothing but that setting ever names a file `README`,
 * so a path that is one was put there by it — and a queued change written while it was on still has to
 * land on the file it meant after it has been turned off.
 */
function isRootReadme(siteId: string, relPath: string): boolean {
  const stored = WIKI.models.storage.parseStoredPath(siteId, relPath.split('/'))
  return stored?.segments.length === 1 && readmeExtension(stored.segments[0]) !== null
}

/**
 * Every name a root README of the same format could be stored under, given the one `pageRelPath`
 * answered — never another format's, which would be a markdown page written into `README.adoc`.
 *
 * For anything that is not a root README this is the path alone, so a caller comparing paths can
 * always go through it.
 */
export function readmeVariants(target: StorageTarget, relPath: string): string[] {
  if (!isRootReadme(target.siteId, relPath)) {
    return [relPath]
  }
  const dir = relPath.split('/')
  const ext = readmeExtension(dir.pop()!)!
  return README_FILE_NAMES[ext].map((name) => [...dir, name].join('/'))
}

/**
 * The README a home page is to be written to: whichever one the target already holds.
 *
 * `pageRelPath` cannot know, since it answers without looking — a git target answers on the request
 * path, where nothing may touch the repository. So a module asks this at the point it can see what
 * is there, and writes the format's first name when nothing is. Any other path comes straight back.
 *
 * @param exists Whether the target holds a file at a path relative to its root
 */
export async function matchStoredReadme<T extends string | null>(
  target: StorageTarget,
  relPath: T,
  exists: (relPath: string) => Promise<boolean>
): Promise<T> {
  // -> Every other page, which is to say nearly every call: asked nothing, since a probe on SFTP is a
  //    round trip
  if (!relPath || !isRootReadme(target.siteId, relPath)) {
    return relPath
  }
  for (const candidate of readmeVariants(target, relPath)) {
    if (await exists(candidate)) {
      return candidate as T
    }
  }
  return relPath
}

/** An `exists` for `matchStoredReadme`, for a tree on this machine. */
export function existsUnder(root: string): (relPath: string) => Promise<boolean> {
  return (relPath) =>
    fs.access(absPathIn(root, relPath)).then(
      () => true,
      () => false
    )
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
 * Take the H1 a body opens with off it, as the site's `stripLeadingH1` setting asks.
 *
 * Only the very first block counts, and only a non-empty one: a heading further down is a section of
 * the page, not its name. In markdown that is an ATX (`# Title`) or setext (`Title` over `===`) H1;
 * in AsciiDoc it is the document title, `= Title`. The heading text is kept as written, inline markup
 * and all, because it has to be exactly what `withLeadingH1` wrote for a page to come back from a
 * target with the title it went out with.
 *
 * An AsciiDoc title is only taken when what follows it is a blank line or attribute entries. Anything
 * else on the next line is the header's author or revision line, which needs the title above it to be
 * read as one — taken away, it would be drawn as the page's first paragraph. Attribute entries keep
 * working without it, as document attributes set before the first block.
 *
 * @param content The body with its front matter already gone and its ends trimmed
 * @param ext The extension the page is filed under, which says what it is written in
 * @returns The heading and what follows it, or null when the body does not open with one
 */
function takeLeadingH1(content: string, ext: string): { title: string; content: string } | null {
  let match: RegExpExecArray | null = null
  if (ext === MARKDOWN_EXTENSION) {
    match = LEADING_ATX_H1.exec(content) ?? LEADING_SETEXT_H1.exec(content)
  } else if (ext === ASCIIDOC_EXTENSION) {
    match = LEADING_ASCIIDOC_TITLE.exec(content)
    const nextLine = match ? content.slice(match[0].length).split(/\r?\n/, 1)[0] : ''
    if (nextLine.trim() && !ASCIIDOC_ATTRIBUTE_ENTRY.test(nextLine)) {
      return null
    }
  }
  const title = match?.[1].trim()
  if (!match || !title) {
    return null
  }
  return { title, content: content.slice(match[0].length).trim() }
}

/**
 * Put a page's title back on the front of its body, the inverse of `takeLeadingH1`.
 *
 * Always added, even to a body that already opens with a heading of the same text. Leaving it out
 * there would read that heading back as the title and lose it from the body, so a page would come
 * back from its own target different from how it went out. An AsciiDoc body opening with attribute
 * entries gets the title directly above them, which is where they were when it was taken off.
 *
 * @returns The body unchanged for a format with no such heading
 */
function withLeadingH1(title: string, content: string, ext: string): string {
  const heading = title.replace(/\s+/g, ' ').trim()
  if (!heading) {
    return content
  }
  if (ext === MARKDOWN_EXTENSION) {
    return `# ${heading}\n\n${content}`
  }
  if (ext === ASCIIDOC_EXTENSION) {
    return `= ${heading}\n${ASCIIDOC_ATTRIBUTE_ENTRY.test(content) ? '' : '\n'}${content}`
  }
  return content
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
  // -> The title stays in the front matter as well: it is what every other tool reads a title from,
  //    and the heading is there for the people reading the file
  const content = WIKI.models.storage.stripLeadingH1For(ref.siteId)
    ? withLeadingH1(page.title, page.content, pageFileExtension(ref.contentType))
    : page.content
  return `---\n${dumpYaml(pageMeta(page))}---\n\n${content}\n`
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
    if (isIgnoredPath(segments)) {
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
export function importTree(options: ImportTreeOptions): Promise<ImportSummary | null> {
  // -> What is adopted here is saved like any edit, and so copied to every target holding it. Not to
  //    this one: the file is already there, and a module that serializes its operations would have
  //    the copy wait for this import to finish while the import waits for the copy.
  return WIKI.models.storage.importingFrom(options.target, () => adoptTree(options))
}

interface ImportTreeOptions {
  target: StorageTarget
  root: string
  actorId: string
  overwrite: boolean
  files?: StoredFile[] | null
  readFile?: (filePath: string) => Promise<Buffer>
}

async function adoptTree({
  target,
  root,
  actorId,
  overwrite,
  files,
  readFile = (filePath) => fs.readFile(filePath)
}: ImportTreeOptions): Promise<ImportSummary | null> {
  const found = files === undefined ? await walkStored(root) : files
  if (!found) {
    return null
  }

  const reserved: string[] = WIKI.sites[target.siteId]?.config?.pageExtensions ?? []
  const stripLeadingH1 = WIKI.models.storage.stripLeadingH1For(target.siteId)
  const mapReadme = WIKI.models.storage.mapReadmeToHomeFor(target.siteId)
  const summary: ImportSummary = { pages: 0, assets: 0, skipped: 0, failed: 0 }

  // -> The README each locale's home page is taken from in this run. One per locale: several files
  //    for one page would leave it as whichever the walk reached last, so the first by
  //    `ALL_README_FILE_NAMES` wins and the rest are skipped — as is a root `home.<ext>`, which is
  //    left from before the setting was on.
  const homeReadmes = new Map<string, string>()
  if (mapReadme) {
    for (const { segments } of found) {
      const stored = WIKI.models.storage.parseStoredPath(target.siteId, segments)
      if (stored?.segments.length !== 1) {
        continue
      }
      const rank = ALL_README_FILE_NAMES.indexOf(stored.segments[0])
      const current = homeReadmes.get(stored.locale)
      if (rank >= 0 && (current === undefined || rank < ALL_README_FILE_NAMES.indexOf(current))) {
        homeReadmes.set(stored.locale, stored.segments[0])
      }
    }
  }

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
    const isRootFile = rest.length === 0
    const isHomeReadme = isRootFile && homeReadmes.get(locale) === fileName
    if (mapReadme && isRootFile && !isHomeReadme && readmeExtension(fileName)) {
      summary.skipped++
      continue
    }
    // -> A bare README is markdown, which its name does not say
    const pageExt = isHomeReadme ? readmeExtension(fileName)! : ext

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
    const declared = deserializePage(raw.toString('utf8'), pageExt)
    const isReservedExtension = Boolean(ext) && reserved.includes(ext)

    if (!declared && !isReservedExtension && !isHomeReadme) {
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
    if (isRootFile && name === HOME_PATH && homeReadmes.has(locale)) {
      summary.skipped++
      continue
    }
    const meta = declared?.meta ?? {}
    // -> Undeclared means there was no front matter to strip, so the file is all body
    let content = declared?.content ?? raw.toString('utf8').trim()
    let title = typeof meta.title === 'string' && meta.title ? meta.title : name
    // -> The heading wins over a front matter title when both are there: it is the one somebody
    //    reading the file sees and edits, and what the wiki writes keeps the two the same anyway
    const heading = stripLeadingH1 ? takeLeadingH1(content, pageExt) : null
    if (heading) {
      title = heading.title
      // -> A file that is nothing but its heading keeps it as the body, since a page cannot be empty
      //    and the file imported before this setting was turned on
      content = heading.content || content
    }
    try {
      const imported = await WIKI.models.pages.adoptStoredPage({
        siteId: target.siteId,
        locale,
        path: isHomeReadme ? HOME_PATH : [...rest, name].join('/'),
        // -> The declaration first, then the file itself: a page written by hand carries no title,
        //    and its name is the next best thing
        title,
        description: typeof meta.description === 'string' ? meta.description : '',
        editor:
          typeof meta.editor === 'string' && meta.editor
            ? meta.editor
            : (pageEditorForExtension(pageExt) ?? DEFAULT_PAGE_EDITOR),
        tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
        isPublished: meta.published !== false,
        content,
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
