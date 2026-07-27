const request = require('request-promise')
const { URL } = require('url')

const BLOCKED_HOSTS = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|::ffff:)/

function isSafeUrl (urlStr) {
  let parsed
  try { parsed = new URL(urlStr) } catch { return false }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  if (parsed.hostname === 'localhost' || BLOCKED_HOSTS.test(parsed.hostname)) return false
  return true
}

const prefetch = async (element) => {
  const url = element.attr(`src`)
  if (!isSafeUrl(url)) {
    WIKI.logger.warn(`Blocked unsafe prefetch URL: ${url}`)
    return
  }
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
