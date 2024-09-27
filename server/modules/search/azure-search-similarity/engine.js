const _ = require('lodash')
const { SearchService, QueryType } = require('azure-search-client')
const {
  AzureKeyCredential,
  SearchIndexClient,
  IndexDocumentsResult,
  SearchClient,
  SearchDocumentsResult,
  SearchFieldArray,
  SelectArray,
  SelectFields,
 } = require('@azure/search-documents');
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

    this.client = new SearchIndexClient(
      this.config.endpoint,
      new AzureKeyCredential(this.config.adminKey)
    );
    // -> Create Search Index
    WIKI.logger.info(`(SEARCH/AZURE) Creating index...`)
    await this.client.createOrUpdateIndex({
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
          name: 'titleVector',
          type: 'Edm.Collection(Edm.Single)',
          searchable: true,
          vectorSearchDimensions: 1536,
          vectorSearchProfileName: 'vector-profile',
        },
        {
          name: 'description',
          type: 'Edm.String',
          searchable: true
        },
        {
          name: 'descriptionVector',
          type: 'Edm.Collection(Edm.Single)',
          searchable: true,
          vectorSearchDimensions: 1536,
          vectorSearchProfileName: 'vector-profile',
        },
        {
          name: 'content',
          type: 'Edm.String',
          searchable: true
        },
        {
          name: 'contentVector',
          type: 'Edm.Collection(Edm.Single)',
          searchable: true,
          vectorSearchDimensions: 1536,
          vectorSearchProfileName: 'vector-profile',
        },
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
      corsOptions: {
        allowedOrigins: ['*'],
      },
      vectorSearch: {
        algorithms: [{ name: 'vector-search-algorithm', kind: 'hnsw' }],
        profiles: [
          {
            name: 'vector-profile',
            algorithmConfigurationName: 'vector-search-algorithm',
          },
        ],
      },
      suggesters: [
        {
          name: 'suggestions',
          searchMode: 'analyzingInfixMatching',
          sourceFields: ['title', 'description', 'content']
        }
      ]
    })
    this.searchClient = new SearchClient(
      this.config.endpoint,
      this.config.indexName,
      new AzureKeyCredential(this.config.adminKey)
    );
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
      const results = await this.searchClient.search(q, {
        select: ['id', 'locale', 'path', 'title', 'description'],
        searchFields: ['title', 'description', 'content'],
        queryType: 'full',
        top: 50,
        includeTotalCount: true,
      });
      const searchResults = [];
      for await (const result of results.results) {
        searchResults.push(result.document);
      }
      WIKI.logger.info(`(SEARCH/AZURE) Search: ${JSON.stringify(searchResults)}.`)
      return {
        results: searchResults,
        suggestions: [],
        totalHits: results.count
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
    const doc = {
      id: page.hash,
      locale: page.localeCode,
      path: page.path,
      title: page.title,
      description: page.description,
      content: page.safeContent
    }
    await this.updateDocument(doc)
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    const doc = {
      id: page.hash,
      locale: page.localeCode,
      path: page.path,
      title: page.title,
      description: page.description,
      content: page.safeContent
    }
    await this.updateDocument(doc)
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    await this.searchClient.deleteDocuments([page.hash])
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    const doc = {
      id: page.destinationHash,
      locale: page.destinationLocaleCode,
      path: page.destinationPath,
      title: page.title,
      description: page.description,
      content: page.safeContent
    }
    await this.updateDocument(doc)
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
        transform: async (page, enc, cb) => {
          await this.rebuildPage(page)
          cb()
        }
      }),
    )
    WIKI.logger.info(`(SEARCH/AZURE) Index rebuilt successfully.`)
  },

  async updateDocument(doc) {
    const [titleVector, descriptionVector, contentVector] = await Promise.all([
      this.generateEmbedding(doc.title),
      this.generateEmbedding(doc.description),
      this.generateEmbedding(doc.content)
    ])

    WIKI.logger.info(`(SEARCH/AZURE) Generated embeddings for ${doc.id}.`)

    doc.titleVector = titleVector;
    doc.descriptionVector = descriptionVector;
    doc.contentVector = contentVector;
    await this.searchClient.mergeOrUploadDocuments([doc])
  },

  async rebuildPage(page) {
    const doc = {
      id: page.id,
      locale: page.locale,
      path: page.path,
      title: page.title,
      description: page.description,
      content: WIKI.models.pages.cleanHTML(page.render)
    }

    await this.updateDocument(doc)
    // sleep for 1 second to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  },

  async generateEmbedding(str) {
    const apiKey = this.config.embeddingModelKey;
    const apiBase = this.config.embeddingModelEndpoint;
    const deploymentName = this.config.embeddingModelDeploymentName;
    const apiVersion = this.config.embeddingModelAPIVersion;

    const url = `${apiBase}/openai/deployments/${deploymentName}/embeddings?api-version=${apiVersion}`;

    const body = {
      input: str,
    };

    try {
      const response = await request({
            uri: url,
            method: 'post',
            headers: {
              'api-key': apiKey,
              'Content-Type': 'application/json'
            },
            json: true,
            body,
          })

      return response.data[0].embedding;
    } catch (error) {
      WIKI.logger.info(`(SEARCH/AZURE) Error generating embedding. ${error}`)
    }
  }
}
