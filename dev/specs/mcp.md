# MCP — the wiki as a Model Context Protocol server

**Status:** built. Every phase of [§9](#9-suggested-order) is in — the read-only server (goal 1),
the screens, contributing (goal 2), assets, moving and deleting pages, and OAuth 2.1 for the remote
connectors. [§2](#2-what-exists-today) says exactly what is, and what is left.
The credential is the personal access token ([§4](#4-identity-and-tokens)). A name, path or payload
shape below that does not exist yet is illustrative.
**Covers:** what an MCP server built into Wiki.js would expose, how it authenticates and authorizes a
client, what it costs, what it risks, and the admin screen at `/_admin/mcp`.

The [Model Context Protocol](https://modelcontextprotocol.io) is how an AI client — Claude Code,
Claude Desktop, VS Code, Cursor, claude.ai and ChatGPT connectors — is given tools and content from
somewhere else. A wiki is an obvious thing to plug in: it is where an organisation's knowledge
already is, and the question an agent most often cannot answer is "what does _our_ documentation say
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
- **An AI feature in the wiki itself.** This makes the wiki a _source and a destination_ for
  somebody else's agent. It does not put a model in the wiki, and nothing here summarises, embeds or
  rewrites content on the wiki's side.
- **Semantic search.** Goal 1 is served by the full-text search the wiki already has, made to answer
  well for an agent. Embeddings and a vector index are a separate feature with costs of their own;
  if they come, `search_pages` is where they would surface, and nothing here assumes them.

---

## 2. What exists today

**Built** — phases 1 and 2 of [§9](#9-suggested-order), and the admin screen of phase 3:

| Piece                                                                                                                                                                                      | Where                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The endpoint: enabled check, Origin check, site, credential, rate limit, JSON-RPC over `POST`; 405 on `GET` and `DELETE`                                                                   | `controllers/mcp.ts`, registered at `/_mcp`; `_mcp` in `SERVER_ROUTE_SEGMENTS`                                                                                                                                  |
| The protocol: `initialize` (version negotiation, instructions), `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, `resources/read`, batches, notifications | `mcp/protocol.ts`                                                                                                                                                                                               |
| Who a call acts as, built from the token alone, and the page questions asked of that actor                                                                                                 | `mcp/context.ts`                                                                                                                                                                                                |
| Resolving a page by id, URL or path; reading it as source or as rendered markdown; outline, sections, windows                                                                              | `mcp/content.ts`                                                                                                                                                                                                |
| The tool contract, results and `ToolError`                                                                                                                                                 | `mcp/tool.ts`                                                                                                                                                                                                   |
| The read tools: `discover`, `pages`, `history`, and `glossary`'s reads                                                                                                                     | `mcp/tools/{discover,pages,history,glossary}.ts`                                                                                                                                                                |
| The registry: load-time checks, Ajv validation, the scope and group check shared by `tools/list` and `tools/call`                                                                          | `mcp/tools/index.ts`                                                                                                                                                                                            |
| Settings, instance-wide                                                                                                                                                                    | `models/mcp.ts`; defaults in `base.yml` under `mcp`                                                                                                                                                             |
| Settings API: `GET`/`PUT /system/mcp`, `GET /system/mcp/status` (API switch, token switch, renderer), all `manage:system`                                                                  | `api/mcp.ts`, `api/schemas/mcp.ts`                                                                                                                                                                              |
| The in-memory rate limiter                                                                                                                                                                 | `helpers/tokenBucket.ts`                                                                                                                                                                                        |
| The `use:mcp` permission                                                                                                                                                                   | `GLOBAL_PERMISSIONS` in `models/groups.ts`; offered in `GroupEditOverlay.vue`                                                                                                                                   |
| The `mcp` token scope category                                                                                                                                                             | `TOKEN_SCOPE_CATEGORIES` in `models/personalTokens.ts` and `frontend/src/helpers/personalTokens.js`                                                                                                             |
| The bearer hook letting a personal token through to `/_mcp`, and `WWW-Authenticate` on a refused one                                                                                       | `index.ts`                                                                                                                                                                                                      |
| `isMCPEnabled` in `GET /system/info`, and the sidebar light (amber while the API is off)                                                                                                   | `api/system.ts`, `layouts/AdminLayout.vue`, `stores/admin.js`                                                                                                                                                   |
| The `updateMcp` audit action                                                                                                                                                               | `models/auditLog.ts`                                                                                                                                                                                            |
| Admin → MCP: switch, endpoint and Claude Code setup, tool groups, prerequisites, access, safety, display                                                                                   | `pages/AdminMcp.vue`                                                                                                                                                                                            |
| Small model additions the tools needed                                                                                                                                                     | `pages.idAtPath`, `pages.searchTextOf`, `pageHistory.latestVersionId`; `resolvePagePath` exported from `helpers/appShell.ts`; `htmlToMarkdown` moved out of `models/import.ts` into `helpers/htmlToMarkdown.ts` |

Verified against a throwaway instance with a scripted client: the handshake, every read tool, the
refusals (no token, bad token, no `mcp` scope, system key, owner without `use:mcp`, foreign Origin,
unsupported protocol version), a tool group switched off, anonymous access, the rate limit, and that
a signed-in session cookie without a token is treated as no credential at all.

**Built in phases 3 and 4:**

| Piece                                                           | Where                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The agent guidelines page: a per-site path, in its instructions | `mcp` in the site's config (migration `mcp` adds it to existing sites), `models/mcp.ts` (`guidelinesPathFor`, `setGuidelinesPath`), `GET`/`PUT /sites/:siteId/mcp` (`manage:sites`), `guidelinesFor` in `mcp/protocol.ts` |
| The write tools: `create_page`, `update_page`                   | `mcp/tools/edit.ts`                                                                                                                                                                                                       |
| `suggest_edit`, `list_comments`, `post_comment`                 | `mcp/tools/contribute.ts`                                                                                                                                                                                                 |
| `define_term`, `update_term`                                    | `mcp/tools/glossary.ts`                                                                                                                                                                                                   |
| Calling a REST route in-process, as the caller                  | `mcp/inject.ts`                                                                                                                                                                                                           |
| The "via mcp" scope every call runs in                          | `helpers/via.ts`, opened in `controllers/mcp.ts`; read by `helpers/audit.ts` and `pageHistory.record`                                                                                                                     |
| `pageHistory.via`                                               | `db/schema.ts`, migration `mcp`; `via` on history entries, `editedVia` on the page payload                                                                                                                                |
| The AI badge and its switch                                     | `pages/Index.vue` (last-edited line), `components/PageHistoryOverlay.vue`; `showAiBadge` on the site payload (`api/bootstrap.ts`, `api/sites.ts`)                                                                         |
| The tag checks a page update makes, shared with the REST route  | `retagRefusal` in `api/pages.ts`                                                                                                                                                                                          |
| Contributions: what assistants wrote lately                     | `pageHistory.listByVia`, `GET /system/mcp/contributions` (`manage:system`), the card on Admin → MCP                                                                                                                       |
| Profile → Access Tokens: the Connect an AI Assistant tab        | `pages/ProfileTokens.vue`, with `mcp` flags on `GET /users/profile/tokens`; the create dialog's presets (`PersonalTokenCreateDialog.vue`); the client setup in the copy dialog (`ApiKeyCopyDialog.vue`)                   |
| Client setup for Claude Code, VS Code and Cursor                | `helpers/mcpClients.js`, `components/McpConnectSnippets.vue`, used on both screens                                                                                                                                        |

Verified the same way, with a second script: the render round trip (a page written through
`create_page` is found by `search_pages` once the renderer has been through it), stale and unmatched
edits, the broken-link report, `via` on the history, the page and the audit entry, a human edit
clearing `editedVia`, a reader without `write:pages` sent to `suggest_edit` and a suggestion
reaching its reviewer, a comment with an annotation and the posting cooldown through MCP, glossary
writes with their name clash and stale-save refusals, the guidelines page in the instructions, the
contributions list, and `mcp:read` hiding every write tool from a token that holds `pages:write`.

**Built in phases 5 and 6:**

| Piece                                                                     | Where                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_assets`, `get_asset` (images as MCP image content), `upload_asset`  | `mcp/tools/assets.ts`; `ImageContent` in `mcp/tool.ts`; raw bodies through `callApi`                                                                                                                                          |
| `move_page`, `delete_page`                                                | `mcp/tools/destructive.ts`                                                                                                                                                                                                    |
| The OAuth authorization server: discovery, registration, authorize, token | `controllers/oauth.ts`, `models/oauth.ts`; `oauthClients` and `oauthCodes`, and `clientId` / `refreshHash` on `personalTokens` (migration `mcp`); `.well-known` in `RESERVED_ROOT_FILES`, `_oauth` in `SERVER_ROUTE_SEGMENTS` |
| The consent screen                                                        | `pages/OAuthConsent.vue` at `/_authorize`; `GET`/`POST /oauth/authorize` in `api/oauth.ts`                                                                                                                                    |
| Grant tokens confined to `/_mcp`                                          | `oauthClientId` on `ApiKeyIdentity`; the bearer hook in `index.ts`                                                                                                                                                            |
| `WWW-Authenticate` naming the resource metadata                           | `controllers/mcp.ts`, `index.ts`                                                                                                                                                                                              |
| Grants in the profile's list, as connections                              | `client` on `PersonalToken`; `PersonalTokenList.vue`                                                                                                                                                                          |
| OAuth clients on Admin → MCP                                              | `GET /system/mcp/clients`, `DELETE /system/mcp/clients/:clientId` in `api/oauth.ts`; the card in `AdminMcp.vue`                                                                                                               |
| Purging unused clients and expired codes                                  | `tasks/simple/purge-oauth.ts`, hourly off `SYSTEM_SCHEDULE`                                                                                                                                                                   |
| The `grantOAuthAccess` and `deleteOAuthClient` audit actions              | `models/auditLog.ts`                                                                                                                                                                                                          |

Verified with a third script: uploads (an image, a text file, a page extension refused by the route),
listing, an image returned as an image block and a text file as text, a page moved and then deleted
into the bin with the deletion audited `via: mcp`, the destructive switch hiding both tools; and the
whole OAuth flow — the 401 challenge, both metadata documents, a refused and an accepted
registration, authorize redirecting to consent, an unregistered redirect URI answered in the browser,
missing PKCE and a foreign resource told through the redirect, consent needing a session, deny,
approve with `state` and `iss`, a wrong verifier spending the code, single use, the grant's token
working on `/_mcp` and refused on `/_api`, the grant listed as a connection, refresh rotation, a
reused refresh token revoking the grant and its access token with it, and an admin deleting the
client. The consent page was looked at in both themes, signed out (sent to login and back) and in.

**Not built**:

- The **Usage** card on Admin → MCP, which was optional ([§8.1](#81-admin--mcp)).
- The **`write:scripts` / `write:styles` warning** on the profile's connect card ([§8.2](#82-profile--access-tokens)).
- **Contributions listing suggestions**, which do not record how they were made.
- **Writing an agent's edit into an open collaboration room**, which `update_page` refuses instead
  ([§6.4](#64-live-editors)).
- **CORS on the OAuth and MCP endpoints**, which only a client running in a browser would need.
- A **note under the token dialog's MCP row** while MCP is disabled on the instance.
- The **docs page** the admin screen links to (`siteStore.docsBase + '/dev/mcp'`).

----- | ----- | -------- |
| Asset listing, reading and upload | `models/assets.ts`, `api/assets.ts` | The `assets` tools |
| Moving and deleting pages | `pages.movePage`, `pages.deletePage`, the routes in `api/pages.ts` | The `destructive` tools |
| JWT signing and verification | `helpers/jwt.ts` | OAuth access tokens, [§4.3](#43-oauth-21) |

----- | ----- | -------- |
| A page actor from a request | `actorFrom` in `api/pages.ts`, which takes a token's owner since `206804fb` | Writes |
| Links both ways | `pageLinks` | The broken-link report on a write |
| Reason for change | `pageHistory.reason`, the git target's commit message | The reason every write requires |
| Watch notifications | `notifications.emit` from the models (`watchedPage`) | People hearing about agents' edits |
| Glossary editing | `models/glossary.ts` (`create`, `update`) | `define_term`, `update_term` |
| Comments with annotations | `models/comments.ts`, `commentAnnotations` | `post_comment` |
| Headless render queue | `pages.queueRerender`, `models/rendering.ts` (Puppeteer extension) | Pages an agent writes |
| Approvals / suggestions | `models/approvals.ts`, `api/approvals.ts` | `suggest_edit` |
| JWT signing and verification | `helpers/jwt.ts` | OAuth access tokens, [§4.3](#43-oauth-21) |

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
- **Out of the SEO hook's way**: its first segment starts with `_`, which `isPageUrl` never takes for
  a page, so nothing about `/_mcp` gets a locale prefix or a trailing-slash redirect. And `_mcp` is
  in `SERVER_ROUTE_SEGMENTS`, so a mistyped path under it answers as the endpoint, not as the app.
- **The session cookie is ignored.** The session plugin still runs, but nothing a tool asks goes
  through the request helpers in `api/pages.ts` (which fall back on the session when there is no
  key): `mcp/context.ts` builds the actor from the token, or the public's actor when there is none.

**Written by hand, not with `@modelcontextprotocol/sdk`.** The SDK would bring `zod` and, in v1,
express and a handful of other packages into a Fastify backend, for a protocol whose stateless subset
is small: JSON-RPC 2.0 framing and batching, `initialize` (with protocol version negotiation and the
server `instructions`), `ping`, `tools/list`, `tools/call`, `resources/templates/list` and
`resources/read`, and the JSON-RPC error codes. That is an ordinary Fastify route and a dispatch
table. Tool input schemas are plain JSON Schema — which is also what `tools/list` has to publish, so
they are written once — validated by Ajv, the copy Fastify already carries: `ajv` is now declared in
`backend/package.json` at the version Fastify resolves (8.20.0), rather than imported as somebody
else's nested dependency, so nothing new is installed. The same goes for OAuth
([§4.3](#43-oauth-21)): PKCE is a SHA-256 comparison and the tokens are JWTs `helpers/jwt.ts`
already signs. The rule for the whole feature is that a dependency comes in only where writing the
thing would be a real project of its own, and nothing here so far is.

### 3.2 Where the code lives

| Path                                      | What                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controllers/mcp.ts`                      | The endpoint: enabled check, Origin check, site, credential, rate limit, then dispatch                                                                                                                                                                                                              |
| `mcp/protocol.ts`                         | JSON-RPC framing, `initialize` and its instructions, the `tools/*` and `resources/*` methods, error codes, the result-size backstop                                                                                                                                                                 |
| `mcp/context.ts`                          | `McpContext` — who a call acts as — and the access questions asked of it: `mayOnPage`, `mayReadSource`, `mayBypassPassword`, `unpublishedFor`, `holdsScope`                                                                                                                                         |
| `mcp/content.ts`                          | Page resolution and reading, shared by the tools                                                                                                                                                                                                                                                    |
| `mcp/tool.ts`                             | `McpTool`, the result helpers, `ToolError`                                                                                                                                                                                                                                                          |
| `mcp/tools/*.ts`                          | Tool definitions — `discover`, `pages`, `history`, `glossary`, `edit`, and `contribute` (suggestions and comments) — plus `index.ts`, the registry. A tool calls the **models**, except where an action's rules live in its REST route rather than in a model, where it calls that route in-process |
| `mcp/inject.ts`                           | That in-process call: `app.inject` with the caller's token, host and address, inside their `withVia('mcp')` scope                                                                                                                                                                                   |
| `helpers/via.ts`                          | `withVia` / `currentVia`: the scope that marks everything a call leads to as done through MCP                                                                                                                                                                                                       |
| `helpers/tokenBucket.ts`                  | The in-memory rate limiter, [§7.1](#71-performance)                                                                                                                                                                                                                                                 |
| `models/mcp.ts`                           | The `mcp` settings blob (`getConfig` / `pickFields` / `validate` / `updateConfig`, as `models/scim.ts`), the group switches and the budget. No token code: issuing and resolving tokens is `models/personalTokens.ts`                                                                               |
| `api/mcp.ts`                              | The instance settings and status under `/system/mcp`, beside SCIM and metrics; the per-site setting under `/sites/:siteId/mcp`, and the site's contributions. Tokens are managed by the existing routes in `api/personalTokens.ts`                                                                  |
| `base.yml`                                | The `mcp` defaults. No seed row: `base.yml` is merged under the stored settings on every boot, so a fixed default needs nothing else                                                                                                                                                                |
| `index.ts`                                | The bearer hook admits `/_mcp` and leaves a personal token's scope check there to the controller ([§4.2](#42-personal-access-tokens-are-the-credential)); the controller is registered                                                                                                              |
| `controllers/oauth.ts`, `models/oauth.ts` | The OAuth 2.1 authorization server and the `/.well-known/` metadata, [§4.3](#43-oauth-21)                                                                                                                                                                                                           |
| `api/oauth.ts`                            | The consent screen's two calls, and the admin area's OAuth clients                                                                                                                                                                                                                                  |

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
  being created _and_ used, keeping the rows so that turning it back on restores them. Neither needs
  any permission beyond what those screens already take. Creating a token needs no permission at all.

### 4.2 Personal access tokens are the credential

**`/_mcp` authenticates with a personal access token and nothing else.** There is no MCP-specific
token, no second table, no `kind` column on `apiKeys`, and no MCP audience. A client is configured
with `Authorization: Bearer <token>`, and the token is one its owner made under **Profile → Access
Tokens** like any other.

- **A token reaches `/_mcp` only if it holds the `mcp` scope.** `mcp` joins
  `TOKEN_SCOPE_CATEGORIES`, at read or write like every other, and is the one category that names a
  _surface_ rather than an area of the wiki: no `/_api` route declares it, and every tool requires it
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
  `en.json`). `TOKEN_SCOPES`, and so the `PersonalTokenScope` enum the API validates against, follow
  from the list. A note under it while MCP is disabled on the instance is not built yet; the hint is
  the same either way.
- **A tool declares a category, as a route does.** `search_pages` is `pages`, `post_comment` is
  `comments`, `suggest_edit` is `approvals`. The level comes from the tool's `readOnlyHint` the way a
  route's comes from its method — read-only tools need `read`, the others `write`, of both `mcp` and
  the category — and `requiredScope` / `grantsScope` answer each of the two unchanged. A tool with no scope
  cannot exist; that is enforced where tools are registered, not left to review.
- **The bearer hook lets a personal token through to `/_mcp`.** It checks a route's `config.scope` in
  `onRequest` and refuses a personal token anywhere but `/_api` and `/_mcp`. `/_mcp` is one route
  carrying many tools, so the hook admits the token there without a scope check, and the check
  happens per tool in `mcp/tools/index.ts` — at `tools/list` as well as `tools/call`, so a token is
  never shown a tool it may not call and a client does not offer the model something that will only
  be refused. What the controller asks first, once per request: a personal token rather than a
  system key, an owner holding `use:mcp`, and some `mcp` scope at all — each refused with a 403 that
  says which. A token that fails verification is a 401 carrying `WWW-Authenticate`, as is a request
  with no token while anonymous access is off.
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
is complete without it, not because it is optional. Built as described below; `models/oauth.ts` is
the flow and `controllers/oauth.ts` the endpoints. Nothing of it exists unless MCP, the API and
personal tokens are all on (`oauth.isAvailable`) — it would hand out grants nothing could use — and
everything is in the database, so any instance of an HA set answers any step.

**An OAuth grant is a personal access token made by a consent screen** instead of by the create
dialog. Same table, same owner, same scopes, same `verifyClaims` on every call; listed under
**Profile → Access Tokens** with the client's name, and deleted from there like any other. What it
adds:

- **Discovery.** Protected-resource metadata (RFC 9728) at `/.well-known/oauth-protected-resource`,
  naming the site's own origin as the authorization server, and a 401 from `/_mcp` that carries
  `WWW-Authenticate: Bearer resource_metadata="…"` pointing at it. Authorization-server metadata (RFC 8414) at `/.well-known/oauth-authorization-server`. Both per hostname, since the site is the
  hostname's. `.well-known` joins `RESERVED_ROOT_FILES`, so the SEO hook never sends a client asking
  for one to a locale prefix.
- **Dynamic client registration** (RFC 7591) at `/_oauth/register`, which is how the connectors
  introduce themselves. A registered client is inert — it can do nothing until a person consents —
  so registration is open, rate limited per address (20 an hour, on the postgres-backed counter, since
  registration is rare and must agree across instances), and a client that no grant ever named is
  purged after a day (`purgeOauth`, hourly). Clients live in a new `oauthClients` table: name,
  redirect URIs, created. Public clients only: whatever authentication method a client asks for, it
  is registered as `none`, and PKCE is what protects the code. A redirect URI is `https`, `http` on a
  loopback address (RFC 8252 §7.3), or a native app's own scheme — never a scheme a browser would
  run or read from disk — with no fragment, at most ten.
- **Authorization** at `/_oauth/authorize`: authorization code with PKCE, `S256` only, and an exact
  match on a registered redirect URI. What is wrong with the client or its redirect URI is answered
  to the person in the browser, never by redirecting to an address the request named; anything else
  is told to the client through its redirect URI, as RFC 6749 §4.1.2.1 says. A request that checks
  out goes on to the **consent screen**, a frontend page at `/_authorize` (under `_`, so not a page
  path, and not under `_oauth`, which is the server's), which asks the API to check the request again
  before it shows it — what the screen shows and what a code is made from are then the same request.
  No session sends the person through the wiki's own login first and back. The screen names the
  client, the host it will send the browser back to and the account it will act as, and shows the
  scope grid prefilled from the requested `scope` — or the read-only default (`mcp:read`,
  `pages:read`, `glossary:read`) when the client asked for none, which the connectors do. The person
  may change any row: the client's request is where the grid starts, and the person is the one
  granting. `mcp` is offered at read or write only, since a grant is for the MCP server and one
  without the scope could reach nothing. Then the grant's lifetime, from the token expirations. A
  person without `use:mcp` is told so and offered only Deny. The answer goes back with `state` and
  `iss` (RFC 9207). The code is random, kept only as a hash, ten minutes, single use
  (`oauthCodes`).
- **Tokens** at `/_oauth/token`, form-encoded as RFC 6749 says, JSON accepted too. The code is
  deleted as it is read, so it is spent once even when two exchanges race, and a failed check spends
  it as well. The grant is created then — not at consent — as a `personalTokens` row named after the
  client. An access token is a JWT with the personal-token audience naming the grant's row, valid for
  an hour. A refresh token is `<grant id>.<secret>`, the secret stored only as a hash on the row and
  rotated on every use (a compare-and-swap, so two racing refreshes cannot both succeed), as OAuth
  2.1 requires for public clients. A refresh token whose grant exists but whose secret is not the
  current one has been used before, so the grant is deleted — one of the two presenters stole it —
  and with it every access token it issued. The row's `expiration` is the grant's lifetime, beyond
  which no refresh succeeds. Errors are RFC 6749 §5.2's shape.
- **Resource binding** (RFC 8707): the `resource` parameter, where a client sends it, must name this
  site's `/_mcp`, and a token from a grant is accepted on `/_mcp` and nowhere else — the bearer hook
  refuses it on `/_api` (`oauthClientId` on the verified key). A connector asked for an MCP server,
  and that is all it gets, whatever the scopes would reach. A grant is the user's rather than a
  site's, as every personal token is, so it works on the `/_mcp` of every site of the instance.
- **Schema.** `personalTokens` gains a nullable `clientId` (to `oauthClients`, on delete cascade) and a
  nullable `refreshHash`; migration `mcp`. A row with no client is a token made by hand, and
  everything that exists today keeps working unchanged.
- **Written by hand**, per [§3.1](#31-transport-stateless-streamable-http-at-_mcp): the flow is four
  endpoints, a hash comparison and the JWT signing the wiki already does.

### 4.4 One new global permission

| Permission | Grants                                                                                                                                                                        | Elevated? |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `use:mcp`  | Using the MCP endpoint. Checked on the token's owner at every call, so taking it away stops that user's tokens on `/_mcp` on the next one, and leaves them working on `/_api` | No        |

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
- **Anonymous access is a setting, `mcp.allowAnonymous`**, off by default. With it on, a request
  carrying no token is answered as the guests group: its page rules, no group-wide permission, and
  no session (the cookie is ignored here as everywhere on `/_mcp`). It is not a grant of `use:mcp`
  to the guests group, which was the first design and cannot work in this codebase: an anonymous
  request never carries the guests group's group-wide permissions (`actorForRequest` gives it none,
  and `actorForPublic` none on purpose), and the group editor offers the guests group no Permissions
  tab at all. With no token there are no scopes, and an anonymous caller is treated as holding
  `mcp:read` and **read** on every category, and **write** on none — a public endpoint that writes is
  a spam channel, whatever the guests group's rules would allow. Anonymous access does not need
  `api.isEnabled` or `auth.allowPersonalTokens`, since no token is verified, and it is rate limited
  per address.
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
2. **`use:mcp`** — held by the token's owner, or `mcp.allowAnonymous` on for a caller with no token
   ([§4.4](#44-one-new-global-permission)). Asked once per request, in the controller, before any
   message is dispatched.
3. **The token's scopes** — `mcp` and the tool's category, both at `read` for a read-only tool and
   at `write` otherwise ([§4.2](#42-personal-access-tokens-are-the-credential)). An anonymous caller
   holds `mcp:read` and every category at read, and nothing at write.
4. **The page permission** — `checkAccess` for each page the tool touches, with the owner's groups.

### 5.2 The tools

| Group         | Tools                                                                 | Scope             | Page permission                            | Default |
| ------------- | --------------------------------------------------------------------- | ----------------- | ------------------------------------------ | ------- |
| `discover`    | `search_pages`, `browse_tree`, `list_tags`, `recent_changes`          | `pages:read`      | `read:pages`                               | on      |
| `pages`       | `get_page`; `get_page_links`, `get_backlinks`                         | `pages:read`      | `read:pages`, `read:source` for the source | on      |
| `history`     | `list_versions`, `get_version`, `diff_versions`                       | `pages:read`      | `read:history`                             | on      |
| `glossary`    | `lookup_term`, `list_terms`                                           | `glossary:read`   | `read:glossary`                            | on      |
|               | `define_term`, `update_term`                                          | `glossary:write`  | `manage:glossary`                          |         |
| `comments`    | `list_comments`                                                       | `comments:read`   | `read:comments`                            | on      |
|               | `post_comment`, with optional annotations                             | `comments:write`  | `write:comments`                           |         |
| `suggest`     | `suggest_edit` through the approvals flow                             | `approvals:write` | the site's approval rules                  | on      |
| `edit`        | `create_page`, `update_page`                                          | `pages:write`     | `write:pages`, `write:tags` for tags       | on      |
| `assets`      | `list_assets`, `get_asset` — images as MCP image content, size-capped | `assets:read`     | `read:assets`                              | off     |
|               | `upload_asset`                                                        | `assets:write`    | `write:assets`                             |         |
| `destructive` | `move_page`, `delete_page` (to the recycle bin)                       | `pages:write`     | `manage:pages`, `delete:pages`             | off     |

Every tool needs `mcp` at the same level as well as the scope in the table, so a read tool needs
`mcp:read` and a write tool `mcp:write`. Each tool's category is the one the `/_api` route doing the
same thing declares — history is `pages` there, suggestions are `approvals` — so a token reaches the
same things on both surfaces. A tool's level and its `readOnlyHint` annotation are the same fact,
declared once (`readOnly` on `McpTool`). The registry refuses to load a tool with no category or in
no known group, so neither can be forgotten.

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

- **Every tool carries annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint`, and
  `openWorldHint: false`, since nothing here reaches past this wiki — so that a client can ask before
  running the dangerous ones.
- **Every page in a result is named the same way** (`pageFields` in `mcp/content.ts`): `id`,
  `title`, the absolute `url` (`pages.urlFor` on the request's origin, as the canonical link in
  `helpers/appShell.ts` is composed), `locale`, `path`, and `description`, `tags` and `updatedAt`
  where there are any. `get_page` adds the current `versionId` — the newest `pageHistory` row, which
  is the page as it stands — and so will every write's answer; a search result does not carry one,
  since that would be a query per result for something only a write needs. That is what makes an
  answer citable and a later write against it safe.
- **Two kinds of failure.** A refusal the agent can act on — no such page, not allowed, a heading
  that is not there — is the tool's result with `isError` set (`ToolError`), which is what the MCP
  specification asks for: the model reads it and tries something else. A malformed call — bad
  arguments, an unknown method — is a JSON-RPC error. A tool the caller may not call answers exactly
  as an unknown tool does, since it is not in the list they were given. "Not there", "not live" and
  "not yours to read" are one message, as everywhere else on the wiki.
- **A tool not applicable to the site is not listed** (`isAvailable` on `McpTool`, asked by the same
  `mayCall`): the glossary tools where the site's glossary is off, the comment tools unless the site
  has comments on and uses the built-in provider.
- **Arguments are checked** against the published schema by Ajv, defaults filled in, and an
  undeclared argument is an error rather than silently dropped.
- **Resources**: a `wiki://{locale}/{path}` resource template backed by `get_page`, so a client can
  offer pages to @-mention. No resource _listing_: a large wiki is too many to enumerate.
- **Prompts**: none in the first version.
- **Server instructions.** The `initialize` result carries `instructions`, which a client puts in front
  of the model: what this wiki is (the site's title and description), its locales, how to cite
  (link the `url`), who the agent is acting as, and how to contribute (search first, update rather
  than duplicate, give a reason). Only what the caller can act on: a line about a tool is there only
  when the caller may call that tool, so a read-only token is never told how to write. Then the
  site's own conventions, from an **agent guidelines page** the administrator names
  ([§8.1](#81-admin--mcp)) — an ordinary page, so it is written, reviewed and improved like any
  other, by people and by agents. Its text is included up to a cap; the rest is a `get_page` away.
  Built, guidelines page and contributing lines included.

### 5.3 Referring to the wiki (goal 1)

What an agent needs in order to answer from the wiki rather than from its own memory: find the right
page without knowing the tree, read the part that matters, and say where it came from.

- **`search_pages`** is `search.searchPages` with the actor, so its ranking and its rule filtering
  are the search page's. It takes the text, a path prefix, tags (all or any), and locales — every
  active locale of the site when none is given, since an agent does not know which one a topic was
  written in. Each result adds a `snippet` (the `ts_headline` the search route already computes) to
  the common page fields, so the agent can tell a real match from a passing mention without opening
  it. Paged with `offset` / `limit` (at most 25, against the REST API's larger ceiling), with a
  `nextOffset` while there is more. A result count is only ever a count of pages the owner may read,
  because `searchPages` filters by page rule before it pages. Without a query it lists the pages
  matching the filters, newest first.
- **`browse_tree`** answers the shape of a section: the folders and pages under a path, with titles
  and URLs, `depth` levels down (at most 3, and at most 300 entries in all). `tree.browse` per level,
  filtered by `read:pages` as the browse route filters it, and refused where the site has turned
  browsing off (`features.browse` and `features.listFolderChildren`), since the route is. It is how an
  agent finds where things live, and, for goal 2, where a new page belongs.
- **`get_page`** takes an `id`, a `path` with a `locale`, or a **`url`** — an agent is usually handed
  a link. A URL may be absolute or a path from the site root; it is read as the frontend router reads
  one (`resolvePagePath`, exported from `helpers/appShell.ts` for this): decoded, page extension and
  locale prefix taken off, normalized. One on any other host is refused, not followed. The page is
  then looked up by its exact path (`pages.idAtPath`) rather than by the 53-bit hash `getPage`
  addresses a page with, for the reason `describePage` gives. The access questions are the page
  route's — `read:pages`, the source only with `read:source` (or a permission implying the editor),
  a page that is not live only for whoever may edit it — asked of the token's actor. It answers in
  two blocks:
  - **metadata, as JSON**: the common fields, plus `versionId`, `createdAt`, the publish state, the
    editor, the last editor's name (only where the page's own `showLastEditedBy` is on), whether the
    page is locked, its translations with their URLs (so an agent can switch to the reader's
    language), the **outline** — the stored `toc`, flattened, each heading with its level and anchor —
    and where the content block starts, how long the whole is and the `nextOffset` to carry on from;
  - **the content, as text**: all of it up to `mcp.maxResultChars`, one `section` (by anchor or by
    heading text, read off the text itself so that it works on source and render alike, fenced code
    skipped), or an `offset` / `length` window. With source access, the source as written — markdown
    or AsciiDoc. Without it, the stored render converted to markdown with Turndown (`helpers/htmlToMarkdown.ts`,
    shared with the 2.x importer). A drawing is its extracted text (`pages.searchTextOf`, the same text
    search indexes), since an SVG scene means nothing to a model. An empty render says it may be
    waiting for the renderer.
  - A **redirection** is followed, once, within the site, and the answer says it was; one to an
    outside URL, or to a page the caller may not read, is reported rather than followed.
  - A **password-protected** page answers with its metadata and a note, and no content, unless the
    caller may edit it.
- **`get_page_links` / `get_backlinks`** read `pageLinks` both ways, so an agent can follow a topic
  to its neighbours — and, for goal 2, find every page that will be wrong once the one it is fixing
  changes. Filtered as the REST routes filter: a link to a page the caller may not read is a link to
  nothing (`exists: false`), and a backlink from such a page is not listed. Backlinks from another
  site of the instance are left out too, where the REST route includes them: an agent sees one site.
  `get_backlinks` honours the site's `features.backlinks` switch.
- **`recent_changes`** lists the pages the owner may read, most recently updated first, filterable by
  path and locale — `searchPages` ordered by `updatedAt`, so a page excluded from search is not
  listed. It is what an agent asks "what changed in the runbooks this week", and what tells it a
  page it read earlier in a long task has moved on.
- **`list_versions` / `get_version` / `diff_versions`** let an agent answer "when did this change and
  why" from the history's own `reason` and author (by name — the history route also sends an
  email, which an agent has no use for), and check what a page said before an edit it suspects.
  `read:history` on the page as it stands, and not past its password. `diff_versions` is a unified
  diff (`createTwoFilesPatch`), against the current version when no `toVersionId` is given. A version
  of a page in the recycle bin is not reachable: the bin is the file manager's.
- **`list_assets` / `get_asset`** (the `assets` group, off by default) list a folder's files, with
  their type, size and `/_files/` link and the sub-folders to look in next, and read one: a PNG,
  JPEG, GIF or WebP up to 1 MB comes back as MCP image content, which a model can look at; a text type
  (markdown, CSV, JSON, SVG and the like) up to the result cap as text; anything else as details and
  a link. Through the models, `read:assets` on the file's own path as the asset routes ask it — not the
  tree route, which is scoped `pages`.
- **`lookup_term`** resolves a name or an alias in a locale (`glossary.lookup`, case rules and all) to
  its definition, related terms and the page that documents it — that page resolved as the caller
  may read it, since the glossary itself reports its title to whoever may read the glossary.
  **`list_terms`** lists a locale's terms without definitions, filterable by category and by text. A
  wiki's glossary is where its own vocabulary is defined, which is exactly what a model gets wrong by
  guessing. `read:glossary` in the locale, and the site's glossary switch.
- **Freshness is in the answer, not left to the agent to ask for.** `updatedAt` is on every page in
  every result, the last editor on `get_page` where the page shows it, and the server instructions
  tell the agent to say when what it is relying on is old.

### 5.4 Contributing to the wiki (goal 2)

What it takes for an agent's writing to make the wiki better rather than noisier: write to the
right place, change only what it means to change, say why, and leave something people can review.

**The workflow the tools steer towards** — and the server instructions spell out — is search, read,
then update what exists or create what does not. Each tool's answer is built to make the next step
the right one:

- **`create_page`** takes a path (`normalizeNewPagePath`), a locale, a title, a description, an icon and
  its color, tags and markdown. A path that is already taken is refused **with the page that holds it** — its URL and
  id, where the caller may read it — so the agent updates that instead of inventing `runbook-2`. The
  create route's checks follow: `write:pages` on the page as it is about to be, and `write:tags` for
  any tags it arrives with. It is created in the `markdown` editor and in the publish state the
  administrator chose for agent pages ([§6.5](#65-locked-and-unpublished-pages)), then queued for
  rendering (`pages.queueRerender`).
- **An icon is checked the way the icon picker stores one** (`icons.materializeIcons`), on both
  write tools: a reference the wiki cannot show — malformed, from a set that is not enabled, unknown
  upstream — is refused rather than saved as a blank, and one that can be shown is stored so it is
  served without the Iconify API afterwards. The descriptions steer an agent to the `mdi` and `la`
  sets without refusing others, and to leave `iconColor` (a `PAGE_ICON_COLORS` name) at its default
  unless the person it works for asked for a color.
- **`update_page`** requires the `baseVersionId` the agent read, and refuses a stale one with the
  current version rather than merging ([§6.4](#64-live-editors)) — so a correction is always made
  against what the page says now. It takes either a list of `str_replace`-style edits, each of which
  must match exactly once, or the whole content. The edits are the form to prefer: fixing an
  outdated paragraph should change that paragraph and nothing else, and the diff a person reviews
  should be that small. An edit whose text is not in the source, or is in it more than once, is
  refused naming which edit it was. Title, description, icon, icon color and tags are separate fields; a change of tags
  goes through the update route's own checks (`retagRefusal`, now shared by both). Only a change of
  content queues a render. Refused for want of `write:pages` with a pointer to `suggest_edit` and
  `post_comment`, and refused while the page is open in the editor ([§6.4](#64-live-editors)).
- **Which pages can be written.** A page keeps its editor. Markdown and Visual pages (both markdown)
  and AsciiDoc pages are written as source. Drawings, redirections and blogs are refused: a scene
  document and a settings document are not prose, and an agent should not be rewriting either.
- **A reason is required on every write**, whatever the site's `features.reasonForChange` says. It is
  stored as the version's `reason` — what the history shows and what the git target uses as the
  commit message — and it is how a person deciding whether to trust an agent's correction knows what
  it thought it was correcting.
- **The version is marked as made through MCP.** `pageHistory` gains a nullable `via` column
  (migration `mcp`), set to `mcp` for every version a call on `/_mcp` leads to. Not passed
  by each tool: the controller runs every call inside `withVia('mcp')` (`helpers/via.ts`, an
  `AsyncLocalStorage` scope), and `pageHistory.record` and the audit helper read it — which is also
  what marks the audit entry of a REST route the tools call in-process. It is **always recorded**; whether it is
  **shown** is the administrator's choice (`mcp.showAiBadge`, on by default —
  [§8.1](#81-admin--mcp)). Shown, an **AI** badge sits beside the owner's name on the version in the
  page's history and on the page's own last-edited line when the latest version is an agent's — the
  page payload's `editedVia`, read from the newest history row in the query `getPage` already makes,
  so a person's later edit clears it. The
  author is still the owner — they are the one accountable — but a reader is entitled to know which
  edits a person typed. Hidden, the column is still written, and the Contributions card and the audit
  log still read it.
- **The answer to a write** carries the new `versionId` and `url`, that the render is queued
  ([§6.3](#63-a-page-written-without-a-browser-has-no-render)), and **the links in the new
  content that reach no page the caller may read**, so a broken link is fixed in the same task
  rather than discovered by the next reader. Read off the source (`sourceLinkHrefs`, as the importer
  does) and resolved with `resolveLink`, not off the `pageLinks` rows: those are made from the
  render, which a page written here does not have yet. Links within the site only; assets are not
  checked.
- **People find out.** A write is a page edit, so everything an edit does happens: the version is in
  the history and can be restored, watchers get their `watchedPage` notification, the change shows
  in recent changes, storage targets mirror it and the git target commits it. Nothing about it is
  quieter than a person's edit.

**When the owner may not edit the page**, the agent still has two ways to contribute, and the tools
offer them rather than leave it at a refusal — `update_page` refused for want of `write:pages` names
both.

**These go through their REST routes, in-process** (`mcp/inject.ts`), and so do the glossary writes
below. What they enforce lives in the route rather than in a model — which approval rule takes a
suggestion, the posting cooldown, the spam check, the webhooks and notifications a comment sends,
the term routes' refusals — and a second copy of it in the tools would drift. `callApi` hands the
route the caller's own token, host and client address (so the cooldown and the audit entry name the
right person and address), never a cookie, and inside the caller's `withVia('mcp')` scope. A token
therefore reaches exactly what it reaches on `/_api`, by construction; the route's refusal comes back
as the tool's error, in the route's words.

- **`suggest_edit`** submits the change through the approvals flow, for the page's reviewers to accept
  or decline — the same edits-or-content input as `update_page`. It reads the source to edit from
  the "my suggestion" route, which is the caller's own open suggestion if they have one, so suggesting
  twice builds on the first. **No reason**: a submission has nowhere to keep one, and adding it is a
  change to approvals rather than to MCP; the description tells the agent to explain itself in a
  comment where the change does not. The suggestion is the owner's; the version an approval writes
  is the reviewer's, and is not marked `via`. A person reviews it, and the browser that approves it
  renders it, so this works without the renderer.
- **`list_comments`** reads the page's discussion, so an agent checks before flagging what is already
  flagged.
- **`post_comment`** flags a problem in the page's discussion — "this procedure no longer works since
  the v3 migration" — optionally **annotating the passages** it is about, so the people who can fix
  it see exactly what is wrong. An annotation is stored as a description of the article as drawn,
  which an agent reading markdown does not have, so the agent gives a `quote` and the tool builds the
  anchor: the quote is found in the page's extracted text (`searchContent`, whitespace folded) and the
  prefix, suffix and offset are taken from there, the heading left unset. A quote that is not in the
  page as readers see it is refused. Built-in comments only; elsewhere the tools are not listed.

**Also contributions**:

- **`define_term` / `update_term`** add to the glossary, under its existing rules: one name means one
  term (a clash is refused naming the term that holds it, which is the one to update), and an update
  names the `updatedAt` it read (`expectedUpdatedAt`) and is refused when somebody saved since. The
  term route replaces a whole term, so `update_term` fills in what the agent left out from what is
  stored; related terms are given by name and resolved to ids, a name with no term refused rather
  than dropped.
- **`upload_asset`** puts an image or a file into a folder, for documentation that needs a
  screenshot, and answers with the `/_files/` link to put in the page — the stored name, which the
  site's sanitizing and conflict rules may have changed. The bytes come as `base64`, or as `text` for
  a text file, at most 3 MB decoded, well inside the endpoint's body limit. Through the upload route
  in-process (`callApi` sends raw bodies), which is where `write:assets` at the destination, the
  reserved page extensions and the conflict behaviour are decided. A diagram is better written as a
  `mermaid` or `kroki` code block, which stays text a person can review — the tool's description says
  so, and `create_page`'s.

**Moving and deleting** (`destructive`) are not contributing and stay off until an administrator
turns them on: a reorganisation is a decision about the wiki, not knowledge added to it, and a move
rewrites links on pages the agent never read. Both are built (`mcp/tools/destructive.ts`), annotated
`destructiveHint`, and go through their REST routes in-process, which hold the checks
(`manage:pages` at both ends of a move, `delete:pages` for a deletion) and the work that follows:

- **`move_page`** takes a new path, optionally a new locale, and `updateLinks` (on by default): the
  pages linking to the old address are rewritten, and those that could not be — named only where the
  caller may read them — are listed with why.
- **`delete_page`** sends the page to the recycle bin, from which a person holding `delete:pages`
  restores it; its watchers are told. Both descriptions tell the agent to do it only when the person
  it works for asked.

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
is therefore saved with its source and queued; until the queue reaches it — seconds, in the tests —
readers see an empty page if it is new, and the previous render if it was updated: the same state an
imported page is in.

**For goal 2 this is the whole question, not a detail.** `searchContent` — what full-text search
indexes — is extracted from the render (`rendering.postProcess`), so an unrendered page is not only
blank to a reader but **invisible to search**: the next agent looking for what this one wrote will
not find it, and neither will a person. A contribution that nobody can find has not been
contributed. So **the write tools that produce a page require the Puppeteer extension**:
without it, `create_page` and `update_page` answer that they are unavailable on this wiki — a tool
error naming the missing extension and pointing at `suggest_edit` — rather than save a page nobody
can read or find. `suggest_edit`, rendered by the reviewer's browser on approval, works everywhere,
as do the writes that need no page render: comments, glossary terms and uploads. The extension being
installed later makes the two tools work with nothing else changed. An agent that may read the
source gets the source from `get_page` either way; one that may not gets the render, and for a page
with none yet, a note that it may be waiting for the renderer.

The admin screen shows whether the extension is installed.

### 6.4 Live editors

A collaboration room is not storage: saving is an explicit act by whoever is in the room. If an agent
saved while people were editing, their next save would be their room's text — which does not have
the agent's change in it — and would silently replace it.

**`update_page` therefore refuses a page that has an open room**, telling the agent to use
`suggest_edit` or try later. Not a relay of the room's `saved` message, which the first design had:
that message tells the editors that what they are looking at is now what is stored, which after an
agent's save would be exactly wrong, and their unsaved-changes flag would go quiet over text that no
longer matches the page. Writing the agent's edit into the room instead — as a collaborator typing —
is the better answer and a project of its own.

Rooms live per instance (`WIKI.collab.rooms`), so the check sees the rooms on the instance that took
the call: complete on a single instance, which is the common case, and best-effort across an HA set,
where a room on another instance goes unseen. `baseVersionId` is the other half: a stale one is
refused, so an agent never writes over a version it did not read.

### 6.5 Locked and unpublished pages

- **Password-protected pages** cannot be unlocked by an agent. `get_page` answers "locked" unless the
  actor may edit the page; search matches a protected page on its title and description only, for
  every caller, as the search route does.
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
- **Anonymous access** is the `mcp.allowAnonymous` setting ([§4.4](#44-one-new-global-permission)),
  which suits a public documentation site: no token, the guests group's page rules, read tools only.
  It is also a public endpoint that runs database queries on demand, so it is always rate limited,
  per address. Off by default, and the admin screen warns while it is on.
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
  (`mcp.rateLimitBurst`, 60 by default, and `mcp.rateLimitPerMinute`, 300). One token per JSON-RPC
  request, so a batch costs what its requests would separately, and notifications cost nothing. The
  budget is per owner (`user:<id>`), so that a second token does not buy a second budget, and per
  address for anonymous (`ip:<address>`). Its map holds at most 10 000 keys and drops the least
  recently used, since anonymous addresses are unbounded — the same reason `SHELL_CACHE_MAX_ENTRIES`
  exists; a dropped bucket comes back full, which errs towards letting a client through. The cost is
  that it is approximate across an HA set: each instance counts alone, so a client spread by the load
  balancer over N instances gets up to N times the budget. That is accepted: the limit is there to
  stop a runaway agent hurting the instance it is hammering, which a per-instance count does, not
  to meter anybody exactly. A refusal is HTTP 429 with `Retry-After` and a JSON-RPC error saying the
  same, which clients honour.
- **Search** already pages correctly with rule filtering, and the protected-content filter only runs
  for protected pages.
- **Bodies.** `/_mcp` takes the server's body limit (5 MB unless `bodyParserLimit` says otherwise),
  which is large enough for a page being written; a batch is capped at 50 messages.
- **The render queue** drains one page at a time across the instance. Write tools must not be able to
  flood it; the per-owner budget covers that, and a queue depth past a threshold refuses writes
  rather than growing without bound.

---

## 8. The screens

### 8.1 Admin → MCP

`/_admin/mcp`, modelled on `AdminScim.vue`. Reaching it takes `access:admin`, as every admin screen
does; what each part then allows is split by permission.

**Built** (`pages/AdminMcp.vue`): the header, Prerequisites (the renderer included, rather than under
Safety), Endpoint (the URL, the setup for Claude Code, VS Code and Cursor through the shared
`McpConnectSnippets`, and a link to the administrator's own tokens), Tools (each group with the
scopes it needs, and marked while its tools do not exist yet), Guidance, Access, Safety, Display and
Contributions, OAuth clients. **Not built**: Usage. The routes behind it are `manage:system`, reads
included — the guidelines page `manage:sites` — so an `access:admin` caller without them gets a load
error rather than the read-only view described below.

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
  site's tree, and stored in the site's config (`mcp.guidelinesPath`, in its primary locale). Empty,
  the instructions carry the generic guidance alone. Saved with Apply; normalized as a lookup path,
  and refused if it is not one. A path rather than a page, so it may be named before it is written:
  the card's button opens the page, or the missing-page screen there, which offers to create it — no
  starting template yet. Its text goes to an assistant as the assistant may read it, up to 6 000
  characters; a page its owner may not read is simply not handed over.
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
- **Access**: who may use the endpoint — members of a group holding `use:mcp`, with a link to the
  group editor rather than a second place to grant it — and the **Allow Anonymous Access** switch,
  with a warning while it is on. Built; listing which groups hold `use:mcp` is not.
- **OAuth clients** (`manage:system`): the clients that have registered — those holding a grant
  first, then newest first, at most 50, since registration is open and a burst of unused clients must
  not push the ones in use off the list — with when, how many grants each holds and the hosts it
  returns to — what tells two clients of the same name apart — and delete, which takes every grant
  made to it with it, after a confirmation that says how many. Built.
- **Contributions**: what agents have added lately — page versions with `via = 'mcp'` over the last
  week on every site, newest first and at most 50, each with its site, whom it was for, what it did
  and its reason, opening the version it made (`/_version/<id>`, on that site's own host). Read off `pageHistory` (`listByVia`), so it costs nothing
  to keep and is the same on every instance. It is how an administrator sees goal 2 working, or
  notices it going wrong. Suggestions waiting are not listed: a submission does not record how it
  was made.
- **Usage**, optional: calls in the last day by tool. Prometheus counters
  (`wiki_mcp_tool_calls_total{tool}`) cost less than a table, but are per instance.

**No token list.** An MCP token is only a personal access token holding the `mcp` scope, so a
user's tokens are seen and deleted where they already are, in the user editor.

The settings are `manage:system`; `access:admin` alone sees the endpoint and the settings read-only.

### 8.2 Profile → Access Tokens

No new profile page: `ProfileTokens.vue` is where an MCP client's token is made, and it gains what
connecting one needs while MCP is enabled and personal tokens are allowed. Built as described, but
for the `write:scripts` warning and OAuth grants. What it needs to know comes with the token list:
`GET /users/profile/tokens` answers `mcp: { isEnabled, mayUse, isAdministrator }`.

- **Connect an AI Assistant**, a tab beside **Tokens** under the page's introduction, offered only
  while the MCP server is on and tokens can be made (otherwise there are no tabs at all): the client
  setup (Claude Code, VS Code, Cursor), and a button that opens the existing create dialog
  prefilled — "AI assistant", `mcp:read`, `pages:read` and `glossary:read`, the read-only starting
  point (`presetName`, `presetScopes`). The copy dialog that shows the token once also shows the
  setup with it filled in, for any token holding an `mcp` scope, so that it is pasted once and
  never again.
- **Without `use:mcp`** the tab says plainly that `/_mcp` will refuse the user's tokens until an
  administrator grants it, rather than offer a setup that silently does nothing.
- **For an owner holding `manage:system`**, the tab warns that a token used by an agent is above
  every page rule. **For an owner holding `write:scripts` or `write:styles` anywhere on the site**, it
  is meant to warn that a page the agent writes there may carry scripts and styles that every reader
  runs ([§7](#7-security)) — not built: "anywhere on the site" is a question about every page rule,
  which nothing answers cheaply yet.
- **The scope grid gains its MCP row** ([§4.2](#42-personal-access-tokens-are-the-credential)), with
  a hint saying that read keeps an assistant read-only whatever the other rows allow.
- **OAuth grants are listed with the rest**, under the client's name and marked as a connection
  ("connected through OAuth", a robot rather than a stamp) rather than a token, with the same delete,
  which disconnects the client. There is nothing of theirs to copy. Built.
- Otherwise the expiry, list and delete are the ones the page already has.

### 8.3 Elsewhere

- **`GET /system/info`** returns `isMCPEnabled`, which lights the sidebar.
- **The group editor** offers `use:mcp`.
- **Page history and the page itself** show an **AI** badge, with a tooltip saying what it means,
  beside the author of a version made through MCP, off `pageHistory.via`
  ([§5.4](#54-contributing-to-the-wiki-goal-2)) — the history list for every such version, the page's
  last-edited line when the latest one is (`editedVia`) — while `mcp.showAiBadge` is on. The page
  payload and the history route carry it either way; `showAiBadge` on the site payload decides
  whether the frontend draws it. Built.
- **The OAuth consent screen** at `/_authorize` (`pages/OAuthConsent.vue`), in the auth layout as
  the login screen is but with a small layout of its own — the login screen's styles belong to its
  own chunk and are not loaded on a visit straight here ([§4.3](#43-oauth-21)). Built.
- **Admin → Users**, in the user editor: already lists the user's tokens and deletes one
  (`manage:users`, subject to `systemUserGuard`) — which is where an administrator looks when an
  account is compromised. It gains a line saying whether the user holds `use:mcp`, since that decides
  whether those tokens do anything on `/_mcp`.

---

## 9. Suggested order

1. **Foundation** — _done._ `use:mcp` in the group editor and `CLAUDE.md`; the `mcp` scope category, backend
   and frontend; the instance-wide `mcp` settings blob and `models/mcp.ts`; the bearer hook admitting
   personal tokens on `/_mcp` and deferring their scope check to it; `api/mcp.ts`; the `updateMcp`
   audit action; `isMCPEnabled` in `system/info`. No token migration — the token table exists.
2. **Goal 1, a read-only server** — _done._ `controllers/mcp.ts` with the `discover`, `pages`, `history` and
   `glossary` read tools over the hand-written protocol layer, the per-tool scope check at
   `tools/list` and `tools/call`, the common page fields with `url`, `get_page` by URL with outline
   and sections, result caps, the server instructions with the agent guidelines page, the token
   bucket and the Origin check. Useful on its own, and the first thing most deployments will turn on.
3. **The screens** — _done, as far as [§8](#8-the-screens) says._
4. **Goal 2, contributing** — _done, but for the collab relay, replaced by a refusal
   ([§6.4](#64-live-editors))._ The `pageHistory.via` column, the AI badge and its setting; then
   `suggest_edit` and `post_comment` with annotations, which work on any instance; then
   `create_page` / `update_page` — `baseVersionId`, `str_replace` edits, the required reason, the
   broken-link report, render queue integration with the owner's script and style permissions,
   "unavailable" without the Puppeteer extension, the refusal while the page is open in the editor — and the glossary
   writes. The Contributions card on `/_admin/mcp`.
5. **Assets and `destructive`**, last of the tools — _done._
6. **OAuth 2.1** — _done._ The `/.well-known/` metadata, client registration, authorize with the consent
   screen, the token endpoint with refresh rotation, the OAuth tables, and grants in the
   profile's list. Last because the bearer path is complete without it; it is what claude.ai and
   ChatGPT need.

Verification per phase: `npm run typecheck`, `npx oxlint`, and a scripted MCP handshake —
`initialize`, `tools/list`, a `tools/call` — against a throwaway instance, with a token made through
`POST /users/profile/tokens` from the scripted login. Phase 4 is the one that earns a real
save-and-render run — and the check that matters for goal 2 is the round trip: a page written through
`create_page` is found by `search_pages` once its render lands.
