import { isNil, isPlainObject } from 'es-toolkit/predicate'
import { startCase } from 'es-toolkit/string'
import crypto from 'node:crypto'
import mime from 'mime'
import fs from 'node:fs'
import path from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { sql, type SQL, type SQLWrapper } from 'drizzle-orm'

export interface Deferred<T = void> {
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
  promise: Promise<T>
}

/** Seconds in each unit a duration setting may be written with. See `durationToSeconds`. */
const DURATION_UNIT_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  y: 31536000
} as const

type DurationUnit = keyof typeof DURATION_UNIT_SECONDS

/* eslint-disable promise/param-names */
export function createDeferred<T = void>(): Deferred<T> {
  let result: Promise<T> | undefined
  let resolve: ((value: T | PromiseLike<T>) => void) | undefined
  let reject: ((reason?: unknown) => void) | undefined
  return {
    resolve: function (value: T) {
      if (resolve) {
        resolve(value)
      } else {
        result =
          result ||
          new Promise<T>(function (r) {
            r(value)
          })
      }
    },
    reject: function (reason?: unknown) {
      if (reject) {
        reject(reason)
      } else {
        result =
          result ||
          new Promise<T>(function (x, j) {
            j(reason)
          })
      }
    },
    promise: new Promise<T>(function (r, j) {
      if (result) {
        r(result)
      } else {
        resolve = r
        reject = j
      }
    })
  }
}

/**
 * Files a browser or a crawler asks for at the root by convention, rather than because the wiki has a
 * page there.
 *
 * Kept out of the page URL rules in `index.ts` — `txt` is a page extension on a default site, and
 * answering `/robots.txt` with a redirect to `/robots` would be answering the wrong question. Also
 * what the metrics endpoint's path is checked against, since taking one of these over would break a
 * convention nothing in the admin area would explain.
 */
export const RESERVED_ROOT_FILES = new Set(['favicon.ico', 'robots.txt', 'sitemap.xml'])

/**
 * Root segments the frontend's own router owns, despite carrying no leading underscore.
 *
 * Everything the app mounts for itself sits under `/_…`, which is what makes `isPageUrl` a prefix
 * test rather than a list to keep in step. These are the exceptions, and each is an address a reader
 * is HANDED rather than a screen they browse to: the sign-in form, and the two short links that name
 * a page by something other than its path — `/a/<alias>` and `/i/<id>` — each of which looks its
 * target up and sends the reader on to it.
 *
 * Mistaking one for a page is not cosmetic. A page URL is locale-prefixed on a site that forces
 * prefixes, so `/login` was answered with a redirect to `/en/login` — a path no route matches, which
 * left the sign-in form unreachable the moment that setting was turned on. And a page URL is
 * described by the app shell, which answers 404 where the public may read nothing: on a private wiki
 * that is a 404 at the one address whose entire purpose is to let somebody in.
 *
 * Mirrored in the frontend's `helpers/pagePaths.js`, which asks the same question of the same URLs.
 */
export const RESERVED_ROOT_PATHS = new Set(['login', 'a', 'i'])

/**
 * Whether a URL addresses the page tree rather than the server itself.
 *
 * Everything the server mounts sits under a leading-underscore segment — `/_api`, `/_assets`,
 * `/_files`, and the rest registered in `initHTTPServer` — which is what makes the distinction a
 * prefix test rather than a list to keep in step with the routes.
 *
 * Note that the answer is about the URL and not about what is there: a page path with no page at it
 * is still a page path, which is what lets the app shell answer 404 for one.
 */
export function isPageUrl(urlPath: string): boolean {
  const firstSegment = (urlPath.split('/')[1] ?? '').toLowerCase()
  return (
    !firstSegment.startsWith('_') &&
    !RESERVED_ROOT_FILES.has(firstSegment) &&
    !RESERVED_ROOT_PATHS.has(firstSegment)
  )
}

/**
 * The origin a URL this server writes into a document is built against.
 *
 * The requester's own, and deliberately not the site's configured hostname: a site may be bound to
 * the catch-all `*` and have none, and every document this produces — a sitemap, a canonical link, an
 * unfurl card — has to name the host it was itself fetched from or be discarded as pointing somewhere
 * else. It comes off a header and is therefore whatever the client said, which is why everything
 * built from it is escaped before it reaches a document.
 */
