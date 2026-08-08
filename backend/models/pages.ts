import { and, eq, ne, sql } from 'drizzle-orm'
import { pages as pagesTable, tree as treeTable, users as usersTable } from '../db/schema.ts'
import { CustomError, generatePathHash, timingSafeCompare } from '../helpers/common.ts'
import type { RenderPermissions, TocNode } from './rendering.ts'

/** What each editor produces, which is what the content column holds. */
const EDITOR_CONTENT_TYPES: Record<string, string> = {
  markdown: 'markdown',
  asciidoc: 'asciidoc',
  wysiwyg: 'html'
}

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
 * Strip a path down to the form that gets stored: no wrapping slashes, lowercase.
 */
function normalizePath(input: string): string {
  const path = (input ?? '').trim().replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
  if (!rePagePath.test(path)) {
    throw new CustomError(
      'pageInvalidPath',
      'A page path may only contain alphanumeric, hyphen, underscore and slash characters.'
    )
  }
  return path
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
      ...(withContent && !locked ? { content: row.content ?? '' } : {}),
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
    if (!input.content || input.content.trim().length < 1) {
      throw new CustomError('pageEmptyContent', 'A page cannot be empty.')
    }
    const editor = input.editor || 'markdown'

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

    const alias = await this.validateAlias(siteId, input.alias)
    const { render, toc, text } = await WIKI.models.rendering.postProcess(
      siteId,
      input.render ?? '',
      {
        scripts: hasPermission(actor, 'write:scripts'),
        styles: hasPermission(actor, 'write:styles')
      }
    )

    const pathParts = path.split('/')
    const inserted = await WIKI.db
      .insert(pagesTable)
      .values({
        alias,
        authorId: actor.id,
        creatorId: actor.id,
        ownerId: actor.id,
        config: this.buildConfig(input, siteId),
        content: input.content,
        contentType: EDITOR_CONTENT_TYPES[editor] ?? 'text',
        description: input.description ?? '',
        editor,
        hash,
        icon: input.icon ?? '',
        isBrowsable: input.isBrowsable ?? true,
        isSearchable: input.isSearchable ?? true,
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
      values.content = patch.content
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
      values.isSearchable = patch.isSearchable
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
    const page = await this.getPage({ siteId, id })
    if (!page) {
      return null
    }
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
