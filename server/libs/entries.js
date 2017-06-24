'use strict'

/* global db, git, lang, mark, rights, search, winston */

const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs-extra'))
const _ = require('lodash')

const entryHelper = require('../helpers/entry')

/**
 * Entries Model
 */
module.exports = {

  _repoPath: 'repo',
  _cachePath: 'data/cache',

  /**
   * Initialize Entries model
   *
   * @return     {Object}  Entries model instance
   */
  init() {
    let self = this

    self._repoPath = path.resolve(ROOTPATH, appconfig.paths.repo)
    self._cachePath = path.resolve(ROOTPATH, appconfig.paths.data, 'cache')
    appdata.repoPath = self._repoPath
    appdata.cachePath = self._cachePath

    return self
  },

  /**
   * Check if a document already exists
   *
   * @param      {String}  entryPath  The entry path
   * @return     {Promise<Boolean>}  True if exists, false otherwise
   */
  exists(entryPath) {
    let self = this

    return self.fetchOriginal(entryPath, {
      parseMarkdown: false,
      parseMeta: false,
      parseTree: false,
      includeMarkdown: false,
      includeParentInfo: false,
      cache: false
    }).then(() => {
      return true
    }).catch((err) => { // eslint-disable-line handle-callback-err
      return false
    })
  },

  /**
   * Fetch a document from cache, otherwise the original
   *
   * @param      {String}           entryPath  The entry path
   * @return     {Promise<Object>}  Page Data
   */
  fetch(entryPath) {
    let self = this

    let cpath = entryHelper.getCachePath(entryPath)

    return fs.statAsync(cpath).then((st) => {
      return st.isFile()
    }).catch((err) => { // eslint-disable-line handle-callback-err
      return false
    }).then((isCache) => {
      if (isCache) {
        // Load from cache

        return fs.readFileAsync(cpath).then((contents) => {
          return JSON.parse(contents)
        }).catch((err) => { // eslint-disable-line handle-callback-err
          winston.error('Corrupted cache file. Deleting it...')
          fs.unlinkSync(cpath)
          return false
        })
      } else {
        // Load original

        return self.fetchOriginal(entryPath)
      }
    })
  },

  /**
   * Fetches the original document entry
   *
   * @param      {String}           entryPath  The entry path
   * @param      {Object}           options    The options
   * @return     {Promise<Object>}  Page data
   */
  fetchOriginal(entryPath, options) {
    let self = this

    let fpath = entryHelper.getFullPath(entryPath)
    let cpath = entryHelper.getCachePath(entryPath)

    options = _.defaults(options, {
      parseMarkdown: true,
      parseMeta: true,
      parseTree: true,
      includeMarkdown: false,
      includeParentInfo: true,
      cache: true
    })

    return fs.statAsync(fpath).then((st) => {
      if (st.isFile()) {
        return fs.readFileAsync(fpath, 'utf8').then((contents) => {
          let htmlProcessor = (options.parseMarkdown) ? mark.parseContent(contents) : Promise.resolve('')

          // Parse contents

          return htmlProcessor.then(html => {
            let pageData = {
              markdown: (options.includeMarkdown) ? contents : '',
              html,
              meta: (options.parseMeta) ? mark.parseMeta(contents) : {},
              tree: (options.parseTree) ? mark.parseTree(contents) : []
            }

            if (!pageData.meta.title) {
              pageData.meta.title = _.startCase(entryPath)
            }

            pageData.meta.path = entryPath

            // Get parent

            let parentPromise = (options.includeParentInfo) ? self.getParentInfo(entryPath).then((parentData) => {
              return (pageData.parent = parentData)
            }).catch((err) => { // eslint-disable-line handle-callback-err
              return (pageData.parent = false)
            }) : Promise.resolve(true)

            return parentPromise.then(() => {
              // Cache to disk

              if (options.cache) {
                let cacheData = JSON.stringify(_.pick(pageData, ['html', 'meta', 'tree', 'parent']), false, false, false)
                return fs.writeFileAsync(cpath, cacheData).catch((err) => {
                  winston.error('Unable to write to cache! Performance may be affected.')
                  winston.error(err)
                  return true
                })
              } else {
                return true
              }
            }).return(pageData)
          })
        })
      } else {
        return false
      }
    }).catch((err) => { // eslint-disable-line handle-callback-err
      throw new Promise.OperationalError(lang.t('errors:notexist', { path: entryPath }))
    })
  },

  /**
   * Gets the parent information.
   *
   * @param      {String}                 entryPath  The entry path
   * @return     {Promise<Object|False>}  The parent information.
   */
  getParentInfo(entryPath) {
    if (_.includes(entryPath, '/')) {
      let parentParts = _.initial(_.split(entryPath, '/'))
      let parentPath = _.join(parentParts, '/')
      let parentFile = _.last(parentParts)
      let fpath = entryHelper.getFullPath(parentPath)

      return fs.statAsync(fpath).then((st) => {
        if (st.isFile()) {
          return fs.readFileAsync(fpath, 'utf8').then((contents) => {
            let pageMeta = mark.parseMeta(contents)

            return {
              path: parentPath,
              title: (pageMeta.title) ? pageMeta.title : _.startCase(parentFile),
              subtitle: (pageMeta.subtitle) ? pageMeta.subtitle : false
            }
          })
        } else {
          return Promise.reject(new Error(lang.t('errors:parentinvalid')))
        }
      })
    } else {
      return Promise.reject(new Error(lang.t('errors:parentisroot')))
    }
  },

  /**
   * Update an existing document
   *
   * @param      {String}            entryPath  The entry path
   * @param      {String}            contents   The markdown-formatted contents
   * @param {Object} author The author user object
   * @return     {Promise<Boolean>}  True on success, false on failure
   */
  update(entryPath, contents, author) {
    let self = this
    let fpath = entryHelper.getFullPath(entryPath)

    return fs.statAsync(fpath).then((st) => {
      if (st.isFile()) {
        return self.makePersistent(entryPath, contents, author).then(() => {
          return self.updateCache(entryPath).then(entry => {
            return search.add(entry)
          })
        })
      } else {
        return Promise.reject(new Error(lang.t('errors:notexist', { path: entryPath })))
      }
    }).catch((err) => {
      winston.error(err)
      return Promise.reject(new Error(lang.t('errors:savefailed')))
    })
  },

  /**
   * Update local cache
   *
   * @param      {String}   entryPath  The entry path
   * @return     {Promise}  Promise of the operation
   */
  updateCache(entryPath) {
    let self = this

    return self.fetchOriginal(entryPath, {
      parseMarkdown: true,
      parseMeta: true,
      parseTree: true,
      includeMarkdown: true,
      includeParentInfo: true,
      cache: true
    }).catch(err => {
      winston.error(err)
      return err
    }).then((pageData) => {
      return {
        entryPath,
        meta: pageData.meta,
        parent: pageData.parent || {},
        text: mark.removeMarkdown(pageData.markdown)
      }
    }).catch(err => {
      winston.error(err)
      return err
    }).then((content) => {
      let parentPath = _.chain(content.entryPath).split('/').initial().join('/').value()
      return db.Entry.findOneAndUpdate({
        _id: content.entryPath
      }, {
        _id: content.entryPath,
        title: content.meta.title || content.entryPath,
        subtitle: content.meta.subtitle || '',
        parentTitle: content.parent.title || '',
        parentPath: parentPath,
        isDirectory: false,
        isEntry: true
      }, {
        new: true,
        upsert: true
      }).then(result => {
        let plainResult = result.toObject()
        plainResult.text = content.text
        return plainResult
      })
    }).then(result => {
      return self.updateTreeInfo().then(() => {
        return result
      })
    }).catch(err => {
      winston.error(err)
      return err
    })
  },

  /**
   * Update tree info for all directory and parent entries
   *
   * @returns {Promise<Boolean>} Promise of the operation
   */
  updateTreeInfo() {
    return db.Entry.distinct('parentPath', { parentPath: { $ne: '' } }).then(allPaths => {
      if (allPaths.length > 0) {
        return Promise.map(allPaths, pathItem => {
          let parentPath = _.chain(pathItem).split('/').initial().join('/').value()
          let guessedTitle = _.chain(pathItem).split('/').last().startCase().value()
          return db.Entry.update({ _id: pathItem }, {
            $set: { isDirectory: true },
            $setOnInsert: { isEntry: false, title: guessedTitle, parentPath }
          }, { upsert: true })
        })
      } else {
        return true
      }
    })
  },

  /**
   * Create a new document
   *
   * @param {String} entryPath The entry path
   * @param {String}  contents The markdown-formatted contents
   * @param {Object} author The author user object
   * @return {Promise<Boolean>} True on success, false on failure
   */
  create(entryPath, contents, author) {
    let self = this

    return self.exists(entryPath).then((docExists) => {
      if (!docExists) {
        return self.makePersistent(entryPath, contents, author).then(() => {
          return self.updateCache(entryPath).then(entry => {
            return search.add(entry)
          })
        })
      } else {
        return Promise.reject(new Error(lang.t('errors:alreadyexists')))
      }
    }).catch((err) => {
      winston.error(err)
      return Promise.reject(new Error(lang.t('errors:generic')))
    })
  },

  /**
   * Makes a document persistent to disk and git repository
   *
   * @param {String} entryPath The entry path
   * @param {String} contents The markdown-formatted contents
   * @param {Object} author The author user object
   * @return {Promise<Boolean>} True on success, false on failure
   */
  makePersistent(entryPath, contents, author) {
    let fpath = entryHelper.getFullPath(entryPath)

    return fs.outputFileAsync(fpath, contents).then(() => {
      return git.commitDocument(entryPath, author)
    })
  },

  /**
   * Move a document
   *
   * @param {String} entryPath The current entry path
   * @param {String} newEntryPath  The new entry path
   * @param {Object} author The author user object
   * @return {Promise} Promise of the operation
   */
  move(entryPath, newEntryPath, author) {
    let self = this

    if (_.isEmpty(entryPath) || entryPath === 'home') {
      return Promise.reject(new Error(lang.t('errors:invalidpath')))
    }

    return git.moveDocument(entryPath, newEntryPath).then(() => {
      return git.commitDocument(newEntryPath, author).then(() => {
        // Delete old cache version

        let oldEntryCachePath = entryHelper.getCachePath(entryPath)
        fs.unlinkAsync(oldEntryCachePath).catch((err) => { return true }) // eslint-disable-line handle-callback-err

        // Delete old index entry

        search.delete(entryPath)

        // Create cache for new entry

        return self.updateCache(newEntryPath).then(entry => {
          return search.add(entry)
        })
      })
    })
  },

  /**
   * Generate a starter page content based on the entry path
   *
   * @param      {String}           entryPath  The entry path
   * @return     {Promise<String>}  Starter content
   */
  getStarter(entryPath) {
    let formattedTitle = _.startCase(_.last(_.split(entryPath, '/')))

    return fs.readFileAsync(path.join(SERVERPATH, 'app/content/create.md'), 'utf8').then((contents) => {
      return _.replace(contents, new RegExp('{TITLE}', 'g'), formattedTitle)
    })
  },

  /**
   * Get all entries from base path
   *
   * @param {String} basePath Path to list from
   * @param {Object} usr Current user
   * @return {Promise<Array>} List of entries
   */
  getFromTree(basePath, usr) {
    return db.Entry.find({ parentPath: basePath }, 'title parentPath isDirectory isEntry').sort({ title: 'asc' }).then(results => {
      return _.filter(results, r => {
        return rights.checkRole('/' + r._id, usr.rights, 'read')
      })
    })
  },

  getHistory(entryPath) {
    return db.Entry.findOne({ _id: entryPath, isEntry: true }).then(entry => {
      if (!entry) { return false }
      return git.getHistory(entryPath).then(history => {
        return {
          meta: entry,
          history
        }
      })
    })
  }
}
