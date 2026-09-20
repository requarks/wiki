import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// -> A named import: js-yaml 5 ships ESM with no default export, so `import yaml from` throws
import { load as loadYaml } from 'js-yaml'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const TWEMOJI_ROUTE = '/_assets/svg/twemoji'

/**
 * Where the Excalidraw editor's own assets are served from.
 *
 * Handed to it as `window.EXCALIDRAW_ASSET_PATH` (`src/editor/excalidraw/index.js`), which is what it
 * resolves every font it fetches at runtime against. Setting it matters beyond tidiness: left unset,
 * Excalidraw falls back to a CDN of its own -- and it appends that fallback even when the variable IS
 * set, so a font this build fails to ship does not break, it quietly fetches from a third party. That
 * is exactly what `WIKI.config.offline` exists to prevent, and there is no switch in Excalidraw to
 * turn it off, so shipping the complete set is the only thing that keeps the reader's browser at home.
 */
const EXCALIDRAW_ROUTE = '/_assets/excalidraw'

/**
 * The drawing fonts NOT shipped with the build, by the directory they live in.
 *
 * Xiaolai is Excalidraw's CJK handwriting fallback and is 13 MB across a thousand subset files -- more
 * than the rest of the wiki's assets put together, for a font most instances will never draw a glyph
 * of. Left out, a drawing containing CJK text falls through to the CDN described above and needs the
 * internet to come out right; everything else is local. Revisit if that trade stops being the right
 * one -- it is one name in this set.
 */
const EXCALIDRAW_SKIPPED_FONTS = new Set(['Xiaolai'])

/**
 * Fails the build unless every emoji a page can contain has an SVG in `svgDir`.
 *
 * The parser and the artwork are two dependencies of the same upstream release (see below), so they
 * can drift apart on an upgrade with nothing to say so -- and what that looks like is a page with a
 * broken image in it, or an emoji quietly left to whatever font the reader has. Both are cheap to
 * rule out here: the renderer hands the emoji plugin's tokens to twemoji and nothing else -- a raw 🎉
 * typed into a page stays a character -- so `markdown-it-emoji`'s shortcode map IS the vocabulary, and
 * running the parser over it yields exactly the set of files a page can ask for.
 *
 * `@twemoji/api` is pinned a patch behind for this reason: 17.0.3 moved to `@twemoji/parser` 17.0.2,
 * which stopped matching ✌️ ☝️ 🕵️ 🏋️ and six others at all, leaving them as text. This is the check
 * that catches it.
 */
async function verifyTwemojiCoverage(svgDir) {
  const [{ default: twemoji }, { default: shortcodes }] = await Promise.all([
    import('@twemoji/api'),
    import('markdown-it-emoji/lib/data/full.mjs')
  ])
  const unmatched = []
  const missing = []
  for (const [shortcode, emoji] of Object.entries(shortcodes)) {
    const icons = []
    twemoji.parse(emoji, {
      callback(icon) {
        if (icon) {
          icons.push(icon)
        }
        // -> Nothing is being rendered here; the callback is only how the names are read back out
        return false
      }
    })
    if (icons.length === 0) {
      unmatched.push(`:${shortcode}:`)
      continue
    }
    for (const icon of icons) {
      if (!fs.existsSync(path.join(svgDir, `${icon}.svg`))) {
        missing.push(`:${shortcode}: (${icon}.svg)`)
      }
    }
  }
  const complaints = [
    unmatched.length > 0 &&
      `${unmatched.length} the parser no longer matches: ${unmatched.join(' ')}`,
    missing.length > 0 && `${missing.length} with no SVG in ${svgDir}: ${missing.join(' ')}`
  ].filter(Boolean)
  if (complaints.length > 0) {
    throw new Error(
      `twemoji: ${complaints.join('; ')}. Check that '@twemoji/api' and the 'twemoji-assets' tarball in package.json still name the same upstream release.`
    )
  }
}

