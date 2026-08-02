# Wiki.js read paths and candidates for an authorization seam

Research for [Wayfinder ticket #12](https://github.com/Jcraft153/KV-Wiki/issues/12), against KV-Wiki `primus` at commit [`4a84bad55fc78fbd5758db37db02036ddbf09c05`](https://github.com/Jcraft153/KV-Wiki/tree/4a84bad55fc78fbd5758db37db02036ddbf09c05).

## Question

Which KV-Wiki controllers, GraphQL resolvers, models, search adapters, navigation builders, relationship queries, source/history/download routes, SEO routes, render caches, and background jobs can disclose page or derived metadata today, and which candidate seam placements could bring all of them behind one deep access-aware read module with the least fork divergence?

## Findings

1. Wiki.js has a single reusable authorization predicate, `WIKI.auth.checkAccess`, but it authorizes a whole page from global permissions plus static group page rules. Its page input is only path, locale, and optionally tags; it has no Party, grant, role, preview, revision, or audience-area concept. A `manage:system` permission bypasses all page rules. [Source: `server/core/auth.js` lines 221-295](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/core/auth.js#L221-L295)
2. Authorization is repeated after data retrieval in controllers and resolvers. Several callers omit tags even though TAG page rules require them, so the existing checks are not behaviorally equivalent. For example, the page-ID redirect does not load tags, GraphQL history/version load only path and locale, and list/tree/link queries do not pass tags to `checkAccess`. [ID redirect](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/controllers/common.js#L286-L307), [history/version](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/resolvers/page.js#L17-L47), [list](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/resolvers/page.js#L76-L147), [tree and links](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/resolvers/page.js#L247-L349)
3. Page retrieval and file render caching are context-free. The cache key is derived from locale, path, and private namespace, while the cached record contains the complete rendered HTML, TOC, metadata, and page-level scripts/styles. This is safe only while every authorized reader receives the same whole-page representation. It cannot safely cache Party-, grant-, role-, or preview-specific projections under the current key. [Page cache read/write](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/pages.js#L947-L1098), [hash definition](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/helpers/page.js#L68-L73)
4. Search is not access-safe at the search seam. The active adapter returns results, suggestions, and a total before the resolver filters only `results`; `suggestions` and `totalHits` remain derived from unauthorized content. External adapters generally do not return the tags that the post-filter expects. [Resolver](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/resolvers/page.js#L49-L71), [GraphQL response contract](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/schemas/page.graphql#L257-L269)
5. Search materialization can copy full rendered content to local or third-party indexes. Rebuilds select published, non-private pages, but create/update lifecycle hooks invoke the adapter for every page without applying those filters. This creates a separate incremental-index risk even before audience areas are introduced. [Lifecycle hooks](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/pages.js#L332-L348), [update hooks](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/pages.js#L445-L459), [Postgres rebuild](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/postgres/engine.js#L158-L187)
6. Derived structures are built globally from canonical pages: `pageTree` contains every page path/title; `pageLinks` records every internal reference and rendered links are marked valid from global existence; navigation is cached by locale then filtered only by static group IDs. Area-level visibility therefore cannot be added solely at the final page controller. [Tree rebuild](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/jobs/rebuild-tree.js#L13-L69), [link derivation](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/rendering/html-core/renderer.js#L128-L195), [navigation model](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/navigation.js#L25-L66)
7. The lowest-divergence viable design is a new deep read module at the seam between all delivery/materialization callers and the raw Wiki.js models/search adapters. Extending `checkAccess` alone is too shallow because it cannot project audience areas or make counts, suggestions, relationships, caches, and exports safe. Wrapping only controllers or only `pages.getPage` leaves direct database and adapter callers outside the seam.

## Current authorization and data flow

The GraphQL `@auth` directive checks only whether a request user's global permissions contain one of the declared scopes. Page-specific rules are evaluated separately inside resolvers. [Source: `server/graph/directives/auth.js` lines 23-51](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/directives/auth.js#L23-L51)

`checkAccess` then:

- grants an unconditional page-rule bypass to `manage:system`;
- requires one requested global permission;
- evaluates rules from every user group by locale and START, END, REGEX, TAG, or EXACT matching;
- returns a boolean for the whole page.

Authenticated users carry global permissions and group IDs on `req.user`; the guest user is cached for one minute. There is no selected Party or ledger version in request context. [Source: `server/core/auth.js` lines 150-176](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/core/auth.js#L150-L176)

The main page flow is currently:

```text
request path -> load full cached/DB page -> compute whole-page permissions
             -> publishing check -> build group-filtered navigation
             -> emit full render + TOC + metadata + page JS/CSS
```

The full page is loaded before authorization, but it is sent only after the controller checks `effectivePermissions.pages.read`. The rendered view exposes the full `page.render`, TOC, metadata, and sidebar once that boolean succeeds. [Controller](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/controllers/common.js#L417-L559), [view](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/views/page.pug#L11-L40)

## Read-path inventory

### HTTP controllers and rendered HTML

| Path | Page data exposed | Current check/cache behavior | Required seam behavior |
|---|---|---|---|
| `GET /*` main/legacy page | Title, description, tags, author, timestamps, rendered HTML, TOC, publication state, page JS/CSS, comment integration, navigation | Loads context-free full page cache/DB record, then calls `getEffectivePermissions`; page metadata is assigned after authorization. | Return a read projection, not a raw page. The projection must already contain safe metadata, render, TOC, link states, effective actions, and navigation for one immutable access context. |
| `GET /i/:id` | Page existence, path, locale via redirect | Loads a page by ID and checks path/locale. The selected columns do not include tags, although `tags: page.tags` is passed. A forbidden existing ID returns 403 while a missing ID returns 404. | Resolve the ID through the read module and choose a deliberate non-disclosing not-found/forbidden policy. |
| `GET /e/*` editor | Raw source, title, description, tags, scripts/styles | Loads the full page before write/manage check. Creating from a live page/version fetches source before `read:source`/`read:history` checks. | Editor/GM authoring reads need an explicit trusted projection; Player Preview must never obtain edit authority or canonical GM source. |
| `GET /h/*` history shell | Page title/description and later GraphQL history | Loads the page, supplies tags to `getEffectivePermissions`, then renders only if `history.read`. | History access must be revision-aware and based on the requested projection, not merely current page visibility. |
| `GET /s/*` source/version | Full current or historical source plus metadata | Loads the current full page, computes effective permissions, and separately fetches a historical version. | Source reads must distinguish canonical authoring source from audience-safe source; historical revisions must not resurrect hidden areas. |
| `GET /d/*` download/version | Full source with injected metadata | Loads the current page and sends current source or a selected historical version after `read:source`/`read:history`. | Download the same authorized projection used by source/history, with safe filename and metadata. |
| `GET /t/*` tags page | Shell only; data arrives through GraphQL page tag/list queries | No controller-level page filtering. | Covered by access-aware collection queries below. |
| non-page `GET /*` asset route | Asset bytes | `read:assets` is checked only against asset path rules. It does not inherit visibility from the page/audience area that links to the asset. | Decide whether assets are public-only, carry audience metadata, or are served through audience-scoped references. Otherwise predictable asset URLs can bypass article visibility. |

Controller evidence: [download](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/controllers/common.js#L58-L99), [editor and templates](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/controllers/common.js#L101-L235), [history/source/ID](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/controllers/common.js#L237-L388), [asset delivery](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/controllers/common.js#L575-L581).

### GraphQL page and comment queries

All page query fields have a global-permission `@auth` declaration, but access-aware behavior lives in the resolver. [Schema](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/schemas/page.graphql#L17-L80)

| Query | Data/derivation | Current behavior and risk | Required seam behavior |
|---|---|---|---|
| `pages.history`, `pages.version` | Revision trail, paths, author names, complete historical source | Loads only current path/locale before the check; TAG rules cannot be evaluated. A currently readable page can expose a revision containing content that is no longer readable. | Revision-aware projection and policy for changed grants/classification. |
| `pages.search` | Hits, snippets/metadata, suggestions, total | Filters hits after adapter query; leaves suggestions and total untouched. Tag filtering works only when an adapter returns tags. | Search adapter must receive an access-safe query or query a pre-projected index; compute all response fields from the same visible corpus. |
| `pages.list` | IDs, paths, titles, descriptions, state, dates, tags | Queries all matching pages and post-filters. Although tags are joined, they are not passed to `checkAccess`. Limits apply before filtering, creating short/unstable pages. | Apply visibility before pagination/counting and return projected metadata. |
| `pages.single`, `singleByPath` | Complete page including raw source/render and scripts | Resolver permits only manage/delete despite schema allowing `read:pages`; the check omits tags. This currently limits the endpoint but is not a safe reader interface to broaden. | Split trusted authoring read from reader projection. Do not change this to a plain `read:pages` check. |
| `pages.tags`, `searchTags` | Tag vocabulary and suggestions | Loads pages then filters by path/locale without tags. Restricted tags and their cardinality can leak if page rules depend on TAG. | Derive vocabulary only from visible projections; no hidden counts/suggestions. |
| `pages.tree` | Folder/page paths, titles, hierarchy, IDs, private flags | Reads globally rebuilt `pageTree`, post-filters rows by path/locale without tags. Folder rows can reveal hidden descendants through names/hierarchy. | Build or query an audience-safe tree; prune empty folders and hidden ancestor metadata. |
| `pages.links` | Article titles/paths and outbound relationships | Queries global `pageLinks`, then checks source and target paths without tags. | Derive edges from visible source areas and visible targets; omit hidden nodes, edges, and degree/count clues. |
| `pages.checkConflicts`, `conflictLatest` | Updated timestamp or complete latest canonical source | Write/manage-only, with path/locale checks. | Keep on an explicit authoring interface; never reuse for Player Preview. |
| `comments.list`, `comments.single` | Comment render, authors, timestamps; raw content for elevated scopes | Checks `read:comments` against page path/locale/tags but does not also require the page's readable projection. A configuration can therefore allow comments independently of page visibility. | Require both visible parent projection and comment permission; decide how comments bind to audience areas. |

Resolver evidence: [page resolver](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/resolvers/page.js#L13-L390), [comment resolver](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/resolvers/comment.js#L39-L96), [comment schema](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/schemas/comment.graphql#L17-L27).

### Navigation, relationships, tags, and other derived metadata

| Derived path | Current materialization | Disclosure risk | Required seam behavior |
|---|---|---|---|
| Sidebar navigation | Cached raw items under `nav:sidebar:<locale>` for 300 seconds, then filters by static Wiki.js group IDs. | No Party/grant/preview dimension. Labels and targets are globally materialized. | Cache a safe projection by a bounded audience/access-version key, or cache canonical data internally and project before it leaves the module. |
| Page tree | Background job scans all pages and stores paths, titles, hierarchy, IDs and private flags. | Hidden page/folder names and structure exist in a global table; post-filtering leaf rows is insufficient for ancestors/counts. | Treat the raw tree as internal canonical data and expose only projected trees. |
| Internal link state | Renderer tests referenced paths against all pages, adds `is-valid-page`, and records all refs in `pageLinks`. | A reader can infer a hidden target's existence from CSS state even if relationship queries later filter the edge. | Resolve validity against the audience projection at delivery/materialization time. |
| Tags/facets | `pageTags` is global; tag lists are computed by scanning pages and filtering afterward. | Vocabulary, suggestions, facet counts, and TAG-based rules can diverge. | Calculate tags/facets after visibility in the data/index query. |
| Comments | Stored or external provider content links to a canonical page ID. | Comments may quote or identify restricted areas, and their permission is separate from `read:pages`. | Bind comments to an audience-safe parent/area policy. |
| Page metadata/SEO | SEO middleware sets only canonical request URL; the page controller later supplies title/description after the page access check. `robots.txt` exposes only configured crawler policy. | There is no separate sitemap/feed path in this source tree, but future SEO adapters could bypass the HTML projection. Shared reverse-proxy caching could still mix responses unless varied/disabled by access context. | Make public/anonymous metadata a first-class projection and require future sitemap/feed/OG adapters to consume it. |

Sources: [navigation](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/navigation.js#L25-L66), [tree job](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/jobs/rebuild-tree.js#L13-L69), [link renderer](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/rendering/html-core/renderer.js#L128-L195), [SEO middleware](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/middlewares/seo.js#L13-L20), [`robots.txt`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/controllers/common.js#L13-L23).

### Caches, indexes, exports, storage, and background jobs

| Materializer/read path | Current behavior | Required seam behavior |
|---|---|---|
| Render job | Reads complete source, runs the rendering pipeline, extracts a global TOC, persists full HTML/TOC, and writes the page file cache. | Rendering must preserve audience-area structure long enough to project safely. Either materialize bounded audience projections or keep canonical artifacts strictly internal and project before delivery. Never attempt security redaction with fragile final-HTML selectors. |
| Page file cache | Stores one complete render per locale/path/private namespace. No user, Party, role, grants, preview, or access-version key. | Cache only immutable safe projections. Keys must include a bounded projection/audience identifier and invalidation token; do not key on an unbounded user ID unless deliberately accepted. Relock/grant changes need invalidation even without a page edit. |
| Node navigation cache | Locale-only raw tree, then request-time static-group filtering. | Same projection-key and invalidation requirements as page cache. |
| Search adapters | `db`, Postgres, Algolia, AWS CloudSearch, Azure Search, and Elasticsearch query/materialize page metadata; all index-backed adapters store full cleaned render, and several provide suggestions/totals. Manticore, Solr, and Sphinx are stubs. | The deep module must give adapters only safe documents and require queries to return hits, totals, suggestions, facets, and snippets from one authorized corpus. Third-party indexes are external copies and cannot receive GM-only content if their query isolation is not proven. |
| Incremental search hooks | `createPage`/`updatePage` always call `created`/`updated`; adapter rebuilds separately filter `isPublished: true, isPrivate: false`. | Centralize index eligibility/projection so rebuild and incremental paths cannot diverge. |
| Storage adapters | Page lifecycle sends the complete page object to enabled targets. Disk, Git, SFTP, Azure and S3 implementations write source plus metadata; scheduled syncs can also enumerate pages. | Classify storage as a trusted canonical backup or an audience-specific publisher. A trusted bypass must be explicit and unavailable to reader-facing callers. |
| System export | Admin export serializes every page and every history record, including relations, with no per-page projection. It is guarded by `manage:system` at GraphQL entry. | Preserve as an explicit audited canonical-export capability, separate from ordinary reads and Player Preview. |
| Reconnect-links job | Rewrites rendered HTML globally when target pages are created/moved/deleted and invalidates affected page hashes. | It cannot encode viewer-specific validity in canonical HTML. Move validity to the read projection or materialize per audience. |

Sources: [render job](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/jobs/render-page.js#L14-L85), [page cache](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/pages.js#L947-L1098), [search adapters](https://github.com/Jcraft153/KV-Wiki/tree/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search), [page lifecycle hooks](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/pages.js#L332-L459), [storage dispatch](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/storage.js#L180-L188), [disk storage sync](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/storage/disk/storage.js#L127-L145), [system page/history export](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/core/system.js#L214-L358), [link reconnection/invalidation](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/pages.js#L839-L914).

## Candidate seam placements

### Candidate A: deepen `WIKI.auth.checkAccess`

Change the boolean predicate to understand Party context, role, grants, and preview.

**Advantages**

- Smallest apparent source diff.
- Many existing callers already invoke it.

**Why it is insufficient**

- A boolean whole-page answer cannot return an audience-area projection.
- Callers would still load raw source/render before checking.
- Search totals/suggestions, tree ancestors, tags/facets, relationships, navigation, caches, and storage copies would remain unsafe unless each caller learned projection rules.
- Existing callers supply inconsistent page facts, especially tags.

This can remain a compatibility adapter for unchanged Wiki.js permissions, but it should not be the KV-Wiki read seam.

### Candidate B: put projection in `pages.getPage` / `getPageFromDb`

Make page model retrieval context-aware and return a safe page.

**Advantages**

- Covers the main controller, source routes, editor route, comments, and render job with relatively few edits.
- Keeps persistence knowledge near the model.

**Why it is insufficient**

- `pages.list`, tags, tree, links, navigation, history, exports, and search adapters use direct Objection/Knex queries.
- The same method is used by trusted mutation and background paths that require canonical source.
- Adding optional `user`/`party` parameters would create a dangerous implicit bypass when omitted and blur raw persistence with delivery policy.

The raw page model should become an internal adapter behind the preferred seam, not the seam itself.

### Candidate C: authorize/project in every controller and resolver

Add a request-context helper and update each delivery endpoint independently.

**Advantages**

- Straightforward incremental migration.
- Minimal restructuring of model code.

**Why it is insufficient**

- Repeats the current failure mode: callers omit facts and apply filters after limits/counts.
- Background materializers and third-party adapters remain outside request handlers.
- The interface callers must learn is nearly as complex as the implementation; it is a shallow module with poor locality.

Use controller/resolver changes only as thin adapters into the preferred deep module.

### Candidate D (recommended): a deep access-aware content read module

Introduce a module such as `WIKI.contentRead` under `server/core`, initialized with raw page/history/tree/link/navigation repositories, the host Party/access-ledger port, cache, and search adapters. Controllers, GraphQL resolvers, public metadata adapters, comment reads, and materialization jobs cross this seam. Direct raw-model reads remain allowed only inside mutation/authoring, migration, and explicit canonical-export code.

A deliberately small external interface could be:

```js
const context = await WIKI.contentRead.contextFor(req, { partyId, preview })
const page = await WIKI.contentRead.one(ref, context, purpose)
const result = await WIKI.contentRead.many(query, context, purpose)
```

The interface includes these invariants even if the JavaScript signature stays small:

- `contextFor` validates selected Party membership, role, grants/access-ledger version, anonymous status, and Player Preview; missing or failed context is fail-closed.
- `one` never returns canonical content by default. Its `purpose` is a closed enum such as reader page, source, history, navigation target, asset, or trusted authoring, not an arbitrary caller-controlled permission list.
- `many` applies visibility before pagination, counts, suggestions, facets, relationship aggregation, and folder pruning.
- Returned projections are immutable for the life of the request and carry a bounded `projectionKey`/access-version token for cache and invalidation.
- Canonical GM reads and exports require a separate explicit capability; Player Preview selects a reader projection without changing authority.
- Search and storage implementations sit behind internal seams. Production search adapters and in-memory/database test adapters make those seams real; adapter-specific credentials and query syntax do not leak into the external interface.

This module is deep because removing it would force Party validation, the visibility lattice, projection, safe derivation, cache keying, invalidation, error semantics, and adapter policy back into every caller.

## Least-divergence migration shape

1. Add request context resolution and the deep read module without changing the upstream page model schema yet. Make fail-closed errors and trusted-authoring purpose explicit.
2. Adapt the main page controller first, including metadata, TOC, injected code, comments, assets, and navigation. Keep the old whole-page predicate behind a temporary compatibility adapter.
3. Replace all `PageQuery` read resolvers and comment queries with `one`/`many`. Do not leave post-filtered limits, totals, suggestions, tags, or link graphs.
4. Put render, tree/link derivation, cache writes, and search indexing behind internal projection/materialization paths. Rebuild all derived artifacts from safe projections before enabling role-based reads.
5. Mark direct `models.pages`, `pageHistory`, `pageTree`, `pageLinks`, and search-adapter reads outside the module as forbidden by convention/lint/test, except an enumerated set of mutation, migration, and canonical-export callers.
6. Add verification at the module interface, then route-by-route contract tests proving identical results for anonymous, Player, GM, Admin, and Player Preview contexts across missing/selected/multiple Parties and grant/relock changes.

This shape concentrates the fork in a new core module plus thin caller adapters. It avoids deeply rewriting upstream Objection models while preventing raw model access from remaining the de facto reader interface.

## Risks and decisions the downstream specification must close

- Whether title, description, tags, relationships, and article existence are always public, independently classified, or inherited from the most-visible area.
- Whether render artifacts are stored per audience class, projected from a structured canonical render, or rendered on demand. Final-HTML redaction should be rejected as a security mechanism.
- The bounded dimensions of `projectionKey`: Party, role, grants/access-ledger version, preview target, locale, published revision, and possibly anonymous/public. Unbounded per-user caches have operational cost; under-keyed caches leak.
- Grant/relock invalidation when page content did not change, including HA propagation and third-party search deletion.
- History semantics when a revision's classification or the reader's grants changed after publication.
- Whether restricted assets and comments attach to an Entry, an Audience Area, or remain public-only.
- Whether third-party search/storage adapters are permitted to receive canonical GM content. If not, adapters must receive only safe documents and support deletion/rebuild on access changes.
- Uniform missing/forbidden behavior for direct path, page ID, search, link validity, tags, tree folders, and counts to prevent existence or cardinality side channels.
- Explicit operator-only bypass behavior for Admin, system export, migration, indexing repair, and storage backup. These must not be reachable by Player Preview.

## Conclusion

The current codebase has many checks but no access-aware read seam. `checkAccess` is useful as an upstream compatibility predicate, not as the KV-Wiki security module. The recommended candidate is a deep `contentRead` module that owns immutable Party access context, audience projection, collection filtering before aggregation, derived-data construction, cache identity/invalidation, and search/storage adapter policy. All reader-facing controllers and resolvers should become thin adapters to it; canonical persistence should remain directly accessible only to an explicit, audited set of authoring and operator paths.
