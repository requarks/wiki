'use strict'

import deburr from 'lodash/deburr'
import filter from 'lodash/filter'
import isEmpty from 'lodash/isEmpty'
import join from 'lodash/join'
import kebabCase from 'lodash/kebabCase'
import map from 'lodash/map'
import split from 'lodash/split'
import trim from 'lodash/trim'

module.exports = {
  /**
   * Convert raw path to safe path
   * @param {string} rawPath Raw path
   * @returns {string} Safe path
   */
  makeSafePath: (rawPath) => {
    let rawParts = split(trim(rawPath), '/')
    rawParts = map(rawParts, (r) => {
      return kebabCase(deburr(trim(r)))
    })

    return join(filter(rawParts, (r) => { return !isEmpty(r) }), '/')
  }
}
