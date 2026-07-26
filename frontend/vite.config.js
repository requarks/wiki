import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import yaml from 'js-yaml'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const userConfig = mode === 'development' ? {
    dev: { port: 3001, hmrClientPort: 3001 },
    ...yaml.load(fs.readFileSync(fileURLToPath(new URL('../config.yml', import.meta.url)), 'utf8'))
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
    optimizeDeps: {
      include: [
        'prosemirror-state',
        'prosemirror-transform',
        'prosemirror-model',
        'prosemirror-view'
      ]
    },
    plugins: [
      vue({
        template: {
          transformAssetUrls,
          // -> `iconify-icon` is a custom element registered by its package, not a Vue component
          compilerOptions: {
            isCustomElement: tag => tag === 'iconify-icon'
          }
        }
      }),
      quasar({
        autoImportComponentCase: 'kebab',
        sassVariables: '@/css/_theme.scss'
      }),
      vueDevTools()
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
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
