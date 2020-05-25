const TurndownService = require('turndown')
const _ = require('lodash')

/* global WIKI */

const htmlToMarkdown = async (page) => {
  const turndownService = new TurndownService()
  return turndownService.turndown(page.content)
}

const markdownToHtml = async (page) => {
  await WIKI.models.renderers.fetchDefinitions()
  const pipeline = await WIKI.models.renderers.getRenderingPipeline(page.contentType)
  const cores = _.filter(pipeline, ['input', 'markdown'])
  let output = page.content
  for (let core of cores) {
    const renderer = require(`../modules/rendering/${_.kebabCase(core.key)}/renderer.js`)
    output = await renderer.render.call({
      config: core.config,
      children: core.children,
      page: page,
      input: output
    })
  }
  return output
}

const convertersMap = {
  html: {
    markdown: htmlToMarkdown
  },
  markdown: {
    html: markdownToHtml
  }
}

module.exports = async (data) => {
  const parsedData = JSON.parse(data)
  const pageId = parsedData.id
  const fromType = parsedData.fromType;
  const toType = parsedData.toType;
  try {

    WIKI.models = require('../core/db').init()
    await WIKI.configSvc.loadFromDb()
    await WIKI.configSvc.applyFlags()

    WIKI.logger.info(`Converting page ID ${pageId} type from ${fromType} to ${toType}...`)
    if (fromType === toType) {
      WIKI.logger.warn(`Skipping identity type conversion of page ID ${pageId}`)
      return
    }
    const converter = convertersMap[fromType] && convertersMap[fromType][toType]
    if (!converter) {
      WIKI.logger.error(`No (${fromType}) ==> (${toType}) converter found for page ID ${pageId}`)
      throw new Error('No matching type converter')
    }
    const page = await WIKI.models.pages.getPageFromDb(pageId)
    if (!page) {
      throw new Error('Invalid Page Id')
    }
    if (_.isEmpty(page.content)) {
      await WIKI.models.knex.destroy()
      WIKI.logger.warn(`Skipping conversion of page ID ${pageId} due to empty content`)
      return
    }
    const output = await converter(page)

     // Save to DB
    await WIKI.models.pages.query()
      .patch({
        content: output,
      })
      .where('id', pageId)

    await WIKI.models.knex.destroy()
    WIKI.logger.info(`Converting page ID ${pageId} type: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Converting page ID ${pageId} type: [ FAILED ]`)
    WIKI.logger.error(err.message)
    throw err
  }
}
