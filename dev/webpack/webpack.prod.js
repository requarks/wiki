const webpack = require('webpack')
const merge = require('webpack-merge')

const CleanWebpackPlugin = require('clean-webpack-plugin')
const OfflinePlugin = require('offline-plugin')
const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')

const common = require('./webpack.common.js')

module.exports = merge(common, {
  mode: 'production',
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
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
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
  ]
})
