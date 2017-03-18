'use strict'

const Promise = require('bluebird')
const _ = require('lodash')
const searchIndex = require('./search-index')
const stopWord = require('stopword')
const streamToPromise = require('stream-to-promise')

module.exports = {

  _si: null,
  _isReady: false,

  /**
   * Initialize search index
   *
   * @return {undefined} Void
   */
  init () {
    let self = this
    self._isReady = new Promise((resolve, reject) => {
      searchIndex({
        deletable: true,
        fieldedSearch: true,
        indexPath: 'wiki',
        logLevel: 'error',
        stopwords: _.get(stopWord, appconfig.lang, [])
      }, (err, si) => {
        if (err) {
          winston.error('[SERVER.Search] Failed to initialize search index.', err)
          reject(err)
        } else {
          self._si = Promise.promisifyAll(si)
          self._si.flushAsync().then(() => {
            winston.info('[SERVER.Search] Search index flushed and ready.')
            resolve(true)
          })
        }
      })
    })

    return self
  },

  /**
   * Add a document to the index
   *
   * @param      {Object}   content  Document content
   * @return     {Promise}  Promise of the add operation
   */
  add (content) {
    let self = this

    return self._isReady.then(() => {
      return self.delete(content._id).then(() => {
        return self._si.concurrentAddAsync({
          fieldOptions: [{
            fieldName: 'entryPath',
            searchable: true,
            weight: 2
          },
          {
            fieldName: 'title',
            nGramLength: [1, 2],
            searchable: true,
            weight: 3
          },
          {
            fieldName: 'subtitle',
            searchable: true,
            weight: 1,
            storeable: false
          },
          {
            fieldName: 'parent',
            searchable: false
          },
          {
            fieldName: 'content',
            searchable: true,
            weight: 0,
            storeable: false
          }]
        }, [{
          entryPath: content._id,
          title: content.title,
          subtitle: content.subtitle || '',
          parent: content.parent || '',
          content: content.content || ''
        }]).then(() => {
          winston.log('verbose', '[SERVER.Search] Entry ' + content._id + ' added/updated to index.')
          return true
        }).catch((err) => {
          winston.error(err)
        })
      }).catch((err) => {
        winston.error(err)
      })
    })
  },

  /**
   * Delete an entry from the index
   *
   * @param      {String}   The     entry path
   * @return     {Promise}  Promise of the operation
   */
  delete (entryPath) {
    let self = this

    return self._isReady.then(() => {
      return streamToPromise(self._si.search({
        query: [{
          AND: { 'entryPath': [entryPath] }
        }]
      })).then((results) => {
        if (results && results.length > 0) {
          let delIds = _.map(results, 'id')
          return self._si.delAsync(delIds)
        } else {
          return true
        }
      }).catch((err) => {
        if (err.type === 'NotFoundError') {
          return true
        } else {
          winston.error(err)
        }
      })
    })
  },

  /**
   * Flush the index
   *
   * @returns {Promise} Promise of the flush operation
   */
  flush () {
    let self = this
    return self._isReady.then(() => {
      return self._si.flushAsync()
    })
  },

  /**
   * Search the index
   *
   * @param {Array<String>} terms
   * @returns {Promise<Object>} Hits and suggestions
   */
  find (terms) {
    let self = this
    terms = _.chain(terms)
              .deburr()
              .toLower()
              .trim()
              .replace(/[^a-z0-9 ]/g, '')
              .value()
    let arrTerms = _.chain(terms)
                    .split(' ')
                    .filter((f) => { return !_.isEmpty(f) })
                    .value()

    return streamToPromise(self._si.search({
      query: [{
        AND: { '*': arrTerms }
      }],
      pageSize: 10
    })).then((hits) => {
      if (hits.length > 0) {
        hits = _.map(_.sortBy(hits, ['score']), h => {
          return h.document
        })
      }
      if (hits.length < 5) {
        return streamToPromise(self._si.match({
          beginsWith: terms,
          threshold: 3,
          limit: 5,
          type: 'simple'
        })).then((matches) => {
          return {
            match: hits,
            suggest: matches
          }
        })
      } else {
        return {
          match: hits,
          suggest: []
        }
      }
    }).catch((err) => {
      if (err.type === 'NotFoundError') {
        return {
          match: [],
          suggest: []
        }
      } else {
        winston.error(err)
      }
    })
  }
}
