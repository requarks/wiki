const _ = require('lodash')
const cheerio = require('cheerio')
const uslug = require('uslug')
const pageHelper = require('../../../helpers/page')
const URL = require('url').URL


/* global WIKI */

module.exports = {
  async render() {
    let $ = cheerio.load(this.input, {
      decodeEntities: true
    })

    if ($.root().children().length < 1) {
      return ''
    }

    return $.html()
  }
}
