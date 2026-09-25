# Weaviate Search Module

Semantic search engine for Wiki.js using Weaviate vector database.

## Features

- **Hybrid Search**: Combined BM25 keyword + semantic vector search
- **Multiple Search Modes**: hybrid, bm25, nearText
- **Incremental Rebuild**: Only reindex changed pages (hash-based detection)
- **Orphan Cleanup**: Automatically removes deleted pages from index
- **Rate Limit Handling**: Exponential backoff with configurable batch delays
- **Result Caching**: Configurable TTL with cluster-wide invalidation
- **Result Highlighting**: Query terms highlighted with `<mark>` tags
- **Search Analytics**: Track top searches and zero-result queries
- **Health Monitoring**: Periodic health checks with metrics

## Requirements

- Wiki.js 2.5+
- Weaviate 1.32+
- Node.js 18+
- Weaviate class must be pre-created with vectorizer configured

## Installation

Copy the module to your Wiki.js installation:

```bash
cp -r server/modules/search/weaviate/ /path/to/wikijs/server/modules/search/
```

Restart Wiki.js - the module will appear in Administration > Search.

## Configuration

### Connection

| Setting | Description | Default |
|---------|-------------|---------|
| host | Weaviate hostname (without protocol) | localhost |
| httpPort | HTTP/REST API port | 18080 |
| httpSecure | Use HTTPS | true |
| grpcPort | gRPC port | 50051 |
| grpcSecure | Use TLS for gRPC | true |
| skipTLSVerify | Skip TLS certificate verification (see warning below) | false |
| apiKey | Authentication key | - |
| timeout | Connection timeout (ms) | 10000 |

> **Warning**: `skipTLSVerify` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` globally due to weaviate-client limitations. This affects all HTTPS connections in the process.

### Schema

| Setting | Description | Default |
|---------|-------------|---------|
| className | Weaviate collection name | WikiPage |

### Search

| Setting | Description | Default |
|---------|-------------|---------|
| searchType | hybrid / bm25 / nearText | hybrid |
| alpha | Hybrid balance: 0=keyword, 1=semantic | 0.5 |
| searchLimit | Max results per query | 50 |
| cacheTtl | Cache duration (seconds) | 300 |
| boostTitle | Title field boost | 3 |
| boostDescription | Description field boost | 2 |
| boostTags | Tags field boost | 1 |

### Indexing

| Setting | Description | Default |
|---------|-------------|---------|
| batchSize | Documents per batch | 100 |
| batchDelayMs | Delay between batches (ms) | 1000 |
| maxBatchBytes | Max batch size (bytes) | 10MB |
| forceFullRebuild | Delete all before rebuild | false |
| debugSql | Log sync table SQL queries | false |

## Weaviate Schema

Create this class in Weaviate **before** enabling the module:

```json
{
  "class": "WikiPage",
  "vectorizer": "text2vec-transformers",
  "properties": [
    { "name": "pageId", "dataType": ["int"], "indexFilterable": true },
    { "name": "title", "dataType": ["text"], "indexSearchable": true },
    { "name": "description", "dataType": ["text"], "indexSearchable": true },
    { "name": "content", "dataType": ["text"], "indexSearchable": true },
    { "name": "path", "dataType": ["text"], "indexFilterable": true },
    { "name": "locale", "dataType": ["text"], "indexFilterable": true },
    { "name": "tags", "dataType": ["text[]"], "indexSearchable": true }
  ]
}
```

## Search Types

### Hybrid (recommended)

Combined keyword + semantic search. Adjust `alpha`:

| Alpha | Behavior |
|-------|----------|
| 0.0 | Pure BM25 keyword |
| 0.5 | Balanced (default) |
| 1.0 | Pure semantic |

### BM25

Pure keyword search with configurable field boosting.

### NearText

Pure semantic search based on embedding similarity.

## Rebuild Modes

### Incremental (default)

- Compares content hash to detect changes
- Only reindexes modified pages
- Tracks sync status in `weaviate_sync_status` table
- Cleans orphan pages after rebuild

### Full (`forceFullRebuild: true`)

- Deletes all documents from Weaviate
- Reindexes all pages from scratch
- Use when schema changes or index is corrupted

Both modes use streaming to avoid memory issues with large wikis.

## API Reference

| Method | Description |
|--------|-------------|
| `query(q, opts)` | Search for pages |
| `created(page)` | Index a new page |
| `updated(page)` | Update indexed page |
| `deleted(pageId)` | Remove from index |
| `renamed(page)` | Handle path change |
| `rebuild()` | Rebuild index |
| `isHealthy()` | Health check |
| `getStats()` | Index statistics |
| `getMetrics()` | Module metrics |
| `getSearchAnalytics(opts)` | Search analytics |
| `suggest(prefix, opts)` | Auto-complete |

## Troubleshooting

### Class not found

The module does not create the class. Create it manually with your vectorizer.

### Connection timeout

1. Verify both HTTP and gRPC ports are accessible
2. Check TLS certificates
3. Check firewall rules

### Empty results after rebuild

1. Check logs for indexing errors
2. Verify vectorizer is configured
3. Try full rebuild (`forceFullRebuild: true`)

### Rate limiting during rebuild

Increase `batchDelayMs` (e.g., 2000ms) or decrease `batchSize`.

## License

AGPL-3.0 (same as Wiki.js)
