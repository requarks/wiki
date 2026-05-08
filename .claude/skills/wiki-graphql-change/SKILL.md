---
name: wiki-graphql-change
description: Use when making changes that touch GraphQL schema, resolvers, or client queries together — any cross-layer GraphQL modification
---

# GraphQL Cross-Layer Changes

Wiki.js uses Apollo (server: `apollo-server-express`, client: `apollo-client` 2.x). Changes typically span 3 layers.

## Layers

| Layer | Location | What to change |
|-------|----------|----------------|
| Schema (SDL) | `server/graph/schemas/*.graphql` | Type definitions, queries, mutations |
| Resolvers | `server/graph/resolvers/*.js` | Business logic, DB calls via Objection |
| Client queries | `client/graph/*.gql` or inline `gql` tags in `.vue` files | Apollo operations |

## Workflow

### 1. Schema first
Edit `.graphql` SDL file. Add field/type/query/mutation.

### 2. Resolver
Add corresponding resolver in matching `server/graph/resolvers/<domain>.js`. Resolvers export object matching schema structure.

### 3. Client query/mutation
Add or update `.gql` file (or inline `gql` tag). Import via babel `graphql-tag` plugin — no manual parse needed.

### 4. Apollo cache (if needed)
If mutation changes cached data, update `update` callback in `this.$apollo.mutate(...)` or add `refetchQueries`. Stale cache causes silent UI bugs.

### 5. Verify
```bash
yarn dev   # server logs schema errors on startup
```
Check browser Apollo devtools for query shape. Run `yarn test` for ESLint pass.

## Conventions

- Resolver files mirror schema files 1:1 by domain (e.g. `pages.graphql` ↔ `pages.js`)
- Mutations return typed responses — add `ResponseStatus` fields when following existing pattern
- `graphql-rate-limit-directive` used on some resolvers — add `@rateLimit` if mutation is user-facing
- Subscriptions use `graphql-subscriptions` PubSub — not WebSocket transport directly

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Schema added, resolver missing | Server throws on first call — check resolver export shape |
| Client query shape mismatch | Apollo logs warning; check field names match SDL exactly |
| Cache not updated after mutation | Add `refetchQueries` or manual `cache.writeQuery` |
| Breaking schema change | Existing clients 404 or error — coordinate with any deployed instances |
