/* global WIKI */

const weaviate = require('weaviate-client')
const { v5: uuidv5 } = require('uuid')
const striptags = require('striptags')
const _ = require('lodash')
const stream = require('stream')
const { promisify } = require('util')

const pipeline = promisify(stream.pipeline)

// ============================================================================
// CONSTANTS
// ============================================================================

// Namespace UUID for Wiki.js pages
const WIKIJS_NAMESPACE = 'b5a1c5d0-5c5e-4e5a-9c5a-5c5e4e5a9c5a'

// Cache
const CACHE_PREFIX = 'weaviate:'
const DEFAULT_CACHE_TTL = 300 // 5 minutes
const CACHE_VERSION_TTL = 86400 // 24 hours

// Timing
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_BATCH_SIZE = 100
const DEFAULT_BATCH_DELAY_MS = 1000
const DEFAULT_MAX_BATCH_BYTES = 10 * 1024 * 1024 // 10MB

// Search
const DEFAULT_SEARCH_LIMIT = 50
const SNIPPET_LENGTH = 200

// Thresholds
const SLOW_QUERY_THRESHOLD_MS = 500
const HIGH_FAILURE_RATE_THRESHOLD = 5 // percent

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract error message from various error formats
 * @param {Error|Object|string} err - Error object
 * @returns {string} Error message
 */
