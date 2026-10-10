import fs from 'node:fs/promises'
import path from 'node:path'
import { load } from 'js-yaml'
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import {
  commentAnnotations as annotationsTable,
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
import type { RulePageRef } from '../helpers/pageRules.ts'
import { liveCondition } from '../helpers/publishing.ts'
import type { AccessActor } from './groups.ts'

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

/**
 * The most passages one comment may annotate.
 *
 * A review of a page is a handful of remarks about it; fifty is room for a thorough one, and a limit
 * at all is what keeps a single post from becoming a few thousand rows.
 */
export const ANNOTATIONS_MAX = 50

/** The longest an annotation's note may be. Shorter than a comment: it is a remark on one passage. */
export const ANNOTATION_NOTE_MAX_LENGTH = 2000

/**
 * The longest passage that may be annotated, in characters of the article's text.
 *
 * A passage is quoted back in the Talk view and searched for in the article every time the
 * discussion is opened, so it is a phrase or a few sentences — a remark on a whole section belongs in
 * the comment itself.
 */
export const ANNOTATION_QUOTE_MAX_LENGTH = 1000

/**
 * The most context kept either side of a passage. The client takes 32 characters; the slack is so
 * that the two can be tuned apart without the server refusing what an older tab sends.
 */
export const ANNOTATION_CONTEXT_MAX_LENGTH = 64

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

/**
 * Where an annotated passage is in the article, described so that it can be found again after the
 * page has changed. Text throughout is the article's as `frontend/src/helpers/annotations.js` reads
 * it: the rendered page with every run of whitespace folded into one space.
 */
export interface CommentAnchor {
  /** The passage itself. What has to still be in the page for the annotation to be found. */
  exact: string
  /** The text just before it, which is what tells apart two places the same phrase occurs. */
  prefix: string
  /** The text just after it, likewise. */
  suffix: string
  /** The id of the heading it sat under, or null above the first heading. */
  heading: string | null
  /** How far into that heading's section it started, in characters — the last tie-breaker. */
  offset: number
}

/** One annotation as the client posts it, alongside the comment it belongs to. */
export interface AnnotationInput {
  note: string
  anchor: CommentAnchor
}

/** One annotation as the API answers with it. */
export interface AnnotationEntry {
  id: string
  commentId: string
  position: number
  note: string
  anchor: CommentAnchor
  createdAt: Date
  updatedAt: Date
  /** When it was marked done, or null while it is open. */
  resolvedAt: Date | null
  resolvedById: string | null
  /** Who marked it done, while that account exists. */
  resolvedByName: string | null
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
  /**
   * Whether this is the placeholder a deleted comment leaves behind for its replies. Such an entry
   * carries nothing of what was deleted: no content, no author, no annotations.
   */
  isDeleted: boolean
  /** The passages of the article it is about, in the order they were picked. Empty for most. */
  annotations: AnnotationEntry[]
}

/**
 * How much of a comment a listing of somebody's comments carries, in characters. A row shows a line or
 * two of it, so the rest of up to `COMMENT_MAX_LENGTH` would be bytes nobody reads.
 */
export const AUTHORED_EXCERPT_LENGTH = 400

/** One comment in a listing of what one person wrote, with the page it is on. */
export interface AuthoredCommentEntry {
  id: string
  parentId: string | null
  /** The start of the markdown source, cut at `AUTHORED_EXCERPT_LENGTH` with no regard for syntax. */
  excerpt: string
  createdAt: Date
  updatedAt: Date
  /** How many passages it annotates -- what stands in for its text when it has none of its own. */
  annotationCount: number
  pageId: string
  pageTitle: string
  pagePath: string
  pageLocale: string
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
  /** The passages it is about. Only for a comment that starts a thread — see `create`. */
  annotations?: AnnotationInput[]
}

/** A comment as `insertThreads` stores it: written by somebody, at a time given rather than now. */
export interface DatedCommentInput {
  content: string
  authorId: string | null
  authorName: string
  authorEmail: string
  createdAt: Date
  updatedAt: Date
}

/** A comment that starts a thread, and the replies under it. */
export interface DatedThreadInput extends DatedCommentInput {
  replies?: DatedCommentInput[]
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
        deletedAt: commentsTable.deletedAt,
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
    const annotations = await this.annotationsFor(rows.map((row) => row.id))
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
      isGuest: row.authorId === null && !row.deletedAt,
      isDeleted: Boolean(row.deletedAt),
      annotations: annotations.get(row.id) ?? []
    }))
  }

  /**
   * The comments one person has written on a site, newest first, as one reader may see them -- what
   * the Comments tab of a public profile lists.
   *
   * A comment is listed where the reader could follow it to the page's Talk view and find it there:
   * `read:pages` to open the page, `read:comments` for its discussion, the page live or one this reader
   * may see while it is not (`unpublished`, as the page view decides it), the password satisfied where
   * the page has one (`unlocked`) -- the discussion is behind it as much as the body is -- and the page
   * still taking comments, since with that switched off it has no Talk view to land on. Placeholders of deleted comments
   * are never listed; there is nothing of the author left in one.
   *
   * Decided BEFORE paging, as `search.searchPages` does it and for the same reason: a page rule can be
   * a pattern or a set of tags, so only a row can answer it, and a batch filtered after its `LIMIT`
   * comes back short with a total still counting what the reader was refused -- which is itself
   * something about pages they may not see. The first query reads only what a rule looks at, the
   * second the full rows of the one batch returned.
   */
  async listByAuthor({
    siteId,
    authorId,
    actor,
    unpublished,
    unlocked,
    offset = 0,
    limit = 25
  }: {
    siteId: string
    authorId: string
    actor: AccessActor
    unpublished: false | ((page: RulePageRef) => boolean)
    /** Whether this reader has satisfied the password of a protected page, by its id. */
    unlocked: (pageId: string) => boolean
    offset?: number
    limit?: number
  }): Promise<{ results: AuthoredCommentEntry[]; total: number }> {
    const conditions = [
      eq(commentsTable.authorId, authorId),
      eq(pagesTable.siteId, siteId),
      isNull(commentsTable.deletedAt),
      sql`coalesce((${pagesTable.config} ->> 'allowComments')::boolean, true)`
    ]
    // -> The reader who may see no unpublished page anywhere is held to live ones here, as the search does
    if (unpublished === false) {
      conditions.push(liveCondition(pagesTable))
    }
    const candidates = await WIKI.db
      .select({
        id: commentsTable.id,
        pageId: pagesTable.id,
        path: pagesTable.path,
        locale: pagesTable.locale,
        tags: pagesTable.tags,
        isLive: sql<boolean>`${liveCondition(pagesTable)}`.mapWith(Boolean),
        isProtected: sql<boolean>`${pagesTable.password} IS NOT NULL`.mapWith(Boolean)
      })
      .from(commentsTable)
      .innerJoin(pagesTable, eq(pagesTable.id, commentsTable.pageId))
      .where(and(...conditions))
      .orderBy(desc(commentsTable.createdAt), desc(commentsTable.id))

    // -> Per page rather than per comment: a person's comments cluster on the pages they discuss
    const pageVerdicts = new Map<string, boolean>()
    const readable = candidates.filter((row) => {
      let verdict = pageVerdicts.get(row.pageId)
      if (verdict === undefined) {
        const ref = { siteId, path: row.path, locale: row.locale, tags: row.tags ?? [] }
        verdict =
          WIKI.models.groups.checkAccess(actor, 'read:pages', ref) &&
          WIKI.models.groups.checkAccess(actor, 'read:comments', ref) &&
          (row.isLive || (unpublished !== false && unpublished(ref))) &&
          (!row.isProtected || unlocked(row.pageId))
        pageVerdicts.set(row.pageId, verdict)
      }
      return verdict
    })
    const ids = readable.slice(offset, offset + limit).map((row) => row.id)
    if (ids.length < 1) {
      return { results: [], total: readable.length }
    }

    const rows = await WIKI.db
      .select({
        id: commentsTable.id,
        parentId: commentsTable.parentId,
        excerpt: sql<string>`left(${commentsTable.content}, ${AUTHORED_EXCERPT_LENGTH})`,
        createdAt: commentsTable.createdAt,
        updatedAt: commentsTable.updatedAt,
        annotationCount:
          sql<number>`(SELECT count(*) FROM ${annotationsTable} WHERE ${annotationsTable.commentId} = ${commentsTable.id})`.mapWith(
            Number
          ),
        pageId: pagesTable.id,
        pageTitle: pagesTable.title,
        pagePath: pagesTable.path,
        pageLocale: pagesTable.locale
      })
      .from(commentsTable)
      .innerJoin(pagesTable, eq(pagesTable.id, commentsTable.pageId))
      .where(inArray(commentsTable.id, ids))
    // -> Back into the order the first query settled, which `IN` does not keep
    const byId = new Map(rows.map((row) => [row.id, row]))
    return {
      results: ids.map((id) => byId.get(id)).filter((row) => row !== undefined),
      total: readable.length
    }
  }

  /**
   * The page a comment is about, as everything that guards one needs it.
   *
   * Its path, locale and tags because that is what a page rule is matched against, and
   * `allowComments` because a page can be closed to discussion from its own properties dialog
   * whatever the site has configured. Deliberately not `pages.getPage` — that assembles a page for
   * reading, and this is a few columns and a scoping check. `isLive` and `isProtected` are the
   * caller's to act on.
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
        allowComments: sql<boolean>`coalesce((${pagesTable.config} ->> 'allowComments')::boolean, true)`,
        // -> A discussion quotes its page, annotations word for word, so it is only there while the
        //    page is — see `helpers/publishing.ts`
        isLive: sql<boolean>`${liveCondition(pagesTable)}`.mapWith(Boolean),
        // -> Whether the page is behind a password, which hides its discussion as well as its body
        //    until the session has unlocked it (`unlockedFor` in `api/pages.ts`)
        isProtected: sql<boolean>`${pagesTable.password} IS NOT NULL`.mapWith(Boolean)
      })
      .from(pagesTable)
      .where(and(eq(pagesTable.id, pageId), eq(pagesTable.siteId, siteId)))
    return row ?? null
  }

  /**
   * How many comments a page has. What the Talk tab's badge counts -- so not the placeholders deleted
   * comments leave behind, which are nothing anybody said.
   */
  async countForPage(pageId: string): Promise<number> {
    const [row] = await WIKI.db
      .select({ total: count() })
      .from(commentsTable)
      .where(and(eq(commentsTable.pageId, pageId), isNull(commentsTable.deletedAt)))
    return Number(row?.total ?? 0)
  }

  /**
   * How many comments there are across every site, for the admin dashboard. Counted the way the Talk
   * tab's badge counts, so the placeholders of deleted comments are left out.
   */
  async countAll(): Promise<number> {
    return WIKI.db.$count(commentsTable, isNull(commentsTable.deletedAt))
  }

  /**
   * One comment with the page it is on, which is what every permission check on it needs.
   *
   * Carries the email and address it was posted with, which are for the server's own use — the spam
   * check and webhook payloads — and never for a reply to the client.
   */
  async getWithPage(commentId: string, siteId: string) {
    const [row] = await WIKI.db
      .select({
        id: commentsTable.id,
        parentId: commentsTable.parentId,
        content: commentsTable.content,
        authorId: commentsTable.authorId,
        authorEmail: commentsTable.authorEmail,
        authorIP: commentsTable.authorIP,
        deletedAt: commentsTable.deletedAt,
        pageId: commentsTable.pageId,
        path: pagesTable.path,
        locale: pagesTable.locale,
        tags: pagesTable.tags,
        title: pagesTable.title,
        // -> Whether the page is behind a password, which hides its discussion as well as its body
        //    until the session has unlocked it (`unlockedFor` in `api/pages.ts`)
        isProtected: sql<boolean>`${pagesTable.password} IS NOT NULL`.mapWith(Boolean),
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
   *
   * Annotations are only for a comment that starts a thread, and a reply carrying any is refused
   * rather than having them dropped: a reply answers the comment above it, and the passages it was
   * posted about would be shown nowhere.
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
    const annotations = input.annotations ?? []
    if (parentId && annotations.length > 0) {
      throw new Error('A reply cannot annotate the page. Only a comment that starts a thread can.')
    }
    // -> One transaction, so that a comment never exists without the passages it was posted about
    //    -- its text may well be empty, and the annotations are then the whole of what it says
    const row = await WIKI.db.transaction(async (tx) => {
      const [comment] = await tx
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
      if (annotations.length > 0) {
        await tx.insert(annotationsTable).values(
          annotations.map((annotation, position) => ({
            commentId: comment!.id,
            position,
            note: annotation.note.trim(),
            anchor: annotation.anchor
          }))
        )
      }
      return comment!
    })
    return this.describe(row, (await this.annotationsFor([row.id])).get(row.id))
  }

  /**
   * Store whole threads at once, each comment with the dates it is to carry.
   *
   * For the sample content's discussion and nothing else: a talk page written in one go would
   * otherwise read "just now" from top to bottom, which is not what one looks like. None of what
   * {@link create} answers to applies — there is no reply to rewrite, since a thread is given as a
   * comment and its replies, and nobody posted anything to be notified of.
   *
   * @returns How many comments were stored, replies included
   */
  async insertThreads(pageId: string, threads: DatedThreadInput[]): Promise<number> {
    let stored = 0
    for (const { replies = [], ...comment } of threads) {
      const [root] = await WIKI.db
        .insert(commentsTable)
        .values({ ...comment, pageId, parentId: null })
        .returning({ id: commentsTable.id })
      if (replies.length > 0) {
        await WIKI.db
          .insert(commentsTable)
          .values(replies.map((reply) => ({ ...reply, pageId, parentId: root!.id })))
      }
      stored += 1 + replies.length
    }
    return stored
  }

  /** Replace the text of a comment. Who may is decided by the route; this only writes. */
  async update(commentId: string, content: string): Promise<CommentEntry | null> {
    const [row] = await WIKI.db
      .update(commentsTable)
      .set({ content, updatedAt: new Date() })
      .where(eq(commentsTable.id, commentId))
      .returning()
    return row ? this.describe(row, (await this.annotationsFor([row.id])).get(row.id)) : null
  }

  /**
   * Delete a comment.
   *
   * Its replies stay unless `withReplies` asks otherwise: one that has any is kept as a placeholder
   * for them (see `discard`), and one that has none is deleted outright. With `withReplies` the
   * thread goes whole, by the foreign key's cascade -- a moderator's choice, which the route checks.
   * That is also the one way a placeholder is deleted directly: what is left under it is the thread.
   *
   * @returns Whether there was one to delete, whether it was kept as a placeholder, and how many
   *   replies went with it
   */
  async remove(
    commentId: string,
    { withReplies = false }: { withReplies?: boolean } = {}
  ): Promise<{ removed: boolean; keptForReplies: boolean; repliesDeleted: number }> {
    return WIKI.db.transaction(async (tx) => {
      if (withReplies) {
        const [replies] = await tx
          .select({ total: count() })
          .from(commentsTable)
          .where(eq(commentsTable.parentId, commentId))
        const total = Number(replies?.total ?? 0)
        if (total > 0) {
          const result = await tx.delete(commentsTable).where(eq(commentsTable.id, commentId))
          const removed = (result.rowCount ?? 0) > 0
          return { removed, keptForReplies: false, repliesDeleted: removed ? total : 0 }
        }
      }
      const outcome = await discard(tx, commentId)
      return { removed: outcome !== null, keptForReplies: outcome === 'kept', repliesDeleted: 0 }
    })
  }

  /**
   * The annotations of these comments, each comment's in the order they were picked.
   *
   * One query for a whole talk page, for the same reason the authors are joined rather than fetched:
   * the passages a comment is about are part of what the comment IS. Who resolved each one is joined
   * live, so a rename shows through, and falls away with the account.
   */
  async annotationsFor(commentIds: string[]): Promise<Map<string, AnnotationEntry[]>> {
    const byComment = new Map<string, AnnotationEntry[]>()
    if (commentIds.length < 1) {
      return byComment
    }
    const rows = await WIKI.db
      .select({
        annotation: annotationsTable,
        resolvedByName: usersTable.name
      })
      .from(annotationsTable)
      .leftJoin(usersTable, eq(usersTable.id, annotationsTable.resolvedById))
      .where(inArray(annotationsTable.commentId, commentIds))
      .orderBy(asc(annotationsTable.commentId), asc(annotationsTable.position))
    for (const { annotation, resolvedByName } of rows) {
      const list = byComment.get(annotation.commentId) ?? []
      list.push(describeAnnotation(annotation, resolvedByName))
      byComment.set(annotation.commentId, list)
    }
    return byComment
  }

  /** How many annotations a comment carries. What decides whether its own text may be empty. */
  async countAnnotations(commentId: string): Promise<number> {
    const [row] = await WIKI.db
      .select({ total: count() })
      .from(annotationsTable)
      .where(eq(annotationsTable.commentId, commentId))
    return Number(row?.total ?? 0)
  }

  /**
   * One annotation with the comment and page it belongs to, which is what every permission check on
   * it needs: the comment's author, and the page a rule is matched against.
   *
   * @returns The annotation, or null when no such annotation exists on this site
   */
  async getAnnotationWithComment(annotationId: string, siteId: string) {
    const [row] = await WIKI.db
      .select({
        id: annotationsTable.id,
        note: annotationsTable.note,
        resolvedAt: annotationsTable.resolvedAt,
        commentId: commentsTable.id,
        authorId: commentsTable.authorId,
        pageId: commentsTable.pageId,
        path: pagesTable.path,
        locale: pagesTable.locale,
        tags: pagesTable.tags,
        // -> Whether the page is behind a password, which hides its discussion as well as its body
        //    until the session has unlocked it (`unlockedFor` in `api/pages.ts`)
        isProtected: sql<boolean>`${pagesTable.password} IS NOT NULL`.mapWith(Boolean),
        title: pagesTable.title
      })
      .from(annotationsTable)
      .innerJoin(commentsTable, eq(commentsTable.id, annotationsTable.commentId))
      .innerJoin(pagesTable, eq(pagesTable.id, commentsTable.pageId))
      .where(and(eq(annotationsTable.id, annotationId), eq(pagesTable.siteId, siteId)))
    return row ?? null
  }

  /** Replace the note of an annotation. Who may is decided by the route; this only writes. */
  async updateAnnotationNote(annotationId: string, note: string): Promise<AnnotationEntry | null> {
    await WIKI.db
      .update(annotationsTable)
      .set({ note: note.trim(), updatedAt: new Date() })
      .where(eq(annotationsTable.id, annotationId))
    return this.getAnnotation(annotationId)
  }

  /**
   * Mark an annotation done, or open again.
   *
   * `updatedAt` is left alone: it says when the note was last changed, and resolving is not a change
   * to what anybody wrote — `resolvedAt` is its own record of when.
   *
   * @param resolvedById Who resolved it, or null to reopen it
   */
  async setAnnotationResolved(
    annotationId: string,
    resolved: boolean,
    resolvedById: string | null
  ): Promise<AnnotationEntry | null> {
    await WIKI.db
      .update(annotationsTable)
      .set(
        resolved
          ? { resolvedAt: new Date(), resolvedById }
          : { resolvedAt: null, resolvedById: null }
      )
      .where(eq(annotationsTable.id, annotationId))
    return this.getAnnotation(annotationId)
  }

  /**
   * Delete one annotation, and the comment with it when that was all the comment had to say.
   *
   * A comment posted as annotations alone has no text of its own (`create`), so taking its last
   * annotation leaves a card with nothing in it -- that comment is deleted too, the same way
   * `remove` deletes one: outright, or kept as a placeholder where it has replies. A comment with text
   * of its own stays, whatever is left of its annotations. One transaction, so the count of what is
   * left and the deletion it decides agree.
   *
   * @returns Whether there was one to delete, whether the comment went with it, and whether that
   *   comment was kept as a placeholder for its replies
   */
  async removeAnnotation(
    annotationId: string
  ): Promise<{ removed: boolean; commentDeleted: boolean; keptForReplies: boolean }> {
    return WIKI.db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(annotationsTable)
        .where(eq(annotationsTable.id, annotationId))
        .returning({ commentId: annotationsTable.commentId })
      if (!removed) {
        return { removed: false, commentDeleted: false, keptForReplies: false }
      }
      const [comment] = await tx
        .select({ content: commentsTable.content })
        .from(commentsTable)
        .where(eq(commentsTable.id, removed.commentId))
      const [left] = await tx
        .select({ total: count() })
        .from(annotationsTable)
        .where(eq(annotationsTable.commentId, removed.commentId))
      if (
        !comment ||
        Number(left?.total ?? 0) > 0 ||
        comment.content.trim().length >= COMMENT_MIN_LENGTH
      ) {
        return { removed: true, commentDeleted: false, keptForReplies: false }
      }
      const outcome = await discard(tx, removed.commentId)
      return { removed: true, commentDeleted: true, keptForReplies: outcome === 'kept' }
    })
  }

  /** One annotation as the API answers with it. */
  private async getAnnotation(annotationId: string): Promise<AnnotationEntry | null> {
    const [row] = await WIKI.db
      .select({ annotation: annotationsTable, resolvedByName: usersTable.name })
      .from(annotationsTable)
      .leftJoin(usersTable, eq(usersTable.id, annotationsTable.resolvedById))
      .where(eq(annotationsTable.id, annotationId))
    return row ? describeAnnotation(row.annotation, row.resolvedByName) : null
  }

  /**
   * The handles written in a comment, folded to the case the unique index compares them in.
   *
   * Only what is written — whether each one names anybody is for whoever looks them up.
   */
  mentionedHandles(content: string): string[] {
    return [
      ...new Set([...content.matchAll(MENTION_PATTERN)].map((match) => match[1]!.toLowerCase()))
    ]
  }

  /**
   * The first few lines of a comment, for a notification to quote. Markdown as typed, never HTML, with
   * its whitespace run together so that a quote is one line.
   */
  excerptOf(content: string, length = 240): string {
    const flat = content.replace(/\s+/g, ' ').trim()
    return flat.length > length ? `${flat.slice(0, length - 1).trimEnd()}…` : flat
  }

  /** Who wrote a comment, or null for a guest or a comment that has gone. */
  async authorOf(commentId: string): Promise<string | null> {
    const [row] = await WIKI.db
      .select({ authorId: commentsTable.authorId })
      .from(commentsTable)
      .where(eq(commentsTable.id, commentId))
    return row?.authorId ?? null
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
  private describe(
    row: typeof commentsTable.$inferSelect,
    annotations: AnnotationEntry[] = []
  ): CommentEntry {
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
      isGuest: row.authorId === null && !row.deletedAt,
      isDeleted: Boolean(row.deletedAt),
      annotations
    }
  }
}

