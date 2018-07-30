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
    await fs.ensureDir(this.config.path)
  },
  async created() {
    const filePath = path.join(this.config.path, `${this.page.path}.${getFileExtension(this.page.contentType)}`)
    await fs.outputFile(filePath, injectMetadata(this.page), 'utf8')
  },
  async updated() {
    const filePath = path.join(this.config.path, `${this.page.path}.${getFileExtension(this.page.contentType)}`)
    await fs.outputFile(filePath, injectMetadata(this.page), 'utf8')
  },
  async deleted() {
    const filePath = path.join(this.config.path, `${this.page.path}.${getFileExtension(this.page.contentType)}`)
    await fs.unlink(filePath)
  },
  async renamed() {
    const sourceFilePath = path.join(this.config.path, `${this.page.sourcePath}.${getFileExtension(this.page.contentType)}`)
    const destinationFilePath = path.join(this.config.path, `${this.page.destinationPath}.${getFileExtension(this.page.contentType)}`)
    await fs.move(sourceFilePath, destinationFilePath, { overwrite: true })
  }
}
