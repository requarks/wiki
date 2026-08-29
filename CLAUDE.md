# Wiki.js 3.x

Next-generation open source wiki. This is the **3.x development branch** — incomplete, unstable, and
with no upgrade path from 2.x. AGPL-3.0.

**Nothing here has to stay compatible with an existing installation.** Nobody is expected to be
running an earlier state of this branch, so do not write migration shims, legacy-value fallbacks,
deprecated aliases or "old data may still contain X" handling. Change the shape, change the callers,
and delete the old path — a fallback for a case that cannot occur is dead code that still has to be
read, tested and reasoned about. This applies to db columns, API payloads, stored settings and
config keys alike; only real migrations under `backend/db/migrations/` are exempt, because Drizzle
needs the history to get a live dev database to the current schema.

Three independently-installed workspaces (each has its own `package.json` / `node_modules`, there is
no root package or monorepo tooling):

| Path        | What it is                                                    |
| ----------- | ------------------------------------------------------------- |
| `backend/`  | Fastify REST API server + job scheduler, Drizzle on PostgreSQL |
| `frontend/` | Vue 3 / Vite SPA, Tailwind CSS + an in-repo component library  |
| `blocks/`   | Lit web components users embed into wiki pages                 |

Requires Node.js **26+** and PostgreSQL **16+**. All three workspaces are ESM (`"type": "module"`).

