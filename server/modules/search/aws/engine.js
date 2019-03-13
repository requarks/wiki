const _ = require('lodash')
const AWS = require('aws-sdk')
const { pipeline } = require('stream')

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

    //-> Define suggester
    const suggesters = await this.client.describeSuggesters({
      DomainName: this.config.domain,
      SuggesterNames: ['default_suggester']
    }).promise()
    if(_.get(suggesters, 'Suggesters', []).length < 1) {
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
      return {
        results: [],
        suggestions: [],
        totalHits: 0
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
    await this.client.indexes.use(this.config.indexName).index([
      {
        id: page.hash,
        locale: page.localeCode,
        path: page.path,
        title: page.title,
        description: page.description,
        content: page.content
      }
    ])
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    await this.client.indexes.use(this.config.indexName).index([
      {
        id: page.hash,
        locale: page.localeCode,
        path: page.path,
        title: page.title,
        description: page.description,
        content: page.content
      }
    ])
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    await this.client.indexes.use(this.config.indexName).index([
      {
        '@search.action': 'delete',
        id: page.hash
      }
    ])
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    await this.client.indexes.use(this.config.indexName).index([
      {
        '@search.action': 'delete',
        id: page.sourceHash
      }
    ])
    await this.client.indexes.use(this.config.indexName).index([
      {
        id: page.destinationHash,
        locale: page.localeCode,
        path: page.destinationPath,
        title: page.title,
        description: page.description,
        content: page.content
      }
    ])
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    await pipeline(
      WIKI.models.knex.column({ id: 'hash' }, 'path', { locale: 'localeCode' }, 'title', 'description', 'content').select().from('pages').where({
        isPublished: true,
        isPrivate: false
      }).stream(),
      this.client.indexes.use(this.config.indexName).createIndexingStream()
    )
  }
}
