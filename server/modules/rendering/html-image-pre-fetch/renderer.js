const request = require('request-promise')

const preFetch = async (element) => {
  const url = element.attr(`src`)
  const response = await request({
    method: `GET`,
    url,
    resolveWithFullResponse: true
  })
  const contentType = response.headers[`content-type`]
  const image = Buffer.from(response.body).toString('base64')
  element.attr('src', `data:${contentType};base64,${image}`)
  element.removeClass('pre-fetch-candidate');
}

module.exports = {
  async init($) {
    const promises = [];
    $('img.pre-fetch-candidate').each((_, element) => {
      promises.push(preFetch($(element)))
    })
    await Promise.all(promises)
  }
}
