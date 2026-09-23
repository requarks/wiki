import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import TurndownService from 'turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'
import { v5 as uuidv5 } from 'uuid'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import {
  comments as commentsTable,
  groups as groupsTable,
  importIdMap as importIdMapTable,
  importSessions as importSessionsTable,
  navigation as navigationTable,
  pageHistory as pageHistoryTable,
  pages as pagesTable,
  tree as treeTable,
  userGroups as userGroupsTable,
  users as usersTable
} from '../db/schema.ts'
import { CustomError, dataPathRoot } from '../helpers/common.ts'
import { GLOBAL_PERMISSIONS, PAGE_PERMISSIONS } from './groups.ts'
import type { GroupRule, GroupRuleMatch } from './groups.ts'
import type { NavigationItem } from './navigation.ts'

/**
 * Import model — reading a `.wkbackup` package into this instance.
 *
 * `dev/specs/wkbackup.md` is the format, and §12 of it is the contract for every record shape read
 * here: the exporter that writes these packages lives in the 2.x codebase (`server/core/backup.js`),
 * so nothing type-checks one against the other.
 *
 * **A record is a 2.x database row.** The exporter selects the table and writes it out, so the field
 * names are 2.x's own column names and the ids are 2.x's own integers — `localeCode` rather than
 * `locale`, `editorKey` rather than `editor`, `filename` rather than `fileName`, and an `authorId`
 * that is a number meaning nothing here. §12 is written from that exporter rather than around it.
 *
 * **The package never reaches this server as a file.** The browser holds it, walks it, and drives
 * these routes a batch at a time — which is why a session is a row rather than a variable: in an HA
 * set the next batch is answered by a different instance, and a tab that closed has to be able to say
 * where it got to.
 *
 * **Nothing here is a second write path into the database.** Every handler is a translation onto the
 * model that already owns the records it writes — `pages.adoptStoredPage`, `assets.adoptStoredFile`,
 * `tree.getFolder`, `navigation.siteNavId` — which is what makes an imported page get its history
 * entry, its storage-target copies and its queued render without any of that being reimplemented. The
 * two exceptions are `pageHistory` and `comments`, which have no adopt-shaped entry point because
 * nothing but an import ever creates one from the outside; both go through drizzle directly, and both
 * are keyed by a derived id so that replaying a batch upserts rather than duplicates.
 */

/**
 * The root every import namespace is derived under.
 *
 * A fixed constant rather than anything generated: the whole point is that the same package imported
 * into the same site derives the same record ids next week as it did today, on this instance and on
 * a rebuilt one.
 */
const IMPORT_NAMESPACE_ROOT = '4e2f8f3a-6c1d-4a5e-9b70-2c4f6d8e1a93'

/** The container version this reader understands. Anything above is refused, naming both numbers. */
const SUPPORTED_FORMAT_VERSION = 1

/** The only `manifest.source.kind` implemented. A `wikijs3` restore is a separate feature. */
const SUPPORTED_SOURCE = 'wikijs2'

/**
 * What the operator may tick, as the overlay names them.
 *
 * A stream whose content kind is not in the session's `includes` is refused rather than ignored, so a
 * browser that batches something nobody asked for is told, instead of quietly writing it.
 *
 * `settings` is the site's own settings, from `site.json` — the handful of 2.x keys that have a 3.x
 * equivalent, not the instance-wide `streams/settings.json`, which is still only reported. See
 * `#siteStream`.
 */
export const IMPORT_CONTENT_KINDS = [
  'assets',
  'pages',
  'comments',
  'history',
  'groups',
  'users',
  'navigation',
  'settings'
] as const
export type ImportContentKind = (typeof IMPORT_CONTENT_KINDS)[number]

/** Which tick each stream belongs to. `locales` and `tree` ride along with the content that needs them. */
const STREAM_REQUIRES: Record<string, ImportContentKind | null> = {
  locales: null,
  groups: 'groups',
  users: 'users',
  tree: null,
  site: 'settings',
  pages: 'pages',
  'page-history': 'history',
  assets: 'assets',
  comments: 'comments',
  navigation: 'navigation'
}

/** Streams that belong to the wiki rather than to any one site. */
const INSTANCE_STREAMS = new Set(['locales', 'groups', 'users'])

/** Streams that belong to a site, and are posted with the target site's id. */
const SITE_STREAMS = new Set([
  'tree',
  'site',
  'pages',
  'page-history',
  'assets',
  'comments',
  'navigation'
])

/** Records per batch. The browser's figure too — `dev/specs/wkbackup.md` §7. */
export const MAX_BATCH_RECORDS = 500

/**
 * How large a batch of records may be, as a request body.
 *
 * Above the instance's `bodyParserLimit` (5 MB by default) and declared per route, because that
 * setting is about what a user may POST to an ordinary API and this is an administrator streaming a
 * wiki through in pieces. It has to clear a batch of records that each carry a whole page: a page's
 * source only spills to a blob above 1 MiB (`dev/specs/wkbackup.md` §2), so one record alone can be a
 * couple of megabytes once JSON has escaped it, and a batch of 500 short ones is not the shape that
 * matters here.
 *
 * The browser aims well under this rather than at it, and halves a batch that comes back 413 — see
 * `helpers/wkbackupImport.js`. So this is the ceiling that makes a legitimate batch fit, not a figure
 * anything is tuned to.
 */
export const MAX_BATCH_BYTES = 16 * 1024 * 1024

/** A blob bigger than this is refused rather than buffered. 2 GiB is `Buffer`'s own ceiling anyway. */
export const MAX_BLOB_BYTES = 2 * 1024 * 1024 * 1024

/**
 * How long a session's staging directory survives if `finish` is never called.
 *
 * The tab that was driving it closed, and nothing else will ever come back for those bytes. Swept by
 * the same daily task that purges the audit log rather than on a timer of its own.
 */
const SESSION_MAX_AGE_HOURS = 48

/**
 * 2.x editor keys → 3.x ones.
 *
 * Only `markdown`, `asciidoc` and `redirect` mean the same thing in both. The other two are 2.x's
 * HTML editors, and they land on `markdown` rather than on 3.x's `visual`: markdown is configured
 * with `allowHTML`, so a body of HTML renders as it stood, where `visual` is a WYSIWYG over markdown
 * and would be handed a document it does not parse. Every page that takes this road is counted and
 * named in the log — it reads correctly, but nobody chose markdown for it.
 */
const EDITOR_MAP: Record<string, string> = {
  markdown: 'markdown',
  asciidoc: 'asciidoc',
  redirect: 'redirect',
  ckeditor: 'markdown',
  code: 'markdown'
}

/**
 * The 2.x editor the conversion option governs, and the only one: its WYSIWYG editor.
 *
 * Both of 2.x's HTML editors lose their counterpart in 3.x, but only one of them raises a question.
 * A `ckeditor` page was WRITTEN as formatted text and happens to be stored as HTML, so converting it
 * gives its author back the editor they had — which is what `htmlConversion` decides.
 *
 * A `code` page is the opposite: its author chose to write HTML, and the HTML is the document rather
 * than a representation of one. Converting it would throw away the thing they were editing, so it is
 * never converted whatever the option says — it becomes a markdown page holding that HTML, which
 * renders identically (markdown is configured with `allowHTML`) and is still edited as source, which
 * is how it was edited in 2.x.
 */
const V2_VISUAL_EDITOR = 'ckeditor'

/** Why a page changed editor, for the one line per kind the log gets about it. */
const EDITOR_CHANGE_NOTES: Record<string, Record<string, string>> = {
  ckeditor: {
    visual:
      'Their HTML was converted to markdown, so they open in the visual editor as they did in 2.x.',
    markdown:
      'Their HTML was kept as it was — it renders the same, since markdown is configured to allow it — but editing one shows HTML source rather than a formatting toolbar.'
  },
  code: {
    markdown:
      '3.x has no raw-HTML editor, so they became markdown pages holding that HTML — it renders the same and is still edited as source, as it was in 2.x.'
  }
}

/**
 * HTML → markdown, for a page 2.x wrote in an editor 3.x does not have.
 *
 * Turndown with the GitHub-flavoured rules (the Joplin fork, which is maintained where the original is not), and the plugin is not optional: a WYSIWYG page is mostly
 * tables, and plain Turndown has no rule for one — it would flatten a table to a run of loose text
 * and nobody would notice until they opened the page.
 *
 * Built once. The service holds only its rules, so the same instance converts every page of an
 * import rather than being rebuilt per record.
 */
let turndown: TurndownService | null = null
function htmlToMarkdown(html: string): string {
  turndown ??= new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*'
  }).use(gfm)
  return turndown.turndown(html)
}

/**
 * Which 3.x editor a page ends up in.
 *
 * Every 2.x editor but one has a single right answer. `ckeditor` is the exception, and the answer is
 * the operator's — which is the whole of what `htmlConversion` decides.
 */
function targetEditorFor(sourceEditor: string, convertHtml: boolean): string {
  if (sourceEditor === V2_VISUAL_EDITOR) {
    return convertHtml ? 'visual' : 'markdown'
  }
  return EDITOR_MAP[sourceEditor] ?? 'markdown'
}

/** 2.x page-rule match kinds that 3.x also has. `SUBTREE` and `TAGALL` are 3.x additions. */
const RULE_MATCHES = new Set<GroupRuleMatch>(['START', 'END', 'REGEX', 'TAG', 'EXACT'])

/** 2.x navigation item kinds → 3.x ones. */
const NAV_KINDS: Record<string, NavigationItem['type']> = {
  link: 'link',
  header: 'header',
  divider: 'separator'
}

/**
 * The two 2.x groups that exist here already, by their fixed 2.x ids.
 *
 * 3.x seeds an Administrators and a Guests group of its own, with rules that are not 2.x's to
 * overwrite — a guests group that came back granting what somebody's old wiki granted is not a
 * migration, it is a change of who can read the new one. So these two are mapped rather than created
 * and only their MEMBERSHIPS carry. See `dev/specs/wkbackup.md` §11.
 */
const SYSTEM_GROUP_SOURCE_IDS = { administrators: 1, guests: 2 }

/**
 * Editors whose pages have no body to render.
 *
 * A redirection is a destination and a place in the tree, and a blog is an index of other pages;
 * neither has a stored render and neither ever gets one, so telling a reader that one is "waiting to
 * be rendered" would be waiting for something that is never coming — and counting them at the end
 * would report a migration as half-finished for ever.
 */
const BODYLESS_EDITORS = new Set(['redirect', 'blog'])

