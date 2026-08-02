# Access-safe search and indexing for Party-scoped role visibility

Research for [KV-Wiki issue #13, “Choose an access-safe search and indexing architecture”](https://github.com/Jcraft153/KV-Wiki/issues/13).

Status: findings and recommendation only. This does not resolve the ticket or define production code.

Source baseline: `primus` at `4a84bad55fc78fbd5758db37db02036ddbf09c05`.

## Question

Which search/indexing architecture can guarantee that hits, metadata, snippets, suggestions, totals, facets, and public indexing expose only the content visible in the selected Party context, including after a grant is relocked, while preserving useful Wiki.js search adapters where possible?

## Executive finding

KV-Wiki should make an application-owned, PostgreSQL-backed **authorized search projection** the v1 authority for every Party-scoped or role-scoped query. It should index separately published Audience Areas, not whole rendered pages, and join those projections to the selected Party's current access snapshot **before** matching, ranking, limiting, counting, faceting, suggesting, or generating snippets.

Existing external adapters should initially be retained only as optional accelerators for the universally public projection. They must never receive gated, Secret, GM Only, or GM Notes content in v1. An adapter can graduate to authenticated search only after it implements a new access-aware contract and passes parity/leakage tests for every observable: not just returned hits.

This split avoids two unsafe extremes:

- post-filtering a mixed index, which already leaks counts and suggestions and distorts ranking and pagination; and
- copying every document for every Party/access combination, which creates index explosion and makes relock deletion difficult to prove.

## What the fork does today

### Authorization happens after the search engine has answered

The GraphQL resolver calls the globally selected engine with only ordinary query arguments, spreads its response, and filters only `results` through the page ACL. `suggestions` and `totalHits` remain untouched ([`server/graph/resolvers/page.js:52-64`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/resolvers/page.js#L52-L64)). The schema exposes no Party/access context and no snippets or facets ([`server/graph/schemas/page.graphql:29-33`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/schemas/page.graphql#L29-L33), [`server/graph/schemas/page.graphql:257-269`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/graph/schemas/page.graphql#L257-L269)).

That ordering is not a security boundary. Restricted documents can affect:

- exact hit counts;
- suggestions and autocomplete terms;
- ranking and the top-50/top-N cut;
- whether an authorized document is returned at all;
- future facet values and counts; and
- any snippet generated from the mixed document.

The client displays the raw total and suggestions ([`client/components/common/search-results.vue:17-47`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/client/components/common/search-results.vue#L17-L47)). Markdown link autocomplete also uses search with a `cache-first` policy ([`client/components/editor/editor-markdown.vue:613-633`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/client/components/editor/editor-markdown.vue#L613-L633)), so changing Party, role, grants, or preview state would also require an access-aware cache identity.

### The indexed unit is the whole rendered page

On create and update, the page model strips HTML from the complete render and sends it to the active engine as `safeContent` ([`server/models/pages.js:338-341`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/pages.js#L338-L341), [`server/models/pages.js:449-452`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/pages.js#L449-L452)). “Safe” here means cleaned HTML, not authorized content.

Incremental create/update calls are not guarded by publication/privacy state. A newly created private or unpublished page can be indexed, and unpublishing calls `updated` rather than `deleted`. Rebuilds behave differently: PostgreSQL and the external engines select only `isPublished: true, isPrivate: false` pages (for example, [`postgres/engine.js:158-176`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/postgres/engine.js#L158-L176) and [`elasticsearch/engine.js:388-393`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/elasticsearch/engine.js#L388-L393)). Incremental and rebuilt indexes can therefore disagree.

### Adapter behavior is observably inconsistent

Wiki.js loads exactly one adapter globally and falls back to Basic Database if activation fails ([`server/models/searchEngines.js:98-123`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/models/searchEngines.js#L98-L123)). The usable adapters are:

| Adapter | Current behavior | Consequence for role-safe search |
| --- | --- | --- |
| Basic Database | Queries published page title, description, and path, then caps the rows; it has no suggestions ([`db/engine.js:22-53`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/db/engine.js#L22-L53)). | It can be adapted to an authorized join, but it is a low-quality/low-scale fallback. Its `totalHits` is the capped row count, not a full total. |
| PostgreSQL FTS | Searches one global `pagesVector`; its global `pagesWords` table generates suggestions from indexed terms ([`postgres/engine.js:61-95`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/postgres/engine.js#L61-L95)). | Best base for an application-owned authorized engine, but both vector rows and suggestion vocabulary must be redesigned around visible projections. |
| Algolia | Sends full cleaned content, returns 50 hits and raw `nbHits`, and ignores locale/path options ([`algolia/engine.js:47-61`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/algolia/engine.js#L47-L61), [`algolia/engine.js:168-193`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/algolia/engine.js#L168-L193)). | Public projection only in v1. Algolia supports server-applied filters, but filterable attributes must be configured and compound filters have limits; provider support does not repair the current adapter. |
| AWS CloudSearch | Returns raw `hits.found` and uses a separate title suggester without an authorization filter ([`aws/engine.js:152-177`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/aws/engine.js#L152-L177)). | Public projection only. Search supports `fq`, but the Suggest API has no filter argument, so restricted suggestions cannot use the current suggester design. |
| Azure Search | Returns raw OData count and invokes autocomplete over a suggester sourced from title, description, and content ([`azure/engine.js:91-130`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/azure/engine.js#L91-L130), [`azure/engine.js:27-80`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/azure/engine.js#L27-L80)). | Public projection only in v1. Azure documents an ACL/security-filter pattern, and typeahead APIs accept filters, so authenticated support is technically plausible after a contract rewrite. |
| Elasticsearch | Searches content and tags, produces completion suggestions from page words, and returns a raw total ([`elasticsearch/engine.js:148-186`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/elasticsearch/engine.js#L148-L186), [`elasticsearch/engine.js:207-221`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/elasticsearch/engine.js#L207-L221)). | Public projection only in v1. Elastic's document-level security ignores suggesters and warns that aggregate information can still disclose restricted terms/counts; it is not a portable answer to this product contract. |
| Manticore, Solr, Sphinx | Their definitions mark them unavailable and their engines are empty stubs ([`manticore/engine.js`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/manticore/engine.js), [`solr/engine.js`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/solr/engine.js), [`sphinx/engine.js`](https://github.com/Jcraft153/KV-Wiki/blob/4a84bad55fc78fbd5758db37db02036ddbf09c05/server/modules/search/sphinx/engine.js)). | Do not list them as retained adapters until they implement and pass the new contract. |

Primary vendor references support the capability assessment:

- PostgreSQL applies row-security policy expressions before user query conditions, defaults to deny when RLS is enabled with no policy, and normally exempts table owners; a KV-Wiki deployment using RLS would need a non-owner application role or `FORCE ROW LEVEL SECURITY` ([PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)). PostgreSQL provides `tsvector`/`tsquery` matching and `ts_headline` for snippets ([text-search functions](https://www.postgresql.org/docs/current/functions-textsearch.html)).
- Algolia's `filters` operate on configured filterable attributes and support boolean expressions, but compound filtering is limited to 1,000 combined filters ([Algolia filters](https://www.algolia.com/doc/api-reference/api-parameters/filters), [limits and performance](https://www.algolia.com/doc/guides/managing-results/refine-results/filtering/in-depth/filters-and-facetfilters)). Secured API keys can bind server-generated filters, but the current adapter is server-side and applies none ([secured API keys](https://www.algolia.com/doc/guides/building-search-ui/going-further/api-keys-security/react)).
- AWS CloudSearch's search API supports `fq`, while its Suggest API accepts only query, suggester, size, and format ([CloudSearch Search API](https://docs.aws.amazon.com/cloudsearch/latest/developerguide/search-api.html)).
- Azure describes security trimming as an application-supplied identity filter, not authorization performed by the service; its suggestion/typeahead requests can use filters ([Azure security filters](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search), [Azure suggesters](https://learn.microsoft.com/en-us/azure/search/index-add-suggesters)).
- Elastic supports document-level role queries, but its own limitations state that suggesters are ignored under document-level security and aggregate information may still reveal terms/counts from inaccessible documents ([Elastic document-level security](https://www.elastic.co/guide/en/elasticsearch/reference/current/document-level-security.html)).

## Architecture options

| Option | Strengths | Failure modes / cost | Verdict |
| --- | --- | --- | --- |
| Mixed index, post-filter hits | Smallest code change; all current adapters remain selectable. | Leaks totals/suggestions/facets; top-N and pagination starve authorized results; snippets can contain restricted text; cannot prove relock; current design already demonstrates the defect. | Reject. |
| Mixed index with mandatory authorization filters pushed into every adapter | Preserves external relevance/scale and can make hits/counts/facets correct where the provider supports equivalent filters. | Every adapter needs identical boolean semantics for Party, role, grants, relock, preview, suggestions, and facets. Provider-specific limits and suggestion behavior break parity. A missed filter is a data breach. | Possible later, not a safe common v1 contract. |
| Separate index per Party/role/access cohort | Physical isolation simplifies each query and makes most providers usable. | Index count and document duplication grow with Parties and changing grants; multi-Party users require merging/deduplication; relock requires deleting copies; cohort combinations can approach powerset growth. | Reject as the default. A single public index remains useful. |
| Application-owned authorized projection in PostgreSQL, external adapters for public-only data | One place owns semantics; authorization precedes every observable; no per-Party content duplication; relock can revoke an entitlement immediately; external adapters remain useful for public scale/SEO. | PostgreSQL becomes required for full private search; implementation must build projection/outbox/epoch machinery; public and authenticated relevance may differ unless tested/tuned. | Recommend for v1. |

## Recommended v1 design

### 1. Index published Audience Areas, never aggregate rendered pages

Create an immutable `SearchProjection` for each published Audience Area revision. GM Notes are a separate projection type and can never be concatenated into a Player-visible record. A projection should carry:

- stable `projection_id`, `entry_id`, `area_id`, and `published_revision_id`;
- classification (`widely_known`, `gated`, `secret`, `gm_only`, `gm_notes`);
- locale and explicitly classified path/title/description/teaser metadata;
- searchable body derived only from that one published area;
- Party-independent content identity; and
- an indexing generation/version.

Party-specific grants belong in a separate `SearchEntitlement`/access-ledger projection keyed by Party and area, not by duplicating the body once per Party. One query joins visible entitlements to content projections. Widely Known rows can be recognized without a Party entitlement. GM/Admin visibility is still decided by the access module, not by treating a role name as a trustworthy client filter.

If metadata itself is sensitive, use an explicitly public/player-safe teaser or omit the record. The existence of a Secret or GM-only entry is not automatically visible merely because its body is hidden.

### 2. Put one deep interface in front of every search consumer

The search module should accept a server-resolved access context, not raw role/Party claims from GraphQL:

```text
search(query, accessContext, filters, page) -> {
  hits, snippets, suggestions, totalHits, facets, cursor,
  accessEpoch, indexGeneration
}
```

`accessContext` needs the authenticated principal, selected Party, role projection, Player Preview target, and an immutable access/grant epoch. The authorization module should convert it into the set or relation of visible projection IDs. Search then performs operations in this order:

1. select visible projections;
2. match the query and user filters;
3. rank and deduplicate by Entry according to specified mixed-area semantics;
4. compute totals and facets over that authorized set;
5. generate snippets only from the selected visible area text;
6. derive suggestions only from authorized title/tag/area vocabulary; and
7. limit/page the final authorized ordering.

This ordering also defines the verification oracle for every adapter. `totalHits` must have one documented meaning (recommended: distinct visible Entries after all filters), rather than sometimes meaning rows returned and sometimes provider matches.

### 3. Use PostgreSQL as the authenticated authority

Build the v1 Party-aware engine on a dedicated projection table with a weighted `tsvector`. Join the Party access relation before applying `@@`; compute `COUNT(DISTINCT entry_id)` and facets from the same authorized CTE; use `ts_headline` only on visible projection text. Suggestions should come from a vocabulary/materialized view whose source rows are filtered by the same access relation, or be limited to safe titles/tags rather than arbitrary body tokens.

RLS can be defense in depth, but it should not be the only contract: Wiki.js commonly connects as a powerful database role, and PostgreSQL table owners normally bypass RLS. Explicit access joins plus a least-privileged connection—and `FORCE ROW LEVEL SECURITY` if RLS is adopted—make the boundary auditable.

Basic Database can remain a development/emergency implementation if it queries the same projection/access relation. It may return no suggestions/facets and lower-quality ranking, but it may not relax visibility semantics.

### 4. Restrict external indexes to the public projection initially

For Algolia, AWS CloudSearch, Azure Search, and Elasticsearch, the publisher should export only projections visible to an anonymous reader with no Party context. This normally means Widely Known content and only metadata explicitly classified public. Gated teasers should be included only if a separate product decision says anonymous readers may discover them.

Public search totals, suggestions, snippets, facets, sitemap/SEO data, and crawler-facing pages must all come from the same anonymous projection. The external service never receives Secret, GM Only, GM Notes, or Party-gated body text, reducing both query-time and provider-side exposure.

Each external adapter should consume a `PublicSearchDocument`, not the Wiki.js page model. This removes `safeContent` as an accidental authorization contract.

### 5. Make publication and relock index transitions explicit

Use a transactional outbox from the published revision/access ledger. Every event is idempotent and identifies the prior and new projection generations. Required transitions include:

- draft -> published: upsert the new projection after the published revision commits;
- public -> restricted/unpublished/deleted: tombstone/delete the public document;
- restricted -> public: upsert only the approved public projection;
- grant -> relock: remove/invalidate the Party entitlement immediately; the body projection need not be duplicated or deleted;
- edited area: publish a new immutable projection, then retire the old generation.

Authenticated queries fail closed if the access epoch or required projection generation is unavailable. Relock takes effect at the entitlement query immediately, independent of background reindexing. For a public-to-restricted transition, the public endpoint must stop trusting the external generation until the delete/tombstone is acknowledged—temporarily fall back to the authoritative store or return unavailable rather than serve a stale public hit.

Periodically reconcile expected projection IDs/generations with each index. Rebuild must consume the same projection publisher as incremental updates so the two paths cannot produce different document sets.

### 6. Partition caches by authorization state

Search cache keys need at least Party ID, effective role/preview target, access epoch, public/private mode, locale/path/filter set, query, and index generation. On grant or relock, increment the Party access epoch. A response generated for GM, another Party, or an older access epoch must never be reusable for a Player. Apollo's current editor `cache-first` query should either include the context fingerprint in variables/cache identity or use an explicit invalidation/network policy.

## Adapter graduation criteria

An external adapter may later serve Party-scoped queries only if it proves all of the following with the same fixture matrix as PostgreSQL:

1. The server binds a non-removable authorization filter; clients cannot supply or weaken it.
2. The filter applies before ranking, limit, cursor generation, total count, facet calculation, highlighting/snippets, and every suggestion/autocomplete path.
3. The adapter indexes separate Audience Area projections and returns stable projection/revision IDs.
4. It can delete or make inaccessible a relocked projection within the stated revocation SLO, with a fail-closed stale-generation response.
5. It produces no restricted terms through logs, analytics payloads, errors, debug APIs, or provider dashboards beyond the agreed threat model.
6. It passes parity tests for anonymous, Player, GM, Admin, Player Preview, missing/invalid Party, multi-Party membership, newly granted, relocked, mixed-audience, and stale-cache cases.

Provider-specific outlook:

- **Azure Search** is the clearest later candidate because both document search and typeahead support filters.
- **Algolia** is plausible for modest principal/filter cardinality, preferably with server-bound secured keys or a server-only proxy, but filter-count/performance limits need measurement.
- **AWS CloudSearch** could filter hits/counts with `fq`, but restricted autocomplete needs a different design or must be disabled because its Suggest API cannot accept the same filter.
- **Elasticsearch** can use an application bool filter, but KV-Wiki should not treat commercial DLS as the portability seam; its DLS suggestion/aggregation limitations conflict with this contract.
- **Manticore, Solr, and Sphinx** have no implementation to graduate.

## Unresolved trade-offs for the decision ticket

1. Is PostgreSQL an acceptable hard requirement for authenticated Party-aware search, or must the Basic Database engine support every production database at lower scale?
2. Should `totalHits` count distinct Entries or matching visible Audience Areas when multiple areas of one Entry match?
3. Are Gated teaser titles/descriptions publicly discoverable, discoverable only to Party members, or hidden until granted?
4. Must snippets span multiple visible areas of one Entry, or should each hit expose only the highest-ranked visible area?
5. What is the public-to-restricted deletion SLO for external providers, and is temporary public-search unavailability preferable to serving from a local fallback?
6. Is third-party indexing of Party-visible but non-public content ever acceptable under the deployment/privacy threat model, even after adapter graduation?
7. Which facets are product requirements, and which facet values themselves require classification?
8. How should a multi-Party user search: exactly one selected Party (recommended), or an explicit union whose cache/context identity names every Party and epoch?

## Recommendation in one sentence

Adopt a PostgreSQL-backed, access-first Audience Area projection as the sole v1 authority for Party-aware search, expose only the anonymous public projection to existing external adapters, and make every adapter earn authenticated use through pre-authorization and full-observable leakage tests.

