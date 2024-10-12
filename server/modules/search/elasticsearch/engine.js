const _ = require('lodash')
const stream = require('stream')
const Promise = require('bluebird')
const fs = require('fs')
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
    WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Initializing...`)
    switch (this.config.apiVersion) {
      case '8.x':
        const { Client: Client8 } = require('elasticsearch8')
        this.client = new Client8({
          nodes: this.config.hosts.split(',').map(_.trim),
          sniffOnStart: this.config.sniffOnStart,
          sniffInterval: (this.config.sniffInterval > 0) ? this.config.sniffInterval : false,
          tls: getTlsOptions(this.config),
          name: 'wiki-js'
        })
        break
      case '7.x':
        const { Client: Client7 } = require('elasticsearch7')
        this.client = new Client7({
          nodes: this.config.hosts.split(',').map(_.trim),
          sniffOnStart: this.config.sniffOnStart,
          sniffInterval: (this.config.sniffInterval > 0) ? this.config.sniffInterval : false,
          ssl: getTlsOptions(this.config),
          name: 'wiki-js'
        })
        break
      case '6.x':
        const { Client: Client6 } = require('elasticsearch6')
        this.client = new Client6({
          nodes: this.config.hosts.split(',').map(_.trim),
          sniffOnStart: this.config.sniffOnStart,
          sniffInterval: (this.config.sniffInterval > 0) ? this.config.sniffInterval : false,
          ssl: getTlsOptions(this.config),
          name: 'wiki-js'
        })
        break
      default:
        throw new Error('Unsupported version of elasticsearch! Update your settings in the Administration Area.')
    }

    // -> Create Search Index
    await this.createIndex()

    WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Initialization completed.`)
  },
  /**
   * Create Index
   */
  async createIndex() {
    try {
      const indexExists = await this.client.indices.exists({ index: this.config.indexName })
      // Elasticsearch 6.x / 7.x
      if (this.config.apiVersion !== '8.x' && !indexExists.body) {
        WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Creating index...`)
        try {
          const idxBody = {
            properties: {
              suggest: { type: 'completion' },
              title: { type: 'text', boost: 10.0 },
              description: { type: 'text', boost: 3.0 },
              content: { type: 'text', boost: 1.0 },
              locale: { type: 'keyword' },
              path: { type: 'text' },
              tags: { type: 'text', boost: 8.0 }
            }
          }

          await this.client.indices.create({
            index: this.config.indexName,
            body: {
              mappings: (this.config.apiVersion === '6.x') ? {
                _doc: idxBody
              } : idxBody,
              settings: {
                analysis: {
                  analyzer: {
                    default: {
                      type: this.config.analyzer
                    }
                  }
                }
              }
            }
          })
        } catch (err) {
          WIKI.logger.error(`(SEARCH/ELASTICSEARCH) Create Index Error: `, _.get(err, 'meta.body.error', err))
        }
      // Elasticsearch 8.x
      } else if (this.config.apiVersion === '8.x' && !indexExists) {
        WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Creating index...`)
        try {
          // 8.x Doesn't support boost in mappings, so we will need to boost at query time.
          const idxBody = {
            properties: {
              suggest: { type: 'completion' },
              title: { type: 'text' },
              description: { type: 'text' },
              content: { type: 'text' },
              locale: { type: 'keyword' },
              path: { type: 'text' },
              tags: { type: 'text' }
            }
          }

          await this.client.indices.create({
            index: this.config.indexName,
            body: {
              mappings: idxBody,
              settings: {
                analysis: {
                  analyzer: {
                    default: {
                      type: this.config.analyzer
                    }
                  }
                }
              }
            }
          })
        } catch (err) {
          WIKI.logger.error(`(SEARCH/ELASTICSEARCH) Create Index Error: `, _.get(err, 'meta.body.error', err))
        }
      } 
    } catch (err) {
      WIKI.logger.error(`(SEARCH/ELASTICSEARCH) Index Check Error: `, _.get(err, 'meta.body.error', err))
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
              query: `*${q}*`,
              fields: ['title^20', 'description^3', 'tags^8', 'content^1'],
              default_operator: 'and',
              analyze_wildcard: true
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
        results: _.get(results, this.config.apiVersion === '8.x' ? 'hits.hits' : 'body.hits.hits', []).map(r => ({
          id: r._id,
          locale: r._source.locale,
          path: r._source.path,
          title: r._source.title,
          description: r._source.description
        })),
        suggestions: _.reject(_.get(results, 'suggest.suggestions', []).map(s => _.get(s, 'options[0].text', false)), s => !s),
        totalHits: _.get(results, this.config.apiVersion === '8.x' ? 'hits.total.value' : 'body.hits.total.value', _.get(results, this.config.apiVersion === '8.x' ? 'hits.total' : 'body.hits.total', 0))
      }
    } catch (err) {
      WIKI.logger.warn('Search Engine Error: ', _.get(err, 'meta.body.error', err))
    }
  },

  /**
   * Build tags field
   * @param id
   * @returns {Promise<*|*[]>}
   */
  async buildTags(id) {
    const tags = await WIKI.models.pages.query().findById(id).select('*').withGraphJoined('tags')
    return (tags.tags && tags.tags.length > 0) ? tags.tags.map(function (tag) {
      return tag.title
    }) : []
  },
  /**
   * Build suggest field
   */
  buildSuggest(page) {
    return _.reject(_.uniq(_.concat(
      page.title.split(' ').map(s => ({
        input: s,
        weight: 10
      })),
      page.description.split(' ').map(s => ({
        input: s,
        weight: 3
      })),
      page.safeContent.split(' ').map(s => ({
        input: s,
        weight: 1
      }))
    )), ['input', ''])
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    await this.client.index({
      index: this.config.indexName,
      ...(this.config.apiVersion !== '8.x' && { type: '_doc' }),
      id: page.hash,
      body: {
        suggest: this.buildSuggest(page),
        locale: page.localeCode,
        path: page.path,
        title: page.title,
        description: page.description,
        content: page.safeContent,
        tags: await this.buildTags(page.id)
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
      ...(this.config.apiVersion !== '8.x' && { type: '_doc' }),
      id: page.hash,
      body: {
        suggest: this.buildSuggest(page),
        locale: page.localeCode,
        path: page.path,
        title: page.title,
        description: page.description,
        content: page.safeContent,
        tags: await this.buildTags(page.id)
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
      ...(this.config.apiVersion !== '8.x' && { type: '_doc' }),
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
      ...(this.config.apiVersion !== '8.x' && { type: '_doc' }),
      id: page.hash,
      refresh: true
    })
    await this.client.index({
      index: this.config.indexName,
      ...(this.config.apiVersion !== '8.x' && { type: '_doc' }),
      id: page.destinationHash,
      body: {
        suggest: this.buildSuggest(page),
        locale: page.destinationLocaleCode,
        path: page.destinationPath,
        title: page.title,
        description: page.description,
        content: page.safeContent,
        tags: await this.buildTags(page.id)
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

          doc['tags'] = await this.buildTags(doc.realId)
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
                _id: doc.id,
                ...(this.config.apiVersion !== '8.x' && { _type: '_doc' })
              }
            })
            doc.safeContent = WIKI.models.pages.cleanHTML(doc.render)
            result.push({
              suggest: this.buildSuggest(doc),
              tags: doc.tags,
              locale: doc.locale,
              path: doc.path,
              title: doc.title,
              description: doc.description,
              content: doc.safeContent
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

    // Added real id in order to fetch page tags from the query
    await pipeline(
      WIKI.models.knex.column({ id: 'hash' }, 'path', { locale: 'localeCode' }, 'title', 'description', 'render', { realId: 'id' }).select().from('pages').where({
        isPublished: true,
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (chunk, enc, cb) => processDocument(cb, chunk),
        flush: async (cb) => processDocument(cb)
      })
    )
    WIKI.logger.info(`(SEARCH/ELASTICSEARCH) Index rebuilt successfully.`)
  }
}

function getTlsOptions(conf) {
  if (!conf.tlsCertPath) {
    return {
      rejectUnauthorized: conf.verifyTLSCertificate
    }
  }

  const caList = []
  if (conf.verifyTLSCertificate) {
    caList.push(fs.readFileSync(conf.tlsCertPath))
  }

  return {
    rejectUnauthorized: conf.verifyTLSCertificate,
    ca: caList
  }
}
