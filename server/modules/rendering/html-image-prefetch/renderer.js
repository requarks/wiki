/* global WIKI */

const prefetch = async (element) => {
  const url = element.attr(`src`)
  let contentType = ''
  let image = ''
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Unexpected response code ${response.status}`)
    }
    contentType = response.headers.get(`content-type`)
    image = Buffer.from(await response.arrayBuffer()).toString('base64')
  } catch (err) {
    WIKI.logger.warn(`Failed to prefetch ${url}`)
    WIKI.logger.warn(err)
    return
  }
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
