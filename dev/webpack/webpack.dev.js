const webpack = require('webpack')
const merge = require('webpack-merge')

const WriteFilePlugin = require('write-file-webpack-plugin')
const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin')

const common = require('./webpack.common.js')

module.exports = merge(common, {
  mode: 'development',
  entry: {
    client: ['./client/index.js', 'webpack-hot-middleware/client']
  },
  output: {
    pathinfo: true
  },
  plugins: [
    new SimpleProgressWebpackPlugin({
      format: 'compact'
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
      '__REACT_DEVTOOLS_GLOBAL_HOOK__': '({ isDisabled: true })'
    }),
    new WriteFilePlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.WatchIgnorePlugin([
      /node_modules/
    ])
  ],
  watch: true
})
