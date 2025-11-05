# Site Caching

This document describes the in-memory site configuration caching added to reduce unnecessary database queries when resolving site information by path or id.

## Goals
- Minimize repetitive queries for static site metadata.
- Avoid stampeding (multiple concurrent reloads) under high request concurrency.
- Provide deterministic invalidation on mutations (create/update/delete).
- Offer explicit override (`forceReload`) for operational tooling or edge cases.
- Emit an event for observers when the cache changes.

## Data Stored
The cache stores:
- `WIKI.sites`: keyed by site id (object map).
- `WIKI.sitesMappings`: path -> id map for quick reverse lookups.
- `WIKI.sitesCacheMeta`: metadata including:
  - `loadedAt`: timestamp in ms when last refreshed.
  - `version`: monotonically increasing integer (starts at 1 on first load).

## Lifecycle
1. First access: `ensureCache()` triggers `reloadCache()` if empty.
2. Subsequent accesses within TTL use existing cached data.
3. Mutations (`createSite`, `updateSite`, `deleteSite`) always call `reloadCache()` after DB operation completes.
4. Consumers can force a refresh via method calls providing `{ forceReload: true }`.

## TTL / Freshness
`ensureCache({ maxAgeMs })` compares `Date.now() - loadedAt` to the configured TTL. The TTL is sourced from `WIKI.config.sitesCacheTTL` with a default of 60000 ms (1 minute) if not configured. If expired, a refresh is initiated.

## Concurrency Control
Only one refresh occurs at a time. A refresh creates a promise stored at `WIKI.sitesCacheReloading`. Subsequent callers await the existing promise instead of triggering duplicate queries.

## Events
After successfully loading, an event `sitesCacheUpdated` is emitted (if the events system is present) with payload: `{ version }`.

## Force Reload
Passing `{ forceReload: true }` to retrieval calls bypasses TTL checks and immediately refreshes the cache (still respecting the concurrency lock).

## Accessors
Typical access patterns:
- `Site.getSiteByPath({ path, forceReload })`
- `Site.getSiteIdByPath({ path, forceReload })`
- `Site.getSiteById({ id, forceReload })`

Each accessor internally invokes `ensureCache()` before resolving.

## Version Introspection
A helper `Site.getCacheVersion()` returns `WIKI.sitesCacheMeta?.version || 0` for diagnostics and health endpoints.

## Edge Cases & Notes
- If no sites exist, the cache loads empty maps; version still increments.
- A failing load clears the lock and allows retry on next call.
- Mutations refresh after completing DB changes to ensure visibility of new state.
- If the TTL is set very low (e.g., < 1000 ms) expect frequent reloads; evaluate operational impact.

## Operational Recommendations
- Set TTL based on acceptable staleness vs. DB load. 30–120 seconds is typical for static site metadata.
- Use `forceReload` only for administrative tasks, not in general request flow.
- Observe emitted events to update downstream caches or to trigger metrics.

## Testing Summary
Jest tests cover:
- Initial load triggers single query.
- Repeated access within TTL does not query again.
- `forceReload` increments query count.
- `updateSite` & `deleteSite` cause reload and adjust cached data.

## Future Enhancements
- Add metrics counters (hits, misses, reload duration).
- Optional stale-while-revalidate mode.
- Cache size and version exposed via a health endpoint.
