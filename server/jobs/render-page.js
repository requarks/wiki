require('../core/worker')

const _ = require('lodash')

/* global WIKI */

WIKI.models = require('../core/db').init()

module.exports = async (job) => {
  WIKI.logger.info(`Rendering page ${job.data.page.path}...`)

  try {
    let output = job.data.page.content
    for (let core of job.data.pipeline) {
      const renderer = require(`../modules/rendering/${_.kebabCase(core.key)}/renderer.js`)
      output = await renderer.render.call({
        config: core.config,
        children: core.children,
        page: job.data.page,
        input: output
      })
    }
    console.info(output)

    WIKI.logger.info(`Rendering page ${job.data.page.path}: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Rendering page ${job.data.page.path}: [ FAILED ]`)
    WIKI.logger.error(err.message)
  }
}
