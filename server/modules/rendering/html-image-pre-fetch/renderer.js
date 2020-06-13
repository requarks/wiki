const request = require('request-promise')

module.exports = {
  async init($) {
    const promises = [];
    const handler = async (elm) => {
      const url = elm.attr(`src`)
      const response = await request({
        method: `GET`,
        url,
        resolveWithFullResponse: true
      })
      const contentType = response.headers[`content-type`]
      const image = Buffer.from(response.body).toString('base64')
      elm.attr('src', `data:${contentType};base64,${image}`)
      elm.removeClass('pre-fetch-candidate');
    }
    $('img.pre-fetch-candidate').each((i, elm) => {
      promises.push(handler($(elm)))
    })
    await Promise.all(promises)
  }
}