export function originOf(req: FastifyRequest): string {
  return `${req.protocol}://${req.host}`
}

/**
 * Escape a string for use as HTML text or inside a double-quoted attribute.
 *
 * Both at once, which is why the set is all five: an attribute needs the quotes and text needs the
 * angle brackets, and a value that is safe in both is one fewer thing to get right per call site.
 */
export function htmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * One path segment as the ltree label the tree stores it under: the hex of its UTF-8 bytes.
 *
 * An ltree label may only hold what the database's locale calls alphanumeric, plus `_` and `-` — on a
 * `C` database that is ASCII, on any other it is whatever its C library says, and even a UTF-8 locale
 * refuses combining marks (Hindi, Thai, decomposed kana). A path segment is none of those things'
 * business, so the label is an encoding of it that every database accepts and every database reads
 * back the same. Hex rather than an escape scheme because postgres can produce it too —
 * `treeLabelSql` is the same function for a column, which queries that build a child's path from
 * its parent's row depend on — and because it never contains anything lquery would read as syntax.
 *
 * The segment is taken as given: callers hand in a name already lowercased and NFC-normalized, which
 * is the form `fileName` is stored in and what `treeLabelSql` encodes.
 */
export function encodeTreeLabel(segment: string): string {
  return Buffer.from(segment, 'utf8').toString('hex')
}

/**
 * The path segment an ltree label encodes. The exact inverse of `encodeTreeLabel`.
 */
export function decodeTreeLabel(label: string): string {
  return Buffer.from(label, 'hex').toString('utf8')
}

/**
 * `encodeTreeLabel` in SQL, for a query that builds a path from a row's own `fileName`.
 *
 * `convert_to` is what makes it byte-for-byte the same as `Buffer.from(…, 'utf8')`: the database's
 * encoding is not assumed to be UTF-8, the conversion says so explicitly.
 */
export function treeLabelSql(fileName: SQLWrapper): SQL {
  return sql`encode(convert_to(${fileName}, 'UTF8'), 'hex')`
}

/**
 * A slash-separated folder path as the ltree the tree stores it under.
 *
 * Each segment is lowercased and NFC-normalized before it is encoded, which is the form every folder
 * name is stored in — so a lookup does not care how the path it was handed was spelled. Empty
 * segments are dropped rather than encoded as labels ltree would refuse.
 *
 * Never hand it a path that is already encoded: hex has no slashes, so the whole dotted path would be
 * taken as one segment and encoded a second time.
 */
