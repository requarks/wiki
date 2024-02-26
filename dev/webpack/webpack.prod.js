const webpack = require('webpack')
const path = require('path')
const fs = require('fs-extra')
const yargs = require('yargs').argv
const _ = require('lodash')

const { VueLoaderPlugin } = require('vue-loader')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlWebpackPugPlugin = require('html-webpack-pug-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const MomentTimezoneDataPlugin = require('moment-timezone-data-webpack-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin')
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin')
const WebpackBarPlugin = require('webpackbar')

const now = Math.round(Date.now() / 1000)

const babelConfig = fs.readJsonSync(path.join(process.cwd(), '.babelrc'))
const cacheDir = '.webpack-cache/cache'
const babelDir = path.join(process.cwd(), '.webpack-cache/babel')

process.noDeprecation = true

fs.emptyDirSync(path.join(process.cwd(), 'assets'))

module.exports = {
  mode: 'production',
  entry: {
    app: './client/index-app.js',
    legacy: './client/index-legacy.js',
    setup: './client/index-setup.js'
  },
  output: {
    path: path.join(process.cwd(), 'assets'),
    publicPath: '/_assets/',
    filename: `js/[name].js?${now}`,
    chunkFilename: `js/[name].js?${now}`,
    globalObject: 'this',
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
        test: /\.css$/,
        use: [
          'style-loader',
          MiniCssExtractPlugin.loader,
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
          MiniCssExtractPlugin.loader,
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
        test: /\.svg$/,
        exclude: [
          path.join(process.cwd(), 'node_modules/grapesjs')
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
    new webpack.BannerPlugin('Wiki.js - wiki.js.org - Licensed under AGPL'),
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
    new MiniCssExtractPlugin({
      filename: 'css/bundle.[hash].css',
      chunkFilename: 'css/[name].[chunkhash].css'
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/master.pug',
      filename: '../server/views/master.pug',
      hash: false,
      inject: false,
      excludeChunks: ['setup', 'legacy']
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/legacy.pug',
      filename: '../server/views/legacy/master.pug',
      hash: false,
      inject: false,
      excludeChunks: ['setup', 'app']
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/setup.pug',
      filename: '../server/views/setup.pug',
      hash: false,
      inject: false,
      excludeChunks: ['app', 'legacy']
    }),
    new HtmlWebpackPugPlugin(),
    new ScriptExtHtmlWebpackPlugin({
      sync: 'runtime.js',
      defaultAttribute: 'async'
    }),
    new WebpackBarPlugin({
      name: 'Client Assets'
    }),
    new CleanWebpackPlugin(),
    new OptimizeCssAssetsPlugin({
      cssProcessorOptions: { discardComments: { removeAll: true } },
      canPrint: true
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.CURRENT_THEME': JSON.stringify(_.defaultTo(yargs.theme, 'default'))
    }),
    new webpack.optimize.MinChunkSizePlugin({
      minChunkSize: 50000
    })
  ],
  optimization: {
    namedModules: true,
    namedChunks: true,
    splitChunks: {
      name: 'vendor',
      minChunks: 2
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
  target: 'web'
}
