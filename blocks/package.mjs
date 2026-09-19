/**
 * Package one block into a single `.wkblock` file, for importing into a Wiki.js instance.
 *
 *     npm run package -- block-xyz
 *
 * The block is compiled on its own — see `buildConfig({ only })` in `rollup.config.mjs` for why that
 * is not simply a slice of the normal build — and everything the compile emitted goes into the
 * package, together with the `static definition` read off the component. The result lands in
 * `packages/block-xyz.wkblock` and is uploaded from the instance's Administration → Content Blocks.
 *
 * ## The container
 *
 * `backend/helpers/wkblock.ts` is the other half of this and the two have to agree. There is no
 * module to share between them: `blocks/` and `backend/` are separately installed workspaces and the
 * backend does not type-check JavaScript, so the format is written twice and stated in full in both
 * places.
 *
 *     magic     8 bytes   "WKBLOCK\0"
 *     version   uint32be  format version, 1
 *     headerLen uint32be  byte length of the header that follows
 *     header    gzip'd JSON — see below
 *     payload   each file's gzip'd bytes, concatenated in the header's order
 *
 * The header:
 *
 *     {
 *       "block": "xyz",                    // the key, i.e. the <block-xyz> element's suffix
 *       "definition": { ... },             // the component's `static definition`, verbatim
 *       "packagedAt": "2026-09-19T...Z",
 *       "packagedWith": "3.0.0",           // the wiki the packager came from, for diagnostics only
 *       "files": [
 *         { "path": "block-xyz.js", "size": 12345, "compressedSize": 4321, "sha256": "..." }
 *       ]
 *     }
 *
 * Per-file gzip rather than one stream over the lot: a block's assets are often already-compressed
 * images and fonts sitting beside a bundle that compresses four to one, and a file at a time means
 * the reader can check a digest as it goes rather than after holding the whole package twice.
 *
 * Every path is relative to where the block is served from, and the reader refuses anything outside
 * the block's own namespace — `block-<key>.js`, `block-<key>.worker.js` and `block-<key>/**`. That
 * namespace is the whole of what keeps an imported block from overwriting a built-in one, so it is
 * checked here as well, where the author can still do something about it.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { rollup } from 'rollup'

import { buildConfig } from './rollup.config.mjs'

const MAGIC = Buffer.from('WKBLOCK\0', 'latin1')
const FORMAT_VERSION = 1

const STAGING_DIR = '.package'
const OUTPUT_DIR = 'packages'

/** Emitted by the manifest plugin for the server to read; the package carries the definition itself. */
const MANIFEST_FILE = 'blocks.manifest.json'

function fail (message) {
  console.error(`\n  ✖ ${message}\n`)
  process.exit(1)
}

/**
 * The block directory named on the command line, as `block-<key>`.
 *
 * Both spellings are taken, since half of what is on screen while working on a block says one and
 * half says the other: the directory is `block-countdown` and the definition's key is `countdown`.
 */
function resolveBlockDir (argument) {
  if (!argument) {
    fail('Which block? Usage: npm run package -- block-xyz')
  }
  const dir = argument.replace(/\/+$/, '')
  const candidate = dir.startsWith('block-') ? dir : `block-${dir}`
  if (!/^block-[a-z0-9][a-z0-9-]*$/.test(candidate)) {
    fail(`"${argument}" is not a block directory name — expected something like "block-xyz".`)
  }
  if (!fs.existsSync(path.join(candidate, 'component.js'))) {
    fail(`${candidate}/component.js does not exist. A block is a directory under blocks/ with a component in it.`)
  }
  return candidate
}

/** Every file under a directory, as paths relative to it, in a stable order. */
function collectFiles (root) {
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort()
}

/**
 * Refuse a compile that put something outside the block's own namespace.
 *
 * Nothing in the current build does — the config names chunks into `<block>/` and assets are copied
 * there — so this is about a change to that config, or to a block's `assets.json`, quietly producing
 * a package that stands on a file the importing instance already has.
 */
function assertNamespaced (files, blockDir) {
  const allowed = [`${blockDir}.js`, `${blockDir}.worker.js`]
  const stray = files.filter(file => !allowed.includes(file) && !file.startsWith(`${blockDir}/`))
  if (stray.length > 0) {
    fail(
      `The compile emitted ${stray.length} file(s) outside ${blockDir}'s namespace:\n` +
      stray.map(file => `      ${file}`).join('\n') +
      `\n\n    A package may only hold ${blockDir}.js, ${blockDir}.worker.js and ${blockDir}/**.`
    )
  }
}

function formatSize (bytes) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} kB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function main () {
  const blockDir = resolveBlockDir(process.argv[2])

  fs.rmSync(STAGING_DIR, { recursive: true, force: true })

  console.log(`\n  Compiling ${blockDir}...\n`)
  const config = buildConfig({ only: blockDir, outputDir: STAGING_DIR })
  const bundle = await rollup(config)
  await bundle.write(config.output)
  await bundle.close()

  // -- The definition, which the manifest plugin has just read off the component's AST

  const manifestPath = path.join(STAGING_DIR, MANIFEST_FILE)
  const definitions = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (definitions.length !== 1) {
    fail(`${blockDir}/component.js declares no "static definition" — there is nothing to package.`)
  }
  const definition = definitions[0]

  if (`block-${definition.block}` !== blockDir) {
    fail(
      `${blockDir} declares itself as "${definition.block}", so it renders as <block-${definition.block}>.\n` +
      `    The directory name and the key have to match: a package is served as block-<key>.js.`
    )
  }
  if (definition.isChild) {
    fail(
      `${blockDir} is a child block — it only ever appears inside another one, and has nothing to be\n` +
      '    installed or switched on separately from it. Package the block that holds it instead.'
    )
  }

  // -- Everything the compile emitted, minus the manifest, which the package states for itself

  const files = collectFiles(STAGING_DIR).filter(file => file !== MANIFEST_FILE)
  assertNamespaced(files, blockDir)
  if (!files.includes(`${blockDir}.js`)) {
    fail(`The compile produced no ${blockDir}.js, which is the file the wiki loads the block from.`)
  }

  const entries = []
  const payload = []
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(STAGING_DIR, file))
    const compressed = gzipSync(bytes, { level: 9 })
    entries.push({
      path: file,
      size: bytes.length,
      compressedSize: compressed.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    })
    payload.push(compressed)
  }

  const header = gzipSync(Buffer.from(JSON.stringify({
    block: definition.block,
    definition,
    packagedAt: new Date().toISOString(),
    packagedWith: JSON.parse(fs.readFileSync('../backend/package.json', 'utf8')).version,
    files: entries
  }), 'utf8'), { level: 9 })

  const preamble = Buffer.alloc(16)
  MAGIC.copy(preamble, 0)
  preamble.writeUInt32BE(FORMAT_VERSION, 8)
  preamble.writeUInt32BE(header.length, 12)

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const packagePath = path.join(OUTPUT_DIR, `${blockDir}.wkblock`)
  fs.writeFileSync(packagePath, Buffer.concat([preamble, header, ...payload]))

  fs.rmSync(STAGING_DIR, { recursive: true, force: true })

  const uncompressed = entries.reduce((total, entry) => total + entry.size, 0)
  console.log(`  ${definition.name} — <block-${definition.block}>`)
  console.log(`  ${entries.length} file(s), ${formatSize(uncompressed)} uncompressed`)
  console.log(`\n  → ${packagePath} (${formatSize(fs.statSync(packagePath).size)})\n`)
  console.log('  Install it from Administration → Content Blocks → Install Block...\n')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
