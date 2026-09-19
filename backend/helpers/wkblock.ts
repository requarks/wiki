import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { CustomError } from './common.ts'
import type { BlockDefinition, BlockProp } from '../models/blocks.ts'

/**
 * Reading a `.wkblock` — the single file a block is distributed as.
 *
 * `blocks/package.mjs` is the other half of this, and the two have to agree. There is no module to
 * share between them: `blocks/` and `backend/` are separately installed workspaces and the backend
 * does not type-check JavaScript, so the format is written twice and stated in full in both places.
 *
 *     magic     8 bytes   "WKBLOCK\0"
 *     version   uint32be  format version, 1
 *     headerLen uint32be  byte length of the header that follows
 *     header    gzip'd JSON — see `PackageHeader`
 *     payload   each file's gzip'd bytes, concatenated in the header's order
 *
 * Everything here treats the package as something a person uploaded, because that is what it is:
 * `manage:sites` is the trust boundary for the CODE in it — which runs in every reader's browser on
 * that site, and is no more and no less than what the raw head and body fields under Theme already
 * allow — but the container itself is parsed before anybody has vouched for anything. So every
 * length is bounded before it is acted on, every digest is checked, and every path has to fall inside
 * the block's own namespace.
 */

const MAGIC = Buffer.from('WKBLOCK\0', 'latin1')
const FORMAT_VERSION = 1
const PREAMBLE_SIZE = 16

/**
 * The most a `.wkblock` may weigh, and the body limit of the route that takes one.
 *
 * Deliberately not the site's asset upload limit: that one is about what readers may attach to
 * pages and is usually turned down, while a block carrying a PDF engine and its character maps is
 * legitimately a couple of dozen megabytes.
 */
export const MAX_PACKAGE_SIZE = 32 * 1024 * 1024

/** Bounds on what the container may claim, all checked before anything is decompressed. */
const MAX_HEADER_SIZE = 4 * 1024 * 1024
const MAX_UNPACKED_SIZE = 128 * 1024 * 1024
const MAX_FILE_COUNT = 4096

/** A block key, which is also a file name and the suffix of an element. */
const BLOCK_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/

/**
 * A prop name, which becomes an attribute the sanitiser allows on the block's tag.
 *
 * Attribute names are what the allow list is built from, so a name that is not one would either be
 * dropped silently or widen that list in a way nobody wrote down.
 */
const PROP_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]{0,63}$/

const PROP_TYPES = new Set(['string', 'number', 'boolean', 'select', 'icon'])

interface PackageFileEntry {
  path: string
  size: number
  compressedSize: number
  sha256: string
}

interface PackageHeader {
  block: string
  definition: BlockDefinition
  packagedAt?: string
  packagedWith?: string
  files: PackageFileEntry[]
}

/** A package read, checked and unpacked in memory, ready to be stored and written to the cache. */
export interface BlockPackage {
  /** The block key — the suffix of `<block-xyz>`, and the stem of every path below. */
  block: string
  definition: BlockDefinition
  /** The files to serve, keyed by the path they are served at, relative to `/_blocks/`. */
  files: Map<string, Buffer>
  packagedAt: string
  packagedWith: string
}

function refuse(message: string): never {
  throw new CustomError('blockPackageInvalid', message)
}

/**
 * Whether a path is one this package is allowed to bring.
 *
 * Two things at once, and both matter. It has to be a plain relative path, since it is joined onto a
 * cache directory — no root, no `..`, no backslashes (a Windows instance would read one as a
 * separator where this check would not). And it has to sit inside the block's own namespace, which
 * is what stops an imported block from standing on a built-in one: the serving route decides which
 * root answers a request from the first segment of the path alone, so a package holding
 * `block-diagram/foo.js` would answer for a block it is not.
 */
