const path = require('path')
const sgit = require('simple-git/promise')
const fs = require('fs-extra')
const _ = require('lodash')

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
  git: null,
  repoPath: path.join(process.cwd(), 'data/repo'),
  async activated() {
    // not used
  },
  async deactivated() {
    // not used
  },
  async init() {
    WIKI.logger.info('(STORAGE/GIT) Initializing...')
    this.repoPath = path.resolve(WIKI.ROOTPATH, this.config.localRepoPath)
    await fs.ensureDir(this.repoPath)
    this.git = sgit(this.repoPath)

    // Initialize repo (if needed)
    WIKI.logger.info('(STORAGE/GIT) Checking repository state...')
    const isRepo = await this.git.checkIsRepo()
    if (!isRepo) {
      WIKI.logger.info('(STORAGE/GIT) Initializing local repository...')
      await this.git.init()
    }

    // Set default author
    await this.git.raw(['config', '--local', 'user.email', this.config.defaultEmail])
    await this.git.raw(['config', '--local', 'user.name', this.config.defaultName])

    // Purge existing remotes
    WIKI.logger.info('(STORAGE/GIT) Listing existing remotes...')
    const remotes = await this.git.getRemotes()
    if (remotes.length > 0) {
      WIKI.logger.info('(STORAGE/GIT) Purging existing remotes...')
      for(let remote of remotes) {
        await this.git.removeRemote(remote.name)
      }
    }

    // Add remote
    WIKI.logger.info('(STORAGE/GIT) Setting SSL Verification config...')
    await this.git.raw(['config', '--local', '--bool', 'http.sslVerify', _.toString(this.config.verifySSL)])
    switch (this.config.authType) {
      case 'ssh':
        WIKI.logger.info('(STORAGE/GIT) Setting SSH Command config...')
        await this.git.addConfig('core.sshCommand', `ssh -i "${this.config.sshPrivateKeyPath}" -o StrictHostKeyChecking=no`)
        WIKI.logger.info('(STORAGE/GIT) Adding origin remote via SSH...')
        await this.git.addRemote('origin', this.config.repoUrl)
        break
      default:
        WIKI.logger.info('(STORAGE/GIT) Adding origin remote via HTTPS...')
        await this.git.addRemote('origin', `https://${this.config.basicUsername}:${this.config.basicPassword}@${this.config.repoUrl}`)
        break
    }

    // Fetch updates for remote
    WIKI.logger.info('(STORAGE/GIT) Fetch updates from remote...')
    await this.git.raw(['remote', 'update', 'origin'])

    // Checkout branch
    const branches = await this.git.branch()
    if (!_.includes(branches.all, this.config.branch) && !_.includes(branches.all, `remotes/origin/${this.config.branch}`)) {
      throw new Error('Invalid branch! Make sure it exists on the remote first.')
    }
    WIKI.logger.info(`(STORAGE/GIT) Checking out branch ${this.config.branch}...`)
    await this.git.checkout(this.config.branch)

    // Perform initial sync
    await this.sync()

    WIKI.logger.info('(STORAGE/GIT) Initialization completed.')
  },
  async sync() {
    // Pull rebase
    if (_.includes(['sync', 'pull'], this.mode)) {
      WIKI.logger.info(`(STORAGE/GIT) Performing pull rebase from origin on branch ${this.config.branch}...`)
      await this.git.pull('origin', this.config.branch, ['--rebase'])
    }

    // Push
    if (_.includes(['sync', 'push'], this.mode)) {
      WIKI.logger.info(`(STORAGE/GIT) Performing push to origin on branch ${this.config.branch}...`)
      let pushOpts = ['--signed=if-asked']
      if (this.mode === 'push') {
        pushOpts.push('--force')
      }
      await this.git.push('origin', this.config.branch, pushOpts)
    }
  },
  async created(page) {
    WIKI.logger.info(`(STORAGE/GIT) Committing new file ${page.path}...`)
    const fileName = `${page.path}.${getFileExtension(page.contentType)}`
    const filePath = path.join(this.repoPath, fileName)
    await fs.outputFile(filePath, injectMetadata(page), 'utf8')

    await this.git.add(`./${fileName}`)
    await this.git.commit(`docs: create ${page.path}`, fileName, {
      '--author': `"${page.authorName} <${page.authorEmail}>"`
    })
  },
  async updated(page) {
    WIKI.logger.info(`(STORAGE/GIT) Committing updated file ${page.path}...`)
    const fileName = `${page.path}.${getFileExtension(page.contentType)}`
    const filePath = path.join(this.repoPath, fileName)
    await fs.outputFile(filePath, injectMetadata(page), 'utf8')

    await this.git.add(`./${fileName}`)
    await this.git.commit(`docs: update ${page.path}`, fileName, {
      '--author': `"${page.authorName} <${page.authorEmail}>"`
    })
  },
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/GIT) Committing removed file ${page.path}...`)
    const fileName = `${page.path}.${getFileExtension(page.contentType)}`

    await this.git.rm(`./${fileName}`)
    await this.git.commit(`docs: delete ${page.path}`, fileName, {
      '--author': `"${page.authorName} <${page.authorEmail}>"`
    })
  },
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/GIT) Committing file move from ${page.sourcePath} to ${page.destinationPath}...`)
    const sourceFilePath = `${page.sourcePath}.${getFileExtension(page.contentType)}`
    const destinationFilePath = `${page.destinationPath}.${getFileExtension(page.contentType)}`

    await this.git.mv(`./${sourceFilePath}`, `./${destinationFilePath}`)
    await this.git.commit(`docs: rename ${page.sourcePath} to ${destinationFilePath}`, destinationFilePath, {
      '--author': `"${page.authorName} <${page.authorEmail}>"`
    })
  }
}
