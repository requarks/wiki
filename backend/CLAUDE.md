# `backend/`

Entry point is `backend/index.ts`, and it must be run **from the repo root** (`node backend`), not
from inside `backend/`. It boots in three phases: `preBoot()` (config → db → models → cache →
scheduler → event emitters), `initHTTPServer()` (Fastify plugins, auth, routes), `postBoot()`
(refresh locales/strategies/sites from disk & db, start scheduler).

Started with **`--no-experimental-webstorage`** — by the npm scripts and by the production image's
`CMD`, which is the only reason a bare `node backend` still opens with an experimental warning about
`localStorage`. Nothing here uses Web Storage; `lib0`, under yjs, probes for it as it loads the way a
library that runs in a browser too has to, and Node 26 answers that probe with a warning instead of a
value unless `--localstorage-file` is given. Off, the global is absent and the probe takes its node
path in silence.

- `api/` — REST route plugins, one file per resource (`sites.ts`, `users.ts`, `pages.ts`,
  `system.ts`, `locales.ts`, `authentication.ts`), registered by `api/index.ts` under the `/_api`
  prefix.
  - `api/schemas/` — shared JSON Schemas registered via `app.addSchema()` and referenced from route
    schemas as `{ $ref: 'Site#' }`. Register new shared schemas in `api/index.ts` *before* the routes.
- `controllers/` — non-API HTTP routes. `site.ts` serves per-site resources (logo, favicon, login
  background) under `/_site`; `icons.ts` serves icons under `/_icons`, implementing the part of the
  Iconify API protocol the frontend speaks (`/_icons/<prefix>.json?icons=a,b` and
  `/_icons/<prefix>/<name>.svg`). Public and cached hard — see [Icons](../.claude/rules/icons.md). `blocks.ts` serves
  compiled blocks under `/_blocks`, from the built tree or from an imported package depending on the
  block and the site — see [Distributing a block](../.claude/rules/distributing-blocks.md).
  `rootFiles.ts` is the exception that registers at the root rather than under a prefix: `robots.txt`
  and `sitemap.xml`, the two names in `RESERVED_ROOT_FILES` a crawler asks for by convention, both
  driven by the site's **General → SEO** settings. The sitemap lists what the GUESTS group may read
  and nothing else.
- `mcp/` — the Model Context Protocol server's protocol layer and tools, served by `controllers/mcp.ts`
  at `/_mcp`. See [MCP server](../.claude/rules/mcp.md).
- `core/` — long-lived singletons: `config.ts` (yml + db-backed settings), `db.ts` (pg pool, Drizzle
  instance, migrations, LISTEN/NOTIFY pubsub), `logger.ts`, `scheduler.ts` (poolifier thread pool +
  postgres-backed job queue), and `startupChecks.ts` — what `preBoot()` makes sure of right after the
  settings are loaded, on a fresh install and an upgraded one alike: idempotent, add-only, run in one
  transaction under an advisory lock so that the instances of an HA set booting together cannot each
  generate a different value.
- `db/` — `schema.ts` (all Drizzle table definitions), `relations.ts`, `migrations/` (generated).
- `models/` — data-access classes over Drizzle, aggregated by `models/index.ts` and exposed as
  `WIKI.models.*`. Business logic belongs here, not in route handlers. `types.ts` holds the shared
  `SystemIds` passed to each model's `init()` during first-run seeding.
- `modules/` — pluggable extensions, discovered from disk. Each module is a directory with a
  `definition.yml` (key, title, props/config schema) plus its implementation — e.g.
  `modules/authentication/local/`. `modules/storage/*` ships `db` and `disk` — see
  [Storage targets](../.claude/rules/storage.md). `modules/analytics/*` is the odd one out: a pair of YAML files
  and no implementation at all — see [Analytics](../.claude/rules/analytics.md).
- `notifications/` — the notification categories (`categories/*.ts`, registered in `index.ts`) and
  the worker-side halves of delivery: the fan-out and the mail drain. Not under `modules/`, which
  expects a `definition.yml` per directory. See [Notifications](../.claude/rules/notifications.md).
- `tasks/simple/` — jobs run in-process by the scheduler; each exports `task(payload, { signal })`.
  File name is kebab-case, the task key is its camelCase form. `scheduler.taskTimeout` applies here
  as it does to workers, but a promise cannot be killed: at the timeout `signal` is aborted, and a
  task that works in steps checks it between them and stops (`renderPages` hands the rest of its
  queue to a fresh job, so a long re-render runs in slices). One that has not settled a minute later
  is abandoned — failed, left running, and no second copy of that task starts on the instance until
  it ends (`executeInProcess` in `core/scheduler.ts`).
