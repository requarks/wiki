'use strict'

/* global wiki */

const Git = require('git-wrapper2-promise')
const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs-extra'))
const _ = require('lodash')
const URL = require('url')
const moment = require('moment')

const securityHelper = require('../helpers/security')

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
    email: 'wiki@example.com'
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
  init() {
    let self = this

    // -> Build repository path

    if (_.isEmpty(wiki.config.paths.repo)) {
      self._repo.path = path.join(wiki.ROOTPATH, 'repo')
    } else {
      self._repo.path = wiki.config.paths.repo
    }

    // -> Initialize repository

    self.onReady = (wiki.IS_MASTER) ? self._initRepo() : Promise.resolve()

    if (wiki.config.git) {
      self._repo.branch = wiki.config.git.branch || 'master'
      self._signature.email = wiki.config.git.serverEmail || 'wiki@example.com'
    }

    return self
  },

  /**
   * Initialize Git repository
   *
   * @param      {Object}  wiki.config  The application config
   * @return     {Object}  Promise
   */
  _initRepo() {
    let self = this

    // -> Check if path is accessible

    return fs.mkdirAsync(self._repo.path).catch((err) => {
      if (err.code !== 'EEXIST') {
        wiki.logger.error('Invalid Git repository path or missing permissions.')
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
      if (wiki.config.git === false) {
        wiki.logger.warn('Remote Git syncing is disabled. Not recommended!')
        return Promise.resolve(true)
      }

      // Initialize remote

      let urlObj = URL.parse(wiki.config.git.url)
      if (wiki.config.git.auth.type !== 'ssh') {
        urlObj.auth = wiki.config.git.auth.username + ':' + wiki.config.git.auth.password
      }
      self._url = URL.format(urlObj)

      let gitConfigs = [
        () => { return self._git.exec('config', ['--local', 'user.name', 'Wiki']) },
        () => { return self._git.exec('config', ['--local', 'user.email', self._signature.email]) },
        () => { return self._git.exec('config', ['--local', '--bool', 'http.sslVerify', _.toString(wiki.config.git.auth.sslVerify)]) }
      ]

      if (wiki.config.git.auth.type === 'ssh') {
        gitConfigs.push(() => {
          return self._git.exec('config', ['--local', 'core.sshCommand', 'ssh -i "' + wiki.config.git.auth.privateKey + '" -o StrictHostKeyChecking=no'])
        })
      }

      return self._git.exec('remote', 'show').then((cProc) => {
        let out = cProc.stdout.toString()
        return Promise.each(gitConfigs, fn => { return fn() }).then(() => {
          if (!_.includes(out, 'origin')) {
            return self._git.exec('remote', ['add', 'origin', self._url])
          } else {
            return self._git.exec('remote', ['set-url', 'origin', self._url])
          }
        }).catch(err => {
          wiki.logger.error(err)
        })
      })
    }).catch((err) => {
      wiki.logger.error('Git remote error!')
      throw err
    }).then(() => {
      wiki.logger.info('Git Repository: OK')
      return true
    })
  },

  /**
   * Gets the repo path.
   *
   * @return     {String}  The repo path.
   */
  getRepoPath() {
    return this._repo.path || path.join(wiki.ROOTPATH, 'repo')
  },

  /**
   * Sync with the remote repository
   *
   * @return     {Promise}  Resolve on sync success
   */
  resync() {
    let self = this

    // Is git remote disabled?

    if (wiki.config.git === false) {
      return Promise.resolve(true)
    }

    // Fetch

    wiki.logger.info('Performing pull from remote Git repository...')
    return self._git.pull('origin', self._repo.branch).then((cProc) => {
      wiki.logger.info('Git Pull completed.')
    })
      .catch((err) => {
        wiki.logger.error('Unable to fetch from git origin!')
        throw err
      })
      .then(() => {
        // Check for changes

        return self._git.exec('log', 'origin/' + self._repo.branch + '..HEAD').then((cProc) => {
          let out = cProc.stdout.toString()

          if (_.includes(out, 'commit')) {
            wiki.logger.info('Performing push to remote Git repository...')
            return self._git.push('origin', self._repo.branch).then(() => {
              return wiki.logger.info('Git Push completed.')
            })
          } else {
            wiki.logger.info('Git Push skipped. Repository is already in sync.')
          }

          return true
        })
      })
      .catch((err) => {
        wiki.logger.error('Unable to push changes to remote Git repository!')
        throw err
      })
  },

  /**
   * Commits a document.
   *
   * @param      {String}   entryPath  The entry path
   * @return     {Promise}  Resolve on commit success
   */
  commitDocument(entryPath, author) {
    let self = this
    let gitFilePath = entryPath + '.md'
    let commitMsg = ''

    return self._git.exec('ls-files', gitFilePath).then((cProc) => {
      let out = cProc.stdout.toString()
      return _.includes(out, gitFilePath)
    }).then((isTracked) => {
      commitMsg = (isTracked) ? wiki.lang.t('git:updated', { path: gitFilePath }) : wiki.lang.t('git:added', { path: gitFilePath })
      return self._git.add(gitFilePath)
    }).then(() => {
      let commitUsr = securityHelper.sanitizeCommitUser(author)
      return self._git.exec('commit', ['-m', commitMsg, '--author="' + commitUsr.name + ' <' + commitUsr.email + '>"']).catch((err) => {
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
  moveDocument(entryPath, newEntryPath) {
    let self = this
    let gitFilePath = entryPath + '.md'
    let gitNewFilePath = newEntryPath + '.md'
    let destPathObj = path.parse(this.getRepoPath() + '/' + gitNewFilePath)

    return fs.ensureDir(destPathObj.dir).then(() => {
      return self._git.exec('mv', [gitFilePath, gitNewFilePath]).then((cProc) => {
        let out = cProc.stdout.toString()
        if (_.includes(out, 'fatal')) {
          let errorMsg = _.capitalize(_.head(_.split(_.replace(out, 'fatal: ', ''), ',')))
          throw new Error(errorMsg)
        }
        return true
      })
    })
  },

  /**
   * Commits uploads changes.
   *
   * @param      {String}   msg     The commit message
   * @return     {Promise}  Resolve on commit success
   */
  commitUploads(msg) {
    let self = this
    msg = msg || 'Uploads repository sync'

    return self._git.add('uploads').then(() => {
      return self._git.commit(msg).catch((err) => {
        if (_.includes(err.stdout, 'nothing to commit')) { return true }
      })
    })
  },

  getHistory(entryPath) {
    let self = this
    let gitFilePath = entryPath + '.md'

    return self._git.exec('log', ['--max-count=25', '--skip=1', '--format=format:%H %h %cI %cE %cN', '--', gitFilePath]).then((cProc) => {
      let out = cProc.stdout.toString()
      if (_.includes(out, 'fatal')) {
        let errorMsg = _.capitalize(_.head(_.split(_.replace(out, 'fatal: ', ''), ',')))
        throw new Error(errorMsg)
      }
      let hist = _.chain(out).split('\n').map(h => {
        let hParts = h.split(' ', 4)
        let hDate = moment(hParts[2])
        return {
          commit: hParts[0],
          commitAbbr: hParts[1],
          date: hParts[2],
          dateFull: hDate.format('LLLL'),
          dateCalendar: hDate.calendar(null, { sameElse: 'llll' }),
          email: hParts[3],
          name: hParts[4]
        }
      }).value()
      return hist
    })
  },

  getHistoryDiff(path, commit, comparewith) {
    let self = this
    if (!comparewith) {
      comparewith = 'HEAD'
    }

    return self._git.exec('diff', ['--no-color', `${commit}:${path}.md`, `${comparewith}:${path}.md`]).then((cProc) => {
      let out = cProc.stdout.toString()
      if (_.startsWith(out, 'fatal: ')) {
        throw new Error(out)
      } else if (!_.includes(out, 'diff')) {
        throw new Error('Unable to query diff data.')
      } else {
        return out
      }
    })
  }

}
