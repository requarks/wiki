const { LocalIndex } = require('vectra');
const embeddings = require('@themaximalist/embeddings.js').default;
const cheerio = require('cheerio');

/* global WIKI */

let config = null;
let vectraIndex = null;
let removedPages = new Set();

function getConfig() {
  const defaults = { indexPath: './vectra-index', model: 'Xenova/all-MiniLM-L6-v2' };
  const appCfg = (WIKI && WIKI.data && WIKI.data.searchEngine && WIKI.data.searchEngine.config) || {};
  return Object.assign({}, defaults, appCfg);
}

function getPageHtml(page) {
  return page && (page.safeContent || page.render || page.content || '');
}

function chunkPage(page) {
  const html = getPageHtml(page);
  const $ = cheerio.load(html || '');
  return $('p, h1, h2, h3, h4, h5, h6, code, pre, blockquote')
    .map((i, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 0);
}

async function embedChunks(chunks) {
  return Promise.all(chunks.map(text => embeddings(text, { service: 'transformers', model: config.model })));
}

async function addToVectra(pageId, chunks, vectors, pagePath) {
    for (let i = 0; i < chunks.length; i++) {
    await vectraIndex.insertItem({
        vector: vectors[i],
      metadata: { pageId, chunkIndex: i, text: chunks[i], path: pagePath }
      });
    }
  }

async function queryVectra(queryVector, topK) {
  const results = await vectraIndex.queryItems(queryVector, topK);
  if (removedPages.size > 0) {
    return results.filter(r => !removedPages.has(r.item.metadata.pageId));
  }
    return results;
  }

function extractTitleFromChunk(text) {
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length < 100 && !/[.!?]$/.test(line)) return line;
  }
  return lines[0] ? (lines[0].length > 50 ? lines[0].slice(0, 50) + '...' : lines[0]) : 'Untitled';
}

async function indexPage(page) {
  const pageId = page.hash || page.id || page.pageId;
  const pagePath = page.path || page.destinationPath || '';
  if (removedPages.has(pageId)) removedPages.delete(pageId);
  const chunks = chunkPage(page);
  if (chunks.length === 0) return;
  const vectors = await embedChunks(chunks);
  await addToVectra(pageId, chunks, vectors, pagePath);
}

module.exports = {
  async activate() {
    config = getConfig();
    WIKI && WIKI.logger && WIKI.logger.info(`(SEARCH/VECTRA) Activating - indexPath=${config.indexPath}, model=${config.model}`);
    await embeddings('', { service: 'transformers', model: config.model });
    vectraIndex = new LocalIndex(config.indexPath);
    try {
      await vectraIndex.createIndex();
      WIKI && WIKI.logger && WIKI.logger.info(`(SEARCH/VECTRA) Index created at ${config.indexPath}`);
    } catch (e) {
      if (e && e.message === 'Index already exists') {
        WIKI && WIKI.logger && WIKI.logger.info(`(SEARCH/VECTRA) Index already exists at ${config.indexPath}`);
      } else {
        throw e;
      }
    }
  },

  async deactivate() {
    vectraIndex = null;
    config = null;
    removedPages.clear();
    WIKI && WIKI.logger && WIKI.logger.info('(SEARCH/VECTRA) Deactivated');
  },

  async init() {
    if (!vectraIndex) {
      await this.activate();
    }
  },

  async query(q, opts = {}) {
    if (!vectraIndex) return { results: [], suggestions: [], totalHits: 0 };
    try {
      const qVec = await embeddings(q || '', { service: 'transformers', model: config.model });
      const limit = opts.limit || 10;
      const raw = await queryVectra(qVec, Math.max(limit * 2, 10));
      const results = raw.slice(0, limit).map((r, idx) => {
        const text = r.item.metadata.text || '';
        const path = r.item.metadata.path || '';
        const title = extractTitleFromChunk(text);
        const description = text.length > 200 ? text.slice(0, 200) + '...' : text;
        return {
          id: `${r.item.metadata.pageId}:${r.item.metadata.chunkIndex ?? idx}`,
          locale: (WIKI && WIKI.config && WIKI.config.lang && WIKI.config.lang.code) || 'en',
          path,
          title,
          description
        };
      });
      return { results, suggestions: [], totalHits: raw.length };
    } catch (e) {
      WIKI && WIKI.logger && WIKI.logger.warn('(SEARCH/VECTRA) Query error:', e.message || e);
      return { results: [], suggestions: [], totalHits: 0 };
    }
  },

  async created(page) {
    await indexPage(page);
  },

  async updated(page) {
    await indexPage(page);
  },

  async deleted(page) {
    const pageId = page.hash || page.id || page.pageId;
    removedPages.add(pageId);
  },

  async renamed(page) {
    // Remove old then index new
    if (page.hash) removedPages.add(page.hash);
    await indexPage({
      id: page.destinationHash || page.id,
      path: page.destinationPath || page.path,
      safeContent: page.safeContent || page.render || page.content || ''
    });
  },

  async rebuild() {
    if (!vectraIndex) await this.activate();
    // Clear existing index by recreating directory
    const fs = require('fs');
    const path = require('path');
    const indexPath = path.resolve(config.indexPath);
    if (fs.existsSync(indexPath)) fs.rmSync(indexPath, { recursive: true, force: true });
    vectraIndex = new LocalIndex(config.indexPath);
    await vectraIndex.createIndex();
    removedPages.clear();

    WIKI && WIKI.logger && WIKI.logger.info('(SEARCH/VECTRA) Rebuilding index...');
    const rows = await WIKI.models.knex
      .column({ hash: 'hash' }, 'path', { localeCode: 'localeCode' }, 'title', 'description', 'render')
      .select()
      .from('pages')
      .where({ isPublished: true, isPrivate: false });

    for (const row of rows) {
      await indexPage({ id: row.hash, path: row.path, safeContent: row.render });
    }
    WIKI && WIKI.logger && WIKI.logger.info('(SEARCH/VECTRA) Rebuild completed.');
  }
};