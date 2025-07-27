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
        warnOnError: true,
        include: ['!/_blocks/**']
      },
      outDir: '../assets',
      target: 'es2022',
      ...(mode === 'production') && {
        rollupOptions: {
          output: {
            manualChunks (id) {
              if (id.includes('lodash')) {
                return 'lodash'
              // } else if (id.includes('quasar')) {
              //   return 'quasar'
              } else if (id.includes('pages/Admin')) {
                return 'admin'
              } else if (id.includes('pages/Profile')) {
                return 'profile'
              }
            }
          }
        }
      }
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
        template: { transformAssetUrls }
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
      allowedHosts: true,
      port: userConfig.dev?.port,
      proxy: ['_graphql', '_blocks', '_site', '_thumb', '_user'].reduce((result, key) => {
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
