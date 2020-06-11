const request = require('request-promise')
const _ = require('lodash')

module.exports = {
  async init($) {
    const promises = [];
    const handler = async (elm) => {
      const attrs = {
        ...elm.attr()
      }
      const url = attrs.src
      delete attrs.src
      const svg = await request(url)
      const container = $('div', '<div/>')
      _.each(attrs, (value, key) => {
        container.attr(key, value)
      })
      container.append($('svg', svg))
      elm.replaceWith(container);
    }
    $('img.pre-fetch-candidate').each((i, elm) => {
      promises.push(handler($(elm)))
    })
    await Promise.all(promises)
  }
}
