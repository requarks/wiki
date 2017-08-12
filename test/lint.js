'use strict'

const fs = require('fs-extra')
const colors = require('colors')

expect.extend({
  /**
   * Expect ESLint results to have no errors
   * @param {*} received ESLint results
   * @param {*} argument Arguments
   * @returns {object} Matcher result
   */
  toESLint (received, argument) {
    if (received && received.errorCount > 0) {
      let errorMsgBuf = []
      for (let i = 0; i < received.results.length; i++) {
        const result = received.results[i]
        if (result.errorCount <= 0) {
          continue
        }

        for (let x = 0; x < result.messages.length; x++) {
          const m = result.messages[x]
          errorMsgBuf.push(colors.grey(`└── ${result.filePath}\t${m.line}:${m.column}\t${m.message}`))
        }
      }
      if (errorMsgBuf.length > 0) {
        return {
          message: () => (errorMsgBuf.join(`\n`)),
          pass: false
        }
      }
    }
    return {
      pass: true
    }
  },
  /**
   * Expect PugLint results to have no errors
   * @param {*} received PugLint results
   * @param {*} argument Arguments
   * @returns {object} Matcher result
   */
  toPugLint (received, argument) {
    if (received && received.length > 0) {
      let errorMsgBuf = []
      for (let i = 0; i < received.length; i++) {
        errorMsgBuf.push(colors.grey(`└── ${received[i].message}`))
      }
      return {
        message: () => (errorMsgBuf.join(`\n`)),
        pass: false
      }
    }
    return {
      pass: true
    }
  }
})

describe('Code Linting', () => {
  it('should pass ESLint validation', () => {
    const CLIEngine = require('eslint').CLIEngine
    const cli = new CLIEngine()
    let report = cli.executeOnFiles(['**/*.js'])
    expect(report).toESLint()
  })

  it('should pass PugLint validation', () => {
    const PugLint = require('pug-lint')
    const lint = new PugLint()
    const pugConfig = fs.readJsonSync('tools/pug-lintrc.json')
    lint.configure(pugConfig)
    let report = lint.checkPath('./server/views')
    expect(report).toPugLint()
  })
})
