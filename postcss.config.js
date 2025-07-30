module.exports = {
  postcssOptions: {
    plugins: {
      autoprefixer: {},
      cssnano: {
        preset: [
          'default',
          {
            discardComments: {
              removeAll: true
            }
          }
        ]
      },
      'postcss-flexbugs-fixes': {},
      'postcss-flexibility': {},
      'postcss-preset-env': {}
    }
  }
}
