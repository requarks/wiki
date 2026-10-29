---
name: throwaway-instance
description: Boot a disposable Wiki.js instance on its own database (port 3010), script its API or screenshot it with puppeteer-core, and tear it down. Use only when a change earns real-browser verification — new UI meeting a stylesheet written elsewhere, or a flow with real state (login, upload, save) — never against the dev instance.
---

# Booting a throwaway instance

For the cases the root CLAUDE.md's **How far to go verifying a change** says earn it, and never against a running dev instance: that database is somebody's own work,
and its admin account may well have 2FA on, which cannot be scripted.

**A database of its own, not a schema of its own.** Copy `config.yml` to `config.test.yml` with
`port: 3010`, `db.db: wikitest` and `dataPath: ./data-test` — and leave `schema: wiki` alone. A second
*schema* in the same database fails on the first migration: `CREATE TYPE "treeType"` in
`db/migrations/20260809235619_init` is not schema-qualified, and neither is the column that references
it, so the type is created in one search path and looked for in another (`42704 typenameType`). There
is no `psql` in the dev container, so create the database with `pg` out of `backend/node_modules`,
connecting with the credentials already in `config.yml`.

Then `CONFIG_FILE=config.test.yml node --no-experimental-webstorage backend` **from the repo root**.
`CONFIG_FILE` is resolved against `WIKI.ROOTPATH` (`core/config.ts`), so it is a path relative to the
root and not to `backend/`. It seeds itself and takes ~25s to reach listening.

**Puppeteer must not be added to a workspace's `package.json` for a screenshot.** Install
`puppeteer-core` into a scratch directory instead and drive the browser already on the box: the
headless shell the dev container's Puppeteer extension installed, whose path
`npx puppeteer browsers install chrome-headless-shell --format '{{path}}'` prints from `backend/`
(it downloads nothing when the browser is there). Launch with that as `executablePath`,
`headless: 'shell'` and `args: ['--no-sandbox']`; `puppeteer-core` pulls ~25 packages and downloads no
browser of its own.

**Scripting the API rather than the browser**, which is the quicker way to get a page and a history in
place. Three things about it are not guessable:

- **The site ID comes from `GET /_api/bootstrap`**, which is `publicAccess: true` and answers with the
  site, the flags and the session — it is what the SPA itself calls on boot. Not from `GET /_api/sites`:
  that needs `read:sites` or `access:admin`, so logged out it answers 401, and the site ID is what
  logging in requires.
- **Login is `PUT /_api/sites/:siteId/auth/login`** (not POST) with `{strategyId, username, password}`.
  The strategy is the built-in local one, whose ID is fixed as `systemIds.localAuthId` in `base.yml`.
  A fresh instance answers `nextAction: changePassword` with a `continuationToken` for the seeded
  `admin@example.com` / `12345678`; feed that to `PUT .../auth/changePassword`, which needs
  **`strategyId` as well as** `continuationToken` and `newPassword`. The session cookie is good after
  that.
- **The auth endpoints are rate limited, and successes are counted too.** `limitAuthAttempts`
  (`helpers/rateLimit.ts`) guards login, 2FA, this password change, passkeys and page unlock with one
  counter per client address — ten attempts per five minutes, then a fifteen minute ban. A re-runnable
  script that tries the seeded password before the one it changed it to therefore burns a guaranteed
  failure per run and eventually locks itself out. Try the changed password FIRST, and clear a ban with
  `DELETE FROM wiki."rateLimits"` rather than waiting it out.

**Two things block a fresh install's first screenshot.** The seeded admin is forced through a
change-password form on first login — fill both `input[autocomplete="new-password"]`, the current
password field being `v-if`'d away whenever a continuation token is in hand. And the site root raises
the **Welcome overlay** over the header while there is no home page, so navigate to any other path to
get at the real one.

**A successful login is `authenticated: true`**, and it answers `nextAction: 'redirect'` — so a script
that reads "did this work" as the ABSENCE of a `nextAction` decides every good login was a bad one,
and then burns its retry on the seeded password against the limiter above.

**Saving from the UI goes through a dialog, twice over.** A page being created opens the **Save As**
tree browser, and a save of any kind opens the **reason-for-change** dialog unless the site's
`features.reasonForChange` is `off`. So a script that clicks Save and waits for the request sees
nothing at all, and reads as a broken save; dismiss both. The button is disabled off
`editorStore.hasPendingChanges`, which is the honest thing to assert on rather than a request.

**Tearing down** is killing your own PID — a dev instance shows up as `node backend` too, so match on
start time or the `CONFIG_FILE` in `/proc/<pid>/environ` rather than on the name — then
`DROP DATABASE wikitest` and deleting `config.test.yml` and `data-test/`. Neither is gitignored:
`.gitignore` names `/config.yml` and `/data` as exact paths, so a copy under any other name is
tracked and will turn up in the next commit.
