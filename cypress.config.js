const { defineConfig } = require('cypress')

module.exports = defineConfig({
  projectId: 'r7qxah',
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'dev/cypress/integration/**/*.spec.js',
    supportFile: 'dev/cypress/support/index.js',
    screenshotsFolder: 'dev/cypress/screenshots',
    videosFolder: 'dev/cypress/videos',
    fixturesFolder: false,
    numTestsKeptInMemory: 1,
    setupNodeEvents (on, config) {
      return require('./dev/cypress/plugins')(on, config)
    }
  }
})
