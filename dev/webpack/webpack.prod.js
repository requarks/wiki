const webpack = require('webpack')
const merge = require('webpack-merge')

const CleanWebpackPlugin = require('clean-webpack-plugin')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const OfflinePlugin = require('offline-plugin')
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin')

const common = require('./webpack.common.js')

module.exports = merge(common, {
  module: {
    rules: []
  },
  plugins: [
    new CleanWebpackPlugin([
      'assets/js/*.*',
      'assets/css/*.*',
      'assets/*.js',
      'assets/*.json'
    ], {
      root: process.cwd(),
      verbose: false
    }),
    new UglifyJSPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    new ExtractTextPlugin('css/bundle.css'),
    new OfflinePlugin({
      caches: {
        main: [
          'js/runtime.js',
          'js/vendor.js',
          'js/client.js'
        ],
        additional: [':externals:'],
        optional: ['*.chunk.js']
      }
    }),
    new DuplicatePackageCheckerPlugin()
  ]
})
