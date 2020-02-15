const path = require('path')
const sgit = require('simple-git/promise')
const fs = require('fs-extra')
const _ = require('lodash')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const klaw = require('klaw')
const os = require('os')

const pageHelper = require('../../../helpers/page')
const assetHelper = require('../../../helpers/asset')
const commonDisk = require('../disk/common')

/* global WIKI */

module.exports = {
  git: null,
  repoPath: path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'repo'),
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
            this.config.sshPrivateKeyPath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'secure/git-ssh.pem')
            await fs.outputFile(this.config.sshPrivateKeyPath, this.config.sshPrivateKeyContent + os.EOL, {
              encoding: 'utf8',
              mode: 0o600
            })
          } catch (err) {
            console.error(err)
            throw err
          }
        }
        if (this.config.sshPort <= 0) {
          this.config.sshPort = 22
        }
        await this.git.addConfig('core.sshCommand', `ssh -i "${this.config.sshPrivateKeyPath}" -o StrictHostKeyChecking=no -p ${this.config.sshPort}`)
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

    const rootUser = await WIKI.models.users.getRootUser()

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
        let filesToProcess = []
        for (const f of diff.files) {
          const fPath = path.join(this.repoPath, f.file)
          let fStats = { size: 0 }
          try {
            fStats = await fs.stat(fPath)
          } catch (err) {
            if (err.code !== 'ENOENT') {
              WIKI.logger.warn(`(STORAGE/GIT) Failed to access file ${f.file}! Skipping...`)
              continue
            }
          }

          filesToProcess.push({
            ...f,
            file: {
              path: fPath,
              stats: fStats
            },
            relPath: f.file
          })
        }
        await this.processFiles(filesToProcess, rootUser)
      }
    }
  },
  /**
   * Process Files
   *
   * @param {Array<String>} files Array of files to process
   */
  async processFiles(files, user) {
    for (const item of files) {
      const contentType = pageHelper.getContentType(item.relPath)
      const fileExists = await fs.pathExists(item.file)
      if (!item.binary && contentType) {
        // -> Page

        if (!fileExists && item.deletions > 0 && item.insertions === 0) {
          // Page was deleted by git, can safely mark as deleted in DB
          WIKI.logger.info(`(STORAGE/GIT) Page marked as deleted: ${item.relPath}`)

          const contentPath = pageHelper.getPagePath(item.relPath)
          await WIKI.models.pages.deletePage({
            path: contentPath.path,
            locale: contentPath.locale,
            skipStorage: true
          })
          continue
        }

        try {
          await commonDisk.processPage({
            user,
            relPath: item.relPath,
            fullPath: this.repoPath,
            contentType: contentType,
            moduleName: 'GIT'
          })
        } catch (err) {
          WIKI.logger.warn(`(STORAGE/GIT) Failed to process ${item.relPath}`)
          WIKI.logger.warn(err)
        }
      } else {
        // -> Asset

        if (!fileExists && ((item.before > 0 && item.after === 0) || (item.deletions > 0 && item.insertions === 0))) {
          // Asset was deleted by git, can safely mark as deleted in DB
          WIKI.logger.info(`(STORAGE/GIT) Asset marked as deleted: ${item.relPath}`)

          const fileHash = assetHelper.generateHash(item.relPath)
          const assetToDelete = await WIKI.models.assets.query().findOne({ hash: fileHash })
          if (assetToDelete) {
            await WIKI.models.knex('assetData').where('id', assetToDelete.id).del()
            await WIKI.models.assets.query().deleteById(assetToDelete.id)
            await assetToDelete.deleteAssetCache()
          } else {
            WIKI.logger.info(`(STORAGE/GIT) Asset was not found in the DB, nothing to delete: ${item.relPath}`)
          }
          continue
        }

        try {
          await commonDisk.processAsset({
            user,
            relPath: item.relPath,
            file: item.file,
            contentType: contentType,
            moduleName: 'GIT'
          })
        } catch (err) {
          WIKI.logger.warn(`(STORAGE/GIT) Failed to process asset ${item.relPath}`)
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
    WIKI.logger.info(`(STORAGE/GIT) Committing new file [${page.localeCode}] ${page.path}...`)
    let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
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
    WIKI.logger.info(`(STORAGE/GIT) Committing updated file [${page.localeCode}] ${page.path}...`)
    let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
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
    WIKI.logger.info(`(STORAGE/GIT) Committing removed file [${page.localeCode}] ${page.path}...`)
    let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
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
    WIKI.logger.info(`(STORAGE/GIT) Committing file move from [${page.localeCode}] ${page.path} to [${page.destinationLocaleCode}] ${page.destinationPath}...`)
    let sourceFilePath = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
    let destinationFilePath = `${page.destinationPath}.${pageHelper.getFileExtension(page.contentType)}`

    if (WIKI.config.lang.namespacing) {
      if (WIKI.config.lang.code !== page.localeCode) {
        sourceFilePath = `${page.localeCode}/${sourceFilePath}`
      }
      if (WIKI.config.lang.code !== page.destinationLocaleCode) {
        destinationFilePath = `${page.destinationLocaleCode}/${destinationFilePath}`
      }
    }

    await this.git.mv(`./${sourceFilePath}`, `./${destinationFilePath}`)
    await this.git.commit(`docs: rename ${page.path} to ${page.destinationPath}`, [sourceFilePath, destinationFilePath], {
      '--author': `"${page.moveAuthorName} <${page.moveAuthorEmail}>"`
    })
  },
  /**
   * ASSET UPLOAD
   *
   * @param {Object} asset Asset to upload
   */
  async assetUploaded (asset) {
    WIKI.logger.info(`(STORAGE/GIT) Committing new file ${asset.path}...`)
    const filePath = path.join(this.repoPath, asset.path)
    await fs.outputFile(filePath, asset.data, 'utf8')

    await this.git.add(`./${asset.path}`)
    await this.git.commit(`docs: upload ${asset.path}`, asset.path, {
      '--author': `"${asset.authorName} <${asset.authorEmail}>"`
    })
  },
  /**
   * ASSET DELETE
   *
   * @param {Object} asset Asset to upload
   */
  async assetDeleted (asset) {
    WIKI.logger.info(`(STORAGE/GIT) Committing removed file ${asset.path}...`)

    await this.git.rm(`./${asset.path}`)
    await this.git.commit(`docs: delete ${asset.path}`, asset.path, {
      '--author': `"${asset.authorName} <${asset.authorEmail}>"`
    })
  },
  /**
   * ASSET RENAME
   *
   * @param {Object} asset Asset to upload
   */
  async assetRenamed (asset) {
    WIKI.logger.info(`(STORAGE/GIT) Committing file move from ${asset.path} to ${asset.destinationPath}...`)

    await this.git.mv(`./${asset.path}`, `./${asset.destinationPath}`)
    await this.git.commit(`docs: rename ${asset.path} to ${asset.destinationPath}`, [asset.path, asset.destinationPath], {
      '--author': `"${asset.moveAuthorName} <${asset.moveAuthorEmail}>"`
    })
  },
  /**
   * HANDLERS
   */
  async importAll() {
    WIKI.logger.info(`(STORAGE/GIT) Importing all content from local Git repo to the DB...`)

    const rootUser = await WIKI.models.users.getRootUser()

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
          if (file.stats.size < 1) {
            // Skip directories and zero-byte files
            return cb()
          } else if (relPath && relPath.length > 3) {
            WIKI.logger.info(`(STORAGE/GIT) Processing ${relPath}...`)
            await this.processFiles([{
              user: rootUser,
              relPath,
              file,
              deletions: 0,
              insertions: 0
            }], rootUser)
          }
          cb()
        }
      })
    )

    commonDisk.clearFolderCache()

    WIKI.logger.info('(STORAGE/GIT) Import completed.')
  },
  async syncUntracked() {
    WIKI.logger.info(`(STORAGE/GIT) Adding all untracked content...`)

    // -> Pages
    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt').select().from('pages').where({
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
          if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
            fileName = `${page.localeCode}/${fileName}`
          }
          WIKI.logger.info(`(STORAGE/GIT) Adding page ${fileName}...`)
          const filePath = path.join(this.repoPath, fileName)
          await fs.outputFile(filePath, pageHelper.injectPageMetadata(page), 'utf8')
          await this.git.add(`./${fileName}`)
          cb()
        }
      })
    )

    // -> Assets
    const assetFolders = await WIKI.models.assetFolders.getAllPaths()

    await pipeline(
      WIKI.models.knex.column('filename', 'folderId', 'data').select().from('assets').join('assetData', 'assets.id', '=', 'assetData.id').stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (asset, enc, cb) => {
          const filename = (asset.folderId && asset.folderId > 0) ? `${_.get(assetFolders, asset.folderId)}/${asset.filename}` : asset.filename
          WIKI.logger.info(`(STORAGE/GIT) Adding asset ${filename}...`)
          await fs.outputFile(path.join(this.repoPath, filename), asset.data)
          await this.git.add(`./${filename}`)
          cb()
        }
      })
    )

    await this.git.commit(`docs: add all untracked content`)
    WIKI.logger.info('(STORAGE/GIT) All content is now tracked.')
  },
  async purge() {
    WIKI.logger.info(`(STORAGE/GIT) Purging local repository...`)
    await fs.emptyDir(this.repoPath)
    WIKI.logger.info('(STORAGE/GIT) Local repository is now empty. Reinitializing...')
    await this.init()
  }
}