export function encodeTreePath(str?: string | null): string {
  return (str ?? '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeTreeLabel(segment.toLowerCase().normalize('NFC')))
    .join('.')
}

/**
 * An ltree path from the tree as the slash-separated path it encodes. Empty for the site root.
 *
 * Only ever for a value read off a row, or built by `encodeTreePath` / `encodeTreeLabel` — decoding a
 * path that is already slash-separated reads it as hex and returns garbage.
 */
export function decodeTreePath(str?: string | null): string {
  return str ? str.split('.').map(decodeTreeLabel).join('/') : ''
}

/**
 * A `Content-Disposition` that downloads a file under its own name, whatever script it is written in.
 *
 * RFC 6266: `filename*` carries the name as UTF-8, which every current browser reads, and `filename`
 * is the fallback for anything that does not. That one is held to printable ASCII, with everything
 * else replaced rather than percent-encoded — a browser reading `filename` shows a `%E6` literally.
 */
export function attachmentDisposition(fileName: string): string {
  const fallback = fileName.replaceAll(/[^\x20-\x7e]|["\\]/gu, '_')
  // -> `encodeURIComponent` leaves `'()*` alone, and RFC 5987 does not allow them unencoded
  const encoded = encodeURIComponent(fileName).replaceAll(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

/**
 * Longest a single path segment may be, in UTF-8 bytes — a folder name, a page's own name, an asset's
 * file name.
 *
 * Bytes rather than characters, because each limit it stands in front of counts bytes: a file system
 * name is 255 of them on ext4 and most others, and a page is stored as its name plus an extension of
 * up to five; and an ltree label is 1000 characters, which hex spends two of per byte. 240 clears both
 * — about 80 characters of Japanese, 240 of ASCII.
 */
export const MAX_PATH_SEGMENT_BYTES = 240

/**
 * What one segment of a page or folder path may be made of: letters and digits of any script, the
 * combining marks some scripts cannot be written without, and the hyphen — between them, never at
 * either end.
 *
 * Nothing that means something in a URL, a file system or a git pathspec — no `/`, `\`, `.`, `%`,
 * `?`, `#`, `*` or whitespace — which is what lets a path be concatenated into a link, a file path or
 * an object key without escaping it first. The hyphen is kept off the ends because a leading one is
 * an option to every command-line tool a path is handed to, and a trailing one is a separator with
 * nothing after it. Checked on the normalized form, so uppercase letters never reach it.
 */
const PATH_SEGMENT = /^[\p{L}\p{M}\p{N}](?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?$/u

/**
 * Whether a normalized segment is one a path may be written with. See `PATH_SEGMENT`.
 */
export function isValidPathSegment(segment: string): boolean {
  return PATH_SEGMENT.test(segment) && Buffer.byteLength(segment, 'utf8') <= MAX_PATH_SEGMENT_BYTES
}

/**
 * Reduce a page path to the single form it is looked up under.
 *
 * A path is a URL, and a URL that differs only in casing, in how a space was encoded, or in how an
 * accented letter was composed is the same page as far as anyone reading the wiki is concerned — so
 * there is one spelling, and everything that takes a path from a human or from page content passes it
 * through here first. Wrapping slashes go, runs of whitespace become a single hyphen, and what is left
 * is lowercased and NFC-normalized (macOS hands out decomposed names, which would otherwise be a
 * different path to the same eye).
 *
 * A path being WRITTEN goes through `normalizeNewPagePath` instead, which is this and then some: the
 * two differ in `_`, which a path written today never has and a path written before may still.
 */
export function normalizePagePath(input?: string | null): string {
  return (input ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replaceAll(/\s+/g, '-')
    .toLowerCase()
    .normalize('NFC')
}

/**
 * A URL path as the page path it spells: each segment percent-decoded.
 *
 * What a request line or an `href` carries is encoded — a browser percent-encodes every character of
 * `/にほんご` before sending it — while a page path is stored as the characters themselves. So a URL
 * path is decoded before it is normalized and hashed, or it names a page that is not there. A segment
 * that will not decode is not one a page path could have produced, and is left as it is. Mirrored by
 * `decodeUrlPath` in the frontend's `helpers/pagePaths.js`.
 */
export function decodeUrlPath(urlPath: string): string {
  return urlPath
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join('/')
}

/**
 * Reduce a path that is about to be written — a page created or moved, a folder created or renamed —
 * to the form it is stored under.
 *
 * `normalizePagePath`, with underscores turned into hyphens as whitespace already is: a path uses ONE
 * hyphen to separate words, whichever of the three the author typed and however many of them, so
 * `part 1 - intro` is `part-1-intro`. And since a hyphen only ever separates, one left at either end
 * of a segment — from `_draft`, from `notes /` — is dropped. Only for a path being written, because
 * pages written before those rules kept their `_` (or `--`), and looking one of them up through this
 * would look for a page that is not there.
 *
 * What it does not do is decide whether the result is *allowed*: see `isValidPathSegment`.
 */
export function normalizeNewPagePath(input?: string | null): string {
  return normalizePagePath((input ?? '').trim().replaceAll(/[\s_-]+/g, '-'))
    .split('/')
    .map((segment) => segment.replaceAll(/^-+|-+$/g, ''))
    .join('/')
}

/**
 * Reduce a folder path to the segments it actually names.
 *
 * Wrapping and doubled slashes go, and so do `.` and `..` segments — in a wiki tree those name a
 * literal folder rather than a relative path, so a caller asking for `../etc` is asking for a folder
 * called `etc` and never for somewhere outside the site. Which is what makes this safe to hand a path
 * that came from a request.
 *
 * Case is left alone: `encodeTreePath` lowercases on the way into the database, so the lookup does not
 * care, and the tree is what decides what a new folder ends up called.
 */
export function normalizeFolderPath(input?: string | null): string {
  return (input ?? '')
    .trim()
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/')
}

/**
 * Reduce the site's pasted-uploads destination to its stored form.
 *
 * `normalizeFolderPath` plus the one thing that setting carries which a plain folder path does not: a
 * LEADING SLASH, which is what distinguishes a path from the site root from one relative to the page
 * being edited. So it survives normalization, and `/` on its own stays `/` — the site root, which is a
 * real answer and a different one from empty (the page's own folder).
 */
export function normalizePastedDestination(input?: string | null): string {
  const raw = (input ?? '').trim()
  if (!raw) {
    return ''
  }
  const normalized = normalizeFolderPath(raw)
  if (!raw.startsWith('/')) {
    return normalized
  }
  return `/${normalized}`
}

/**
 * Drop a site's page extension from the end of a URL path.
 *
 * A wiki's pages are addressed without one — `/foo/bar`, not `/foo/bar.md` — but the file the page
 * was written as keeps turning up in links: an export, a repository mirror, a migration from a system
 * that served files. So a site lists the extensions its content is written in, and a path ending in
 * one of them means the page underneath it.
 *
 * Only the last segment is considered, and only when there is a name in front of the dot: `/.md` and
 * `/docs.md/thing` address nothing.
 *
 * @param extensions Lowercase, without the dot, as the site config stores them
 * @returns The path without the extension, or null if it does not end in one of them
 */
export function stripPageExtension(urlPath: string, extensions?: string[] | null): string | null {
  if (!extensions || extensions.length < 1) {
    return null
  }
  const dot = urlPath.lastIndexOf('.')
  if (dot < 1 || urlPath[dot - 1] === '/' || urlPath.lastIndexOf('/') > dot) {
    return null
  }
  if (!extensions.includes(urlPath.slice(dot + 1).toLowerCase())) {
    return null
  }
  return urlPath.slice(0, dot)
}

/**
 * Which locale a page URL is addressed in, and what the path under it is.
 *
 * A site that brackets its URLs by locale reads `/fr/notes/one` as the page `notes/one` in French —
 * the first segment being the locale's SHORT code, the same one its content is filed under on a
 * storage target. Everything the wiki serves itself is under a `/_` segment and never reaches here.
 *
 * Mirrored on the frontend as `splitLocalePath` in `frontend/src/helpers/pagePaths.js`: the server
 * redirects a request that reaches it, but a link inside a page is followed by the router alone, so
 * both have to read a path the same way.
 *
 * @param prefixes The short code of each locale the site offers, mapped to the locale it names
 * @returns The locale and the path below it, or null when no segment names a locale
 */
export function splitLocalePath(
  urlPath: string,
  prefixes: Map<string, string>
): { locale: string; path: string } | null {
  const slash = urlPath.indexOf('/', 1)
  const first = slash < 0 ? urlPath.slice(1) : urlPath.slice(1, slash)
  const locale = prefixes.get(first)
  if (!locale) {
    return null
  }
  // -> `/fr` alone is the French home page, which is `/` under the prefix
  return { locale, path: slash < 0 ? '/' : urlPath.slice(slash) }
}

/**
 * Generate SHA-1 Hash of a string
 *
 * @param str String to hash
 * @returns Hashed string
 */
export function generateHash(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex')
}

/**
 * Compare two secrets without leaking which character stopped the comparison.
 *
 * `===` on strings returns as soon as it finds a difference, and the time that takes is measurable
 * across enough attempts. Both sides are digested first because `timingSafeEqual` throws on operands
 * of different lengths — the digest is a fixed 32 bytes, so the length of the candidate says nothing.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const digest = (value: string) => crypto.createHash('sha256').update(value).digest()
  return crypto.timingSafeEqual(digest(a), digest(b))
}

/**
 * Hash a page path the way the frontend does.
 *
 * A page is addressed by the hash of its path rather than the path itself, so that a URL with slashes
 * in it stays a single path segment. The frontend computes this before asking for a page, so the two
 * implementations have to agree exactly — this is cyrb53, mirroring `fastHash` in
 * `frontend/src/stores/page.js`. Not a security boundary: it is a lookup key, and it is checked
 * against the site it was requested for.
 *
 * @param str Page path, without a leading slash
 * @returns 53-bit hash as a hex string
 */
export function generatePathHash(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

/**
 * How long a duration written the way the admin area writes them lasts, in seconds.
 *
 * `30s`, `15m`, `2h`, `7d`, `2w`, `1y` — one number and one unit, which is the form every duration
 * setting takes (the JWT ones included) and the form `DURATION_PATTERN` in `models/security.ts`
 * accepts. A year is 365 days and a month is not offered at all: these measure how long something
 * lasts, not what date it lands on, so a calendar has no say in it.
 *
 * @param fallback Returned for anything unparseable, so one bad setting cannot turn a limit off
 */
export function durationToSeconds(value: unknown, fallback: number): number {
  const match = /^(\d+)([smhdwy])$/.exec(String(value ?? '').trim())
  if (!match) {
    return fallback
  }
  const seconds = Number(match[1]) * DURATION_UNIT_SECONDS[match[2] as DurationUnit]
  return seconds > 0 ? seconds : fallback
}

/**
 * Get default value of type
 *
 * @param type primitive type name
 * @returns Default value
 */
export function getTypeDefaultValue(type: string): string | number | boolean | undefined {
  switch (type.toLowerCase()) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return false
  }
}

/**
 * A single prop, as declared in a module `definition.yml`. Either the bare primitive type name
 * (e.g. `String`) or an object describing the prop in full.
 */
export type ModulePropDeclaration = ModulePropDefinition | string

/**
 * What a prop holding a path ON THIS SERVER is allowed to point at.
 *
 * `data` is somewhere inside the wiki's own data directory. A site administrator may set one freely:
 * that directory is already the wiki's to write, so aiming a site's content tree at another folder
 * in it reaches nothing they did not have.
 *
 * `system` is a path anywhere on the machine — a binary to execute, a private key to read. That is
 * the operator's business rather than a site's, so only `manage:system` may set one. Confining it to
 * the data directory instead would be no use: git is not installed there.
 *
 * Absent on every prop that is not a local path at all, which includes the ones that look like one:
 * an object store's key prefix and an SFTP base path name a place on somebody else's server, where
 * this process has no reach of its own.
 */
export type ModuleLocalPathScope = 'data' | 'system'

export interface ModulePropDefinition {
  type: string
  default?: unknown
  title?: string
  hint?: string
  enum?: string[] | false
  enumDisplay?: string
  multiline?: boolean
  sensitive?: boolean
  readOnly?: boolean
  localPath?: ModuleLocalPathScope
  icon?: string
  order?: number
  if?: unknown[]
}

/** A prop after normalization, with every field resolved to a concrete value. */
export interface ModuleProp {
  default: unknown
  type: string
  title: string
  hint: string
  enum: string[] | false
  enumDisplay: string
  multiline: boolean
  sensitive: boolean
  /** Shown but not editable — the module declares something this server cannot currently change. */
  readOnly: boolean
  /** Null unless this prop holds a path on this server. See `ModuleLocalPathScope`. */
  localPath: ModuleLocalPathScope | null
  icon: string
  order: number
  if: unknown[]
}

/**
 * What a sensitive prop's value is replaced with on its way to a client.
 *
 * A prop marked `sensitive` is write-only: an API key or a password an administrator has entered is
 * never sent back out, not even to somebody who could read it from the database anyway — a form that
 * carries it is a form that leaks it into a browser cache, a proxy log or a screen share. The prop is
 * still editable, so something has to occupy the field, and a fixed placeholder is what lets a client
 * round-trip the whole configuration back without having to know which fields it was not given.
 *
 * A value the client sends unchanged therefore means "leave it alone", and `isSensitiveMask` is the
 * check every writer has to make. Emptying the field is still how a stored secret is removed, since
 * an empty string is not the mask.
 */
export const SENSITIVE_MASK = '••••••••'

/**
 * Whether an incoming value is the mask, i.e. a value the client was never given in the first place.
 *
 * Only for a prop declared sensitive: the mask is an ordinary string, and a prop that is not
 * write-only may legitimately be set to it.
 */
export function isSensitiveMask(prop: ModuleProp, value: unknown): boolean {
  return prop.sensitive && value === SENSITIVE_MASK
}

/**
 * A path prop's value as an absolute path on this server.
 *
 * Relative to the install directory, which is what every hint on these props promises and what the
 * modules themselves resolve against.
 */
export function resolveLocalPath(value: string): string {
  return path.resolve(WIKI.ROOTPATH, value)
}

/** The wiki's own data directory, absolute. */
export function dataPathRoot(): string {
  return path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath)
}

/**
 * Whether a path is the wiki's data directory, or something inside it.
 *
 * Compared as resolved paths through `path.relative` rather than as strings, because a prefix test
 * would accept `/data/wiki-elsewhere` for a data directory of `/data/wiki` — the sibling whose name
 * merely starts the same way. `..` in the result is what says the path climbs back out; an absolute
 * result is what says it was never under it at all (a different drive on Windows).
 *
 * Symlinks are not resolved: the check is about what an administrator may WRITE in a settings field,
 * and following links would need the path to exist, which the folder a target is about to create
 * does not yet.
 */
export function isWithinDataPath(value: string): boolean {
  const root = dataPathRoot()
  const resolved = resolveLocalPath(value)
  if (resolved === root) {
    return true
  }
  const relative = path.relative(root, resolved)
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * A module's stored config with every sensitive value replaced by the mask.
 *
 * What a route answers with, rather than what a module is given — the modules read the real values
 * out of the same objects, so this has to be the last thing that happens on the way out.
 *
 * An empty value is left empty rather than masked, because the mask is a statement that something is
 * stored: dots over nothing would have an administrator believe a credential is set and hide the
 * fact that the target is running on the machine's own identity.
 */
export function maskSensitiveProps(
  props: Record<string, ModuleProp>,
  config: Record<string, any>
): Record<string, any> {
  const masked: Record<string, any> = { ...config }
  for (const [key, prop] of Object.entries(props)) {
    if (prop.sensitive && typeof masked[key] === 'string' && masked[key].length > 0) {
      masked[key] = SENSITIVE_MASK
    }
  }
  return masked
}

export function parseModuleProps(
  props: Record<string, ModulePropDeclaration>
): Record<string, ModuleProp> {
  const result: Record<string, ModuleProp> = {}
  for (const [key, value] of Object.entries(props)) {
    const def: Partial<ModulePropDefinition> = isPlainObject(value) ? value : {}
    const type = def.type || (value as string)
    const defaultValue = !isNil(def.default) ? def.default : getTypeDefaultValue(type)
    result[key] = {
      default: defaultValue,
      type: type.toLowerCase(),
      title: def.title || startCase(key),
      hint: def.hint || '',
      enum: def.enum || false,
      enumDisplay: def.enumDisplay || 'select',
      multiline: def.multiline || false,
      sensitive: def.sensitive || false,
      readOnly: def.readOnly || false,
      localPath: def.localPath ?? null,
      icon: def.icon || 'rename',
      order: def.order || 100,
      if: def.if ?? []
    }
  }
  return result
}

export function getDictNameFromLocale(locale: string): string {
  const loc = locale.length > 2 ? locale.substring(0, 2) : locale
  if (loc in WIKI.config.search.dictOverrides) {
    return WIKI.config.search.dictOverrides[loc]
  } else {
    return WIKI.data.tsDictMappings[loc] ?? 'simple'
  }
}

export function replyWithFile(reply: FastifyReply, filePath: string): FastifyReply {
  const stream = fs.createReadStream(filePath)
  reply.header('Content-Type', mime.getType(filePath))
  return reply.send(stream)
}

export class CustomError extends Error {
  statusCode: number

  constructor(name: string, message: string, statusCode = 400) {
    super(message)
    this.name = name
    this.statusCode = statusCode
  }
}

/**
 * Rethrow a failure raised by the authentication models as an HTTP error.
 *
 * Those models signal a rejected request by throwing an `ERR_*` code rather than prose, because the
 * client has a translation for each one — so the code travels to the client as the message of a 400.
 * Anything else is an actual fault and is left alone, for the error handler to log and answer 500 to.
 */
export function rethrowAsBadRequest(err: any): never {
  if (typeof err?.message === 'string' && err.message.startsWith('ERR_')) {
    throw new CustomError('Bad Request', err.message)
  }
  throw err
}
