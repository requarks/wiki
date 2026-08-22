import { isNil, isPlainObject } from 'es-toolkit/predicate'
import { startCase } from 'es-toolkit/string'
import crypto from 'node:crypto'
import mime from 'mime'
import fs from 'node:fs'
import type { FastifyReply } from 'fastify'

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
 * Decode a tree path
 *
 * @param str String to decode
 * @returns Decoded tree path
 */
export function decodeTreePath(str?: string | null): string | undefined {
  return str?.replaceAll('.', '/')
}

/**
 * Encode a tree path
 *
 * @param str String to encode
 * @returns Encoded tree path
 */
export function encodeTreePath(str?: string | null): string {
  return str?.toLowerCase()?.replaceAll('/', '.') || ''
}

/**
 * Reduce a page path to the single form it is stored, addressed and looked up under.
 *
 * A path is a URL, and a URL that differs only in casing or in how a space was encoded is the same
 * page as far as anyone reading the wiki is concerned — so there is one spelling, and everything
 * that takes a path from a human or from page content passes it through here first. Wrapping slashes
 * go, runs of whitespace become a single hyphen, and what is left is lowercased.
 *
 * What it does not do is decide whether the result is *allowed*: the characters a path may contain
 * are the page model's rule to enforce, on the normalized form.
 */
export function normalizePagePath(input?: string | null): string {
  return (input ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replaceAll(/\s+/g, '-')
    .toLowerCase()
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
