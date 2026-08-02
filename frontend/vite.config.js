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
      proxy: ['_api', '_blocks', '_collab', '_icons', '_site', '_thumb', '_user'].reduce(
        (result, key) => {
          result[`/${key}`] = {
            target: {
              host: '127.0.0.1',
              port: userConfig.port
            },
            // -> `_collab` is a websocket; the rest are unaffected by this being on
            ws: true
          }
          return result
        },
        {}
      ),
      hmr: {
        clientPort: userConfig.dev?.hmrClientPort
      }
    }
  }
})
