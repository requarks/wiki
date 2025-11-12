const fs = require('fs-extra')
const { sanitizer } = require('../helpers/sanitizer')

/* global WIKI */
module.exports = async (svgPath) => {
  WIKI.logger.info(`Sanitizing SVG file upload...`)

  try {
    let svgContents = await fs.readFile(svgPath, 'utf8')
    svgContents = sanitizer(svgContents, {svgOnly: true})
    await fs.writeFile(svgPath, svgContents)
    WIKI.logger.info(`Sanitized SVG file upload: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Failed to sanitize SVG file upload: [ FAILED ]`)
    WIKI.logger.error(err.message)
    throw err
  }
}
