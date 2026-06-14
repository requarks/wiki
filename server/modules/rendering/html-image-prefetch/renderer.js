const prefetch = async (element) => {
  const url = element.attr(`src`)
  let response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  } catch (err) {
    WIKI.logger.warn(`Failed to prefetch ${url}`)
    WIKI.logger.warn(err)
    return
  }
  if (!response.ok) {
    WIKI.logger.warn(`Failed to prefetch ${url}: HTTP ${response.status}`)
    return
  }
  const contentType = response.headers.get('content-type')
  if (!contentType) {
    WIKI.logger.warn(`Failed to prefetch ${url}: missing content-type`)
    return
  }
  const buffer = await response.arrayBuffer()
  const image = Buffer.from(buffer).toString('base64')
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
