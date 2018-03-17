const path = require('path')
const fs = require('fs-extra')
const webpack = require('webpack')

const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const HtmlWebpackPugPlugin = require('html-webpack-pug-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin')

const babelConfig = fs.readJsonSync(path.join(process.cwd(), '.babelrc'))
const postCSSConfig = {
  config: {
    path: path.join(process.cwd(), 'dev/config/postcss.config.js')
  }
}
const cacheDir = '.webpack-cache/cache'
const babelDir = path.join(process.cwd(), '.webpack-cache/babel')

process.noDeprecation = true

module.exports = {
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
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader',
            options: postCSSConfig
          }
        ]
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader',
            options: postCSSConfig
          },
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
          {
            loader: 'postcss-loader',
            options: postCSSConfig
          },
          'stylus-loader'
        ]
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            css: [
              'vue-style-loader',
              MiniCssExtractPlugin.loader,
              'css-loader',
              {
                loader: 'postcss-loader',
                options: postCSSConfig
              }
            ],
            scss: [
              'vue-style-loader',
              MiniCssExtractPlugin.loader,
              'css-loader',
              {
                loader: 'postcss-loader',
                options: postCSSConfig
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
        test: /\.flow$/,
        loader: 'ignore-loader'
      }
    ]
  },
  plugins: [
    new webpack.BannerPlugin('Wiki.js - wiki.js.org - Licensed under AGPL'),
    new CopyWebpackPlugin([
      { from: 'client/static' }
    ], {

    }),
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
      'mdi': path.resolve(process.cwd(), 'node_modules/vue-material-design-icons'),
      // Duplicates fixes:
      'apollo-link': path.join(process.cwd(), 'node_modules/apollo-link'),
      'apollo-utilities': path.join(process.cwd(), 'node_modules/apollo-utilities'),
      'uc.micro': path.join(process.cwd(), 'node_modules/uc.micro')
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
