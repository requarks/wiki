const fs = require('fs-extra')
const path = require('path')

/**
 * Get file extension based on content type
 */
const getFileExtension = (contentType) => {
  switch (contentType) {
    case 'markdown':
      return 'md'
    case 'html':
      return 'html'
    default:
      return 'txt'
  }
}

/**
 * Inject page metadata into contents
 */
const injectMetadata = (page) => {
  let meta = [
    ['title', page.title],
    ['description', page.description]
  ]
  let metaFormatted = ''
  switch (page.contentType) {
    case 'markdown':
      metaFormatted = meta.map(mt => `[//]: # ${mt[0]}: ${mt[1]}`).join('\n')
      break
    case 'html':
      metaFormatted = meta.map(mt => `<!-- ${mt[0]}: ${mt[1]} -->`).join('\n')
      break
    default:
      metaFormatted = meta.map(mt => `#WIKI ${mt[0]}: ${mt[1]}`).join('\n')
      break
  }
  return `${metaFormatted}\n\n${page.content}`
}

module.exports = {
  async activated() {
    // not used
  },
  async deactivated() {
    // not used
  },
  async init() {
    WIKI.logger.info('(STORAGE/DISK) Initializing...')
    await fs.ensureDir(this.config.path)
    WIKI.logger.info('(STORAGE/DISK) Initialization completed.')
  },
  async sync() {
    // not used
  },
  async created(page) {
    WIKI.logger.info(`(STORAGE/DISK) Creating file ${page.path}...`)
    const filePath = path.join(this.config.path, `${page.path}.${getFileExtension(page.contentType)}`)
    await fs.outputFile(filePath, injectMetadata(page), 'utf8')
  },
  async updated(page) {
    WIKI.logger.info(`(STORAGE/DISK) Updating file ${page.path}...`)
    const filePath = path.join(this.config.path, `${page.path}.${getFileExtension(page.contentType)}`)
    await fs.outputFile(filePath, injectMetadata(page), 'utf8')
  },
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/DISK) Deleting file ${page.path}...`)
    const filePath = path.join(this.config.path, `${page.path}.${getFileExtension(page.contentType)}`)
    await fs.unlink(filePath)
  },
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/DISK) Renaming file ${page.sourcePath} to ${page.destinationPath}...`)
    const sourceFilePath = path.join(this.config.path, `${page.sourcePath}.${getFileExtension(page.contentType)}`)
    const destinationFilePath = path.join(this.config.path, `${page.destinationPath}.${getFileExtension(page.contentType)}`)
    await fs.move(sourceFilePath, destinationFilePath, { overwrite: true })
  }
}
