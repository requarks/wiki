import neostandard from 'neostandard'

export default neostandard({
  globals: {
    document: false,
    navigator: false,
    window: false,
    WIKI: true
  },
  ignores: [
    '**/node_modules/**',
    '**/*.min.js',
    'coverage/**',
    'repo/**',
    'data/**',
    'logs/**',
    'locales/**'
  ]
})
