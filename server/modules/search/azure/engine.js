const _ = require('lodash')
const { SearchService, QueryType } = require('azure-search-client')
const request = require('request-promise')
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
    WIKI.logger.info(`(SEARCH/AZURE) Initializing...`)
    this.client = new SearchService(this.config.serviceName, this.config.adminKey)

    // -> Create Search Index
    const indexes = await this.client.indexes.list()
    if (!_.find(_.get(indexes, 'result.value', []), ['name', this.config.indexName])) {
      WIKI.logger.info(`(SEARCH/AZURE) Creating index...`)
      await this.client.indexes.create({
        name: this.config.indexName,
        fields: [
          {
            name: 'id',
            type: 'Edm.String',
            key: true,
            searchable: false
          },
          {
            name: 'locale',
            type: 'Edm.String',
            searchable: false
          },
          {
            name: 'path',
            type: 'Edm.String',
            searchable: false
          },
          {
            name: 'title',
            type: 'Edm.String',
            searchable: true
          },
          {
            name: 'description',
            type: 'Edm.String',
            searchable: true
          },
          {
            name: 'content',
            type: 'Edm.String',
            searchable: true
          }
        ],
        scoringProfiles: [
          {
            name: 'fieldWeights',
            text: {
              weights: {
                title: 4,
                description: 3,
                content: 1
              }
            }
          }
        ],
        suggesters: [
          {
            name: 'suggestions',
            searchMode: 'analyzingInfixMatching',
            sourceFields: ['title', 'description', 'content']
          }
        ]
      })
    }
    WIKI.logger.info(`(SEARCH/AZURE) Initialization completed.`)
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
      const results = await this.client.indexes.use(this.config.indexName).search({
        count: true,
        scoringProfile: 'fieldWeights',
        search: q,
        select: 'id, locale, path, title, description',
        queryType: QueryType.simple,
        top: 50
      })
      if (results.result.value.length < 5) {
        // Using plain request, not yet available in library...
        try {
          const suggestResults = await request({
            uri: `https://${this.config.serviceName}.search.windows.net/indexes/${this.config.indexName}/docs/autocomplete`,
            method: 'post',
            qs: {
              'api-version': '2017-11-11-Preview'
            },
            headers: {
              'api-key': this.config.adminKey,
              'Content-Type': 'application/json'
            },
            json: true,
            body: {
              autocompleteMode: 'oneTermWithContext',
              search: q,
              suggesterName: 'suggestions'
            }
          })
          suggestions = suggestResults.value.map(s => s.queryPlusText)
        } catch (err) {
          WIKI.logger.warn('Search Engine suggestion failure: ', err)
        }
      }
      return {
        results: results.result.value,
        suggestions,
        totalHits: results.result['@odata.count']
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
        content: page.safeContent
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
        content: page.safeContent
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
        id: page.hash
      }
    ])
    await this.client.indexes.use(this.config.indexName).index([
      {
        id: page.destinationHash,
        locale: page.destinationLocaleCode,
        path: page.destinationPath,
        title: page.title,
        description: page.description,
        content: page.safeContent
      }
    ])
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    WIKI.logger.info(`(SEARCH/AZURE) Rebuilding Index...`)
    await pipeline(
      WIKI.models.knex.column({ id: 'hash' }, 'path', { locale: 'localeCode' }, 'title', 'description', 'render').select().from('pages').where({
        isPublished: true,
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: (chunk, enc, cb) => {
          cb(null, {
            id: chunk.id,
            path: chunk.path,
            locale: chunk.locale,
            title: chunk.title,
            description: chunk.description,
            content: WIKI.models.pages.cleanHTML(chunk.render)
          })
        }
      }),
      this.client.indexes.use(this.config.indexName).createIndexingStream()
    )
    WIKI.logger.info(`(SEARCH/AZURE) Index rebuilt successfully.`)
  }
}
