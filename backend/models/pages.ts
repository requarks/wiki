import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { pages as pagesTable, tree as treeTable, users as usersTable } from '../db/schema.ts'
import {
  CustomError,
  generatePathHash,
  normalizePagePath,
  timingSafeCompare
} from '../helpers/common.ts'
import type { RenderPermissions, TocNode } from './rendering.ts'
import type { DeletedEntry } from './tree.ts'
import type { StoragePageContent, StoragePageRef } from './storage.ts'

/** What each editor produces, which is what the content column holds. */
const EDITOR_CONTENT_TYPES: Record<string, string> = {
  markdown: 'markdown',
  asciidoc: 'asciidoc',
  wysiwyg: 'html',
  redirect: 'redirect'
}

/**
 * The extension a page's source is written under, by the content type its editor produces.
 *
 * A page is addressed without one — its path is a URL — so this only ever appears where a page has to
 * be a file: a storage target laying content out by path. It lives here rather than in that module
 * because it is a fact about the page, and because it is what decides whether an uploaded file would
 * land on top of one. See `storageFileName`.
 */
export const PAGE_FILE_EXTENSIONS: Record<string, string> = {
  markdown: 'md',
  html: 'html',
  asciidoc: 'adoc',
  redirect: 'json'
}

/** For a content type added since this was written. */
const DEFAULT_PAGE_FILE_EXTENSION = 'txt'

export function pageFileExtension(contentType: string): string {
  return PAGE_FILE_EXTENSIONS[contentType] ?? DEFAULT_PAGE_FILE_EXTENSION
}

/**
 * Which editor writes a given file extension.
 *
 * For a page being imported that did not say which editor it belongs to, which is allowed only where
 * the site reserves the extension for pages — see `importAll` in the local disk module.
 *
 * @returns Null when no editor produces that extension, which for a reserved one means the site
 *   reserved something this wiki has no editor for
 */
export function pageEditorForExtension(ext: string): string | null {
  const contentType = Object.entries(PAGE_FILE_EXTENSIONS).find(([, e]) => e === ext)?.[0]
  if (!contentType) {
    return null
  }
  return Object.entries(EDITOR_CONTENT_TYPES).find(([, ct]) => ct === contentType)?.[0] ?? null
}

/**
 * The editor whose pages send their reader somewhere else.
 *
 * A redirection is an ordinary page — it has a path, a title, an icon and a place in the tree, and is
 * browsable like any other — with nothing to read: no body, no render, and therefore nothing for the
 * search index to hold. What an author fills in is where it points, and that is what its content
 * column carries. See `normalizeRedirectContent`.
 */
const REDIRECT_EDITOR = 'redirect'

/** A page path is what ends up in a URL, so it is held to what reads and routes cleanly. */
const rePagePath = /^[a-zA-Z0-9-_/]*$/
const reAlias = /^[a-zA-Z0-9-_]*$/

/** Fields kept in the `config` blob rather than as columns, and flattened again on the way out. */
const CONFIG_FIELDS = [
  'allowComments',
  'allowContributions',
  'allowRatings',
  'showSidebar',
  'showTags',
  'showToc',
  'tocDepth'
] as const

/** A page as the API exposes it: the columns and both blobs, flattened into one object. */
export interface Page {
  id: string
  path: string
  hash: string
  alias: string | null
  title: string
  description: string | null
  icon: string | null
  locale: string
  editor: string
  contentType: string
  publishState: 'draft' | 'published' | 'scheduled'
  publishStartDate: Date | null
  publishEndDate: Date | null
  isBrowsable: boolean
  isSearchable: boolean
  /**
   * The page's password, if it has one. Present only for a requester who may edit the page — see
   * `getPage`'s `withPassword`. Absent, rather than null, for everyone else: a reader cannot tell a
   * page with no password from one whose password was withheld, and does not need to.
   */
  password?: string | null
  /** Whether the body was withheld because the page is password protected. See `getPage`. */
  isLocked: boolean
  relations: any[]
  tags: string[]
  toc: TocNode[]
  render: string
  /**
   * The source. Present when the request asked for it, and always for a redirection — see `toPage`,
   * and `RedirectContent` for what a redirection's holds.
   */
  content?: string
  allowComments: boolean
  allowContributions: boolean
  allowRatings: boolean
  showSidebar: boolean
  showTags: boolean
  showToc: boolean
  tocDepth: { min: number; max: number }
  scriptJsLoad: string
  scriptJsUnload: string
  scriptCss: string
  navigationId: string | null
  navigationMode: string
  authorId: string
  authorName: string
  createdAt: Date
  updatedAt: Date
}

/** Everything a page can be created with. */
export interface PageInput {
  path: string
  title: string
  editor: string
  content: string
  /** The HTML the editor produced. Post-processed before it is stored — see `models/rendering.ts`. */
  render?: string
  locale?: string
  description?: string
  icon?: string
  alias?: string
  publishState?: 'draft' | 'published' | 'scheduled'
  publishStartDate?: string | null
  publishEndDate?: string | null
  isBrowsable?: boolean
  isSearchable?: boolean
  password?: string
  relations?: any[]
  tags?: string[]
  allowComments?: boolean
  allowContributions?: boolean
  allowRatings?: boolean
  showSidebar?: boolean
  showTags?: boolean
  showToc?: boolean
  tocDepth?: { min: number; max: number }
  scriptJsLoad?: string
  scriptJsUnload?: string
  scriptCss?: string
  /**
   * Why this save is being made, as the editor's reason-for-change prompt collected it. Not a page
   * field: it belongs to the version this save produces, and is recorded on the history row.
   */
  reasonForChange?: string
}

/** Who is saving, and what they are allowed to put in a page. */
export interface PageActor {
  id: string
  permissions: string[]
}

function hasPermission(actor: PageActor, permission: string): boolean {
  return actor.permissions.includes('manage:system') || actor.permissions.includes(permission)
}

/**
 * Normalize a path to the form that gets stored, and refuse it if what is left is not addressable.
 *
 * Casing and spaces are corrected rather than rejected — `My Page` is a path someone meant, and it
 * means `my-page`. Anything else outside the allowed characters is not something to guess at.
 */
