/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dev\/cypress\/'
  ],
  rootDir: './',
  testMatch: ['**/server/test/**/*.test.js']
}

module.exports = config
