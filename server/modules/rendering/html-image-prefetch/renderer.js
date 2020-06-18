const request = require('request-promise')

const prefetch = async (element) => {
  const url = element.attr(`src`)
  const response = await request({
    method: `GET`,
    url,
    resolveWithFullResponse: true
  })
  const contentType = response.headers[`content-type`]
  const image = Buffer.from(response.body).toString('base64')
  element.attr('src', `data:${contentType};base64,${image}`)
  element.removeClass('prefetch-candidate');
}

module.exports = {
  async init($) {
    const promises = $('img.prefetch-candidate').map((_, element) => {
      return prefetch($(element))
    }).toArray()
    await Promise.all(promises)
  }
}
