module.exports = {
  client: {
    service: {
      name: 'wiki-core',
      // URL to the GraphQL API
      url: 'http://localhost:11511'
    },
    // Files processed by the extension
    includes: [
      'src/**/*.vue',
      'src/**/*.js'
    ]
  }
}
