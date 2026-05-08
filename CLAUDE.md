# CLAUDE.md

## Project Rules
- This is a fork of Wiki.js (AGPL-3.0) with Couchbase-specific extensions. Keep custom code isolated.
- Node ≥20 required. Pin exact versions — `save-exact = true` in `.npmrc`, no `^` prefixes.
- Use `yarn`, not `npm`. Lock file is `yarn.lock`.
- Never commit `config.yml` (sensitive). Only `config.sample.yml` is tracked.
- `NODE_OPTIONS=--openssl-legacy-provider` required for webpack commands (set via `cross-env` in scripts).

## Commands
- `yarn install` — install deps (runs `patch-package` postinstall automatically)
- `yarn dev` — start dev server with HMR (webpack dev middleware + Node server on port 3000)
- `yarn build` — production webpack build
- `yarn watch` — webpack watch mode (client only, no server restart)
- `yarn test` — ESLint + pug-lint + Jest (full suite)
- `node server` — start production server (requires built assets + `config.yml`)

## Workflow
- Client code lives in `client/` (Vue 2 + Vuetify 2 + Apollo). Server in `server/`.
- GraphQL API defined in `server/graph/schemas/` (SDL) and `server/graph/resolvers/`.
- New rendering modules go in `server/modules/rendering/` — see existing modules for pattern.
- New client components go in `client/components/` as `.vue` SFCs.
- After client changes: run `yarn build` or verify via `yarn dev` before marking done.
- Tests in `server/test/` — run `yarn test` before finishing any server-side change.

## Code Style
- ESLint config: `eslint-config-requarks` + `plugin:vue/strongly-recommended`. No overrides without reason.
- Pug templates: 2-space indent, single-quote attrs, `validateDivTags` enforced (see `pugLintConfig` in `package.json`).
- No TypeScript — plain JS (babel-eslint parser, ES2017+).
- Apollo GraphQL queries defined inline with `graphql-tag` babel plugin (tag: `gql`).

## Architecture Notes
- Vue 2 + Vuex + Vue Router + Apollo Client (not Vue 3). Do not introduce Vue 3 APIs.
- `@couchbaselabs/topology-ui` is a custom Couchbase package for topology diagram rendering.
- Server uses Objection.js (Knex-based ORM). DB migrations live in `server/db/migrations/`.
- Auth uses Passport.js with many strategies — new auth modules go in `server/modules/authentication/`.
- GraphQL subscriptions via `subscriptions-transport-ws` (not `graphql-ws`).
- Custom markdown renderers registered as modules in `server/modules/rendering/`.

## Safety / Stop Conditions
- Ask before touching `server/db/migrations/` — migrations are irreversible once run.
- Ask before modifying `server/graph/schemas/` in a breaking way — schema changes affect all clients.
- Do not modify `patches/` files without understanding the patched package's behavior.
- Ask before changing auth or permission middleware (`server/middlewares/`).
- `yarn.lock` changes from `yarn upgrade` need explicit user approval.

## Context Management
- Keep context lean: read only files relevant to the current feature area.
- Use skills for occasional workflows (PR creation, review, deployment).
- On compact: preserve modified file list, commands run, test output, and any migration state.
