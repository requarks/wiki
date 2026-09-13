import fs from 'node:fs/promises'
import path from 'node:path'
import { load } from 'js-yaml'
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import {
  comments as commentsTable,
  pages as pagesTable,
  users as usersTable
} from '../db/schema.ts'
import {
  durationToSeconds,
  htmlEscape,
  isSensitiveMask,
  parseModuleProps
} from '../helpers/common.ts'
import type { ModuleProp } from '../helpers/common.ts'

/**
 * The key of the provider that IS this wiki, as opposed to the ones that are somebody else's service.
 *
 * It has no directory under `modules/comments` and never will: what the other providers declare in
 * two YAML files, this one implements in a table, a set of routes and a view. Its definition is the
 * constant below, so that the admin screen can render its settings through exactly the same form as
 * everything else rather than growing a branch for it.
 */
export const BUILTIN_PROVIDER = 'default'

/**
 * The three places a provider's markup goes, and the order they are used in.
 *
 * `head` is loaded once per document — a stylesheet, an SDK — `main` is the container the widget
 * draws itself into, and `body` is the script that starts it, run after the container exists. Unlike
 * an analytics tag none of this is served in the HTML: a comment widget belongs at the bottom of the
 * article, and moving between wiki pages is a router transition rather than a document load, so a
 * snippet baked into the shell would initialise once and then show the first page's discussion for
 * ever. `frontend/src/components/PageCommentsEmbed.vue` is what mounts these, per page.
 */
const SLOTS = ['head', 'main', 'body'] as const

type Slot = (typeof SLOTS)[number]

/**
 * A placeholder in a provider's code template: `{{<context>:<name>}}`.
 *
 * The context says how the value is written into the snippet rather than what the value is, because
 * the same value goes into different places and escapes differently in each — the same contract
 * `models/analytics.ts` uses, and the same four contexts.
 *
 * A name of the form `page.<field>` is NOT resolved here. Those are the placeholders whose value is
 * different for every page (`page.url`, `page.id`, `page.path`, `page.title`, `page.locale`), and
 * they are left in the rendered string for the browser to fill in as the reader moves from page to
 * page — see `renderPlaceholder` in `frontend/src/helpers/commentsEmbed.js`, which reads this same
 * pattern and escapes by the same rules.
 */
const PLACEHOLDER = /\{\{(js|attr|num|bool):([A-Za-z0-9_.]+)\}\}/g

/** The prefix that marks a placeholder as the browser's to resolve. See `PLACEHOLDER`. */
const PAGE_PREFIX = 'page.'

/** What a character becomes inside a JavaScript string literal. As `models/analytics.ts`, verbatim. */
const JS_ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  "'": "\\'",
  '"': '\\"',
  '`': '\\`',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '<': '\\u003C',
  '>': '\\u003E',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
}

