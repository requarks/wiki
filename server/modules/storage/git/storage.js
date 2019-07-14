const path = require('path')
const sgit = require('simple-git/promise')
const fs = require('fs-extra')
const _ = require('lodash')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const klaw = require('klaw')
const pageHelper = require('../../../helpers/page.js')

const localeFolderRegex = /^([a-z]{2}(?:-[a-z]{2})?\/)?(.*)/i

/* global WIKI */

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

const getContenType = (filePath) => {
  const ext = _.last(filePath.split('.'))
  switch (ext) {
    case 'md':
      return 'markdown'
    case 'html':
      return 'html'
    default:
      return false
  }
}

const getPagePath = (filePath) => {
  let meta = {
    locale: 'en',
    path: _.initial(filePath.split('.')).join('')
  }
  const result = localeFolderRegex.exec(meta.path)
  if (result[1]) {
    meta = {
      locale: result[1],
      path: result[2]
    }
  }
  return meta
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
  /**
   * INIT
   */
  async init() {
    WIKI.logger.info('(STORAGE/GIT) Initializing...')
    this.repoPath = path.resolve(WIKI.ROOTPATH, this.config.localRepoPath)
    await fs.ensureDir(this.repoPath)
    this.git = sgit(this.repoPath)

    // Set custom binary path
    if (!_.isEmpty(this.config.gitBinaryPath)) {
      this.git.customBinary(this.config.gitBinaryPath)
    }

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
      for (let remote of remotes) {
        await this.git.removeRemote(remote.name)
      }
    }

    // Add remote
    WIKI.logger.info('(STORAGE/GIT) Setting SSL Verification config...')
    await this.git.raw(['config', '--local', '--bool', 'http.sslVerify', _.toString(this.config.verifySSL)])
    switch (this.config.authType) {
      case 'ssh':
        WIKI.logger.info('(STORAGE/GIT) Setting SSH Command config...')
        if (this.config.sshPrivateKeyMode === 'contents') {
          try {
            this.config.sshPrivateKeyPath = path.join(WIKI.ROOTPATH, 'data/secure/git-ssh.pem')
            await fs.outputFile(this.config.sshPrivateKeyPath, this.config.sshPrivateKeyContent, {
              encoding: 'utf8',
              mode: 0o600
            })
          } catch (err) {
            console.error(err)
            throw err
          }
        }
        await this.git.addConfig('core.sshCommand', `ssh -i "${this.config.sshPrivateKeyPath}" -o StrictHostKeyChecking=no`)
        WIKI.logger.info('(STORAGE/GIT) Adding origin remote via SSH...')
        await this.git.addRemote('origin', this.config.repoUrl)
        break
      default:
        WIKI.logger.info('(STORAGE/GIT) Adding origin remote via HTTP/S...')
        let originUrl = ''
        if (_.startsWith(this.config.repoUrl, 'http')) {
          originUrl = this.config.repoUrl.replace('://', `://${this.config.basicUsername}:${this.config.basicPassword}@`)
        } else {
          originUrl = `https://${this.config.basicUsername}:${this.config.basicPassword}@${this.config.repoUrl}`
        }
        await this.git.addRemote('origin', originUrl)
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
  /**
   * SYNC
   */
  async sync() {
    const currentCommitLog = _.get(await this.git.log(['-n', '1', this.config.branch]), 'latest', {})

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

    // Process Changes
    if (_.includes(['sync', 'pull'], this.mode)) {
      const latestCommitLog = _.get(await this.git.log(['-n', '1', this.config.branch]), 'latest', {})

      const diff = await this.git.diffSummary(['-M', currentCommitLog.hash, latestCommitLog.hash])
      if (_.get(diff, 'files', []).length > 0) {
        await this.processFiles(diff.files)
      }
    }
  },
  /**
   * Process Files
   *
   * @param {Array<String>} files Array of files to process
   */
  async processFiles(files) {
    for (const item of files) {
      const contentType = getContenType(item.file)
      if (!contentType) {
        continue
      }
      const contentPath = getPagePath(item.file)

      let itemContents = ''
      try {
        itemContents = await fs.readFile(path.join(this.repoPath, item.file), 'utf8')
        const pageData = WIKI.models.pages.parseMetadata(itemContents, contentType)
        const currentPage = await WIKI.models.pages.query().findOne({
          path: contentPath.path,
          localeCode: contentPath.locale
        })
        if (currentPage) {
          // Already in the DB, can mark as modified
          WIKI.logger.info(`(STORAGE/GIT) Page marked as modified: ${item.file}`)
          await WIKI.models.pages.updatePage({
            id: currentPage.id,
            title: _.get(pageData, 'title', currentPage.title),
            description: _.get(pageData, 'description', currentPage.description),
            isPublished: _.get(pageData, 'isPublished', currentPage.isPublished),
            isPrivate: false,
            content: pageData.content,
            authorId: 1,
            skipStorage: true
          })
        } else {
          // Not in the DB, can mark as new
          WIKI.logger.info(`(STORAGE/GIT) Page marked as new: ${item.file}`)
          const pageEditor = await WIKI.models.editors.getDefaultEditor(contentType)
          await WIKI.models.pages.createPage({
            path: contentPath.path,
            locale: contentPath.locale,
            title: _.get(pageData, 'title', _.last(contentPath.path.split('/'))),
            description: _.get(pageData, 'description', ''),
            isPublished: _.get(pageData, 'isPublished', true),
            isPrivate: false,
            content: pageData.content,
            authorId: 1,
            editor: pageEditor,
            skipStorage: true
          })
        }
      } catch (err) {
        if (err.code === 'ENOENT' && item.deletions > 0 && item.insertions === 0) {
          // File was deleted by git, can safely mark as deleted in DB
          WIKI.logger.info(`(STORAGE/GIT) Page marked as deleted: ${item.file}`)

          await WIKI.models.pages.deletePage({
            path: contentPath.path,
            locale: contentPath.locale,
            skipStorage: true
          })
        } else {
          WIKI.logger.warn(`(STORAGE/GIT) Failed to open ${item.file}`)
          WIKI.logger.warn(err)
        }
      }
    }
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    WIKI.logger.info(`(STORAGE/GIT) Committing new file ${page.path}...`)
    let fileName = `${page.path}.${getFileExtension(page.contentType)}`
    if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }
    const filePath = path.join(this.repoPath, fileName)
    await fs.outputFile(filePath, page.injectMetadata(), 'utf8')

    await this.git.add(`./${fileName}`)
    await this.git.commit(`docs: create ${page.path}`, fileName, {
      '--author': `"${page.authorName} <${page.authorEmail}>"`
    })
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    WIKI.logger.info(`(STORAGE/GIT) Committing updated file ${page.path}...`)
    let fileName = `${page.path}.${getFileExtension(page.contentType)}`
    if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }
    const filePath = path.join(this.repoPath, fileName)
    await fs.outputFile(filePath, page.injectMetadata(), 'utf8')

    await this.git.add(`./${fileName}`)
    await this.git.commit(`docs: update ${page.path}`, fileName, {
      '--author': `"${page.authorName} <${page.authorEmail}>"`
    })
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/GIT) Committing removed file ${page.path}...`)
    let fileName = `${page.path}.${getFileExtension(page.contentType)}`
    if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }

    await this.git.rm(`./${fileName}`)
    await this.git.commit(`docs: delete ${page.path}`, fileName, {
      '--author': `"${page.authorName} <${page.authorEmail}>"`
    })
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/GIT) Committing file move from ${page.sourcePath} to ${page.destinationPath}...`)
    let sourceFilePath = `${page.sourcePath}.${getFileExtension(page.contentType)}`
    let destinationFilePath = `${page.destinationPath}.${getFileExtension(page.contentType)}`

    if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
      sourceFilePath = `${page.localeCode}/${sourceFilePath}`
      destinationFilePath = `${page.localeCode}/${destinationFilePath}`
    }

    await this.git.mv(`./${sourceFilePath}`, `./${destinationFilePath}`)
    await this.git.commit(`docs: rename ${page.sourcePath} to ${destinationFilePath}`, destinationFilePath, {
      '--author': `"${page.authorName} <${page.authorEmail}>"`
    })
  },

  /**
   * HANDLERS
   */
  async importAll() {
    WIKI.logger.info(`(STORAGE/GIT) Importing all content from local Git repo to the DB...`)
    await pipeline(
      klaw(this.repoPath, {
        filter: (f) => {
          return !_.includes(f, '.git')
        }
      }),
      new stream.Transform({
        objectMode: true,
        transform: async (file, enc, cb) => {
          const relPath = file.path.substr(this.repoPath.length + 1)
          if (relPath && relPath.length > 3) {
            WIKI.logger.info(`(STORAGE/GIT) Processing ${relPath}...`)
            await this.processFiles([{
              file: relPath,
              deletions: 0,
              insertions: 0
            }])
          }
          cb()
        }
      })
    )
    WIKI.logger.info('(STORAGE/GIT) Import completed.')
  },
  async syncUntracked() {
    WIKI.logger.info(`(STORAGE/GIT) Adding all untracked content...`)
    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt').select().from('pages').where({
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          let fileName = `${page.path}.${getFileExtension(page.contentType)}`
          if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
            fileName = `${page.localeCode}/${fileName}`
          }
          WIKI.logger.info(`(STORAGE/GIT) Adding ${fileName}...`)
          const filePath = path.join(this.repoPath, fileName)
          await fs.outputFile(filePath, pageHelper.injectPageMetadata(page), 'utf8')
          await this.git.add(`./${fileName}`)
          cb()
        }
      })
    )
    await this.git.commit(`docs: add all untracked content`)
    WIKI.logger.info('(STORAGE/GIT) All content is now tracked.')
  }
}
