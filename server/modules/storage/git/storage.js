const path = require('path')
const sgit = require('simple-git/promise')
const fs = require('fs-extra')
const _ = require('lodash')

let repoPath = path.join(process.cwd(), 'data/repo')

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
    WIKI.logger.info('(STORAGE/GIT) Initializing...')
    repoPath = path.resolve(WIKI.ROOTPATH, this.config.localRepoPath)
    await fs.ensureDir(repoPath)
    const git = sgit(repoPath)

    // Initialize repo (if needed)
    WIKI.logger.info('(STORAGE/GIT) Checking repository state...')
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      WIKI.logger.info('(STORAGE/GIT) Initializing local repository...')
      await git.init()
    }

    // Set default author
    await git.raw(['config', '--local', 'user.email', this.config.defaultEmail])
    await git.raw(['config', '--local', 'user.name', this.config.defaultName])

    // Purge existing remotes
    WIKI.logger.info('(STORAGE/GIT) Listing existing remotes...')
    const remotes = await git.getRemotes()
    if (remotes.length > 0) {
      WIKI.logger.info('(STORAGE/GIT) Purging existing remotes...')
      for(let remote of remotes) {
        await git.removeRemote(remote.name)
      }
    }

    // Add remote
    WIKI.logger.info('(STORAGE/GIT) Setting SSL Verification config...')
    await git.raw(['config', '--local', '--bool', 'http.sslVerify', _.toString(this.config.verifySSL)])
    switch (this.config.authType) {
      case 'ssh':
        WIKI.logger.info('(STORAGE/GIT) Setting SSH Command config...')
        await git.addConfig('core.sshCommand', `ssh -i "${this.config.sshPrivateKeyPath}" -o StrictHostKeyChecking=no`)
        WIKI.logger.info('(STORAGE/GIT) Adding origin remote via SSH...')
        await git.addRemote('origin', this.config.repoUrl)
        break
      default:
        WIKI.logger.info('(STORAGE/GIT) Adding origin remote via HTTPS...')
        await git.addRemote('origin', `https://${this.config.basicUsername}:${this.config.basicPassword}@${this.config.repoUrl}`)
        break
    }

    // Fetch updates for remote
    WIKI.logger.info('(STORAGE/GIT) Fetch updates from remote...')
    await git.raw(['remote', 'update', 'origin'])

    // Checkout branch
    const branches = await git.branch()
    if (!_.includes(branches.all, this.config.branch) && !_.includes(branches.all, `remotes/origin/${this.config.branch}`)) {
      throw new Error('Invalid branch! Make sure it exists on the remote first.')
    }
    WIKI.logger.info(`(STORAGE/GIT) Checking out branch ${this.config.branch}...`)
    await git.checkout(this.config.branch)

    // Pull rebase
    if (_.includes(['sync', 'pull'], this.mode)) {
      WIKI.logger.info(`(STORAGE/GIT) Performing pull rebase from origin on branch ${this.config.branch}...`)
      await git.pull('origin', this.config.branch, ['--rebase'])
    }

    // Push
    if (_.includes(['sync', 'push'], this.mode)) {
      WIKI.logger.info(`(STORAGE/GIT) Performing push to origin on branch ${this.config.branch}...`)
      let pushOpts = ['--signed=if-asked']
      if (this.mode === 'push') {
        pushOpts.push('--force')
      }
      await git.push('origin', this.config.branch, pushOpts)
    }

    WIKI.logger.info('(STORAGE/GIT) Initialization completed.')
  },
  async created() {
    const fileName = `${this.page.path}.${getFileExtension(this.page.contentType)}`
    const filePath = path.join(repoPath, fileName)
    await fs.outputFile(filePath, injectMetadata(this.page), 'utf8')

    const git = sgit(repoPath)
    await git.add(`./${fileName}`)
    await git.commit(`docs: create ${this.page.path}`, fileName, {
      '--author': `"${this.page.authorName} <${this.page.authorEmail}>"`
    })
  },
  async updated() {
    const fileName = `${this.page.path}.${getFileExtension(this.page.contentType)}`
    const filePath = path.join(repoPath, fileName)
    await fs.outputFile(filePath, injectMetadata(this.page), 'utf8')

    const git = sgit(repoPath)
    await git.add(`./${fileName}`)
    await git.commit(`docs: update ${this.page.path}`, fileName, {
      '--author': `"${this.page.authorName} <${this.page.authorEmail}>"`
    })
  },
  async deleted() {
    const fileName = `${this.page.path}.${getFileExtension(this.page.contentType)}`

    const git = sgit(repoPath)
    await git.rm(`./${fileName}`)
    await git.commit(`docs: delete ${this.page.path}`, fileName, {
      '--author': `"${this.page.authorName} <${this.page.authorEmail}>"`
    })
  },
  async renamed() {
    const sourceFilePath = `${this.page.sourcePath}.${getFileExtension(this.page.contentType)}`
    const destinationFilePath = `${this.page.destinationPath}.${getFileExtension(this.page.contentType)}`

    const git = sgit(repoPath)
    await git.mv(`./${sourceFilePath}`, `./${destinationFilePath}`)
    await git.commit(`docs: rename ${this.page.sourcePath} to ${destinationFilePath}`, destinationFilePath, {
      '--author': `"${this.page.authorName} <${this.page.authorEmail}>"`
    })
  }
}
