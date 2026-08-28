const webpack = require('webpack')
const path = require('path')
const fs = require('fs-extra')
const yargs = require('yargs').argv
const _ = require('lodash')

const common = require('./webpack.common')

process.noDeprecation = true

fs.emptyDirSync(path.join(process.cwd(), 'assets'))

module.exports = {
  mode: 'development',
  entry: _.mapValues(common.entries, entry => [entry, 'webpack-hot-middleware/client']),
  output: {
    ...common.outputBase,
    filename: 'js/[name].js',
    chunkFilename: 'js/[name].js',
    pathinfo: true
  },
  cache: common.cache(__filename),
  module: {
    rules: common.rules('style-loader')
  },
  plugins: [
    ...common.plugins(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.CURRENT_THEME': JSON.stringify(_.defaultTo(yargs.theme, 'default'))
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.WatchIgnorePlugin({
      paths: [
        /node_modules/
      ]
    })
  ],
  optimization: {
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
  resolve: common.resolve,
  stats: common.stats,
  target: 'web',
  watch: true
}