/** A transaction, as `discard` is handed one. */
type Transaction = Parameters<Parameters<typeof WIKI.db.transaction>[0]>[0]

/**
 * Delete a comment, keeping its replies.
 *
 * A comment with replies is kept as a placeholder: the replies are other people's words and stay
 * where they were, so the row they hang from stays too -- emptied of everything that was deleted.
 * Its text, its author and its annotations go; `deletedAt` is what is left to say a comment was
 * there. One with no replies is deleted outright, and so is the placeholder above a reply once that
 * reply was the last one under it: there is nothing left for it to hold.
 *
 * @returns `kept` for a placeholder, `deleted` for a row that went, or null when there was none
 */
async function discard(tx: Transaction, commentId: string): Promise<'kept' | 'deleted' | null> {
  const [comment] = await tx
    .select({ parentId: commentsTable.parentId })
    .from(commentsTable)
    .where(and(eq(commentsTable.id, commentId), isNull(commentsTable.deletedAt)))
  if (!comment) {
    return null
  }
  const [replies] = await tx
    .select({ total: count() })
    .from(commentsTable)
    .where(eq(commentsTable.parentId, commentId))
  if (Number(replies?.total ?? 0) > 0) {
    await tx.delete(annotationsTable).where(eq(annotationsTable.commentId, commentId))
    await tx
      .update(commentsTable)
      .set({
        content: '',
        authorId: null,
        authorName: '',
        authorEmail: '',
        authorIP: '',
        meta: {},
        deletedAt: new Date()
      })
      .where(eq(commentsTable.id, commentId))
    return 'kept'
  }
  await tx.delete(commentsTable).where(eq(commentsTable.id, commentId))
  if (comment.parentId) {
    const [left] = await tx
      .select({ total: count() })
      .from(commentsTable)
      .where(eq(commentsTable.parentId, comment.parentId))
    if (Number(left?.total ?? 0) < 1) {
      await tx
        .delete(commentsTable)
        .where(and(eq(commentsTable.id, comment.parentId), isNotNull(commentsTable.deletedAt)))
    }
  }
  return 'deleted'
}

/** One stored annotation as the API answers with it. */
function describeAnnotation(
  row: typeof annotationsTable.$inferSelect,
  resolvedByName: string | null
): AnnotationEntry {
  return {
    id: row.id,
    commentId: row.commentId,
    position: row.position,
    note: row.note,
    anchor: row.anchor as CommentAnchor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    resolvedById: row.resolvedById,
    // -> Only while it was actually resolved by somebody who still has an account
    resolvedByName: row.resolvedAt ? resolvedByName : null
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
