const mathjax = require('mathjax-node')
const _ = require('lodash')

// ------------------------------------
// Mathjax
// ------------------------------------

/* global WIKI */

const mathRegex = [
  {
    format: 'TeX',
    regex: /\\\[([\s\S]*?)\\\]/g
  },
  {
    format: 'inline-TeX',
    regex: /\\\((.*?)\\\)/g
  },
  {
    format: 'MathML',
    regex: /<math([\s\S]*?)<\/math>/g
  }
]

module.exports = {
  init ($, config) {
    mathjax.config({
      MathJax: {
        jax: ['input/TeX', 'input/MathML', 'output/SVG'],
        extensions: ['tex2jax.js', 'mml2jax.js'],
        TeX: {
          extensions: ['AMSmath.js', 'AMSsymbols.js', 'noErrors.js', 'noUndefined.js']
        },
        SVG: {
          scale: 120,
          font: 'STIX-Web'
        }
      }
    })
  },
  async render (content) {
    let matchStack = []
    let replaceStack = []
    let currentMatch
    let mathjaxState = {}

    _.forEach(mathRegex, mode => {
      do {
        currentMatch = mode.regex.exec(content)
        if (currentMatch) {
          matchStack.push(currentMatch[0])
          replaceStack.push(
            new Promise((resolve, reject) => {
              mathjax.typeset({
                math: (mode.format === 'MathML') ? currentMatch[0] : currentMatch[1],
                format: mode.format,
                speakText: false,
                svg: true,
                state: mathjaxState,
                timeout: 30 * 1000
              }, result => {
                if (!result.errors) {
                  resolve(result.svg)
                } else {
                  resolve(currentMatch[0])
                  WIKI.logger.warn(result.errors.join(', '))
                }
              })
            })
          )
        }
      } while (currentMatch)
    })

    return (matchStack.length > 0) ? Promise.all(replaceStack).then(results => {
      _.forEach(matchStack, (repMatch, idx) => {
        content = content.replace(repMatch, results[idx])
      })
      return content
    }) : Promise.resolve(content)
  }
}