function normalizePath(input: string): string {
  const path = normalizePagePath(input)
  if (!rePagePath.test(path)) {
    throw new CustomError(
      'pageInvalidPath',
      'A page path may only contain alphanumeric, hyphen, underscore and slash characters.'
    )
  }
  return path
}

/**
 * Where a redirection points, as its content column holds it.
 *
 * `kind` is stored rather than sniffed off the target, because it is the question the author actually
 * answered: a page of this wiki, or somewhere else. The two are not reliably told apart afterwards —
 * `/help` is a page here and a perfectly good relative URL elsewhere — and the editor has to open on
 * the choice that was made rather than on a guess about it.
 */
export interface RedirectContent {
  kind: 'page' | 'url'
  /** A rooted path within this wiki, or an absolute `http(s)` URL. */
  target: string
  /** Whether the reader is told where they are going before being taken there. */
  showInterstitial: boolean
}

/**
 * Read a redirection's target back out of what the editor sent, and refuse anything that would not
 * send a reader anywhere.
 *
 * Re-serialized rather than stored as it arrived, so that the column holds one canonical spelling: a
 * save that changes nothing then reports no change, and the history rows say what they mean.
 *
 * A URL target is held to `http`/`https` deliberately. This value ends up in a `location` assignment,
 * so any other scheme is either useless (`mailto:` in a redirect that nobody chose to follow) or an
 * invitation (`javascript:`) — and a redirection is followed without the reader clicking anything.
 */
function normalizeRedirectContent(content: string | undefined): string {
  let parsed: any
  try {
    parsed = JSON.parse(content ?? '')
  } catch {
    throw new CustomError('pageRedirectInvalid', 'A redirection needs a target.')
  }
  const kind = parsed?.kind === 'url' ? 'url' : 'page'
  const target = typeof parsed?.target === 'string' ? parsed.target.trim() : ''
  if (target.length < 1) {
    throw new CustomError('pageRedirectMissingTarget', 'A redirection needs a target.')
  }
  if (kind === 'url') {
    if (!/^https?:\/\/\S/i.test(target)) {
      throw new CustomError(
        'pageRedirectInvalidUrl',
        'A redirection to a URL must be a complete http:// or https:// address.'
      )
    }
  } else if (!target.startsWith('/') || target.startsWith('//')) {
    throw new CustomError(
      'pageRedirectInvalidPath',
      'A redirection to a page of this wiki must be a path starting with a slash.'
    )
  }
  const redirect: RedirectContent = {
    kind,
    target,
    showInterstitial: parsed?.showInterstitial === true
  }
  return JSON.stringify(redirect)
}

/**
 * Pages model
 *
 * A page is a row here plus a row in the tree that gives it its place in the site. The markdown is
 * authored and rendered in the browser; what arrives is both the source and the HTML, and the HTML is
 * run through `models/rendering.ts` before being stored — that is where it gets sanitized against what
 * the author is actually allowed to embed, and where the table of contents and the search text come
 * from.
 *
 * Not implemented yet, and deliberately not faked here: version history (there is no table for it),
 * page links, comments, and storage targets.
 */
