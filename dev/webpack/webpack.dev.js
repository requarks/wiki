const webpack = require('webpack')
const merge = require('webpack-merge')
const path = require('path')

const ExtractTextPlugin = require('extract-text-webpack-plugin')

const common = require('./webpack.common.js')

module.exports = merge(common, {
  entry: {
    client: ['./client/index.js', 'webpack-hot-middleware/client']
  },
  output: {
    pathinfo: true,
    publicPath: '/'
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development')
    }),
    new ExtractTextPlugin({ disable: true }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.WatchIgnorePlugin([
      /node_modules/
    ])
  ],
  watch: true
})
