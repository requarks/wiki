# Wiki.js — Project Memory

> Generated: 2026-06-14
> Branch: `upgrade/phase1-security`

---

## 1. About

**Wiki.js** is a modern, lightweight and powerful wiki app built on Node.js, Git and Markdown.
- Author: Nicolas Giard (NGPixel)
- License: AGPL-3.0
- Website: https://js.wiki/
- GitHub: https://github.com/requarks/wiki
- Current version: 2.0.0 (dev)

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | >=20 (currently v24.14.1) |
| **Backend** | Express | 4.18.2 |
| **API** | Apollo Server 2.x | 2.25.2 |
| **GraphQL** | graphql | 15.3.0 (locked via resolutions) |
| **ORM** | Objection.js | 2.2.18 |
| **Query Builder** | Knex | 0.21.7 |
| **Databases** | PostgreSQL, MySQL, MariaDB, MSSQL, SQLite | — |
| **Frontend** | Vue 2 | 2.6.14 |
| **UI Framework** | Vuetify | 2.3.15 |
| **State Management** | Vuex | 3.5.1 |
| **Router** | vue-router | 3.4.7 |
| **Build** | Webpack | 4.44.2 |
| **Tests** | Jest + Cypress | Jest 26.6.1 / Cypress 5.3.0 |
| **Linter** | ESLint | 7.12.0 |
| **Package Manager** | Yarn | 1.22.22 |
| **Docker** | requarks/wiki | — |

---

## 3. Architecture

### Boot Sequence

```
server/index.js
  └── Init WIKI global object
  └── WIKI.configSvc.init()          ← Load config.yml
  └── WIKI.logger = winston
  └── WIKI.kernel.init()
       ├── WIKI.models = db.init()   ← Knex + Objection ORM
       ├── configSvc.loadFromDb()    ← Config from database
       ├── configSvc.applyFlags()
       ├── preBootMaster()
       │    ├── initTelemetry()
       │    ├── sideloader.init()
       │    ├── cache.init()
       │    ├── scheduler.init()
       │    ├── servers.init()
       │    ├── extensions.init()
       │    └── asar.init()
       └── bootMaster()
            └── master.js            ← Express app
```

### Express App (server/master.js)

- **Middleware**: compression, cookie-parser, cors, express-session, body-parser, serve-favicon
- **Security middleware**: server/middlewares/security.js
- **Passport**: multiple strategies (21 auth providers)
- **GraphQL**: Apollo Server 2.x via `apollo-server-express`
- **Session store**: KnexSessionStore (connect-session-knex)

### Module System

Modules located in `server/modules/`:

```
authentication/  → 21 providers (local, oauth2, saml, ldap, azure, google, github...)
editor/          → 7 editors (markdown, wysiwyg, asciidoc, code, ckeditor...)
rendering/       → 27 rendering packages (markdown-it plugins, mermaid, mathjax...)
storage/         → 11 providers (git, s3, azure, disk, gdrive, dropbox...)
search/          → 9 engines (algolia, elasticsearch, postgres, azure...)
analytics/       → analytics
comments/        → comments
logging/         → logging
extensions/      → optional extensions
```

---

## 4. Package Upgrade Status

### Overview

| Category | Count |
|----------|:-----:|
| Total dependencies | ~296 |
| Precise pinned (reviewed) | 276 |
| Up-to-date | 119 |
| **Outdated** | **156** |
| Errors | 0 |

### ✅ Phase 1 — Security (completed)

| Package | Old | New | Reason |
|---------|:---:|:---:|--------|
| lodash | 4.17.21 | 4.18.1 | CVE Prototype Pollution |
| dompurify | 3.3.1 | 3.4.10 | XSS fixes |
| passport | 0.4.1 | 0.7.0 | Security fixes |
| request | 2.88.2 | **REMOVED** | Deprecated → native fetch |
| request-promise | 4.2.6 | **REMOVED** | Deprecated → native fetch |
| semver | 7.7.3 | 7.8.4 | Update |
| simple-git | 3.30.0 | 3.36.0 | Update |
| winston | 3.8.2 | 3.19.0 | Update |
| nodemailer | 6.9.1 | 8.0.11 | Update |

### ✅ Phase 2 — Light upgrades (completed)

| Package | Old | New |
|---------|:---:|:---:|
| sass | 1.27.0 | 1.101.0 |
| chokidar | 3.5.3 | 4.0.3 |
| mysql2 | 3.16.0 | 3.22.5 |
| pg | 8.16.3 | 8.21.0 |
| cors | 2.8.5 | 2.8.6 |
| cross-env | 10.0.0 | 10.1.0 |

### ✅ Phase 3 — Medium risk (completed)

