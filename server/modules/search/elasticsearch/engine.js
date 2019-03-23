const _ = require('lodash')
const elasticsearch = require('elasticsearch')
const { pipeline, Transform } = require('stream')

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
    WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Initializing...`)
    this.client = new elasticsearch.Client({
      apiVersion: this.config.apiVersion,
      hosts: this.config.hosts.split(',').map(_.trim),
      httpAuth: (this.config.user.length > 0) ? `${this.config.user}:${this.config.pass}` : null,
      sniffOnStart: this.config.sniffOnStart,
      sniffInterval: (this.config.sniffInterval > 0) ? this.config.sniffInterval : false
    })

    // -> Create Search Index
    await this.createIndex()

    WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Initialization completed.`)
  },
  /**
   * Create Index
   */
  async createIndex() {
    const indexExists = await this.client.indices.exists({ index: this.config.indexName })
    if (!indexExists) {
      WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Creating index...`)
      await this.client.indices.create({
        index: this.config.indexName,
        body: {
          mappings: {
            _doc: {
              properties: {
                suggest: { type: 'completion' },
                title: { type: 'text', boost: 4.0 },
                description: { type: 'text', boost: 3.0 },
                content: { type: 'text', boost: 1.0 },
                locale: { type: 'keyword' },
                path: { type: 'text' }
              }
            }
          }
        }
      })
    }
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query(q, opts) {
    try {
      const results = await this.client.search({
        index: this.config.indexName,
        body: {
          query: {
            simple_query_string: {
              query: q
            }
          },
          from: 0,
          size: 50,
          _source: ['title', 'description', 'path', 'locale'],
          suggest: {
            suggestions: {
              text: q,
              completion: {
                field: 'suggest',
                size: 5,
                skip_duplicates: true,
                fuzzy: true
              }
            }
          }
        }
      })
      return {
        results: _.get(results, 'hits.hits', []).map(r => ({
          id: r._id,
          locale: r._source.locale,
          path: r._source.path,
          title: r._source.title,
          description: r._source.description
        })),
        suggestions: _.reject(_.get(results, 'suggest.suggestions', []).map(s => _.get(s, 'options[0].text', false)), s => !s),
        totalHits: results.hits.total
      }
    } catch (err) {
      WIKI.logger.warn('Search Engine Error:')
      WIKI.logger.warn(err)
    }
  },
  /**
   * Build suggest field
   */
  buildSuggest(page) {
    return _.uniq(_.concat(
      page.title.split(' ').map(s => ({
        input: s,
        weight: 4
      })),
      page.description.split(' ').map(s => ({
        input: s,
        weight: 3
      })),
      page.content.split(' ').map(s => ({
        input: s,
        weight: 1
      }))
    ))
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    await this.client.index({
      index: this.config.indexName,
      type: '_doc',
      id: page.hash,
      body: {
        suggest: this.buildSuggest(page),
        locale: page.localeCode,
        path: page.path,
        title: page.title,
        description: page.description,
        content: page.content
      },
      refresh: true
    })
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    await this.client.index({
      index: this.config.indexName,
      type: '_doc',
      id: page.hash,
      body: {
        suggest: this.buildSuggest(page),
        locale: page.localeCode,
        path: page.path,
        title: page.title,
        description: page.description,
        content: page.content
      },
      refresh: true
    })
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    await this.client.delete({
      index: this.config.indexName,
      type: '_doc',
      id: page.hash,
      refresh: true
    })
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    await this.client.delete({
      index: this.config.indexName,
      type: '_doc',
      id: page.sourceHash,
      refresh: true
    })
    await this.client.index({
      index: this.config.indexName,
      type: '_doc',
      id: page.destinationHash,
      body: {
        suggest: this.buildSuggest(page),
        locale: page.localeCode,
        path: page.destinationPath,
        title: page.title,
        description: page.description,
        content: page.content
      },
      refresh: true
    })
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Rebuilding Index...`)
    await this.client.indices.delete({ index: this.config.indexName })
    await this.createIndex()

    const MAX_INDEXING_BYTES = 10 * Math.pow(2, 20) - Buffer.from('[').byteLength - Buffer.from(']').byteLength // 10 MB
    const MAX_INDEXING_COUNT = 1000
    const COMMA_BYTES = Buffer.from(',').byteLength

    let chunks = []
    let bytes = 0

    const processDocument = async (cb, doc) => {
      try {
        if (doc) {
          const docBytes = Buffer.from(JSON.stringify(doc)).byteLength

          // -> Current batch exceeds size limit, flush
          if (docBytes + COMMA_BYTES + bytes >= MAX_INDEXING_BYTES) {
            await flushBuffer()
          }

          if (chunks.length > 0) {
            bytes += COMMA_BYTES
          }
          bytes += docBytes
          chunks.push(doc)

          // -> Current batch exceeds count limit, flush
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
      WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Sending batch of ${chunks.length}...`)
      try {
        await this.client.bulk({
          index: this.config.indexName,
          body: _.reduce(chunks, (result, doc) => {
            result.push({
              index: {
                _index: this.config.indexName,
                _type: '_doc',
                _id: doc.id
              }
            })
            result.push({
              suggest: this.buildSuggest(doc),
              locale: doc.locale,
              path: doc.path,
              title: doc.title,
              description: doc.description,
              content: doc.content
            })
            return result
          }, []),
          refresh: true
        })
      } catch (err) {
        WIKI.logger.warn('(SEARCH/ELASTICSEARCH) Failed to send batch to elasticsearch: ', err)
      }
      chunks.length = 0
      bytes = 0
    }

    await pipeline(
      WIKI.models.knex.column({ id: 'hash' }, 'path', { locale: 'localeCode' }, 'title', 'description', 'content').select().from('pages').where({
        isPublished: true,
        isPrivate: false
      }).stream(),
      new Transform({
        objectMode: true,
        transform: async (chunk, enc, cb) => processDocument(cb, chunk),
        flush: async (cb) => processDocument(cb)
      })
    )
    WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Index rebuilt successfully.`)
  }
}
