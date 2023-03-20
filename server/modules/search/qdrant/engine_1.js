const cohere = require('cohere-ai')
const cheerio = require('cheerio')
const { v4: uuidv4 } = require('uuid')
const { Qdrant } = require('./qdrant-library/index')
const { body_request: request } = require('./qdrant-library/request')

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

const fulltextIndexConfig = {
  field_name: '',
  field_schema: {
    type: 'text',
    tokenizer: 'prefix',
    min_token_len: 2,
    max_token_len: 20,
    lowercase: true
  }
}

async function generateVectors (texts) {
  const { body: { embeddings: textsVectors } } = await cohere.embed({
    texts,
    model: 'multilingual-22-12'
  })
  return textsVectors
};

function generateDataPoints (texts, textsVectors) {
  const dataPoints = texts.map((text, idx) => ({
    id: uuidv4(),
    payload: text,
    vector: textsVectors[idx]
  }))
  return dataPoints
};

function extractTextsFromPage (pageData) {
  const $ = cheerio.load(pageData.content)

  const headersAndParagraphs = $('h3, p').map(function(i, el) {
    const text = $(this).text().replace(/\n/g, '').trim().replace(/ +/g, ' ')
    return {
      elementId: el.attribs.id,
      elementType: el.tagName,
      elementContent: text
    }
  }).get()

  if (!headersAndParagraphs.some(item => item.elementType === 'h3')) {
    throw new Error('At least one header h3 is necessary to parse correctly the contents of the page')
  };

  const texts = headersAndParagraphs.reduce((acc, curr) => {
    if (curr.elementType === 'h3') {
      return { currentHeader: curr.elementContent, arr: [ ...acc.arr ] }
    } else {
      return {
        ...acc,
        arr: [ ...acc.arr, {
          pid: curr.elementId, // warning: this required the paragraphs in the html to have an id
          headerText: acc.currentHeader,
          headerUrl: acc.currentHeader.toLowerCase().replaceAll(' ', '-'),
          content: curr.elementContent,
          pageTitle: pageData.title,
          pageUrl: pageData.path
        } ]
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
  activate() {

  },
  deactivate() {

  },

  async init () {
    try {
      WIKI.logger.info(`(SEARCH/QDRANT) Initializing...`)

      cohere.init(this.config.cohereApiKey)
      this.client = new Qdrant(this.config.cloudClusterUrl, this.config.qdrantApiKey)

      const createResult = await this.client.create_collection(COLLECTION_NAME, schema, fulltextIndexConfig)
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

  async query(query, opts) {
    console.log('opts', opts.path)
    try {
      const queryVector = await generateVectors([ query ])
      console.log('queryVector: ', queryVector)
      const filter = {
        'must': [
          { 'key': 'content', 'match': { 'text': query } }
        ]
      }

      const searchResult = await this.client.search_collection(
        COLLECTION_NAME,
        queryVector[0],
        NUMBER_OF_RESULTS,
        HNSW_EF_VALUE
      )

      // console.log('searchResult---------', JSON.stringify(searchResult, null, 2));

      if (searchResult.err) {
        console.error(`ERROR: Couldn't search ${queryVector}`)
        console.error(searchResult.err)
      } else {
        return {
          results: searchResult.response.result.map(result => {
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
          totalHits: searchResult.response.result.length
        }
      }
    } catch (err) {
      WIKI.logger.warn('Search Engine Error:')
      WIKI.logger.warn(err)
    }
  },

  async created(page) {
    try {
      WIKI.logger.info(`(SEARCH/QDRANT) Creating new page...`)

      const texts = extractTextsFromPage(page)
      const textsVectors = await generateVectors(texts.map(t => {
        if (t.content) {
          return t.content
        } else { // if there is not content then t is not a pragraph but a title
          return t.pageTitle
        };
      }))
      const dataPoints = generateDataPoints(texts, textsVectors)

      const upload_result = await this.client.upload_points(COLLECTION_NAME, dataPoints)
      WIKI.logger.info(`(SEARCH/QDRANT) New page was created...`)
    } catch (err) {
      console.error(err)
    }
  },
  async updated(page) {
    try {
      WIKI.logger.info(`(SEARCH/QDRANT) Updating page...`)

      // delete all data points which pertain to the updating page
      const deleteEndpoint = `${this.config.cloudClusterUrl}collections/${COLLECTION_NAME}/points/delete`
      const body = {
        filter: {
          must: [
            {
              key: 'pageUrl',
              match: {
                value: page.path
              }
            }
          ]
        }
      }
      const deletePointsResult = await request(deleteEndpoint, body, 'POST', this.config.qdrantApiKey)
      if (deletePointsResult.err) {
        console.error(`ERROR:  Couldn't delete collection "${COLLECTION_NAME}"!`)
        console.error(deletePointsResult.err)
      } else {
        // console.log(`Success! Data points were deleted!"`);
        // console.log(deletePointsResult.response);
      }

      // generate new vectors and data points with the updated page data
      const texts = extractTextsFromPage(page)
      const textsVectors = await generateVectors(texts.map(t => {
        if (t.content) {
          return t.content
        } else { // if there is not content then t is not a pragraph but a title
          return t.pageTitle
        };
      }))
      const dataPoints = generateDataPoints(texts, textsVectors)

      // upload the newly created data points
      const upload_result = await this.client.upload_points(COLLECTION_NAME, dataPoints)

      WIKI.logger.info(`(SEARCH/QDRANT) Page was updated...`)
    } catch (err) {
      console.error(err)
    }
  },
  async deleted(page) {
    try {
      WIKI.logger.info(`(SEARCH/QDRANT) Deleting ${page.path} page...`)
      // delete all data points which pertain to the updating page
      const deleteEndpoint = `${this.config.cloudClusterUrl}collections/${COLLECTION_NAME}/points/delete`
      const body = {
        filter: {
          must: [
            {
              key: 'pageUrl',
              match: {
                value: page.path
              }
            }
          ]
        }
      }
      const deletePointsResult = await request(deleteEndpoint, body, 'POST', this.config.qdrantApiKey)
      console.log(deletePointsResult)
      WIKI.logger.info(`(SEARCH/QDRANT) Page ${page.path} was deleted...`)
    } catch (err) {
      console.error(err)
    }
  },
  renamed() {

  },
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
        const pageContent = extractTextsFromPage({ content: render.replaceAll('+', '') })
        // console.log('pageContent', pageContent);
        const pageContentWithTitleProps = pageContent.map(pageElement => {
          const { content, headerUrl, headerText } = pageElement
          return {
            ...content ? pageElement : {},
            ...content ? { headerUrl: headerUrl.replace('\u00b6', '').substring(1) } : {},
            ...content ? { headerText: headerText.replace('\u00b6', '').substring(1) } : {},
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
      const deleteResult = await this.client.delete_collection(COLLECTION_NAME)
      if (deleteResult.err) {
        console.error(`ERROR:  Couldn't delete collection "${COLLECTION_NAME}"!`)
        console.error(deleteResult.err)
      } else {
        console.log(`Success! Collection "${COLLECTION_NAME} deleted!"`)
        // console.log(create_result.response);
      }

      // create collection again in qdrant db
      const createResult = await this.client.create_collection(COLLECTION_NAME, schema)
      if (createResult.err) {
        console.error(`ERROR:  Couldn't create collection "${COLLECTION_NAME}"!`)
        console.error(createResult.err)
      } else {
        console.log(`Success! Collection "${COLLECTION_NAME} created!"`)
        // console.log(createResult.response);
      }

      // upload datapoints to newly created collection
      const uploadResult = await this.client.upload_points(COLLECTION_NAME, dataPoints)

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