| Package | Old | New | Notes |
|---------|:---:|:---:|-------|
| js-yaml | 3.14.0 | 4.2.0 | safeLoad→load in 11 files |
| fs-extra | 9.0.1 | 11.3.5 | |
| cheerio | 1.0.0-rc.5 | 1.2.0 | |
| luxon | 1.25.0 | 3.7.2 | |
| markdown-it | 11.0.1 | 14.2.0 | +7 plugins updated |
| highlight.js | 10.3.1 | 11.11.1 | |
| markdown-it-abbr | 1.0.4 | 2.0.0 | |
| markdown-it-attrs | 3.0.3 | 5.0.0 | |
| markdown-it-footnote | 3.0.3 | 4.0.0 | |
| markdown-it-mark | 3.0.1 | 4.0.0 | |
| markdown-it-multimd-table | 4.0.3 | 4.2.3 | |
| markdown-it-sub | 1.0.0 | 2.0.0 | |
| markdown-it-sup | 1.0.0 | 2.0.0 | |

### ⏳ Skipped

| Package | Reason |
|---------|--------|
| chalk 5.x | ESM only, breaks `require('chalk')` |
| knex 0.21→3.x | Major API changes, pending |
| objection 2→3 | Depends on knex upgrade |
| i18next 19→26 | Major API rewrite |
| mermaid 8→11 | Major version jump |
| graphql 15→16 | Locked in resolutions |

---

## 5. Modified Files

### Files changed (18 total)

| File | Change |
|------|--------|
| `package.json` | 22 version bumps, 2 removals |
| `server/core/config.js` | yaml.safeLoad→yaml.load |
| `server/core/localization.js` | yaml.safeLoad→yaml.load |
| `server/graph/resolvers/contribute.js` | request-promise→native fetch |
| `server/graph/resolvers/system.js` | request-promise→native fetch |
| `server/models/analytics.js` | yaml.safeLoad→yaml.load |
| `server/models/authentication.js` | yaml.safeLoad→yaml.load |
| `server/models/commentProviders.js` | yaml.safeLoad→yaml.load |
| `server/models/editors.js` | yaml.safeLoad→yaml.load |
| `server/models/loggers.js` | yaml.safeLoad→yaml.load |
| `server/models/pages.js` | yaml.safeLoad→yaml.load |
| `server/models/renderers.js` | yaml.safeLoad→yaml.load |
| `server/models/searchEngines.js` | yaml.safeLoad→yaml.load |
| `server/models/storage.js` | yaml.safeLoad→yaml.load |
| `server/modules/rendering/html-image-prefetch/renderer.js` | request-promise→native fetch |
| `server/modules/search/azure/engine.js` | request-promise→native fetch |
| `server/setup.js` | Added null check for telemetry |
| `yarn.lock` | Updated |

### Git Branches

| Branch | Status | Description |
|--------|--------|-------------|
| `main` | ✅ | Original upstream branch |
| `upgrade/phase1-security` | 🟢 Active | Phase 1-3 upgrades |
| `feat-toc` | — | Previous work |
| `scarlett` | — | Previous work |
| `vega` | — | Previous work |

---

## 6. Code Observations

### Good
- Consistent error handling hierarchy (custom-error-instance)
- Modular architecture (each provider in its own folder)
- ESLint standard JS style
- Timing attack protection in local auth (fake bcrypt compare)
- Configuration via YAML + database

### Issues
- **Global `WIKI` object** — makes testing hard (mocking)
- **Low test coverage** — `server/test/` exists but coverage is low
- **Deprecated APIs** — `yaml.safeLoad` (fixed), `babel-eslint`, `@babel/polyfill`
- **`request` package** — unmaintained, replaced with native `fetch()`
- **GraphQL locked at 15.3.0** via `resolutions` — blocks Apollo Server upgrade

### Security
- Error codes (1001-7004) — consistent
- CORS set to `origin: false`
- Session secret from `config.yml`
- `xss` package used for sanitization
- Timing-safe password comparison in local auth

---

## 7. Next Steps

### Phase 4 — Heavy upgrades
- knex 0.21.7 → 3.2.10 (+ objection 2→3)
- i18next 19→26
- Mermaid 8→11

### Phase 5 — Architectural
- Apollo Server 2 → 3 + GraphQL 15→16
- Express 4 → 5
- Webpack 4 → 5
- ESLint 7 → 10

### Phase 6 — Frontend rewrite
- Vue 2 → 3 (Vuetify, Vuex→Pinia, vue-router)

---

## 8. Commands

```bash
# Dev mode
yarn dev

# Build
yarn build

# Tests
yarn test

# ESLint
yarn run eslint --format codeframe --ext .js,.vue .

# Git
git branch
git checkout -b <name>
git branch -d <name>
git status
git diff
git add . && git commit -m "message"
```
