/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    "/dev\/cypress\/"
  ],
  "reporters": [
      [
        "jest-junit",
        {
          "outputDirectory": "./test-results",
          "outputName": "report.xml",
          "addFileAttribute": "true"
        }
      ]
  ],
  rootDir: './',
  testMatch: ['**/server/test/**/*.test.js']
}

module.exports = config
