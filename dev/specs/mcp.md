# MCP — the wiki as a Model Context Protocol server

**Status:** a proposal. Nothing here is implemented beyond the placeholder admin screen. The
decisions taken so far are in [§10](#10-decisions-taken), what is still open in
[§11](#11-open-questions); every name, path and payload shape below is illustrative.
**Covers:** what an MCP server built into Wiki.js would expose, how it authenticates and authorizes a
client, what it costs, what it risks, and the admin screen at `/_admin/mcp`.

The [Model Context Protocol](https://modelcontextprotocol.io) is how an AI client — Claude Code,
Claude Desktop, VS Code, Cursor, claude.ai and ChatGPT connectors — is given tools and content from
somewhere else. A wiki is an obvious thing to plug in: it is where an organisation's knowledge
already is, and the question an agent most often cannot answer is "what does *our* documentation say
about this".

The constraint this document is written against: **an agent is somebody acting on a person's
behalf, and must never be able to do more than that person could.** A token is created by the person
it acts for, from their own profile, and carries their groups and permissions — every page rule,
every locked page and every unpublished draft applies to it exactly as it applies to them, and an
administrator's token is an administrator's. The one thing that does not carry over is running
scripts and styles in a page, because the text the agent writes was not written by the person.

---

## 1. Goals and non-goals

**Goals**

- **Search and read the wiki from an AI client**, with the same results the person holding the
  credential would get in the browser.
- **Write, opt-in**: create and edit pages, suggest edits for review, comment — each switchable
  separately, all off by default.
- **Works on any instance**, including an HA set behind a load balancer with no sticky sessions.
- **One switch to turn it off** and one action to take every credential back.

**Non-goals**

- **Administration.** No tools for users, groups, settings, storage or sites. That is a different
  risk profile entirely and nothing here needs it.
- **Server-side rendering.** The page pipeline lives in the browser and stays there; see
  [§6.3](#63-a-page-written-without-a-browser-has-no-render).
- **An AI feature in the wiki itself.** This makes the wiki a *source* for somebody else's agent. It
  does not put a model in the wiki.

---

## 2. What exists today

| Piece | Where | State |
| ----- | ----- | ----- |
| The admin screen | `frontend/src/pages/AdminMcp.vue`, route `mcp` in `router/routes.js` | Placeholder: enable and "New MCP Key" buttons permanently disabled, a "not implemented" banner. The "New MCP Key" button goes: tokens are created from the profile ([§4](#4-identity-and-tokens)) |
| The sidebar entry and status light | `layouts/AdminLayout.vue` | Reads `adminStore.info.isMCPEnabled`, which `GET /system/info` never sends — always red |
| Strings | `backend/locales/en.json`, `admin.mcp.*` | `admin.mcp.notImplemented` goes once the screen is real |
| Docs link | `siteStore.docsBase + '/dev/mcp'` | Points at a page that has to be written |

Nothing exists on the backend: no route, no model, no settings key, no dependency.

What it will be built from:

| Piece | Where | Used for |
| ----- | ----- | -------- |
| Signed bearer keys, revocation, expiry, certificate rotation | `models/apiKeys.ts`, `api/apiKeys.ts`, `db/schema.ts` `apiKeys` | Tokens, [§4](#4-identity-and-tokens) |
| The one bearer hook | `index.ts`, "API Key Authentication" | Letting `/_mcp` through |
| A bearer-authed controller outside `/_api` | `controllers/scim.ts` | The shape of `controllers/mcp.ts` |
| Page access for an arbitrary actor | `groups.checkAccess(actor, permission, page)` | Every tool |
| Full-text search taking an actor | `search.searchPages({ actor, … })` | `search_pages` |
| Tree browsing | `tree.browse`, `tree.listPages`, `tree.getFolder` | `browse_tree` |
| Protected-content rule | `hideProtectedContent`, `mayBypassPassword` | Locked pages, [§7](#7-security) |
| HTML → markdown | `turndown` (+ GFM plugin), already a dependency | Reading a page without `read:source` |
| Diffs | `diff`, already a dependency | `diff_versions` |
| Headless render queue | `pages.queueRerender`, `models/rendering.ts` (Puppeteer extension) | Pages an agent writes |
| Approvals / suggestions | `models/approvals.ts`, `api/approvals.ts` | `suggest_edit` |
| Postgres-backed rate limiter | `helpers/rateLimit.ts`, `models/rateLimits.ts` | Per-token budget |
| Audit log | `helpers/audit.ts` (already records `meta.apiKeyId`) | Writes and token lifecycle |
| A settings blob with get/validate/update | `models/scim.ts` + `models/settings.ts` | `models/mcp.ts` |

---

## 3. Architecture

### 3.1 Transport: stateless Streamable HTTP at `/_mcp`

- **Streamable HTTP**, the current MCP transport: JSON-RPC `POST`s to one endpoint.
- **Stateless.** No `Mcp-Session-Id`; every request carries its credential and is answered on its
  own. An SDK session lives in the memory of one instance, and an HA set would then need sticky
  sessions to keep a client on it. Nothing in [§5](#5-features) needs the server to push to the
  client, so nothing is lost.
- **JSON responses, not SSE** (`enableJsonResponse`). No long-lived connection for a proxy to time
  out or for `@fastify/compress` to buffer. `GET /_mcp` — the server-to-client stream — answers 405.
- **A controller, not an `api/` plugin**, for the reasons `controllers/scim.ts` gives for itself:
  errors are JSON-RPC errors rather than the `/_api` error shape, and MCP is described by its own
  `tools/list` rather than by OpenAPI, so it stays out of Swagger.
- **The site is the hostname's**, resolved through `WIKI.sitesMappings` as `/_blocks` and the SEO
  hook already do. Tools do not take a `siteId`; an agent connected to `docs.example.com` sees that
  site and no other.
- **Registered before the SEO hook**, like metrics, for the same reason: nothing about `/_mcp` wants
  a locale prefix or trailing-slash redirect.

Implementation, if the SDK is taken ([§11](#11-open-questions), Q4): `McpServer` plus
`StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`, a fresh
transport per request, driven with `reply.hijack()` over `req.raw` / `reply.raw`. The verified actor
travels to handlers as `authInfo`, which the SDK hands every tool call as `extra.authInfo`.

### 3.2 Where the code lives

| Path | What |
| ---- | ---- |
| `controllers/mcp.ts` | The endpoint: enabled check, Origin check, rate limit, then the transport |
| `mcp/*.ts` | Tool definitions, one file per group of [§5](#5-features). Each calls **models**, never an HTTP route |
| `models/mcp.ts` | The `mcp` settings blob (`getConfig` / `validate` / `updateConfig`, as `models/scim.ts`), the per-group access check, token issue and resolution |
| `api/mcp.ts` | Settings (`manage:system`); creating one's own tokens (`manage:tokens`), listing and deleting them (any signed-in user); revoking anybody's (`manage:system`, `manage:users`) |
| `models/settings.ts` | The `mcp` defaults |
| `index.ts` | The bearer hook admits `/_mcp`; the controller is registered |

---

## 4. Identity and tokens

### 4.1 The problem with using API keys as they are

An API key was designed as a service credential carrying **group-wide** permissions, and it falls
short of being a person in two places:

- **It reads the wiki as a guest.** `groups.groupIdsForRequest` looks at the session only, so a
  bearer request is judged against page rules as the guests group — while its group-wide
  permissions still apply, `manage:system` among them. A non-admin key sees the public wiki; an
  admin key sees everything.
- **It cannot write a page.** `actorFrom` in `api/pages.ts` needs a session user, because a page
  records an author and its render is sanitized against that author's permissions.

The first is arguably a bug in `/_api` as it stands and is worth its own fix. MCP sidesteps both by
binding a token to a user.

### 4.2 User tokens, created from the profile

**A token belongs to a user and acts on that user's behalf.** Whoever holds `manage:tokens`
([§4.4](#44-two-new-global-permissions)) creates their own under **Profile**, and that is the only
place a token is created. Deleting one's own token needs no permission at all. There is no
administrator-issued MCP key, no token bound to a group rather than a person, and no creating a
token for somebody else — the "New MCP Key" button on the placeholder admin screen goes. Whether the
token is then any use on `/_mcp` is a separate question, answered by the owner holding `use:mcp`.

- **Same table, a new kind.** `apiKeys` gains `kind` (`api` | `user`), a nullable `userId` (set for
  `user`, null for `api`), `access` (jsonb, tool group → `read` | `write`; a group not in it is
  none; null for `api`) and `lastUsedAt`.
  Revocation, expiry, rotation and the `isInvalidated` logic all come with it. The existing
  `groups` column stays for `api` keys and is empty for user tokens, whose groups are their
  owner's. Migration name: `user-tokens`.
- **A distinct audience.** User tokens are signed with `aud: urn:wiki.js:mcp`; `verify()` takes the
  audience it expects. A token pasted into an AI client's config file cannot be replayed against
  `/_api`, and an API key cannot be used on `/_mcp`. User tokens are gated on `mcp.isEnabled`, not
  on `api.isEnabled`.
- **The actor is the user, resolved per request**: the owner's current groups and permissions, and
  whether the account is still active. A group change applies to the next call; a deactivated
  account's tokens stop working, and `/_mcp` refuses a token whose owner does not hold `use:mcp` at
  that moment.
- **An administrator's token is an administrator's.** Nothing is stripped: a token whose owner holds
  `manage:system` inherits it, and with it the bypass of every page rule — exactly what that person
  has in the browser. An administrator who wants an agent to change nothing gives the token no write
  access; one who wants it to see less uses an account with less. [§7](#7-security) covers what this
  means for handling such a token.
- **A token has an access level per tool group: none, read or write**, chosen when it is created
  and fixed for its life — changing it is creating another. **Read** lets the token call the group's
  tools marked `read` in [§5](#5-features); **write** lets it call the group's `write` tools as well.
  A group only offers the levels its tools have: `discover` is none or read, `edit` none or write,
  `comments` all three. So a token can search and read pages while seeing no history, or post
  comments without being able to touch a page.
- **Read-only and Read/write are presets, not a second model.** The profile offers them as one-click
  fills of the grid — every group at its highest `read` level, or every group at its highest level —
  because most people want one or the other and should not have to set seven rows to get it. What is
  stored is the grid either way.
- **A group the administrator switches off** is out of reach whatever a token says about it, and the
  token's entry for it is kept: switched back on, it applies again. A group added by a later version
  is absent from every existing token, which is to say none.
- **Access can only narrow.** It decides which tools a token may *call*; the owner's permissions and
  the page rules still decide whether the call succeeds. A token with `edit` at write held by
  somebody who holds `write:pages` nowhere writes nothing. Enforced at `tools/list` as well as at
  `tools/call`: a token is never shown a tool it may not call, so a client does not offer the model
  something that will only be refused.
- **Every token is shown once**, at creation, as API keys already are. The profile lists the owner's
  tokens with name, access, created, expires, last used and state, and deletes them — always,
  whatever the owner holds: somebody who thinks a token has leaked must be able to kill it, and
  losing `manage:tokens` must not leave a working token its owner can no longer take back.

### 4.3 OAuth 2.1

Clients that take a static `Authorization` header (Claude Code, VS Code, Cursor) need nothing more
than §4.2. The remote connectors in claude.ai and ChatGPT expect the MCP authorization flow: OAuth
2.1 with PKCE, the wiki acting as authorization server, protected-resource metadata under
`/.well-known/`, client registration, and a consent screen. That is a feature in its own right and
is proposed as the last phase ([§9](#9-suggested-order)) — but the token table should be shaped so
that an OAuth access token is one more `kind` of it rather than a second system.

It fits the same model: the consent screen is the user granting a client a token on their own
behalf, which is what the profile does by hand, so it asks for `manage:tokens` as the profile does;
the grant shows up in the profile's token list like any other, is deleted from there like any
other, and is useless on `/_mcp` without `use:mcp` like any other.

### 4.4 Two new global permissions

| Permission | Grants | Elevated? |
| ---------- | ------ | --------- |
| `use:mcp` | Using the MCP endpoint. Checked on the token's owner at every call, so taking it away stops that user's tokens on the next one | No |
| `manage:tokens` | Creating tokens **for one's own account**, under Profile. Deleting one's own needs nothing | No |

- **Two questions, two permissions.** `manage:tokens` is about holding a credential; `use:mcp` is
  about what the endpoint will answer. Neither implies the other: `manage:tokens` is what it takes to
  get a token, and `use:mcp` is what it takes, at every call, for that token to be answered. They are
  apart so that the token is not an MCP-shaped thing — should a token ever be accepted anywhere
  else ([§11](#11-open-questions) Q7), `manage:tokens` already covers creating it and the new place
  gets a `use:` of its own.
- **Neither reaches another account.** `manage:tokens` is one's own tokens only — there is no
  permission to create a token for somebody else, and none is proposed. Neither grants anything
  beyond what the holder already has, and neither can be turned into another permission, so neither
  joins `ELEVATED_PERMISSIONS`.
- **Losing one is not losing the tokens.** Taking `manage:tokens` away stops a user creating tokens,
  and leaves the existing ones working — and still deletable by their owner; taking `use:mcp` away
  stops every one of their tokens on `/_mcp`, and leaves them in place. Revoking a user's tokens is
  a separate act, below.
- **Revoking somebody else's token is `manage:system` or `manage:users`**, from the instance-wide
  list on Admin → MCP or from the user editor. No new permission is needed for it: `manage:users`
  can already deactivate the account, which stops every token it holds, so revoking one of them is
  the smaller act. `systemUserGuard` still applies — `manage:users` may not touch an account in a
  `manage:system` group, and that includes its tokens. Revoked, not deleted: the row stays, marked
  revoked, so the owner sees why a token stopped working and the list keeps a record of it.
- **The guests group is anonymous access.** An anonymous request is the guests group everywhere
  else, so a wiki opens `/_mcp` to the public by granting guests `use:mcp` — no token, and the
  guests group's page rules. There is no separate switch for it: the grant is the switch. With no
  token there is no access to read, and an anonymous caller is treated as having **read** on every
  group that is switched on and none of **write** — a public endpoint that writes is a spam channel,
  whatever the guests group's rules would allow.
- **Admin → API keys are untouched**: still `manage:system`, still group-bound service credentials,
  and not what `manage:tokens` covers.
- **The MCP settings** — the enable switch, the tool groups on offer, limits — stay `manage:system`, as the
  SCIM settings are.
- Both go into the group editor (`GroupEditOverlay.vue`) and the permissions list in `CLAUDE.md`.
  Both are offered to ordinary groups; neither is granted to any group by default.

---

## 5. Features

Three things decide whether a call goes through, and they are asked in this order:

1. **The group** — whether the administrator has switched this group of tools on for the instance.
   A group that is off is not listed to anybody.
2. **The token's access to the group** — none, read or write
   ([§4.2](#42-user-tokens-created-from-the-profile)). `read` tools need read or write, `write`
   tools need write.
3. **The page permission** — `checkAccess` for each page the tool touches, with the owner's groups.

| Group | Tools | Level | Page permission | Default |
| ----- | ----- | ----- | --------------- | ------- |
| `discover` | `search_pages` (text, tags, path, locale), `browse_tree`, `list_tags`, `recent_changes` | read | `read:pages` | on |
| `pages` | `get_page` by path or id; `get_page_links`, `get_backlinks` | read | `read:pages`, `read:source` for the source | on |
| `history` | `list_versions`, `get_version`, `diff_versions` | read | `read:history` | on |
| `assets` | `list_assets`, `get_asset` — images as MCP image content, size-capped | read | `read:assets` | off |
| `comments` | `list_comments` | read | `read:comments` | off |
| | `post_comment` | write | `write:comments` | |
| `suggest` | `suggest_edit` through the approvals flow | write | the site's approval rules | off |
| `edit` | `create_page`, `update_page` | write | `write:pages`, `write:tags` for tags | off |
| `destructive` | `move_page`, `delete_page` (to the recycle bin) | write | `manage:pages`, `delete:pages` | off |

A tool's level and its `readOnlyHint` annotation are the same fact, and are declared once. The
levels a group offers on a token are read off its tools the same way, so a group gaining a write
tool starts offering write without anything else changing.

The write-only groups do not bring their reading with them: `edit` at write with `pages` at none is
a token that can overwrite a page it cannot read. That is allowed — it is what the user asked for —
but the profile warns about it, since an agent editing blind is rarely what anybody meant.

Notes on individual tools:

- **`get_page` returns the source when it may.** With `read:source`, the markdown as written. Without
  it, the stored render converted back to markdown with turndown — what a reader sees, in a form a
  model reads well. Long pages take `offset` / `length`, or a heading to start from.
- **`update_page` takes either the whole content or `str_replace`-style edits**, and requires a
  `baseVersionId`. A stale one is refused rather than merged — see
  [§6.4](#64-live-editors).
- **`suggest_edit` is the write path to prefer** for an agent: a person reviews it, and the browser
  that approves it renders it.
- **Every tool carries annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint` — so that
  a client can ask before running the dangerous ones.
- **Resources**: a `wiki://{locale}/{path}` resource template backed by `get_page`, so a client can
  offer pages to @-mention. No resource *listing*: a large wiki is too many to enumerate.
- **Prompts**: none in the first version.

---

## 6. Behaviour worth pinning down

### 6.1 Output is sized for a context window

A page can be megabytes and a search can match thousands. Every result is capped
(`mcp.maxResultChars`, e.g. 50 000) and says so when truncated, with how to ask for the rest.
`search_pages` and `browse_tree` cap their `limit` below what the REST API allows.

### 6.2 What an agent-written page may embed

Its render is produced with **no `write:scripts` and no `write:styles`**, whoever owns the token —
the rule storage imports already follow, for the same reason: the text was not written by the person
whose permissions it would borrow. `queueRerender` already takes the two flags separately.

### 6.3 A page written without a browser has no render

The HTML of a page is produced by the editor's browser at save time. Without one, the only path is
the headless render queue, which needs the **Puppeteer extension**. A page an agent creates or edits
is therefore saved with its source and queued; until the queue reaches it, readers see an empty
page — the same state an imported page is in today. Which of the options this leaves is acceptable
is [§11](#11-open-questions) Q2. The admin screen shows whether the extension is installed.

### 6.4 Live editors

A collaboration room is not storage: saving is an explicit act by whoever is in the room. If an agent
saves while people are editing, their next save silently replaces the agent's change. Two things
stop that: `update_page` refuses a stale `baseVersionId`, and a save from MCP relays the room's
existing `saved` message so the editors are told the page moved under them.

### 6.5 Locked and unpublished pages

- **Password-protected pages** cannot be unlocked by an agent. `get_page` answers "locked" unless the
  actor holds the bypass permissions; search uses `hideProtectedContent` as the search route does.
- **Drafts and unpublished pages** follow the search route's `includeDrafts` rule.
- **Pages created by an agent** start as drafts unless the admin setting says otherwise.

---

## 7. Security

**Prompt injection is the headline risk.** Everything an agent reads — pages, comments, suggestions,
history — was written by somebody else, guests included where the site allows it. An agent that
reads a hostile page while holding write tools can be steered into editing or deleting others. What
answers it:

- read-only by default, and destructive tools behind a switch of their own;
- access per token and per tool group, so a token for a research assistant cannot write at all —
  and never even sees a write tool — and one that posts comments cannot touch a page;
- `suggest_edit` as the recommended write path;
- drafts as the default publish state for new pages;
- every write audited with `via: 'mcp'` and the token id, so what an agent did can be found and
  undone from history and the recycle bin.

The rest:

- **Tokens are stored in plaintext by clients**, in config files and dotfiles. Short default expiry, a
  cap on the maximum, `lastUsedAt` in every list, one-click delete by the owner from the profile or
  revoke by `manage:system` / `manage:users` — and certificate rotation as the instance-wide
  kill switch. Removing `use:mcp` from a group is the quicker lever for a whole class of people: it
  stops their tokens at once without revoking any of them.
- **An administrator's token is a `manage:system` credential**, above every page rule, and sitting in
  a file on a laptop. The profile says so when one is created. Nothing on `/_mcp` administers the
  instance ([§1](#1-goals-and-non-goals)), so what leaks is every page and, from a token with write
  access, the ability to change any of them — not the instance itself. That boundary holds only as
  long as no admin tool is ever added.
- **Bearer only, never the session cookie.** `/_mcp` ignores cookies, which also removes CSRF from
  the picture.
- **Origin validation** is required by the MCP spec against DNS rebinding: a request carrying an
  `Origin` that is not the site's is refused. CORS is added for the MCP headers only if browser-based
  clients are to be supported.
- **Anonymous access** is the guests group holding `use:mcp` ([§4.4](#44-two-new-global-permissions)),
  which suits a public documentation site: no token, the guests group's page rules, and — since
  guests hold no `write:*` rule anywhere by default — in practice read-only. It is also a public
  endpoint that runs database queries on demand, so it is always rate limited, per address. Guests
  are not granted it by default, and the group editor warns when `use:mcp` is ticked on guests.
- **Audit.** Writes go through the existing `page` / `comment` actions with `meta.via: 'mcp'` and
  `meta.apiKeyId`; the row's `userId` is the token's owner, so an agent's edit is found under the
  person it acted for. New actions: `createUserToken` and `deleteUserToken` under `profile` (one's
  own), `revokeUserToken` under `admin` (somebody else's, by `manage:system` or `manage:users`), and
  `updateMcp` under `admin`. Reads are not audited, as elsewhere.

### 7.1 Performance

- **Authentication on every call.** Each JSON-RPC call is an RS256 verification, a key row lookup and
  a permission resolution, and agents call in bursts. A short in-memory cache (~10 s) of token to
  actor absorbs that, at the price of a revocation taking up to that long to bite. `lastUsedAt` is
  written at most once a minute per token.
- **Rate limiting.** `rateLimits.consume` is a postgres write per call: correct across an HA set,
  costly for a chatty agent. The alternative is an in-memory token bucket per instance — cheaper,
  approximate across instances. Either way the budget is per token (per address for anonymous).
- **Search** already pages correctly with rule filtering, and the protected-content filter only runs
  for protected pages.
- **Bodies.** `/_mcp` gets its own body limit, large enough for a page being written.
- **The render queue** drains one page at a time across the instance. Write tools must not be able to
  flood it; the per-token budget covers that, and a queue depth past a threshold refuses writes
  rather than growing without bound.

---

## 8. The screens

### 8.1 Admin → MCP

`/_admin/mcp`, modelled on `AdminScim.vue`. Reaching it takes `access:admin`, as every admin screen
does; what each part then allows is split by permission.

- **Header**: status light, docs, refresh, **Enable / Disable** (`manage:system`). No key button —
  tokens are not created here.
- **Endpoint**: the URL for each site — `https://<hostname>/_mcp` — with a copy button, and
  ready-to-paste setup for common clients: `claude mcp add --transport http …` with the header, a VS
  Code `mcp.json` entry, Cursor. The same card appears on the profile page, which is where a user
  actually needs it.
- **Capabilities** (`manage:system`): one switch per tool group of [§5](#5-features), each labelled
  with the levels its tools offer — which is what a token's grid can then reach. The groups holding
  write tools are set apart, `destructive` with a warning of its own. A group switched off here is
  shown greyed out in every user's grid rather than hidden, so the choice a token was created with
  stays visible.
- **Safety** (`manage:system`):
  - default publish state of pages created by an agent;
  - maximum result size;
  - per-token rate limit;
  - maximum token lifetime;
  - whether the Puppeteer extension is installed, linking to Extensions.
- **Access**: who may use the endpoint, read off the groups — which groups hold `use:mcp` and
  `manage:tokens`, and whether the guests group holds `use:mcp` (anonymous access, with a warning).
  Links to the group editor rather than a second place to grant them.
- **Tokens** (`manage:system`, `manage:users`): every user token on the instance — owner, name,
  access, created, expires, last used, and state (active, revoked, expired, invalidated) —
  filterable by owner, with revoke. Read-only metadata and a revoke button: nothing here creates or
  edits a token. The owner links to the user in **Admin → Users**; a token whose owner holds
  `manage:system` is marked as such — and has no revoke button for a `manage:users` caller — and so
  is one whose owner has lost `use:mcp` and which therefore does nothing.
- **Usage**, optional: calls in the last day by tool. Prometheus counters
  (`wiki_mcp_tool_calls_total{tool}`) cost less than a table, but are per instance.

The settings are `manage:system` and the token list `manage:system` or `manage:users`;
`access:admin` alone sees the endpoint and the settings read-only.

### 8.2 Profile → AI Assistants

A new profile page (name to be settled), shown to whoever holds `manage:tokens` or has tokens
left to delete, while MCP is enabled. Without `manage:tokens` it is the list alone, with no way to
create one. A holder without `use:mcp` is told plainly that tokens they create will be refused by the
endpoint until an administrator grants it — the two permissions are separate, and a token that
silently does nothing is the worst way to find that out.

- **Connect**: the endpoint URL for the current site and the client snippets, with the token filled
  in on the screen that shows it once.
- **New token**: name, expiry (up to the instance's maximum), and the access grid — one row per tool
  group the administrator has switched on, each with the levels that group offers (none, read,
  write), and a line under it saying what the group's tools do. **Read-only** and **Read/write**
  above the grid fill it in one click; Read-only is what a new token starts from. The screen warns
  about a write-only group with its reading group at none ([§5](#5-features)), and, for an owner
  holding `manage:system`, that the token will be above every page rule.
- **Tokens**: the user's own, with name, access (summarised — "Read-only", "Read/write", or the
  groups at write), created, expires, last used and state, and delete.

### 8.3 Elsewhere

- **`GET /system/info`** returns `isMCPEnabled`, which lights the sidebar.
- **The group editor** offers `use:mcp` and `manage:tokens`.
- **Admin → Users**, in the user editor: the user's tokens, with revoke (`manage:system`,
  `manage:users`, subject to `systemUserGuard`) — which is where an administrator looks when an
  account is compromised.

---

## 9. Suggested order

1. **Foundation**: `use:mcp` and `manage:tokens` in the group editor and `CLAUDE.md`; the `mcp`
   settings blob and `models/mcp.ts`; the token columns and migration; `verify()` split by audience;
   the bearer hook for `/_mcp`; `api/mcp.ts`; audit actions; `isMCPEnabled` in `system/info`.
2. **A read-only server**: `controllers/mcp.ts` with the `discover`, `pages` and `history` tools, result
   caps, the rate limit and the Origin check. Useful on its own, and the whole of what most
   deployments will turn on.
3. **The screens**: Profile → AI Assistants, then `/_admin/mcp`, with their `en.json` strings.
4. **Writes**: `suggest_edit` first, then `create_page` / `update_page` with `baseVersionId`, render
   queue integration, the collab `saved` relay and the no-scripts rule. `destructive` last.
5. **OAuth 2.1**, if Q1 says so.

Verification per phase: `npm run typecheck`, `npx oxlint`, and a scripted MCP handshake —
`initialize`, `tools/list`, a `tools/call` — against a throwaway instance. Phase 4 is the one that
earns a real save-and-render run.

---

## 10. Decisions taken

Taken on 2026-09-26.

- **Tokens are created by users, for themselves, from the Profile area**, and act on their behalf
  with their current groups and permissions ([§4.2](#42-user-tokens-created-from-the-profile)).
- **There are no administrator-issued MCP keys**, and none bound to a group. The "New MCP Key" button
  on the placeholder screen goes.
- **A token has none, read or write per tool group**, chosen by the user at creation, with
  Read-only and Read/write as presets that fill the grid. Anonymous callers get read on every group
  that is on, and no write.
- **An administrator's token inherits `manage:system`**, bypass included. An administrator creates a
  token from their own profile like anybody else; there is no setting that strips it.
- **Two new global permissions** ([§4.4](#44-two-new-global-permissions)): `use:mcp` lets a user use
  the MCP endpoint, and `manage:tokens` lets a user create tokens for their own account. Neither
  reaches another account, and neither is elevated.
- **A user can always delete their own tokens**, whatever they hold.
- **Anonymous access is the guests group holding `use:mcp`**, with no separate switch.
- **`manage:system` and `manage:users` revoke other users' tokens**, `manage:users` subject to
  `systemUserGuard`.

---

## 11. Open questions

1. **Bearer only, or OAuth 2.1 too?** Bearer covers the clients that take a header; OAuth is what
   claude.ai and ChatGPT connectors need, and is a feature in its own right ([§4.3](#43-oauth-21)).
   Even if it comes later, deciding now shapes the token table.
2. **Writes without a browser** ([§6.3](#63-a-page-written-without-a-browser-has-no-render)):
   (a) write tools need the Puppeteer extension and answer "unavailable" without it; (b) writes are
   allowed and pages wait unrendered for the queue; or (c) only `suggest_edit` is offered, and a
   person's browser renders on approval. (a), with (c) always available, is the proposal.
3. **Instance or site?** Enabled once for the instance, as SCIM is, with a per-site opt-out — or an
   `mcp` block in each site's config, as analytics does? Tokens are per user and users are per
   instance, so a token works on every site it is enabled for either way.
4. **The SDK or not.** `@modelcontextprotocol/sdk` brings `zod` and, in v1, express and a handful of
   other packages into a Fastify backend. The stateless subset used here — `initialize`,
   `tools/list`, `tools/call`, `resources/*` — is small enough to write by hand. Which is less to
   maintain?
5. **Default publish state** for pages an agent creates: draft, or the site's usual default?
6. **Rate limiter**: the postgres-backed one (exact, a write per call) or an in-memory bucket per
   instance (cheap, approximate)?
7. **Beyond MCP?** A user token is by now a personal access token in all but audience. Should it
   one day be usable on `/_api` as well — which would be what finally lets a
   script act as a person — or stay MCP-only? The permissions are already shaped for it:
   `manage:tokens` covers creating the token, and `/_api` would take a `use:` of its own beside
   `use:mcp`. Nothing here depends on the answer.
