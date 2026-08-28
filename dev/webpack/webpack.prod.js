const webpack = require('webpack')
const path = require('path')
const fs = require('fs-extra')
const yargs = require('yargs').argv
const _ = require('lodash')

const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const common = require('./webpack.common')

process.noDeprecation = true

fs.emptyDirSync(path.join(process.cwd(), 'assets'))

module.exports = {
  mode: 'production',
  entry: common.entries,
  output: {
    ...common.outputBase,
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].js'
  },
  cache: common.cache(__filename),
  module: {
    rules: common.rules(MiniCssExtractPlugin.loader)
  },
  plugins: [
    ...common.plugins(),
    new webpack.BannerPlugin('Wiki.js NG - github.com/swissmakers/wikijs-ng - Licensed under AGPL'),
    new MiniCssExtractPlugin({
      filename: 'css/bundle.[contenthash].css',
      chunkFilename: 'css/[name].[contenthash].css'
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
    splitChunks: {
      name: 'vendor',
      minChunks: 2
    },
    runtimeChunk: 'single',
    minimizer: [
      // Bounded parallelism: the default (CPU count - 1) workers can exhaust
      // memory on small build hosts and under QEMU emulation in CI
      new TerserPlugin({
        parallel: 2
      }),
      new CssMinimizerPlugin({
        parallel: 2,
        minimizerOptions: {
          preset: ['default', { discardComments: { removeAll: true } }]
        }
      })
    ]
  },
  resolve: common.resolve,
  stats: common.stats,
  target: 'web'
}
