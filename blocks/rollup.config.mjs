import fs from 'node:fs'
import path from 'node:path'

import summary from 'rollup-plugin-summary'
import terser from '@rollup/plugin-terser'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

import * as glob from 'glob'

/**
 * Turn an ESTree literal node into a plain JS value.
 *
 * Only literals, arrays and objects of literals are supported — a block definition is metadata, so
 * anything computed is a mistake worth failing the build over.
 */
function literalToValue (node, blockDir) {
  switch (node.type) {
    case 'Literal':
      return node.value
    // A backtick string with nothing interpolated is still a plain value, and the readable way to
    // write the multi-line ones -- a starter body for a block, say.
    case 'TemplateLiteral':
      if (node.expressions.length > 0) {
        throw new Error(`${blockDir}: "static definition" must contain only plain literals, got an interpolated template.`)
      }
      return node.quasis[0].value.cooked
    case 'ArrayExpression':
      return node.elements.map(el => literalToValue(el, blockDir))
    case 'ObjectExpression':
      return Object.fromEntries(node.properties.map(prop => [
        prop.key.name ?? prop.key.value,
        literalToValue(prop.value, blockDir)
      ]))
    default:
      throw new Error(`${blockDir}: "static definition" must contain only plain literals, got ${node.type}.`)
  }
}

const ASSET_MIME_TYPES = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

/**
 * Loads a `.css` import as a string, with the files it points at inlined as data URIs.
 *
 * A block styles itself from inside its shadow root, which a `<link>` in the page cannot reach — so a
 * library's stylesheet has to be part of the component. Rollup has no notion of CSS on its own.
 *
 * The inlining is what makes that stylesheet's own assets — leaflet's control sprites, KaTeX's font
 * files — arrive with it. A relative `url()` in a stylesheet resolves against the document, not
 * against the file it was written in, so once the CSS is a string inside a bundle those paths point
 * at whatever wiki page happens to be showing the block. There is nowhere to put the files that would
 * fix that: a block is one file served from /_blocks and mounted at a path it does not know.
 *
 * A `@font-face` offering several formats is cut down to its woff2, when it has one. Otherwise the
 * same face arrives three times over — woff2, woff and ttf are the same glyphs at ~1.5x, ~2x and ~4x
 * the bytes — and every browser that can run a block reads woff2.
 */