function isServablePath(filePath: string, blockDir: string): boolean {
  if (
    !filePath ||
    filePath.length > 255 ||
    filePath.includes('\\') ||
    filePath.startsWith('/') ||
    /(^|\/)\.\.?(\/|$)/.test(filePath) ||
    filePath.endsWith('/') ||
    filePath.includes('//') ||
    [...filePath].some((char) => char.codePointAt(0)! < 0x20)
  ) {
    return false
  }
  return (
    filePath === `${blockDir}.js` ||
    filePath === `${blockDir}.worker.js` ||
    filePath.startsWith(`${blockDir}/`)
  )
}

/**
 * The definition as the package declares it, with everything the wiki will act on checked.
 *
 * Read rather than trusted, and rebuilt key by key rather than spread: what comes back is stored on
 * the block's row, handed to the editor to build a form from, and turned into the sanitiser's
 * allow list for the block's tag. An unknown key would travel all of that way meaning nothing.
 */
function readDefinition(raw: any, block: string): BlockDefinition {
  if (!raw || typeof raw !== 'object' || raw.block !== block) {
    refuse("The package's definition does not describe the block it claims to be.")
  }
  if (raw.isChild) {
    refuse(
      'This is a child block — one that only ever appears inside another. It has nothing to be installed or switched on separately from whatever holds it.'
    )
  }
  const text = (value: unknown, field: string, max: number): string => {
    if (typeof value !== 'string' || value.length > max) {
      refuse(`The package's definition has no usable "${field}".`)
    }
    return value
  }
  const definition: BlockDefinition = {
    block,
    name: text(raw.name, 'name', 255),
    description: text(raw.description ?? '', 'description', 255),
    icon: text(raw.icon ?? '', 'icon', 255),
    props: readProps(raw.props)
  }
  if (raw.template) {
    definition.template = text(raw.template, 'template', 8192)
  }
  if (raw.asciidocTemplate) {
    definition.asciidocTemplate = text(raw.asciidocTemplate, 'asciidocTemplate', 8192)
  }
  if (raw.contentEditor) {
    definition.contentEditor = text(raw.contentEditor, 'contentEditor', 64)
  }
  return definition
}

function readProps(raw: any): BlockProp[] {
  if (raw === undefined || raw === null) {
    return []
  }
  if (!Array.isArray(raw) || raw.length > 64) {
    refuse('The package\'s definition declares an unusable "props" list.')
  }
  return raw.map((prop: any) => {
    if (!prop || typeof prop !== 'object' || !PROP_NAME_PATTERN.test(prop.name ?? '')) {
      refuse(`"${prop?.name}" is not a usable prop name — it becomes an attribute on the block.`)
    }
    if (!PROP_TYPES.has(prop.type)) {
      refuse(`Prop "${prop.name}" has no usable type.`)
    }
    const checked: BlockProp = { name: prop.name, type: prop.type }
    for (const field of ['label', 'hint'] as const) {
      if (typeof prop[field] === 'string') {
        checked[field] = prop[field].slice(0, 1024)
      }
    }
    if (prop.required === true) {
      checked.required = true
    }
    if (['string', 'number', 'boolean'].includes(typeof prop.default)) {
      checked.default = prop.default
    }
    if (Array.isArray(prop.options)) {
      checked.options = prop.options
        .slice(0, 128)
        .map((option: any) =>
          typeof option === 'string'
            ? option
            : { label: String(option?.label ?? ''), value: String(option?.value ?? '') }
        )
    }
    return checked
  })
}

/**
 * Read a `.wkblock` file.
 *
 * Throws a `CustomError` naming what is wrong with it, since every one of these is something the
 * administrator who uploaded the file can act on — a truncated download, the wrong file, a package
 * built by a newer wiki.
 */
