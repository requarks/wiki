const _ = require('lodash')
const AWS = require('aws-sdk')
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
    WIKI.logger.info(`(SEARCH/AWS) Initializing...`)
    this.client = new AWS.CloudSearch({
      apiVersion: '2013-01-01',
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region
    })
    this.clientDomain = new AWS.CloudSearchDomain({
      apiVersion: '2013-01-01',
      endpoint: this.config.endpoint,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region
    })

    let rebuildIndex = false

    // -> Define Analysis Schemes
    const schemes = await this.client.describeAnalysisSchemes({
      DomainName: this.config.domain,
      AnalysisSchemeNames: ['default_anlscheme']
    }).promise()
    if (_.get(schemes, 'AnalysisSchemes', []).length < 1) {
      WIKI.logger.info(`(SEARCH/AWS) Defining Analysis Scheme...`)
      await this.client.defineAnalysisScheme({
        DomainName: this.config.domain,
        AnalysisScheme: {
          AnalysisSchemeLanguage: this.config.AnalysisSchemeLang,
          AnalysisSchemeName: 'default_anlscheme'
        }
      }).promise()
      rebuildIndex = true
    }

    // -> Define Index Fields
    const fields = await this.client.describeIndexFields({
      DomainName: this.config.domain
    }).promise()
    if (_.get(fields, 'IndexFields', []).length < 1) {
      WIKI.logger.info(`(SEARCH/AWS) Defining Index Fields...`)
      await this.client.defineIndexField({
        DomainName: this.config.domain,
        IndexField: {
          IndexFieldName: 'id',
          IndexFieldType: 'literal'
        }
      }).promise()
      await this.client.defineIndexField({
        DomainName: this.config.domain,
        IndexField: {
          IndexFieldName: 'path',
          IndexFieldType: 'literal'
        }
      }).promise()
      await this.client.defineIndexField({
        DomainName: this.config.domain,
        IndexField: {
          IndexFieldName: 'locale',
          IndexFieldType: 'literal'
        }
      }).promise()
      await this.client.defineIndexField({
        DomainName: this.config.domain,
        IndexField: {
          IndexFieldName: 'title',
          IndexFieldType: 'text',
          TextOptions: {
            ReturnEnabled: true,
            AnalysisScheme: 'default_anlscheme'
          }
        }
      }).promise()
      await this.client.defineIndexField({
        DomainName: this.config.domain,
        IndexField: {
          IndexFieldName: 'description',
          IndexFieldType: 'text',
          TextOptions: {
            ReturnEnabled: true,
            AnalysisScheme: 'default_anlscheme'
          }
        }
      }).promise()
      await this.client.defineIndexField({
        DomainName: this.config.domain,
        IndexField: {
          IndexFieldName: 'content',
          IndexFieldType: 'text',
          TextOptions: {
            ReturnEnabled: false,
            AnalysisScheme: 'default_anlscheme'
          }
        }
      }).promise()
      rebuildIndex = true
    }

    // -> Define suggester
    const suggesters = await this.client.describeSuggesters({
      DomainName: this.config.domain,
      SuggesterNames: ['default_suggester']
    }).promise()
    if (_.get(suggesters, 'Suggesters', []).length < 1) {
      WIKI.logger.info(`(SEARCH/AWS) Defining Suggester...`)
      await this.client.defineSuggester({
        DomainName: this.config.domain,
        Suggester: {
          SuggesterName: 'default_suggester',
          DocumentSuggesterOptions: {
            SourceField: 'title',
            FuzzyMatching: 'high'
          }
        }
      }).promise()
      rebuildIndex = true
    }

    // -> Rebuild Index
    if (rebuildIndex) {
      WIKI.logger.info(`(SEARCH/AWS) Requesting Index Rebuild...`)
      await this.client.indexDocuments({
        DomainName: this.config.domain
      }).promise()
    }

    WIKI.logger.info(`(SEARCH/AWS) Initialization completed.`)
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query(q, opts) {
    try {
      let suggestions = []
      const results = await this.clientDomain.search({
        query: q,
        partial: true,
        size: 50
      }).promise()
      if (results.hits.found < 5) {
        const suggestResults = await this.clientDomain.suggest({
          query: q,
          suggester: 'default_suggester',
          size: 5
        }).promise()
        suggestions = suggestResults.suggest.suggestions.map(s => s.suggestion)
      }
      return {
        results: _.map(results.hits.hit, r => ({
          id: r.id,
          path: _.head(r.fields.path),
          locale: _.head(r.fields.locale),
          title: _.head(r.fields.title) || '',
          description: _.head(r.fields.description) || ''
        })),
        suggestions: suggestions,
        totalHits: results.hits.found
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
    await this.clientDomain.uploadDocuments({
      contentType: 'application/json',
      documents: JSON.stringify([
        {
          type: 'add',
          id: page.hash,
          fields: {
            locale: page.localeCode,
            path: page.path,
            title: page.title,
            description: page.description,
            content: page.safeContent
          }
        }
      ])
    }).promise()
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    await this.clientDomain.uploadDocuments({
      contentType: 'application/json',
      documents: JSON.stringify([
        {
          type: 'add',
          id: page.hash,
          fields: {
            locale: page.localeCode,
            path: page.path,
            title: page.title,
            description: page.description,
            content: page.safeContent
          }
        }
      ])
    }).promise()
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    await this.clientDomain.uploadDocuments({
      contentType: 'application/json',
      documents: JSON.stringify([
        {
          type: 'delete',
          id: page.hash
        }
      ])
    }).promise()
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    await this.clientDomain.uploadDocuments({
      contentType: 'application/json',
      documents: JSON.stringify([
        {
          type: 'delete',
          id: page.hash
        }
      ])
    }).promise()
    await this.clientDomain.uploadDocuments({
      contentType: 'application/json',
      documents: JSON.stringify([
        {
          type: 'add',
          id: page.destinationHash,
          fields: {
            locale: page.destinationLocaleCode,
            path: page.destinationPath,
            title: page.title,
            description: page.description,
            content: page.safeContent
          }
        }
      ])
    }).promise()
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    WIKI.logger.info(`(SEARCH/AWS) Rebuilding Index...`)

    const MAX_DOCUMENT_BYTES = Math.pow(2, 20)
    const MAX_INDEXING_BYTES = 5 * Math.pow(2, 20) - Buffer.from('[').byteLength - Buffer.from(']').byteLength
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
            throw new Error('Document exceeds maximum size allowed by AWS CloudSearch.')
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
      WIKI.logger.info(`(SEARCH/AWS) Sending batch of ${chunks.length}...`)
      try {
        await this.clientDomain.uploadDocuments({
          contentType: 'application/json',
          documents: JSON.stringify(_.map(chunks, doc => ({
            type: 'add',
            id: doc.id,
            fields: {
              locale: doc.locale,
              path: doc.path,
              title: doc.title,
              description: doc.description,
              content: WIKI.models.pages.cleanHTML(doc.render)
            }
          })))
        }).promise()
      } catch (err) {
        WIKI.logger.warn('(SEARCH/AWS) Failed to send batch to AWS CloudSearch: ', err)
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

    WIKI.logger.info(`(SEARCH/AWS) Requesting Index Rebuild...`)
    await this.client.indexDocuments({
      DomainName: this.config.domain
    }).promise()

    WIKI.logger.info(`(SEARCH/AWS) Index rebuilt successfully.`)
  }
}
