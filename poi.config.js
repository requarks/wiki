const path = require('path')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
// const _ = require('lodash')
// const SpriteLoaderPlugin = require('svg-sprite-loader/plugin')

module.exports = options => ({
  entry: 'client/index.js',
  dist: 'assets',
  staticFolder: 'client/static',
  filename: {
    js: 'js/[name].js',
    css: 'css/bundle.css',
    images: 'images/[name].[ext]',
    fonts: 'fonts/[name].[ext]',
    chunk: 'js/[name].chunk.js'
  },
  autoprefixer: {
    browsers: [
      'last 6 Chrome major versions',
      'last 6 Firefox major versions',
      'last 4 Safari major versions',
      'last 4 Edge major versions',
      'last 3 iOS major versions',
      'last 3 Android major versions',
      'last 2 ChromeAndroid major versions',
      'Explorer 11'
    ]
  },
  html: false,
  hash: false,
  sourceMap: false,
  extendWebpack (config) {
    // Vue - Default SCSS Imports
    config.module.rule('vue')
      .use('vue-loader')
      .tap(opts => {
        opts.loaders.scss.push({
          loader: 'sass-resources-loader',
          options: {
            resources: path.join(__dirname, './client/scss/global.scss')
          }
        })
        return opts
      })

    // SVG Loader
    config.module.rule('svg')
      .exclude.add(path.join(__dirname, './client/svg')).end()
      .use('file-loader')
      .tap(opts => {
        opts.name = '[name].[ext]'
        opts.outputPath = 'svg/'
        return opts
      })
    config.module.rule('svgSymbols')
      .include.add(path.join(__dirname, './client/svg')).end()
      .use('raw-loader')
      .loader('raw-loader')

    // config.module.rule('svg').uses.delete('file-loader')
    // config.module.rule('svg')
    //   .use('svg-sprite-loader')
    //   .loader('svg-sprite-loader', {
    //     extract: true,
    //     spriteFilename: 'svg/symbols.svg'
    //   })
    // config.plugin('svg-sprite-loader')
    //   .use(SpriteLoaderPlugin)

    // Vue with Compiler Alias
    config.resolve.alias.set('vue$', 'vue/dist/vue.common.js')

    // Bundle Analyze
    if (options.analyze) {
      config.plugin('analyzer').use(BundleAnalyzerPlugin, [{
        analyzerMode: 'static'
      }])
    }
  },
  webpack (config) {
    return config
  }
})
