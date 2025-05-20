const webpack = require('webpack')
const path = require('path')
const fs = require('fs-extra')
const yargs = require('yargs').argv
const _ = require('lodash')

const { VueLoaderPlugin } = require('vue-loader')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlWebpackPugPlugin = require('html-webpack-pug-plugin')
const MomentTimezoneDataPlugin = require('moment-timezone-data-webpack-plugin')
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin')
const WriteFilePlugin = require('write-file-webpack-plugin')
const WebpackBarPlugin = require('webpackbar')

const babelConfig = fs.readJsonSync(path.join(process.cwd(), '.babelrc'))
const cacheDir = '.webpack-cache/cache'
const babelDir = path.join(process.cwd(), '.webpack-cache/babel')

const { CKEditorTranslationsPlugin } = require('@ckeditor/ckeditor5-dev-translations')
const CKEditorWebpackPlugin = require('@ckeditor/ckeditor5-dev-webpack-plugin')
const { bundler, styles } = require('@ckeditor/ckeditor5-dev-utils')

const { GenerateSW } = require('workbox-webpack-plugin')

process.noDeprecation = true

fs.emptyDirSync(path.join(process.cwd(), 'assets'))

module.exports = {
  mode: 'development',
  entry: {
    app: ['./client/index-app.js', 'webpack-hot-middleware/client'],
    legacy: ['./client/index-legacy.js', 'webpack-hot-middleware/client'],
    setup: ['./client/index-setup.js', 'webpack-hot-middleware/client']
  },
  output: {
    path: path.join(process.cwd(), 'assets'),
    publicPath: '/_assets/',
    filename: 'js/[name].js',
    chunkFilename: 'js/[name].js',
    globalObject: 'this',
    pathinfo: true,
    crossOriginLoading: 'use-credentials'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: (modulePath) => {
          return modulePath.includes('node_modules') && !modulePath.includes('vuetify')
        },
        use: [
          {
            loader: 'cache-loader',
            options: {
              cacheDirectory: cacheDir
            }
          },
          {
            loader: 'babel-loader',
            options: {
              ...babelConfig,
              cacheDirectory: babelDir
            }
          }
        ]
      },
      {
        test: /ckeditor5-[^/\\]+[/\\]theme[/\\].+\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              injectType: 'singletonStyleTag',
              attributes: {
                'data-cke': true
              }
            }
          },
          'css-loader',
          {
            loader: 'postcss-loader',
            options: styles.getPostCssConfig({
              themeImporter: {
                themePath: require.resolve('@ckeditor/ckeditor5-theme-lark')
              },
              minify: true
            })
          }
        ]
      },
      {
        test: /^(?!.*ckeditor).*\.css$/,
        exclude: [
          /ckeditor5-[^/\\]+[/\\]theme[/\\].+\.css$/,
          path.join(__dirname, 'node_modules', '@ckeditor')
        ],
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader'
        ]
      },
      {
        test: /\.sass$/,
        use: [
          {
            loader: 'cache-loader',
            options: {
              cacheDirectory: cacheDir
            }
          },
          'style-loader',
          'css-loader',
          'postcss-loader',
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
              sourceMap: false,
              sassOptions: {
                fiber: false
              }
            }
          }
        ]
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'cache-loader',
            options: {
              cacheDirectory: cacheDir
            }
          },
          'style-loader',
          'css-loader',
          'postcss-loader',
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
              sourceMap: false,
              sassOptions: {
                fiber: false
              }
            }
          },
          {
            loader: 'sass-resources-loader',
            options: {
              resources: path.join(process.cwd(), '/client/scss/global.scss')
            }
          }
        ]
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.pug$/,
        exclude: [
          path.join(process.cwd(), 'dev')
        ],
        loader: 'pug-plain-loader'
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192
            }
          }
        ]
      },
      {
        test: /ckeditor5-[^/\\]+[/\\]theme[/\\]icons[/\\][^/\\]+\.svg$/,
        use: [ 'raw-loader' ]
      },
      {
        test: /ckeditor5-svg[/\\][^/\\]+\.svg$/,
        use: [ 'raw-loader' ]
      },
      {
        test: /\.svg$/,
        exclude: [
          path.join(process.cwd(), 'node_modules/grapesjs'),
          /ckeditor5-[^/\\]+[/\\]theme[/\\]icons[/\\][^/\\]+\.svg$/,
          /ckeditor5-svg[/\\][^/\\]+\.svg$/
        ],
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'svg/'
            }
          }
        ]
      },
      {
        test: /\.(graphql|gql)$/,
        exclude: /node_modules/,
        use: [
          { loader: 'graphql-persisted-document-loader' },
          { loader: 'graphql-tag/loader' }
        ]
      },
      {
        test: /\.(woff2|woff|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: 'fonts/'
          }
        }]
      },
      {
        loader: 'webpack-modernizr-loader',
        test: /\.modernizrrc\.js$/
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    new VuetifyLoaderPlugin(),
    new MomentTimezoneDataPlugin({
      startYear: 2017,
      endYear: (new Date().getFullYear()) + 5
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'client/static' },
        { from: './node_modules/prismjs/components', to: 'js/prism' }
      ]
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/master.pug',
      filename: '../server/views/master.pug',
      hash: true,
      inject: false,
      excludeChunks: ['setup', 'legacy']
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/legacy.pug',
      filename: '../server/views/legacy/master.pug',
      hash: true,
      inject: false,
      excludeChunks: ['setup', 'app']
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/setup.pug',
      filename: '../server/views/setup.pug',
      hash: true,
      inject: false,
      excludeChunks: ['app', 'legacy']
    }),
    new HtmlWebpackPugPlugin(),
    new WebpackBarPlugin({
      name: 'Client Assets'
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.CURRENT_THEME': JSON.stringify(_.defaultTo(yargs.theme, 'default'))
    }),
    new WriteFilePlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.WatchIgnorePlugin([
      /node_modules/
    ]),
    new CKEditorWebpackPlugin({
      // UI language. Language codes follow the https://en.wikipedia.org/wiki/ISO_639-1 format.
      // When changing the built-in language, remember to also change it in the editor's configuration (client/components/editor/ckeditor/ckeditor.js).
      language: 'en',
      additionalLanguages: 'all',
      buildAllTranslationsToSeparateFiles: true
    }),
    new webpack.BannerPlugin({
      banner: bundler.getLicenseBanner(),
      raw: true
    }),
    new CKEditorTranslationsPlugin({
      // See https://ckeditor.com/docs/ckeditor5/latest/features/ui-language.html
      language: 'en',
      buildAllTranslationsToSeparateFiles: true
    }),
    new GenerateSW({
      clientsClaim: true,
      skipWaiting: true,
      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024 // optional 10MB limit
    })
  ],
  optimization: {
    namedModules: true,
    namedChunks: true,
    splitChunks: {
      cacheGroups: {
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          minChunks: 2,
          priority: -10
        }
      }
    },
    runtimeChunk: 'single'
  },
  resolve: {
    mainFields: ['browser', 'main', 'module'],
    symlinks: true,
    alias: {
      '@': path.join(process.cwd(), 'client'),
      'vue$': 'vue/dist/vue.esm.js',
      'gql': path.join(process.cwd(), 'client/graph'),
      // Duplicates fixes:
      'apollo-link': path.join(process.cwd(), 'node_modules/apollo-link'),
      'apollo-utilities': path.join(process.cwd(), 'node_modules/apollo-utilities'),
      'uc.micro': path.join(process.cwd(), 'node_modules/uc.micro'),
      'modernizr$': path.resolve(process.cwd(), 'client/.modernizrrc.js')
    },
    extensions: [
      '.js',
      '.json',
      '.vue'
    ],
    modules: [
      'node_modules'
    ]
  },
  node: {
    fs: 'empty'
  },
  stats: {
    children: false,
    entrypoints: false
  },
  target: 'web',
  watch: true
  // devtool: 'eval-source-map' // Enable better source maps for dev (optional)
}