class Pages {
  /**
   * Flatten a row and its blobs into the shape the API returns.
   *
   * @param locked Withhold the body — the source, the rendered HTML, the table of contents drawn from
   *               it, and the relation links written onto the page. The metadata stays: a reader
   *               looking at the lock screen is told what page they are being asked for a password to.
   * @param withPassword Include the page's own password. Only for a requester who may edit the page,
   *                     which is the one that has to be able to read it back and save it again.
   * @param withContent Include the source. A redirection's comes back either way: its content is not
   *                    a body somebody wrote, it is where the page sends its reader — which every
   *                    reader is about to be shown by being taken there. Withholding it would leave
   *                    the page view unable to do the one thing the page is for, and the page view
   *                    does not ask for content.
   */
  private toPage(
    row: any,
    {
      withContent = false,
      withPassword = false,
      locked = false
    }: { withContent?: boolean; withPassword?: boolean; locked?: boolean } = {}
  ): Page {
    const config = row.config ?? {}
    const scripts = row.scripts ?? {}
    return {
      id: row.id,
      path: row.path,
      hash: row.hash,
      alias: row.alias,
      title: row.title,
      description: row.description,
      icon: row.icon,
      locale: row.locale,
      editor: row.editor,
      contentType: row.contentType,
      publishState: row.publishState,
      publishStartDate: row.publishStartDate,
      publishEndDate: row.publishEndDate,
      isBrowsable: row.isBrowsable,
      isSearchable: row.isSearchable,
      ...(withPassword ? { password: row.password } : {}),
      isLocked: locked,
      relations: locked ? [] : (row.relations ?? []),
      tags: row.tags ?? [],
      toc: locked ? [] : (row.toc ?? []),
      render: locked ? '' : (row.render ?? ''),
      ...((withContent || row.editor === REDIRECT_EDITOR) && !locked
        ? { content: row.content ?? '' }
        : {}),
      allowComments: config.allowComments ?? true,
      allowContributions: config.allowContributions ?? true,
      allowRatings: config.allowRatings ?? true,
      showSidebar: config.showSidebar ?? true,
      showTags: config.showTags ?? true,
      showToc: config.showToc ?? true,
      tocDepth: config.tocDepth ?? { min: 1, max: 2 },
      scriptJsLoad: scripts.jsLoad ?? '',
      scriptJsUnload: scripts.jsUnload ?? '',
      scriptCss: scripts.css ?? '',
      navigationId: row.navigationId ?? null,
      navigationMode: row.navigationMode ?? 'inherit',
      authorId: row.authorId,
      authorName: row.authorName ?? '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }

  /**
   * A single page, by ID or by the hash of its path.
   *
   * The hash is what the frontend addresses a page with — see `generatePathHash` — so this is the
   * lookup an ordinary page view goes through.
   *
   * A password-protected page still comes back to a requester who has not unlocked it: the metadata
   * is what the lock screen is drawn from. What the password withholds is the body — see `toPage`'s
   * `locked`. Anything that puts a page's text in front of a reader has to go through here, or
   * through the same check, because the enforcement is this method and not the client.
   *
   * **The defaults hand over the whole page**, `unlocked` and `withPassword` included, the way they do
   * for `publicOnly` beside them: most callers here are a save, a move, a delete or a re-render, and
   * none of those is a reader — a save that got a withheld body back would answer its author with an
   * empty page, and a re-render would store one. A path that serves a reader has to say so, and there
   * are exactly two: the `GET` route, and `unlockPage` below.
   *
   * @param unlocked Whether the password has been satisfied for this requester. Route-level concern:
   *                 see `unlockedFor` in `api/pages.ts`. A function is called with the page's id once
   *                 the row is in hand, which is what lets a caller answer per page even though it
   *                 asked for the page by path hash.
   * @param withPassword Whether to include the password value. For whoever may edit the page — not for
   *                     a reader who just entered it, who needs it no more after that.
   */
  async getPage({
    siteId,
    id,
    hash,
    locale,
    withContent = false,
    publicOnly = false,
    unlocked = true,
    withPassword = true
  }: {
    siteId: string
    id?: string
    hash?: string
    locale?: string
    withContent?: boolean
    /** Restrict to what a reader with no session may see: published pages. */
    publicOnly?: boolean
    unlocked?: boolean | ((pageId: string) => boolean)
    withPassword?: boolean
  }): Promise<Page | null> {
    const conditions = [eq(pagesTable.siteId, siteId)]
    if (publicOnly) {
      // -> Page-level access rules are not implemented, so this is the whole of it: an anonymous
      //    reader sees published pages, and nothing else. A password does not hide a page from them —
      //    it withholds the body until they enter it, which is what `locked` below does.
      conditions.push(eq(pagesTable.publishState, 'published'))
    }
    if (id) {
      conditions.push(eq(pagesTable.id, id))
    } else if (hash) {
      conditions.push(eq(pagesTable.hash, hash))
      // -> A path is only unique within a locale, so without one this could match more than one page
      conditions.push(eq(pagesTable.locale, locale ?? this.defaultLocale(siteId)))
    } else {
      return null
    }

    const results = await WIKI.db
      .select({
        page: pagesTable,
        authorName: usersTable.name,
        navigationId: treeTable.navigationId,
        navigationMode: treeTable.navigationMode
      })
      .from(pagesTable)
      .leftJoin(usersTable, eq(usersTable.id, pagesTable.authorId))
      .leftJoin(treeTable, eq(treeTable.id, pagesTable.id))
      .where(and(...conditions))
      .limit(1)

    const row = results[0]
    if (!row) {
      return null
    }
    const isUnlocked = typeof unlocked === 'function' ? unlocked(row.page.id) : unlocked
    return this.toPage(
      {
        ...row.page,
        authorName: row.authorName,
        navigationId: row.navigationId,
        navigationMode: row.navigationMode
      },
      { withContent, withPassword, locked: Boolean(row.page.password) && !isUnlocked }
    )
  }

  /**
   * Check a page's password, and hand the page over if it matches.
   *
   * Deliberately the only way past the lock: a reader gets the body from here or from a `getPage` the
   * route has already marked as unlocked, and never from a flag the browser sent.
   *
   * @returns The page, its body included, or null when the password is wrong or the page has none —
   *          the caller cannot tell those apart, and neither can whoever is guessing.
   */
  async unlockPage({
    siteId,
    id,
    hash,
    locale,
    password,
    publicOnly = false
  }: {
    siteId: string
    id?: string
    hash?: string
    locale?: string
    password: string
    publicOnly?: boolean
  }): Promise<Page | null> {
    /*
      Asked for as a reader would see it, for two reasons: a wrong guess must not assemble the body in
      the first place, and `isLocked` is how this knows there is a password to check at all.
    */
    const page = await this.getPage({
      siteId,
      id,
      hash,
      locale,
      publicOnly,
      unlocked: false,
      withPassword: false
    })
    if (!page?.isLocked) {
      return null
    }
    const stored = await WIKI.db
      .select({ password: pagesTable.password })
      .from(pagesTable)
      .where(eq(pagesTable.id, page.id))
      .limit(1)
    const expected = stored[0]?.password
    if (!expected || !timingSafeCompare(password, expected)) {
      return null
    }
    // -> Unlocked, but still without the password itself: entering it is not the same as being able
    //    to change it, and the reader has no further use for the value
    return this.getPage({
      siteId,
      id: page.id,
      publicOnly,
      unlocked: true,
      withPassword: false
    })
  }

  /**
   * Create a page.
   *
   * @param actor Who is saving it. Their permissions decide what survives sanitizing.
   */
  async createPage(siteId: string, input: PageInput, actor: PageActor): Promise<Page> {
    if (!WIKI.sites[siteId]) {
      throw new CustomError('pageInvalidSite', 'This site does not exist.', 404)
    }

    const path = normalizePath(input.path)
    const locale = input.locale || this.defaultLocale(siteId)
    const title = (input.title ?? '').trim()
    if (title.length < 1) {
      throw new CustomError('pageTitleMissing', 'A page needs a title.')
    }
    const editor = input.editor || 'markdown'
    const isRedirect = editor === REDIRECT_EDITOR
    // -> A redirection has no body to be empty: what it holds instead is where it points, and that has
    //    its own rules about being filled in
    const content = isRedirect ? normalizeRedirectContent(input.content) : input.content
    if (!isRedirect && (!content || content.trim().length < 1)) {
      throw new CustomError('pageEmptyContent', 'A page cannot be empty.')
    }

    const hash = generatePathHash(path)
    const duplicate = await WIKI.db
      .select({ id: pagesTable.id })
      .from(pagesTable)
      .where(
        and(eq(pagesTable.siteId, siteId), eq(pagesTable.locale, locale), eq(pagesTable.path, path))
      )
      .limit(1)
    if (duplicate.length > 0) {
      throw new CustomError('pageDuplicatePath', 'A page already exists at this path.', 409)
    }

    const pathParts = path.split('/')
    await this.guardAgainstAssetCollision({
      siteId,
      locale,
      parentPath: pathParts.slice(0, -1).join('/'),
      fileName: pathParts.at(-1)!,
      contentType: EDITOR_CONTENT_TYPES[editor] ?? 'text'
    })

    const alias = await this.validateAlias(siteId, input.alias)
    const { render, toc, text } = await WIKI.models.rendering.postProcess(
      siteId,
      input.render ?? '',
      {
        scripts: hasPermission(actor, 'write:scripts'),
        styles: hasPermission(actor, 'write:styles')
      }
    )

    const inserted = await WIKI.db
      .insert(pagesTable)
      .values({
        alias,
        authorId: actor.id,
        creatorId: actor.id,
        ownerId: actor.id,
        config: this.buildConfig(input, siteId),
        content,
        contentType: EDITOR_CONTENT_TYPES[editor] ?? 'text',
        description: input.description ?? '',
        editor,
        hash,
        icon: input.icon ?? '',
        isBrowsable: input.isBrowsable ?? true,
        // -> A redirection has nothing to find: a result for it would be a result whose page is a
        //    doorway to the page the reader actually wanted, which is the one search should offer
        isSearchable: isRedirect ? false : (input.isSearchable ?? true),
        locale,
        password: input.password || null,
        path,
        publishState: input.publishState ?? 'published',
        publishStartDate: input.publishStartDate ? new Date(input.publishStartDate) : null,
        publishEndDate: input.publishEndDate ? new Date(input.publishEndDate) : null,
        relations: input.relations ?? [],
        render,
        searchContent: text,
        scripts: this.buildScripts(input, actor),
        siteId,
        tags: input.tags ?? [],
        title,
        toc
      })
      .returning()

    const page = inserted[0]

    try {
      await WIKI.models.tree.addPage({
        id: page.id,
        parentPath: pathParts.slice(0, -1).join('/'),
        fileName: pathParts.at(-1)!,
        title: page.title,
        locale,
        siteId,
        tags: input.tags ?? [],
        meta: this.treeMeta(page)
      })
    } catch (err) {
      // -> A page with no tree entry is invisible to navigation and to the file manager, which is
      //    worse than not having saved it at all
      await WIKI.db.delete(pagesTable).where(eq(pagesTable.id, page.id))
      throw err
    }

    await WIKI.models.pageHistory.record({
      siteId,
      pageId: page.id,
      action: 'created',
      authorId: actor.id,
      reason: input.reasonForChange
    })

    const stored = this.toStoragePage(siteId, actor.id, page, page.content ?? '')
    await WIKI.models.storage.mirrorPage(stored.ref, stored.content)

    await WIKI.models.search.indexPage(page.id, locale)
    await WIKI.models.hooks.emit('page:create', {
      id: page.id,
      path: page.path,
      locale,
      siteId,
      authorId: actor.id,
      metadata: { title: page.title, description: page.description, editor }
    })

    return (await this.getPage({ siteId, id: page.id })) as Page
  }

  /**
   * Update a page. Only the fields present in the patch are touched.
   */
  async updatePage(
    siteId: string,
    id: string,
    patch: Partial<PageInput>,
    actor: PageActor
  ): Promise<Page | null> {
    const results = await WIKI.db
      .select()
      .from(pagesTable)
      .where(and(eq(pagesTable.id, id), eq(pagesTable.siteId, siteId)))
      .limit(1)
    const existing = results[0]
    if (!existing) {
      return null
    }

    const values: Record<string, any> = { updatedAt: sql`now()` }
    let treeTitle: string | null = null
    // -> Which editor authored a page is not something a save may change, so the row is the authority
    //    on whether this is a redirection
    const isRedirect = existing.editor === REDIRECT_EDITOR

    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (title.length < 1) {
        throw new CustomError('pageTitleMissing', 'A page needs a title.')
      }
      values.title = title
      treeTitle = title
    }
    if (patch.description !== undefined) {
      values.description = patch.description.trim()
    }
    if (patch.icon !== undefined) {
      values.icon = patch.icon.trim()
    }
    if (patch.alias !== undefined) {
      values.alias = await this.validateAlias(siteId, patch.alias, id)
    }
    if (patch.content !== undefined) {
      values.content = isRedirect ? normalizeRedirectContent(patch.content) : patch.content
    }
    if (patch.publishState !== undefined) {
      if (
        patch.publishState === 'scheduled' &&
        !(patch.publishStartDate ?? existing.publishStartDate) &&
        !(patch.publishEndDate ?? existing.publishEndDate)
      ) {
        throw new CustomError(
          'pageMissingScheduledDates',
          'A scheduled page needs a start or an end date.'
        )
      }
      values.publishState = patch.publishState
    }
    if (patch.publishStartDate !== undefined) {
      values.publishStartDate = patch.publishStartDate ? new Date(patch.publishStartDate) : null
    }
    if (patch.publishEndDate !== undefined) {
      values.publishEndDate = patch.publishEndDate ? new Date(patch.publishEndDate) : null
    }
    if (patch.isBrowsable !== undefined) {
      values.isBrowsable = patch.isBrowsable
    }
    if (patch.isSearchable !== undefined) {
      // -> Never for a redirection; see the same call in `createPage`
      values.isSearchable = isRedirect ? false : patch.isSearchable
    }
    if (patch.password !== undefined) {
      values.password = patch.password || null
    }
    if (patch.relations !== undefined) {
      values.relations = patch.relations
    }
    if (patch.tags !== undefined) {
      values.tags = patch.tags
    }

    // -> A render only means anything next to the content it came from, so the two move together
    if (patch.render !== undefined) {
      const { render, toc, text } = await WIKI.models.rendering.postProcess(siteId, patch.render, {
        scripts: hasPermission(actor, 'write:scripts'),
        styles: hasPermission(actor, 'write:styles')
      })
      values.render = render
      values.toc = toc
      values.searchContent = text
    }

    if (CONFIG_FIELDS.some((field) => patch[field] !== undefined)) {
      values.config = this.buildConfig(patch, siteId, existing.config as Record<string, any>)
    }
    if (
      patch.scriptJsLoad !== undefined ||
      patch.scriptJsUnload !== undefined ||
      patch.scriptCss !== undefined
    ) {
      values.scripts = this.buildScripts(patch, actor, existing.scripts as Record<string, any>)
    }

    // -> The author is whoever last changed it; the creator and owner do not move
    values.authorId = actor.id

    // -> Worked out before the write, against the row as it stands: the editor sends every field on
    //    every save, so the patch alone would report a change to all of them
    const changedFields = WIKI.models.pageHistory.changedFields(existing, values)

    await WIKI.db.update(pagesTable).set(values).where(eq(pagesTable.id, id))

    const updated = (await this.getPage({ siteId, id })) as Page

    await WIKI.models.pageHistory.record({
      siteId,
      pageId: id,
      action: 'updated',
      authorId: actor.id,
      changedFields,
      reason: patch.reasonForChange
    })

    if (treeTitle !== null || patch.tags !== undefined) {
      await WIKI.db
        .update(treeTable)
        .set({
          ...(treeTitle !== null ? { title: treeTitle } : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
          meta: this.treeMeta(updated),
          updatedAt: sql`now()`
        })
        .where(eq(treeTable.id, id))
    }

    // -> The source is whatever this save set it to, else whatever it already was: a save that only
    //    changed the title still rewrites the copy, since the title is in its front matter
    const stored = this.toStoragePage(
      siteId,
      actor.id,
      updated,
      values.content ?? existing.content ?? ''
    )
    await WIKI.models.storage.mirrorPage(stored.ref, stored.content)

    await WIKI.models.search.indexPage(id, updated.locale)
    await WIKI.models.hooks.emit('page:edit', {
      id,
      path: updated.path,
      locale: updated.locale,
      siteId,
      authorId: actor.id,
      metadata: { title: updated.title, description: updated.description }
    })

    return updated
  }

  /**
   * Move a page to another path, taking its tree entry with it.
   */
  async movePage(
    siteId: string,
    id: string,
    { path, title }: { path: string; title?: string },
    actor: PageActor
  ): Promise<Page | null> {
    // -> With the source, which the move itself does not need: it is what the copy kept by a storage
    //    target is rewritten from once the page has landed at its new path
    const page = await this.getPage({ siteId, id, withContent: true })
    if (!page) {
      return null
    }
    const existingContent = page.content
    const newPath = normalizePath(path)
    if (newPath === page.path && (title === undefined || title === page.title)) {
      return page
    }

    if (newPath !== page.path) {
      const duplicate = await WIKI.db
        .select({ id: pagesTable.id })
        .from(pagesTable)
        .where(
          and(
            ne(pagesTable.id, id),
            eq(pagesTable.siteId, siteId),
            eq(pagesTable.locale, page.locale),
            eq(pagesTable.path, newPath)
          )
        )
        .limit(1)
      if (duplicate.length > 0) {
        throw new CustomError('pageDuplicatePath', 'A page already exists at this path.', 409)
      }
      await this.guardAgainstAssetCollision({
        siteId,
        locale: page.locale,
        parentPath: newPath.split('/').slice(0, -1).join('/'),
        fileName: newPath.split('/').at(-1)!,
        contentType: page.contentType
      })
    }

    await WIKI.db
      .update(pagesTable)
      .set({
        path: newPath,
        hash: generatePathHash(newPath),
        ...(title !== undefined ? { title: title.trim() } : {}),
        authorId: actor.id,
        updatedAt: sql`now()`
      })
      .where(eq(pagesTable.id, id))

    // -> The tree entry is what places the page in the site, so it is moved rather than rewritten:
    //    dropping and re-adding would create the destination folders but leave the old ones counted
    const pathParts = newPath.split('/')
    await WIKI.models.tree.deleteEntry(id)
    await WIKI.models.tree.addPage({
      id,
      parentPath: pathParts.slice(0, -1).join('/'),
      fileName: pathParts.at(-1)!,
      title: title !== undefined ? title.trim() : page.title,
      locale: page.locale,
      siteId,
      tags: page.tags,
      meta: this.treeMeta({ ...page, path: newPath })
    })

    const moved = (await this.getPage({ siteId, id })) as Page

    // -> Recorded as its own kind of change rather than an edit: a move is what breaks inbound links,
    //    and a history list has to be able to say so
    await WIKI.models.pageHistory.record({
      siteId,
      pageId: id,
      action: 'moved',
      authorId: actor.id,
      changedFields: [
        ...(newPath !== page.path ? ['path'] : []),
        ...(title !== undefined && title.trim() !== page.title ? ['title'] : [])
      ]
    })

    // -> Moved and then rewritten, rather than deleted and written afresh: the move is what keeps a
    //    versioned target's history of the file attached to it, and the rewrite is because a move may
    //    carry a new title and always carries a new modification time, both of which are in the copy
    const stored = this.toStoragePage(siteId, actor.id, moved, existingContent ?? '')
    await WIKI.models.storage.relocatePage(stored.ref, page.path)
    await WIKI.models.storage.mirrorPage(stored.ref, stored.content)

    await WIKI.models.hooks.emit('page:rename', {
      id,
      path: moved.path,
      previousPath: page.path,
      locale: moved.locale,
      siteId,
      authorId: actor.id
    })
    return moved
  }

  /**
   * Delete a page and its tree entry.
   *
   * @returns Whether a page was deleted
   */
  async deletePage(siteId: string, id: string, actor: PageActor): Promise<boolean> {
    const page = await this.getPage({ siteId, id })
    if (!page) {
      return false
    }
    // -> Before the row goes, and this version is what recovering the page would be built from
    await WIKI.models.pageHistory.record({
      siteId,
      pageId: id,
      action: 'deleted',
      authorId: actor.id
    })

    await WIKI.db.delete(pagesTable).where(eq(pagesTable.id, id))
    await WIKI.models.tree.deleteEntry(id)
    // -> A page that overrode the sidebar owns a menu keyed by its own id, which nothing could reach
    //    once the page is gone
    await WIKI.models.navigation.deleteNavForEntries([id])
    await WIKI.models.storage.removePage({
      id,
      siteId,
      actorId: actor.id,
      locale: page.locale,
      path: page.path,
      contentType: page.contentType
    })

    await WIKI.models.hooks.emit('page:delete', {
      id,
      path: page.path,
      locale: page.locale,
      siteId,
      authorId: actor.id
    })
    return true
  }

  /**
   * Delete the pages left behind by a folder deletion, which removed their tree entries already.
   *
   * Not optional tidying: a page is served from its own row, found by the hash of its path, and the
   * tree is only consulted for where it sits in the site. A page whose tree entry went with the
   * folder is therefore still live at its URL while being invisible to everything that lists the
   * wiki -- including the file manager somebody would have to use to delete it.
   *
   * Each one is recorded as deleted first, exactly as deleting a single page does. `pageHistory`
   * carries no foreign key back to `pages` precisely so that it outlives the row, which is what makes
   * a folder deleted by mistake recoverable.
   */
  async deleteOrphaned(siteId: string, entries: DeletedEntry[], actor: PageActor): Promise<void> {
    if (entries.length < 1) {
      return
    }
    for (const entry of entries) {
      await WIKI.models.pageHistory.record({
        siteId,
        pageId: entry.id,
        action: 'deleted',
        authorId: actor.id
      })
    }
    // -> Read before the rows go: what a target filed each page under is decided by its content type,
    //    and guessing would mean reaching for names that may belong to the assets beside them
    const contentTypes = new Map(
      (
        await WIKI.db
          .select({ id: pagesTable.id, contentType: pagesTable.contentType })
          .from(pagesTable)
          .where(
            inArray(
              pagesTable.id,
              entries.map((entry) => entry.id)
            )
          )
      ).map((row) => [row.id, row.contentType])
    )
    await WIKI.db.delete(pagesTable).where(
      inArray(
        pagesTable.id,
        entries.map((entry) => entry.id)
      )
    )

    // -> One per page, as deleting them one at a time would have sent: a subscriber mirroring the
    //    wiki has to hear about each page, not about the folder it happened to sit in
    for (const entry of entries) {
      const path = entry.folderPath ? `${entry.folderPath}/${entry.fileName}` : entry.fileName
      const contentType = contentTypes.get(entry.id)
      if (contentType) {
        await WIKI.models.storage.removePage({
          id: entry.id,
          siteId,
          actorId: actor.id,
          locale: entry.locale,
          path,
          contentType
        })
      }
      await WIKI.models.hooks.emit('page:delete', {
        id: entry.id,
        path,
        locale: entry.locale,
        siteId,
        authorId: actor.id
      })
    }
    WIKI.logger.debug(`Deleted ${entries.length} page(s) that went with a deleted folder.`)
  }

  // == STORAGE ========================

  /**
   * The file name a page occupies on a target that lays content out by path.
   *
   * The name a page and an asset can collide on, and so the thing both of them are checked against
   * before either is written — see `guardAgainstAssetCollision` here and its opposite number in the
   * assets model.
   */
  storageFileName(fileName: string, contentType: string): string {
    return `${fileName}.${pageFileExtension(contentType)}`
  }

  /**
   * The file name an existing page occupies, or null if there is no such page.
   */
  async storageFileNameOf(id: string): Promise<string | null> {
    const results = await WIKI.db
      .select({ path: pagesTable.path, contentType: pagesTable.contentType })
      .from(pagesTable)
      .where(eq(pagesTable.id, id))
      .limit(1)
    const row = results[0]
    return row ? this.storageFileName(row.path.split('/').at(-1)!, row.contentType) : null
  }

  /**
   * Refuse a page whose stored file would land on an asset that is already there.
   *
   * The page and the asset have different names as far as the tree is concerned — a page is `readme`
   * and the asset is `readme.md` — so nothing in the tree stops the two coexisting. They only meet
   * once the page has to be a file, and by then one of them would be overwriting the other.
   *
   * Normally unreachable, because the site's `pageExtensions` keeps assets off these extensions in
   * the first place. It is the backstop for a site that has removed one from that list, and for
   * content that predates its being on it.
   *
   * @throws `pageNameTakenByAsset` when the name is not free
   */
  private async guardAgainstAssetCollision({
    siteId,
    locale,
    parentPath,
    fileName,
    contentType
  }: {
    siteId: string
    locale: string
    parentPath: string
    fileName: string
    contentType: string
  }): Promise<void> {
    const storedName = this.storageFileName(fileName, contentType)
    const occupant = await WIKI.models.tree.getEntryAt({
      siteId,
      locale,
      parentPath,
      fileName: storedName
    })
    if (occupant?.type === 'asset') {
      throw new CustomError(
        'pageNameTakenByAsset',
        `A file named ${storedName} already exists here, which is where this page would be stored.`,
        409
      )
    }
  }

  /*
    A page always lives in its own row, and none of what follows changes that. What it does is keep a
    copy of the page on every storage target configured to hold `pages` — the local disk, today —
    which is a backup of content the database owns rather than a place it has moved to. Nothing here
    is ever read back: `getPage` goes to the row, as it always has.

    That is why every one of these calls is fired after the database write has succeeded and none of
    them is allowed to fail the operation; `WIKI.models.storage` swallows and logs a target that could
    not keep up. A wiki whose backup disk filled up is a wiki with a stale backup, not one that has
    stopped accepting edits.
  */

  /**
   * A page in the shape a storage target takes it.
   *
   * @param content The source, which the caller has to hand: it is not on the `Page` a mutation
   *   returns unless the read asked for it, and re-reading the row to get it back would cost a query
   *   per save for something the caller just wrote.
   */
  private toStoragePage(
    siteId: string,
    actorId: string | undefined,
    page: {
      id: string
      locale: string
      path: string
      title: string
      description?: string | null
      editor: string
      contentType: string
      tags?: string[]
      publishState: string
      createdAt: Date
      updatedAt: Date
    },
    content: string
  ): { ref: StoragePageRef; content: StoragePageContent } {
    return {
      ref: {
        id: page.id,
        siteId,
        actorId,
        locale: page.locale,
        path: page.path,
        contentType: page.contentType
      },
      content: {
        title: page.title,
        description: page.description ?? '',
        editor: page.editor,
        tags: page.tags ?? [],
        // -> A scheduled page is not published yet, whatever its dates say it will be
        isPublished: page.publishState === 'published',
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        content
      }
    }
  }

  /**
   * Every page of a site, in the shape a storage target takes them.
   *
   * What a target's `dump` action walks in order to write copies of content that predates it being
   * enabled. Reads the source of every page at once, which is what makes this a maintenance action
   * rather than something to call on a request.
   */
  async listForStorage(
    siteId: string
  ): Promise<{ ref: StoragePageRef; content: StoragePageContent }[]> {
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        locale: pagesTable.locale,
        path: pagesTable.path,
        title: pagesTable.title,
        description: pagesTable.description,
        editor: pagesTable.editor,
        contentType: pagesTable.contentType,
        tags: pagesTable.tags,
        publishState: pagesTable.publishState,
        createdAt: pagesTable.createdAt,
        updatedAt: pagesTable.updatedAt,
        content: pagesTable.content
      })
      .from(pagesTable)
      .where(eq(pagesTable.siteId, siteId))

    return rows.map((row) => this.toStoragePage(siteId, undefined, row, row.content ?? ''))
  }

