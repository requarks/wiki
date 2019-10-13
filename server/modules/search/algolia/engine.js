const _ = require('lodash')
const algoliasearch = require('algoliasearch')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)

/* global WIKI */

module.exports = {
  async activate() {
    // not used
  },
  async deactivate() {
    // not used
  },
  /**
   * INIT
   */
  async init() {
    WIKI.logger.info(`(SEARCH/ALGOLIA) Initializing...`)
    this.client = algoliasearch(this.config.appId, this.config.apiKey)
    this.index = this.client.initIndex(this.config.indexName)

    // -> Create Search Index
    WIKI.logger.info(`(SEARCH/ALGOLIA) Setting index configuration...`)
    await this.index.setSettings({
      searchableAttributes: [
        'title',
        'description',
        'content'
      ],
      attributesToRetrieve: [
        'locale',
        'path',
        'title',
        'description'
      ],
      advancedSyntax: true
    })
    WIKI.logger.info(`(SEARCH/ALGOLIA) Initialization completed.`)
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query(q, opts) {
    try {
      const results = await this.index.search({
        query: q,
        hitsPerPage: 50
      })
      return {
        results: _.map(results.hits, r => ({
          id: r.objectID,
          locale: r.locale,
          path: r.path,
          title: r.title,
          description: r.description
        })),
        suggestions: [],
        totalHits: results.nbHits
      }
    } catch (err) {
      WIKI.logger.warn('Search Engine Error:')
      WIKI.logger.warn(err)
    }
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    await this.index.addObject({
      objectID: page.hash,
      locale: page.localeCode,
      path: page.path,
      title: page.title,
      description: page.description,
      content: page.safeContent
    })
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    await this.index.partialUpdateObject({
      objectID: page.hash,
      title: page.title,
      description: page.description,
      content: page.safeContent
    })
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    await this.index.deleteObject(page.hash)
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    await this.index.deleteObject(page.hash)
    await this.index.addObject({
      objectID: page.destinationHash,
      locale: page.destinationLocaleCode,
      path: page.destinationPath,
      title: page.title,
      description: page.description,
      content: page.safeContent
    })
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    WIKI.logger.info(`(SEARCH/ALGOLIA) Rebuilding Index...`)
    await this.index.clearIndex()

    const MAX_DOCUMENT_BYTES = 10 * Math.pow(2, 10) // 10 KB
    const MAX_INDEXING_BYTES = 10 * Math.pow(2, 20) - Buffer.from('[').byteLength - Buffer.from(']').byteLength // 10 MB
    const MAX_INDEXING_COUNT = 1000
    const COMMA_BYTES = Buffer.from(',').byteLength

    let chunks = []
    let bytes = 0

    const processDocument = async (cb, doc) => {
      try {
        if (doc) {
          const docBytes = Buffer.from(JSON.stringify(doc)).byteLength
          // -> Document too large
          if (docBytes >= MAX_DOCUMENT_BYTES) {
            throw new Error('Document exceeds maximum size allowed by Algolia.')
          }

          // -> Current batch exceeds size hard limit, flush
          if (docBytes + COMMA_BYTES + bytes >= MAX_INDEXING_BYTES) {
            await flushBuffer()
          }

          if (chunks.length > 0) {
            bytes += COMMA_BYTES
          }
          bytes += docBytes
          chunks.push(doc)

          // -> Current batch exceeds count soft limit, flush
          if (chunks.length >= MAX_INDEXING_COUNT) {
            await flushBuffer()
          }
        } else {
          // -> End of stream, flush
          await flushBuffer()
        }
        cb()
      } catch (err) {
        cb(err)
      }
    }

    const flushBuffer = async () => {
      WIKI.logger.info(`(SEARCH/ALGOLIA) Sending batch of ${chunks.length}...`)
      try {
        await this.index.addObjects(
          _.map(chunks, doc => ({
            objectID: doc.id,
            locale: doc.locale,
            path: doc.path,
            title: doc.title,
            description: doc.description,
            content: WIKI.models.pages.cleanHTML(doc.render)
          }))
        )
      } catch (err) {
        WIKI.logger.warn('(SEARCH/ALGOLIA) Failed to send batch to Algolia: ', err)
      }
      chunks.length = 0
      bytes = 0
    }

    await pipeline(
      WIKI.models.knex.column({ id: 'hash' }, 'path', { locale: 'localeCode' }, 'title', 'description', 'render').select().from('pages').where({
        isPublished: true,
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (chunk, enc, cb) => processDocument(cb, chunk),
        flush: async (cb) => processDocument(cb)
      })
    )
    WIKI.logger.info(`(SEARCH/ALGOLIA) Index rebuilt successfully.`)
  }
}
