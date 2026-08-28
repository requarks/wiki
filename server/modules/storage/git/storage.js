const path = require('path')
const sgit = require('simple-git')
const fs = require('fs-extra')
const _ = require('lodash')
const { pipeline } = require('node:stream/promises')
const { Transform } = require('node:stream')
const klaw = require('klaw')
const os = require('os')

const pageHelper = require('../../../helpers/page')
const assetHelper = require('../../../helpers/asset')
const Mutex = require('../../../helpers/mutex')
const commonDisk = require('../disk/common')

/* global WIKI */

module.exports = {
  git: null,
  repoPath: path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'repo'),
  mutex: new Mutex(),
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
    return this.mutex.runExclusive(() => this.initInternal())
  },
  async initInternal() {
    WIKI.logger.info('(STORAGE/GIT) Initializing...')
    this.repoPath = path.resolve(WIKI.ROOTPATH, this.config.localRepoPath)
    await fs.ensureDir(this.repoPath)

    const opTimeout = _.toSafeInteger(this.config.operationTimeout) > 0 ? _.toSafeInteger(this.config.operationTimeout) * 1000 : 300000
    this.git = sgit(this.repoPath, {
      maxConcurrentProcesses: 1,
      timeout: {
        block: opTimeout
      }
    })

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

    // Disable quotePath, color output
    // Link https://git-scm.com/docs/git-config#Documentation/git-config.txt-corequotePath
    await this.git.raw(['config', '--local', 'core.quotepath', false])
    await this.git.raw(['config', '--local', 'color.ui', false])

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
            WIKI.logger.error(err)
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
          originUrl = this.config.repoUrl.replace('://', `://${encodeURI(this.config.basicUsername)}:${encodeURI(this.config.basicPassword)}@`)
        } else {
          originUrl = `https://${encodeURI(this.config.basicUsername)}:${encodeURI(this.config.basicPassword)}@${this.config.repoUrl}`
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
    await this.syncInternal()

    WIKI.logger.info('(STORAGE/GIT) Initialization completed.')
  },
  /**
   * Resolve current HEAD commit hash (null on an unborn branch)
   */
  async getCurrentHash() {
    try {
      return _.trim(await this.git.revparse(['--verify', 'HEAD']))
    } catch (err) {
      return null
    }
  },
  /**
   * Read / persist the last commit hash whose changes were imported into the DB.
   * Stored inside the .git directory so it survives config changes and is
   * wiped together with the repo on purge.
   */
  async getLastProcessedHash() {
    try {
      const syncState = await fs.readJson(path.join(this.repoPath, '.git/wikijs-sync.json'))
      return _.get(syncState, 'lastProcessedHash', null)
    } catch (err) {
      return null
    }
  },
  async setLastProcessedHash(hash) {
    await fs.outputJson(path.join(this.repoPath, '.git/wikijs-sync.json'), { lastProcessedHash: hash })
  },
  /**
   * Repair an interrupted rebase and absorb any pending worktree changes
   * left behind by previously failed operations, so the worktree is
   * guaranteed clean before pulling.
   */
  async repairAndAbsorb(rootUser) {
    // -> Abort interrupted rebase (if any)
    if (await fs.pathExists(path.join(this.repoPath, '.git/rebase-merge')) || await fs.pathExists(path.join(this.repoPath, '.git/rebase-apply'))) {
      WIKI.logger.warn('(STORAGE/GIT) Interrupted rebase detected! Aborting it...')
      try {
        await this.git.rebase(['--abort'])
      } catch (err) {
        WIKI.logger.warn(`(STORAGE/GIT) Failed to abort interrupted rebase: ${err.message}`)
      }
    }

    // -> Absorb untracked / uncommitted leftovers
    const status = await this.git.status()
    if (!status.isClean()) {
      const changeCount = status.files.length
      WIKI.logger.warn(`(STORAGE/GIT) Found ${changeCount} pending change(s) in the worktree. Committing them now...`)
      await this.git.add(['-A'])
      await this.git.commit('docs: absorb pending changes', {
        '--author': `"${rootUser.name} <${rootUser.email}>"`
      })
    }
  },
  /**
   * SYNC
   */
  async sync() {
    return this.mutex.runExclusive(() => this.syncInternal())
  },
  async syncInternal() {
    const rootUser = await WIKI.models.users.getRootUser()

    // Ensure clean worktree (self-healing for failed page commits / interrupted rebases)
    await this.repairAndAbsorb(rootUser)

    // Determine the window start for change processing
    let lastProcessedHash = await this.getLastProcessedHash()
    if (!lastProcessedHash) {
      lastProcessedHash = await this.getCurrentHash()
    }

    // Pull rebase
    if (_.includes(['sync', 'pull'], this.mode)) {
      WIKI.logger.info(`(STORAGE/GIT) Performing pull rebase from origin on branch ${this.config.branch}...`)
      await this.pullWithRecovery()
    }

    // Process changes pulled from remote BEFORE pushing, so a push failure
    // can never cause remote changes to be skipped
    if (_.includes(['sync', 'pull'], this.mode)) {
      const newHead = await this.getCurrentHash()
      if (newHead && lastProcessedHash && newHead !== lastProcessedHash) {
        await this.processDiff(lastProcessedHash, newHead, rootUser)
      }
      if (newHead) {
        await this.setLastProcessedHash(newHead)
      }
    }

    // Push
    if (_.includes(['sync', 'push'], this.mode)) {
      WIKI.logger.info(`(STORAGE/GIT) Performing push to origin on branch ${this.config.branch}...`)
      let pushOpts = ['--signed=if-asked']
      if (this.mode === 'push') {
        pushOpts.push('--force')
      }
      try {
        await this.git.push('origin', this.config.branch, pushOpts)
      } catch (err) {
        if (this.mode !== 'sync') {
          throw err
        }
        // Remote moved between our pull and push -> pull again and retry once.
        // Changes fetched by this second pull are processed on the next sync
        // run (the persisted hash window covers them).
        WIKI.logger.warn(`(STORAGE/GIT) Push rejected (${err.message}). Pulling latest changes and retrying...`)
        await this.pullWithRecovery()
        await this.git.push('origin', this.config.branch, pushOpts)
      }
    }
  },
  /**
   * Pull (rebase) with deterministic conflict resolution and rebase recovery.
   * On conflicting changes the local wiki edit wins; the remote side converges
   * again on the following push.
   */
  async pullWithRecovery() {
    try {
      await this.git.pull('origin', this.config.branch, ['--rebase', '--strategy-option=theirs'])
    } catch (err) {
      if (await fs.pathExists(path.join(this.repoPath, '.git/rebase-merge')) || await fs.pathExists(path.join(this.repoPath, '.git/rebase-apply'))) {
        WIKI.logger.warn('(STORAGE/GIT) Pull rebase failed mid-way. Aborting rebase to restore a clean state...')
        try {
          await this.git.rebase(['--abort'])
        } catch (errAbort) {
          WIKI.logger.warn(`(STORAGE/GIT) Failed to abort rebase: ${errAbort.message}`)
        }
      }
      throw err
    }
  },
  /**
   * Compute the diff between two commits and import the changes into the DB
   */
  async processDiff(fromHash, toHash, rootUser) {
    const diff = await this.git.diffSummary(['-M', fromHash, toHash])
    if (_.get(diff, 'files', []).length > 0) {
      let filesToProcess = []
      const filePattern = /(.*?)(?:{(.*?))? => (?:(.*?)})?(.*)/
      for (const f of diff.files) {
        const fMatch = f.file.match(filePattern)
        const fNames = {
          old: null,
          new: null
        }
        if (!fMatch) {
          fNames.old = f.file
          fNames.new = f.file
        } else if (!fMatch[2] && !fMatch[3]) {
          fNames.old = fMatch[1]
          fNames.new = fMatch[4]
        } else {
          fNames.old = (fMatch[1] + fMatch[2] + fMatch[4]).replace('//', '/')
          fNames.new = (fMatch[1] + fMatch[3] + fMatch[4]).replace('//', '/')
        }
        const fPath = path.join(this.repoPath, fNames.new)
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
          oldPath: fNames.old,
          relPath: fNames.new
        })
      }
      await this.processFiles(filesToProcess, rootUser)
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
      const fileExists = await fs.pathExists(item.file.path)
      if (!item.binary && contentType) {
        // -> Page

        if (fileExists && !item.importAll && item.relPath !== item.oldPath) {
          // Page was renamed by git, so rename in DB
          WIKI.logger.info(`(STORAGE/GIT) Page marked as renamed: from ${item.oldPath} to ${item.relPath}`)

          const contentPath = pageHelper.getPagePath(item.oldPath)
          const contentDestinationPath = pageHelper.getPagePath(item.relPath)
          await WIKI.models.pages.movePage({
            user: user,
            path: contentPath.path,
            destinationPath: contentDestinationPath.path,
            locale: contentPath.locale,
            destinationLocale: contentPath.locale,
            skipStorage: true
          })
        } else if (!fileExists && !item.importAll && item.deletions > 0 && item.insertions === 0) {
          // Page was deleted by git, can safely mark as deleted in DB
          WIKI.logger.info(`(STORAGE/GIT) Page marked as deleted: ${item.relPath}`)

          const contentPath = pageHelper.getPagePath(item.relPath)
          await WIKI.models.pages.deletePage({
            user: user,
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

        if (fileExists && !item.importAll && ((item.before === item.after) || (item.deletions === 0 && item.insertions === 0))) {
          // Asset was renamed by git, so rename in DB
          WIKI.logger.info(`(STORAGE/GIT) Asset marked as renamed: from ${item.oldPath} to ${item.relPath}`)

          const fileHash = assetHelper.generateHash(item.relPath)
          const assetToRename = await WIKI.models.assets.query().findOne({ hash: fileHash })
          if (assetToRename) {
            await WIKI.models.assets.query().patch({
              filename: item.relPath,
              hash: fileHash
            }).findById(assetToRename.id)
            await assetToRename.deleteAssetCache()
          } else {
            WIKI.logger.info(`(STORAGE/GIT) Asset was not found in the DB, nothing to rename: ${item.relPath}`)
          }
          continue
        } else if (!fileExists && !item.importAll && ((item.before > 0 && item.after === 0) || (item.deletions > 0 && item.insertions === 0))) {
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
   * Commit a file, unless it is excluded by .gitignore
   */
  async commitFile(gitFilePath, fileName, message, authorName, authorEmail) {
    if ((await this.git.checkIgnore(gitFilePath)).length > 0) {
      WIKI.logger.warn(`(STORAGE/GIT) File ${fileName} is excluded by .gitignore and will NOT be committed! Remove the matching .gitignore rule to track it.`)
      return
    }
    await this.git.add(gitFilePath)
    await this.git.commit(message, fileName, {
      '--author': `"${authorName} <${authorEmail}>"`
    })
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Committing new file [${page.localeCode}] ${page.path}...`)
      let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
      if (this.config.alwaysNamespace || (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode)) {
        fileName = `${page.localeCode}/${fileName}`
      }
      const filePath = path.join(this.repoPath, fileName)
      await fs.outputFile(filePath, page.injectMetadata(), 'utf8')

      await this.commitFile(`./${fileName}`, fileName, `docs: create ${page.path}`, page.authorName, page.authorEmail)
    })
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Committing updated file [${page.localeCode}] ${page.path}...`)
      let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
      if (this.config.alwaysNamespace || (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode)) {
        fileName = `${page.localeCode}/${fileName}`
      }
      const filePath = path.join(this.repoPath, fileName)
      await fs.outputFile(filePath, page.injectMetadata(), 'utf8')

      await this.commitFile(`./${fileName}`, fileName, `docs: update ${page.path}`, page.authorName, page.authorEmail)
    })
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Committing removed file [${page.localeCode}] ${page.path}...`)
      let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
      if (this.config.alwaysNamespace || (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode)) {
        fileName = `${page.localeCode}/${fileName}`
      }

      const gitFilePath = `./${fileName}`
      if ((await this.git.checkIgnore(gitFilePath)).length > 0) {
        WIKI.logger.warn(`(STORAGE/GIT) File ${fileName} is excluded by .gitignore, nothing to delete.`)
        return
      }
      await this.git.rm(gitFilePath)
      await this.git.commit(`docs: delete ${page.path}`, fileName, {
        '--author': `"${page.authorName} <${page.authorEmail}>"`
      })
    })
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Committing file move from [${page.localeCode}] ${page.path} to [${page.destinationLocaleCode}] ${page.destinationPath}...`)
      let sourceFileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
      let destinationFileName = `${page.destinationPath}.${pageHelper.getFileExtension(page.contentType)}`

      if (this.config.alwaysNamespace || WIKI.config.lang.namespacing) {
        if (this.config.alwaysNamespace || WIKI.config.lang.code !== page.localeCode) {
          sourceFileName = `${page.localeCode}/${sourceFileName}`
        }
        if (this.config.alwaysNamespace || WIKI.config.lang.code !== page.destinationLocaleCode) {
          destinationFileName = `${page.destinationLocaleCode}/${destinationFileName}`
        }
      }

      const sourceFilePath = path.join(this.repoPath, sourceFileName)
      const destinationFilePath = path.join(this.repoPath, destinationFileName)
      await fs.move(sourceFilePath, destinationFilePath)

      if ((await this.git.checkIgnore(`./${destinationFileName}`)).length > 0) {
        WIKI.logger.warn(`(STORAGE/GIT) File ${destinationFileName} is excluded by .gitignore and will NOT be committed! Remove the matching .gitignore rule to track it.`)
        return
      }
      await this.git.rm(`./${sourceFileName}`)
      await this.git.add(`./${destinationFileName}`)
      await this.git.commit(`docs: rename ${page.path} to ${page.destinationPath}`, [sourceFilePath, destinationFilePath], {
        '--author': `"${page.moveAuthorName} <${page.moveAuthorEmail}>"`
      })
    })
  },
  /**
   * ASSET UPLOAD
   *
   * @param {Object} asset Asset to upload
   */
  async assetUploaded (asset) {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Committing new file ${asset.path}...`)
      const filePath = path.join(this.repoPath, asset.path)
      await fs.outputFile(filePath, asset.data)

      await this.commitFile(`./${asset.path}`, asset.path, `docs: upload ${asset.path}`, asset.authorName, asset.authorEmail)
    })
  },
  /**
   * ASSET DELETE
   *
   * @param {Object} asset Asset to upload
   */
  async assetDeleted (asset) {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Committing removed file ${asset.path}...`)

      await this.git.rm(`./${asset.path}`)
      await this.git.commit(`docs: delete ${asset.path}`, asset.path, {
        '--author': `"${asset.authorName} <${asset.authorEmail}>"`
      })
    })
  },
  /**
   * ASSET RENAME
   *
   * @param {Object} asset Asset to upload
   */
  async assetRenamed (asset) {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Committing file move from ${asset.path} to ${asset.destinationPath}...`)

      await this.git.mv(`./${asset.path}`, `./${asset.destinationPath}`)
      await this.git.commit(`docs: rename ${asset.path} to ${asset.destinationPath}`, [asset.path, asset.destinationPath], {
        '--author': `"${asset.moveAuthorName} <${asset.moveAuthorEmail}>"`
      })
    })
  },
  async getLocalLocation (asset) {
    return path.join(this.repoPath, asset.path)
  },
  /**
   * HANDLERS
   */
  async importAll() {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Importing all content from local Git repo to the DB...`)

      const rootUser = await WIKI.models.users.getRootUser()

      await pipeline(
        klaw(this.repoPath, {
          filter: (f) => {
            return !_.includes(f, '.git')
          }
        }),
        new Transform({
          objectMode: true,
          transform: async (file, enc, cb) => {
            try {
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
                  insertions: 0,
                  importAll: true
                }], rootUser)
              }
              cb()
            } catch (err) {
              cb(err)
            }
          }
        })
      )

      commonDisk.clearFolderCache()

      WIKI.logger.info('(STORAGE/GIT) Import completed.')
    })
  },
  async syncUntracked() {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Adding all untracked content...`)

      // -> Pages
      await pipeline(
        WIKI.models.knex.column('id', 'path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt', 'createdAt', 'editorKey').select().from('pages').where({
          isPrivate: false
        }).stream(),
        new Transform({
          objectMode: true,
          transform: async (page, enc, cb) => {
            try {
              const pageObject = await WIKI.models.pages.query().findById(page.id)
              page.tags = await pageObject.$relatedQuery('tags')

              let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
              if (this.config.alwaysNamespace || (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode)) {
                fileName = `${page.localeCode}/${fileName}`
              }
              WIKI.logger.info(`(STORAGE/GIT) Adding page ${fileName}...`)
              const filePath = path.join(this.repoPath, fileName)
              await fs.outputFile(filePath, pageHelper.injectPageMetadata(page), 'utf8')
              await this.git.add(`./${fileName}`)
              cb()
            } catch (err) {
              cb(err)
            }
          }
        })
      )

      // -> Assets
      const assetFolders = await WIKI.models.assetFolders.getAllPaths()

      await pipeline(
        WIKI.models.knex.column('filename', 'folderId', 'data').select().from('assets').join('assetData', 'assets.id', '=', 'assetData.id').stream(),
        new Transform({
          objectMode: true,
          transform: async (asset, enc, cb) => {
            try {
              const filename = (asset.folderId && asset.folderId > 0) ? `${_.get(assetFolders, asset.folderId)}/${asset.filename}` : asset.filename
              WIKI.logger.info(`(STORAGE/GIT) Adding asset ${filename}...`)
              await fs.outputFile(path.join(this.repoPath, filename), asset.data)
              await this.git.add(`./${filename}`)
              cb()
            } catch (err) {
              cb(err)
            }
          }
        })
      )

      await this.git.commit(`docs: add all untracked content`)
      WIKI.logger.info('(STORAGE/GIT) All content is now tracked.')
    })
  },
  async purge() {
    return this.mutex.runExclusive(async () => {
      WIKI.logger.info(`(STORAGE/GIT) Purging local repository...`)
      await fs.emptyDir(this.repoPath)
      WIKI.logger.info('(STORAGE/GIT) Local repository is now empty. Reinitializing...')
      await this.initInternal()
    })
  }
}