/**
 * 2.x's way of giving a page an emblem: an image anywhere in the body carrying this class.
 *
 * Its stylesheet pulled such an image out of the article and pinned it to the top right of the page
 * header — `position: absolute; top: -90px; right: 1rem; height: 58px`. 3.x has a field for exactly
 * that idea (`pages.icon`, drawn beside the title by `PageHeader.vue`), so the image becomes the
 * icon and leaves the body.
 *
 * Left alone it would be worse than useless here: 3.x parses `{.align-abstopright}` too
 * (`markdown-it-attrs`) and the sanitizer keeps `class`, but nothing styles it — so the image would
 * render as an ordinary inline picture at full size, wherever in the page it happened to sit.
 */
const V2_ICON_CLASS = 'align-abstopright'

/**
 * A markdown image carrying an attribute block: `![alt](/logo.png =60x){.align-abstopright}`.
 *
 * The size suffix is `markdown-it-imsize`, which both versions use, so the URL is only the first
 * token inside the parentheses.
 */
const MD_IMAGE_WITH_ATTRS = /!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)\{([^}]*)\}/

/** The same thing written as HTML, which is what a 2.x ckeditor or code page holds. */
const HTML_IMAGE = /<img\b[^>]*>/i

/** What a page's `render` says until the render queue gets to it — `dev/specs/wkbackup.md` §8. */
const PENDING_RENDER_HTML =
  '<p class="is-pending-render">This page has been imported and is waiting to be rendered.</p>'

export interface ImportSessionSite {
  /** `manifest.sites[].id` — the package's own name for the site, `default` for a 2.x package. */
  sourceId: string
  /** The site on THIS instance it lands in. */
  siteId: string
}

export interface ImportSession {
  id: string
  namespace: string
  source: string
  sites: ImportSessionSite[]
  includes: ImportContentKind[]
  overwrite: boolean
  htmlConversion: 'markdown' | 'html'
  state: 'open' | 'finished' | 'failed'
  progress: Record<string, number>
  warnings: string[]
  actorId: string | null
  createdAt: Date
  updatedAt: Date
}

/** What one batch did. `warnings` is what the operator reads in the log. */
export interface IngestResult {
  imported: number
  skipped: number
  warnings: string[]
}

/** What the browser checked before it created a session, as `preflight` answers it. */
export interface PreflightResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

function nowish() {
  return sql`now()`
}

