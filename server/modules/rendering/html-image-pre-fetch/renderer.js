const request = require('request-promise')
const _ = require('lodash')

module.exports = {
  async init($) {
    const promises = [];
    const handler = async (elm) => {
      elm.removeClass('pre-fetch-candidate');
      const url = elm.attr(`src`)
      const response = await request({
        method: `GET`,
        url,
        resolveWithFullResponse: true
      })
      const image = response.body
      const contentType = response.headers[`content-type`]
      const base64 = Buffer.from(image).toString('base64')
      elm.attr('src', `data:${contentType};base64,${base64}`)
    }
    $('img.pre-fetch-candidate').each((i, elm) => {
      promises.push(handler($(elm)))
    })
    await Promise.all(promises)
  }
}
