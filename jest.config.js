/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dev\/cypress\/'
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!@paralleldrive/cuid2)"
  ],
  rootDir: './',
  testMatch: ['**/server/test/**/*.test.js'],
  transform: {
    "^.+\\.js$": "babel-jest"
  }
}

module.exports = config