- `tasks/workers/` — CPU-bound jobs run in a worker thread via `worker.ts`, which boots a minimal
  `WIKI` global (config + logger + lazy `ensureDb()`) and dynamically imports the task. **A worker's
  database pool has ONE connection** (`core/db.ts`), so a transaction held open in a worker while
  anything else queries deadlocks the task against itself until the pool aborts it. And a worker reads
  the settings once, when its thread first opens the database, and never hears `reloadConfig` — a task
  that depends on settings an admin can change re-reads them per run (`refreshWorkerConfig`).
- `base.yml` — system defaults for every config key. Do not edit as a user-facing config; it defines
  the shape merged with `config.yml` and the db `settings` table.
- `helpers/` — small pure utilities (`common.ts`, `config.ts`), plus two that are not: `storageFiles.ts`,
  the file-tree half of the storage modules that address content by path (see
  [Storage targets](../.claude/rules/storage.md)), and `appShell.ts`, which describes a page in the HTML document
  served for it (see [The app shell and SEO](../.claude/rules/app-shell-seo.md)).
- `types/` — ambient declarations: `global.d.ts` (the `WIKI` global) and `fastify.d.ts` (session +
  route-permission augmentations).
- `locales/` — `en.json` source strings (CrowdIn-managed).

## TypeScript (backend)

The backend is entirely **TypeScript 7** (the native Go compiler — `tsc` is a platform binary, not a
JS bundle).

**There is no build step.** Node 26 runs `.ts` files directly by stripping types at load time, so
`node backend` and nodemon keep working unchanged as files are converted. `tsc` is used purely as a
type checker (`noEmit`) — never to produce output. Do not add a build/dist step.

Consequences of type stripping, all enforced by `backend/tsconfig.json`:

- **Relative imports must carry the real extension.** A `.ts` file importing a converted module writes
  `./core/config.ts`, not `./core/config.js` and not extensionless — Node resolves the literal path.
  This means converting a file requires updating the specifier in every file that imports it.
  (`allowImportingTsExtensions`)
- **Only erasable syntax is allowed** — no `enum`, no `namespace`, no constructor parameter
  properties, no `experimentalDecorators`. Use union types or `as const` objects instead of enums.
  (`erasableSyntaxOnly`)
- **Type-only imports must say `import type`**, otherwise the import survives erasure and Node tries
  to load a value that doesn't exist. (`verbatimModuleSyntax`)

`allowJs` is **off** — the backend is fully TypeScript, so a stray `.js` file would silently escape
type checking rather than be quietly tolerated.

`backend/types/global.d.ts` declares the ambient `WIKI` global as the `WikiGlobal` interface, wired
to the real module types (`WIKI.db` is the Drizzle instance, `WIKI.models` is `models/index.ts`, and
so on). Only `config` and `data` stay `any` — both are assembled at runtime from YAML plus a JSONB
settings table, so they have no static shape. `index.ts` and `worker.ts` build their own local `WIKI`
literal and assert it to `WikiGlobal`, since each populates the object progressively.

`backend/types/fastify.d.ts` augments Fastify: session fields (`authenticated`, `user`,
`permissions`) and the per-route `config.permissions` used by the `preParsing` permission hook.

**Four dynamic paths are extension-sensitive** and invisible to the type checker — they must be
updated by hand if the files they point at are ever renamed:

- `core/scheduler.ts` → `path.join(WIKI.SERVERPATH, 'worker.ts')` (the poolifier pool entry)
- `worker.ts` → `import('./tasks/workers/${kebabCase(job.task)}.ts')`
- `models/authentication.ts` → `import('../modules/authentication/${stg.module}/authentication.ts')`
- `models/storage.ts` → `import('../modules/storage/${key}/storage.ts')`, plus the `storage.ts`
  presence check in `hasImplementation()` that gates it

`scheduler.ts` reads `tasks/simple/` filenames with `/\.[jt]s$/`, so task files are extension-agnostic.

`worker.ts` builds its own minimal `WIKI` (config + logger + lazy `ensureDb()`), but the shared
declaration types it as the full object — so worker-only code can reference members that do not
actually exist in a worker thread. Be deliberate about what you touch there.

Conventions established during the conversion, worth following in new code:

- **`catch (err: any)`** at each site rather than globally disabling `useUnknownInCatchVariables`.
  Strict mode types a caught error as `unknown`, and this codebase reads `err.message` everywhere;
  annotating per-site keeps the looseness visible instead of hiding it in tsconfig.
- **Per-route Fastify generics** for request shapes: `app.get<{ Params: { siteId: string } }>(...)`.
  The JSON Schema stays as-is for validation and OpenAPI; the generic is what types `req.params`,
  `req.body` and `req.query`.

## Backend patterns

