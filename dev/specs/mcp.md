# MCP — the wiki as a Model Context Protocol server

**Status:** designed, not built. Nothing of the endpoint is implemented beyond the placeholder
admin screen; the credential it takes is — personal access tokens shipped in `206804fb` and are what
an MCP client authenticates with ([§4](#4-identity-and-tokens)). Every name, path and payload shape
below that does not exist yet is illustrative.
**Covers:** what an MCP server built into Wiki.js would expose, how it authenticates and authorizes a
client, what it costs, what it risks, and the admin screen at `/_admin/mcp`.

The [Model Context Protocol](https://modelcontextprotocol.io) is how an AI client — Claude Code,
Claude Desktop, VS Code, Cursor, claude.ai and ChatGPT connectors — is given tools and content from
somewhere else. A wiki is an obvious thing to plug in: it is where an organisation's knowledge
already is, and the question an agent most often cannot answer is "what does *our* documentation say
about this".

The constraint this document is written against: **an agent is somebody acting on a person's
behalf, and must never be able to do more than that person could.** The credential is a personal
access token, created by the person it acts for under **Profile → Access Tokens**, and it carries
their groups and permissions — every page rule,
every locked page and every unpublished draft applies to it exactly as it applies to them, and an
administrator's token is an administrator's — down to whether a page it writes may carry scripts and
styles.

---

## 1. Goals and non-goals

Two goals, and everything else in this document is in service of them.

### Goal 1 — an agent answers from the wiki

**An agent can find and read any page its owner could, and use it to answer the task in front of it
or the person it is working for.** "What does our runbook say about rotating the database
credentials", "which of our services still use the old auth library", "summarise the onboarding
guide for a contractor". It is the reason most deployments will turn this on, and it has to be good
rather than merely possible:

- **Everything the owner may read is reachable**, and nothing else is. Every page, in every locale,
  under the same page rules, locks and publishing state as the browser — and the glossary, which is
  where a wiki keeps the meaning of its own vocabulary. Nothing hidden from the owner is hinted at:
  no count, no title, no "a page exists here".
- **Finding is the hard part.** An agent does not know the tree, the page names or the locale a
  topic was written in. Search has to rank well, show why a result matched, filter by path, tag and
  locale, and cross locales when asked to; browsing has to show the shape of a section without
  reading every page in it. See [§5.3](#53-referring-to-the-wiki-goal-1).
- **Every answer is citable.** Each result carries the page's URL, title, locale, last update and
  version, so the agent can link the person to its source and the person can check it. An answer
  from the wiki that cannot be traced back to a page is no better than one from the model's memory.
- **Freshness is visible.** When a page was last changed and by whom is part of what the agent
  reads, so it can say "this was last touched three years ago" rather than present it as current.
- **Reading is sized for a context window**: a page's outline first, then the section that matters,
  rather than a megabyte of markdown.

### Goal 2 — an agent contributes to the wiki

**An agent can write documentation back: new pages for what it learned, corrections to what is
wrong, updates to what is out of date.** The wiki is shared knowledge, and an agent that discovers
how something actually works — while fixing a bug, answering a question, migrating a service — should
leave that behind for the next person and the next agent, rather than take it with it when the
conversation ends. Over time the wiki gets better because it is used, not only because somebody
found an afternoon to update it.

- **A contribution is an ordinary page edit.** Same tree, same page rules, same history, same
  search, same notifications to whoever watches the page. There is no separate agent store, no
  hidden memory, and nothing an agent writes that people cannot read, review and revert. What one
  agent writes is what the next one finds.
- **Correcting beats duplicating.** The tools make the right workflow the easy one: search before
  creating, update the page that exists, edit the paragraph that is wrong rather than resubmitting
  the page. See [§5.4](#54-contributing-to-the-wiki-goal-2).
- **Every change says why, and that it came from an agent.** A reason is required on every write,
  and the version is marked as made through MCP, so a person reading the history can tell an agent's
  correction from a colleague's and judge it accordingly.
- **Where the owner may not edit, the agent can still contribute**: suggest the edit for review
  through the approvals flow, or flag the problem in a comment. Fixing an error should never depend
  on the agent happening to hold `write:pages` on that page.
- **What it writes is live like anything else.** Rendered, searchable and readable by the next
  agent — which is why rendering without a browser is not a detail
  ([§6.3](#63-a-page-written-without-a-browser-has-no-render)).
- **The administrator decides how far it goes**, per instance: which kinds of write exist at all,
  and with what default publish state. The owner decides per token, through its scopes. Moving and
  deleting pages are a step further than contributing and stay off until asked for.

### Also

- **The same answers as the browser.** The person holding the credential gets the same search
  results, the same pages and the same refusals through an agent as they would themselves.
- **Works on any instance**, including an HA set behind a load balancer with no sticky sessions.
- **One switch to turn it off**, and the existing ways to take tokens back.

### Non-goals

- **Administration.** No tools for users, groups, settings, storage or sites. That is a different
  risk profile entirely and neither goal needs it.
- **Server-side rendering.** The page pipeline lives in the browser and stays there; see
  [§6.3](#63-a-page-written-without-a-browser-has-no-render).
- **An AI feature in the wiki itself.** This makes the wiki a *source and a destination* for
  somebody else's agent. It does not put a model in the wiki, and nothing here summarises, embeds or
  rewrites content on the wiki's side.
- **Semantic search.** Goal 1 is served by the full-text search the wiki already has, made to answer
  well for an agent. Embeddings and a vector index are a separate feature with costs of their own;
  if they come, `search_pages` is where they would surface, and nothing here assumes them.

---

## 2. What exists today

| Piece | Where | State |
| ----- | ----- | ----- |
| The admin screen | `frontend/src/pages/AdminMcp.vue`, route `mcp` in `router/routes.js` | Placeholder: enable and "New MCP Key" buttons permanently disabled, a "not implemented" banner. The "New MCP Key" button goes: the credential is a personal access token, made from the profile ([§4](#4-identity-and-tokens)) |
| The sidebar entry and status light | `layouts/AdminLayout.vue` | Reads `adminStore.info.isMCPEnabled`, which `GET /system/info` never sends — always red |
| Strings | `backend/locales/en.json`, `admin.mcp.*` | `admin.mcp.notImplemented` goes once the screen is real |
| Docs link | `siteStore.docsBase + '/dev/mcp'` | Points at a page that has to be written |

Nothing of MCP exists on the backend: no route, no model, no settings key, no dependency — and no
dependency is to be added for it ([§3.1](#31-transport-stateless-streamable-http-at-_mcp)).

What it will be built from:

| Piece | Where | Used for |
| ----- | ----- | -------- |
| Personal access tokens: issue, scopes, per-request resolution of the owner | `models/personalTokens.ts`, `api/personalTokens.ts`, `db/schema.ts` `personalTokens` | The credential, [§4](#4-identity-and-tokens) |
| Scope checking | `requiredScope`, `grantsScope` in `models/personalTokens.ts` | Which tools a token may call, [§5](#5-features) |
| The account a request acts as | `requestUser` / `requestUserId` (`helpers/requester.ts`) | The actor every tool passes to the models |
| A page actor from a request | `actorFrom` in `api/pages.ts`, which takes a token's owner since `206804fb` | Writes |
| Signing, verification, certificate rotation | `models/apiKeys.ts` (`verify` dispatches on audience) | Verifying the token |
| The one bearer hook | `index.ts`, "API Key Authentication" | Letting `/_mcp` through |
| A bearer-authed controller outside `/_api` | `controllers/scim.ts` | The shape of `controllers/mcp.ts` |
| Page access for an arbitrary actor | `groups.checkAccess(actor, permission, page)` | Every tool |
| Full-text search taking an actor | `search.searchPages({ actor, … })` | `search_pages` |
| Tree browsing | `tree.browse`, `tree.listPages`, `tree.getFolder` | `browse_tree` |
| Protected-content rule | `hideProtectedContent`, `mayBypassPassword` | Locked pages, [§7](#7-security) |
| HTML → markdown | `turndown` (+ GFM plugin), already a dependency | Reading a page without `read:source` |
| Diffs | `diff`, already a dependency | `diff_versions` |
| A page's absolute URL | `pages.urlFor`, as `helpers/appShell.ts` composes the canonical link | The `url` every result carries |
| URL path decoding and normalization | `decodeUrlPath`, `normalizePagePath`, `normalizeNewPagePath` | `get_page` by URL, `create_page` |
| A page's outline | the `toc` column, written with the render | `get_page` sections |
| Links both ways | `pageLinks` | `get_page_links`, `get_backlinks`, the broken-link report |
| Reason for change | `pageHistory.reason`, the git target's commit message | The reason every write requires |
| Watch notifications | `notifications.emit` from the models (`watchedPage`) | People hearing about agents' edits |
| Glossary lookup and editing | `models/glossary.ts` (`lookup`, `create`, `update`) | The `glossary` tools |
| Comments with annotations | `models/comments.ts`, `commentAnnotations` | `post_comment` |
| Headless render queue | `pages.queueRerender`, `models/rendering.ts` (Puppeteer extension) | Pages an agent writes |
| Approvals / suggestions | `models/approvals.ts`, `api/approvals.ts` | `suggest_edit` |
| JSON Schema validation | Ajv, which Fastify already carries (`@fastify/ajv-compiler`), plus `ajv-formats` | Tool arguments |
| JWT signing and verification | `helpers/jwt.ts` | OAuth access tokens, [§4.3](#43-oauth-21) |
| Audit log | `helpers/audit.ts` (records a token's owner as the actor, with `meta.patId`) | Writes |
| A settings blob with get/validate/update | `models/scim.ts` + `models/settings.ts` | `models/mcp.ts` |

---

## 3. Architecture

### 3.1 Transport: stateless Streamable HTTP at `/_mcp`

- **Streamable HTTP**, the current MCP transport: JSON-RPC `POST`s to one endpoint.
- **Stateless.** No `Mcp-Session-Id`; every request carries its credential and is answered on its
  own. A protocol session would live in the memory of one instance, and an HA set would then need sticky
  sessions to keep a client on it. Nothing in [§5](#5-features) needs the server to push to the
  client, so nothing is lost.
- **JSON responses, not SSE.** No long-lived connection for a proxy to time
  out or for `@fastify/compress` to buffer. `GET /_mcp` — the server-to-client stream — answers 405.
- **A controller, not an `api/` plugin**, for the reasons `controllers/scim.ts` gives for itself:
  errors are JSON-RPC errors rather than the `/_api` error shape, and MCP is described by its own
  `tools/list` rather than by OpenAPI, so it stays out of Swagger.
- **The site is the hostname's**, resolved through `WIKI.sitesMappings` as `/_blocks` and the SEO
  hook already do. Tools do not take a `siteId`; an agent connected to `docs.example.com` sees that
  site and no other.
- **Registered before the SEO hook**, like metrics, for the same reason: nothing about `/_mcp` wants
  a locale prefix or trailing-slash redirect.

**Written by hand, not with `@modelcontextprotocol/sdk`.** The SDK would bring `zod` and, in v1,
express and a handful of other packages into a Fastify backend, for a protocol whose stateless subset
is small: JSON-RPC 2.0 framing and batching, `initialize` (with protocol version negotiation and the
server `instructions`), `ping`, `tools/list`, `tools/call`, `resources/templates/list` and
`resources/read`, and the JSON-RPC error codes. That is an ordinary Fastify route and a dispatch
table. Tool input schemas are plain JSON Schema — which is also what `tools/list` has to publish, so
they are written once — validated by the Ajv that Fastify already carries. The same goes for OAuth
([§4.3](#43-oauth-21)): PKCE is a SHA-256 comparison and the tokens are JWTs `helpers/jwt.ts`
already signs. The rule for the whole feature is that a dependency comes in only where writing the
thing would be a real project of its own, and nothing here so far is.

### 3.2 Where the code lives

| Path | What |
| ---- | ---- |
| `controllers/mcp.ts` | The endpoint: enabled check, Origin check, rate limit, then dispatch |
| `mcp/protocol.ts` | JSON-RPC framing, `initialize`, the `tools/*` and `resources/*` methods, error codes |
| `mcp/tools/*.ts` | Tool definitions, one file per group of [§5](#5-features). Each calls **models**, never an HTTP route |
| `helpers/tokenBucket.ts` | The in-memory rate limiter, [§7.1](#71-performance) |
| `controllers/oauth.ts`, `models/oauth.ts` | The OAuth 2.1 authorization server and the `/.well-known/` metadata, [§4.3](#43-oauth-21) |
| `models/mcp.ts` | The `mcp` settings blob (`getConfig` / `validate` / `updateConfig`, as `models/scim.ts`) and the per-call check of [§5](#5-features). No token code: issuing and resolving tokens is `models/personalTokens.ts` |
| `api/mcp.ts` | Settings only (`manage:system`). Tokens are managed by the existing routes in `api/personalTokens.ts` |
| `base.yml`, `models/settings.ts` | The `mcp` defaults, and their seed, as `scim` has both |
| `index.ts` | The bearer hook admits `/_mcp` and leaves a personal token's scope check there to the controller ([§4.2](#42-personal-access-tokens-are-the-credential)); the controller is registered |

---

## 4. Identity and tokens

### 4.1 What a personal access token already is

The credential MCP needs already exists as the personal access token (`models/personalTokens.ts`),
built for the API as a whole rather than for MCP alone. What MCP takes from it as it stands:

- **It acts as its owner, resolved per request.** `verifyClaims` reads the token's row, the owner's
  account and the owner's groups on every call: a group change applies to the next one, a
  deactivated account's tokens stop, and the request carries the owner as `req.apiKey.user` with
  their groups and global permissions beside it. `requestUser(req)` is how anything asks who that is.
- **An administrator's token is an administrator's.** Nothing is stripped: an owner holding
  `manage:system` hands it on, bypass of every page rule included. What keeps such a token out of
  the admin area is the scope check — no administration route declares a scope — not a reduced set
  of permissions. `/_mcp` has no admin tools ([§1](#1-goals-and-non-goals)), so it holds the same line.
- **It can write.** `actorFrom` in `api/pages.ts` takes a token's owner, so a page saved through a
  token has an author and is sanitized against that author's permissions. This was the second of the
  two things a system API key could not do; the first, judging a key against page rules as the guests
  group, was fixed separately in `81de1790` — a system key now reads by its own groups' rules.
- **Scopes, per area, none / read / write.** `TOKEN_SCOPE_CATEGORIES` — `pages`, `assets`,
  `comments`, `glossary`, `navigation`, `approvals`, `profile`, and `mcp` once this lands
  ([§4.2](#42-personal-access-tokens-are-the-credential)) — each at `read` or `write`, write
  including read, at most one per category, at least one in all. Chosen at creation and fixed for the
  token's life. A route opts in with `config.scope`; one that declares none is closed to every token.
- **Its own audience** (`urn:wiki.js:pat`), so a system key cannot pass for a personal token or the
  other way round. Signed by the same keypair as system keys, so regenerating the certificates
  invalidates both.
- **Lifecycle.** Shown once at creation; the row keeps the last eight characters, name, scopes,
  expiry (`7d` to `3y`, the system keys' choices), `lastUsedAt` (written at most every five minutes
  per instance) and created date. At most 50 per account. `/_mcp` adds no lifetime cap of its own: a
  token works there until its expiration, like everywhere else. Deleting removes the row — there is no
  revoked state, and the audit log is what keeps the record that it existed.
- **Who manages them.** The owner, from a signed-in session only (no token can list, mint or delete
  tokens), under **Profile → Access Tokens**, always able to delete their own. An administrator lists
  a user's tokens in the user editor with `read:users` or `manage:users`, and deletes one with
  `manage:users`, subject to `systemUserGuard`.
- **Two switches above it.** `api.isEnabled` off refuses every bearer token, personal ones included;
  `auth.allowPersonalTokens` off (**Admin → Authentication → Configuration**) stops personal tokens
  being created *and* used, keeping the rows so that turning it back on restores them. Neither needs
  any permission beyond what those screens already take. Creating a token needs no permission at all.

### 4.2 Personal access tokens are the credential

**`/_mcp` authenticates with a personal access token and nothing else.** There is no MCP-specific
token, no second table, no `kind` column on `apiKeys`, and no MCP audience. A client is configured
with `Authorization: Bearer <token>`, and the token is one its owner made under **Profile → Access
Tokens** like any other.

- **A token reaches `/_mcp` only if it holds the `mcp` scope.** `mcp` joins
  `TOKEN_SCOPE_CATEGORIES`, at read or write like every other, and is the one category that names a
  *surface* rather than an area of the wiki: no `/_api` route declares it, and every tool requires it
  on top of its own category. It is the owner's control over whether, and how far, an agent may use
  the token:
  - **none** — refused on `/_mcp` outright. A CI token pasted into an AI client's config does nothing
    there. Every token made before this lands is in this state; scopes are fixed for a token's life,
    so its owner makes a new one.
  - **`mcp:read`** — read-only tools only, whatever else the token holds. This is the one switch that
    makes an agent read-only: a token holding `pages:write` and `mcp:read` writes through `/_api` and
    only reads through `/_mcp`.
  - **`mcp:write`** — the write tools too, as far as the token's other scopes reach.

  So a tool call needs two scopes at the tool's level: `mcp:<level>` and `<category>:<level>`.
- **Still one kind of token.** A token holding `mcp:write` and `pages:write` writes on both surfaces,
  and it is the same write on either, down to what the page may embed
  ([§6.2](#62-what-an-agent-written-page-may-embed)). There is no MCP audience and no second table;
  what keeps an agent out is a scope its owner leaves unticked. The one exception is a token issued
  through OAuth, which is accepted on `/_mcp` alone ([§4.3](#43-oauth-21)).
- **The `mcp` category is offered like the rest** in the create dialog (`TOKEN_SCOPE_CATEGORIES` in
  `frontend/src/helpers/personalTokens.js` with an icon, `profile.tokensScope.mcp` and its hint in
  `en.json`), with a note under it while MCP is disabled on the instance. `TOKEN_SCOPES`, and so the
  `PersonalTokenScope` enum the API validates against, follow from the list.
- **A tool declares a category, as a route does.** `search_pages` is `pages`, `post_comment` is
  `comments`, `suggest_edit` is `approvals`. The level comes from the tool's `readOnlyHint` the way a
  route's comes from its method — read-only tools need `read`, the others `write`, of both `mcp` and
  the category — and `requiredScope` / `grantsScope` answer each of the two unchanged. A tool with no scope
  cannot exist; that is enforced where tools are registered, not left to review.
- **The bearer hook lets a personal token through to `/_mcp`.** It refuses one today on anything but
  `/_api` ("accepted by the /_api endpoints only"), and checks a route's `config.scope` in `onRequest`.
  `/_mcp` is one route carrying many tools, so the hook admits the token there and the scope check
  moves into the controller, per tool — at `tools/list` as well as `tools/call`, so a token is never
  shown a tool it may not call and a client does not offer the model something that will only be
  refused.
- **A system API key is refused on `/_mcp`.** It acts for groups and is nobody: there is no person
  for `use:mcp` to be asked of, nobody to author a write, and automating the wiki as a service is what
  `/_api` is for.
- **Scopes can only narrow.** They decide which tools a token may call; the owner's permissions and
  the page rules still decide whether a call succeeds. A token with `pages:write` whose owner holds
  `write:pages` nowhere writes nothing.
- **Write includes read, per category**, so no token can overwrite a page it cannot read.
- **A tool group the administrator switches off** is out of reach whatever the token's scopes say
  ([§5](#5-features)). Tool groups are an instance setting; scopes are the token's. A token gets no
  finer control than its categories: `pages:read` reads history as well as pages, because the history
  routes are `pages` on `/_api` too. An instance that wants no agent reading history switches the
  `history` group off.

### 4.3 OAuth 2.1

**Both ways in are supported.** Clients that take a static `Authorization` header (Claude Code, VS
Code, Cursor) use a personal access token as in §4.2. The remote connectors in claude.ai and ChatGPT
cannot be handed a header and expect the MCP authorization flow instead: OAuth 2.1, the wiki acting as
its own authorization server. It is the last phase ([§9](#9-suggested-order)) because the bearer path
is complete without it, not because it is optional.

**An OAuth grant is a personal access token made by a consent screen** instead of by the create
dialog. Same table, same owner, same scopes, same `verifyClaims` on every call; listed under
**Profile → Access Tokens** with the client's name, and deleted from there like any other. What it
adds:

- **Discovery.** Protected-resource metadata (RFC 9728) at `/.well-known/oauth-protected-resource`,
  naming the site's own origin as the authorization server, and a 401 from `/_mcp` that carries
  `WWW-Authenticate: Bearer resource_metadata="…"` pointing at it. Authorization-server metadata (RFC
  8414) at `/.well-known/oauth-authorization-server`. Both per hostname, since the site is the
  hostname's.
- **Dynamic client registration** (RFC 7591) at `/_oauth/register`, which is how the connectors
  introduce themselves. A registered client is inert — it can do nothing until a person consents —
  so registration is open, rate limited per address, and a client that no grant ever named is purged
  after a day. Clients live in a new `oauthClients` table: name, redirect URIs, created.
- **Authorization** at `/_oauth/authorize`: authorization code with PKCE, `S256` only, and an exact
  match on a registered redirect URI. No session sends the person through the wiki's own login first.
  The **consent screen** names the client and the host it will redirect to, and shows the scope grid
  prefilled from the requested `scope` (`mcp:read pages:read`, say) — the person may narrow it, never
  widen it — and the grant's lifetime, from the token expirations. Refused while
  `auth.allowPersonalTokens` or MCP is off, or when the person does not hold `use:mcp`, saying which.
- **Tokens** at `/_oauth/token`. An access token is a JWT with the personal-token audience naming the
  grant's row, valid for an hour. A refresh token is random, stored only as a hash on the row, and
  rotated on every use, as OAuth 2.1 requires for public clients; a refresh token presented twice
  deletes the grant, since one of the two presenters stole it. The row's `expiration` is the grant's
  lifetime, beyond which no refresh succeeds.
- **Resource binding** (RFC 8707): the `resource` parameter must name this site's `/_mcp`, and a token
  from a grant is accepted on `/_mcp` and nowhere else — the bearer hook refuses it on `/_api`. A
  connector asked for an MCP server, and that is all it gets, whatever the scopes would reach.
- **Schema.** `personalTokens` gains a nullable `clientId` (to `oauthClients`, on delete cascade) and a
  nullable `refreshHash`; migration `oauth-grants`. A row with no client is a token made by hand, and
  everything that exists today keeps working unchanged.
- **Written by hand**, per [§3.1](#31-transport-stateless-streamable-http-at-_mcp): the flow is four
  endpoints, a hash comparison and the JWT signing the wiki already does.

### 4.4 One new global permission

| Permission | Grants | Elevated? |
| ---------- | ------ | --------- |
| `use:mcp` | Using the MCP endpoint. Checked on the token's owner at every call, so taking it away stops that user's tokens on `/_mcp` on the next one, and leaves them working on `/_api` | No |

- **Holding a token and being answered on `/_mcp` are separate questions.** Any signed-in user may
  hold tokens while `auth.allowPersonalTokens` is on; `use:mcp` is what it takes, at every call, for
  `/_mcp` to answer one. A token whose owner lacks it is refused with a message that says so, rather
  than as invalid.
- **Creating a token needs no permission.** Personal access tokens are gated on the
  `auth.allowPersonalTokens` setting instead, and `use:mcp` is the only MCP-specific grant.
- **It reaches no other account and grants nothing beyond what the holder has**, so it does not join
  `ELEVATED_PERMISSIONS`.
- **Taking a token away is the existing token routes**: the owner from their profile, `manage:users`
  from the user editor, subject to `systemUserGuard`. Nothing MCP-specific is needed, and nothing is
  marked revoked — the row is deleted.
- **The guests group is anonymous access.** An anonymous request is the guests group everywhere
  else, so a wiki opens `/_mcp` to the public by granting guests `use:mcp` — no token, and the
  guests group's page rules. There is no separate switch for it: the grant is the switch. With no
  token there are no scopes, and an anonymous caller is treated as holding `mcp:read` and **read** on
  every category, and **write** on none — a public endpoint that writes is a spam channel, whatever the guests
  group's rules would allow. Anonymous access does not need `api.isEnabled` or
  `auth.allowPersonalTokens`, since no token is verified.
- **Admin → API keys are untouched**: still `manage:system`, still group-bound service credentials,
  and refused on `/_mcp`.
- **The MCP settings** — the enable switch, the tool groups on offer, limits — are one instance-wide
  blob, as SCIM's are, and `manage:system`. MCP is enabled once for the instance, with no per-site
  switch; which sites an agent sees is decided by the page rules, like everything else it sees. The
  only per-site setting is the agent guidelines page ([§8.1](#81-admin--mcp)), because it names a page
  in that site's tree.
- It goes into the group editor (`GroupEditOverlay.vue`) and the permissions list in `CLAUDE.md`,
  is offered to ordinary groups, and is granted to no group by default.

---

## 5. Features

### 5.1 What decides a call

Four things decide whether a call goes through, and they are asked in this order:

1. **The group** — whether the administrator has switched this group of tools on for the instance.
   A group that is off is not listed to anybody.
2. **`use:mcp`** — held by the token's owner, or by the guests group for an anonymous caller
   ([§4.4](#44-one-new-global-permission)).
3. **The token's scopes** — `mcp` and the tool's category, both at `read` for a read-only tool and
   at `write` otherwise ([§4.2](#42-personal-access-tokens-are-the-credential)). An anonymous caller
   holds `mcp:read` and every category at read, and nothing at write.
4. **The page permission** — `checkAccess` for each page the tool touches, with the owner's groups.

### 5.2 The tools

| Group | Tools | Scope | Page permission | Default |
| ----- | ----- | ----- | --------------- | ------- |
| `discover` | `search_pages`, `browse_tree`, `list_tags`, `recent_changes` | `pages:read` | `read:pages` | on |
| `pages` | `get_page`; `get_page_links`, `get_backlinks` | `pages:read` | `read:pages`, `read:source` for the source | on |
| `history` | `list_versions`, `get_version`, `diff_versions` | `pages:read` | `read:history` | on |
| `glossary` | `lookup_term`, `list_terms` | `glossary:read` | `read:glossary` | on |
| | `define_term`, `update_term` | `glossary:write` | `manage:glossary` | |
| `comments` | `list_comments` | `comments:read` | `read:comments` | on |
| | `post_comment`, with optional annotations | `comments:write` | `write:comments` | |
| `suggest` | `suggest_edit` through the approvals flow | `approvals:write` | the site's approval rules | on |
| `edit` | `create_page`, `update_page` | `pages:write` | `write:pages`, `write:tags` for tags | on |
| `assets` | `list_assets`, `get_asset` — images as MCP image content, size-capped | `assets:read` | `read:assets` | off |
| | `upload_asset` | `assets:write` | `write:assets` | |
| `destructive` | `move_page`, `delete_page` (to the recycle bin) | `pages:write` | `manage:pages`, `delete:pages` | off |

Each tool's scope is the one the `/_api` route doing the same thing declares — history is `pages`
there, suggestions are `approvals` — so a token reaches the same things on both surfaces. A tool's
level and its `readOnlyHint` annotation are the same fact, and are declared once.

**Why the write groups are on by default.** Contributing is half of what this is for
([§1](#goal-2--an-agent-contributes-to-the-wiki)), and the instance switch is not what keeps a token
from writing: its scopes are. A token starts read-only — the connect card prefills `mcp:read` and
`pages:read` ([§8.2](#82-profile--access-tokens)) — and writes only once its owner gives it
`mcp:write` and the category's write scope, and then only where the owner's page rules let them. A group switched off on top of that would be an
administrator saying "no agent writes here at all", which is a setting worth having and not a
sensible default.

The groups are the administrator's lever and the scopes the owner's, and they do not line up one to
one: `pages:write` reaches `edit` and `destructive` alike. That is why `destructive` is a group of its
own and off by default — no token, however it was scoped, can move or delete a page through `/_mcp`
until the administrator says so. `assets` is off for a different reason: binary content in a context
window is expensive, and an upload is the one write that is not text a person can read in a diff.

Across every tool:

- **Every tool carries annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint` — so that
  a client can ask before running the dangerous ones.
- **Every page in a result is named the same way**: `id`, `title`, `locale`, `path`, the absolute
  `url` (`pages.urlFor` on the site's hostname, as the canonical link in `helpers/appShell.ts` is
  composed), `updatedAt` and the current `versionId`. That is what makes an answer citable and a
  later write against it safe.
- **Resources**: a `wiki://{locale}/{path}` resource template backed by `get_page`, so a client can
  offer pages to @-mention. No resource *listing*: a large wiki is too many to enumerate.
- **Prompts**: none in the first version.
- **Server instructions.** The `initialize` result carries `instructions`, which a client puts in front
  of the model: what this wiki is (the site's title and description), its locales, how to cite
  (link the `url`), and how to contribute (search first, update rather than duplicate, give a
  reason). Then the site's own conventions, from an **agent guidelines page** the administrator
  names ([§8.1](#81-admin--mcp)) — an ordinary page, so it is written, reviewed and improved like any
  other, by people and by agents. Its text is included up to a cap; the rest is a `get_page` away.

### 5.3 Referring to the wiki (goal 1)

What an agent needs in order to answer from the wiki rather than from its own memory: find the right
page without knowing the tree, read the part that matters, and say where it came from.

- **`search_pages`** is `search.searchPages` with the actor, so its ranking and its rule filtering
  are the search page's. It takes the text, a path prefix, tags (all or any), and locales — every
  active locale of the site when none is given, since an agent does not know which one a topic was
  written in. Each result adds a `snippet` (the `ts_headline` the search route already computes) to
  the common page fields, so the agent can tell a real match from a passing mention without opening
  it. Paged with `offset` / `limit`, with a lower ceiling than the REST API. A result count is only
  ever a count of pages the owner may read.
- **`browse_tree`** answers the shape of a section: the folders and pages under a path, each with
  title and description, to a requested depth. It is how an agent finds where things live, and,
  for goal 2, where a new page belongs.
- **`get_page`** takes an `id`, a `path` with a `locale`, or a **`url`** — an agent is usually handed
  a link. A URL on this site's hostname is decoded (`decodeUrlPath`), stripped of its locale prefix
  and normalized as the router would; one on any other host is refused, not followed. It answers:
  - **metadata first**: the common fields, plus description, tags, the last editor's name, the
    publish state, whether the page is locked, and the page's translations (its locale group), so an
    agent can switch to the reader's language;
  - **the outline** — the page's stored `toc`, headings with their anchors and sizes;
  - **content**, either all of it (up to `mcp.maxResultChars`), one `section` by heading anchor, or
    an `offset` / `length` window. With `read:source`, the source as written. Without it, the stored
    render converted to markdown with turndown — what a reader sees, in a form a model reads well. A
    drawing is its extracted text, the same text search indexes (`extractText`), since an SVG scene
    means nothing to a model.
  - A **redirection** is followed, once, within the site, and the answer says it was.
- **`get_page_links` / `get_backlinks`** read `pageLinks` both ways, so an agent can follow a topic
  to its neighbours — and, for goal 2, find every page that will be wrong once the one it is fixing
  changes.
- **`recent_changes`** lists the latest versions the owner may read, newest first, filterable by path.
  It is what an agent asks "what changed in the runbooks this week", and what tells it a page it
  read earlier in a long task has moved on.
- **`list_versions` / `get_version` / `diff_versions`** let an agent answer "when did this change and
  why" from the history's own `reason` and author, and check what a page said before an edit it
  suspects.
- **`lookup_term`** resolves a name or an alias in a locale (`glossary.lookup`, case rules and all) to
  its definition, related terms and the page that documents it. A wiki's glossary is where its own
  vocabulary is defined, which is exactly what a model gets wrong by guessing.
- **Freshness is in the answer, not left to the agent to ask for.** `updatedAt` and the last editor
  are on every page, and the server instructions tell the agent to say when what it is relying on is
  old.

### 5.4 Contributing to the wiki (goal 2)

What it takes for an agent's writing to make the wiki better rather than noisier: write to the
right place, change only what it means to change, say why, and leave something people can review.

**The workflow the tools steer towards** — and the server instructions spell out — is search, read,
then update what exists or create what does not. Each tool's answer is built to make the next step
the right one:

- **`create_page`** takes a path (`normalizeNewPagePath`), a locale, a title, a description, tags and
  markdown. A path that is already taken is refused **with the page that holds it**, so the agent
  updates that instead of inventing `runbook-2`. It is created in the `markdown` editor and in the
  publish state the administrator chose for agent pages ([§6.5](#65-locked-and-unpublished-pages)).
- **`update_page`** requires the `baseVersionId` the agent read, and refuses a stale one with the
  current version rather than merging ([§6.4](#64-live-editors)) — so a correction is always made
  against what the page says now. It takes either a list of `str_replace`-style edits, each of which
  must match exactly once, or the whole content. The edits are the form to prefer: fixing an
  outdated paragraph should change that paragraph and nothing else, and the diff a person reviews
  should be that small. Title, description and tags are separate fields.
- **Which pages can be written.** A page keeps its editor. Markdown and Visual pages (both markdown)
  and AsciiDoc pages are written as source. Drawings, redirections and blogs are refused: a scene
  document and a settings document are not prose, and an agent should not be rewriting either.
- **A reason is required on every write**, whatever the site's `features.reasonForChange` says. It is
  stored as the version's `reason` — what the history shows and what the git target uses as the
  commit message — and it is how a person deciding whether to trust an agent's correction knows what
  it thought it was correcting.
- **The version is marked as made through MCP.** `pageHistory` gains a nullable `via` column, set to
  `mcp` by every write tool (migration `history-via`). It is **always recorded**; whether it is
  **shown** is the administrator's choice (`mcp.showAiBadge`, on by default —
  [§8.1](#81-admin--mcp)). Shown, an **AI** badge sits beside the owner's name on the version in the
  page's history and on the page's own last-edited line when the latest version is an agent's. The
  author is still the owner — they are the one accountable — but a reader is entitled to know which
  edits a person typed. Hidden, the column is still written, and the Contributions card and the audit
  log still read it.
- **The answer to a write** carries the new `versionId` and `url`, whether the render is done or
  queued ([§6.3](#63-a-page-written-without-a-browser-has-no-render)), and **the links in the new
  content that resolve to nothing** — read off the `pageLinks` rows the save just wrote — so a broken
  link is fixed in the same task rather than discovered by the next reader.
- **People find out.** A write is a page edit, so everything an edit does happens: the version is in
  the history and can be restored, watchers get their `watchedPage` notification, the change shows
  in recent changes, storage targets mirror it and the git target commits it. Nothing about it is
  quieter than a person's edit.

**When the owner may not edit the page**, the agent still has two ways to contribute, and the tools
offer them rather than leave it at a refusal — `update_page` refused for want of `write:pages` says
which of these the owner may use there:

- **`suggest_edit`** submits the change through the approvals flow, for the page's reviewers to accept
  or decline — the same edits-or-content input as `update_page`, plus the reason. A person reviews
  it, and the browser that approves it renders it.
- **`post_comment`** flags a problem in the page's discussion — "this procedure no longer works since
  the v3 migration" — optionally **annotating the passage** it is about (`commentAnnotations`: the
  passage's text and its note), so the people who can fix it see exactly what is wrong. Built-in
  comments only; on a site using a third-party provider the tool is not listed.

**Also contributions**:

- **`define_term` / `update_term`** add to the glossary, under its existing rules: one name means one
  term (a clash answers 409 naming the term that holds it, which is the one to update), and an update
  names the `updatedAt` it read (`expectedUpdatedAt`).
- **`upload_asset`** puts an image or a file next to the page that uses it, for documentation that
  needs a screenshot. Size-capped well below the site's upload limit. A diagram is better written as a
  `mermaid` or `kroki` code block, which stays text a person can review — the server instructions say
  so.

**Moving and deleting** (`destructive`) are not contributing and stay off until an administrator
turns them on: a reorganisation is a decision about the wiki, not knowledge added to it, and a move
rewrites links on pages the agent never read.

---

## 6. Behaviour worth pinning down

### 6.1 Output is sized for a context window

A page can be megabytes and a search can match thousands. Every result is capped
(`mcp.maxResultChars`, e.g. 50 000) and says so when truncated, with how to ask for the rest — for a
page, its outline and the `section` to ask for next ([§5.3](#53-referring-to-the-wiki-goal-1)), which
is cheaper for the agent than paging through the whole of it. `search_pages` and `browse_tree` cap
their `limit` below what the REST API allows.

### 6.2 What an agent-written page may embed

**Whatever the same token could embed through `/_api`.** The write tools take their actor from
`actorFrom`, unchanged, so the render is sanitized against the owner's own `write:scripts` and
`write:styles` exactly as a `POST /pages` with that token is — and a page an agent writes for an
owner who holds neither has its scripts and styles stripped like anybody else's. `queueRerender`
is handed the same two flags.

This is not the rule storage imports follow, which render with neither whoever ran the import. An
import is a file nobody vouched for; a tool call is made with a credential its owner chose to give an
agent, which is the same act as giving it to a script — and the owner who does not want an agent
writing at all gives it `mcp:read`. Keeping the surfaces alike also means a write is one thing
wherever it comes from: a rule that stripped scripts on `/_mcp` alone would be defeated by the agent
calling `/_api` with a hand-made token it already holds.

### 6.3 A page written without a browser has no render

The HTML of a page is produced by the editor's browser at save time. Without one, the only path is
the headless render queue, which needs the **Puppeteer extension**. A page an agent creates or edits
is therefore saved with its source and queued; until the queue reaches it, readers see an empty
page — the same state an imported page is in today.

**For goal 2 this is the whole question, not a detail.** `searchContent` — what full-text search
indexes — is extracted from the render (`rendering.postProcess`), so an unrendered page is not only
blank to a reader but **invisible to search**: the next agent looking for what this one wrote will
not find it, and neither will a person. A contribution that nobody can find has not been
contributed. So **the write tools that produce a page require the Puppeteer extension**:
without it, `create_page` and `update_page` answer that they are unavailable on this wiki — a tool
error naming the missing extension and pointing at `suggest_edit` — rather than save a page nobody
can read or find. `suggest_edit`, rendered by the reviewer's browser on approval, works everywhere,
as do the writes that need no page render: comments, glossary terms and uploads. The extension being
installed later makes the two tools work with nothing else changed. Until a queued render
lands, `get_page` answers a reader who holds `read:source` with the source and says the render is
pending, rather than an empty page.

The admin screen shows whether the extension is installed.

### 6.4 Live editors

A collaboration room is not storage: saving is an explicit act by whoever is in the room. If an agent
saves while people are editing, their next save silently replaces the agent's change. Two things
stop that: `update_page` refuses a stale `baseVersionId`, and a save from MCP relays the room's
existing `saved` message so the editors are told the page moved under them.

### 6.5 Locked and unpublished pages

- **Password-protected pages** cannot be unlocked by an agent. `get_page` answers "locked" unless the
  actor holds the bypass permissions; search uses `hideProtectedContent` as the search route does.
- **Pages that are not live** follow `helpers/publishing.ts`, through `unpublishedFor(req)` as every
  reader-facing route does. A personal token is its owner for that rule, so an agent sees a draft
  exactly where its owner holds `write:pages` or `manage:pages` — and an anonymous caller never does.
- **Pages created by an agent are published**, by default, and an administrator can make them start
  as drafts (`mcp.newPagePublishState`, `published` unless set). Published because of goal 2: a draft is
  visible only to those who may edit it, so a page an agent wrote as a draft is one no reader — and
  no other reader's agent — will ever find until somebody remembers to publish it. A wiki that wants
  a person between an agent and its readers either sets this to draft or switches `edit` off and
  leaves `suggest` on. Updating an existing page never changes its publish state.

---

## 7. Security

**Prompt injection is the headline risk.** Everything an agent reads — pages, comments, suggestions,
history — was written by somebody else, guests included where the site allows it. An agent that
reads a hostile page while holding write tools can be steered into editing or deleting others. What
answers it:

- read-only tokens by default — the connect card starts from `mcp:read` and `pages:read` — and
  destructive tools behind a switch of their own;
- `mcp:read` as one switch: a token holding it cannot write through `/_mcp` at all, and never even
  sees a write tool, whatever its other scopes — so an owner can give an agent a token they also use
  for scripts without giving the agent the scripts' write access;
- scopes per category under that, so a token with `mcp:write` and only `comments:write` can post a
  comment and cannot touch a page;
- the owner's own `write:scripts` and `write:styles` deciding what an agent's page may embed
  ([§6.2](#62-what-an-agent-written-page-may-embed)). This is the sharpest edge here: an agent
  steered by a hostile page into adding a `<script>` to one its owner may script is a stored script
  run by every reader of it. Those two permissions are rarely granted widely, and the connect card
  warns an owner who holds either ([§8.2](#82-profile--access-tokens));
- `suggest_edit`, and a setting for new agent pages to start as drafts, for a wiki that wants a
  person to look before readers do ([§6.5](#65-locked-and-unpublished-pages));
- small, reviewable edits: `update_page` prefers `str_replace` edits against a known version, so a
  change an agent was steered into is a short diff rather than a rewritten page;
- every write visible after the fact: a required reason, the version marked as an agent's,
  watchers notified, and the audit entry carrying `meta.via: 'mcp'` and `meta.patId` — so what an
  agent did can be found, judged and undone from history and the recycle bin.

The rest:

- **Tokens are stored in plaintext by clients**, in config files and dotfiles — and a token made by
  hand and put in an AI client's config is a token for `/_api` too, as far as its scopes reach
  ([§4.2](#42-personal-access-tokens-are-the-credential)). One from an OAuth grant is not: it is
  bound to `/_mcp`, lives an hour, and is refreshed by a rotating secret the connector holds
  ([§4.3](#43-oauth-21)).
  What answers it is what personal tokens already have: an expiry chosen at creation, narrow scopes,
  `lastUsedAt` in every list, delete by the owner from the profile or by `manage:users` from the user
  editor. The levers, narrowest first:
  - removing `use:mcp` from a group stops its members' tokens on `/_mcp` at once, and leaves them
    working on `/_api`;
  - disabling MCP stops the endpoint for everybody;
  - `auth.allowPersonalTokens` off stops every personal token everywhere, and keeps them for when it
    comes back on;
  - regenerating the certificates invalidates every token and every system API key, for good.
- **An administrator's token is a `manage:system` credential**, above every page rule, and sitting in
  a file on a laptop. The connect card says so ([§8.2](#82-profile--access-tokens)). No scope reaches
  an administration route and nothing on `/_mcp` administers the instance
  ([§1](#1-goals-and-non-goals)), so what leaks is every page and, from a token with write scopes, the
  ability to change any of them — not the instance itself. That boundary holds on `/_mcp` only as long
  as no admin tool is ever added, and on `/_api` only as long as there is no admin scope category,
  which `TOKEN_SCOPE_CATEGORIES` has none of by design.
- **Bearer only, never the session cookie.** `/_mcp` ignores cookies, which also removes CSRF from
  the picture.
- **Origin validation** is required by the MCP spec against DNS rebinding: a request carrying an
  `Origin` that is not the site's is refused. CORS is added for the MCP headers only if browser-based
  clients are to be supported.
- **Anonymous access** is the guests group holding `use:mcp` ([§4.4](#44-one-new-global-permission)),
  which suits a public documentation site: no token, the guests group's page rules, and — since
  guests hold no `write:*` rule anywhere by default — in practice read-only. It is also a public
  endpoint that runs database queries on demand, so it is always rate limited, per address. Guests
  are not granted it by default, and the group editor warns when `use:mcp` is ticked on guests.
- **Audit.** Writes go through the existing `page` / `comment` actions. `audit()` already records a
  personal token's owner as the actor and adds `meta.patId`; MCP adds `meta.via: 'mcp'`, which —
  with `pageHistory.via` for page edits ([§5.4](#54-contributing-to-the-wiki-goal-2)) — is what tells
  an agent's edit apart from a script's with the same token. The token's own
  lifecycle is already recorded — `createAccessToken` and `deleteAccessToken` under `profile`,
  `deleteUserAccessToken` under `admin` — so the one new action is `updateMcp` under `admin`. Reads
  are not audited, as elsewhere.

### 7.1 Performance

- **Authentication on every call.** Each JSON-RPC call is what any personal-token request already
  costs: an RS256 verification, the token row joined to its owner, and the owner's groups — two
  queries, uncached, so that deleting a token or changing a group bites on the next call. Agents call
  in bursts; if that proves to matter, the cache belongs in `verifyClaims`, for `/_api` as well, not
  in front of `/_mcp` alone. `lastUsedAt` is already throttled to once every five minutes per token
  and instance.
- **Rate limiting is an in-memory token bucket per instance** (`helpers/tokenBucket.ts`), not the
  postgres-backed `rateLimits.consume`. An agent fans out — a dozen searches and reads in parallel is
  an ordinary turn — and a database write per call to count them would load the database with the
  very traffic it is meant to protect it from. The bucket refills continuously and allows a burst
  (`mcp.rateLimit`: burst size and per-minute rate). The budget is per owner — `requestUserId(req)`,
  as `limitRenders` already counts — so that a second token does not buy a second budget, and per
  address for anonymous. Its map has a ceiling on entries and evicts the least recently used, since
  anonymous addresses are unbounded — the same reason `SHELL_CACHE_MAX_ENTRIES` exists. The cost is
  that it is approximate across an HA set: each instance counts alone, so a client spread by the load
  balancer over N instances gets up to N times the budget. That is accepted: the limit is there to
  stop a runaway agent hurting the instance it is hammering, which a per-instance count does, not
  to meter anybody exactly. A refusal is JSON-RPC error with the seconds to wait, which agents honour.
- **Search** already pages correctly with rule filtering, and the protected-content filter only runs
  for protected pages.
- **Bodies.** `/_mcp` gets its own body limit, large enough for a page being written.
- **The render queue** drains one page at a time across the instance. Write tools must not be able to
  flood it; the per-owner budget covers that, and a queue depth past a threshold refuses writes
  rather than growing without bound.

---

## 8. The screens

### 8.1 Admin → MCP

`/_admin/mcp`, modelled on `AdminScim.vue`. Reaching it takes `access:admin`, as every admin screen
does; what each part then allows is split by permission.

- **Header**: status light, docs, refresh, **Enable / Disable** (`manage:system`). No key button —
  tokens are not created here.
- **Prerequisites**: whether the API is enabled and whether `auth.allowPersonalTokens` is on, each
  linking to the screen that changes it. With either off, only anonymous access can work, and the
  card says so rather than leave an enabled endpoint refusing every token.
- **Endpoint**: the URL for each site — `https://<hostname>/_mcp` — with a copy button, and
  ready-to-paste setup for common clients: `claude mcp add --transport http …` with the header, a VS
  Code `mcp.json` entry, Cursor — and, for the remote connectors in claude.ai and ChatGPT, the URL
  alone, since they sign in through OAuth ([§4.3](#43-oauth-21)). The same card appears on the
  profile page, which is where a user actually needs it.
- **Capabilities** (`manage:system`): one switch per tool group of [§5](#5-features), each labelled
  with the scope its tools need. The groups holding write tools are set apart, `destructive` with a
  warning of its own, since `pages:write` reaches it as soon as it is on.
- **Guidance** (`manage:sites` for the site's own): the **agent guidelines page** of each site — a
  page path, picked from the tree, whose text goes into the server instructions
  ([§5.2](#52-the-tools)). Where new pages go, how they are named, which sections are reference and
  which are history, the house style. The one per-site MCP setting, since it is a page in that
  site's tree, and stored in the site's config. Empty, the
  instructions carry the generic guidance alone. The card links to the page and offers to create it
  from a starting template.
- **Safety** (`manage:system`):
  - default publish state of pages created by an agent (published, or draft —
    [§6.5](#65-locked-and-unpublished-pages));
  - maximum result size;
  - the rate limit — burst and per-minute rate, per owner and per instance
    ([§7.1](#71-performance));
  - whether the Puppeteer extension is installed, linking to Extensions — without it, page writes
    answer unavailable ([§6.3](#63-a-page-written-without-a-browser-has-no-render)).
- **Display** (`manage:system`): **Show the AI badge** (`mcp.showAiBadge`, on), whether versions made
  through MCP carry an AI badge in page history and on the page ([§5.4](#54-contributing-to-the-wiki-goal-2)).
  Off hides the badge only; which versions an agent made is recorded either way, and the
  Contributions card below reads it regardless.
- **Access**: who may use the endpoint, read off the groups — which groups hold `use:mcp`, and
  whether the guests group does (anonymous access, with a warning). Links to the group editor rather
  than a second place to grant it.
- **OAuth clients** (`manage:system`): the clients that have registered, with how many grants each
  holds, and delete — which takes every grant made to it with it.
- **Contributions**: what agents have added lately — page versions with `via = 'mcp'` over the last
  week, created and updated, linking to each; suggestions waiting. Read off `pageHistory`, so it
  costs nothing to keep and is the same on every instance. It is how an administrator sees goal 2
  working, or notices it going wrong.
- **Usage**, optional: calls in the last day by tool. Prometheus counters
  (`wiki_mcp_tool_calls_total{tool}`) cost less than a table, but are per instance.

**No token list.** An MCP token is only a personal access token holding the `mcp` scope, so a
user's tokens are seen and deleted where they already are, in the user editor.

The settings are `manage:system`; `access:admin` alone sees the endpoint and the settings read-only.

### 8.2 Profile → Access Tokens

No new profile page: `ProfileTokens.vue` is where an MCP client's token is made, and it gains what
connecting one needs while MCP is enabled.

- **Connect an AI assistant**, a card above the list: the endpoint URL for the current site and the
  client snippets, and a button that opens the existing create dialog prefilled — a name such as
  "AI assistant", `mcp:read` and `pages:read`, the read-only starting point. The copy dialog that shows the token
  once also shows the snippets with it filled in, so that it is pasted once and never again.
- **Without `use:mcp`** the card says plainly that `/_mcp` will refuse the user's tokens until an
  administrator grants it, rather than offer a setup that silently does nothing.
- **For an owner holding `manage:system`**, the card warns that a token used by an agent is above
  every page rule. **For an owner holding `write:scripts` or `write:styles` anywhere on the site**, it
  warns that a page the agent writes there may carry scripts and styles that every reader runs
  ([§7](#7-security)).
- **The scope grid gains its MCP row** ([§4.2](#42-personal-access-tokens-are-the-credential)), with
  a hint saying that read keeps an assistant read-only whatever the other rows allow.
- **OAuth grants are listed with the rest**, under the client's name and marked as a connection
  rather than a token, with the same delete. There is nothing of theirs to copy.
- Otherwise the expiry, list and delete are the ones the page already has.

### 8.3 Elsewhere

- **`GET /system/info`** returns `isMCPEnabled`, which lights the sidebar.
- **The group editor** offers `use:mcp`.
- **Page history and the page itself** show an **AI** badge beside the author of a version made
  through MCP, off `pageHistory.via` ([§5.4](#54-contributing-to-the-wiki-goal-2)) — the history list
  for every such version, the page's last-edited line when the latest one is — while
  `mcp.showAiBadge` is on. The page payload and the history route carry `via` either way; the setting
  decides whether the frontend draws it.
- **The OAuth consent screen**, a frontend route outside the admin and profile layouts, as the login
  screens are ([§4.3](#43-oauth-21)).
- **Admin → Users**, in the user editor: already lists the user's tokens and deletes one
  (`manage:users`, subject to `systemUserGuard`) — which is where an administrator looks when an
  account is compromised. It gains a line saying whether the user holds `use:mcp`, since that decides
  whether those tokens do anything on `/_mcp`.

---

## 9. Suggested order

1. **Foundation**: `use:mcp` in the group editor and `CLAUDE.md`; the `mcp` scope category, backend
   and frontend; the instance-wide `mcp` settings blob and `models/mcp.ts`; the bearer hook admitting
   personal tokens on `/_mcp` and deferring their scope check to it; `api/mcp.ts`; the `updateMcp`
   audit action; `isMCPEnabled` in `system/info`. No token migration — the token table exists.
2. **Goal 1, a read-only server**: `controllers/mcp.ts` with the `discover`, `pages`, `history` and
   `glossary` read tools over the hand-written protocol layer, the per-tool scope check at
   `tools/list` and `tools/call`, the common page fields with `url`, `get_page` by URL with outline
   and sections, result caps, the server instructions with the agent guidelines page, the token
   bucket and the Origin check. Useful on its own, and the first thing most deployments will turn on.
3. **The screens**: the connect card on Profile → Access Tokens, then `/_admin/mcp`, with their
   `en.json` strings.
4. **Goal 2, contributing**: the `history-via` migration, the AI badge and its setting; then
   `suggest_edit` and `post_comment` with annotations, which work on any instance; then
   `create_page` / `update_page` — `baseVersionId`, `str_replace` edits, the required reason, the
   broken-link report, render queue integration with the owner's script and style permissions,
   "unavailable" without the Puppeteer extension, the collab `saved` relay — and the glossary
   writes. The Contributions card on `/_admin/mcp`.
5. **Assets and `destructive`**, last of the tools.
6. **OAuth 2.1**: the `/.well-known/` metadata, client registration, authorize with the consent
   screen, the token endpoint with refresh rotation, the `oauth-grants` migration, and grants in the
   profile's list. Last because the bearer path is complete without it; it is what claude.ai and
   ChatGPT need.

Verification per phase: `npm run typecheck`, `npx oxlint`, and a scripted MCP handshake —
`initialize`, `tools/list`, a `tools/call` — against a throwaway instance, with a token made through
`POST /users/profile/tokens` from the scripted login. Phase 4 is the one that earns a real
save-and-render run — and the check that matters for goal 2 is the round trip: a page written through
`create_page` is found by `search_pages` once its render lands.