  /**
   * Take a page a storage target holds and the wiki does not into the database.
   *
   * The direction that makes a target a peer store rather than a write-only backup: pages arrive here
   * from a folder restored onto the disk, and — once a module exists that can hear about them — from
   * commits somebody else pushed. What comes back is an ordinary page, because that is the only kind
   * there is: it lands in `pages`, gets a tree entry and is served from the row like every other.
   *
   * A path the wiki already has a page at is left alone rather than overwritten, unless `overwrite`
   * says the file is to win. Off, this is the safe direction: the wiki's copy is the one an author has
   * been editing, and reconciling a file that changed on both sides is a merge, which is a target's
   * business and not this model's. On, the file is taken as the authority — for a restore, where what
   * is in the folder is what the wiki is supposed to say.
   *
   * An overwrite is an ordinary save, not a special path: it records a version like any other, so the
   * copy it replaced is in the page's history and an administrator who did not mean it can put it
   * back. Two things it does not take from the file, both because a save anywhere else in this model
   * does not either — the page's **editor**, so a `.md` file cannot turn a redirection into markdown
   * by landing on it, and its **path**, since that is what identified it in the first place.
   *
   * @param overwrite Replace a page already at this path instead of leaving it alone
   * @returns The imported page, or null when there is already one at that path and `overwrite` is not
   *   set
   */
  async adoptStoredPage({
    siteId,
    locale,
    path,
    title,
    description,
    editor,
    tags,
    isPublished,
    content,
    createdAt,
    updatedAt,
    authorId,
    overwrite
  }: {
    siteId: string
    locale: string
    path: string
    title: string
    description?: string
    editor: string
    tags?: string[]
    isPublished?: boolean
    content: string
    createdAt?: Date
    updatedAt?: Date
    authorId: string
    overwrite?: boolean
  }): Promise<Page | null> {
    const normalized = normalizePath(path)
    const existing = await WIKI.db
      .select({ id: pagesTable.id })
      .from(pagesTable)
      .where(
        and(
          eq(pagesTable.siteId, siteId),
          eq(pagesTable.locale, locale),
          eq(pagesTable.path, normalized)
        )
      )
      .limit(1)
    if (existing.length > 0 && !overwrite) {
      return null
    }

    /*
      Imported content is rendered with NO script or style permission, whoever ran the import.

      What those two allow is a `<script>` or a `<style>` surviving sanitization, and the file this
      came out of was not necessarily written by the administrator who pressed the button — the whole
      point of the feature is content arriving from somewhere else, which for a future git target
      means commits from whoever can push. Granting the importer's own privileges to it would turn
      "restore my pages" into stored XSS for every reader. An administrator who does want scripts on
      an imported page saves it once themselves, deliberately.
    */
    const actor = { id: authorId, permissions: [] }
    // -> The one difference between the two directions, and deliberately the only one: a page that is
    //    there is *saved*, through the same method an editor saves through, so it gets a history entry
    //    and a re-render and a mirrored copy without any of that being reimplemented here
    const page = existing[0]
      ? await this.updatePage(
          siteId,
          existing[0].id,
          {
            title,
            description,
            content,
            tags,
            publishState: isPublished === false ? 'draft' : 'published',
            render: ''
          } as Partial<PageInput>,
          actor
        )
      : await this.createPage(
          siteId,
          {
            path: normalized,
            locale,
            title,
            description,
            editor,
            content,
            tags,
            publishState: isPublished === false ? 'draft' : 'published',
            // -> No stored HTML: the source is all a file carries, and what a reader sees is produced
            //    from it by the render queue below
            render: ''
          } as PageInput,
          actor
        )
    // -> Only if the page went away between the two statements above
    if (!page) {
      return null
    }

    // -> A restore should not report every page as written today. Applied after the fact because the
    //    two dates are not something an API client may set, only something a file can carry back.
    if (createdAt || updatedAt) {
      await WIKI.db
        .update(pagesTable)
        .set({
          ...(createdAt ? { createdAt } : {}),
          ...(updatedAt ? { updatedAt } : {})
        })
        .where(eq(pagesTable.id, page.id))
      // -> Writing the page already put a copy on every target holding pages, stamped with the dates
      //    it had for the moment it existed with the wrong ones
      const restored = this.toStoragePage(
        siteId,
        actor.id,
        { ...page, createdAt: createdAt ?? page.createdAt, updatedAt: updatedAt ?? page.updatedAt },
        content
      )
      await WIKI.models.storage.mirrorPage(restored.ref, restored.content)
    }

    // -> An imported page has no HTML until something renders it, which takes a headless browser this
    //    instance may not have. Best effort: the page is in the wiki either way, and a re-render can
    //    be asked for from the admin area once one is available.
    try {
      await this.queueRerender(siteId, page.id, actor)
    } catch (err: any) {
      WIKI.logger.warn(`Could not queue a render for the imported page ${normalized} [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
    }

    return page
  }

  /**
   * Ask for a page to be rendered again from its source, without going through an editor.
   *
   * Needed when a stored render has gone stale — the markdown config changed, or the renderer itself
   * did — and there is nobody with the page open to re-save it. The rendering goes through the very
   * same frontend pipeline, driven in a headless browser, so the result is what the editor would have
   * produced; because that costs a browser it is queued rather than done here, one page at a time
   * across the whole instance. See `models/rendering.ts`.
   *
   * What the render may carry is settled here, while there is still an actor to ask, and travels with
   * the queued request.
   *
   * @returns False when there is no such page
   * @throws `renderUnsupportedEditor` for a page the server cannot render, or
   *         `renderPuppeteerMissing` when nothing here could drain the queue
   */
  async queueRerender(siteId: string, id: string, actor: PageActor): Promise<boolean> {
    const page = await this.getPage({ siteId, id })
    if (!page) {
      return false
    }
    await WIKI.models.rendering.ensureCanRender(page.editor)

    await WIKI.models.rendering.queuePage({
      siteId,
      pageId: page.id,
      permissions: {
        scripts: hasPermission(actor, 'write:scripts'),
        styles: hasPermission(actor, 'write:styles')
      },
      requestedById: actor.id
    })
    return true
  }

  /**
   * Store HTML the renderer produced for a page, and re-index it.
   *
   * The counterpart to `queueRerender`: the drain calls this once the browser has been through the
   * content. Post-processed like any other render — it came from a browser either way — against the
   * permissions the person who asked for it had.
   */
  async storeRender(
    siteId: string,
    id: string,
    html: string,
    permissions: RenderPermissions
  ): Promise<void> {
    const { render, toc, text } = await WIKI.models.rendering.postProcess(siteId, html, permissions)

    const updated = await WIKI.db
      .update(pagesTable)
      .set({ render, toc, searchContent: text, updatedAt: sql`now()` })
      .where(and(eq(pagesTable.id, id), eq(pagesTable.siteId, siteId)))
      .returning({ locale: pagesTable.locale })

    // -> Nothing was updated when the page went while it sat in the queue
    if (updated[0]) {
      await WIKI.models.search.indexPage(id, updated[0].locale)
    }
  }

  /**
   * Resolve a page alias to its path, or null if nothing claims that alias.
   */
  async getPathFromAlias(
    siteId: string,
    alias: string
  ): Promise<{ id: string; path: string } | null> {
    const results = await WIKI.db
      .select({ id: pagesTable.id, path: pagesTable.path })
      .from(pagesTable)
      .where(and(eq(pagesTable.siteId, siteId), eq(pagesTable.alias, alias)))
      .limit(1)
    return results[0] ?? null
  }

  /**
   * The locale a page belongs to when the request does not say.
   */
  private defaultLocale(siteId: string): string {
    return WIKI.sites[siteId]?.config?.locales?.primary ?? 'en'
  }

  /**
   * Check an alias is well formed and unclaimed, and normalize an empty one to null.
   */
  private async validateAlias(
    siteId: string,
    alias: string | undefined,
    exceptPageId?: string
  ): Promise<string | null> {
    const value = (alias ?? '').trim()
    if (!value) {
      return null
    }
    if (!reAlias.test(value)) {
      throw new CustomError(
        'pageInvalidAlias',
        'An alias may only contain alphanumeric, hyphen and underscore characters.'
      )
    }
    const conditions = [eq(pagesTable.siteId, siteId), eq(pagesTable.alias, value)]
    if (exceptPageId) {
      conditions.push(ne(pagesTable.id, exceptPageId))
    }
    const duplicate = await WIKI.db
      .select({ id: pagesTable.id })
      .from(pagesTable)
      .where(and(...conditions))
      .limit(1)
    if (duplicate.length > 0) {
      throw new CustomError('pageDuplicateAlias', 'Another page already uses this alias.', 409)
    }
    return value
  }

  /**
   * Fold the flat display options back into the `config` blob they are stored in.
   */
  private buildConfig(
    input: Partial<PageInput>,
    siteId: string,
    existing: Record<string, any> = {}
  ): Record<string, any> {
    const defaults = WIKI.sites[siteId]?.config?.defaults ?? {}
    return {
      allowComments: input.allowComments ?? existing.allowComments ?? true,
      allowContributions: input.allowContributions ?? existing.allowContributions ?? true,
      allowRatings: input.allowRatings ?? existing.allowRatings ?? true,
      showSidebar: input.showSidebar ?? existing.showSidebar ?? true,
      showTags: input.showTags ?? existing.showTags ?? true,
      showToc: input.showToc ?? existing.showToc ?? true,
      tocDepth: input.tocDepth ?? existing.tocDepth ?? defaults.tocDepth ?? { min: 1, max: 2 }
    }
  }

  /**
   * Same for the per-page scripts — which only an author holding the matching permission may set.
   *
   * Silently dropped rather than refused, as with the rest of the sanitizing: an author pasting a
   * page template that carries scripts should get their page, minus the scripts.
   */
  private buildScripts(
    input: Partial<PageInput>,
    actor: PageActor,
    existing: Record<string, any> = {}
  ): Record<string, any> {
    const mayScript = hasPermission(actor, 'write:scripts')
    const mayStyle = hasPermission(actor, 'write:styles')
    return {
      jsLoad: mayScript ? (input.scriptJsLoad ?? existing.jsLoad ?? '') : (existing.jsLoad ?? ''),
      jsUnload: mayScript
        ? (input.scriptJsUnload ?? existing.jsUnload ?? '')
        : (existing.jsUnload ?? ''),
      css: mayStyle ? (input.scriptCss ?? existing.css ?? '') : (existing.css ?? '')
    }
  }

  /**
   * What a page's tree entry carries about it, so a folder listing needs no join.
   */
  private treeMeta(page: any): Record<string, any> {
    return {
      authorId: page.authorId,
      contentType: page.contentType,
      creatorId: page.creatorId ?? page.authorId,
      description: page.description ?? '',
      editor: page.editor,
      isBrowsable: page.isBrowsable,
      ownerId: page.ownerId ?? page.authorId,
      publishState: page.publishState,
      publishEndDate: page.publishEndDate ?? null,
      publishStartDate: page.publishStartDate ?? null
    }
  }
}

export const pages = new Pages()
