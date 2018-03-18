const webpack = require('webpack')
const path = require('path')
const fs = require('fs-extra')

const CleanWebpackPlugin = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlWebpackPugPlugin = require('html-webpack-pug-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OfflinePlugin = require('offline-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin')
const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin')

const babelConfig = fs.readJsonSync(path.join(process.cwd(), '.babelrc'))
const cacheDir = '.webpack-cache/cache'
const babelDir = path.join(process.cwd(), '.webpack-cache/babel')

process.noDeprecation = true

module.exports = {
  mode: 'production',
  entry: {
    client: './client/index.js'
  },
  output: {
    path: path.join(process.cwd(), 'assets'),
    publicPath: '/',
    filename: 'js/[name].js',
    chunkFilename: 'js/[name].js',
    globalObject: 'this'
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
        loader: 'vue-loader',
        options: {
          loaders: {
            scss: [
              'vue-style-loader',
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
            ],
            js: [
              {
                loader: 'cache-loader',
                options: {
                  cacheDirectory: cacheDir
                }
              },
              {
                loader: 'babel-loader',
                options: {
                  babelrc: path.join(process.cwd(), '.babelrc'),
                  cacheDirectory: babelDir
                }
              }
            ]
          }
        }
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
          path.join(process.cwd(), 'client/svg')
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
    new webpack.BannerPlugin('Wiki.js - wiki.js.org - Licensed under AGPL'),
    new CopyWebpackPlugin([
      { from: 'client/static' },
      { from: './node_modules/graphql-voyager/dist/voyager.worker.js', to: 'js/' }
    ], {}),
    new MiniCssExtractPlugin({
      filename: 'css/bundle.css',
      chunkFilename: 'css/[name].css'
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/master.pug',
      filename: '../server/views/master.pug',
      hash: true,
      inject: 'head'
    }),
    new HtmlWebpackPugPlugin(),
    new ScriptExtHtmlWebpackPlugin({
      sync: 'runtime.js',
      defaultAttribute: 'async'
    }),
    new SimpleProgressWebpackPlugin({
      format: 'expanded'
    }),
    new CleanWebpackPlugin([
      'assets/js/*.*',
      'assets/css/*.*',
      'assets/*.js',
      'assets/*.json'
    ], {
      root: process.cwd(),
      verbose: false
    }),
    new OptimizeCssAssetsPlugin({
      cssProcessorOptions: { discardComments: { removeAll: true } },
      canPrint: true
    }),
    new OfflinePlugin({
      ServiceWorker: {
        minify: false
      },
      publicPath: '/',
      externals: ['/'],
      caches: {
        main: [
          'js/client.js'
        ],
        additional: [
          ':externals:'
        ],
        optional: [
          'js/*.chunk.js'
        ]
      },
      safeToUseOptionalCaches: true
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
