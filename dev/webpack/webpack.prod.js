const webpack = require('webpack')
const merge = require('webpack-merge')
const path = require('path')

const CleanWebpackPlugin = require('clean-webpack-plugin')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const OfflinePlugin = require('offline-plugin')
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin')
const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin')

const common = require('./webpack.common.js')

module.exports = merge(common, {
  module: {
    rules: []
  },
  plugins: [
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
    new UglifyJSPlugin({
      cache: path.join(process.cwd(), '.webpack-cache/uglify'),
      parallel: true
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    new ExtractTextPlugin('css/bundle.css'),
    new OfflinePlugin({
      publicPath: '/',
      externals: ['/'],
      caches: {
        main: [
          'js/runtime.js',
          'js/vendor.js',
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
    }),
    new DuplicatePackageCheckerPlugin(),
    // Disable Extract Text Plugin stats:
    {
      apply(compiler) {
        compiler.plugin('done', stats => {
          if (Array.isArray(stats.compilation.children)) {
            stats.compilation.children = stats.compilation.children.filter(child => {
              return child.name.indexOf('extract-text-webpack-plugin') !== 0
            })
          }
        })
      }
    }
  ]
})