function getErrorMessage(err) {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  if (err.message) return err.message
  if (err.code) return `Error code: ${err.code}`
  if (typeof err.toString === 'function') {
    const str = err.toString()
    if (str !== '[object Object]') return str
  }
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

// ============================================================================
// METRICS & ANALYTICS
// ============================================================================

const metrics = {
  queries: 0,
  queriesSuccess: 0,
  queriesFailed: 0,
  queryLatencySum: 0,
  indexedPages: 0,
  deletedPages: 0,
  rebuilds: 0,
  lastRebuildDuration: 0,
  lastRebuildPages: 0,
  lastRebuildErrors: 0,
  lastHealthCheck: null,
  startTime: Date.now()
}

// Search analytics - track query patterns
const searchAnalytics = {
  // Map of query -> { count, lastSeen, totalLatency, zeroResults }
  queries: new Map(),
  // Limit to prevent memory bloat
  maxTrackedQueries: 1000,
  // Minimum query length to track
  minQueryLength: 2
}

/**
 * Normalize a search query for analytics
 * @param {string} query - Raw search query
 * @returns {string} Normalized query
 */
function normalizeQuery(query) {
  return _.trim(query).toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Generate cache key for search query
 * @param {string} query - Search query
 * @param {Object} opts - Search options
 * @param {number} version - Cache version for invalidation
 * @returns {string} Cache key
 */
function getCacheKey(query, opts = {}, version = 0) {
  const normalized = normalizeQuery(query)
  const locale = _.get(opts, 'locale', 'all')
  const path = _.get(opts, 'path', 'all')
  return `${CACHE_PREFIX}v${version}:query:${locale}:${path}:${normalized}`
}

/**
 * Track a search query for analytics
 * @param {string} query - Search query
 * @param {number} resultCount - Number of results
 * @param {number} latencyMs - Query latency in ms
 */
function trackSearch(query, resultCount, latencyMs) {
  const normalized = normalizeQuery(query)

  if (normalized.length < searchAnalytics.minQueryLength) {
    return
  }

  const existing = searchAnalytics.queries.get(normalized)

  if (existing) {
    existing.count++
    existing.lastSeen = Date.now()
    existing.totalLatency += latencyMs
    if (resultCount === 0) {
      existing.zeroResults++
    }
  } else {
    // Check if we need to evict old entries
    if (searchAnalytics.queries.size >= searchAnalytics.maxTrackedQueries) {
      // Remove oldest entry
      let oldestKey = null
      let oldestTime = Infinity
      for (const [key, val] of searchAnalytics.queries) {
        if (val.lastSeen < oldestTime) {
          oldestTime = val.lastSeen
          oldestKey = key
        }
      }
      if (oldestKey) {
        searchAnalytics.queries.delete(oldestKey)
      }
    }

    searchAnalytics.queries.set(normalized, {
      count: 1,
      lastSeen: Date.now(),
      totalLatency: latencyMs,
      zeroResults: resultCount === 0 ? 1 : 0
    })
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert Wiki.js page ID to deterministic UUID
 * @param {number} pageId - Wiki.js page ID
 * @returns {string} UUID v5
 */
function pageIdToUUID(pageId) {
  return uuidv5(String(pageId), WIKIJS_NAMESPACE)
}

/**
 * Clean HTML content for indexing
 * @param {string} html - HTML content
 * @returns {string} Clean text
 */
function cleanContent(html) {
  if (!html) return ''
  return striptags(html)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Transform tags array to simple string array
 * @param {Array} tags - Wiki.js tags
 * @returns {Array<string>} Tag strings
 */
function transformTags(tags) {
  if (!_.isArray(tags)) return []
  return _.map(tags, t => _.get(t, 'tag', t)).filter(Boolean)
}

/**
 * Transform Wiki.js page object to Weaviate object
 * @param {Object} page - Wiki.js page object
 * @returns {Object} Weaviate object
 */
function pageToWeaviateObject(page) {
  const obj = {
    pageId: page.id,
    title: _.get(page, 'title', ''),
    description: _.get(page, 'description', ''),
    content: cleanContent(_.get(page, 'content', '')),
    path: _.get(page, 'path', ''),
    locale: _.get(page, 'locale', 'en'),
    tags: transformTags(_.get(page, 'tags', []))
  }

  // Add dates if available (requires updatedAt/createdAt in Weaviate schema)
  const createdAt = _.get(page, 'createdAt')
  const updatedAt = _.get(page, 'updatedAt')

  if (createdAt) {
    obj.createdAt = new Date(createdAt).toISOString()
  }
  if (updatedAt) {
    obj.updatedAt = new Date(updatedAt).toISOString()
  }

  return obj
}

/**
 * Validate and set defaults for config
 * @param {Object} config - Configuration object
 * @throws {Error} If required config is missing
 */
function validateConfig(config) {
  const required = ['host', 'apiKey', 'className']
  const missing = _.filter(required, key => !_.get(config, key))

  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}`)
  }

  config.httpPort = _.get(config, 'httpPort', 18080)
  config.grpcPort = _.get(config, 'grpcPort', 50051)
  config.searchType = _.get(config, 'searchType', 'hybrid')
  config.alpha = _.get(config, 'alpha', 0.5)
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise} Result of function
 */
async function withRetry(fn, maxRetries = 3) {
  let lastError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const status = _.get(err, 'status', 0)

      if (status >= 400 && status < 500) {
        throw err
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000
        WIKI.logger.warn(`(SEARCH/WEAVIATE) Retry ${attempt}/${maxRetries} after ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Extract snippet with highlighted query terms
 * @param {string} content - Full content
 * @param {string} query - Search query
 * @param {number} snippetLength - Max snippet length
 * @returns {string} Highlighted snippet
 */
function extractHighlightedSnippet(content, query, snippetLength = SNIPPET_LENGTH) {
  if (!content || !query) return ''

  const cleanText = cleanContent(content)
  const queryTerms = _.words(query.toLowerCase())

  // Find best position (first occurrence of any query term)
  let bestPos = 0

  for (const term of queryTerms) {
    const pos = cleanText.toLowerCase().indexOf(term)
    if (pos !== -1) {
      bestPos = pos
      break
    }
  }

  // Extract snippet around best position
  const start = Math.max(0, bestPos - Math.floor(snippetLength / 4))
  const end = Math.min(cleanText.length, start + snippetLength)
  let snippet = cleanText.slice(start, end)

  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet
  if (end < cleanText.length) snippet = snippet + '...'

  // Highlight query terms with <mark> tags
  for (const term of queryTerms) {
    if (term.length < 2) continue
    const regex = new RegExp(`(${_.escapeRegExp(term)})`, 'gi')
    snippet = snippet.replace(regex, '<mark>$1</mark>')
  }

  return snippet
}

/**
 * Generate search suggestions based on query
 * @param {string} query - Search query
 * @param {Array} results - Search results
 * @returns {Array<string>} Suggestions
 */
function generateSuggestions(query, results) {
  if (!results || results.length === 0) return []

  const suggestions = []
  const queryLower = query.toLowerCase()

  // Extract unique terms from top result titles
  const titleTerms = new Set()
  _.take(results, 5).forEach(result => {
    const title = _.get(result, 'properties.title', '')
    _.words(title).forEach(word => {
      if (word.length > 3 && !queryLower.includes(word.toLowerCase())) {
        titleTerms.add(word.toLowerCase())
      }
    })
  })

  // Create suggestions by combining query with related terms
  titleTerms.forEach(term => {
    if (suggestions.length < 5) {
      suggestions.push(`${query} ${term}`)
    }
  })

  return suggestions
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // State
  client: null,
  collection: null,
  healthCheckJob: null,
  _sqlDebugEnabled: false,
  _boundOnCacheInvalidate: null,
  _boundOnFlushCache: null,

  /**
   * Get batch configuration with defaults
   * @returns {Object} Batch config
   * @private
   */
  _getBatchConfig() {
    return {
      batchSize: this.config.batchSize || DEFAULT_BATCH_SIZE,
      maxBatchBytes: this.config.maxBatchBytes || DEFAULT_MAX_BATCH_BYTES,
      batchDelayMs: this.config.batchDelayMs || DEFAULT_BATCH_DELAY_MS
    }
  },

  /**
   * Activate the module
   */
  async activate() {
    // Reset metrics on activation
    metrics.startTime = Date.now()
    // Clear analytics on activation
    searchAnalytics.queries.clear()

    // Subscribe to cluster events for cache invalidation
    // Store bound functions for proper cleanup in deactivate()
    if (WIKI.events && WIKI.events.inbound) {
      this._boundOnCacheInvalidate = this._onCacheInvalidate.bind(this)
      this._boundOnFlushCache = this._onFlushCache.bind(this)
      WIKI.events.inbound.on('search.weaviate.invalidateCache', this._boundOnCacheInvalidate)
      WIKI.events.inbound.on('flushCache', this._boundOnFlushCache)
      WIKI.logger.debug('(SEARCH/WEAVIATE) Subscribed to cluster events')
    }

    // Start periodic health check
    this.healthCheckInterval = setInterval(() => {
      this._periodicHealthCheck().catch(err => {
        WIKI.logger.warn('(SEARCH/WEAVIATE) Health check error:', getErrorMessage(err))
      })
    }, HEALTH_CHECK_INTERVAL_MS)
    WIKI.logger.debug(`(SEARCH/WEAVIATE) Started periodic health check (every ${HEALTH_CHECK_INTERVAL_MS / 60000} minutes)`)
  },

  /**
   * Deactivate the module
   */
  async deactivate() {
    // Log analytics summary before shutdown
    this._logAnalyticsSummary()

    // Unsubscribe from cluster events
    if (WIKI.events && WIKI.events.inbound) {
      if (this._boundOnCacheInvalidate) {
        WIKI.events.inbound.off('search.weaviate.invalidateCache', this._boundOnCacheInvalidate)
        this._boundOnCacheInvalidate = null
      }
      if (this._boundOnFlushCache) {
        WIKI.events.inbound.off('flushCache', this._boundOnFlushCache)
        this._boundOnFlushCache = null
      }
    }

    // Stop health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    if (this.client) {
      try {
        await this.client.close()
        WIKI.logger.info('(SEARCH/WEAVIATE) Connection closed')
      } catch (err) {
        WIKI.logger.warn('(SEARCH/WEAVIATE) Error closing connection:', getErrorMessage(err))
      }
      this.client = null
      this.collection = null
    }
  },

  /**
   * Initialize connection to Weaviate
   */
  async init() {
    WIKI.logger.info('(SEARCH/WEAVIATE) Initializing...')

    // Log configuration (excluding sensitive data)
    WIKI.logger.debug('(SEARCH/WEAVIATE) Config:', JSON.stringify({
      host: this.config.host,
      httpPort: this.config.httpPort,
      grpcPort: this.config.grpcPort,
      httpSecure: this.config.httpSecure,
      grpcSecure: this.config.grpcSecure,
      className: this.config.className,
      searchType: this.config.searchType,
      alpha: this.config.alpha,
      searchLimit: this.config.searchLimit,
      batchSize: this.config.batchSize,
      batchDelayMs: this.config.batchDelayMs,
      cacheTtl: this.config.cacheTtl,
      forceFullRebuild: this.config.forceFullRebuild,
      debugSql: this.config.debugSql
    }))

    try {
      validateConfig(this.config)

      // Create sync status table if it doesn't exist
      await this._ensureSyncTable()

      // Handle TLS options
      const httpSecure = this.config.httpSecure !== false
      const grpcSecure = this.config.grpcSecure !== false
      const skipTLSVerify = this.config.skipTLSVerify === true

      // WARNING: skipTLSVerify sets a global process flag as weaviate-client doesn't support per-connection TLS options
      // This affects ALL HTTPS connections in the process. Use only for self-signed certs in dev/staging.
      if (skipTLSVerify) {
        WIKI.logger.warn('(SEARCH/WEAVIATE) TLS verification disabled globally - use only for self-signed certificates')
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      }

      const timeout = this.config.timeout || DEFAULT_TIMEOUT_MS
      this.client = await weaviate.connectToCustom({
        httpHost: this.config.host,
        httpPort: this.config.httpPort,
        httpSecure: httpSecure,
        grpcHost: this.config.host,
        grpcPort: this.config.grpcPort,
        grpcSecure: grpcSecure,
        authCredentials: new weaviate.ApiKey(this.config.apiKey),
        timeout: { init: timeout, query: timeout, insert: timeout }
      })

      const ready = await this.client.isReady()
      if (!ready) {
        throw new Error('Cluster is not ready')
      }

      const collections = await this.client.collections.listAll()
      const classExists = _.some(collections, c => c.name === this.config.className)

      if (!classExists) {
        throw new Error(`Class "${this.config.className}" does not exist. Create it manually with vectorizer configured.`)
      }

      this.collection = this.client.collections.get(this.config.className)

      WIKI.logger.info(`(SEARCH/WEAVIATE) Initialization completed. Connected to ${this.config.host}, class: ${this.config.className}`)

    } catch (err) {
      WIKI.logger.error('(SEARCH/WEAVIATE) Initialization failed:', getErrorMessage(err))
      throw err
    }
  },

  /**
   * Ensure sync status table exists
   * @private
   */
  async _ensureSyncTable() {
    const tableName = 'weaviate_sync_status'
    const hasTable = await WIKI.models.knex.schema.hasTable(tableName)

    if (!hasTable) {
      WIKI.logger.info('(SEARCH/WEAVIATE) Creating sync status table...')
      await WIKI.models.knex.schema.createTable(tableName, table => {
        table.integer('pageId').primary()
        table.string('indexedHash', 255)
        table.timestamp('indexedAt')
      })
      WIKI.logger.info('(SEARCH/WEAVIATE) Sync status table created')
    }

    // Setup SQL debugging if enabled
    if (this.config.debugSql) {
      this._setupSqlDebug()
    }
  },

  /**
   * Setup SQL query debugging
   * @private
   */
  _setupSqlDebug() {
    if (this._sqlDebugEnabled) return // Prevent duplicate listeners

    WIKI.models.knex.on('query', (query) => {
      // Only log queries related to our sync table
      if (query.sql && query.sql.includes('weaviate_sync_status')) {
        WIKI.logger.debug(`(SEARCH/WEAVIATE) SQL: ${query.sql}`)
        if (query.bindings && query.bindings.length > 0) {
          WIKI.logger.debug(`(SEARCH/WEAVIATE) SQL bindings: ${JSON.stringify(query.bindings)}`)
        }
      }
    })

    WIKI.models.knex.on('query-error', (error, query) => {
      if (query.sql && query.sql.includes('weaviate_sync_status')) {
        WIKI.logger.error(`(SEARCH/WEAVIATE) SQL Error: ${error.message}`)
        WIKI.logger.error(`(SEARCH/WEAVIATE) SQL: ${query.sql}`)
        if (query.bindings) {
          WIKI.logger.error(`(SEARCH/WEAVIATE) SQL bindings: ${JSON.stringify(query.bindings)}`)
        }
      }
    })

    this._sqlDebugEnabled = true
    WIKI.logger.info('(SEARCH/WEAVIATE) SQL debugging enabled')
  },

  /**
   * Search for pages
   * @param {string} q - Search query
   * @param {Object} opts - Search options
   * @returns {Object} Search results
   */
  async query(q, opts = {}) {
    const startTime = Date.now()
    metrics.queries++

    try {
      if (!q || !_.trim(q)) {
        return { results: [], suggestions: [], totalHits: 0 }
      }

      // Check cache first (with version for invalidation)
      let cacheVersion = 0
      if (WIKI.cache) {
        cacheVersion = await WIKI.cache.get(`${CACHE_PREFIX}version`) || 0
        const cacheKey = getCacheKey(q, opts, cacheVersion)
        const cached = await WIKI.cache.get(cacheKey)
        if (cached) {
          WIKI.logger.debug(`(SEARCH/WEAVIATE) Cache hit for "${q}"`)
          metrics.queriesSuccess++
          const latency = Date.now() - startTime
          metrics.queryLatencySum += latency
          trackSearch(q, cached.results.length, latency)
          return cached
        }
      }

      WIKI.logger.debug(`(SEARCH/WEAVIATE) Searching for "${q}" (type: ${this.config.searchType})`)

      const filters = this._buildFilters(opts)

      let response

      switch (this.config.searchType) {
        case 'hybrid':
          response = await this._hybridSearch(q, filters)
          break
        case 'bm25':
          response = await this._bm25Search(q, filters)
          break
        case 'nearText':
          response = await this._nearTextSearch(q, filters)
          break
        default:
          response = await this._hybridSearch(q, filters)
      }

      const objects = _.get(response, 'objects', [])

      // Transform results with highlighting
      const results = _.map(objects, obj => ({
        id: _.get(obj, 'properties.pageId', '').toString(),
        title: _.get(obj, 'properties.title', ''),
        description: _.get(obj, 'properties.description', ''),
        path: _.get(obj, 'properties.path', ''),
        locale: _.get(obj, 'properties.locale', 'en'),
        highlight: extractHighlightedSnippet(
          _.get(obj, 'properties.content', '') || _.get(obj, 'properties.description', ''),
          q
        )
      }))

      // Generate suggestions
      const suggestions = generateSuggestions(q, objects)

      const latency = Date.now() - startTime
      metrics.queriesSuccess++
      metrics.queryLatencySum += latency

      // Track for analytics
      trackSearch(q, results.length, latency)

      // Log slow queries at warn level for visibility
      if (latency > SLOW_QUERY_THRESHOLD_MS) {
        WIKI.logger.warn(`(SEARCH/WEAVIATE) Slow query "${q}" took ${latency}ms (${results.length} results)`)
      } else {
        WIKI.logger.debug(`(SEARCH/WEAVIATE) Found ${results.length} results in ${latency}ms`)
      }

      const result = {
        results,
        suggestions,
        totalHits: results.length
      }

      // Store in cache
      if (WIKI.cache) {
        const cacheKey = getCacheKey(q, opts, cacheVersion)
        const cacheTtl = this.config.cacheTtl || DEFAULT_CACHE_TTL
        await WIKI.cache.set(cacheKey, result, cacheTtl)
      }

      return result

    } catch (err) {
      metrics.queriesFailed++
      // Track failed search (0 results)
      trackSearch(q, 0, Date.now() - startTime)
      WIKI.logger.warn('(SEARCH/WEAVIATE) Search failed:', getErrorMessage(err))
      return { results: [], suggestions: [], totalHits: 0 }
    }
  },

  /**
   * Auto-complete suggestions based on page titles
   * @param {string} prefix - Search prefix (what user is typing)
   * @param {Object} opts - Options (locale, limit)
   * @returns {Array} Array of suggestions
   */
  async suggest(prefix, opts = {}) {
    try {
      if (!prefix || prefix.length < 2) {
        return []
      }

      const limit = _.get(opts, 'limit', 10)

      // Build filters
      const filters = this._buildFilters(opts)

      // Use BM25 on title field for fast prefix matching
      const boostTitle = _.get(this.config, 'boostTitle', 3)
      const options = {
        query: prefix,
        queryProperties: [
          boostTitle > 1 ? `title^${boostTitle}` : 'title',
          'description'
        ],
        limit,
        returnProperties: ['pageId', 'title', 'path', 'locale']
      }

      if (filters) {
        options.filters = filters
      }

      const response = await this.collection.query.bm25(prefix, options)
      const objects = _.get(response, 'objects', [])

      // Return simple suggestion objects
      return objects.map(obj => ({
        id: _.get(obj, 'properties.pageId', '').toString(),
        title: _.get(obj, 'properties.title', ''),
        path: _.get(obj, 'properties.path', ''),
        locale: _.get(obj, 'properties.locale', 'en')
      }))

    } catch (err) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) Suggest failed:', getErrorMessage(err))
      return []
    }
  },

  /**
   * Index a new page
   * @param {Object} page - Wiki.js page object
   */
  async created(page) {
    if (!page || !page.id) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) created() called with invalid page')
      return
    }

    try {
      WIKI.logger.debug(`(SEARCH/WEAVIATE) Indexing page ${page.id}: ${_.get(page, 'title', 'untitled')}`)

      const uuid = pageIdToUUID(page.id)
      const data = pageToWeaviateObject(page)

      await withRetry(async () => {
        await this.collection.data.insert({
          id: uuid,
          properties: data
        })
      })

      // Update sync status
      await this._upsertSyncStatus(page.id, page.hash)

      metrics.indexedPages++
      WIKI.logger.debug(`(SEARCH/WEAVIATE) Page ${page.id} indexed successfully`)

      // Invalidate cache and notify cluster
      await this._invalidateCache()

    } catch (err) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) Failed to index page:', getErrorMessage(err))
    }
  },

  /**
   * Update an existing page
   * @param {Object} page - Wiki.js page object
   */
  async updated(page) {
    if (!page || !page.id) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) updated() called with invalid page')
      return
    }

    try {
      WIKI.logger.debug(`(SEARCH/WEAVIATE) Updating page ${page.id}: ${_.get(page, 'title', 'untitled')}`)

      const uuid = pageIdToUUID(page.id)
      const data = pageToWeaviateObject(page)

      await withRetry(async () => {
        await this.collection.data.replace({
          id: uuid,
          properties: data
        })
      })

      // Update sync status
      await this._upsertSyncStatus(page.id, page.hash)

      WIKI.logger.debug(`(SEARCH/WEAVIATE) Page ${page.id} updated successfully`)

      // Invalidate cache and notify cluster
      await this._invalidateCache()

    } catch (err) {
      const errMsg = getErrorMessage(err)
      if (errMsg.includes('not found')) {
        return this.created(page)
      }
      WIKI.logger.warn('(SEARCH/WEAVIATE) Failed to update page:', getErrorMessage(err))
    }
  },

  /**
   * Delete a page from index
   * @param {number} pageId - Wiki.js page ID
   */
  async deleted(pageId) {
    if (!pageId) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) deleted() called with invalid pageId')
      return
    }

    try {
      WIKI.logger.debug(`(SEARCH/WEAVIATE) Deleting page ${pageId}`)

      const uuid = pageIdToUUID(pageId)

      await withRetry(async () => {
        await this.collection.data.deleteById(uuid)
      })

      // Remove from sync status
      await this._deleteSyncStatus(pageId)

      metrics.deletedPages++
      WIKI.logger.debug(`(SEARCH/WEAVIATE) Page ${pageId} deleted successfully`)

      // Invalidate cache and notify cluster
      await this._invalidateCache()

    } catch (err) {
      const errMsg = getErrorMessage(err)
      if (!errMsg.includes('not found')) {
        WIKI.logger.warn('(SEARCH/WEAVIATE) Failed to delete page:', getErrorMessage(err))
      }
      // Still try to remove from sync status even if Weaviate delete failed
      await this._deleteSyncStatus(pageId)
    }
  },

  /**
   * Handle page rename
   * @param {Object} page - Wiki.js page object with new path
   */
  async renamed(page) {
    WIKI.logger.debug(`(SEARCH/WEAVIATE) Renaming page ${_.get(page, 'id', 'unknown')}: ${_.get(page, 'path', 'unknown')}`)
    return this.updated(page)
  },

  /**
   * Rebuild search index (incremental by default, full if forceFullRebuild is enabled)
   */
  async rebuild() {
    if (this.config.forceFullRebuild) {
      return this._rebuildFull()
    }
    return this._rebuildIncremental()
  },

  /**
   * Full index rebuild - deletes everything and reindexes using streams (memory efficient)
   * @private
   */
  async _rebuildFull() {
    WIKI.logger.info('(SEARCH/WEAVIATE) Starting FULL index rebuild...')

    const startTime = Date.now()
    let processed = 0
    let indexed = 0
    let errors = 0

    try {
      WIKI.logger.info('(SEARCH/WEAVIATE) Clearing existing index...')
      await this.collection.data.deleteMany(
        this.collection.filter.byProperty('pageId').greaterOrEqual(0)
      )

      // Clear sync status table
      await this._truncateSyncStatus()

      // Get total count for progress logging
      const countResult = await WIKI.models.knex('pages')
        .where({ isPublished: true, isPrivate: false })
        .count('id as count')
        .first()
      const totalPages = parseInt(countResult.count, 10)

      WIKI.logger.info(`(SEARCH/WEAVIATE) Found ${totalPages} pages to index`)

      const { batchSize, maxBatchBytes, batchDelayMs } = this._getBatchConfig()

      let batch = []
      let batchPages = [] // Track pages in current batch for sync status
      let batchBytes = 0

      const self = this

      // Process pages as a stream to avoid loading all in memory
      await pipeline(
        WIKI.models.knex
          .select('id', 'path', 'hash', 'title', 'description', 'render as content', 'localeCode as locale', 'createdAt', 'updatedAt')
          .from('pages')
          .where({ isPublished: true, isPrivate: false })
          .stream(),
        new stream.Transform({
          objectMode: true,
          transform: async function (page, encoding, callback) {
            try {
              const uuid = pageIdToUUID(page.id)
              const data = pageToWeaviateObject(page)
              const objectSize = JSON.stringify(data).length

              // Flush batch if size limits reached
              if (batch.length >= batchSize || (batchBytes + objectSize) > maxBatchBytes) {
                const result = await self._flushBatchWithRetry(batch)
                const successCount = batch.length - result.errors
                processed += batch.length
                indexed += successCount
                errors += result.errors

                // Only update sync status for successfully indexed pages
                if (successCount > 0) {
                  // Filter out failed pages from sync status update
                  const successfulPages = result.failedUuids.size > 0
                    ? batchPages.filter(p => !result.failedUuids.has(pageIdToUUID(p.id)))
                    : batchPages
                  if (successfulPages.length > 0) {
                    await self._bulkUpsertSyncStatus(successfulPages)
                  }
                }

                batch = []
                batchPages = []
                batchBytes = 0

                await new Promise(resolve => setTimeout(resolve, batchDelayMs))

                if (processed % 500 === 0) {
                  WIKI.logger.info(`(SEARCH/WEAVIATE) Progress: ${processed}/${totalPages} pages processed...`)
                }
              }

              batch.push({ id: uuid, properties: data })
              batchPages.push(page)
              batchBytes += objectSize

              callback()
            } catch (err) {
              callback(err)
            }
          },
          flush: async function (callback) {
            try {
              // Flush remaining batch
              if (batch.length > 0) {
                const result = await self._flushBatchWithRetry(batch)
                const successCount = batch.length - result.errors
                processed += batch.length
                indexed += successCount
                errors += result.errors

                // Only update sync status for successfully indexed pages
                if (successCount > 0) {
                  const successfulPages = result.failedUuids.size > 0
                    ? batchPages.filter(p => !result.failedUuids.has(pageIdToUUID(p.id)))
                    : batchPages
                  if (successfulPages.length > 0) {
                    await self._bulkUpsertSyncStatus(successfulPages)
                  }
                }
              }
              callback()
            } catch (err) {
              callback(err)
            }
          }
        })
      )

      const duration = ((Date.now() - startTime) / 1000).toFixed(1)

      metrics.rebuilds++
      metrics.lastRebuildDuration = parseFloat(duration)
      metrics.lastRebuildPages = indexed
      metrics.lastRebuildErrors = errors

      WIKI.logger.info(`(SEARCH/WEAVIATE) Full rebuild complete. ${indexed}/${processed} pages indexed in ${duration}s (${errors} errors)`)

      // Clean orphan pages from Weaviate
      await this._cleanOrphans()

      await this._invalidateCache()

    } catch (err) {
      WIKI.logger.error('(SEARCH/WEAVIATE) Full rebuild failed:', getErrorMessage(err))
      throw err
    }
  },

  /**
   * Incremental index rebuild - only syncs changed pages using streams (memory efficient)
   * @private
   */
  async _rebuildIncremental() {
    WIKI.logger.info('(SEARCH/WEAVIATE) Starting INCREMENTAL index rebuild...')

    const startTime = Date.now()
    let created = 0
    let updated = 0
    let deleted = 0
    let skipped = 0
    let errors = 0

    try {
      // Get sync status from our tracking table (small: just pageId + hash)
      const syncStatus = await WIKI.models.knex('weaviate_sync_status').select('pageId', 'indexedHash')
      const syncMap = new Map(syncStatus.map(s => [s.pageId, s.indexedHash]))

      // Get current page IDs only (not full content) for deletion detection
      const currentPageIds = new Set()

      // Get total count for progress
      const countResult = await WIKI.models.knex('pages')
        .where({ isPublished: true, isPrivate: false })
        .count('id as count')
        .first()
      const totalPages = parseInt(countResult.count, 10)

      WIKI.logger.info(`(SEARCH/WEAVIATE) Found ${totalPages} pages in DB, ${syncMap.size} in sync table`)

      const { batchSize, batchDelayMs } = this._getBatchConfig()

      let toCreateBatch = []
      let toCreatePages = []
      let toUpdateBatch = []
      let processed = 0

      const self = this

      // Stream pages and categorize them
      await pipeline(
        WIKI.models.knex
          .select('id', 'path', 'hash', 'title', 'description', 'render as content', 'localeCode as locale', 'createdAt', 'updatedAt')
          .from('pages')
          .where({ isPublished: true, isPrivate: false })
          .stream(),
        new stream.Transform({
          objectMode: true,
          transform: async function (page, encoding, callback) {
            try {
              currentPageIds.add(page.id)
              const indexedHash = syncMap.get(page.id)

              if (!indexedHash) {
                // New page - add to create batch
                toCreateBatch.push({
                  id: pageIdToUUID(page.id),
                  properties: pageToWeaviateObject(page)
                })
                toCreatePages.push(page)

                // Flush create batch if full
                if (toCreateBatch.length >= batchSize) {
                  const result = await self._flushBatchWithRetry(toCreateBatch)
                  const successCount = toCreateBatch.length - result.errors
                  created += successCount
                  errors += result.errors

                  // Only update sync status for successfully indexed pages
                  if (successCount > 0) {
                    const successfulPages = result.failedUuids.size > 0
                      ? toCreatePages.filter(p => !result.failedUuids.has(pageIdToUUID(p.id)))
                      : toCreatePages
                    if (successfulPages.length > 0) {
                      await self._bulkUpsertSyncStatus(successfulPages)
                    }
                  }

                  toCreateBatch = []
                  toCreatePages = []
                  await new Promise(resolve => setTimeout(resolve, batchDelayMs))
                }
              } else if (indexedHash !== page.hash) {
                // Changed page - add to update batch
                toUpdateBatch.push(page)

                // Flush update batch if full
                if (toUpdateBatch.length >= batchSize) {
                  for (const p of toUpdateBatch) {
                    try {
                      await self.collection.data.replace({
                        id: pageIdToUUID(p.id),
                        properties: pageToWeaviateObject(p)
                      })
                      await self._upsertSyncStatus(p.id, p.hash)
                      updated++
                    } catch (err) {
                      WIKI.logger.warn(`(SEARCH/WEAVIATE) Failed to update page ${p.id}:`, getErrorMessage(err))
                      errors++
                    }
                  }
                  toUpdateBatch = []
                  await new Promise(resolve => setTimeout(resolve, batchDelayMs))
                }
              } else {
                // Unchanged
                skipped++
              }

              processed++
              if (processed % 1000 === 0) {
                WIKI.logger.info(`(SEARCH/WEAVIATE) Progress: ${processed}/${totalPages} pages scanned...`)
              }

              callback()
            } catch (err) {
              callback(err)
            }
          },
          flush: async function (callback) {
            try {
              // Flush remaining create batch
              if (toCreateBatch.length > 0) {
                const result = await self._flushBatchWithRetry(toCreateBatch)
                const successCount = toCreateBatch.length - result.errors
                created += successCount
                errors += result.errors

                // Only update sync status for successfully indexed pages
                if (successCount > 0) {
                  const successfulPages = result.failedUuids.size > 0
                    ? toCreatePages.filter(p => !result.failedUuids.has(pageIdToUUID(p.id)))
                    : toCreatePages
                  if (successfulPages.length > 0) {
                    await self._bulkUpsertSyncStatus(successfulPages)
                  }
                }
              }

              // Flush remaining update batch
              if (toUpdateBatch.length > 0) {
                for (const p of toUpdateBatch) {
                  try {
                    await self.collection.data.replace({
                      id: pageIdToUUID(p.id),
                      properties: pageToWeaviateObject(p)
                    })
                    await self._upsertSyncStatus(p.id, p.hash)
                    updated++
                  } catch (err) {
                    WIKI.logger.warn(`(SEARCH/WEAVIATE) Failed to update page ${p.id}:`, getErrorMessage(err))
                    errors++
                  }
                }
              }

              callback()
            } catch (err) {
              callback(err)
            }
          }
        })
      )

      // Find and delete pages that are in sync table but not in DB anymore
      const toDelete = []
      for (const [pageId] of syncMap) {
        if (!currentPageIds.has(pageId)) {
          toDelete.push(pageId)
        }
      }

      if (toDelete.length > 0) {
        WIKI.logger.info(`(SEARCH/WEAVIATE) Deleting ${toDelete.length} removed pages...`)
        for (const pageId of toDelete) {
          try {
            await this.collection.data.deleteById(pageIdToUUID(pageId))
            deleted++
          } catch (err) {
            if (!getErrorMessage(err).includes('not found')) {
              WIKI.logger.warn(`(SEARCH/WEAVIATE) Failed to delete page ${pageId}:`, getErrorMessage(err))
              errors++
            } else {
              deleted++ // Count as deleted if not found (already gone)
            }
          }
          // Always remove from sync status
          await this._deleteSyncStatus(pageId)
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1)

      metrics.rebuilds++
      metrics.lastRebuildDuration = parseFloat(duration)
      metrics.lastRebuildPages = created + updated
      metrics.lastRebuildErrors = errors

      WIKI.logger.info(`(SEARCH/WEAVIATE) Incremental rebuild complete in ${duration}s: ${created} created, ${updated} updated, ${deleted} deleted, ${skipped} unchanged (${errors} errors)`)

      // Clean orphan pages from Weaviate (pages that might have been missed)
      const orphansDeleted = await this._cleanOrphans()

      if (created > 0 || updated > 0 || deleted > 0 || orphansDeleted > 0) {
        await this._invalidateCache()
      }

    } catch (err) {
      WIKI.logger.error('(SEARCH/WEAVIATE) Incremental rebuild failed:', getErrorMessage(err))
      throw err
    }
  },

  /**
   * Check if the search engine is healthy
   * @returns {Object} Health status
   */
  async isHealthy() {
    try {
      if (!this.client) {
        return { healthy: false, error: 'Client not initialized' }
      }

      const ready = await this.client.isReady()
      const live = await this.client.isLive()

      metrics.lastHealthCheck = new Date().toISOString()

      if (!ready || !live) {
        return {
          healthy: false,
          ready,
          live,
          error: !ready ? 'Cluster not ready' : 'Cluster not live'
        }
      }

      return {
        healthy: true,
        ready: true,
        live: true,
        host: this.config.host,
        className: this.config.className
      }

    } catch (err) {
      return {
        healthy: false,
        error: getErrorMessage(err)
      }
    }
  },

  /**
   * Get index statistics
   * @returns {Object} Index stats
   */
  async getStats() {
    try {
      if (!this.collection) {
        return { error: 'Collection not initialized' }
      }

      // Get object count via aggregate
      const aggregate = await this.collection.aggregate.overAll()

      return {
        objectCount: _.get(aggregate, 'totalCount', 0),
        className: this.config.className,
        searchType: this.config.searchType,
        alpha: this.config.alpha
      }

    } catch (err) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) Failed to get stats:', getErrorMessage(err))
      return { error: getErrorMessage(err) }
    }
  },

  /**
   * Get module metrics
   * @returns {Object} Metrics data
   */
  getMetrics() {
    const uptime = Date.now() - metrics.startTime
    const avgLatency = metrics.queriesSuccess > 0
      ? Math.round(metrics.queryLatencySum / metrics.queriesSuccess)
      : 0

    return {
      uptime,
      uptimeHuman: `${Math.floor(uptime / 1000 / 60)} minutes`,
      queries: {
        total: metrics.queries,
        success: metrics.queriesSuccess,
        failed: metrics.queriesFailed,
        successRate: metrics.queries > 0
          ? ((metrics.queriesSuccess / metrics.queries) * 100).toFixed(1) + '%'
          : 'N/A',
        avgLatencyMs: avgLatency
      },
      indexing: {
        pagesIndexed: metrics.indexedPages,
        pagesDeleted: metrics.deletedPages,
        rebuilds: metrics.rebuilds,
        lastRebuild: metrics.lastRebuildDuration > 0
          ? {
              duration: `${metrics.lastRebuildDuration}s`,
              pages: metrics.lastRebuildPages,
              errors: metrics.lastRebuildErrors
            }
          : null
      },
      lastHealthCheck: metrics.lastHealthCheck
    }
  },

  /**
   * Get search analytics data
   * @param {Object} opts - Options
   * @param {number} opts.limit - Max results per category (default 20)
   * @returns {Object} Analytics data
   */
  getSearchAnalytics(opts = {}) {
    const limit = _.get(opts, 'limit', 20)
    const entries = Array.from(searchAnalytics.queries.entries())

    // Top searches (sorted by count)
    const topSearches = entries
      .map(([query, data]) => ({
        query,
        count: data.count,
        avgLatencyMs: Math.round(data.totalLatency / data.count),
        lastSeen: new Date(data.lastSeen).toISOString()
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    // Searches with zero results (sorted by count)
    const zeroResultSearches = entries
      .filter(([, data]) => data.zeroResults > 0)
      .map(([query, data]) => ({
        query,
        totalSearches: data.count,
        zeroResultCount: data.zeroResults,
        zeroResultRate: ((data.zeroResults / data.count) * 100).toFixed(1) + '%',
        lastSeen: new Date(data.lastSeen).toISOString()
      }))
      .sort((a, b) => b.zeroResultCount - a.zeroResultCount)
      .slice(0, limit)

    // Recent searches (sorted by lastSeen)
    const recentSearches = entries
      .map(([query, data]) => ({
        query,
        count: data.count,
        lastSeen: new Date(data.lastSeen).toISOString()
      }))
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
      .slice(0, limit)

    return {
      totalUniqueQueries: searchAnalytics.queries.size,
      topSearches,
      zeroResultSearches,
      recentSearches
    }
  },

  /**
   * Clear search analytics data
   */
  clearSearchAnalytics() {
    searchAnalytics.queries.clear()
    WIKI.logger.info('(SEARCH/WEAVIATE) Search analytics cleared')
  },

  /**
   * Flush batch of pages to Weaviate with retry on rate limit
   * @param {Array} batch - Array of objects to insert
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Object} Result with error count
   * @private
   */
  async _flushBatchWithRetry(batch, maxRetries = 3) {
    let lastResult = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this._flushBatch(batch)
      lastResult = result

      // Check if we have rate limit errors (429)
      if (result.rateLimited && result.rateLimited.length > 0 && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        WIKI.logger.warn(`(SEARCH/WEAVIATE) Rate limited on ${result.rateLimited.length} items, retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))

        // Retry only the rate-limited items
        batch = result.rateLimited
      } else {
        break
      }
    }

    return lastResult
  },

  /**
   * Flush batch of pages to Weaviate
   * @param {Array} batch - Array of objects to insert
   * @returns {Object} Result with error count, failed UUIDs, and rate-limited items
   * @private
   */
  async _flushBatch(batch) {
    let errorCount = 0
    let rateLimited = []
    let failedUuids = new Set()

    WIKI.logger.debug(`(SEARCH/WEAVIATE) Flushing batch of ${batch.length} items...`)

    // Create a map from UUID to batch item for error lookup
    const batchByUuid = new Map()
    batch.forEach((item, index) => {
      batchByUuid.set(item.id, item)
      batchByUuid.set(String(index), item) // Also map by index for clients that use numeric keys
    })

    try {
      const startTime = Date.now()
      const result = await this.collection.data.insertMany(batch)
      const duration = Date.now() - startTime

      WIKI.logger.debug(`(SEARCH/WEAVIATE) Batch inserted in ${duration}ms`)

      if (result.hasErrors) {
        // result.errors can be keyed by UUID or by numeric index depending on client version
        _.forEach(result.errors, (err, key) => {
          const errMsg = getErrorMessage(err) || _.get(err, 'error.message') || JSON.stringify(err)
          // Try to find the item by key (could be UUID or index)
          let failedItem = batchByUuid.get(key)
          // If key is numeric string, also try as number
          if (!failedItem && /^\d+$/.test(key)) {
            failedItem = batch[parseInt(key, 10)]
          }

          // Check for rate limit error
          if (errMsg.includes('429') || errMsg.includes('Rate limit') || errMsg.includes('rate limit')) {
            if (failedItem) {
              rateLimited.push(failedItem)
              failedUuids.add(failedItem.id)
            } else {
              WIKI.logger.warn(`(SEARCH/WEAVIATE) Rate limited item not found in batch: ${key}`)
              errorCount++
            }
          } else {
            errorCount++
            if (failedItem) {
              failedUuids.add(failedItem.id)
            }
            const pageId = failedItem ? _.get(failedItem, 'properties.pageId', 'unknown') : 'unknown'
            WIKI.logger.warn(`(SEARCH/WEAVIATE) Batch error [pageId=${pageId}]: ${errMsg}`)
          }
        })
      }
    } catch (err) {
      WIKI.logger.error('(SEARCH/WEAVIATE) Batch insert failed:', getErrorMessage(err))
      throw err
    }

    return { errors: errorCount, rateLimited, failedUuids }
  },

  /**
   * Hybrid search (BM25 + semantic)
   * @param {string} query - Search query
   * @param {Object} filters - Weaviate filters
   * @returns {Object} Search response
   * @private
   */
  async _hybridSearch(query, filters) {
    const options = {
      query,
      alpha: this.config.alpha,
      limit: this.config.searchLimit || DEFAULT_SEARCH_LIMIT,
      returnProperties: ['pageId', 'title', 'description', 'content', 'path', 'locale'],
      returnMetadata: ['score']
    }

    if (filters) {
      options.filters = filters
    }

    return this.collection.query.hybrid(query, options)
  },

  /**
   * BM25 keyword search
   * @param {string} query - Search query
   * @param {Object} filters - Weaviate filters
   * @returns {Object} Search response
   * @private
   */
  async _bm25Search(query, filters) {
    // Build queryProperties with configurable boosts
    const boostTitle = _.get(this.config, 'boostTitle', 3)
    const boostDesc = _.get(this.config, 'boostDescription', 2)
    const boostTags = _.get(this.config, 'boostTags', 1)

    const queryProperties = [
      boostTitle > 1 ? `title^${boostTitle}` : 'title',
      boostDesc > 1 ? `description^${boostDesc}` : 'description',
      'content',
      boostTags > 1 ? `tags^${boostTags}` : 'tags'
    ]

    const options = {
      query,
      queryProperties,
      limit: this.config.searchLimit || DEFAULT_SEARCH_LIMIT,
      returnProperties: ['pageId', 'title', 'description', 'content', 'path', 'locale'],
      returnMetadata: ['score']
    }

    if (filters) {
      options.filters = filters
    }

    return this.collection.query.bm25(query, options)
  },

  /**
   * Semantic search with embeddings
   * @param {string} query - Search query
   * @param {Object} filters - Weaviate filters
   * @returns {Object} Search response
   * @private
   */
  async _nearTextSearch(query, filters) {
    const options = {
      limit: this.config.searchLimit || DEFAULT_SEARCH_LIMIT,
      returnProperties: ['pageId', 'title', 'description', 'content', 'path', 'locale'],
      returnMetadata: ['distance']
    }

    if (filters) {
      options.filters = filters
    }

    return this.collection.query.nearText([query], options)
  },

  /**
   * Log analytics summary to the logger
   * @private
   */
  _logAnalyticsSummary() {
    const analytics = this.getSearchAnalytics({ limit: 10 })

    if (analytics.totalUniqueQueries === 0) {
      WIKI.logger.info('(SEARCH/WEAVIATE) Analytics: No searches recorded yet')
      return
    }

    WIKI.logger.info(`(SEARCH/WEAVIATE) Analytics Summary - ${analytics.totalUniqueQueries} unique queries`)

    if (analytics.topSearches.length > 0) {
      WIKI.logger.info('(SEARCH/WEAVIATE) Top searches:')
      analytics.topSearches.slice(0, 5).forEach((s, i) => {
        WIKI.logger.info(`  ${i + 1}. "${s.query}" (${s.count}x, avg ${s.avgLatencyMs}ms)`)
      })
    }

    if (analytics.zeroResultSearches.length > 0) {
      WIKI.logger.info('(SEARCH/WEAVIATE) Zero-result searches:')
      analytics.zeroResultSearches.slice(0, 5).forEach((s, i) => {
        WIKI.logger.info(`  ${i + 1}. "${s.query}" (${s.zeroResultCount}/${s.totalSearches} = ${s.zeroResultRate})`)
      })
    }
  },

  /**
   * Build Weaviate filters from search options
   * @param {Object} opts - Search options
   * @returns {Object|null} Weaviate filter object
   * @private
   */
  _buildFilters(opts) {
    const conditions = []

    if (_.get(opts, 'locale')) {
      conditions.push(
        this.collection.filter.byProperty('locale').equal(opts.locale)
      )
    }

    if (_.get(opts, 'path')) {
      conditions.push(
        this.collection.filter.byProperty('path').like(`${opts.path}*`)
      )
    }

    // Date filters (require createdAt/updatedAt in Weaviate schema)
    // updatedAfter: ISO date string - filter pages updated after this date
    if (_.get(opts, 'updatedAfter')) {
      try {
        const date = new Date(opts.updatedAfter)
        conditions.push(
          this.collection.filter.byProperty('updatedAt').greaterThan(date.toISOString())
        )
      } catch (e) {
        WIKI.logger.warn('(SEARCH/WEAVIATE) Invalid updatedAfter date:', opts.updatedAfter)
      }
    }

    // updatedBefore: ISO date string - filter pages updated before this date
    if (_.get(opts, 'updatedBefore')) {
      try {
        const date = new Date(opts.updatedBefore)
        conditions.push(
          this.collection.filter.byProperty('updatedAt').lessThan(date.toISOString())
        )
      } catch (e) {
        WIKI.logger.warn('(SEARCH/WEAVIATE) Invalid updatedBefore date:', opts.updatedBefore)
      }
    }

    // createdAfter: ISO date string - filter pages created after this date
    if (_.get(opts, 'createdAfter')) {
      try {
        const date = new Date(opts.createdAfter)
        conditions.push(
          this.collection.filter.byProperty('createdAt').greaterThan(date.toISOString())
        )
      } catch (e) {
        WIKI.logger.warn('(SEARCH/WEAVIATE) Invalid createdAfter date:', opts.createdAfter)
      }
    }

    // createdBefore: ISO date string - filter pages created before this date
    if (_.get(opts, 'createdBefore')) {
      try {
        const date = new Date(opts.createdBefore)
        conditions.push(
          this.collection.filter.byProperty('createdAt').lessThan(date.toISOString())
        )
      } catch (e) {
        WIKI.logger.warn('(SEARCH/WEAVIATE) Invalid createdBefore date:', opts.createdBefore)
      }
    }

    if (conditions.length === 0) {
      return null
    }

    if (conditions.length === 1) {
      return conditions[0]
    }

    return this.collection.filter.and(...conditions)
  },

  /**
   * Invalidate all search cache entries
   * @private
   */
  async _invalidateCache() {
    if (!WIKI.cache) return

    try {
      // Clear all weaviate query cache entries
      // Note: WIKI.cache may not support pattern deletion, so we use a version key approach
      const versionKey = `${CACHE_PREFIX}version`
      const currentVersion = await WIKI.cache.get(versionKey) || 0
      await WIKI.cache.set(versionKey, currentVersion + 1, CACHE_VERSION_TTL)

      WIKI.logger.debug('(SEARCH/WEAVIATE) Cache invalidated')

      // Notify other cluster nodes
      if (WIKI.events && WIKI.events.outbound) {
        WIKI.events.outbound.emit('search.weaviate.invalidateCache', {})
      }
    } catch (err) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) Cache invalidation failed:', getErrorMessage(err))
    }
  },

  /**
   * Handle cache invalidation event from cluster
   * @private
   */
  _onCacheInvalidate() {
    WIKI.logger.debug('(SEARCH/WEAVIATE) Received cache invalidation from cluster')
    // Cache will naturally expire or be invalidated via version key
  },

  /**
   * Handle global flush cache event
   * @private
   */
  async _onFlushCache() {
    WIKI.logger.debug('(SEARCH/WEAVIATE) Received global cache flush')
    await this._invalidateCache()
  },

  /**
   * Periodic health check job
   * @private
   */
  async _periodicHealthCheck() {
    try {
      const health = await this.isHealthy()

      if (!health.healthy) {
        WIKI.logger.warn(`(SEARCH/WEAVIATE) Health check failed: ${health.error || 'Unknown error'}`)
      } else {
        WIKI.logger.debug('(SEARCH/WEAVIATE) Health check passed')
      }

      // Log slow query warning if average latency is high
      const queryMetrics = this.getMetrics().queries
      if (queryMetrics.avgLatencyMs > SLOW_QUERY_THRESHOLD_MS && queryMetrics.total > 10) {
        WIKI.logger.warn(`(SEARCH/WEAVIATE) High average query latency: ${queryMetrics.avgLatencyMs}ms (threshold: ${SLOW_QUERY_THRESHOLD_MS}ms)`)
      }

      // Log high failure rate warning
      if (queryMetrics.total > 10) {
        const failureRate = (queryMetrics.failed / queryMetrics.total) * 100
        if (failureRate > HIGH_FAILURE_RATE_THRESHOLD) {
          WIKI.logger.warn(`(SEARCH/WEAVIATE) High query failure rate: ${failureRate.toFixed(1)}% (threshold: ${HIGH_FAILURE_RATE_THRESHOLD}%)`)
        }
      }
    } catch (err) {
      WIKI.logger.error('(SEARCH/WEAVIATE) Health check error:', getErrorMessage(err))
    }
  },

  // ============================================================================
  // SYNC STATUS TABLE HELPERS
  // ============================================================================

  /**
   * Insert or update sync status for a page
   * @param {number} pageId - Page ID
   * @param {string} hash - Page hash
   * @private
   */
  async _upsertSyncStatus(pageId, hash) {
    try {
      // Use delete + insert for Knex 0.21 compatibility (onConflict requires 0.95+)
      await WIKI.models.knex('weaviate_sync_status').where('pageId', pageId).del()
      await WIKI.models.knex('weaviate_sync_status').insert({
        pageId,
        indexedHash: hash,
        indexedAt: new Date()
      })
    } catch (err) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) Failed to update sync status:', getErrorMessage(err))
    }
  },

  /**
   * Delete sync status for a page
   * @param {number} pageId - Page ID
   * @private
   */
  async _deleteSyncStatus(pageId) {
    try {
      await WIKI.models.knex('weaviate_sync_status')
        .where('pageId', pageId)
        .del()
    } catch (err) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) Failed to delete sync status:', getErrorMessage(err))
    }
  },

  /**
   * Truncate sync status table
   * @private
   */
  async _truncateSyncStatus() {
    try {
      await WIKI.models.knex('weaviate_sync_status').truncate()
    } catch (err) {
      WIKI.logger.warn('(SEARCH/WEAVIATE) Failed to truncate sync status:', getErrorMessage(err))
    }
  },

  /**
   * Bulk insert sync status for multiple pages
   * @param {Array} pages - Array of {pageId, hash}
   * @private
   */
  async _bulkUpsertSyncStatus(pages) {
    if (!pages || pages.length === 0) return

    try {
      const records = pages
        .filter(p => (p.id || p.pageId)) // Skip pages without valid ID
        .map(p => ({
          pageId: parseInt(p.id || p.pageId, 10),
          indexedHash: p.hash || '',
          indexedAt: new Date()
        }))

      if (records.length === 0) {
        WIKI.logger.warn('(SEARCH/WEAVIATE) No valid records to insert in sync status')
        return
      }

      // Debug: log first record to verify structure
      WIKI.logger.debug('(SEARCH/WEAVIATE) Sync status sample record:', JSON.stringify(records[0]))
      WIKI.logger.debug(`(SEARCH/WEAVIATE) Inserting ${records.length} sync status records...`)

      // Insert in batches to avoid query size limits
      // Use delete + insert for Knex 0.21 compatibility (onConflict requires 0.95+)
      const batchSize = this.config.batchSize || DEFAULT_BATCH_SIZE
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        const pageIds = batch.map(r => r.pageId)
        await WIKI.models.knex('weaviate_sync_status').whereIn('pageId', pageIds).del()
        await WIKI.models.knex('weaviate_sync_status').insert(batch)
        WIKI.logger.debug(`(SEARCH/WEAVIATE) Sync status batch ${Math.floor(i / batchSize) + 1} inserted (${batch.length} records)`)
      }
      WIKI.logger.debug(`(SEARCH/WEAVIATE) Sync status updated for ${records.length} pages`)
    } catch (err) {
      // Log full error for debugging (Knex errors often have details in non-standard properties)
      const errMsg = getErrorMessage(err)
      WIKI.logger.warn('(SEARCH/WEAVIATE) Failed to bulk update sync status:', errMsg || 'Unknown error')
      WIKI.logger.warn('(SEARCH/WEAVIATE) Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)))
    }
  },

  /**
   * Fetch all pageIds from Weaviate index (paginated)
   * @returns {Set<number>} Set of pageIds in Weaviate
   * @private
   */
  async _fetchWeaviatePageIds() {
    const pageIds = new Set()
    let cursor = null
    const batchSize = 1000

    try {
      WIKI.logger.debug('(SEARCH/WEAVIATE) Fetching all pageIds from Weaviate...')

      let hasMore = true
      while (hasMore) {
        const options = {
          limit: batchSize,
          returnProperties: ['pageId']
        }
        if (cursor) {
          options.after = cursor
        }

        const result = await this.collection.query.fetchObjects(options)

        if (!result.objects || result.objects.length === 0) {
          hasMore = false
          break
        }

        for (const obj of result.objects) {
          if (obj.properties && obj.properties.pageId) {
            pageIds.add(obj.properties.pageId)
          }
          cursor = obj.uuid
        }

        WIKI.logger.debug(`(SEARCH/WEAVIATE) Fetched ${pageIds.size} pageIds so far...`)

        // Stop if we got less than requested (last page)
        hasMore = result.objects.length === batchSize
      }

      WIKI.logger.debug(`(SEARCH/WEAVIATE) Total pageIds in Weaviate: ${pageIds.size}`)
      return pageIds

    } catch (err) {
      WIKI.logger.error('(SEARCH/WEAVIATE) Failed to fetch Weaviate pageIds:', getErrorMessage(err))
      throw err
    }
  },

  /**
   * Clean orphan pages from Weaviate (pages that exist in Weaviate but not in PostgreSQL)
   * @returns {number} Number of orphans deleted
   * @private
   */
  async _cleanOrphans() {
    WIKI.logger.info('(SEARCH/WEAVIATE) Checking for orphan pages...')

    try {
      // Get all pageIds from Weaviate
      const weaviatePageIds = await this._fetchWeaviatePageIds()

      if (weaviatePageIds.size === 0) {
        WIKI.logger.info('(SEARCH/WEAVIATE) No pages in Weaviate, skipping orphan check')
        return 0
      }

      // Get all pageIds from PostgreSQL
      const pgPages = await WIKI.models.knex('pages')
        .select('id')
        .where({ isPublished: true, isPrivate: false })
      const pgPageIds = new Set(pgPages.map(p => p.id))

      // Find orphans (in Weaviate but not in PostgreSQL)
      const orphanIds = []
      for (const pageId of weaviatePageIds) {
        if (!pgPageIds.has(pageId)) {
          orphanIds.push(pageId)
        }
      }

      if (orphanIds.length === 0) {
        WIKI.logger.info('(SEARCH/WEAVIATE) No orphan pages found')
        return 0
      }

      WIKI.logger.info(`(SEARCH/WEAVIATE) Found ${orphanIds.length} orphan pages, cleaning up...`)

      let deleted = 0
      for (const pageId of orphanIds) {
        try {
          await this.collection.data.deleteById(pageIdToUUID(pageId))
          await this._deleteSyncStatus(pageId)
          deleted++
        } catch (err) {
          const errMsg = getErrorMessage(err)
          if (!errMsg.includes('not found')) {
            WIKI.logger.warn(`(SEARCH/WEAVIATE) Failed to delete orphan page ${pageId}:`, errMsg)
          } else {
            // Already gone from Weaviate, just clean sync table
            await this._deleteSyncStatus(pageId)
            deleted++
          }
        }
      }

      WIKI.logger.info(`(SEARCH/WEAVIATE) Cleaned ${deleted} orphan pages`)
      return deleted

    } catch (err) {
      WIKI.logger.error('(SEARCH/WEAVIATE) Orphan cleanup failed:', getErrorMessage(err))
      return 0 // Don't fail the whole rebuild for orphan cleanup
    }
  }
}
