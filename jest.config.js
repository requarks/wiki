/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'node',
  // Make CI/Sonar happy: always write machine-readable test results.
  // SonarQube reads this path from `sonar.junit.reportPaths`.
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'test-results', outputName: 'report.xml' }]
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dev/cypress/'
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!@paralleldrive/cuid2)'
  ],
  rootDir: './',
  testMatch: ['**/server/test/**/*.test.js'],
  // Ensure coverage artifacts are generated consistently for Sonar.
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text-summary'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
}

module.exports = config
