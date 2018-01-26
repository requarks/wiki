const path = require('path')
const fs = require('fs-extra')
const webpack = require('webpack')

const CopyWebpackPlugin = require('copy-webpack-plugin')
const ProgressBarPlugin = require('progress-bar-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const babelConfig = fs.readJsonSync(path.join(process.cwd(), '.babelrc'))

module.exports = {
  entry: './client/index.js',
  output: {
    path: path.join(process.cwd(), 'assets'),
    pathinfo: true,
    filename: 'js/[name].js',
    chunkFilename: 'js/[name].chunk.js',
    publicPath: '/'
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
              cacheDirectory: '.webpack-cache'
            }
          },
          {
            loader: 'babel-loader',
            options: {
              ...babelConfig,
              cacheDirectory: true
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              autoprefixer: false,
              sourceMap: false,
              minimize: true
            }
          }
        ]
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'css-loader',
              options: {
                autoprefixer: false,
                sourceMap: false,
                minimize: true
              }
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: false
              }
            }
          ]
        })
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            css: [
              {
                loader: 'vue-style-loader'
              },
              {
                loader: 'css-loader',
                options: {
                  autoprefixer: false,
                  sourceMap: false,
                  minimize: true
                }
              }
            ],
            scss: [
              {
                loader: 'vue-style-loader'
              },
              {
                loader: 'css-loader',
                options: {
                  autoprefixer: false,
                  sourceMap: false,
                  minimize: true
                }
              },
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
            js: {
              loader: 'babel-loader',
              options: {
                babelrc: path.join(process.cwd(), '.babelrc'),
                cacheDirectory: true
              }
            }
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
      }
    ]
  },
  plugins: [
    new ProgressBarPlugin({
      width: 72,
      complete: '▇',
      incomplete: '-'
    }),
    new webpack.BannerPlugin('Wiki.js - wiki.js.org - Licensed under AGPL'),
    new CopyWebpackPlugin([
      { from: 'client/static' }
    ], {

    }),
    new ExtractTextPlugin('css/bundle.css')
  ],
  resolve: {
    symlinks: true,
    alias: {
      '@': path.join(process.cwd(), 'client'),
      'vue$': 'vue/dist/vue.common.js'
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
  target: 'web'
}
