const webpack = require('webpack')
const path = require('path')
const fs = require('fs-extra')
const yargs = require('yargs').argv
const _ = require('lodash')

const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlWebpackPugPlugin = require('html-webpack-pug-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin')
const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin')
const SriWebpackPlugin = require('webpack-subresource-integrity')
const { VueLoaderPlugin } = require('vue-loader')

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
    publicPath: '/',
    filename: 'js/[name].[hash].js',
    chunkFilename: 'js/[name].[chunkhash].js',
    globalObject: 'this',
    crossOriginLoading: 'use-credentials'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
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
              sourceMap: false
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
        test: /\.styl$/,
        use: [
          'style-loader',
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
          'stylus-loader'
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
          path.join(process.cwd(), 'client/svg'),
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
        test: /\.svg$/,
        include: [
          path.join(process.cwd(), 'client/svg')
        ],
        use: [
          {
            loader: 'raw-loader'
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
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        exclude: [
          path.join(process.cwd(), 'client')
        ],
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: 'fonts/'
          }
        }]
      },
      {
        test: /.jsx$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          presets: ['es2015', 'react']
        }
      },
      {
        test: /\.flow$/,
        loader: 'ignore-loader'
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    new webpack.BannerPlugin('Wiki.js - wiki.js.org - Licensed under AGPL'),
    new CopyWebpackPlugin([
      { from: 'client/static' },
      { from: './node_modules/graphql-voyager/dist/voyager.worker.js', to: 'js/' }
    ], {}),
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
    new SriWebpackPlugin({
      hashFuncNames: ['sha256', 'sha512'],
      enabled: true
    }),
    new SimpleProgressWebpackPlugin({
      format: 'expanded'
    }),
    new CleanWebpackPlugin(),
    new OptimizeCssAssetsPlugin({
      cssProcessorOptions: { discardComments: { removeAll: true } },
      canPrint: true
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.CURRENT_THEME': JSON.stringify(_.defaultTo(yargs.theme, 'default')),
      '__REACT_DEVTOOLS_GLOBAL_HOOK__': '({ isDisabled: true })'
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
      'mdi': path.resolve(process.cwd(), 'node_modules/vue-material-design-icons'),
      // Duplicates fixes:
      'apollo-link': path.join(process.cwd(), 'node_modules/apollo-link'),
      'apollo-utilities': path.join(process.cwd(), 'node_modules/apollo-utilities'),
      'uc.micro': path.join(process.cwd(), 'node_modules/uc.micro')
    },
    extensions: [
      '.js',
      '.json',
      'jsx',
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
