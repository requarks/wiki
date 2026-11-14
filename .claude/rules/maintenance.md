---
paths:
  - "backend/helpers/maintenance.ts"
  - "backend/types/fastify.d.ts"
  - "backend/api/authentication.ts"
  - "backend/api/bootstrap.ts"
  - "backend/controllers/collab.ts"
  - "backend/mcp/tools/index.ts"
  - "frontend/src/components/MaintenancePage.vue"
  - "frontend/src/components/SiteBanner.vue"
  - "frontend/src/helpers/bannerMarkdown.js"
  - "frontend/src/boot/api.js"
---

# Maintenance mode

A site's `maintenance` config — `{ mode, bypassGroups }`, set in the Site-wide Banner / Maintenance card of
**Admin → General**. `off`, `readonly` (the site stays readable, nothing may change the database) or
`restricted` (the app shows a maintenance page with the banner's title and contents in place of
every screen but the login, and the server serves nothing of the site). `helpers/maintenance.ts` is
the whole rule; read its header first.

- **Nobody holding `manage:system` is affected, and neither is a member of a bypass group.** Asked of
  `groups.actorForRequest(req)`, so a system API key bypasses through its groups and a personal token
  through its owner's. `effectiveMaintenance(req, siteId)` already answers `off` for them — ask that,
  never the stored mode, anywhere the answer decides what a requester gets. The Guests group is
  never a bypass group (the admin screen leaves it out and `PUT /sites/:siteId` refuses it), and that
  route also refuses a save that would turn on a mode holding back the person saving it — the site's
  settings are behind the mode too, so they could not turn it off again.
- **One request hook in `index.ts` refuses, before the body is read**, with 503 and the
  `X-Wiki-Maintenance` header naming the mode (`maintenanceRefusal`). It covers `/_api`, `/_scim`,
  `/_mcp`, `/_files`, `/_thumb` and `/sitemap.xml`; `readonly` refuses only a write method, while
  `restricted` refuses everything. Which site: the route's `:siteId` when it names one, otherwise the
  hostname's — so another site's hostname is no way round a closed one.
- **A route stays open by saying so, with `config.maintenance`**: `open` for what signing in goes
  through and what the app needs to draw the maintenance page and login (bootstrap, site info,
  locales, whoami, the auth strategies, login and its continuations, provider callbacks, logout);
  `read` for a POST that changes nothing (`pages/userPermissions`, a page unlock), which `readonly`
  treats like a GET. **A new write route needs nothing** — it is refused by default. A new route the
  login screen or the maintenance page calls needs `open`, or a closed site cannot be signed into.
- **Three surfaces decide for themselves**, because the hook cannot: the app shell
  (`renderAppShell` serves `closedFragments` — the site's head, no page, 503, `noindex` — instead of
  describing the page), the collab sockets (a refused upgrade only reconnects; a page room closes with
  4403 in either mode, a live note room closes when restricted and joins read-only when read-only),
  and MCP tools (`mayCall` hides every non-`readOnly` tool while read-only, since `edit.ts` writes
  through the models and never passes a route the hook could refuse).
- **What the interface hides is the server's answer too.** `pagePermissionsFor` returns only the
  `read:*` page permissions while read-only, so every control gated on `pagePermissions` disappears
  without the frontend knowing about maintenance. Global permissions are left alone: the admin area
  stays viewable, and a save there is refused by the hook.
- **The site payload carries `maintenance: { mode, isBypassed }`**, computed per request
  (`maintenanceForRequest`), plus `bypassGroups` only for `manage:sites`. A login reloads the document,
  so a bypass is picked up on the next bootstrap; a refusal mid-session is picked up from its header
  by `boot/api.js`, which also stops ky retrying it and reports the server's message in place of ky's.
- **The banner shows while either mode is on**, whether or not `banner.isEnabled` — it is what tells
  readers why nothing saves. Its markdown and the maintenance page's go through the same
  `helpers/bannerMarkdown.js`.
- **Background work is not affected.** Scheduled jobs, storage sync and renders are not requests and
  carry on; maintenance mode is about what people do.