export function readBlockPackage(data: Buffer): BlockPackage {
  if (!Buffer.isBuffer(data) || data.length < PREAMBLE_SIZE || !data.subarray(0, 8).equals(MAGIC)) {
    refuse(
      'Not a Wiki.js block package. A packaged block is a .wkblock file built by "npm run package" in blocks/.'
    )
  }
  const version = data.readUInt32BE(8)
  if (version !== FORMAT_VERSION) {
    refuse(
      `This package is in block format ${version}, and this wiki reads format ${FORMAT_VERSION}. It was most likely built by a different version of Wiki.js.`
    )
  }

  const headerLength = data.readUInt32BE(12)
  if (
    headerLength < 1 ||
    headerLength > MAX_HEADER_SIZE ||
    PREAMBLE_SIZE + headerLength > data.length
  ) {
    refuse('The package is damaged: its table of contents does not fit inside it.')
  }

  let header: PackageHeader
  try {
    header = JSON.parse(
      gunzipSync(data.subarray(PREAMBLE_SIZE, PREAMBLE_SIZE + headerLength), {
        maxOutputLength: MAX_HEADER_SIZE
      }).toString('utf8')
    )
  } catch {
    refuse('The package is damaged: its table of contents could not be read.')
  }

  const block = header.block
  if (typeof block !== 'string' || !BLOCK_KEY_PATTERN.test(block)) {
    refuse(
      `"${block}" is not a usable block key — it has to be lowercase letters, digits and dashes.`
    )
  }
  const blockDir = `block-${block}`
  const definition = readDefinition(header.definition, block)

  if (
    !Array.isArray(header.files) ||
    header.files.length < 1 ||
    header.files.length > MAX_FILE_COUNT
  ) {
    refuse('The package lists no files, or more than a block can hold.')
  }

  // -> Everything the header CLAIMS is checked before a byte of the payload is touched, so that a
  //    package cannot talk this into decompressing more than it is prepared to hold
  let unpackedSize = 0
  let payloadSize = 0
  for (const entry of header.files) {
    if (!isServablePath(entry?.path, blockDir)) {
      refuse(
        `The package holds "${entry?.path}", which is outside ${blockDir}'s own files. A block may only bring ${blockDir}.js, ${blockDir}.worker.js and ${blockDir}/**.`
      )
    }
    if (
      !Number.isInteger(entry.size) ||
      entry.size < 0 ||
      !Number.isInteger(entry.compressedSize) ||
      entry.compressedSize < 0 ||
      typeof entry.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(entry.sha256)
    ) {
      refuse(`The package's entry for "${entry.path}" is damaged.`)
    }
    unpackedSize += entry.size
    payloadSize += entry.compressedSize
  }
  if (unpackedSize > MAX_UNPACKED_SIZE) {
    refuse('The package unpacks to more than a block is allowed to hold.')
  }
  if (PREAMBLE_SIZE + headerLength + payloadSize !== data.length) {
    refuse(
      'The package is damaged: its contents do not match the length its table of contents states.'
    )
  }

  const files = new Map<string, Buffer>()
  let offset = PREAMBLE_SIZE + headerLength
  for (const entry of header.files) {
    if (files.has(entry.path)) {
      refuse(`The package holds "${entry.path}" twice.`)
    }
    let bytes: Buffer
    try {
      bytes = gunzipSync(data.subarray(offset, offset + entry.compressedSize), {
        maxOutputLength: Math.max(entry.size, 1)
      })
    } catch {
      refuse(`The package is damaged: "${entry.path}" could not be decompressed.`)
    }
    offset += entry.compressedSize
    if (
      bytes.length !== entry.size ||
      crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256
    ) {
      refuse(`The package is damaged: "${entry.path}" is not what its checksum says it is.`)
    }
    files.set(entry.path, bytes)
  }

  if (!files.has(`${blockDir}.js`)) {
    refuse(`The package has no ${blockDir}.js, which is the file the wiki loads the block from.`)
  }

  return {
    block,
    definition,
    files,
    packagedAt: typeof header.packagedAt === 'string' ? header.packagedAt : '',
    packagedWith: typeof header.packagedWith === 'string' ? header.packagedWith : ''
  }
}