function cssAsString () {
  return {
    name: 'css-as-string',
    transform (code, id) {
      if (!id.endsWith('.css')) {
        return null
      }
      const baseDir = path.dirname(id)
      // -> Before the inlining, while a `src` list is still short enough to read: a data URI holds
      //    commas of its own, which is exactly what splits the list here.
      const css = code
        .replace(/src\s*:\s*([^;}]+)/g, (declaration, sources) => {
          const parts = sources.split(/,(?![^(]*\))/)
          const woff2 = parts.filter(part =>
            /\.woff2\b|format\(\s*['"]?woff2['"]?\s*\)/.test(part)
          )
          return woff2.length > 0 && woff2.length < parts.length
            ? `src:${woff2.join(',')}`
            : declaration
        })
        .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (reference, _quote, target) => {
          // -> Anything already addressable is left alone, `url(#default#VML)` among them: leaflet
          //    writes that one to turn on VML in IE, and it names no file at all.
          if (/^(data:|https?:|\/\/|#|\/)/.test(target)) {
            return reference
          }
          const assetPath = path.resolve(baseDir, target.split(/[?#]/)[0])
          const mimeType = ASSET_MIME_TYPES[path.extname(assetPath).toLowerCase()]
          if (!mimeType || !fs.existsSync(assetPath)) {
            this.warn(`${id}: cannot inline ${target} — no such file, or not a known asset type.`)
            return reference
          }
          this.addWatchFile(assetPath)
          return `url("data:${mimeType};base64,${fs.readFileSync(assetPath).toString('base64')}")`
        })
      return { code: `export default ${JSON.stringify(css)}`, map: { mappings: '' } }
    }
  }
}

/**
 * Collects each block's `static definition` into `compiled/blocks.manifest.json`.
 *
 * The definitions are read from the AST rather than by importing the modules, since a component
 * registers itself with `customElements` on load and so cannot be imported outside a browser.
 */
function blocksManifest () {
  const definitions = new Map()
  return {
    name: 'blocks-manifest',
    buildStart () {
      definitions.clear()
    },
    transform (code, id) {
      if (!id.endsWith('/component.js')) {
        return null
      }
      const blockDir = id.split('/').at(-2)
      const ast = this.parse(code)
      for (const node of ast.body) {
        const classNode = node.type === 'ExportNamedDeclaration' ? node.declaration : node
        if (classNode?.type !== 'ClassDeclaration') {
          continue
        }
        const definitionNode = classNode.body.body.find(member =>
          member.type === 'PropertyDefinition' && member.static && member.key.name === 'definition'
        )
        if (definitionNode) {
          definitions.set(blockDir, literalToValue(definitionNode.value, blockDir))
        }
      }
      if (!definitions.has(blockDir)) {
        this.warn(`${blockDir} has no "static definition" — it will not appear in the admin area.`)
      }
      return null
    },
    generateBundle () {
      this.emitFile({
        type: 'asset',
        fileName: 'blocks.manifest.json',
        source: JSON.stringify([...definitions.values()], null, 2) + '\n'
      })
    }
  }
}

const IGNORED_DIRS = [
  'dist/**',
  'node_modules/**'
]

/**
 * Copies the runtime data files a block's library fetches for itself into `compiled/<block>/`.
 *
 * Some libraries deliberately keep part of themselves out of the bundle. pdf.js ships its character
 * maps, its fallback fonts, its colour profile and the wasm that decodes JPEG 2000 and JBIG2 images
 * as files it asks for only once a document turns out to need one — several megabytes that would
 * otherwise be carried into every page showing a PDF, to be read by hardly any of them. They still
 * have to be somewhere the browser can ask for them, and for a block that means beside it in
 * /_blocks, since a block knows no other path it can reach.
 *
 * `assets.json` beside a component lists them: a directory to copy — a package subpath, or one
 * starting with `./` for a directory of the block's own — mapped to the name it should have under
 * `compiled/<block>/`. Everything below it is copied, so a block declares four directories rather
 * than two hundred files.
 */
function blockAssets () {
  return {
    name: 'block-assets',
    buildStart () {
      for (const listPath of glob.sync('@(block-*)/assets.json', { ignore: IGNORED_DIRS })) {
        const blockDir = listPath.split('/')[0]
        this.addWatchFile(listPath)
        const list = JSON.parse(fs.readFileSync(listPath, 'utf8'))
        for (const [source, destination] of Object.entries(list)) {
          const from = source.startsWith('.')
            ? path.resolve(blockDir, source)
            : path.resolve('node_modules', source)
          if (!fs.existsSync(from)) {
            // -> A package that moved its data files between versions, most likely. Silence here
            //    would be a block that loads and then quietly cannot read half the documents it is
            //    given, so the build stops instead.
            this.error(`${listPath}: "${source}" does not exist — nothing to copy from.`)
          }
          for (const entry of fs.readdirSync(from, { recursive: true, withFileTypes: true })) {
            if (!entry.isFile()) {
              continue
            }
            const filePath = path.join(entry.parentPath, entry.name)
            this.emitFile({
              type: 'asset',
              fileName: path.posix.join(
                blockDir,
                destination,
                path.relative(from, filePath).split(path.sep).join('/')
              ),
              source: fs.readFileSync(filePath)
            })
          }
        }
      }
    }
  }
}

export default {
  input: Object.fromEntries([
    ...glob.sync('@(block-*)/component.js', { ignore: IGNORED_DIRS }).map(file => {
      const fileParts = file.split('/')
      return [
        fileParts[0],
        file
      ]
    }),
    /*
      A `worker.js` beside a component is a second entry point, compiled to `<block>.worker.js`.

      A web worker is loaded by URL rather than imported, so its code cannot be part of the bundle
      that starts it -- it has to be a file of its own, sitting in /_blocks where the block can point
      at it with `new URL('<block>.worker.js', import.meta.url)`. See `block-pdf`, which runs pdf.js's
      parser off the page's thread.
    */
    ...glob.sync('@(block-*)/worker.js', { ignore: IGNORED_DIRS }).map(file => {
      const fileParts = file.split('/')
      return [
        `${fileParts[0]}.worker`,
        file
      ]
    })
  ]),
  output: {
    dir: 'compiled',
    format: 'es'
  },
  plugins: [
    blocksManifest(),
    blockAssets(),
    cssAsString(),
    // -> `production` is stated rather than left to be inferred: since v16 the plugin picks the
    //    `development` or `production` export condition off `process.env.NODE_ENV`, and this build
    //    runs from a bare `npm run build` with no NODE_ENV set. Unstated, lit resolves to its
    //    development entry and every block ships the dev-mode warnings and asserts.
    resolve({ exportConditions: ['production'] }),
    // -> A block's own code is ESM, but a library it pulls in need not be: mermaid reaches for dayjs,
    //    which ships as UMD, and rollup has no notion of `module.exports` without this
    commonjs(),
    terser({
      ecma: 2019,
      module: true
    }),
    summary()
  ]
}
