const request = require('request-promise')

const prefetch = async (element) => {
  const url = element.attr(`src`)
  let response
  try {
    response = await request({
      method: `GET`,
      url,
      resolveWithFullResponse: true
    })
  } catch (err) {
    WIKI.logger.warn(`Failed to prefetch ${url}`)
    WIKI.logger.warn(err)
    return
  }
  const contentType = response.headers[`content-type`]
  const image = Buffer.from(response.body).toString('base64')
  element.attr('src', `data:${contentType};base64,${image}`)
  element.removeClass('prefetch-candidate')
}

module.exports = {
  async init($) {
    const promises = $('img.prefetch-candidate').map((index, element) => {
      return prefetch($(element))
    }).toArray()
    await Promise.all(promises)
  }
}
