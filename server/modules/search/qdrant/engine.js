
const _ = require('lodash')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const { v4: uuidv4 } = require('uuid')
const cheerio = require('cheerio')

const { Qdrant } = require('./qdrantapi')
const cohere = require('cohere-ai')

/* global WIKI */
const COLLECTION_NAME = 'test_collection'
const NUMBER_OF_RESULTS = 10 // number of results
const HNSW_EF_VALUE = 128

const schema = {
  name: COLLECTION_NAME,
  vectors: {
    size: 768,
    distance: 'Dot'
  }
}

function getFullTextConfing(fieldName) {
  return {
    field_name: fieldName,
    field_schema: {
      type: 'text',
      tokenizer: 'prefix',
      min_token_len: 2,
      max_token_len: 20,
      lowercase: true
    }
  }
}

async function generateVectors(texts) {
  const { body: { embeddings: textsVectors } } = await cohere.embed({
    texts,
    model: 'multilingual-22-12'
  })
  return textsVectors
};

function generateDataPoints(texts, textsVectors) {
  const dataPoints = texts.map((text, idx) => ({
    id: uuidv4(),
    payload: text,
    vector: textsVectors[idx]
  }))
  return dataPoints
};

function extractTextsFromPage(pageData) {
  const $ = cheerio.load(pageData.content)

  const headersAndParagraphs = $('h1, h2, h3, p').map(function (i, el) {
    const text = $(this).text().replace(/\n/g, '').trim().replace(/ +/g, ' ')
    return {
      elementId: el.attribs.id,
      elementType: el.tagName,
      elementContent: text
    }
  }).get()

  const texts = headersAndParagraphs.reduce((acc, curr) => {
    if (['h1', 'h2', 'h3'].includes(curr.elementType)) {
      return { currentHeader: curr.elementContent, currentHeaderId: curr.elementId, arr: [...acc.arr] }
    } else {
      return {
        ...acc,
        arr: [...acc.arr, {
          pid: curr.elementId, // warning: this required the paragraphs in the html to have an id
          headerText: acc.currentHeader,
          headerUrl: acc.currentHeaderId,
          content: curr.elementContent,
          pageTitle: pageData.title,
          pageUrl: pageData.path
        }]
      }
    };
  }, { currentHeader: null, arr: [] }).arr

  texts.push({
    pageTitle: pageData.title,
    pageUrl: pageData.path
  })

  return texts
};

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
    WIKI.logger.info(`(SEARCH/qdrant) Initializing...`)
    WIKI.logger.info(JSON.stringify(this.config))

    try {
      WIKI.logger.info(`(SEARCH/QDRANT) Initializing...`)
      cohere.init(this.config.cohereApiKey)

      this.client = new Qdrant(this.config.qdrantHostName, this.config.qdrantApiKey)

      const createResult = await this.client.createCollection(COLLECTION_NAME, schema)
      if (createResult.err) {
        console.error(`ERROR:  Couldn't create collection "${COLLECTION_NAME}"!`)
        console.error(createResult.err)
      } else {
        // console.log(`Success! Collection "${COLLECTION_NAME} created!"`);
        // console.log(createResult.response);
      }

      WIKI.logger.info(`(SEARCH/QDRANT) Initialization completed.`)
    } catch (err) {
      console.error(err)
    }
  },
  async created(page) {

  },
  async updated(page) {

  },
  async deleted(page) {

  },
  async renamed(page) {

  },
  async query(q, opts) {
    console.log('opts', opts.path)
    try {
      const queryVector = await generateVectors([q])
      console.log('queryVector: ', queryVector)

      let vectorResult = await this.client.searchCollection(
        COLLECTION_NAME,
        queryVector[0],
        7,
        HNSW_EF_VALUE
      )
      if (vectorResult.err) {
        console.error(`ERROR: Couldn't search ${queryVector}`)
        console.error(vectorResult.err)
        throw new Error('Search  by vector')
      }
      const query = {
        'filter': {
          'should': [
            { 'key': 'content', 'match': { 'text': q } },
            { 'key': 'headerText', 'match': { 'text': q } }
          ]
        },
        'top': 3,
        'vector': queryVector[0],
        'with_payload': true
      }
      const textResults = await this.client.queryCollection(COLLECTION_NAME, query)
      if (textResults.err) {
        console.error(`ERROR: Couldn't search ${q}`)
        console.error(textResults.err)
        throw new Error('Search  by text')
      }
      // merge the results with unique ids
      const results = _.uniqBy([...vectorResult.response.result, ...textResults.response.result], 'id')
      return {
        results: results.map(result => {
          const {
            pid,
            // headerText,
            headerUrl,
            content,
            pageUrl,
            pageTitle
          } = result.payload
          console.log(result.payload)

          if (content) { // if there is not content then 'result' is not a pragraph but a title
            return {
              id: `${pageUrl}_${pid}`,
              title: pageTitle,
              description: content,
              path: `${pageUrl}?pid=${pid}#${headerUrl}`,
              locale: 'en'
            }
          } else {
            return {
              id: pageUrl,
              title: pageTitle,
              description: 'Page',
              path: pageUrl,
              locale: 'en'
            }
          };
        }),
        suggestions: [],
        totalHits: results.length
      }
    } catch (err) {
      WIKI.logger.warn('Search Engine Error:')
      WIKI.logger.warn(err)
    }
  },
  /**
 * REBUILD INDEX
 */
  async rebuild() {
    try {
      WIKI.logger.info(`(SEARCH/QDRANT) Rebuilding index...`)

      // query for the contents in the db
      const pagesRaw = await WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'render')
        .select()
        .from('pages')
        .where({
          isPublished: true,
          isPrivate: false
        })
        .returning('*')

      const pages = pagesRaw.map(page => {
        // console.log('page: ', page);
        const { render, ...remainingProps } = page
        const pageContent = extractTextsFromPage({ content: render })
        // console.log('pageContent', pageContent);
        const pageContentWithTitleProps = pageContent.map(pageElement => {
          const { content, headerUrl, headerText } = pageElement
          return {
            ...content ? pageElement : {},
            ...content ? { headerUrl: headerUrl } : {},
            ...content ? { headerText: headerText.replace('\u00b6', '').trim() } : {},
            pageTitle: remainingProps.title,
            pageUrl: remainingProps.path
          }
        })

        return pageContentWithTitleProps
      })

      const pageContents = pages.flat().map(pageElement => ({
        ...pageElement.content ? { content: pageElement.content } : { pageTitle: pageElement.pageTitle }
      }))

      const pageContentsVectors = await generateVectors(pageContents.map(contentItem => {
        if (contentItem.content) {
          return contentItem.content
        } else {
          return contentItem.pageTitle
        };
      }))

      const dataPoints = generateDataPoints(pages.flat(), pageContentsVectors)
      console.log(dataPoints)

      // delete collection in qdrant db
      const deleteResult = await this.client.deleteCollection(COLLECTION_NAME)
      if (deleteResult.err) {
        console.error(`ERROR:  Couldn't delete collection "${COLLECTION_NAME}"!`)
        console.error(deleteResult.err)
      } else {
        console.log(`Success! Collection "${COLLECTION_NAME} deleted!"`)
        // console.log(create_result.response);
      }

      // create collection again in qdrant db
      let createResult = await this.client.createCollection(COLLECTION_NAME, schema)
      if (createResult.err) {
        throw new Error(`ERROR:  Couldn't create collection "${COLLECTION_NAME}"!`)
      }

      createResult = await this.client.indexCollection(COLLECTION_NAME, getFullTextConfing('content'))
      if (createResult.err) {
        throw new Error(`ERROR:  Couldn't create text index for content!`)
      }
      createResult = await this.client.indexCollection(COLLECTION_NAME, getFullTextConfing('headerText'))
      if (createResult.err) {
        throw new Error(`ERROR:  Couldn't create text index for headerText!`)
      }
      console.log(`Success! Collection "${COLLECTION_NAME} created!"`)

      // upload datapoints to newly created collection
      const uploadResult = await this.client.uploadPoints(COLLECTION_NAME, dataPoints)

      if (uploadResult.err) {
        console.error(`ERROR:  Couldn't create collection "${COLLECTION_NAME}"!`)
        console.error(uploadResult.err)
      } else {
        console.log(`Success! Data points were uploaded!"`)
        // console.log(uploadResult.response);
      }

      WIKI.logger.info(`(SEARCH/QDRANT) Index was rebuilt...`)
    } catch (err) {
      console.error(err)
    }
  }
}
