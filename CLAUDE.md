# Wiki.js 3.x

Next-generation open source wiki. This is the **3.x development branch**. AGPL-3.0.

**A database created by committed code has to be brought forward by a migration.** Anything that
has been committed may be running somewhere, so when a change alters what is stored — a column, the
format of a value, the meaning of a setting — an installation on an earlier commit must reach the new
shape through a migration under `backend/db/migrations/`. That includes rewriting data, not only
schema: a format change gets a migration that converts the existing rows. Converting the data is the
point — the code is not to carry fallbacks for the old format alongside the new one; once the
migration has run there is one shape, and the code reads only that.

**Nothing has to stay compatible with code that was never committed.** A shape introduced in
uncommitted work, which only a developer's own dev database can hold, can be changed freely: change
the shape, change the callers, and delete the old path, with no migration shim, legacy-value
fallback, deprecated alias or "old data may still contain X" handling — a fallback for a case that
cannot occur is dead code that still has to be read, tested and reasoned about. This applies to db
columns, API payloads, stored settings and config keys alike.

The one sanctioned exception is a value an existing installation **cannot** have and no static
default can stand in for — a secret generated per installation, say. That goes in a **startup check**
(`core/startupChecks.ts`), which every boot runs once to fill in what is missing; it is the only place
such a value is made, and nothing that reads it falls back on its own. A new setting with a fixed
default needs no check: put the default in `base.yml`, which is merged under the stored settings on
every boot.

Three independently-installed workspaces (each has its own `package.json` / `node_modules`, there is
no root package or monorepo tooling):

| Path        | What it is                                                    |
| ----------- | ------------------------------------------------------------- |
| `backend/`  | Fastify REST API server + job scheduler, Drizzle on PostgreSQL |
| `frontend/` | Vue 3 / Vite SPA, Tailwind CSS + an in-repo component library  |
| `blocks/`   | Lit web components users embed into wiki pages                 |

Requires Node.js **26+** and PostgreSQL **17+**. All three workspaces are ESM (`"type": "module"`).

