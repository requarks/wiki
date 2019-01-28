const path = require('path')
const sgit = require('simple-git/promise')
const fs = require('fs-extra')
const _ = require('lodash')

const repoPath = path.join(WIKI.ROOTPATH, 'data/repo')

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

  },
  async deactivated() {

  },
  async init() {
    await fs.ensureDir(repoPath)
    const git = sgit(repoPath)

    // Initialize repo (if needed)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      await git.init()
    }

    // Checkout branch
    await git.checkout(this.config.branch)

    // Add remote
    await git.raw(['config', '--local', '--bool', 'http.sslVerify', _.toString(this.config.verifySSL)])
    switch (this.config.authType) {
      case 'ssh':
        await git.addConfig('core.sshCommand', `ssh -i "${this.config.sshPrivateKeyPath}" -o StrictHostKeyChecking=no`)
        await git.addRemote('origin', this.config.repoUrl)
        break
      default:
        await git.addRemote('origin', `https://${this.config.basicUsername}:${this.config.basicPassword}@${this.config.repoUrl}`)
        break
    }
  },
  async created() {
    const fileName = `${this.page.path}.${getFileExtension(this.page.contentType)}`
    const filePath = path.join(repoPath, fileName)
    await fs.outputFile(filePath, injectMetadata(this.page), 'utf8')

    const git = sgit(repoPath)
    await git.add(`./${fileName}`).commit(`docs: create ${this.page.path}`, fileName, {
      '--author': `"${this.page.authorName} <${this.page.authorEmail}>"`
    })
  },
  async updated() {
    const fileName = `${this.page.path}.${getFileExtension(this.page.contentType)}`
    const filePath = path.join(repoPath, fileName)
    await fs.outputFile(filePath, injectMetadata(this.page), 'utf8')

    const git = sgit(repoPath)
    await git.add(`./${fileName}`).commit(`docs: update ${this.page.path}`, fileName, {
      '--author': `"${this.page.authorName} <${this.page.authorEmail}>"`
    })
  },
  async deleted() {
    const fileName = `${this.page.path}.${getFileExtension(this.page.contentType)}`

    const git = sgit(repoPath)
    await git.rm(`./${fileName}`).commit(`docs: delete ${this.page.path}`, fileName, {
      '--author': `"${this.page.authorName} <${this.page.authorEmail}>"`
    })
  },
  async renamed() {
    const sourceFilePath = `${this.page.sourcePath}.${getFileExtension(this.page.contentType)}`
    const destinationFilePath = `${this.page.destinationPath}.${getFileExtension(this.page.contentType)}`

    const git = sgit(repoPath)
    await git.mv(`./${sourceFilePath}`, `./${destinationFilePath}`).commit(`docs: rename ${this.page.sourcePath} to ${destinationFilePath}`, destinationFilePath, {
      '--author': `"${this.page.authorName} <${this.page.authorEmail}>"`
    })
  }
}
