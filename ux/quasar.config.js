/* eslint-env node */

/*
 * This file runs in a Node context (it's NOT transpiled by Babel), so use only
 * the ES6 features that are supported by your Node version. https://node.green/
 */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

const { configure } = require('quasar/wrappers')
const path = require('path')
const yaml = require('js-yaml')
const fs = require('fs')

module.exports = configure(function (ctx) {
  const userConfig = ctx.dev ? {
    dev: { port: 3001, hmrClientPort: 3001 },
    ...yaml.load(fs.readFileSync(path.resolve(__dirname, '../config.yml'), 'utf8'))
  } : {}

  return {
    eslint: {
      fix: true,
      // include = [],
      // exclude = [],
      // rawOptions = {},
      warnings: true,
      errors: true
    },

    // https://v2.quasar.dev/quasar-cli/prefetch-feature
    preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli/boot-files
    boot: [
      'apollo',
      'components',
      'externals',
      'eventbus',
      'i18n',
      {
        server: false,
        path: 'monaco'
      }
    ],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: [
      'app.scss'
    ],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v5',
      // 'mdi-v7',
      // 'fontawesome-v6',
      // 'eva-icons',
      // 'themify',
      'line-awesome'
      // 'roboto-font-latin-ext' // this or either 'roboto-font', NEVER both!
      // 'roboto-font', // optional, you are not bound to it
      // 'material-icons' // optional, you are not bound to it
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
    build: {
      target: {
        browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
        node: 'node18'
      },

      vueRouterMode: 'history', // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,
      vueOptionsAPI: false,

      rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      // env: {},
      // rawDefine: {}
      // ignorePublicFolder: true,
      // minify: false,
      // polyfillModulePreload: true,
      distDir: '../assets',

      extendViteConf (viteConf) {
        if (ctx.prod) {
          viteConf.build.assetsDir = '_assets'
          viteConf.build.rollupOptions = {
            ...viteConf.build.rollupOptions ?? {},
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
          viteConf.build.chunkSizeWarningLimit = 5000
          viteConf.build.dynamicImportVarsOptions = {
            warnOnError: true,
            include: ['!/_blocks/**']
          }
          viteConf.optimizeDeps.include = [
            'prosemirror-state',
            'prosemirror-transform',
            'prosemirror-model',
            'prosemirror-view'
          ]
        }
      },
      // viteVuePluginOptions: {},

      vitePlugins: [
        ['@intlify/unplugin-vue-i18n/vite', {
          // if you want to use Vue I18n Legacy API, you need to set `compositionOnly: false`
          // compositionOnly: false,

          // you need to set i18n resource including paths !
          include: path.resolve(__dirname, './src/i18n/locales/**')
        }]
      ]
      // sourcemap: true
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
    devServer: {
      // https: true
      open: false, // opens browser window automatically
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
      },
      vueDevtools: true
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
    framework: {
      config: {
        brand: {
          header: '#000',
          sidebar: '#1976D2'
        },
        loading: {
          delay: 500,
          spinner: 'QSpinnerGrid',
          spinnerSize: 32,
          spinnerColor: 'white',
          customClass: 'loading-darker'
        },
        loadingBar: {
          color: 'primary',
          size: '1px',
          position: 'top'
        },
        notify: {
          position: 'top',
          progress: true,
          color: 'green',
          icon: 'las la-check',
          actions: [
            {
              icon: 'las la-times',
              color: 'white',
              size: 'sm',
              round: true,
              handler: () => {}
            }
          ]
        }
      },

      iconSet: 'mdi-v7', // Quasar icon set
      lang: 'en-US', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: [
        'Dialog',
        'Loading',
        'LoadingBar',
        'Meta',
        'Notify'
      ]
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#property-sourcefiles
    sourceFiles: {
      // rootComponent: 'src/App.vue',
      // router: 'src/router/index',
      store: 'src/stores/index'
      // registerServiceWorker: 'src-pwa/register-service-worker',
      // serviceWorker: 'src-pwa/custom-service-worker',
      // pwaManifestFile: 'src-pwa/manifest.json',
      // electronMain: 'src-electron/electron-main',
      // electronPreload: 'src-electron/electron-preload'
    },

    // https://v2.quasar.dev/quasar-cli/developing-ssr/configuring-ssr
    ssr: {
      // ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
      // will mess up SSR

      // extendSSRWebserverConf (esbuildConf) {},
      // extendPackageJson (json) {},

      pwa: false,

      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'render' // keep this as last one
      ]
    },

    // https://v2.quasar.dev/quasar-cli/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: 'generateSW', // or 'injectManifest'
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
      useCredentialsForManifestTag: false
      // extendGenerateSWOptions (cfg) {}
      // extendInjectManifestOptions (cfg) {},
      // extendManifestJson (json) {}
      // extendPWACustomSWConf (esbuildConf) {}
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf)
      // extendElectronPreloadConf (esbuildConf)

      inspectPort: 5858,

      bundler: 'packager', // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options

        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',

        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: 'ux'
      }
    }
  }
})