- **The `WIKI` global.** Set up in `index.ts`, typed in `types/global.d.ts`, available everywhere
  without importing:
  `WIKI.db` (Drizzle), `WIKI.models.*`, `WIKI.config`, `WIKI.logger`, `WIKI.cache`, `WIKI.scheduler`,
  `WIKI.events.{inbound,outbound}` (Emittery), `WIKI.sites` / `WIKI.sitesMappings` (cached site
  configs), `WIKI.ROOTPATH`, `WIKI.SERVERPATH`, `WIKI.INSTANCE_ID`.
- **Routes** are Fastify plugins: `async function routes(app) { ... }` with a default export.
- **Permissions** are declared per-route in `config.permissions`, and enforced by a single
  `preParsing` hook in `index.ts`. The array is OR-ed; a nested array is AND-ed
  (`permissions: ['read:sites', ['manage:users', 'manage:groups']]`). `manage:system` bypasses every
  check. `@fastify/swagger`'s `transform` folds these into the OpenAPI description automatically —
  so declaring them is also how they get documented. Only **global** permissions belong here; see
  [Permissions](../CLAUDE.md#permissions) for the other kind and how they are checked.
- **A route that takes an upload refuses before reading it.** Fastify buffers a body in full before
  `preValidation`, let alone the handler, so a check written in the handler lets anybody make the
  server hold `bodyLimit` bytes per request just to be told no. `config.permissions` is already
  checked in time. A route checking in its handler instead (a page rule, a profile setting) does the
  check in a route-level `preParsing` hook, as the asset upload and avatar routes do. That hook runs
  on the query string BEFORE schema validation, so it has to cope with a missing or malformed value
  rather than trust the schema.
- **A route a personal access token may call declares `config.scope`** — see
  [Personal access tokens](../.claude/rules/personal-access-tokens.md). Leave it off an admin route or a credential
  route, which is what keeps tokens out of them.
- **Every route needs a `schema`** with `summary`, `tags`, and response schemas. `hideUntagged` is on,
  so an untagged route is invisible in the API docs. Reuse `$ref` schemas from `api/schemas/`.
- **Errors** via `@fastify/sensible` helpers (`reply.notFound()`, `reply.badRequest()`,
  `reply.unauthorized()`, `reply.forbidden()`). The `setErrorHandler` in `index.ts` shapes `/_api/`
  failures into `{ ok, error, statusCode, message }` JSON.
- **Schema changes**: edit `db/schema.ts`, then `npm run db-generate` and commit the generated
  migration. Never hand-edit an existing migration. **Always pass a name that says what the migration
  does** — `npm run db-generate -- --name=comment-handles`, kebab-case, one or two terms. The script
  carries `--name=scarlett` (the branch name) as its default and a later `--name` on the command line
  overrides it, so leaving it off files the change as another `…_scarlett` directory that says nothing
  about it.
- **A module prop marked `sensitive` is write-only.** A route answering with a module's stored config
  runs it through `maskSensitiveProps` (`helpers/common.ts`) first, which replaces every non-empty
  sensitive value with `SENSITIVE_MASK`; the client posts the whole configuration back, and
  `isSensitiveMask` is what makes the mask mean "unchanged" rather than a new value. Masking belongs
  at the API boundary and nowhere earlier — the config the models hand out is what the modules read
  their credentials from. An empty value is never masked, so dots always mean something is stored,
  and clearing the field is how a stored secret is removed — except on a create, where there is
  nothing to keep and the mask leaves the prop unset. `manage:system` on the route is not a reason to
  skip this: the secret still ends up in a browser, a cache and a screen share. Both module-prop
  surfaces do it — storage targets (`api/storage.ts`) and authentication strategies
  (`withoutSecrets` in `api/authentication.ts`) — so a new one is expected to as well.
- **Dates use the native `Temporal` API**, not luxon (no longer a backend dependency). `Temporal` is a
  global in Node 26 and is typed by the TS 7 lib, so it needs no import. Four things to know:
  - `Temporal.Instant` accepts **exact time units only** — `add({ days: 1 })` throws. Since these are
    all UTC instants, use `{ hours: 24 }`.
  - Temporal types have no `valueOf`, so `a < b` **throws**. Compare with
    `Temporal.Instant.compare(a, b)`.
  - `Instant.toString()` defaults to nanosecond precision; pass
    `{ smallestUnit: 'millisecond' }` for values written to postgres or compared as strings, which is
    what the rest of the codebase emits.
  - Converting: `date.toTemporalInstant()` from a `Date` (what drizzle returns for `timestamp`
    columns), `Temporal.Instant.from(str)` for postgres-format strings (what raw `db.execute()`
    returns), and `new Date(instant.epochMilliseconds)` going back the other way.