/** Trim, lowercase, and treat anything that is not a string as absent. */
function emailOf(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function stringOf(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/**
 * A date off a record, or undefined.
 *
 * Undefined rather than `new Date()`: a column that defaults to now is the honest answer for a record
 * that did not say, and stamping today's date on a page written in 2019 is exactly what
 * `adoptStoredPage` takes `createdAt` to avoid.
 */
function dateOf(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/**
 * Why a record was passed over, in terms somebody can act on.
 *
 * "A page record had no path or no locale" is true and useless: it does not say WHICH of the two, and
 * repeated once per record it buries everything else in the log. What is nearly always wrong is that
 * the package spells a field differently from what this reader looks for — so the message names the
 * fields that were missing and then lists the keys the record actually carried, which turns a
 * thousand identical lines into the answer.
 *
 * Identical messages are collapsed with a count before they leave `ingest`, so naming the keys costs
 * one line per batch rather than one per record.
 */
function describeSkip(what: string, missing: string[], record: any): string {
  const keys = record && typeof record === 'object' ? Object.keys(record) : []
  const carried = keys.length > 0 ? keys.slice(0, 24).join(', ') : '(nothing)'
  const article = /^[aeiou]/i.test(what) ? 'An' : 'A'
  return `${article} ${what} record was skipped: no ${missing.join(' and no ')}. The record carried: ${carried}.`
}

/**
 * One line for a whole batch of records that had nowhere to go, naming a few of them.
 *
 * The alternative is a line per record, which is what a truncated pages stream turns into: a hundred
 * and forty lines of "the history of X was skipped" that bury the one line above them saying the
 * pages stream was short. The count is the useful part and the examples are enough to recognise it.
 */
function describeOrphans(what: string, paths: string[]): string {
  const distinct = [...new Set(paths)]
  const examples = distinct.slice(0, 5).join(', ')
  const rest = distinct.length > 5 ? `, and ${distinct.length - 5} more` : ''
  return `${paths.length} ${what} skipped: no page in this wiki to attach them to (${examples}${rest}). Either the pages were not imported, or they were deleted in the source wiki, which keeps their history.`
}

/** The fields of `required` that this record does not have, for `describeSkip`. */
function missingOf(present: Record<string, unknown>): string[] {
  return Object.entries(present)
    .filter(([, value]) => !value)
    .map(([name]) => name)
}

/**
 * A 2.x locale code matched onto one of this wiki's.
 *
 * Exact first, ignoring case, since that settles every code the two versions spell the same. Failing
 * that, the language subtag alone — `pt-br` finds `pt-BR`, and `zh` finds `zh-CN` where that is the
 * only Chinese published. The shortest candidate wins a language match, so a bare language is
 * preferred over a regional variant nobody asked for.
 */
function matchLocale(code: string, available: string[]): string | null {
  const wanted = code.trim().toLowerCase()
  if (!wanted) {
    return null
  }
  const exact = available.find((entry) => entry.toLowerCase() === wanted)
  if (exact) {
    return exact
  }
  const language = wanted.split(/[-_]/)[0]
  const candidates = available.filter((entry) => entry.toLowerCase().split(/[-_]/)[0] === language)
  if (candidates.length < 1) {
    return null
  }
  return [...candidates].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
}

/** Whether an attribute block or a class list names the 2.x page-icon class. */
function namesIconClass(value: string): boolean {
  return new RegExp(`(^|[\\s.])${V2_ICON_CLASS}(\\s|$)`).test(value)
}

/**
 * Where a page-icon image actually loads from.
 *
 * The same resolution the renderer does for any image in a page (`fileSrc` in
 * `frontend/src/renderers/shared.js`): a path from the site root, or one relative to the page's own
 * folder, both of which name an uploaded file served under `/_files/`. Done here rather than left to
 * render time because `pages.icon` is not rendered — it is handed to `<w-icon>` as it stands.
 *
 * Anything carrying its own scheme is left as it is: an icon hosted elsewhere still loads, and a
 * `data:` URI is refused outright rather than stored, since the column is 255 characters.
 */
function pageIconFor(src: string, pagePath: string): string | null {
  const value = src.trim().replace(/^["']|["']$/g, '')
  if (!value || value.startsWith('data:')) {
    return null
  }
  let resolved = value
  if (!/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith('//')) {
    const folder = pagePath.split('/').slice(0, -1).join('/')
    try {
      const url = new URL(value, `http://page.invalid/${folder ? `${folder}/` : ''}`)
      resolved = `/_files/${url.pathname.replace(/^\/+/, '')}`
    } catch {
      return null
    }
  }
  const icon = `img:${resolved}`
  // -> `pages.icon` is varchar(255). A path that will not fit is dropped rather than truncated into
  //    an address that loads nothing
  return icon.length <= 255 ? icon : null
}

/**
 * Pull a 2.x page-icon image out of a page's source.
 *
 * One per page — 2.x's stylesheet pinned them all to the same spot, so a second was already
 * invisible there — and the first one wins. The match is removed from the content along with the
 * blank line it sat on, since an image promoted to the page's icon should not also appear in its
 * body.
 *
 * @returns The icon, and the content with the image taken out.
 */
function extractPageIcon(
  content: string,
  pagePath: string
): { icon: string | null; content: string } {
  const markdown = MD_IMAGE_WITH_ATTRS.exec(content)
  if (markdown && namesIconClass(markdown[2])) {
    const icon = pageIconFor(markdown[1], pagePath)
    if (icon) {
      return { icon, content: removeAt(content, markdown.index, markdown[0].length) }
    }
  }

  // -> Scanned rather than matched once: a page may hold several `<img>` and only one of them is this
  for (const tag of content.match(new RegExp(HTML_IMAGE.source, 'gi')) ?? []) {
    const classAttr = /\bclass\s*=\s*["']([^"']*)["']/i.exec(tag)
    if (!classAttr || !namesIconClass(classAttr[1])) {
      continue
    }
    const src = /\bsrc\s*=\s*["']([^"']*)["']/i.exec(tag)
    const icon = src ? pageIconFor(src[1], pagePath) : null
    if (icon) {
      return { icon, content: removeAt(content, content.indexOf(tag), tag.length) }
    }
  }

  return { icon: null, content }
}

/** Cut a span out of the source, and the now-blank line it leaves behind with it. */
function removeAt(content: string, index: number, length: number): string {
  const before = content.slice(0, index)
  const after = content.slice(index + length)
  // -> Only when the image was the whole of its line; one sitting inside a paragraph just goes
  if (/(^|\n)[^\S\n]*$/.test(before) && /^[^\S\n]*(\n|$)/.test(after)) {
    return (before.replace(/[^\S\n]*$/, '') + after.replace(/^[^\S\n]*\n?/, '')).replace(
      /\n{3,}/g,
      '\n\n'
    )
  }
  // -> Taken out of the middle of a sentence, the spaces that flanked it would otherwise both remain
  return before.replace(/[^\S\n]+$/, ' ') + after.replace(/^[^\S\n]+/, '')
}

/**
 * A 2.x icon name in Iconify's spelling.
 *
 * 2.x wrote webfont class names — `mdi-home`, `las la-cog` — and 3.x dropped both fonts, so a name
 * stored as it stood would resolve to nothing. The frontend maps the legacy spellings for data
 * written before the fonts went, but there is no reason to write new ones: this is the only moment
 * the value is in hand, so it is rewritten here. See CLAUDE.md, Icons.
 */
function normalizeIcon(value: unknown): string | undefined {
  const raw = stringOf(value).trim()
  if (!raw) {
    return undefined
  }
  if (raw.includes(':')) {
    return raw
  }
  const la = raw.match(/^la[srdb]?\s+la-(.+)$/)
  if (la) {
    return `la:${la[1]}`
  }
  const mdi = raw.match(/^mdi-(.+)$/)
  if (mdi) {
    return `mdi:${mdi[1]}`
  }
  return undefined
}

class Import {
  /**
   * Check a package before anything is written.
   *
   * Everything answerable from `manifest.json` alone, which the browser has read by the time it calls
   * this — the container version, the source kind, that every stream the manifest promises has a path
   * and a schema this reader knows, and that the site the operator picked exists here. Cheap on
   * purpose: the point is to fail an eight-gigabyte file in the first second rather than in the
   * fortieth minute.
   *
   * Errors stop the import; warnings are things it will carry on past and the operator should know
   * about.
   */
  async preflight(manifest: any, targetSiteId: string): Promise<PreflightResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!manifest || typeof manifest !== 'object') {
      return { ok: false, errors: ['The package has no readable manifest.'], warnings }
    }
    if (manifest.format !== 'wkbackup') {
      errors.push('This file is not a Wiki.js backup package.')
    }
    const formatVersion = Number(manifest.formatVersion)
    if (!Number.isInteger(formatVersion) || formatVersion < 1) {
      errors.push('The package does not say which format version it is.')
    } else if (formatVersion > SUPPORTED_FORMAT_VERSION) {
      errors.push(
        `The package is format version ${formatVersion}; this wiki reads up to ${SUPPORTED_FORMAT_VERSION}. It was made by a newer version of Wiki.js.`
      )
    }
    if (manifest.source?.kind !== SUPPORTED_SOURCE) {
      errors.push(
        `This is a ${stringOf(manifest.source?.kind, 'unknown')} package. Import from Wiki.js 2.x reads ${SUPPORTED_SOURCE} packages.`
      )
    }

    const sites = Array.isArray(manifest.sites) ? manifest.sites : []
    if (sites.length < 1) {
      errors.push('The manifest lists no sites, so there is nothing to import.')
    } else if (sites.length > 1) {
      // -> Not an error: the first site is imported and the rest are named, which is more useful than
      //    refusing a package a future multi-site exporter produced
      warnings.push(
        `The package holds ${sites.length} sites. Only the first (${stringOf(sites[0]?.title, sites[0]?.id)}) is imported.`
      )
    }

    const site = await WIKI.models.sites.getSiteById({ id: targetSiteId })
    if (!site) {
      errors.push('The site to import into does not exist.')
    }

    /*
      Every stream the manifest promises, instance-wide and site-scoped alike, held to the rules in
      `dev/specs/wkbackup.md` §3: a schema above what is known refuses that stream, a name that is not
      recognised is skipped with a warning and is never fatal.
    */
    const streamSets: Array<[string, any]> = [
      ['', manifest.streams ?? {}],
      [stringOf(sites[0]?.id, 'default'), sites[0]?.streams ?? {}]
    ]
    for (const [scope, streams] of streamSets) {
      for (const [name, declared] of Object.entries<any>(streams ?? {})) {
        const known = scope ? SITE_STREAMS.has(name) : INSTANCE_STREAMS.has(name)
        if (!known) {
          // -> `settings` is expected and is reported by the importer rather than as a surprise here
          if (name !== 'settings') {
            warnings.push(`The package carries a "${name}" stream this wiki has no reader for.`)
          }
          continue
        }
        if (!declared?.path) {
          errors.push(`The "${name}" stream does not say where it is in the package.`)
        }
        const schema = Number(declared?.schema)
        if (!Number.isInteger(schema) || schema < 1) {
          errors.push(`The "${name}" stream does not say which schema it is.`)
        } else if (schema > 1) {
          errors.push(
            `The "${name}" stream is schema ${schema}; this wiki reads up to 1. It was made by a newer version of Wiki.js.`
          )
        }
      }
    }

    for (const warning of Array.isArray(manifest.warnings) ? manifest.warnings : []) {
      warnings.push(`The export reported: ${stringOf(warning)}`)
    }

    return { ok: errors.length < 1, errors, warnings }
  }

  /** Open a session. Everything the batches need to agree about is settled here and nowhere else. */
  async createSession({
    source,
    sourceInstanceId,
    sites,
    includes,
    overwrite,
    htmlConversion,
    actorId
  }: {
    source: string
    sourceInstanceId?: string
    sites: ImportSessionSite[]
    includes: string[]
    overwrite: boolean
    htmlConversion?: string
    actorId: string | null
  }): Promise<ImportSession> {
    if (source !== SUPPORTED_SOURCE) {
      throw new CustomError(
        'importUnsupportedSource',
        `Only ${SUPPORTED_SOURCE} packages can be imported.`,
        400
      )
    }
    if (sites.length < 1) {
      throw new CustomError('importNoSites', 'No target site was given for the import.', 400)
    }
    for (const entry of sites) {
      const site = await WIKI.models.sites.getSiteById({ id: entry.siteId })
      if (!site) {
        throw new CustomError('importInvalidSite', 'The site to import into does not exist.', 400)
      }
    }
    const kinds = includes.filter((kind): kind is ImportContentKind =>
      (IMPORT_CONTENT_KINDS as readonly string[]).includes(kind)
    )
    if (kinds.length < 1) {
      throw new CustomError('importNothingSelected', 'Nothing was selected to import.', 400)
    }

    /*
      What the derived ids of this import hang off, and it is deliberately not random.

      An import that fell over — a dropped connection, a tab closed, a package that turned out to be
      missing a blob — is re-run from the top, because there is no resume button and replaying is
      supposed to be free. It is only free if the second run derives the ids the first one did, and
      that means the namespace has to be a function of what is being imported and where, rather than
      of when somebody pressed the button. Pages, users, groups and assets are matched on their
      natural keys and never cared; comments and page history have no natural key, so without this
      the second run is a second copy of every one of them.

      The source instance is in the key so that two different 2.x wikis imported into the same site do
      not have their comment #5 derive the same id, and the target site is in it so that importing the
      same package into two sites puts two separate copies side by side rather than one shared row.
    */
    const namespace = uuidv5(
      [
        source,
        sourceInstanceId ?? '',
        ...sites.map((entry) => `${entry.sourceId}>${entry.siteId}`).sort()
      ].join('|'),
      IMPORT_NAMESPACE_ROOT
    )

    const rows = await WIKI.db
      .insert(importSessionsTable)
      .values({
        source,
        namespace,
        sites,
        includes: kinds,
        overwrite,
        // -> Anything but the explicit opt-out converts, which is the recommended answer and the one
        //    that leaves a wiki its authors can still edit
        htmlConversion: htmlConversion === 'html' ? 'html' : 'markdown',
        actorId
      })
      .returning()
    return rows[0] as unknown as ImportSession
  }

  async getSession(id: string): Promise<ImportSession | null> {
    const rows = await WIKI.db
      .select()
      .from(importSessionsTable)
      .where(eq(importSessionsTable.id, id))
      .limit(1)
    return (rows[0] as unknown as ImportSession) ?? null
  }

  /** The session, or a 404 — every route below starts here. */
  async requireOpenSession(id: string): Promise<ImportSession> {
    const session = await this.getSession(id)
    if (!session) {
      throw new CustomError('importNoSession', 'No such import session.', 404)
    }
    if (session.state !== 'open') {
      throw new CustomError('importSessionClosed', 'This import session is already finished.', 409)
    }
    return session
  }

  /** Where a session's uploaded blobs wait for the metadata that references them. */
  stagingDir(sessionId: string): string {
    return path.join(dataPathRoot(), 'cache', 'import', sessionId)
  }

  /**
   * Take one blob.
   *
   * The name IS the checksum, so it is verified rather than trusted: that is the whole of what
   * content addressing establishes, and a reader that skipped the check would be taking the
   * uploader's word for the one thing the scheme exists to prove.
   */
  async putBlob(sessionId: string, digest: string, data: Buffer): Promise<{ bytes: number }> {
    if (!/^[0-9a-f]{64}$/.test(digest)) {
      throw new CustomError('importBadBlobName', 'A blob is named by its SHA-256 digest.', 400)
    }
    if (data.length > MAX_BLOB_BYTES) {
      throw new CustomError('importBlobTooLarge', 'That file is too large to import.', 413)
    }
    const actual = crypto.createHash('sha256').update(data).digest('hex')
    if (actual !== digest) {
      throw new CustomError(
        'importBlobChecksum',
        'The uploaded file does not match the digest it was sent under.',
        400
      )
    }
    const dir = this.stagingDir(sessionId)
    await fs.mkdir(dir, { recursive: true })
    // -> Written beside and renamed, so a request that died halfway leaves nothing a later batch
    //    would read as a complete file
    const target = path.join(dir, digest)
    const temp = `${target}.part`
    await fs.writeFile(temp, data)
    await fs.rename(temp, target)
    return { bytes: data.length }
  }

  /** The staged bytes of a blob, or null when nothing uploaded it. */
  async #readBlob(sessionId: string, digest: string): Promise<Buffer | null> {
    if (!/^[0-9a-f]{64}$/.test(digest)) {
      return null
    }
    try {
      return await fs.readFile(path.join(this.stagingDir(sessionId), digest))
    } catch {
      return null
    }
  }

  /**
   * A stable id for a record that has no natural key here.
   *
   * `uuidv5` over the session's own namespace, so the same record derives the same id on a replay —
   * which is what makes a batch safe to retry — while two sessions importing two different packages
   * cannot collide. See `dev/specs/wkbackup.md` §4.
   */
  #derive(session: ImportSession, site: string, entity: string, sourceId: unknown): string {
    return uuidv5(`${site}:${entity}:${String(sourceId)}`, session.namespace)
  }

  /**
   * Record what a source row became here.
   *
   * The package speaks 2.x's integer ids and this wiki matches on natural keys — a user by email, a
   * page by path — so the two have to be joined up for the records that reference each other by id: a
   * page's author, a comment's page, a user's groups. Written as the owning stream runs, read by the
   * streams that come after it.
   */
  async #remember(
    sessionId: string,
    entity: string,
    pairs: Array<{ sourceId: unknown; targetId: string }>
  ): Promise<void> {
    const rows = pairs
      .filter((pair) => pair.sourceId !== undefined && pair.sourceId !== null)
      .map((pair) => ({
        sessionId,
        entity,
        sourceId: String(pair.sourceId),
        targetId: pair.targetId
      }))
    if (rows.length < 1) {
      return
    }
    await WIKI.db
      .insert(importIdMapTable)
      .values(rows)
      .onConflictDoUpdate({
        target: [importIdMapTable.sessionId, importIdMapTable.entity, importIdMapTable.sourceId],
        set: { targetId: sql`excluded."targetId"` }
      })
  }

  /**
   * Look several source ids up at once.
   *
   * Per batch rather than per record: a batch of 500 comments names at most 500 pages and usually far
   * fewer, and one indexed read answers all of them.
   */
  async #resolveIds(
    sessionId: string,
    entity: string,
    sourceIds: unknown[]
  ): Promise<Map<string, string>> {
    const keys = [...new Set(sourceIds.filter((id) => id !== undefined && id !== null).map(String))]
    if (keys.length < 1) {
      return new Map()
    }
    const rows = await WIKI.db
      .select({ sourceId: importIdMapTable.sourceId, targetId: importIdMapTable.targetId })
      .from(importIdMapTable)
      .where(
        and(
          eq(importIdMapTable.sessionId, sessionId),
          eq(importIdMapTable.entity, entity),
          inArray(importIdMapTable.sourceId, keys)
        )
      )
    return new Map(rows.map((row) => [row.sourceId, row.targetId]))
  }

  /** The locale a site files content under when the package does not say — 2.x assets have none. */
  #primaryLocaleOf(siteId: string): string {
    return WIKI.sites?.[siteId]?.config?.locales?.primary ?? 'en'
  }

  /** Merge a patch into the session row. Read back, so the caller sees what it wrote. */
  async #patch(id: string, patch: Record<string, any>): Promise<void> {
    await WIKI.db
      .update(importSessionsTable)
      .set({ ...patch, updatedAt: nowish() })
      .where(eq(importSessionsTable.id, id))
  }

  /**
   * Collapse identical warnings into one line carrying a count.
   *
   * A batch is up to 500 records and they nearly always go wrong the same way — a field the package
   * spells differently, a page none of them can find. Repeating the line once per record buries every
   * other warning in the log and tells the reader nothing the first one did not.
   */
  #collapse(warnings: string[]): string[] {
    const counts = new Map<string, number>()
    for (const warning of warnings) {
      counts.set(warning, (counts.get(warning) ?? 0) + 1)
    }
    return [...counts].map(([warning, count]) => (count > 1 ? `${warning} (x${count})` : warning))
  }

  /** Count a batch against the session, and keep whatever it could not carry. */
  async #record(
    session: ImportSession,
    stream: string,
    result: IngestResult
  ): Promise<IngestResult> {
    result = { ...result, warnings: this.#collapse(result.warnings) }
    const progress = {
      ...session.progress,
      [stream]: (session.progress[stream] ?? 0) + result.imported
    }
    /*
      Warnings are capped. A package whose every one of ninety thousand pages is on a dead editor
      would otherwise put ninety thousand strings in a jsonb column and in the log panel's DOM; the
      count still tells the truth, and the first two hundred say what the problem is.
    */
    const warnings = [...session.warnings, ...result.warnings].slice(0, 200)
    await this.#patch(session.id, { progress, warnings })
    return result
  }

  /**
   * Write one batch of records.
   *
   * The dispatch is flat on purpose: each handler knows only its own stream, so streams can be run in
   * any order that satisfies the references between them, and a failed batch can be retried on its
   * own. What order that is, is the browser's business — `dev/specs/wkbackup.md` §11 has it.
   */
  async ingest({
    sessionId,
    stream,
    siteId,
    records
  }: {
    sessionId: string
    stream: string
    siteId?: string
    records: any[]
  }): Promise<IngestResult> {
    const session = await this.requireOpenSession(sessionId)

    if (!(stream in STREAM_REQUIRES)) {
      throw new CustomError('importUnknownStream', `This wiki has no reader for "${stream}".`, 400)
    }
    const requires = STREAM_REQUIRES[stream]
    if (requires && !session.includes.includes(requires)) {
      throw new CustomError(
        'importStreamNotSelected',
        `"${requires}" was not selected for this import.`,
        400
      )
    }
    if (records.length > MAX_BATCH_RECORDS) {
      throw new CustomError(
        'importBatchTooLarge',
        `At most ${MAX_BATCH_RECORDS} records per request.`,
        400
      )
    }

    if (SITE_STREAMS.has(stream)) {
      const target = session.sites.find((entry) => entry.siteId === siteId)
      if (!target) {
        throw new CustomError(
          'importUnmappedSite',
          'That site is not one this import session was opened for.',
          400
        )
      }
      return this.#record(
        session,
        stream,
        await this.#ingestSiteStream(session, stream, target, records)
      )
    }
    return this.#record(session, stream, await this.#ingestInstanceStream(session, stream, records))
  }

  async #ingestInstanceStream(
    session: ImportSession,
    stream: string,
    records: any[]
  ): Promise<IngestResult> {
    switch (stream) {
      case 'locales':
        return this.#localesStream(session, records)
      case 'groups':
        return this.#groupsStream(session, records)
      case 'users':
        return this.#usersStream(session, records)
      default:
        throw new CustomError(
          'importUnknownStream',
          `This wiki has no reader for "${stream}".`,
          400
        )
    }
  }

  async #ingestSiteStream(
    session: ImportSession,
    stream: string,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    switch (stream) {
      case 'tree':
        return this.#treeStream(target, records)
      case 'site':
        return this.#siteStream(target, records)
      case 'pages':
        return this.#pagesStream(session, target, records)
      case 'page-history':
        return this.#pageHistoryStream(session, target, records)
      case 'assets':
        return this.#assetsStream(session, target, records)
      case 'comments':
        return this.#commentsStream(session, target, records)
      case 'navigation':
        return this.#navigationStream(session, target, records)
      default:
        throw new CustomError(
          'importUnknownStream',
          `This wiki has no reader for "${stream}".`,
          400
        )
    }
  }

  // ==============================================================================================
  // INSTANCE-WIDE STREAMS
  // ==============================================================================================

  /**
   * Locales — reported, never installed.
   *
   * Installing one is a download from a third party, and doing it unasked in the middle of somebody's
   * migration is not this feature's business. What matters is that the operator learns their pages
   * are arriving in a locale this wiki has no strings for, while there is still time to add it.
   */
  async #localesStream(session: ImportSession, records: any[]): Promise<IngestResult> {
    const installed = new Set(
      (await WIKI.models.locales.getInstalledLocales()).map((locale: any) => locale.code)
    )
    /*
      Whether anything is worth saying about a locale that is missing.

      The settings stream installs the ones the site actually uses, matching 2.x's codes onto this
      wiki's as it goes — and it runs minutes before this log is read. Warning here as well said a
      locale was missing and named a screen to go and fix it by hand, for locales the import then
      installed by itself two steps later. So the warning belongs to the case where nothing is going
      to install them: Settings left unticked.
    */
    const settingsWillInstall = session.includes.includes('settings')
    const warnings: string[] = []
    let imported = 0
    for (const record of records) {
      const code = stringOf(record?.code).trim()
      if (!code) {
        continue
      }
      if (installed.has(code)) {
        imported++
        continue
      }
      /*
        And only for a locale the source wiki was actually SERVING. 2.x's table carries a row for
        every locale it knows of, active or not, so most of what arrives here is a locale nobody ever
        wrote a page in. `isActive` is the exporter's flag; a package written without it is treated as
        active, which errs towards saying too much rather than too little.
      */
      if (!settingsWillInstall && record?.isActive !== false) {
        warnings.push(
          `The package uses the locale "${code}", which is not installed here. Its content is imported either way; install it under Administration → Locale, or tick Settings to have the import do it.`
        )
      }
    }
    return { imported, skipped: records.length - imported, warnings }
  }

  /**
   * Groups.
   *
   * Matched by name, because that is what a group IS to whoever runs the wiki — a 2.x row id means
   * nothing here, and an administrator who has already made an "Editors" group wants the import to
   * land in it rather than beside it.
   *
   * Every group is remembered whether it was created, adopted or mapped onto one of 3.x's own, since
   * the users and navigation streams resolve their references by 2.x group id and cannot tell the
   * three apart.
   */
  async #groupsStream(session: ImportSession, records: any[]): Promise<IngestResult> {
    const warnings: string[] = []
    let imported = 0
    let skipped = 0

    const mapped: Array<{ sourceId: unknown; targetId: string }> = []
    const systemGroupIds = await WIKI.models.groups.systemGroupIds()
    const targetSiteIds = session.sites.map((entry) => entry.siteId)

    for (const record of records) {
      const sourceId = record?.id
      const name = stringOf(record?.name).trim()
      if (sourceId === undefined || sourceId === null || !name) {
        warnings.push('A group record had no id or no name and was skipped.')
        skipped++
        continue
      }

      // -> The two 3.x already has. Mapped rather than written; see SYSTEM_GROUP_SOURCE_IDS
      if (record?.isSystem === true) {
        if (Number(sourceId) === SYSTEM_GROUP_SOURCE_IDS.administrators && systemGroupIds[0]) {
          mapped.push({ sourceId, targetId: systemGroupIds[0] })
        } else if (Number(sourceId) === SYSTEM_GROUP_SOURCE_IDS.guests) {
          mapped.push({ sourceId, targetId: WIKI.data.systemIds.guestsGroupId })
        } else {
          warnings.push(`The system group "${name}" has no equivalent here and was skipped.`)
        }
        skipped++
        continue
      }

      const { permissions, dropped: droppedPermissions } = this.#translatePermissions(
        record?.permissions
      )
      const {
        rules,
        dropped: droppedRoles,
        droppedRules
      } = this.#translateRules(record?.pageRules, targetSiteIds)
      for (const permission of new Set([...droppedPermissions, ...droppedRoles])) {
        warnings.push(
          `"${permission}" has no meaning in Wiki.js 3.x and was dropped from group "${name}".`
        )
      }
      for (const kind of new Set(droppedRules)) {
        warnings.push(
          `A rule on "${name}" matched pages by "${kind}", which Wiki.js 3.x has no equivalent for, and was dropped.`
        )
      }

      const existing = await WIKI.db
        .select({ id: groupsTable.id, isSystem: groupsTable.isSystem })
        .from(groupsTable)
        .where(eq(groupsTable.name, name))
        .limit(1)

      if (existing[0]) {
        mapped.push({ sourceId, targetId: existing[0].id })
        if (existing[0].isSystem) {
          warnings.push(`"${name}" is a system group here and was not changed.`)
          skipped++
        } else if (session.overwrite) {
          await WIKI.db
            .update(groupsTable)
            .set({ permissions, rules, updatedAt: nowish() })
            .where(eq(groupsTable.id, existing[0].id))
          imported++
        } else {
          warnings.push(`A group named "${name}" already exists. Its members are still imported.`)
          skipped++
        }
        continue
      }

      const id = this.#derive(session, '', 'group', sourceId)
      await WIKI.db
        .insert(groupsTable)
        .values({
          id,
          name,
          permissions,
          rules,
          redirectOnLogin: stringOf(record?.redirectOnLogin),
          isSystem: false
        })
        .onConflictDoUpdate({ target: groupsTable.id, set: { name, permissions, rules } })
      mapped.push({ sourceId, targetId: id })
      imported++
    }

    await this.#remember(session.id, 'group', mapped)
    // -> The rules cache is what `checkAccess` reads, so it has to be told once per batch rather than
    //    once per group
    await WIKI.models.groups.reloadCache()
    return { imported, skipped, warnings }
  }

  /**
   * 2.x global permissions, filtered to the ones 3.x has. Never translated — see the spec, §6.
   *
   * 2.x kept one list where 3.x keeps two, so a group's `permissions` carries page permissions
   * alongside global ones. Those are dropped from this list in silence rather than reported: they are
   * not meaningless names, they are names that live in `rules` here, and the same record's
   * `pageRules` is where they arrive. `manage:navigation` is the one that most obviously moved.
   *
   * What IS reported is a name in neither vocabulary — `manage:api`, which 3.x has no equivalent for
   * at all, and anything a 2.x installation invented.
   */
  #translatePermissions(value: unknown): { permissions: string[]; dropped: string[] } {
    const global = new Set<string>(GLOBAL_PERMISSIONS as readonly string[])
    const page = new Set(PAGE_PERMISSIONS)
    const permissions: string[] = []
    const dropped: string[] = []
    for (const entry of Array.isArray(value) ? value : []) {
      const name = stringOf(entry)
      if (global.has(name)) {
        permissions.push(name)
      } else if (name && !page.has(name)) {
        dropped.push(name)
      }
    }
    return { permissions: [...new Set(permissions)], dropped: [...new Set(dropped)] }
  }

  /**
   * 2.x page rules → 3.x ones.
   *
   * Every rule is scoped to the sites being imported into. A 2.x wiki had exactly one site, so its
   * rules were written with no notion of scope at all; carried across unscoped they would speak for
   * every site on this instance, which is a rule nobody wrote.
   */
  #translateRules(
    value: unknown,
    siteIds: string[]
  ): { rules: GroupRule[]; dropped: string[]; droppedRules: string[] } {
    const known = new Set(PAGE_PERMISSIONS)
    const rules: GroupRule[] = []
    const dropped: string[] = []
    const droppedRules: string[] = []
    for (const entry of Array.isArray(value) ? value : []) {
      const match = stringOf(entry?.match).toUpperCase() as GroupRuleMatch
      if (!RULE_MATCHES.has(match)) {
        droppedRules.push(stringOf(entry?.match, '(none)'))
        continue
      }
      const roles: string[] = []
      for (const role of Array.isArray(entry?.roles) ? entry.roles : []) {
        const name = stringOf(role)
        if (known.has(name)) {
          roles.push(name)
        } else if (name) {
          dropped.push(name)
        }
      }
      if (roles.length < 1) {
        continue
      }
      rules.push({
        id: uuidv5(`rule:${stringOf(entry?.id)}`, WIKI.data.systemIds.localAuthId),
        name: stringOf(entry?.name, 'Imported Rule'),
        roles: [...new Set(roles)],
        match,
        // -> 2.x has no FORCEALLOW; `deny` is the whole of what it could say
        mode: entry?.deny === true ? 'DENY' : 'ALLOW',
        path: stringOf(entry?.path),
        tags: (Array.isArray(entry?.tags) ? entry.tags : []).map((tag: unknown) => stringOf(tag)),
        locales: (Array.isArray(entry?.locales) ? entry.locales : []).map((code: unknown) =>
          stringOf(code)
        ),
        sites: [...siteIds]
      })
    }
    return { rules, dropped: [...new Set(dropped)], droppedRules }
  }

  /**
   * Users, matched on the email address and nothing else.
   *
   * Not the display name, which is not unique and which people change; not the 2.x row id, which
   * means nothing here. An address that already has an account IS that person, so an import fills in
   * what that account is missing rather than making a second one beside it.
   *
   * **The account running the import is never written to**, whatever `overwrite` says. It is in
   * practice the root administrator, it is the session the rest of the import is authenticated by,
   * and the package's copy of that address may carry a different password hash, a different 2FA
   * secret or `isActive: false`. Overwriting it is how an operator locks themselves out of the
   * instance they are migrating into, thousands of records from the end.
   */
  async #usersStream(session: ImportSession, records: any[]): Promise<IngestResult> {
    const warnings: string[] = []
    let imported = 0
    let skipped = 0

    const actorEmail = session.actorId
      ? emailOf((await WIKI.models.users.getById(session.actorId))?.email)
      : ''
    const localAuthId = WIKI.data.systemIds.localAuthId

    for (const record of records) {
      const email = emailOf(record?.email)
      if (!email) {
        warnings.push('A user record had no email address and was skipped.')
        skipped++
        continue
      }
      if (record?.isSystem === true) {
        // -> 3.x seeds its own guest account; 2.x's is not a person and has nothing to carry
        skipped++
        continue
      }
      if (email === actorEmail) {
        warnings.push(
          `"${email}" is the account running this import and was left exactly as it is, including its password and 2FA.`
        )
        /*
          Left untouched, but still remembered. This account is usually the old wiki's administrator
          and therefore the author of a good deal of it; without the mapping every page they wrote
          would fall through to "whoever ran the import", which is only the same person by luck.
        */
        if (session.actorId) {
          await this.#remember(session.id, 'user', [
            { sourceId: record?.id, targetId: session.actorId }
          ])
        }
        skipped++
        continue
      }

      const groupIds = await this.#resolveGroups(session, record?.groups, warnings, email)
      const isLocal = stringOf(record?.providerKey, 'local') === 'local'
      if (!isLocal) {
        warnings.push(
          `"${email}" signed in through "${stringOf(record?.providerKey)}" in 2.x. The account is imported without a password; configure that strategy under Administration → Authentication.`
        )
      }

      /*
        The password hash and the TOTP secret carry across verbatim — same bcryptjs at cost 12, same
        RFC 6238 secret — so nobody resets a password or re-enrols an authenticator. See
        `dev/specs/wkbackup.md` §10 item 2. Written here rather than through `users.createUser`
        because that one hashes what it is given, and what is in hand is already a hash.
      */
      const auth = isLocal
        ? {
            [localAuthId]: {
              password: stringOf(record?.password),
              mustChangePwd: record?.mustChangePwd === true,
              restrictLogin: false,
              tfaIsActive: record?.tfaIsActive === true,
              tfaRequired: false,
              tfaSecret: stringOf(record?.tfaSecret)
            }
          }
        : {}
      const meta = {
        jobTitle: stringOf(record?.jobTitle),
        location: stringOf(record?.location),
        timezone: stringOf(record?.timezone)
      }
      const name = stringOf(record?.name, email)

      const existing = await WIKI.db
        .select({ id: usersTable.id, isSystem: usersTable.isSystem })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1)

      let userId: string
      if (existing[0]) {
        userId = existing[0].id
        if (existing[0].isSystem) {
          warnings.push(`"${email}" is a system account here and was not changed.`)
          skipped++
          continue
        }
        if (!session.overwrite) {
          warnings.push(`"${email}" already has an account here and was left alone.`)
          // -> Still the account that 2.x user id means, so anything they authored is still theirs
          await this.#remember(session.id, 'user', [{ sourceId: record?.id, targetId: userId }])
          skipped++
          continue
        }
        await WIKI.db
          .update(usersTable)
          .set({
            name,
            auth,
            meta,
            prefs: { locale: stringOf(record?.localeCode) },
            isActive: record?.isActive !== false,
            isVerified: record?.isVerified !== false,
            updatedAt: nowish()
          })
          .where(eq(usersTable.id, userId))
      } else {
        userId = this.#derive(session, '', 'user', record?.id ?? email)
        await WIKI.db
          .insert(usersTable)
          .values({
            id: userId,
            email,
            name,
            auth,
            meta,
            prefs: { locale: stringOf(record?.localeCode) },
            isActive: record?.isActive !== false,
            isVerified: record?.isVerified !== false,
            isSystem: false,
            createdAt: dateOf(record?.createdAt),
            updatedAt: dateOf(record?.updatedAt)
          })
          .onConflictDoNothing({ target: usersTable.id })
      }

      if (groupIds.length > 0) {
        await WIKI.db
          .insert(userGroupsTable)
          .values(groupIds.map((groupId) => ({ userId, groupId })))
          .onConflictDoNothing()
      }
      // -> Remembered whether created or matched: the pages, history, assets and comments that follow
      //    name their author by the 2.x user id, and an account that was already here is still the
      //    answer to it
      await this.#remember(session.id, 'user', [{ sourceId: record?.id, targetId: userId }])
      imported++
    }

    return { imported, skipped, warnings }
  }

  /** A record's 2.x group ids, through the session's map. Unmapped ones are named once per user. */
  async #resolveGroups(
    session: ImportSession,
    value: unknown,
    warnings: string[],
    subject: string
  ): Promise<string[]> {
    const sourceIds = Array.isArray(value) ? value : []
    const map = await this.#resolveIds(session.id, 'group', sourceIds)
    const ids: string[] = []
    for (const entry of sourceIds) {
      const mapped = map.get(String(entry))
      if (mapped) {
        ids.push(mapped)
      } else {
        warnings.push(
          `"${subject}" belonged to a 2.x group that was not imported; that membership was dropped.`
        )
      }
    }
    return [...new Set(ids)]
  }

  // ==============================================================================================
  // SITE STREAMS
  // ==============================================================================================

  /**
   * Folders.
   *
   * Pages and assets create the folders they need on their way in, so this stream exists for the two
   * things they cannot supply: the title somebody gave a folder, and a folder with nothing in it.
   */
  async #treeStream(target: ImportSessionSite, records: any[]): Promise<IngestResult> {
    const warnings: string[] = []
    let imported = 0
    let skipped = 0

    for (const record of records) {
      const folderPath = stringOf(record?.path)
        .trim()
        .replace(/^\/+|\/+$/g, '')
      const locale = stringOf(record?.localeCode).trim()
      if (!folderPath || !locale) {
        warnings.push(
          describeSkip('folder', missingOf({ path: folderPath, localeCode: locale }), record)
        )
        skipped++
        continue
      }
      try {
        const folder = await WIKI.models.tree.getFolder({
          path: folderPath,
          locale,
          siteId: target.siteId,
          createIfMissing: true
        })
        const title = stringOf(record?.title).trim()
        if (title && title !== folder.title) {
          await WIKI.db
            .update(treeTable)
            .set({ title, updatedAt: nowish() })
            .where(eq(treeTable.id, folder.id))
        }
        imported++
      } catch (err: any) {
        warnings.push(`The folder "${folderPath}" could not be created: ${err.message}`)
        skipped++
      }
    }
    return { imported, skipped, warnings }
  }

  /**
   * The locales a 2.x site was running, matched onto this wiki's codes and installed.
   *
   * **The codes are not the same vocabulary.** 2.x lowercases everything and carries a mixture of
   * bare languages and language-region pairs (`en`, `fr`, `zh`, `pt-br`); 3.x uses BCP-47 as it is
   * published upstream, where the region is capitalised (`pt-BR`, `zh-CN`). So an exact match is
   * tried first, case-insensitively, and failing that the two are compared on their language alone —
   * which is what turns 2.x's `pt-br` into `pt-BR`, and its bare `zh` into whichever Chinese this
   * wiki publishes.
   *
   * A language match prefers the shortest candidate, so a bare `pt` wins over `pt-BR` when both
   * exist: picking a region for somebody who never chose one is a guess, where falling back to the
   * language is the same thing they had.
   *
   * Installing pulls the strings from upstream, so it needs the network and is skipped entirely on an
   * `offline` instance. None of it is allowed to fail the import: a locale that cannot be fetched is
   * reported and left out of the active list, because a site set to a language whose strings are not
   * here reads as a half-translated wiki.
   */
  async #importLocales(
    source: any,
    warnings: string[]
  ): Promise<{ primary: string; active: string[] } | null> {
    const wanted = [
      ...new Set(
        [
          ...(Array.isArray(source?.active) ? source.active : []),
          ...(source?.primary ? [source.primary] : [])
        ]
          .map((code: unknown) => stringOf(code).trim())
          .filter(Boolean)
      )
    ]
    if (wanted.length < 1) {
      return null
    }

    const installed = (await WIKI.models.locales.getLocales({ cache: false }))
      .filter((locale: any) => locale.isInstalled)
      .map((locale: any) => locale.code as string)

    /*
      What this wiki could have, which is what the codes are matched against: everything published
      upstream plus whatever is already here. Fetched once for the whole batch rather than per locale,
      and its failure is not fatal — an instance with no route to the internet can still match what it
      already holds.
    */
    let available = [...installed]
    if (WIKI.config.offline) {
      warnings.push(
        'This instance is offline, so no locale could be downloaded. Only the ones already installed were matched.'
      )
    } else {
      try {
        const remote = await WIKI.models.locales.fetchRemoteMetadata()
        // -> A published locale is named by its FILE and carries no code of its own, which is how
        //    `locales.install` reads it too — the two have to agree or nothing installs
        available = [
          ...new Set([
            ...installed,
            ...remote.map((entry) => path.basename(entry.file, '.json')).filter(Boolean)
          ])
        ]
      } catch (err: any) {
        warnings.push(`The list of available locales could not be fetched: ${err.message}`)
      }
    }

    const resolved: string[] = []
    for (const code of wanted) {
      const match = matchLocale(code, available)
      if (!match) {
        warnings.push(`The locale "${code}" has no equivalent in Wiki.js 3.x and was left out.`)
        continue
      }
      if (match.toLowerCase() !== code.toLowerCase()) {
        warnings.push(`The 2.x locale "${code}" was matched to "${match}".`)
      }
      if (!installed.includes(match)) {
        try {
          await WIKI.models.locales.install(match)
          installed.push(match)
          warnings.push(`Installed the locale "${match}".`)
        } catch (err: any) {
          warnings.push(`The locale "${match}" could not be installed: ${err.message}`)
          continue
        }
      }
      resolved.push(match)
    }

    if (resolved.length < 1) {
      return null
    }
    const primary = source?.primary ? matchLocale(stringOf(source.primary), resolved) : null
    return {
      // -> The site has to be readable in its primary locale, so one that did not survive the matching
      //    falls back to whatever did rather than leaving the site pointed at nothing
      primary: primary ?? resolved[0],
      active: [...new Set(resolved)]
    }
  }

  /**
   * The site's own settings, from `site.json`.
   *
   * Only the keys that mean the same thing in both versions, listed out one by one rather than merged
   * wholesale: 2.x's config is a flat bag of a hundred settings whose names mostly do not survive the
   * move, and copying what happened to match would write nonsense into a site's configuration the
   * first time 2.x reused a name for something else. Everything not named here is left as this site
   * has it — which for a site created moments ago is 3.x's own defaults.
   *
   * Deliberately NOT imported: the hostname, which is this instance's to decide; `logoUrl`, since 3.x
   * keeps a site's logo as an uploaded asset rather than a URL; and 2.x's `security`, `uploads` and
   * `editShortcuts`, which have no 3.x counterpart worth guessing at. The instance-wide
   * `streams/settings.json` — mail, authentication strategies, storage — is a separate job and is
   * still only reported.
   */
  async #siteStream(target: ImportSessionSite, records: any[]): Promise<IngestResult> {
    const warnings: string[] = []
    const site = records[0]
    if (!site || typeof site !== 'object') {
      return { imported: 0, skipped: records.length, warnings }
    }

    const config: Record<string, any> = {}
    const theme: Record<string, any> = {}
    const features: Record<string, any> = {}

    /** Copy a value across only when the package actually carries one. */
    const carry = (target_: Record<string, any>, key: string, value: unknown) => {
      if (value !== undefined && value !== null) {
        target_[key] = value
      }
    }

    carry(config, 'title', typeof site.title === 'string' ? site.title : undefined)
    carry(config, 'company', typeof site.company === 'string' ? site.company : undefined)
    carry(
      config,
      'contentLicense',
      typeof site.contentLicense === 'string' ? site.contentLicense : undefined
    )
    // -> Renamed rather than remapped: the same field, called something else here
    carry(
      config,
      'footerExtra',
      typeof site.footerOverride === 'string' ? site.footerOverride : undefined
    )
    // -> 2.x writes an array; a comma string is accepted too, since the column is a text array either way
    const extensions = Array.isArray(site.pageExtensions)
      ? site.pageExtensions
      : typeof site.pageExtensions === 'string'
        ? site.pageExtensions.split(',')
        : null
    if (extensions) {
      const cleaned = extensions
        .map((ext: unknown) => stringOf(ext).trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean)
      if (cleaned.length > 0) {
        config.pageExtensions = [...new Set(cleaned)]
      }
    }

    // -> 2.x keeps the page description under `seo`; 3.x keeps it beside the title, where the rest of
    //    what describes a site lives
    carry(
      config,
      'description',
      typeof site.seo?.description === 'string' ? site.seo.description : undefined
    )
    /*
      2.x's meta robots is a list of the directives it emits — `['index', 'follow']` — where 3.x asks
      the two questions separately. A directive and its negation can both be absent, which is 2.x
      emitting nothing and means the default rather than false, so each is read as "not denied".
    */
    if (Array.isArray(site.seo?.robots)) {
      const directives = site.seo.robots.map((d: unknown) => stringOf(d).trim().toLowerCase())
      config.robots = {
        index: !directives.includes('noindex'),
        follow: !directives.includes('nofollow')
      }
    }

    carry(
      theme,
      'dark',
      typeof site.theme?.darkMode === 'boolean' ? site.theme.darkMode : undefined
    )
    for (const key of ['injectCSS', 'injectHead', 'injectBody']) {
      carry(theme, key, typeof site.theme?.[key] === 'string' ? site.theme[key] : undefined)
    }
    if (Object.keys(theme).length > 0) {
      config.theme = theme
    }

    carry(
      features,
      'comments',
      typeof site.features?.featurePageComments === 'boolean'
        ? site.features.featurePageComments
        : undefined
    )
    if (Object.keys(features).length > 0) {
      config.features = features
    }

    const locales = await this.#importLocales(site.locales, warnings)
    if (locales) {
      config.locales = locales
    }

    if (Object.keys(config).length < 1) {
      warnings.push('The package carried no site settings this wiki could use.')
      return { imported: 0, skipped: 1, warnings }
    }
    await WIKI.models.sites.updateSite(target.siteId, { config })
    warnings.push(`Site settings applied: ${Object.keys(config).sort().join(', ')}.`)
    return { imported: 1, skipped: 0, warnings }
  }

  /**
   * Pages.
   *
   * Straight onto `pages.adoptStoredPage`, which is the method the disk and git targets import
   * through: it makes the create-or-overwrite decision, writes a history entry when it overwrites,
   * mirrors the page to every configured storage target, and renders it with NO script or style
   * permission whoever ran the import — which is exactly the rule this feature needs, since a
   * `.wkbackup` is a file somebody handed the administrator.
   *
   * No render comes with the page. A 2.x one would be 2.x's output and wrong here in ways nothing
   * could later detect, so the page gets a placeholder and a place in the render queue instead. See
   * `dev/specs/wkbackup.md` §8.
   */
  async #pagesStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    let imported = 0
    let skipped = 0
    let icons = 0
    /** Source editor → how many pages of it changed editor on the way in. */
    const converted = new Map<string, number>()
    const convertHtml = session.htmlConversion !== 'html'

    for (const record of records) {
      const pagePath = stringOf(record?.path)
        .trim()
        .replace(/^\/+|\/+$/g, '')
      const locale = stringOf(record?.localeCode).trim()
      if (!pagePath || !locale) {
        warnings.push(
          describeSkip('page', missingOf({ path: pagePath, localeCode: locale }), record)
        )
        skipped++
        continue
      }

      const content = await this.#contentOf(session, record)
      if (content === null) {
        warnings.push(`The content of "${pagePath}" is missing from the package.`)
        skipped++
        continue
      }

      /*
        2.x's page emblem, promoted to the field 3.x has for it. Taken out before the page is written,
        so that the body stored, mirrored to every storage target and rendered is the one without it —
        rather than saving the image and editing it back out afterwards.
      */
      const { icon, content: body } = extractPageIcon(content, pagePath)

      const sourceEditor = stringOf(record?.editorKey, 'markdown')
      const editor = targetEditorFor(sourceEditor, convertHtml)
      /*
        Counted per kind rather than reported per page, and counted at all — a page that changed
        editor used to say nothing whatsoever, because the only warning here fired for an editor
        missing from the map entirely and `ckeditor` is in it. So the whole of a 2.x wiki written in
        the WYSIWYG editor arrived as markdown pages without a word about it.
      */
      if (editor !== sourceEditor) {
        converted.set(sourceEditor, (converted.get(sourceEditor) ?? 0) + 1)
      }
      /*
        Converted AFTER the page icon has been taken out, and the order is load-bearing: 2.x marks a
        corner image with a CSS class, and a class is exactly what does not survive the trip to
        markdown. Extracting first means the icon is found on the HTML that still carries it.
      */
      const source = editor === 'visual' ? htmlToMarkdown(body) : body

      try {
        const page = await WIKI.models.pages.adoptStoredPage({
          siteId: target.siteId,
          locale,
          path: pagePath,
          title: stringOf(record?.title, pagePath),
          description: stringOf(record?.description),
          editor,
          tags: (Array.isArray(record?.tags) ? record.tags : []).map((tag: unknown) =>
            stringOf(tag)
          ),
          isPublished: record?.isPublished !== false,
          content: editor === 'redirect' ? this.#redirectContent(source) : source,
          createdAt: dateOf(record?.createdAt),
          updatedAt: dateOf(record?.updatedAt),
          authorId: await this.#authorFor(session, record?.authorId),
          overwrite: session.overwrite
        })
        if (!page) {
          /*
            Already here and `overwrite` is off, so nothing was written — but the page IS what that
            2.x page id means, and the comments stream has nothing but that id to find it by. Without
            this, running an import a second time lands every comment on a page that "was not
            imported" and drops the lot.
          */
          const existing = await this.#pageAt(target.siteId, locale, pagePath)
          if (existing) {
            await this.#remember(session.id, 'page', [
              { sourceId: record?.id, targetId: existing.id }
            ])
          }
          skipped++
          continue
        }
        await this.#markPendingRender(target.siteId, page.id, editor)
        if (icon) {
          await WIKI.db.update(pagesTable).set({ icon }).where(eq(pagesTable.id, page.id))
          icons++
        }
        // -> The comments stream names its page by the 2.x page id and has nothing else to go on
        await this.#remember(session.id, 'page', [{ sourceId: record?.id, targetId: page.id }])
        imported++
      } catch (err: any) {
        warnings.push(`"${pagePath}" could not be imported: ${err.message}`)
        skipped++
      }
    }
    for (const [sourceEditor, count] of converted) {
      const note =
        EDITOR_CHANGE_NOTES[sourceEditor]?.[targetEditorFor(sourceEditor, convertHtml)] ??
        '3.x does not have that editor, so they were imported as markdown.'
      warnings.push(`${count} pages were written with the 2.x "${sourceEditor}" editor. ${note}`)
    }
    if (icons > 0) {
      warnings.push(
        `${icons} pages had a corner image (.${V2_ICON_CLASS}); it became the page icon and was taken out of the body.`
      )
    }
    return { imported, skipped, warnings }
  }

  /**
   * Say that a page is waiting to be rendered, in the column a reader is served from.
   *
   * `adoptStoredPage` stores an empty render and queues a real one, which is right for a folder
   * import of a handful of files and wrong for twelve thousand pages at once: the queue is one
   * headless browser doing one page at a time, so for most of a day most of the wiki would be blank
   * with nothing saying why. Written only over an empty render, so the first real one replaces it and
   * nothing here can overwrite a page that already has HTML.
   */
  async #markPendingRender(siteId: string, pageId: string, editor: string): Promise<void> {
    if (BODYLESS_EDITORS.has(editor)) {
      return
    }
    await WIKI.db
      .update(pagesTable)
      .set({ render: PENDING_RENDER_HTML })
      .where(
        and(
          eq(pagesTable.id, pageId),
          eq(pagesTable.siteId, siteId),
          sql`coalesce(${pagesTable.render}, '') = ''`
        )
      )
  }

  /** A 2.x redirection's target, in the JSON a 3.x redirection page holds. */
  #redirectContent(content: string): string {
    const target = content.trim()
    return JSON.stringify({
      kind: /^https?:\/\//i.test(target) ? 'url' : 'page',
      target,
      showInterstitial: false
    })
  }

  /**
   * A record's body, inline or out of a staged blob.
   *
   * Null means the package promised a blob and no upload delivered it, which is a skipped record
   * rather than a failed batch — one missing file should not cost a migration the other eleven
   * thousand pages.
   */
  async #contentOf(session: ImportSession, record: any): Promise<string | null> {
    const blob = stringOf(record?.contentBlob).trim()
    if (blob) {
      const data = await this.#readBlob(session.id, blob)
      return data ? data.toString('utf8') : null
    }
    return stringOf(record?.content)
  }

  /**
   * Whose change this was, from the 2.x user id the record carries.
   *
   * A 2.x row names its author by a number that means nothing here, so this goes through the id map
   * the users stream filled. Every page and every history row needs an author, and the account that
   * wrote it may simply not have been imported — the operator may have left Users unticked, or the
   * account may have been deleted from the old wiki years ago. Whoever is running the import is the
   * honest answer then: they are who caused the row to exist here.
   */
  async #authorFor(session: ImportSession, sourceUserId: unknown): Promise<string> {
    if (sourceUserId !== undefined && sourceUserId !== null) {
      const map = await this.#resolveIds(session.id, 'user', [sourceUserId])
      const mapped = map.get(String(sourceUserId))
      if (mapped) {
        return mapped
      }
    }
    if (session.actorId) {
      return session.actorId
    }
    const systemActor = await WIKI.models.users.getSystemActorId()
    if (!systemActor) {
      throw new CustomError(
        'importNoActor',
        'This import has no account to attribute content to.',
        500
      )
    }
    return systemActor
  }

  /** The page a site-scoped record refers to, by the path it names. */
  async #pageAt(siteId: string, locale: string, pagePath: string): Promise<{ id: string } | null> {
    const rows = await WIKI.db
      .select({ id: pagesTable.id })
      .from(pagesTable)
      .where(
        and(
          eq(pagesTable.siteId, siteId),
          eq(pagesTable.locale, locale),
          eq(pagesTable.path, pagePath)
        )
      )
      .limit(1)
    return rows[0] ?? null
  }

  /**
   * Page history.
   *
   * Written through drizzle rather than through `pageHistory.record`, which exists to capture a change
   * being made now and takes the page as it stands — there is nothing for it to diff an imported
   * version against. The id is derived, so a replayed batch updates the rows it already wrote.
   */
  async #pageHistoryStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    const orphans: string[] = []
    let imported = 0
    let skipped = 0

    /*
      Resolved by the 2.x PAGE ID, not by the path on the record.

      A history row records the path the page had AT THE TIME — that is the whole point of the column,
      here as much as in 2.x — so every version written before a page was renamed carries its old
      path. Matching on that finds nothing and throws away the history of exactly the pages whose
      history is most worth having: the ones that moved. `pageId` is the identity that survives a
      rename, and the pages stream has already recorded what each one became.

      The path is still what gets STORED, since "where was this page when this version was written"
      is what a history list shows and what finding a deleted page again depends on.
    */
    const pageMap = await this.#resolveIds(
      session.id,
      'page',
      records.map((record) => record?.pageId)
    )

    for (const record of records) {
      const pagePath = stringOf(record?.path)
        .trim()
        .replace(/^\/+|\/+$/g, '')
      const locale = stringOf(record?.localeCode).trim()
      if (!pagePath || !locale) {
        warnings.push(
          describeSkip('page history', missingOf({ path: pagePath, localeCode: locale }), record)
        )
        skipped++
        continue
      }
      /*
        The path is the fallback, for a package whose pages stream was not imported at all — history
        on its own, over pages that are already here. It cannot help a page that has since moved,
        which is what the id map is for.
      */
      const pageId =
        pageMap.get(String(record?.pageId)) ??
        (await this.#pageAt(target.siteId, locale, pagePath))?.id
      if (!pageId) {
        /*
          Nothing in this wiki for it to hang off. Two ways that happens and both are the package's
          truth rather than a failure here: the pages stream was not imported, or the page was deleted
          in the source wiki and 2.x kept its history — which it does, deliberately, so that a deleted
          page can be recovered.
        */
        orphans.push(pagePath)
        skipped++
        continue
      }
      const content = await this.#contentOf(session, record)
      if (content === null) {
        warnings.push(`A version of "${pagePath}" is missing its content in the package.`)
        skipped++
        continue
      }
      // -> Stripped here as well, with no icon taken from it: restoring one of these versions must not
      //    put the corner image back into a body the page no longer keeps it in
      const { content: stripped } = extractPageIcon(content, pagePath)
      /*
        And converted the same way the page itself was. A version is restored by writing it back over
        the page, so a history holding HTML under a page that is now markdown would turn a rollback
        into a second, silent conversion in the opposite direction.
      */
      const sourceEditor = stringOf(record?.editorKey, 'markdown')
      const versionEditor = targetEditorFor(sourceEditor, session.htmlConversion !== 'html')
      const body = versionEditor === 'visual' ? htmlToMarkdown(stripped) : stripped

      const id = this.#derive(session, target.sourceId, 'pageHistory', record?.id)
      const values = {
        id,
        pageId,
        action: stringOf(record?.action, 'updated').slice(0, 16),
        locale,
        path: pagePath,
        title: stringOf(record?.title, pagePath),
        content: body,
        meta: {
          description: stringOf(record?.description),
          editor: versionEditor,
          publishState: record?.isPublished === false ? 'draft' : 'published',
          tags: Array.isArray(record?.tags) ? record.tags : []
        },
        // -> 2.x stamps a version with `versionDate`, falling back to when the row was written
        versionDate: dateOf(record?.versionDate) ?? dateOf(record?.createdAt) ?? new Date(),
        authorId: await this.#authorFor(session, record?.authorId),
        siteId: target.siteId
      }
      await WIKI.db
        .insert(pageHistoryTable)
        .values(values)
        .onConflictDoUpdate({ target: pageHistoryTable.id, set: values })
      imported++
    }
    if (orphans.length > 0) {
      warnings.push(describeOrphans('page history records', orphans))
    }
    return { imported, skipped, warnings }
  }

  /**
   * Assets, from the blobs staged ahead of them.
   *
   * `assets.adoptStoredFile` is the same entry point the disk target's import uses: it makes the
   * create-or-replace decision, builds a thumbnail, files the entry in the tree and fans the bytes
   * out to every storage target the site writes to.
   */
  async #assetsStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    let imported = 0
    let skipped = 0

    for (const record of records) {
      const fileName = stringOf(record?.filename).trim()
      const digest = stringOf(record?.blob).trim()
      if (!fileName || !digest) {
        warnings.push(
          describeSkip('asset', missingOf({ filename: fileName, blob: digest }), record)
        )
        skipped++
        continue
      }
      /*
        2.x files assets in a tree of their own with no locale in it at all, so there is nothing on
        the record to read and nothing to guess: they go in the site's primary locale, which is where
        a 3.x site with one locale keeps everything anyway.
      */
      const locale = this.#primaryLocaleOf(target.siteId)
      const data = await this.#readBlob(session.id, digest)
      if (!data) {
        warnings.push(`The file "${fileName}" is missing from the package.`)
        skipped++
        continue
      }
      try {
        const asset = await WIKI.models.assets.adoptStoredFile({
          siteId: target.siteId,
          locale,
          folderPath: stringOf(record?.folderPath)
            .trim()
            .replace(/^\/+|\/+$/g, ''),
          fileName,
          data,
          authorId: await this.#authorFor(session, record?.authorId),
          overwrite: session.overwrite,
          /*
            The bytes came out of a ZIP in somebody's browser and nothing on this instance has them,
            which is the opposite of the case `adoptStoredFile` is named for. Without this the asset
            gets a row and a thumbnail and no content at all — a file the manager lists and previews
            and cannot open, and an image that is broken on every page that used it.
          */
          dispatch: true
        })
        if (!asset) {
          skipped++
          continue
        }
        imported++
      } catch (err: any) {
        warnings.push(`"${fileName}" could not be imported: ${err.message}`)
        skipped++
      }
    }
    return { imported, skipped, warnings }
  }

  /**
   * Comments, for the built-in provider.
   *
   * Not through `comments.create`, which is the posting path: it applies the site's cooldown, runs the
   * spam check and stamps the comment with now. None of that is right for a record that was written
   * years ago on another wiki. The id is derived, so a replayed batch updates rather than duplicates.
   *
   * An author with no account here stays a guest comment under the name and address on the record,
   * which is what it already was in 2.x for anybody who commented without signing in.
   */
  async #commentsStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    let imported = 0
    let skipped = 0

    /*
      A 2.x comment names its page by the 2.x page id and carries no path, so the pages stream has to
      have run and remembered what each one became. Resolved for the whole batch in one read rather
      than per comment.
    */
    const pageMap = await this.#resolveIds(
      session.id,
      'page',
      records.map((record) => record?.pageId)
    )
    const authorMap = await this.#resolveIds(
      session.id,
      'user',
      records.map((record) => record?.authorId)
    )

    const orphans: string[] = []
    for (const record of records) {
      const content = stringOf(record?.content).trim()
      if (record?.pageId === undefined || record?.pageId === null || !content) {
        warnings.push(
          describeSkip('comment', missingOf({ pageId: record?.pageId, content }), record)
        )
        skipped++
        continue
      }
      const pageId = pageMap.get(String(record.pageId))
      if (!pageId) {
        orphans.push(String(record.pageId))
        skipped++
        continue
      }

      // -> 2.x keeps the commenter's own name, email and address on the row, for guests and signed-in
      //    authors alike
      const authorId = authorMap.get(String(record?.authorId)) ?? null
      const email = emailOf(record?.email)

      const id = this.#derive(session, target.sourceId, 'comment', record?.id)
      const values = {
        id,
        pageId,
        parentId: null,
        content,
        authorId,
        authorName: stringOf(record?.name, email || 'Anonymous'),
        // -> Only a guest's address is kept. A signed-in author's is on their account, and this column
        //    is never served
        authorEmail: authorId ? '' : email,
        authorIP: stringOf(record?.ip),
        createdAt: dateOf(record?.createdAt) ?? new Date(),
        updatedAt: dateOf(record?.updatedAt) ?? new Date()
      }
      await WIKI.db
        .insert(commentsTable)
        .values(values)
        .onConflictDoUpdate({ target: commentsTable.id, set: values })
      imported++
    }
    if (orphans.length > 0) {
      warnings.push(describeOrphans('comments', orphans))
    }
    return { imported, skipped, warnings }
  }

  /**
   * Navigation.
   *
   * 2.x keeps one tree per locale and 3.x has per-page navigation modes over menus owned by tree
   * entries, so the honest equivalent is the one 3.x already treats as "the menu for this language":
   * **the site-wide menu for that locale**, which every page in it inherits until something overrides
   * one. `navigation.siteNavId` is what names it, and creates it if this is the first thing to ask.
   *
   * One record per locale, not one per item — the whole menu is a single `items` column, so a batch of
   * halves would be a menu that flickers between them.
   */
  async #navigationStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    let imported = 0
    let skipped = 0

    for (const record of records) {
      const locale = stringOf(record?.localeCode).trim()
      if (!locale || !Array.isArray(record?.items)) {
        warnings.push(
          describeSkip(
            'navigation',
            missingOf({ localeCode: locale, items: Array.isArray(record?.items) }),
            record
          )
        )
        skipped++
        continue
      }
      const navId = await WIKI.models.navigation.siteNavId(target.siteId, locale)
      const existing = await WIKI.db
        .select({ items: navigationTable.items })
        .from(navigationTable)
        .where(eq(navigationTable.id, navId))
        .limit(1)
      const current = (existing[0]?.items ?? []) as NavigationItem[]
      if (current.length > 0 && !session.overwrite) {
        warnings.push(
          `The ${locale} sidebar already has items and was left alone. Turn on "Overwrite on conflict" to replace it.`
        )
        skipped++
        continue
      }

      const items = await this.#translateNavItems(session, record.items, warnings)
      await WIKI.db.update(navigationTable).set({ items }).where(eq(navigationTable.id, navId))
      imported++
    }
    return { imported, skipped, warnings }
  }

  /** 2.x navigation items → 3.x ones. 2.x trees are flat, so nothing here recurses. */
  async #translateNavItems(
    session: ImportSession,
    value: any[],
    warnings: string[]
  ): Promise<NavigationItem[]> {
    const items: NavigationItem[] = []
    for (const entry of value) {
      /*
        No default. `kind` used to fall back to `link`, which meant anything at all that reached here
        became a blank link — and what reached here, for two rounds of this, was 2.x's per-locale tree
        WRAPPERS rather than its items. A sidebar of empty links reports success and draws nothing,
        which is the worst way for a mapping to be wrong; an item that cannot say what it is is now
        dropped and named.
      */
      const type = NAV_KINDS[stringOf(entry?.kind)]
      if (!type) {
        warnings.push(describeSkip('sidebar item', ['kind'], entry))
        continue
      }
      const targetType = stringOf(entry?.targetType, 'page')
      const isExternal = targetType === 'external' || targetType === 'externalblank'
      items.push({
        id: uuidv5(`nav:${stringOf(entry?.id)}`, session.namespace),
        type,
        label: stringOf(entry?.label),
        icon: normalizeIcon(entry?.icon),
        target: targetType === 'home' ? '/' : stringOf(entry?.target),
        openInNewWindow:
          targetType === 'externalblank' || (isExternal && entry?.openInNewWindow === true),
        visibilityGroups:
          stringOf(entry?.visibilityMode) === 'restricted'
            ? await this.#resolveGroups(
                session,
                entry?.visibilityGroups,
                warnings,
                'A sidebar item'
              )
            : []
      })
    }
    return items
  }

  // ==============================================================================================
  // FINISHING
  // ==============================================================================================

  /**
   * Close a session: drop the staged blobs and say what happened.
   *
   * Nothing is rebuilt here. Every model the handlers went through did its own bookkeeping as it
   * wrote — the tree entry, the storage-target copy, the search index, the queued render — so there is
   * no deferred pass to run, only bytes to stop keeping.
   */
  async finishSession(id: string): Promise<{
    progress: Record<string, number>
    warnings: string[]
    pendingRenders: number
    unrenderable: number
  }> {
    const session = await this.getSession(id)
    if (!session) {
      throw new CustomError('importNoSession', 'No such import session.', 404)
    }
    await this.#clearStaging(id)
    await this.#patch(id, { state: 'finished' })

    /*
      What the operator is told to expect, which is the whole of §8 in one number: the render queue is
      one headless browser doing one page at a time, and a page 3.x cannot render server-side keeps
      its placeholder until somebody opens and saves it. Counted rather than estimated — a page whose
      render came back while the import was still running is not still waiting.
    */
    const siteIds = session.sites.map((entry) => entry.siteId)
    const pending = siteIds.length
      ? await WIKI.db
          .select({ editor: pagesTable.editor, total: sql<number>`count(*)::int` })
          .from(pagesTable)
          .where(
            and(
              inArray(pagesTable.siteId, siteIds),
              sql`coalesce(${pagesTable.render}, '') in ('', ${PENDING_RENDER_HTML})`
            )
          )
          .groupBy(pagesTable.editor)
      : []
    // -> `RENDERABLE_EDITORS` in `models/rendering.ts`, which is what the queue itself accepts
    const renderable = new Set(['markdown', 'asciidoc', 'visual'])
    let pendingRenders = 0
    let unrenderable = 0
    for (const row of pending) {
      if (BODYLESS_EDITORS.has(row.editor)) {
        continue
      }
      if (renderable.has(row.editor)) {
        pendingRenders += row.total
      } else {
        unrenderable += row.total
      }
    }

    return {
      progress: session.progress,
      warnings: session.warnings,
      pendingRenders,
      unrenderable
    }
  }

  async #clearStaging(sessionId: string): Promise<void> {
    try {
      await fs.rm(this.stagingDir(sessionId), { recursive: true, force: true })
    } catch (err: any) {
      WIKI.logger.warn(`Could not clear the import staging directory [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
    }
  }

  /**
   * Drop the sessions nobody came back for.
   *
   * An import lives in a browser tab, and a tab that closed leaves an open session with its staged
   * blobs on disk — which for a media wiki is however many gigabytes had been uploaded. Run daily
   * alongside the audit log purge rather than on a timer of its own.
   */
  async sweepSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - SESSION_MAX_AGE_HOURS * 3600 * 1000)
    const stale = await WIKI.db
      .select({ id: importSessionsTable.id })
      .from(importSessionsTable)
      .where(lt(importSessionsTable.updatedAt, cutoff))
    for (const row of stale) {
      await this.#clearStaging(row.id)
    }
    if (stale.length > 0) {
      await WIKI.db.delete(importSessionsTable).where(
        inArray(
          importSessionsTable.id,
          stale.map((row) => row.id)
        )
      )
    }
    return stale.length
  }
}

export const importer = new Import()