/**
 * Makes the twemoji SVGs reachable at `/_assets/svg/twemoji/<codepoints>.svg`, which is the `src` the
 * markdown renderer writes for every emoji (`src/renderers/markdown.js`).
 *
 * They are neither committed nor imported: the set is ~4000 files and 18 MB, every one of which a page
 * may ask for and none of which is a build input -- nothing in the source names an individual icon, so
 * Vite has no way to discover them. So they are copied into the build output alongside `public/_assets/`
 * and read from `node_modules` on the fly in dev; under `public/` they would be 4000 files in git for a
 * directory that is derived.
 *
 * `@twemoji/api` is the parser alone -- the artwork has never been published to npm, by Twitter or by
 * the fork that maintains it now, and the one package that did (`@twemoji/svg`) stopped at Unicode 15.
 * So `package.json` takes it from the upstream repository at a pinned tag, as a tarball dependency
 * (`twemoji-assets`). npm records its integrity hash in the lockfile like any other dependency, so it
 * is fetched once at install time and the build itself needs no network.
 */
function twemojiAssets() {
  const svgDir = path.join(
    path.dirname(createRequire(import.meta.url).resolve('twemoji-assets/package.json')),
    'assets/svg'
  )
  let outDir = null

  return {
    name: 'wiki-twemoji-assets',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      // -> connect strips the prefix, so `req.url` is just the file name here
      server.middlewares.use(TWEMOJI_ROUTE, (req, res, next) => {
        // -> Both a traversal guard and a cheap 404 for anything that is not one of these files
        const name = path.basename(req.url.split('?')[0])
        if (!/^[0-9a-f]+(-[0-9a-f]+)*\.svg$/.test(name)) {
          next()
          return
        }
        fs.promises.readFile(path.join(svgDir, name)).then((svg) => {
          res.setHeader('Content-Type', 'image/svg+xml')
          res.end(svg)
        }, next)
      })
    },
    // -> Not `emitFile`: 4000 assets through rollup for files that need no processing at all
    async writeBundle() {
      await verifyTwemojiCoverage(svgDir)
      await fs.promises.cp(svgDir, path.join(outDir, TWEMOJI_ROUTE.slice(1)), { recursive: true })
    }
  }
}

/**
 * Excalidraw's drawing fonts, as the package describes them to itself.
 *
 * Read out of the UNMINIFIED build in `dist/dev`, which carries the same registry the minified one
 * runs and is the only copy with names left on it. Nothing is imported or executed: it is browser code
 * that touches `window` as it loads, and all that is wanted from it is a table.
 *
 * Each family is `var <Group>FontFaces = [{ uri, descriptors: { unicodeRange } }]`, where `uri` names a
 * `var <X>_default = "./fonts/..."` beside it, and `init("Family Name", ...<Group>FontFaces)` further
 * down is what gives the family the name CSS has to match. A face whose `uri` resolves to no file is a
 * system font (`LOCAL_FONT_PROTOCOL` -- Helvetica and the emoji fallback) and has nothing to serve.
 *
 * @throws When the shape has changed, which on an upgrade is the difference between noticing here and
 *   shipping a wiki whose drawings all render in the browser's default font.
 */
function readExcalidrawFonts(distDir) {
  const devDir = path.join(distDir, 'dev')
  const chunk = fs
    .readdirSync(devDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(devDir, name))
    .find((file) => fs.readFileSync(file, 'utf8').includes('FontFaces = ['))
  if (!chunk) {
    throw new Error(`excalidraw: no font registry found in ${devDir}`)
  }
  const src = fs.readFileSync(chunk, 'utf8')

  const files = new Map()
  for (const m of src.matchAll(/var (\w+_default) = "\.\/(fonts\/[^"]+)";/g)) {
    files.set(m[1], m[2])
  }
  const names = new Map()
  for (const m of src.matchAll(/init\(\s*"([^"]+)"\s*,\s*\.\.\.(\w+)FontFaces\s*\)/g)) {
    names.set(m[2], m[1])
  }

  const families = []
  for (const m of src.matchAll(/var (\w+)FontFaces = \[([\s\S]*?)\n\];/g)) {
    const [, group, body] = m
    const family = names.get(group)
    if (!family || EXCALIDRAW_SKIPPED_FONTS.has(group)) {
      continue
    }
    const faces = []
    for (const face of body.matchAll(
      /\{\s*uri:\s*(\w+)\s*(?:,\s*descriptors:\s*\{([\s\S]*?)\}\s*)?\}/g
    )) {
      const file = files.get(face[1])
      if (file) {
        faces.push({ file, unicodeRange: face[2]?.match(/unicodeRange:\s*"([^"]*)"/)?.[1] ?? '' })
      }
    }
    if (faces.length > 0) {
      families.push({ group, family, faces })
    }
  }
  if (families.length === 0) {
    throw new Error(
      `excalidraw: the font registry in ${path.basename(chunk)} parsed to nothing. Its shape has changed — see readExcalidrawFonts.`
    )
  }
  return families
}

