'use strict'

const Git = require('git-wrapper2-promise')
const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const _ = require('lodash')
const URL = require('url')

/**
 * Git Model
 */
module.exports = {

  _git: null,
  _url: '',
  _repo: {
    path: '',
    branch: 'master',
    exists: false
  },
  _signature: {
    name: 'Wiki',
    email: 'user@example.com'
  },
  _opts: {
    clone: {},
    push: {}
  },
  onReady: null,

  /**
   * Initialize Git model
   *
   * @return     {Object}  Git model instance
   */
  init () {
    let self = this

    // -> Build repository path

    if (_.isEmpty(appconfig.paths.repo)) {
      self._repo.path = path.join(ROOTPATH, 'repo')
    } else {
      self._repo.path = appconfig.paths.repo
    }

    // -> Initialize repository

    self.onReady = self._initRepo(appconfig)

    // Define signature

    if (appconfig.git) {
      self._signature.name = appconfig.git.signature.name || 'Wiki'
      self._signature.email = appconfig.git.signature.email || 'user@example.com'
    }

    return self
  },

  /**
   * Initialize Git repository
   *
   * @param      {Object}  appconfig  The application config
   * @return     {Object}  Promise
   */
  _initRepo (appconfig) {
    let self = this

    winston.info('[' + PROCNAME + '.Git] Checking Git repository...')

    // -> Check if path is accessible

    return fs.mkdirAsync(self._repo.path).catch((err) => {
      if (err.code !== 'EEXIST') {
        winston.error('[' + PROCNAME + '.Git] Invalid Git repository path or missing permissions.')
      }
    }).then(() => {
      self._git = new Git({ 'git-dir': self._repo.path })

      // -> Check if path already contains a git working folder

      return self._git.isRepo().then((isRepo) => {
        self._repo.exists = isRepo
        return (!isRepo) ? self._git.exec('init') : true
      }).catch((err) => { // eslint-disable-line handle-callback-err
        self._repo.exists = false
      })
    }).then(() => {
      if (appconfig.git === false) {
        winston.info('[' + PROCNAME + '.Git] Remote syncing is disabled. Not recommended!')
        return Promise.resolve(true)
      }

      // Initialize remote

      let urlObj = URL.parse(appconfig.git.url)
      if (appconfig.git.auth.type !== 'ssh') {
        urlObj.auth = appconfig.git.auth.username + ':' + appconfig.git.auth.password
      }
      self._url = URL.format(urlObj)

      let gitConfigs = [
        () => { return self._git.exec('config', ['--local', 'user.name', self._signature.name]) },
        () => { return self._git.exec('config', ['--local', 'user.email', self._signature.email]) },
        () => { return self._git.exec('config', ['--local', '--bool', 'http.sslVerify', _.toString(appconfig.git.auth.sslVerify)]) }
      ]

      if (appconfig.git.auth.type === 'ssh') {
        gitConfigs.push(() => {
          return self._git.exec('config', ['--local', 'core.sshCommand', 'ssh -i "' + appconfig.git.auth.privateKey + '" -o StrictHostKeyChecking=no'])
        })
      }

      return self._git.exec('remote', 'show').then((cProc) => {
        let out = cProc.stdout.toString()
        if (_.includes(out, 'origin')) {
          return true
        } else {
          return Promise.each(gitConfigs, fn => { return fn() }).then(() => {
            return self._git.exec('remote', ['add', 'origin', self._url])
          }).catch(err => {
            winston.error(err)
          })
        }
      })
    }).catch((err) => {
      winston.error('[' + PROCNAME + '.Git] Git remote error!')
      throw err
    }).then(() => {
      winston.info('[' + PROCNAME + '.Git] Git repository is OK.')
      return true
    })
  },

  /**
   * Gets the repo path.
   *
   * @return     {String}  The repo path.
   */
  getRepoPath () {
    return this._repo.path || path.join(ROOTPATH, 'repo')
  },

  /**
   * Sync with the remote repository
   *
   * @return     {Promise}  Resolve on sync success
   */
  resync () {
    let self = this

    // Is git remote disabled?

    if (appconfig.git === false) {
      return Promise.resolve(true)
    }

    // Fetch

    winston.info('[' + PROCNAME + '.Git] Performing pull from remote repository...')
    return self._git.pull('origin', self._repo.branch).then((cProc) => {
      winston.info('[' + PROCNAME + '.Git] Pull completed.')
    })
    .catch((err) => {
      winston.error('[' + PROCNAME + '.Git] Unable to fetch from git origin!')
      throw err
    })
    .then(() => {
      // Check for changes

      return self._git.exec('log', 'origin/' + self._repo.branch + '..HEAD').then((cProc) => {
        let out = cProc.stdout.toString()

        if (_.includes(out, 'commit')) {
          winston.info('[' + PROCNAME + '.Git] Performing push to remote repository...')
          return self._git.push('origin', self._repo.branch).then(() => {
            return winston.info('[' + PROCNAME + '.Git] Push completed.')
          })
        } else {
          winston.info('[' + PROCNAME + '.Git] Push skipped. Repository is already in sync.')
        }

        return true
      })
    })
    .catch((err) => {
      winston.error('[' + PROCNAME + '.Git] Unable to push changes to remote!')
      throw err
    })
  },

  /**
   * Commits a document.
   *
   * @param      {String}   entryPath  The entry path
   * @return     {Promise}  Resolve on commit success
   */
  commitDocument (entryPath) {
    let self = this
    let gitFilePath = entryPath + '.md'
    let commitMsg = ''

    return self._git.exec('ls-files', gitFilePath).then((cProc) => {
      let out = cProc.stdout.toString()
      return _.includes(out, gitFilePath)
    }).then((isTracked) => {
      commitMsg = (isTracked) ? 'Updated ' + gitFilePath : 'Added ' + gitFilePath
      return self._git.add(gitFilePath)
    }).then(() => {
      return self._git.commit(commitMsg).catch((err) => {
        if (_.includes(err.stdout, 'nothing to commit')) { return true }
      })
    })
  },

  /**
   * Move a document.
   *
   * @param      {String}            entryPath     The current entry path
   * @param      {String}            newEntryPath  The new entry path
   * @return     {Promise<Boolean>}  Resolve on success
   */
  moveDocument (entryPath, newEntryPath) {
    let self = this
    let gitFilePath = entryPath + '.md'
    let gitNewFilePath = newEntryPath + '.md'

    return self._git.exec('mv', [gitFilePath, gitNewFilePath]).then((cProc) => {
      let out = cProc.stdout.toString()
      if (_.includes(out, 'fatal')) {
        let errorMsg = _.capitalize(_.head(_.split(_.replace(out, 'fatal: ', ''), ',')))
        throw new Error(errorMsg)
      }
      return true
    })
  },

  /**
   * Commits uploads changes.
   *
   * @param      {String}   msg     The commit message
   * @return     {Promise}  Resolve on commit success
   */
  commitUploads (msg) {
    let self = this
    msg = msg || 'Uploads repository sync'

    return self._git.add('uploads').then(() => {
      return self._git.commit(msg).catch((err) => {
        if (_.includes(err.stdout, 'nothing to commit')) { return true }
      })
    })
  }

}
