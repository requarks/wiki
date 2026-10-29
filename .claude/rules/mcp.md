---
paths:
  - "backend/mcp/**"
  - "backend/controllers/mcp.ts"
  - "backend/controllers/oauth.ts"
  - "backend/models/mcp.ts"
  - "backend/models/oauth.ts"
  - "backend/api/mcp.ts"
  - "backend/api/oauth.ts"
  - "backend/helpers/via.ts"
  - "backend/helpers/tokenBucket.ts"
  - "backend/tasks/simple/purge-oauth.ts"
  - "dev/specs/mcp.md"
  - "frontend/src/pages/AdminMcp.vue"
  - "frontend/src/pages/OAuthConsent.vue"
  - "frontend/src/components/McpConnectSnippets.vue"
  - "frontend/src/helpers/mcpClients.js"
---

# MCP server

The wiki as a Model Context Protocol server at `/_mcp`, so that an AI assistant can search and read it
— and, as the write tools land, contribute to it — as the person whose token it holds.
**`dev/specs/mcp.md` is the design and says what is built**; `controllers/mcp.ts` is the endpoint,
`mcp/` the protocol and the tools, `models/mcp.ts` the instance-wide settings (Admin → MCP).

- **The credential is a personal access token holding the `mcp` scope**, whose owner holds `use:mcp`.
  `mcp` is the one scope category that names a surface rather than an area: no `/_api` route declares
  it, and every tool needs it at its level on top of its own category (`mcp:read` + `pages:read` for
  a read tool). A system API key is refused, since it is nobody. The bearer hook in `index.ts` lets a
  personal token through to `/_mcp` and leaves the scope check to the tool registry.
- **`/_mcp` never reads the session cookie.** Tools ask their access questions of `McpContext`
  (`mcp/context.ts`), built from the token alone — not through `mayOnPage(req, …)` and friends in
  `api/pages.ts`, which fall back on the session when there is no key. A new tool asks the context.
- **A tool declares `group`, `category` and `readOnly`**, and the registry (`mcp/tools/index.ts`)
  refuses to load one without a valid category or group. `readOnly` is both the scope level and the
  `readOnlyHint`. `tools/list` and `tools/call` share one `mayCall`, so a tool is never listed that
  would only be refused.
- **A refusal the agent can act on is a `ToolError`** (the result, with `isError`), not a JSON-RPC
  error; and "not there", "not live" and "not yours to read" are one message.
- **Everything a call leads to is marked `via: 'mcp'`** — the version a save records
  (`pageHistory.via`, shown as the AI badge while `mcp.showAiBadge` is on) and the audit entry — by
  the `withVia` scope (`helpers/via.ts`) the controller opens, not by each tool. A new write path
  inherits it for free; don't pass it by hand.
- **An action whose rules live in its REST route** (posting a comment, a suggestion, a glossary term)
  **is called in-process** through `callApi` (`mcp/inject.ts`) rather than re-implemented in the
  tool, so the cooldown, spam check, notifications and audit cannot drift from `/_api`.
- **Page writes need the Puppeteer extension** and answer unavailable without it, and
  `update_page` refuses a page with an open collaboration room on this instance — an editor's next
  save would silently overwrite the agent's change.
- **OAuth 2.1 is how the remote connectors sign in** (`controllers/oauth.ts`, `models/oauth.ts`,
  consent at `/_authorize`). A grant is a `personalTokens` row with a `clientId`: listed and deleted
  like any token, but its hour-long access tokens are accepted on `/_mcp` alone (the bearer hook
  refuses them on `/_api`), and a reused refresh token revokes the grant. It all exists only while
  MCP, the API and personal tokens are on.
- **Written by hand, no MCP SDK.** Arguments are checked by Ajv against the schema `tools/list`
  publishes. The rate limit is an in-memory token bucket per instance (`helpers/tokenBucket.ts`), on
  purpose: agents fan out, and a database write per call would be the load it exists to stop.