The backend is **TypeScript 7**; `frontend/` and `blocks/` are JavaScript. See
[TypeScript (backend)](./backend/CLAUDE.md#typescript-backend).

## Layout

### Root

- `config.yml` — instance config (copy of `config.sample.yml`). Read by the backend at boot *and* by
  `frontend/vite.config.js` in dev mode to learn the proxy target port.
- `assets/` — **build output** of the frontend (`vite build` writes here), plus static assets under
  `assets/_assets/`. Served by the backend. Don't hand-edit.
- `dev/` — deployment/packaging artifacts: `dev/build/Dockerfile` (production image), `dev/chart/`
  (the 3.x Helm chart, published as an OCI artifact — its `README.md` is the reference), `dev/packer/`.
  `dev/helm/` is the 2.x chart and nothing for 3.x should be built on it.
- `.devcontainer/` — VS Code dev container (app + postgres + pgAdmin + mailpit via docker-compose).
  Mailpit is the mail server for development: it accepts everything and delivers nothing, so a
  confirmation link or a password reset lands in a web inbox at `http://localhost:8025` rather than a
  real mailbox. Point the wiki at it under **Admin → Mail** — host `localhost`, port 1025, TLS off,
  no credentials.
- Locale strings live in `backend/locales/`.

### Where the rest is documented

This file holds what applies everywhere. The rest is loaded only when it is relevant, so look there
before working in an area — and add to it there, not here:

- **Per workspace** — `backend/CLAUDE.md` (layout, the TypeScript rules, backend patterns),
  `frontend/CLAUDE.md` (layout, frontend patterns) and `blocks/CLAUDE.md` (layout, shadow DOM and
  dark mode), each loaded when a file under that directory is read.
- **Per subsystem** — `.claude/rules/*.md`, each loaded when a file matching its `paths:` is read:
  `storage` (storage targets, delivery, the git sync), `comments`, `app-shell-seo`,
  `distributing-blocks` (the `.wkblock` package), `emails`, `excalidraw`, `analytics`,
  `live-notes`, `audit-log`, `notifications`, `mcp`, `page-lifecycle`, `glossary`,
  `feedback-boards`, `metrics`, `icons`, `page-paths` (path segments, the ltree encoding) and
  `personal-access-tokens` (`config.scope`, `requestUser(req)`).
- **Procedures** — `.claude/skills/`: `throwaway-instance` boots, scripts and tears down a
  disposable instance.

A rule's `paths:` should name every file whose editing needs it. A new subsystem gets a rule file of
its own rather than a section here.

## Commands

Run backend commands from `backend/`, frontend from `frontend/`, blocks from `blocks/`.

```sh
# backend
npm run dev              # nodemon, restarts on any backend file change
npm run start            # plain node
npm run typecheck        # tsc — type check only, never emits
npm run typecheck:watch
npm run db-generate -- --name=foo-column   # drizzle-kit generate — after editing db/schema.ts
npm run db-up            # drizzle-kit up

# frontend
npm run dev            # vite dev server on :3001 (needs backend running on :3000)
npm run build          # builds into ../assets — required before the backend can serve the UI

# blocks
npm run build              # rollup → blocks/compiled/
npm run package -- block-x # compile one block → blocks/packages/block-x.wkblock
```

`npx ncu -i` (`npm run ncu`) for interactive dependency updates.

The API is browsable via Swagger UI at `http://localhost:3000/_api` in a running instance. Default
admin login is `admin@example.com` / `12345678`.

### How far to go verifying a change

Match the check to the size of the change. `npm run build`, `npx oxlint` and `npm run typecheck` are
seconds each and are the right check for nearly everything.

**Do not stand up a throwaway instance and drive a headless browser to look at a small change.** That
means booting a backend against a scratch database, seeding it, and screenshotting through a
headless browser — a good ten minutes of setup that a moved border, a colour, a spacing tweak or a
renamed label does not earn. Read the rule you wrote, trust the build, and say what you changed.

It is worth the setup for a **new** piece of UI whose markup has to meet a stylesheet written
elsewhere, where being wrong means shipping something visibly broken — a component reusing existing
content classes is the case that has actually gone wrong. Also for a flow with real state to exercise
(a login, an upload, a save), where a screenshot answers a question reading cannot.

When it is worth it, the `throwaway-instance` skill is how.

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
- **Use the native `Temporal` API, not luxon.** See [Backend patterns](./backend/CLAUDE.md#backend-patterns) for the
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

### Wording

**Write "regardless of what …", not "whatever …"**, for the "no matter what" sense: "sees every
page, regardless of what the page rules say", not "whatever the page rules say". The shorter form
reads as ambiguous or offhand, and "regardless of" says the condition plainly. This holds for
locale strings, code comments and documentation alike. Fix the wording in what you are already
editing, but don't sweep untouched strings or comments for it as a drive-by.

### Permissions

There are **two kinds of permission**, granted separately and checked in different places. Which
kind a name belongs to decides how it may be enforced, so it is the first thing to establish about
any permission you touch.

**Global permissions** are held site-wide, bound to no path: `access:admin`, `list:users`,
`read:users`, `write:users`, `manage:users`, `list:groups`, `read:groups`, `write:groups`,
`manage:groups`, `read:audit`,
`read:metrics`, `manage:theme`, `manage:storage`, `manage:sites`,
`read:webhooks`, `manage:webhooks`, `use:mcp`, `manage:system`. That is the
list as it stands — the one offered by the group editor
(`GroupEditOverlay.vue`). They live on a group's `permissions` column, are flattened onto
`req.session.permissions` at login (`models/users.ts` → `updateSession`), and are what the per-route
`config.permissions` hook checks. `manage:system` bypasses every check everywhere.

**Five of them are ELEVATED ADMIN PERMISSIONS**: `write:users`, `manage:users`, `write:groups`,
`manage:groups` and `manage:system`. `ELEVATED_PERMISSIONS` in `models/groups.ts` is the list that
decides, `isElevated()` is the test, and `groups.elevatedGroupIds()` answers which groups carry one.

What makes them a category is that each is a route to every OTHER permission on the wiki: whoever
can rewrite who holds what can grant themselves anything, in one step or two. So **membership of a
group carrying one is itself a privilege**, and the guards are written against the whole list rather
than against `manage:system` alone — stopping at the root permission would leave `manage:users`
handing out `manage:groups`, and `manage:groups` handing back `manage:users`, with neither step
looking like an escalation on its own.

Three rules follow, and they are enforced in `api/users.ts` and `api/groups.ts` rather than in the
models, since they are questions about the CALLER:

- **Nobody but `manage:system` moves a user in or out of an elevated group** — on create as well as
  on edit, and in both directions. Creating an account already inside one is the same act as
  promoting an existing one.
- **`manage:users` may not touch an account that belongs to a `manage:system` group at all**
  (`systemUserGuard`). That guard is `manage:system` only, not the whole list: a `manage:groups`
  account is protected from being re-grouped, not from being renamed.
- **The two group-editing rungs stop at different places** (`elevatedGroupGuard`): `manage:groups` is
  stopped only by `manage:system`, `write:groups` by any of the five.

The list is exposed to clients as a single `isElevated` boolean on `GroupCore`, never as the
permissions themselves — a caller who may not read a group still has to know which ones its controls
must not offer.

**A site's settings are split across three permissions that do not overlap**, so that the look of a
site, where its content is kept, and everything else about it are three separate grants:

| Permission | Admin screens |
| ---------- | ------------- |
| `manage:sites` | General, Analytics, Approvals, Comments, Content Blocks, Editors, Locale, Login, Navigation — plus creating, deleting and listing sites |
| `manage:theme` | Theme, and nothing else. `PUT /sites/:siteId/theme` takes this alone |
| `manage:storage` | Storage, and nothing else. Every route in `api/storage.ts` takes this alone |

An administrator who is to change all of a site's settings therefore holds all three.

**Webhooks are their own pair**, `read:webhooks` and `manage:webhooks` (`api/hooks.ts`), rather than
part of `manage:system` as they were. A webhook's `authHeader` is sent verbatim as the
`Authorization` header of every delivery, so it is a credential for somebody else's service: it
reads back as `SENSITIVE_MASK` for a caller who may not change webhooks, and the mask posted back
means "unchanged", the same contract module props use. Whoever may edit still sees the value — the
field is theirs to correct. Don't "helpfully"
accept `manage:sites` on a theme or storage route — the disjointness is the point, and the general
site update (`PUT /sites/:siteId`) refuses a `theme` key for the same reason.

**The two `list:*` rungs sit below reading**, and buy nothing but a picker's lookup:
`GET /users/lookup` (id, name, handle, avatar — never the email, and never matched on it) and
`GET /groups/lookup` (id and name). Disabled accounts, the guest account and the guests group are
never listed. Every rung above answers the lookup too (`LIST_USERS_PERMISSIONS` /
`LIST_GROUPS_PERMISSIONS` in `models/groups.ts`). They exist so that an ordinary author can name a
page's owners — `pageOwners` rows, set by `PUT …/pages/:pageId/ownership` with `write:pages` on the
page, no row meaning the page creator, and never part of a page version.

**The two `write:*` rungs sit between reading and managing:**

| Permission | May | May not |
| ---------- | --- | ------- |
| `write:users` | create an account | change any existing one; see the list (that is `read:users`); create into an elevated group |
| `write:groups` | create a group, rename it, write its page rules, staff an ordinary one | change what a group is ALLOWED to do (the Permissions tab); delete a group; staff an elevated one |

**Adding a global permission is the maintainer's call, not yours.** The list is not frozen, but a new
name reshapes who can do what across the whole instance and every existing group silently lacks it —
so propose it and wait for a yes before writing any code that names it. Until then, express what a
route needs with the permissions that already exist. This is about *adding* to the list; using one
that is already on it needs no permission from anybody.

**Page rule permissions** are bound to paths, and to locales and sites: `read:pages`, `write:pages`,
`review:pages`, `manage:pages`, `delete:pages`, `write:styles`, `write:scripts`, `read:source`,
`read:history`, `read:assets`, `write:assets`, `manage:assets`, `read:comments`, `write:comments`,
`manage:comments`, `manage:navigation`, `read:glossary`, `manage:glossary`, `read:notes`, `write:notes`,
`write:feedback` (`PAGE_PERMISSIONS` in `models/groups.ts`). A group grants them through **rules**:
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
- **`manage:navigation` asks about TWO paths.** It is the one page permission where holding it at the
  page in front of you is not the whole answer. At the page it buys the navigation MODE — whether
  this page inherits, overrides or hides its sidebar — which affects nothing above it. Editing the
  menu's ITEMS additionally needs it on the entry the menu BELONGS to, since those items are shown to
  every page under that entry: a page that inherits is editing its ancestor's menu, and a page with
  no overriding ancestor is editing the site-wide one, which `navigation.menuOwnerRef` reports as the
  home page's path. So a rule over `/guides` lets that section re-point its own pages without letting
  it rewrite the menu handed down to it. `api/navigation.ts` has the pair of checks
  (`mayManageNavAt`, `mayEditNavItems`), and the `inherited` route answers `canEditItems` so the
  editor knows which of its two halves to offer.
- **`read:glossary` and `manage:glossary` ignore the path.** They are the page permissions about a
  site and a locale rather than a page (`LOCALE_PERMISSIONS` in `models/groups.ts`): every rule naming
  one that is scoped to the site and locale applies, regardless of what it matches, and mode alone decides —
  ALLOW < DENY < FORCE ALLOW. So a DENY written for one folder closes the whole glossary. Ask
  `groups.checkLocaleAccess(actor, permission, siteId, locale)`; `checkAccess` routes them there too.
  `manage:glossary` in a locale implies `read:glossary` there. Neither is in the Guests group's seeded
  DENY rule, where it would outrank any ALLOW an administrator wrote for guests later.
- **`read:notes` and `write:notes` ignore the path too**, and are asked in the site's PRIMARY locale,
  since a live note belongs to a site and to no locale (`liveNotes.permissionsFor`). `write:notes`
  implies `read:notes`. The Users group is seeded with `read:notes` only, so out of the box any account
  can open a shared note and only administrators can start one. The guests group may be granted
  `read:notes` (it is in `GUEST_ROLES`, not in the seeded DENY rule) and never `write:notes`, which
  `permissionsFor` refuses to a requester with no account regardless of what the rules say.
- **Everything on a feedback board is ruled as the board**, all or nothing: every page permission on
  anything at or under a board's path — its ideas, and whatever older data left there before a
  board's folder was held to ideas alone (see [Feedback boards](.claude/rules/feedback-boards.md)) — is
  resolved against the board's own path and tags (`feedback.ruleRefFor`, which `checkAccess` asks
  before resolving any rule). A rule written for a path below a board, or a tag rule matching an
  idea's own tags, is never consulted; the group editor warns about the first. `write:feedback` is
  submitting an idea and editing or withdrawing one's own while it is open, through
  `api/feedback.ts` only. The Users group (and a new group) starts with it, so a board's own "accepts
  ideas" switch is what opens it; guests never hold it. See [Feedback boards](.claude/rules/feedback-boards.md).
- **A page that is not live is its editors' alone.** Live is `published`, or `scheduled` inside its
  window (`publishStartDate` inclusive, `publishEndDate` exclusive); the dates gate nothing on a
  `published` page, where `publishStartDate` is what a blog post is dated by. Any other page is seen —
  render, source, history, comments, a listing or search result — only by a signed-in session (or a
  personal access token, which acts as its owner) holding `write:pages` or `manage:pages` on it;
  `read:pages` and `read:source` are not enough, and a request acting as no user (a system API key
  included) never sees one. `helpers/publishing.ts` is the rule:
  `liveCondition` for SQL, `maySeeUnpublished` per page, and `unpublishedFor(req)` in `api/pages.ts`
  is what a reader-facing `getPage` passes as `unpublished`. That option defaults to open because most
  callers are the wiki acting on its own pages, so a new route answering a reader has to pass it.
- **An anonymous request is the guests group**, not an absence of groups: that is how a wiki opens
  reading, and suggesting edits, to the public. Deny guests explicitly where an account is genuinely
  required (`reviewerFor` in `api/approvals.ts` is the worked example).
- **Never invent a permission name.** Nothing validates one, so a name that is not on the lists above
  simply never matches: `can('browse:fileman')` and friends silently hid the controls they guarded.
  Adding a genuinely new global permission is allowed but is the maintainer's decision — ask first,
  as above; never introduce one on your own.
