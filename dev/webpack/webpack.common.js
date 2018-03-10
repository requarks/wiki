const path = require('path')
const fs = require('fs-extra')
const webpack = require('webpack')

const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const NameAllModulesPlugin = require('name-all-modules-plugin')

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
    chunkFilename: 'js/[name].chunk.js'
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
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader'
          },
          {
            loader: 'postcss-loader',
            options: postCSSConfig
          }
        ]
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'cache-loader',
              options: {
                cacheDirectory: cacheDir
              }
            },
            {
              loader: 'css-loader'
            },
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
        })
      },
      {
        test: /\.styl$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'cache-loader',
              options: {
                cacheDirectory: cacheDir
              }
            },
            {
              loader: 'css-loader'
            },
            {
              loader: 'postcss-loader',
              options: postCSSConfig
            },
            {
              loader: 'stylus-loader'
            }
          ]
        })
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            css: ExtractTextPlugin.extract({
              fallback: 'vue-style-loader',
              use: [
                {
                  loader: 'css-loader'
                },
                {
                  loader: 'postcss-loader',
                  options: postCSSConfig
                }
              ]
            }),
            scss: ExtractTextPlugin.extract({
              fallback: 'vue-style-loader',
              use: [
                {
                  loader: 'css-loader'
                },
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
              ]
            }),
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
      }
    ]
  },
  plugins: [
    new webpack.BannerPlugin('Wiki.js - wiki.js.org - Licensed under AGPL'),
    new CopyWebpackPlugin([
      { from: 'client/static' }
    ], {

    }),
    new webpack.NamedModulesPlugin(),
    new webpack.NamedChunksPlugin((chunk) => {
      if (chunk.name) {
        return chunk.name
      }
      return chunk.modules.map(m => path.relative(m.context, m.request)).join('_')
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks(module) {
        return module.context && module.context.includes('node_modules')
      }
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'runtime',
      minChunks: Infinity
    }),
    new NameAllModulesPlugin()
  ],
  resolve: {
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
  target: 'web'
}