const JS_ESCAPE_PATTERN = /[\\'"`\n\r\t<>&\u2028\u2029]/g

/**
 * The longest a single comment may be, in characters of markdown source.
 *
 * Not a setting: this is a comment box, and the number is here to keep a page of discussion from
 * becoming a page of content. It is enforced by the route schema and repeated to the client so that
 * the composer can count down to it rather than discovering it on submit.
 */
export const COMMENT_MAX_LENGTH = 8000

/** The shortest a comment may be, so that an empty box and a stray keystroke are both refused. */
export const COMMENT_MIN_LENGTH = 2

/** How long a client waits between posts when nothing is configured, in seconds. */
const DEFAULT_POST_COOLDOWN = 30

/** What a handle may be made of. Mentions are matched against exactly this. */
export const HANDLE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/

/**
 * A mention as it is written in a comment: `@handle`.
 *
 * The lookbehind is what keeps an email address and a path from being read as one — `a@b.com` and
 * `docs/@handle` mention nobody. A handle that matches no user is left as the text that was typed,
 * here and in the renderer, so a mention never silently becomes a link to the wrong person.
 */
const MENTION_PATTERN = /(?<![\w@/])@([A-Za-z0-9_-]{3,32})/g

/** How long the spam check gets before the comment is let through, in milliseconds. */
const AKISMET_TIMEOUT = 5000

/** A comments module, as declared by its `definition.yml` and `code.yml`. */
export interface CommentsDefinition {
  /** Directory name under `modules/comments`, or `default` for the built-in provider. */
  key: string
  title: string
  description: string
  /** The provider's own site, linked from the panel beside its configuration. */
  website: string
  icon: string
  props: Record<string, ModuleProp>
  /**
   * The props that must hold a value before this provider can be used at all.
   *
   * A comment widget pointed at no account renders an error where the discussion should be, so a
   * selected provider missing one of these contributes nothing and the admin screen names the empty
   * field instead.
   */
  requires: string[]
  /** The markup each slot contributes, before any value is substituted into it. */
  code: Record<Slot, string>
  /** Whether this is the provider implemented by the wiki itself. See `BUILTIN_PROVIDER`. */
  isBuiltIn: boolean
}

/** One provider as a site has it configured, which is what the admin area edits. */
export interface CommentsProvider {
  key: string
  title: string
  description: string
  website: string
  icon: string
  isBuiltIn: boolean
  /** Whether this is the one provider the site is using. At most one provider is. */
  isSelected: boolean
  requires: string[]
  props: Record<string, ModuleProp>
  config: Record<string, any>
}

/** What a client may change about one provider. */
export interface CommentsProviderInput {
  key: string
  config?: Record<string, any>
}

/**
 * What a browser is told about this site's comments, and all it is told.
 *
 * Carried on the site payload rather than fetched, because every page view needs it and the site
 * configuration is already in memory on every instance — the same reasoning as the analytics tags.
 * Deliberately narrow: the stored configuration of the built-in provider holds an Akismet key, and
 * nothing that a `Site` response serializes may go anywhere near it.
 */
export interface CommentsPublicConfig {
  /** The selected provider's key, or an empty string when this site has comments turned off. */
  provider: string
  /** True when `provider` is the wiki's own. The talk view is drawn only for this one. */
  isBuiltIn: boolean
  /** The third-party markup, with everything but the page placeholders already substituted. */
  code: Record<Slot, string>
  /** Seconds a client must wait between posts. Built-in only; 0 when there is no cooldown. */
  cooldownSeconds: number
  /** The cap the composer counts down to. See `COMMENT_MAX_LENGTH`. */
  maxLength: number
}

/** One comment as the API answers with it. Neither the email nor the address is ever in here. */
export interface CommentEntry {
  id: string
  parentId: string | null
  content: string
  createdAt: Date
  updatedAt: Date
  /** Null for a guest, and for an author whose account has since been deleted. */
  authorId: string | null
  authorName: string
  /** Whether an avatar can be fetched for `authorId`. False whenever there is no account. */
  authorHasAvatar: boolean
  /** The author's handle, so a reply can address them without the reader looking it up. */
  authorHandle: string | null
  /** Whether the comment was written by somebody with no account. */
  isGuest: boolean
}

/** A handle that resolved to somebody, as the renderer needs it to draw the mention as a link. */
export interface MentionTarget {
  handle: string
  id: string
  name: string
}

/** What a comment is created with. */
export interface CommentInput {
  pageId: string
  parentId?: string | null
  content: string
  authorId: string | null
  authorName: string
  authorEmail: string
  authorIP: string
}

/** The definition of the provider the wiki implements itself. See `BUILTIN_PROVIDER`. */
const BUILTIN_DEFINITION = {
  title: 'Built-in Comments',
  description:
    'Discussions that belong to this wiki: no third-party service, no second account for a reader to create, and nothing leaving the instance. Markdown, one level of replies, and @mentions of anybody who has set a handle.',
  /*
    Empty on purpose, which is what keeps the "Visit Website" button off this provider's panel. Every
    other provider is a service with a site to go and read about; this one is the wiki the
    administrator is already looking at.
  */
  website: '',
  icon: '/_assets/icons/ultraviolet-comments2.svg',
  requires: [] as string[],
  props: {
    postCooldown: {
      type: 'String',
      title: 'Posting Cooldown',
      default: '30s',
      hint: 'How long somebody must wait between two comments, counted per account and per address for a guest. Set to 0 for no cooldown.',
      icon: 'timer',
      order: 1
    },
    akismetApiKey: {
      type: 'String',
      title: 'Akismet API Key',
      default: '',
      sensitive: true,
      hint: 'Optional. With a key, every comment is checked against Akismet before it is stored and a comment it calls spam is refused. Left empty, nothing is sent anywhere.',
      icon: 'key',
      order: 2
    }
  }
}

/**
 * The built-in provider as a definition, built once.
 *
 * Once rather than per access because `getDefinition` is on the path of `buildConfig`, which the
 * public site payload goes through on every bootstrap — and re-parsing a constant's props and
 * re-sorting them for each of those is work with a known answer.
 */
const BUILTIN: CommentsDefinition = {
  key: BUILTIN_PROVIDER,
  ...BUILTIN_DEFINITION,
  props: sortProps(parseModuleProps(BUILTIN_DEFINITION.props)),
  code: { head: '', main: '', body: '' },
  isBuiltIn: true
}

/** A site with comments turned off, which is every site until somebody picks a provider. */
const NO_PUBLIC_CONFIG: CommentsPublicConfig = {
  provider: '',
  isBuiltIn: false,
  code: { head: '', main: '', body: '' },
  cooldownSeconds: 0,
  maxLength: COMMENT_MAX_LENGTH
}

/**
 * Comments model
 *
 * Two things wearing one name, and the whole of this file is the seam between them.
 *
 * **A provider is one module from `modules/comments/<key>/`**, two YAML files exactly as an analytics
 * provider is: a `definition.yml` saying what it is and what it needs configured, and a `code.yml`
 * holding the markup it contributes. Nothing about such a provider reaches this server at read time —
 * the discussion lives in somebody else's service and the wiki's only job is to put the right snippet
 * at the bottom of the right page.
 *
 * **The built-in provider is this wiki**, and has no module directory: comments are rows in
 * `comments`, served by `api/comments.ts`, drawn on a Talk tab beside the article. Its settings are
 * declared in `BUILTIN_DEFINITION` above so that the admin screen renders one kind of form for every
 * provider rather than two.
 *
 * **Only one provider is selected at a time**, which is what makes this different from analytics: two
 * analytics tags count the same visit twice and that is a mistake worth warning about, but two comment
 * widgets are two separate discussions of the same page, and neither of them is the discussion. The
 * configuration of the providers that are NOT selected is kept all the same, so that trying one and
 * going back does not mean typing the first one's settings in again.
 *
 * **Configuration lives in the site's config blob**, under `comments`, for the same reasons the
 * analytics configuration does: every page view needs it, `WIKI.sites` already holds the site
 * configurations in memory on every instance, and `sites.updateSite` already reloads them across the
 * cluster. What a browser is given of it is `publicConfigFor` and nothing else — the built-in
 * provider's stored configuration holds an Akismet key.
 */
class Comments {
  /** Definitions read from disk, refreshed by `refreshFromDisk()`. The built-in one is not among them. */
  moduleDefinitions: CommentsDefinition[] = []

  /**
   * Load the comments module definitions from disk.
   *
   * One directory per provider, each with both files. A directory missing either is skipped with a
   * warning rather than emptying the list, as in `models/analytics.ts`: a provider that cannot be
   * read is one provider nobody can select, where an empty list would take down the discussions of
   * every site that had already selected one.
   */
  async refreshFromDisk(): Promise<void> {
    const modulesPath = path.join(WIKI.SERVERPATH, 'modules/comments')
    const definitions: CommentsDefinition[] = []
    try {
      for (const dir of await fs.readdir(modulesPath)) {
        try {
          const parsed = load(
            await fs.readFile(path.join(modulesPath, dir, 'definition.yml'), 'utf8')
          ) as Record<string, any>
          const code = load(
            await fs.readFile(path.join(modulesPath, dir, 'code.yml'), 'utf8')
          ) as Record<string, any>
          definitions.push({
            key: dir,
            title: parsed.title ?? dir,
            description: parsed.description ?? '',
            website: parsed.website ?? '',
            icon: parsed.icon ?? '',
            props: sortProps(parseModuleProps(parsed.props ?? {})),
            requires: parsed.requires ?? [],
            code: {
              head: typeof code?.head === 'string' ? code.head.trim() : '',
              main: typeof code?.main === 'string' ? code.main.trim() : '',
              body: typeof code?.body === 'string' ? code.body.trim() : ''
            },
            isBuiltIn: false
          })
        } catch (err: any) {
          WIKI.logger.warn(`Skipping comments module ${dir}: ${err.message}`)
        }
      }
      this.moduleDefinitions = definitions.sort((a, b) => a.title.localeCompare(b.title))
      WIKI.logger.info(`Found ${this.moduleDefinitions.length} comments modules [ OK ]`)
    } catch (err: any) {
      this.moduleDefinitions = []
      WIKI.logger.error(
        `Could not read the comments module definitions at ${modulesPath} [ FAILED ]`
      )
      WIKI.logger.error(err.message)
    }
  }

  /**
   * Every provider that can be selected, the wiki's own first.
   *
   * First rather than sorted in with the rest because it is the one that needs nothing set up, and
   * because it is what an administrator opening this screen is most likely to be looking for.
   */
  get definitions(): CommentsDefinition[] {
    return [BUILTIN, ...this.moduleDefinitions]
  }

  /** A single definition, or null when nothing declares that key. */
  getDefinition(key: string): CommentsDefinition | null {
    return this.definitions.find((d) => d.key === key) ?? null
  }

  /** What a site has stored under `comments`. Empty for a site that has never saved this screen. */
  storedConfig(siteId: string): { provider?: string; providers?: Record<string, any> } {
    return WIKI.sites[siteId]?.config?.comments ?? {}
  }

  /**
   * The key of the provider this site uses, or an empty string when it uses none.
   *
   * A key that no longer names anything on disk reads as none: a module removed from an installation
   * must not leave the site serving the snippet of a provider that is no longer there.
   */
  selectedProvider(siteId: string | undefined): string {
    if (!siteId) {
      return ''
    }
    const key = this.storedConfig(siteId).provider ?? ''
    return key && this.getDefinition(key) ? key : ''
  }

  /**
   * Whether this site has comments at all — the switch under **General → Features**.
   *
   * Separate from which provider is selected, and checked separately: the provider is a choice an
   * administrator made and must survive being turned off, which is the whole point of having a
   * switch rather than expecting them to clear the selection. Absent reads as on, since a site
   * configuration saved before this key existed has no opinion about it.
   *
   * Deliberately NOT folded into `selectedProvider`, which the admin screen reads to show what is
   * selected: a screen that reported "no provider in use" because the master switch is off would
   * then save that back as the truth.
   */
  isAllowed(siteId: string | undefined): boolean {
    return siteId ? WIKI.sites[siteId]?.config?.features?.comments !== false : false
  }

  /** Whether this site's comments are the wiki's own, which is what the talk view is drawn for. */
  usesBuiltIn(siteId: string | undefined): boolean {
    return this.isAllowed(siteId) && this.selectedProvider(siteId) === BUILTIN_PROVIDER
  }

  /**
   * Every provider installed, with what this site has configured for it merged in.
   *
   * Driven by the definitions rather than by what is stored, so a provider nobody has touched is
   * listed with its defaults and one dropped from disk simply stops appearing — its stored values
   * stay in the site config, ignored, until the screen is next saved.
   */
  getSiteProviders(siteId: string): CommentsProvider[] {
    const stored = this.storedConfig(siteId)
    const selected = this.selectedProvider(siteId)
    return this.definitions.map((definition) => ({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      website: definition.website,
      icon: definition.icon,
      isBuiltIn: definition.isBuiltIn,
      isSelected: definition.key === selected,
      requires: definition.requires,
      props: definition.props,
      config: this.buildConfig(definition.key, {}, stored.providers?.[definition.key]?.config ?? {})
    }))
  }

  /**
   * Merge incoming config values onto the ones already stored, keeping only what the module declares.
   *
   * Unknown keys are dropped rather than refused, so a provider that loses a prop does not make the
   * screen unsaveable. Read-only props are never taken from the client, and a sensitive prop sent
   * back as the mask means "leave it alone" — which is the whole reason the mask exists.
   */
  buildConfig(
    moduleKey: string,
    incoming: Record<string, any> = {},
    existing: Record<string, any> = {}
  ): Record<string, any> {
    const props = this.getDefinition(moduleKey)?.props ?? {}
    const config: Record<string, any> = {}
    for (const [key, prop] of Object.entries(props)) {
      const current = existing[key] !== undefined ? existing[key] : prop.default
      const keep =
        prop.readOnly || incoming[key] === undefined || isSensitiveMask(prop, incoming[key])
      config[key] = keep ? current : incoming[key]
    }
    return config
  }

  /**
   * Check an incoming provider patch against what the module declares.
   *
   * The props are a runtime declaration read from a YAML file, so no JSON Schema can cover them.
   *
   * @returns The reason it is invalid, or null when it is fine
   */
  validateProvider(patch: CommentsProviderInput): string | null {
    const definition = this.getDefinition(patch.key)
    if (!definition) {
      return `There is no comments provider called "${patch.key}".`
    }
    for (const [key, value] of Object.entries(patch.config ?? {})) {
      const prop = definition.props[key]
      if (!prop || prop.readOnly || value === undefined) {
        continue
      }
      if (prop.enum) {
        // -> Enum entries are declared as `value` or `value|label`
        const allowed = prop.enum.map((entry) => entry.split('|')[0])
        if (!allowed.includes(`${value}`)) {
          return `"${value}" is not a valid value for ${prop.title}.`
        }
        continue
      }
      switch (prop.type) {
        case 'boolean':
          if (typeof value !== 'boolean') {
            return `${prop.title} must be true or false.`
          }
          break
        case 'number':
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return `${prop.title} must be a number.`
          }
          break
        default:
          if (typeof value !== 'string') {
            return `${prop.title} must be a string.`
          }
      }
    }
    if (patch.key === BUILTIN_PROVIDER) {
      const cooldown = `${patch.config?.postCooldown ?? ''}`.trim()
      if (cooldown.length > 0 && cooldown !== '0' && durationToSeconds(cooldown, 0) < 1) {
        return 'The posting cooldown must be a duration such as 30s, 2m or 1h — or 0 for none.'
      }
    }
    return null
  }

  /**
   * Which of a provider's required props are empty, in declaration order.
   *
   * The same question the admin area asks of the form in front of it, so that "Giscus is selected but
   * has no repository" is something an administrator reads on the screen rather than discovering from
   * a widget that draws an error where the discussion should be.
   */
  missingRequired(definition: CommentsDefinition, config: Record<string, any>): string[] {
    return definition.requires.filter((key) => {
      const value = config[key]
      return value === undefined || value === null || `${value}`.trim().length < 1
    })
  }

  /**
   * Write the selected provider and whatever configuration came with it.
   *
   * One write for the lot, through `sites.updateSite`, which is what reloads the cached configuration
   * on every instance — without which a provider switched over would not take effect until a restart.
   * The providers a client did not mention keep what they had, which is what lets an administrator
   * try another one and come back to a form that is still filled in.
   */
  async updateSiteConfig(
    siteId: string,
    input: { provider?: string; providers?: CommentsProviderInput[] }
  ): Promise<void> {
    const stored = this.storedConfig(siteId)
    const providers: Record<string, { config: Record<string, any> }> = {}
    for (const [key, value] of Object.entries(stored.providers ?? {})) {
      providers[key] = { config: (value as any)?.config ?? {} }
    }
    for (const patch of input.providers ?? []) {
      providers[patch.key] = {
        config: this.buildConfig(patch.key, patch.config ?? {}, providers[patch.key]?.config ?? {})
      }
    }
    const provider = input.provider !== undefined ? input.provider : (stored.provider ?? '')
    await WIKI.models.sites.updateSite(siteId, { config: { comments: { provider, providers } } })
  }

  /**
   * The stored configuration of one provider, completed from its defaults.
   *
   * This is the real thing, secrets and all — the mask is applied at the API boundary and nowhere
   * earlier, exactly as it is for storage targets and authentication strategies.
   */
  configFor(siteId: string | undefined, key: string): Record<string, any> {
    if (!siteId) {
      return {}
    }
    return this.buildConfig(key, {}, this.storedConfig(siteId).providers?.[key]?.config ?? {})
  }

  /**
   * What a browser is told about this site's comments. See `CommentsPublicConfig`.
   *
   * Built per call rather than cached: it is a handful of string substitutions over a configuration
   * already in memory, and the answer has to change the moment the admin screen is saved.
   */
  publicConfigFor(siteId: string | undefined): CommentsPublicConfig {
    const key = this.isAllowed(siteId) ? this.selectedProvider(siteId) : ''
    if (!key) {
      return NO_PUBLIC_CONFIG
    }
    const definition = this.getDefinition(key)!
    const config = this.configFor(siteId, key)
    if (this.missingRequired(definition, config).length > 0) {
      // -> Selected but not finished. Nothing is drawn rather than a widget pointed at no account.
      return NO_PUBLIC_CONFIG
    }
    if (definition.isBuiltIn) {
      return {
        provider: key,
        isBuiltIn: true,
        code: { head: '', main: '', body: '' },
        cooldownSeconds: this.cooldownFor(siteId),
        maxLength: COMMENT_MAX_LENGTH
      }
    }
    const code: Record<Slot, string> = { head: '', main: '', body: '' }
    for (const slot of SLOTS) {
      code[slot] = renderTemplate(definition.code[slot], config) ?? ''
    }
    return {
      provider: key,
      isBuiltIn: false,
      code,
      cooldownSeconds: 0,
      maxLength: COMMENT_MAX_LENGTH
    }
  }

  /**
   * How long this site makes a client wait between two comments, in seconds.
   *
   * `0` is no cooldown at all, and so is a value that will not parse — the setting is a duration an
   * administrator typed, and a limit nobody can explain is worse than none.
   */
  cooldownFor(siteId: string | undefined): number {
    const raw = `${this.configFor(siteId, BUILTIN_PROVIDER).postCooldown ?? ''}`.trim()
    if (raw === '0' || raw.length < 1) {
      return 0
    }
    return durationToSeconds(raw, DEFAULT_POST_COOLDOWN)
  }

  // == BUILT-IN PROVIDER ===============
  //
  // Everything below is the wiki's own comments. None of it is reachable for a site that has selected
  // one of the module providers: the routes check `usesBuiltIn` before anything else, because a
  // comment stored here for a site whose discussions live at Disqus is a comment nobody will ever see.

  /**
   * Every comment on a page, oldest first, with its author.
   *
   * One query with a left join rather than a fetch per author: a talk page is a list, and the author
   * of each row is part of what a list of comments IS. The join is left because `authorId` is null
   * for a guest and null again once an account is deleted, and in both cases the name stored on the
   * row is what stands in.
   *
   * Ordering is flat and by time; the one level of nesting is assembled by the view from `parentId`,
   * which keeps a reply beside the comment it answers however old that comment is.
   */
  async listForPage(pageId: string, limit = 500): Promise<CommentEntry[]> {
    const rows = await WIKI.db
      .select({
        id: commentsTable.id,
        parentId: commentsTable.parentId,
        content: commentsTable.content,
        createdAt: commentsTable.createdAt,
        updatedAt: commentsTable.updatedAt,
        authorId: commentsTable.authorId,
        storedName: commentsTable.authorName,
        userName: usersTable.name,
        userHandle: usersTable.handle,
        userHasAvatar: usersTable.hasAvatar
      })
      .from(commentsTable)
      .leftJoin(usersTable, eq(usersTable.id, commentsTable.authorId))
      .where(eq(commentsTable.pageId, pageId))
      .orderBy(asc(commentsTable.createdAt))
      .limit(limit)
    return rows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      authorId: row.authorId,
      // -> The live name where there is still an account behind it, so that a rename shows through
      //    everywhere; the copy taken at the time is what is left when there is not
      authorName: row.userName ?? row.storedName,
      authorHasAvatar: row.userHasAvatar ?? false,
      authorHandle: row.userHandle ?? null,
      isGuest: row.authorId === null
    }))
  }

  /**
   * The page a comment is about, as everything that guards one needs it.
   *
   * Its path, locale and tags because that is what a page rule is matched against, and
   * `allowComments` because a page can be closed to discussion from its own properties dialog
   * whatever the site has configured. Deliberately not `pages.getPage` — that assembles a page for
   * reading, and this is four columns and a scoping check.
   *
   * @returns The reference, or null when no such page exists on this site
   */
  async pageRef(siteId: string, pageId: string) {
    const [row] = await WIKI.db
      .select({
        id: pagesTable.id,
        path: pagesTable.path,
        locale: pagesTable.locale,
        title: pagesTable.title,
        tags: pagesTable.tags,
        allowComments: sql<boolean>`coalesce((${pagesTable.config} ->> 'allowComments')::boolean, true)`
      })
      .from(pagesTable)
      .where(and(eq(pagesTable.id, pageId), eq(pagesTable.siteId, siteId)))
    return row ?? null
  }

  /** How many comments a page has. What the Talk tab's badge counts. */
  async countForPage(pageId: string): Promise<number> {
    const [row] = await WIKI.db
      .select({ total: count() })
      .from(commentsTable)
      .where(eq(commentsTable.pageId, pageId))
    return Number(row?.total ?? 0)
  }

  /** One comment with the page it is on, which is what every permission check on it needs. */
  async getWithPage(commentId: string, siteId: string) {
    const [row] = await WIKI.db
      .select({
        id: commentsTable.id,
        parentId: commentsTable.parentId,
        content: commentsTable.content,
        authorId: commentsTable.authorId,
        pageId: commentsTable.pageId,
        path: pagesTable.path,
        locale: pagesTable.locale,
        tags: pagesTable.tags,
        allowComments: sql<boolean>`coalesce((${pagesTable.config} ->> 'allowComments')::boolean, true)`
      })
      .from(commentsTable)
      .innerJoin(pagesTable, eq(pagesTable.id, commentsTable.pageId))
      .where(and(eq(commentsTable.id, commentId), eq(pagesTable.siteId, siteId)))
    return row ?? null
  }

  /**
   * Store a comment.
   *
   * Replies are one level deep, and this is where that is true: a `parentId` naming a comment that is
   * itself a reply is rewritten to that reply's own parent, so answering the third message in a thread
   * puts the answer at the bottom of the thread rather than starting a fourth level of indentation.
   * A `parentId` on another page is refused outright — that is not a thread, it is a mistake.
   */
  async create(input: CommentInput): Promise<CommentEntry> {
    let parentId: string | null = null
    if (input.parentId) {
      const [parent] = await WIKI.db
        .select({ id: commentsTable.id, parentId: commentsTable.parentId })
        .from(commentsTable)
        .where(and(eq(commentsTable.id, input.parentId), eq(commentsTable.pageId, input.pageId)))
      if (!parent) {
        throw new Error('The comment being replied to is not on this page.')
      }
      parentId = parent.parentId ?? parent.id
    }
    const [row] = await WIKI.db
      .insert(commentsTable)
      .values({
        pageId: input.pageId,
        parentId,
        content: input.content,
        authorId: input.authorId,
        authorName: input.authorName,
        authorEmail: input.authorEmail,
        authorIP: input.authorIP
      })
      .returning()
    return this.describe(row!)
  }

  /** Replace the text of a comment. Who may is decided by the route; this only writes. */
  async update(commentId: string, content: string): Promise<CommentEntry | null> {
    const [row] = await WIKI.db
      .update(commentsTable)
      .set({ content, updatedAt: new Date() })
      .where(eq(commentsTable.id, commentId))
      .returning()
    return row ? this.describe(row) : null
  }

  /**
   * Delete a comment, and with it any replies underneath.
   *
   * The replies go by the foreign key's own cascade rather than by a second statement: a reply exists
   * to answer something, and left behind it would be half of a conversation nobody can read.
   *
   * @returns How many rows went, replies included
   */
  async remove(commentId: string): Promise<number> {
    const replies = await WIKI.db
      .select({ total: count() })
      .from(commentsTable)
      .where(eq(commentsTable.parentId, commentId))
    const result = await WIKI.db.delete(commentsTable).where(eq(commentsTable.id, commentId))
    return (result.rowCount ?? 0) > 0 ? 1 + Number(replies[0]?.total ?? 0) : 0
  }

  /**
   * The users that the handles written in these comments point at.
   *
   * Resolved per response rather than per comment, and as one query: a talk page is a list of comments
   * that mention each other, and asking the database once per `@` would be one query per mention. What
   * comes back is only the handles that exist — the renderer leaves the rest as the text that was
   * typed, which is what keeps a mention from ever linking to the wrong person.
   */
  async resolveMentions(contents: string[]): Promise<MentionTarget[]> {
    const handles = new Set<string>()
    for (const content of contents) {
      for (const match of content.matchAll(MENTION_PATTERN)) {
        handles.add(match[1]!.toLowerCase())
      }
    }
    if (handles.size < 1) {
      return []
    }
    const rows = await WIKI.db
      .select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.isActive, true),
          eq(usersTable.isSystem, false),
          inArray(sql`lower(${usersTable.handle})`, [...handles])
        )
      )
    return rows.map((row) => ({ id: row.id, name: row.name, handle: row.handle! }))
  }

  /**
   * Users whose handle or name starts with what has been typed after an `@`.
   *
   * Only users who have set a handle, because a handle is what a mention is written with — there is
   * nothing to insert for anybody else. Ordered by handle so that the list is stable as it narrows.
   */
  async searchHandles(query: string, limit = 8): Promise<MentionTarget[]> {
    // -> `%` and `_` are wildcards to LIKE and ordinary characters to somebody typing a name, so
    //    they are escaped rather than passed through: `@%` is a search for a handle containing a
    //    percent sign, not a request for every user on the wiki
    const term = query
      .trim()
      .toLowerCase()
      .replace(/[\\%_]/g, '\\$&')
    const rows = await WIKI.db
      .select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.isActive, true),
          eq(usersTable.isSystem, false),
          sql`${usersTable.handle} is not null`,
          term.length > 0
            ? sql`(lower(${usersTable.handle}) like ${term + '%'} or lower(${usersTable.name}) like ${'%' + term + '%'})`
            : sql`true`
        )
      )
      .orderBy(asc(sql`lower(${usersTable.handle})`))
      .limit(limit)
    return rows.map((row) => ({ id: row.id, name: row.name, handle: row.handle! }))
  }

  /**
   * Ask Akismet whether a comment is spam.
   *
   * Only when a key is configured; with none, nothing is sent anywhere, which is the default and is
   * what a wiki that never opened its comments to the public wants.
   *
   * **It fails open.** A network blip, a revoked key or a timeout answers "not spam" and logs it,
   * because the alternative is a wiki that silently stops accepting comments for a reason nobody can
   * see from the inside. A key that is wrong is a configuration problem to be found on the admin
   * screen, not a reason to lose a reader's paragraph.
   *
   * @returns Whether the comment should be refused
   */
  async isSpam(
    siteId: string,
    comment: {
      content: string
      authorName: string
      authorEmail: string
      authorIP: string
      userAgent: string
      referrer: string
      permalink: string
      isGuest: boolean
    }
  ): Promise<boolean> {
    const key = `${this.configFor(siteId, BUILTIN_PROVIDER).akismetApiKey ?? ''}`.trim()
    if (key.length < 1) {
      return false
    }
    const site = WIKI.sites[siteId]
    const blog = site?.hostname ? `https://${site.hostname}` : comment.permalink
    const body = new URLSearchParams({
      blog,
      user_ip: comment.authorIP,
      user_agent: comment.userAgent,
      referrer: comment.referrer,
      permalink: comment.permalink,
      comment_type: 'comment',
      comment_author: comment.authorName,
      comment_author_email: comment.authorEmail,
      comment_content: comment.content,
      // -> Akismet weighs a signed-in commenter differently from an anonymous one, and this is the
      //    only place that distinction is worth passing on
      ...(comment.isGuest ? {} : { user_role: 'subscriber' })
    })
    try {
      const resp = await fetch(
        `https://${encodeURIComponent(key)}.rest.akismet.com/1.1/comment-check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: AbortSignal.timeout(AKISMET_TIMEOUT)
        }
      )
      const text = (await resp.text()).trim()
      if (text !== 'true' && text !== 'false') {
        // -> Akismet says what is wrong in a header rather than in the body, and an invalid key comes
        //    back as `invalid` with the reason there
        WIKI.logger.warn(
          `Akismet answered "${text}" (${resp.headers.get('x-akismet-debug-help') ?? 'no detail'}); the comment was let through.`
        )
        return false
      }
      return text === 'true'
    } catch (err: any) {
      WIKI.logger.warn(
        `Akismet could not be reached (${err.message}); the comment was let through.`
      )
      return false
    }
  }

  /** One stored row as the API answers with it, for a write that already knows its author. */
  private describe(row: typeof commentsTable.$inferSelect): CommentEntry {
    return {
      id: row.id,
      parentId: row.parentId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      authorId: row.authorId,
      authorName: row.authorName,
      authorHasAvatar: false,
      authorHandle: null,
      isGuest: row.authorId === null
    }
  }
}

/** Props in the order the module meant them to be shown in, applied once so every consumer agrees. */
function sortProps(props: Record<string, ModuleProp>): Record<string, ModuleProp> {
  return Object.fromEntries(Object.entries(props).sort(([, a], [, b]) => a.order - b.order))
}

/** A value as it is written into a JavaScript string literal. See `JS_ESCAPES`. */
function jsEscape(value: string): string {
  return value.replace(JS_ESCAPE_PATTERN, (char) => JS_ESCAPES[char]!)
}

/**
 * Substitute a provider's configured values into one of its templates.
 *
 * Page placeholders are left exactly as they were written, for the browser to resolve per page — see
 * `PLACEHOLDER`.
 *
 * @returns The markup, or null where a placeholder could not be resolved to something that would
 *   parse: a `num` slot is a bare numeric literal, and a value that is not a number would be a syntax
 *   error taking the whole snippet with it.
 */
function renderTemplate(template: string, config: Record<string, any>): string | null {
  if (!template) {
    return ''
  }
  let usable = true
  const rendered = template.replace(PLACEHOLDER, (match, context: string, key: string) => {
    if (key.startsWith(PAGE_PREFIX)) {
      return match
    }
    const value = config[key]
    switch (context) {
      case 'num': {
        const num = Number(value)
        if (!Number.isFinite(num)) {
          usable = false
          return '0'
        }
        return `${num}`
      }
      case 'bool':
        return value === true ? 'true' : 'false'
      case 'attr':
        return htmlEscape(`${value ?? ''}`)
      default:
        return jsEscape(`${value ?? ''}`)
    }
  })
  return usable ? rendered : null
}

export const comments = new Comments()
