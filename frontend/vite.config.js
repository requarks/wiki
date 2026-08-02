import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// -> A named import: js-yaml 5 ships ESM with no default export, so `import yaml from` throws
import { load as loadYaml } from 'js-yaml'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const userConfig = mode === 'development' ? {
    dev: { port: 3001, hmrClientPort: 3001 },
    ...loadYaml(fs.readFileSync(fileURLToPath(new URL('../config.yml', import.meta.url)), 'utf8'))
  } : {}

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
          entryFileNames: chunk => chunk.name === 'renderer' ? '_assets/renderer.js' : '_assets/[name]-[hash].js'
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
            isCustomElement: tag => tag === 'iconify-icon'
          }
        }
      }),
      tailwindcss(),
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
      proxy: ['_api', '_blocks', '_icons', '_site', '_thumb', '_user'].reduce((result, key) => {
        result[`/${key}`] = {
          target: {
            host: '127.0.0.1',
            port: userConfig.port
          }
        }
        return result
      }, {}),
      hmr: {
        clientPort: userConfig.dev?.hmrClientPort
      }
    }
  }
})