The backend is **TypeScript 7**; `frontend/` and `blocks/` are JavaScript. See
[TypeScript (backend)](#typescript-backend).

## Layout

### Root

- `config.yml` — instance config (copy of `config.sample.yml`). Read by the backend at boot *and* by
  `frontend/vite.config.js` in dev mode to learn the proxy target port.
- `assets/` — **build output** of the frontend (`vite build` writes here), plus static assets under
  `assets/_assets/`. Served by the backend. Don't hand-edit.
- `dev/` — deployment/packaging artifacts: `dev/build/Dockerfile` (production image), `dev/helm/`,
  `dev/packer/`, `dev/noto-emoji-build/`.
- `.devcontainer/` — VS Code dev container (app + postgres + pgAdmin + mailpit via docker-compose).
  Mailpit is the mail server for development: it accepts everything and delivers nothing, so a
  confirmation link or a password reset lands in a web inbox at `http://localhost:8025` rather than a
  real mailbox. Point the wiki at it under **Admin → Mail** — host `localhost`, port 1025, TLS off,
  no credentials.
- `localazy.json` — translation sync config; locale strings live in `backend/locales/`.

### `backend/`

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
  `/_icons/<prefix>/<name>.svg`). Public and cached hard — see [Icons](#icons).
- `core/` — long-lived singletons: `config.ts` (yml + db-backed settings), `db.ts` (pg pool, Drizzle
  instance, migrations, LISTEN/NOTIFY pubsub), `logger.ts`, `scheduler.ts` (poolifier thread pool +
  postgres-backed job queue).
- `db/` — `schema.ts` (all Drizzle table definitions), `relations.ts`, `migrations/` (generated).
- `models/` — data-access classes over Drizzle, aggregated by `models/index.ts` and exposed as
  `WIKI.models.*`. Business logic belongs here, not in route handlers. `types.ts` holds the shared
  `SystemIds` passed to each model's `init()` during first-run seeding.
- `modules/` — pluggable extensions, discovered from disk. Each module is a directory with a
  `definition.yml` (key, title, props/config schema) plus its implementation — e.g.
  `modules/authentication/local/`. `modules/storage/*` ships `db` and `disk` — see
  [Storage targets](#storage-targets).
- `tasks/simple/` — jobs run in-process by the scheduler; each exports `task()`. File name is
  kebab-case, the task key is its camelCase form.
- `tasks/workers/` — CPU-bound jobs run in a worker thread via `worker.ts`, which boots a minimal
  `WIKI` global (config + logger + lazy `ensureDb()`) and dynamically imports the task.
- `base.yml` — system defaults for every config key. Do not edit as a user-facing config; it defines
  the shape merged with `config.yml` and the db `settings` table.
- `helpers/` — small pure utilities (`common.ts`, `config.ts`), plus `storageFiles.ts`, which is the
  file-tree half of the storage modules that address content by path (see [Storage targets](#storage-targets)).
- `types/` — ambient declarations: `global.d.ts` (the `WIKI` global) and `fastify.d.ts` (session +
  route-permission augmentations).
- `locales/` — `en.json` source strings (Localazy-managed) + `metadata.js` language table (the one
  remaining JavaScript file; typed by its sibling `metadata.d.ts`).

### `frontend/`

Vue 3 on plain Vite. `src/main.js` wires it up manually: router → pinia store → `boot/*`
initializers → mount. There is no UI framework: `src/components/shared/` is the component library
(every component is `W*`, used in templates as `<w-btn>`, `<w-input>`, …), registered globally by
`boot/components.js` and styled with Tailwind.

- `src/boot/` — one-time app initializers: `api.js` (creates the `ky` client, exposed
  as the `API_CLIENT` global), `components.js` (global components), `eventbus.js` (`EVENT_BUS` global,
  mitt), `externals.js`, `i18n.js`, `iconify.js` (points Iconify at this instance's `/_icons`),
  `monaco.js`, `temporal.js` (conditionally polyfills `Temporal`, awaited before anything else in
  `main.js`).
- `src/router/` — `index.js` (router factory) and `routes.js` (the full route table; page components
  are lazily imported).
- `src/layouts/` — `MainLayout`, `AdminLayout`, `AuthLayout`, `ProfileLayout`.
- `src/pages/` — route-level views. `Admin*.vue` are the admin area, `Profile*.vue` the user profile.
- `src/components/` — everything else: dialogs (`*Dialog.vue`), full-screen overlays
  (`*Overlay.vue`), editors (`Editor*.vue`), nav/tree components.
- `src/stores/` — Pinia stores (`site`, `user`, `page`, `editor`, `admin`, `common`, `flags`).
  `stores/index.js` creates the pinia instance and injects `router` into every store.
- `src/renderers/` — page content rendering pipeline: `markdown.js` plus `modules/` (katex, kroki,
  plantuml, markdown-it plugins).
- `src/css/` — `tailwind.css` (theme tokens, utilities and the shared component classes) plus SCSS:
  `_theme.scss` (brand colours) and `_palette.scss` (the Material ramp the older stylesheets use).
  Both are injected into every SFC by `css.preprocessorOptions.scss.additionalData` in
  `vite.config.js`, which is why templates can write bare `$primary` / `$grey-4`.
- `src/helpers/`, `src/assets/`, `public/`, `index.html`.

Path alias `@` → `frontend/src` (defined in `vite.config.js`; `jsconfig.json` mirrors it for the IDE).

Dev server runs on **3001** and proxies `/_api`, `/_blocks`, `/_icons`, `/_site`, `/_thumb`, `/_user`
to the backend on **3000**, so the backend must be running too.

### `blocks/`

Self-contained Lit components. Each lives in `blocks/block-<name>/component.js` — the glob in
`rollup.config.mjs` picks up any directory matching `block-*` automatically, so a new block needs no
config change. Output goes to `blocks/compiled/`, which the backend serves statically under
`/_blocks/`. Blocks are loaded dynamically at runtime, which is why `_blocks/**` is excluded from
Vite's `dynamicImportVarsOptions`. A block pulling in a heavy library is fine — nothing is fetched
until its tag turns up in a page — and a library that still ships CommonJS works too, since the
rollup config runs `@rollup/plugin-commonjs` after `resolve()`.

Blocks style themselves off `:host` and read the theme colors via CSS custom properties
(`var(--q-primary)` — the `--q-` prefix is historical; the properties are declared in
`css/tailwind.css` and rewritten at runtime for per-site theming).

**Dark mode goes through `blocks/shared/theme.js`, never `:host-context()`.** The app's source of
truth is the `body--dark` class on `<body>`, which CSS in a shadow root cannot see; `:host-context()`
is the selector for exactly that and is what every block used to use, but only Chromium ever shipped
it — MDN has it deprecated, Firefox and Safari never implemented it, and there it silently never
matches, so the block stayed light on a dark page. Instead construct a `DarkMode` controller
(`this._darkMode = new DarkMode(this)`) in the block's constructor and write `:host([dark])`; the
controller keeps that attribute in step, sharing one MutationObserver across every block on the page.
A block that must *act* on the change rather than restyle for it passes `onChange`, or reads
`.isDark` — `block-diagram` redraws mermaid in its own dark theme, `block-map` resolves a per-block
`theme` prop that can pin a map light on a dark page.

## Commands

Run backend commands from `backend/`, frontend from `frontend/`, blocks from `blocks/`.

```sh
# backend
npm run dev              # nodemon, restarts on any backend file change
npm run start            # plain node
npm run typecheck        # tsc — type check only, never emits
npm run typecheck:watch
npm run db-generate      # drizzle-kit generate — after editing db/schema.ts
npm run db-up            # drizzle-kit up

# frontend
npm run dev            # vite dev server on :3001 (needs backend running on :3000)
npm run build          # builds into ../assets — required before the backend can serve the UI

# blocks
npm run build          # rollup → blocks/compiled/
```

`npx ncu -i` (`npm run ncu`) for interactive dependency updates.

The API is browsable via Swagger UI at `http://localhost:3000/_api` in a running instance. Default
admin login is `admin@example.com` / `12345678`.

### How far to go verifying a change

Match the check to the size of the change. `npm run build`, `npx oxlint` and `npm run typecheck` are
seconds each and are the right check for nearly everything.

**Do not stand up a throwaway instance and drive a headless browser to look at a small change.** That
means booting a backend against a scratch database, seeding it, and screenshotting through
`/usr/bin/chromium` — a good ten minutes of setup that a moved border, a colour, a spacing tweak or a
renamed label does not earn. Read the rule you wrote, trust the build, and say what you changed.

It is worth the setup for a **new** piece of UI whose markup has to meet a stylesheet written
elsewhere, where being wrong means shipping something visibly broken — a component reusing existing
content classes is the case that has actually gone wrong. Also for a flow with real state to exercise
(a login, an upload, a save), where a screenshot answers a question reading cannot.

See the `wikijs-isolated-test-instance` memory for how to boot one when it IS warranted.

## TypeScript (backend)

The backend is entirely **TypeScript 7** (the native Go compiler — `tsc` is a platform binary, not a
JS bundle). The only remaining `.js` is `locales/metadata.js`, which is Localazy-generated output and
is typed by a sibling `locales/metadata.d.ts`.

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
type checking rather than be quietly tolerated. `locales/metadata.js` is the sole exception and is
resolved through its sibling `metadata.d.ts`.

`backend/types/global.d.ts` declares the ambient `WIKI` global as the `WikiGlobal` interface, wired
to the real module types (`WIKI.db` is the Drizzle instance, `WIKI.models` is `models/index.ts`, and
so on). Only `config` and `data` stay `any` — both are assembled at runtime from YAML plus a JSONB
settings table, so they have no static shape. `index.ts` and `worker.ts` build their own local `WIKI`
literal and assert it to `WikiGlobal`, since each populates the object progressively.

`backend/types/fastify.d.ts` augments Fastify: session fields (`authenticated`, `user`,
`permissions`) and the per-route `config.permissions` used by the `preHandler` permission hook.

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
- **Pre-existing bugs are preserved, not fixed.** Where the type checker exposed already-broken code,
  it was left behaving identically behind a narrow cast plus a `FIXME:` comment explaining the real
  fix. A migration should not silently change runtime behavior. Search `FIXME:` under `backend/` for
  the list — they are genuine open bugs, not type-checker noise.

## Conventions

### Style, linting, formatting

**oxlint** for linting, **oxfmt** for formatting — not ESLint or Prettier (ESLint is explicitly
disabled in `.vscode/settings.json`). Both are devDependencies of `backend/` and `frontend/`.

```sh
npx oxlint            # from backend/ or frontend/ — uses that dir's .oxlintrc.json
npx oxfmt <paths>     # config is the repo-root .oxfmtrc.json
```

Format settings (root `.oxfmtrc.json`): no semicolons, single quotes, no trailing commas,
`bracketSameLine`, LF, final newline. 2-space indent, per `.editorconfig`.

Otherwise follow **standard JS** rules. Note that much of `frontend/` predates oxfmt and still uses
the standard-style space before parens (`function initializeRouter ()`); new and touched code should
be oxfmt-formatted, but don't reformat untouched files as drive-by changes.

Each workspace has its own `.oxlintrc.json` — the backend declares the `WIKI` global and node env;
the frontend adds the `vue` plugin and the `API_CLIENT` / `EVENT_BUS` / `Temporal` globals. Only the
`correctness` category is an error.

Both tools handle `.ts` with no extra configuration, and the backend's oxlint config already enables
the `typescript` plugin. oxlint does not type-check — run `npm run typecheck` for that.

**Never put two statements in a Vue template attribute.** `@click="doOne(); doTwo()"` builds today
and is a build error the moment the file is formatted, because `semi: false` and Vue disagree about
the same character. Vue's `transformOn` decides whether an inline handler is a statement block or an
expression from `exp.content.includes(';')` — with the semicolon it emits `$event => { … }`,
without it `$event => ( … )`. oxfmt breaks the handler across lines and drops the semicolon, so Vue
parenthesises two statements and the template fails to compile (`Error parsing JavaScript
expression: Unexpected token`). Write a named handler instead — `@click="closeAndRefresh"` — as
`EditorMarkdown.vue` and `PageRelationDialog.vue` do.

Neither side of that is worth reconfiguring, so don't try: the `includes(';')` check has no compiler
option behind it, and the parse error is raised by the built-in `transformExpression`, which
`baseCompile` runs *before* any `nodeTransforms` you could add — and Volar runs the same compiler,
so a build-time workaround would still leave the editor showing errors. On the formatter side,
`embeddedLanguageFormatting: "off"` does leave attribute expressions alone but also stops formatting
every `<script>` and `<style>` block in every SFC. This is not an oxfmt quirk either: Prettier with
`--no-semi` produces identical output. For a one-off where the inline form genuinely reads better,
`<!-- prettier-ignore -->` on the preceding line works (oxfmt honors Prettier's marker; there is no
`oxfmt-ignore`).

### Utilities and dates

These apply to **every workspace**, `frontend/` included — not just the backend.

- **Use `es-toolkit`, not `lodash-es`.** Installed in both `backend/` and `frontend/`.
- **Use the native `Temporal` API, not luxon.** See [Backend patterns](#backend-patterns) for the
  Temporal gotchas worth knowing; they apply on the frontend too.
- **luxon and lodash-es are being removed entirely.** The migration is gradual: when you touch a file
  that imports either one, convert that file's usages as part of the same change — but don't sweep
  through untouched files as a drive-by. Once the last usage is gone, both dependencies get dropped.
- Prefer real es-toolkit subpath exports (`es-toolkit/object`, `es-toolkit/array`,
  `es-toolkit/predicate`) over `es-toolkit/compat`. Two lodash helpers are compat-only and have direct
  equivalents: `defaultsDeep(source, defaults)` → `toMerged(defaults, source)` (note the argument
  order flips) and `toSafeInteger(x)` → `Number.parseInt(x, 10)`.
- On the frontend `Temporal` is a global, declared in `.oxlintrc.json`. `src/boot/temporal.js`
  dynamically imports `temporal-polyfill` for browsers without native support (Safari, as of
  mid-2026) and is awaited first in `main.js`. The polyfill is a lazy chunk (~21 kB gzipped) that
  browsers with native `Temporal` never download.

### Permissions

There are **two kinds of permission**, granted separately and checked in different places. Which
kind a name belongs to decides how it may be enforced, so it is the first thing to establish about
any permission you touch.

**Global permissions** are held site-wide, bound to no path: `access:admin`, `manage:users`,
`manage:groups`, `manage:navigation`, `manage:theme`, `manage:sites`, `manage:system`. That list is
the whole of it — the one offered by the group editor (`GroupEditOverlay.vue`). They live on a
group's `permissions` column, are flattened onto `req.session.permissions` at login
(`models/users.ts` → `updateSession`), and are what the per-route `config.permissions` hook
checks. `manage:system` bypasses every check everywhere.

**Page rule permissions** are bound to paths, and to locales and sites: `read:pages`, `write:pages`,
`review:pages`, `manage:pages`, `delete:pages`, `write:styles`, `write:scripts`, `read:source`,
`read:history`, `read:assets`, `write:assets`, `manage:assets`, `read:comments`, `write:comments`,
`manage:comments` (`PAGE_PERMISSIONS` in `api/pages.ts`). A group grants them through **rules**:
each rule names some of them (`roles`) plus how it addresses pages (`match` + `path`, or tags) and
what it does with them (`mode`: ALLOW / DENY / FORCEALLOW). Nothing is granted by default, and when
several rules match, the most specific one wins — `helpers/pageRules.ts` documents the ordering.
Ask `WIKI.models.groups.checkAccess(actor, permission, page)`, or `mayOnPage(req, permission, page)`
in `api/pages.ts`.

Consequences worth knowing:

- **A page permission cannot be enforced by `config.permissions`.** That hook reads the group-wide
  list only, so `permissions: ['write:pages']` refuses everybody. A route that turns on a page
  permission declares no route permission and checks in the handler instead — say so with a
  `No route-level permissions:` comment, as `api/pages.ts`, `api/assets.ts` and `api/blocks.ts` do.
- **The two names are not interchangeable.** `manage:pages` does not imply `write:pages`: a rule
  grants the exact strings in its `roles`.
- **On the frontend**, `userStore.permissions` is the global list (from `users/whoami`) and
  `userStore.pagePermissions` is what the session holds AT THE CURRENT PATH (from
  `pages/userPermissions`, refreshed per route in `App.vue`). `userStore.can()` ORs the two and
  treats `manage:system` as a wildcard, so it answers "may do this somewhere". Gate a control over
  the page in front of the reader on `pagePermissions` — that is what the endpoint behind the
  button will check.
- **An anonymous request is the guests group**, not an absence of groups: that is how a wiki opens
  reading, and suggesting edits, to the public. Deny guests explicitly where an account is genuinely
  required (`reviewerFor` in `api/approvals.ts` is the worked example).
- **Never invent a permission name.** Both lists above are closed; `can('browse:fileman')` and
  friends matched nothing and silently hid the controls they guarded.

### Backend patterns

- **The `WIKI` global.** Set up in `index.ts`, typed in `types/global.d.ts`, available everywhere
  without importing:
  `WIKI.db` (Drizzle), `WIKI.models.*`, `WIKI.config`, `WIKI.logger`, `WIKI.cache`, `WIKI.scheduler`,
  `WIKI.events.{inbound,outbound}` (Emittery), `WIKI.sites` / `WIKI.sitesMappings` (cached site
  configs), `WIKI.ROOTPATH`, `WIKI.SERVERPATH`, `WIKI.INSTANCE_ID`.
- **Routes** are Fastify plugins: `async function routes(app) { ... }` with a default export.
- **Permissions** are declared per-route in `config.permissions`, and enforced by a single
  `preHandler` hook in `index.ts`. The array is OR-ed; a nested array is AND-ed
  (`permissions: ['read:sites', ['manage:users', 'manage:groups']]`). `manage:system` bypasses every
  check. `@fastify/swagger`'s `transform` folds these into the OpenAPI description automatically —
  so declaring them is also how they get documented. Only **global** permissions belong here; see
  [Permissions](#permissions) for the other kind and how they are checked.
- **Every route needs a `schema`** with `summary`, `tags`, and response schemas. `hideUntagged` is on,
  so an untagged route is invisible in the API docs. Reuse `$ref` schemas from `api/schemas/`.
- **Errors** via `@fastify/sensible` helpers (`reply.notFound()`, `reply.badRequest()`,
  `reply.unauthorized()`, `reply.forbidden()`). The `setErrorHandler` in `index.ts` shapes `/_api/`
  failures into `{ ok, error, statusCode, message }` JSON.
- **Schema changes**: edit `db/schema.ts`, then `npm run db-generate` and commit the generated
  migration. Never hand-edit an existing migration.
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

### Frontend patterns

- **Templates are plain HTML.** A handful of pre-3.x leftovers are still `<template lang="pug">` —
  check the file you're editing rather than assuming.
- **UI components come from `components/shared/`**, registered globally, so `<w-btn>` / `<w-input>` /
  `<w-icon>` need no import. Each one is scoped to how this app actually uses it rather than to the
  full API of the framework component it replaced; the header comment in each file says where they
  differ. Add a prop there rather than reaching around it.
- HTTP calls go through the `ky` client, reachable as the `API_CLIENT` global (declared in the oxlint
  config, so no import needed) — e.g. `await API_CLIENT.get('sites').json()`. It handles the `/_api`
  prefix; authentication is the session cookie, sent with every request.
- Cross-component messaging uses the `EVENT_BUS` global (mitt).
- State lives in Pinia option stores. For utilities and dates use `es-toolkit` and `Temporal` — see
  [Utilities and dates](#utilities-and-dates); the `lodash-es` and `luxon` still present in older
  files are on their way out.

### Storage targets

A storage target is one module from `modules/storage/<key>/` configured for one site. Six ship, each
with a real `storage.ts`:

| Key | What it is |
| --- | ---------- |
| `db` | Enabled on every site and impossible to turn off — bytes in the asset's own row |
| `disk` | The wiki's tree as files at `<root>/<locale>/<folders…>/<file>` |
| `git` | That same tree in a repository, committed per change and synced with a remote |
| `s3` | Amazon S3 **and anything speaking its API** — R2, Spaces, B2, Wasabi, MinIO |
| `azure` | Azure Blob Storage |
| `gcs` | Google Cloud Storage |
| `sftp` | That tree again, on a remote host over SSH — a copy, never a delivery source |

A new module is a directory with a `definition.yml` and a `storage.ts` exporting the `StorageModule`
contract, and `hasImplementation` gates both dispatch and the admin area's action buttons on the
latter existing.

**`disk`, `git` and `sftp` are the same tree in three places**, and share `helpers/storageFiles.ts`
for all of it: the layout, the front matter, what makes a file a page, and `importTree`'s adoption
walk. `sftp` hands `importTree` its own `readFile` — the only thing that differs about a tree on
another machine — and uses `path.posix` throughout, since a wiki on Windows still talks to sshd in
slashes. Its connection is cached per target and serialized, because a single `ssh2-sftp-client` does
not support concurrent operations, and dropped on a connection-shaped failure so the next operation
reconnects. Unlike 2.x's SFTP module it reads as well as writes, so a site can serve from it and
import a tree that was put there from outside.

**The three object stores are one file of client calls each.** `put`, `get`, `remove` and `copy` — the
`ObjectStoreClient` in `helpers/storageObjects.ts` — and `objectStorageModule` builds the whole
`StorageModule` from them. An object key *is* a path, the same one `disk` would write, so a bucket and
a folder hold a site's content laid out identically and `pathPrefixFor` decides the shape of both.
Each of the three also takes a **`pathPrefix`**, which is the segments that key starts with — empty by
default, so the tree sits at the root of the bucket, and set when the bucket has to be shared with
something else, since an object store has no folders to keep two tenants apart. It is per target,
unlike everything `pathPrefixFor` answers, for the same reason the bucket name is: *which* store the
tree goes in and *how* the tree is laid out are different questions. It is normalized rather than
validated — surrounding and doubled slashes go, and so do `.` and `..` segments, which name a literal
object in a bucket rather than a relative path. A custom `baseUrl` still stands in for the bucket and
not for the prefix, because the key is signed prefix and all. Object stores have no rename, so
`moveObject` copies and then deletes, in that order, and never deletes on a copy that failed. Credentials are optional on all three: left empty, each SDK falls back
to the machine's own identity (an IAM role, a managed identity, a workload identity), which is how a
deployment keeps a long-lived secret out of the database. Only `exportAll` is offered — there is no
`importAll`, because nothing but the wiki writes into these buckets, which is exactly what makes git
different.

**Nothing else may live under `modules/storage/`.** `refreshFromDisk` reads every directory there and
expects a `definition.yml` in it; one without takes *every* storage module down with it, since the
read is wrapped in a single try/catch that empties `definitions`. This is why the tree logic shared by
`disk` and `git` — the front matter, the file name a page is filed under, what makes a file a page
rather than an attachment, and the walk an import does — sits in `helpers/storageFiles.ts` instead.

**Content is written to every target that claims it, and read from one.** Those are two separate
questions with two separate answers, and conflating them is the way to get this wrong:

- **Written** — a target's `contentTypes.activeTypes` says what is stored there, and a site may store
  the same kind in several places at once. An upload goes to *all* of them; the admin area's
  **Targets** tab is where that is set, per target.
- **Read** — `assetDelivery.servedTypes` names the content types a reader's request is answered from
  that target, at most one target per type across the site. The **Content Delivery** tab sets it, and
  a target may only be nominated for a type it also stores (`validateTarget` refuses the pair). Pages
  are never nominated: a page is read from its own row, always.

  **Direct access.** An object store can answer instead of being read through: `assetDelivery.mode`
  is `streaming` (the default — bytes through the wiki) or `direct`, where both serving routes
  (`controllers/files.ts` and the asset content API) answer **302 to a signed URL** and the bytes
  never touch the server. `storage.directAccessUrlFor` is the whole decision and both routes call it.
  Three things it insists on: the target must be the *nominated* source for that content type
  (`deliveryTargetsFor`'s head standing in as the database is not a nomination), the module must
  implement `presignAsset`, and the link's lifetime is capped at 7 days because no provider signs for
  longer. The redirect is cached for **half** the link's life, so a cached redirect can never outlive
  the URL in it.

  **A signed link carries none of the wiki's page rules** — it works for whoever holds it until it
  expires. That is what makes the store able to serve without asking the wiki, and it is why the
  expiry defaults to `5m`. When signing fails, the site's `storage.directAccessFallback` decides:
  `stream` (default) serves the bytes the slow way so a bad credential costs performance rather than
  every image on every page, `error` fails the request so it cannot go unnoticed. The target records a
  `warning` either way.

  **A custom `baseUrl` is signed *for*, never swapped in afterwards.** S3 and GCS sign the host, so
  rewriting it invalidates the signature: S3 builds a second client (`bucketEndpoint` with the URL as
  the `Bucket` when the domain *is* the bucket, `forcePathStyle` when the bucket is a path segment),
  GCS passes `cname`, and Azure alone can simply swap the origin because a SAS signs the
  canonicalized resource and not the host. CloudFront is therefore out of scope — it needs its own
  key pair and signing scheme.

  **A module can decline to serve at all.** `assetDelivery.isDeliverySupported` (default true; false
  only for `sftp`) keeps a target out of the Content Delivery tab, out of `sourceOptions`, and gets a
  nomination refused by `validateTarget` and cleared by `updateTarget`. It is still written to,
  exported to and imported from — the point is that every image on every page should not be an SSH
  round trip. It does stay in the read fallback list, sorted behind even the database: `offloadUnchecked`
  can leave a file whose only copy is there, and a slow answer beats telling a reader it is gone.

  **Only an explicit nomination moves delivery.** A type nobody has been nominated for is served
  from the database (`deliveryTargetsFor`), never from whichever other target happens to be enabled
  — enabling one says where content is *written*, and a target enabled after an upload holds none of
  the existing files anyway. Disabling a target therefore puts delivery back, and `updateTarget`
  clears `servedTypes` as it goes so that re-enabling it later does not silently take the content
  type with it. The database gives the role up only by not holding the type at all.

So neither an asset nor a page records where its bytes went — there is no single place — and each
target derives where its own copy sits from the tree, the same way for both. `resolveTargetFor` and
`assets.storageInfo` are gone; `writeTargetsFor` and `deliveryTargetsFor` replace them.

**Where a file sits under a target's root is one answer per site too**, and `storage.pathPrefixFor`
is the only thing that gives it: the leading segments of every path any path-based module writes,
with `parseStoredPath` as its exact inverse for reading a folder back in. Two site settings shape it,
both on the **Configuration** tab and both read through `storage.pathLayoutFor`:

- **`storage.sitePrefix`** (off) files the tree under a folder named after the site. Off because the
  configured root already *is* that site's folder; on is what lets two sites share a location, each
  ignoring the other's half of it.
- **`storage.localePrefix`** (on) brackets the tree by locale, which is what keeps `guides/logo.png`
  from being the same file in every locale. **Off, the site stores its primary locale and no other**
  — there is nowhere to put the rest — so `pathPrefixFor` answers null for them and the target is
  skipped: a page copy silently (the page is in the database either way), an asset copy after a
  `canStore` check, so that the upload still succeeds as long as some *other* target takes the bytes.

Neither setting moves anything already stored; the disk target's export and import actions are how
content crosses from one layout to the next.

**Which content type a file is, is one answer per site, not per target.** `large` is a category of
its own rather than a modifier — that is what lets a target take the 40 MB video without also taking
every thumbnail — and the size at which it starts lives in the site's config as
`storage.largeThreshold` (`storage.largeThresholdFor`, the admin area's **Configuration** tab). It
has to be shared: a file the disk target called large and the database called an image would be
claimed by neither target, or by both. The whole storage configuration of a site — the site-wide
settings and every target — is read and written as one, through `GET`/`PUT /sites/:siteId/storage`.

Everything else follows from that:

- **A write must succeed everywhere; a read may fall back.** `storage.putAsset` fans out and throws if
  any target refuses, failing the upload — an asset may have no database copy, so a half-stored one
  must not be reported as saved. **Refusing is not the same as having nowhere to put it**: a target
  whose `canStore` says no is never asked, because nothing has gone wrong and the file may well be
  storable elsewhere. Only when *nothing* can hold it is the upload failed, and then with a
  `CustomError` — a plain `Error` reaches the client as a bare 500, since the error handler in
  `index.ts` only forwards a message that came with a `statusCode`. `getAsset` tries the nominated source and then every other target
  holding the content, database last, because a target enabled after an upload never received it.
  Pages are gentler still: `mirrorPage` / `removePage` / `relocatePage` log a target that could not
  keep up and carry on, since the database always has the page.
- **The disk target's `exportAll` is a copy, not a move.** It writes out everything it is configured
  to hold, overwriting, and touches neither the database nor any record — which is how content that
  predates the target being enabled gets onto it.
- **The move is the database target's `offloadUnchecked`.** Turning a target on only affects what is
  uploaded from then on, so a site that unticks a content type on the database is still carrying
  every file of that kind ever uploaded — and carrying it unreachably, since a target is only read
  for a type it stores. That action reads each of those out of its row, writes it to every enabled
  target holding the type, **reads it back to check** and only then clears the `data` column. An
  asset with no destination keeps its copy and is reported as stranded: nothing is cleared that is
  not known to be somewhere else, because this is the only copy of the bytes. Metadata is untouched
  throughout — `data` is the one column it empties.
- **Renames have files to move on every target.** `assets.relocateAssets` takes the old location from
  the caller and reads the new one off the tree; `tree.renameFolder` does the same for everything
  beneath a renamed folder, pages included (moved, not rewritten — nothing changed).
- **Thumbnails always stay in the database** (`assets.preview`) — the file manager asks for a
  screenful at a time, and a slow target must not cost a wiki its file browser.
- **`pages.adoptStoredPage` and `assets.adoptStoredFile` are the way back in**, for the disk
  target's two import actions. Both take an `overwrite` flag, and it is the only thing separating
  them: `importAll` leaves a path the wiki already has alone, because reconciling a file changed on
  both sides is a merge and belongs to a target with history, while `importAllOverwrite` lets the
  folder win — for a restore, where there is nothing to reconcile. A page is replaced through
  `updatePage`, so its previous version is in its history; an asset has none, and `replace` also
  dispatches the new bytes to every write target, since the copy a reader is served is usually the
  database's. Imported content is rendered with **no script or style permission** whoever ran the
  import, since the file need not have been written by them.
- **On import a file is a page if its extension is reserved, or if it declares an `editor`** in its
  front matter. A text page is front matter plus the source; a **JSON** page — a redirection today —
  is one JSON document with the metadata at its top level and the source under `content`.

**Pages and assets share one folder, and the site's `pageExtensions` is what keeps them apart.** A
page is stored under its editor's extension (`md`, `html`, `adoc`, `json`), while the tree holds its
name without one — so page `notes/readme` and an attachment called `readme.md` are different names to
the wiki and the same file on disk. Three rules stop them ever meeting, and all three live in the
models rather than in the storage module:

- **`pageExtensions` are reserved.** `assets.upload` refuses an attachment using one — a `.md` file is
  a page, so uploading it as an attachment is a mistake rather than a collision. This is the whole of
  it on a default site (`md,html,txt`).
- **Both sides check anyway.** For an extension a site has taken *off* that list,
  `assets.guardAgainstPageCollision` and `pages.guardAgainstAssetCollision` refuse whichever arrives
  second. Extensions must match to collide: `readme.pdf` sits happily beside the page `readme`.
- **Nothing guesses at a name.** `StoragePageRef` carries `contentType`, so a delete or a move touches
  exactly one file — a target that tried each extension in turn would delete the attachment next door.

**A target's `state` column is how it is behaving, not how it is configured.** `{ status: 'healthy' |
'warning' | 'error', message, updatedAt }`, written only by `storage.recordState` as the model
dispatches to a module, absent from `StorageTargetInput`, and reported by the Status card. `error` is
a failure that was raised to whoever asked (a refused upload); `warning` is one that was swallowed
because the request succeeded anyway (a page copy that could not be written). The last operation
wins — a later success clears an earlier failure, which is what makes a full disk that gets emptied
stop reporting itself without anybody dismissing anything. Nothing probes a target proactively, so a
misconfigured one reads healthy until something is actually asked of it.

**The git target is the disk target plus history and a remote.** Same tree, same helpers, and then:

- **Commits are local and immediate; the network is batched.** A page save writes, commits and
  returns — `prepareRepo` deliberately never contacts a remote, so an unreachable one cannot make the
  wiki slow to edit or fail an upload. `ensureRemote` is the half that does, and only `sync` calls it.
- **`sync` runs on a schedule.** `tasks/simple/sync-storage-targets.ts`, on a `* * * * *`
  `jobSchedule` row seeded by `jobs.init()`, walks every enabled target whose module declares a `sync`
  handler (`storage.syncableTargets`) and runs it through `executeAction`, so a failure lands on the
  target's Status card. The **Force Sync** action is the same call on demand. In an HA set the
  scheduler hands the job to one instance, which is the one whose working copy syncs — each instance
  keeps its own.
- **How often is `storage.syncInterval`, per site** (the **Configuration** tab, `syncIntervalFor`,
  default `5m`). Since it is per site, one cron row cannot express it: the tick is every minute — as
  fine as the shortest interval anyone can set — and the task skips the sites whose turn it is not.
  Due-ness is `epochMinute % intervalMinutes === 0` rather than a stored last-sync time, so nothing
  has to be persisted, two instances agree without coordinating and a restart changes nothing. The
  cost is that a missed tick is not caught up, which for something running all day is the right
  trade. An interval that will not parse means *never*, not every minute.
- **A pull is authoritative, and that includes deletions.** What comes back is applied to the wiki
  with `overwrite`, and a commit that deleted a file deletes the page or asset here too. So push
  access to the remote is effectively write access to the wiki. Which of the two a vanished path was
  has to come off the tree rather than the file: the stem is looked up first and only counts as the
  page if `pages.storageFileNameOf` matches the name that went, so a deleted `readme.pdf` never takes
  the page `readme` with it.
- **A conflict is settled, never left open.** The pull is `--rebase --autostash`, and a rebase that
  conflicts stops and waits for a human that this working copy does not have — with the index
  unmerged, which git then refuses every write against, so it is not one failed sync but every commit
  after it (`ensureRemote`'s checkout is the first thing to fail, and what such a target reports).
  `pullRebase` therefore rolls a conflicted rebase back and pulls again with `-X ours`, which during a
  rebase is the *remote*, consistent with a pull being authoritative. What `-X` cannot settle is a
  file one side changed and the other deleted; that fails the sync, but leaves the working copy usable.
  `abortInterrupted` also runs at the top of every sync and in `prepareRepo`, so a copy somebody left
  mid-rebase by hand heals itself instead of needing Purge.
- **A working copy started again from nothing re-attaches itself.** It is a directory in a container
  while the content is a database elsewhere, so an upgrade that replaces the container without a volume
  for `data/repo` takes it with it — and `prepareRepo` then inits an empty one, the next page save
  commits into it, and the wiki has the remote's own files under a second root commit. `sync` asks
  `sharesHistoryWith` before it pulls, and with no commit in common `reattach` merges the remote's
  history in with `--allow-unrelated-histories -X ours` instead: the remote's history and every file
  the wiki has not re-saved come back, the working copy's version wins where the two overlap (these
  files were written from the database *since* the copy was created, so the remote's copy is the older
  one), and the push that follows puts the two in step. It runs in **every** mode — a `push` mode force
  push from a working copy created ten minutes ago would otherwise replace the whole repository with
  it. The wiki itself is not written to and `applyIncoming` is skipped for that sync, since the diff is
  the entire repository; Import Everything is what takes in content the repository has and the wiki
  does not.
- **The diff, not the tree.** Incoming changes come from `git diff --name-status -M -z` between the
  commit the branch was on and the one it is on now — a sync runs every few minutes and cannot read
  every file each time. `-z` because a path may contain anything, newlines included.
- **Every operation is serialized per target** by `withRepo`: git locks its index for the length of a
  write, so two concurrent uploads would otherwise have one fail on `index.lock`.
- **An empty commit is never made.** Most page saves do not change the stored form of the page (a
  re-publish, a tag reordered into the same order), and `commitPaths` checks `diff --cached` before
  committing so the history says what actually changed.
- Operator git config is inherited on purpose — including `commit.gpgsign`, which will fail every
  commit if it is on without a usable key. The failure surfaces as the target's recorded `error`.

**A change carries who made it, and only git cares.** `StorageAssetRef` and `StoragePageRef` carry an
optional `actorId`, which is the user id the models already had in hand at each dispatch site;
`storage.actorFor` turns it into a name and an email, cached indefinitely because a page save is a hot
path and a stale commit author costs nothing. Absent for a change no one person made — a folder rename
that moved a hundred files, a scheduled sync — and the git target's configured default author stands
in. A scheduled pull creates content, which needs an author, so it uses
`users.getSystemActorId()`: the wiki's longest-standing active administrator.

Git's **`alwaysUseDefaultAuthor`** makes that stand-in universal, for a repository whose history must
not carry the wiki's accounts. `commitAuthor` then returns the default without calling `actorFor` at
all — not looked up and discarded, so there is nothing to leak by mistake. Note the *committer* is the
default author in every case regardless: it is the repository's own `user.name`/`user.email`, which
`prepareRepo` writes from those same two settings, and which is why they are in
`configFingerprint` — renaming the default author has to re-prepare the repository to take effect.

Not to be confused with `<dataPath>/cache/files`, the serving cache in the assets model. That one is
derived and swept; a storage target is where content actually lives.

### Icons

Icons come from **Iconify** and are referenced the way Iconify references them — `<prefix>:<name>`,
e.g. `mdi:account-edit`. That string is all that content, navigation items and page relations ever
store; no SVG is ever written into content.

- **Admin** (`AdminIcons.vue` → `/_api/icons`) manages which sets exist: adding a set stores its
  metadata only, and enabling/disabling one controls whether its icons can be searched and filled in.
- **`models/icons.ts`** resolves a reference through four tiers — memory, disk
  (`<dataPath>/cache/icons/<prefix>/<name>.json`), the `icons` db table, then the Iconify API. **Only
  the db is permanent**; the disk cache is derived and starts empty on a fresh instance, so never treat
  it as storage. The upstream API is consulted only for an icon nobody has used yet, is capped per
  minute (public routes can trigger a fill), and is skipped entirely when `offline` is set.
- **Serving** is `controllers/icons.ts` under `/_icons`, cached for a year and immutable. Rendering a
  page never resolves an icon server-side.
- **Frontend**: render every icon with `<w-icon :name>` (`components/shared/WIcon.vue`).
  Components that take an `icon` prop go through it too, so every form works there.
  - Every Iconify reference written **literally in this repo's source** is inlined at build time by
    `scripts/generate-icons.mjs` into `src/assets/icons.generated.js` (committed) and drawn as an
    inline `<svg>`. Run `npm run icons` after adding or removing one; `check-icons.mjs` fails if the
    bundle drifts. This is why the interface needs no icon webfont — and why nothing an
    administrator does to icon sets can blank it, which fetching at runtime could not promise:
    resolution is gated on the set being enabled, and deleting a set drops every icon stored for it.
  - A reference built at runtime — an icon a **user** picked, stored on a page or nav item — is
    invisible to that scan and falls through to `iconify-icon`, resolving against `/_icons` as
    before. A name assembled by concatenation is therefore a bug: make it a literal.
  - `img:…` renders as an `<img>`. Legacy `las la-cog` / `mdi-check` webfont names are mapped onto
    their Iconify equivalents for data written before the fonts were dropped; do not write new ones.
- Picking an icon calls `POST /_api/icons/materialize`, which is what guarantees the wiki can serve it
  afterwards without the Iconify API.

### GraphQL is being removed

An earlier iteration of 3.x used GraphQL/Apollo. **All of it is deprecated** — there is no GraphQL
server left in `backend/`, and `APOLLO_CLIENT` is not defined as a global, so any call still going
through it throws.

**One call is left.** `pages/AdminNavigation.vue`'s `save()` sends the navigation tree and its mode
through `APOLLO_CLIENT.mutate`, so saving the navigation is broken until it is ported. Nothing else
under `frontend/src/` references the global. That handler needs more than the endpoint, mind: it also
calls `this.$store.commit(...)` nine times over, and the file is `<script setup>` with no Vuex store
anywhere in the app — so `this` is undefined and every one of those throws too.

When touching it, port it to the REST API (`API_CLIENT` + the matching `backend/api/` route)
rather than extending the GraphQL code. If the REST endpoint doesn't exist yet, add it under
`backend/api/` following the schema + permissions conventions above — `sites/:siteId/images/:kind`,
which replaced the logo and favicon upload mutations in `AdminGeneral.vue`, is a recent example of
doing exactly that.
