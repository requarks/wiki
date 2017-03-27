'use strict'

const colors = require('colors')

expect.extend({
  /**
   * Expect Snyk results to have no errors
   * @param {*} received Snyk results
   * @param {*} argument Arguments
   * @returns {object} Matcher result
   */
  toPassSnyk (received, argument) {
    if (received && received.ok === false) {
      let errorMsgBuf = []
      for (let i = 0; i < received.vulnerabilities.length; i++) {
        const result = received.vulnerabilities[i]
        let vulnPath = result.from.slice(1).join(' > ')
        errorMsgBuf.push(colors.red(`└──[${result.severity}] ${result.packageName}\t${result.title}`))
        errorMsgBuf.push(colors.grey(`\t${vulnPath}`))
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

describe('Security', () => {
  it('should pass Snyk test', () => {
    const snyk = require('snyk').test
    return snyk('./').then(report => {
      expect(report).toPassSnyk()
    })
  }, 30000)
})