/**
 * The Excalidraw editor's fonts: served in dev, copied on build, and declared to CSS.
 *
 * Two halves, because two different things need them and only one of them loads Excalidraw.
 *
 * The EDITOR fetches them itself, by the URL above, and would do so from a CDN if they were not here.
 *
 * A READER never loads Excalidraw at all -- a drawing is stored as the SVG the editor exported at save
 * time, and that SVG names its fonts and does not carry them. Excalidraw's own `@font-face` rules are
 * registered from JavaScript, so there is nothing for a page without it to inherit; hence the
 * generated stylesheet, which `main.js` imports so that every page has the declarations. It costs
 * about a kilobyte and downloads no font until a glyph actually needs one, so a wiki with no drawings
 * in it pays the kilobyte and nothing else.
 *
 * The files are neither committed nor imported, for the reason the twemoji assets above are not: they
 * are a directory of hashed subsets that no source file names, so Vite cannot discover them.
 */
function excalidrawAssets() {
  const distDir = path.resolve(
    path.dirname(createRequire(import.meta.url).resolve('@excalidraw/excalidraw')),
    '..'
  )
  const fontsDir = path.join(distDir, 'prod', 'fonts')
  const VIRTUAL_CSS = 'virtual:excalidraw-fonts.css'
  const RESOLVED_CSS = `\0${VIRTUAL_CSS}`
  let outDir = null

  return {
    name: 'wiki-excalidraw-assets',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    resolveId(id) {
      return id === VIRTUAL_CSS ? RESOLVED_CSS : null
    },
    load(id) {
      if (id !== RESOLVED_CSS) {
        return null
      }
      return readExcalidrawFonts(distDir)
        .flatMap(({ family, faces }) =>
          faces.map(
            ({ file, unicodeRange }) =>
              `@font-face{font-family:"${family}";font-style:normal;font-weight:400;font-display:swap;` +
              `src:url("${EXCALIDRAW_ROUTE}/${file}") format("woff2")` +
              `${unicodeRange ? `;unicode-range:${unicodeRange}` : ''}}`
          )
        )
        .join('\n')
    },
    configureServer(server) {
      // -> connect strips the prefix, so `req.url` starts at `/fonts/...` here
      server.middlewares.use(EXCALIDRAW_ROUTE, (req, res, next) => {
        const rel = path.normalize(req.url.split('?')[0]).replace(/^(\.\.[/\\])+/, '')
        const file = path.join(distDir, 'prod', rel)
        // -> Both a traversal guard and a cheap 404 for anything that is not one of these files
        if (!file.startsWith(fontsDir + path.sep) || !file.endsWith('.woff2')) {
          next()
          return
        }
        fs.promises.readFile(file).then((font) => {
          res.setHeader('Content-Type', 'font/woff2')
          res.end(font)
        }, next)
      })
    },
    // -> Not `emitFile`: these need no processing, and their names already carry a content hash
    async writeBundle() {
      const target = path.join(outDir, EXCALIDRAW_ROUTE.slice(1), 'fonts')
      await fs.promises.rm(target, { recursive: true, force: true })
      for (const family of await fs.promises.readdir(fontsDir)) {
        if (EXCALIDRAW_SKIPPED_FONTS.has(family)) {
          continue
        }
        await fs.promises.cp(path.join(fontsDir, family), path.join(target, family), {
          recursive: true
        })
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const userConfig =
    mode === 'development'
      ? {
          dev: { port: 3001, hmrClientPort: 3001 },
          ...loadYaml(
            fs.readFileSync(fileURLToPath(new URL('../config.yml', import.meta.url)), 'utf8')
          )
        }
      : {}

  return {
    build: {
      assetsDir: '_assets',
      chunkSizeWarningLimit: 5000,
      dynamicImportVarsOptions: {
        include: ['!/_blocks/**']
      },
      outDir: '../assets',
      rollupOptions: {
        // -> A second entry alongside the app: the markdown pipeline on its own, so the backend can
        //    drive it in a headless browser to re-render a page server-side
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          renderer: fileURLToPath(new URL('./src/renderers/headless.js', import.meta.url))
        },
        output: {
          // -> The renderer keeps a fixed name because it is referenced from a static page served by
          //    the backend, which has no way to look up a hashed one
          entryFileNames: (chunk) =>
            chunk.name === 'renderer' ? '_assets/renderer.js' : '_assets/[name]-[hash].js'
        }
      },
      target: 'es2022'
    },
    plugins: [
      vue({
        template: {
          /*
            `/_assets/...` paths are served by the BACKEND at runtime; they are not build inputs and
            there is nothing at that path on disk to resolve. Vue's default would turn each one into
            an import and fail the build. Quasar's Vite plugin used to supply this same setting.
          */
          transformAssetUrls: { includeAbsolute: false },
          // -> `iconify-icon` is a custom element registered by its package, not a Vue component
          compilerOptions: {
            isCustomElement: (tag) => tag === 'iconify-icon'
          }
        }
      }),
      tailwindcss(),
      twemojiAssets(),
      excalidrawAssets(),
      vueDevTools()
    ],
    css: {
      preprocessorOptions: {
        scss: {
          /*
            Every SFC style block gets these, which is what Quasar's Vite plugin used to do with its
            `sassVariables` option. Without it each file would have to import them itself, and the
            app's stylesheets are written against bare `$primary` / `$dark-3` / `$grey-4`.
          */
          additionalData: `@use '@/css/_theme.scss' as *; @use '@/css/_palette.scss' as *;`
        }
      }
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        /*
          markdown-it 15 dropped its `markdown-it/lib/*` subpath exports and put the parser internals
          on the main export as static classes. `markdown-it-mdc` still imports the old path, so
          without this the build fails to resolve it -- see the shim for the rest.
        */
        /*
          monaco-editor 0.56 declares `"./*.js": "./esm/vs/*.js"` in its exports map, so the full
          `monaco-editor/esm/vs/...` path a dependency writes now resolves to `esm/vs/esm/vs/...` and
          fails. y-monaco imports the API entry that way; this points it at the same file the app's
          own `monaco-editor` import lands on, which matters beyond resolving at all -- two copies of
          that module would give the binding a different `Range` class than the editor's.
        */
        'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor/editor/editor.api.js',
        'markdown-it/lib/token.mjs': fileURLToPath(
          new URL('./src/renderers/modules/markdown-it-token.js', import.meta.url)
        )
      }
    },
    server: {
      // https: true
      open: false, // opens browser window automatically
      host: '0.0.0.0',
      allowedHosts: true,
      port: userConfig.dev?.port,
      proxy: [
        '/_api',
        '/_blocks',
        '/_collab',
        '/_files',
        '/_icons',
        '/_site',
        '/_terminal',
        '/_thumb',
        /*
          Not `/_user`: that segment is shared. The backend serves avatars under it, while the app's
          own router owns the public profile page at `/_user/<id>` -- which has to be served by THIS
          dev server, or it would come back as the built shell from `assets/` and boot yesterday's
          bundle. A key starting with `^` is a regular expression to Vite, which is how the two are
          told apart. `backend/index.ts` draws the same line from the other side.
        */
        '^/_user/[^/]+/avatar'
      ].reduce((result, key) => {
        result[key] = {
          target: {
            host: '127.0.0.1',
            port: userConfig.port
          },
          // -> `_collab` and `_terminal` are websockets; the rest are unaffected by this being on
          ws: true
        }
        return result
      }, {}),
      hmr: {
        clientPort: userConfig.dev?.hmrClientPort
      }
    }
  }
})
