---
name: wiki-dev-setup
description: Use when setting up local Wiki.js dev environment from scratch — first run, new machine, devcontainer, or after clone
---

# Wiki.js Local Dev Setup

## Steps

1. **Node version** — use `.nvmrc` (v24.12.0):
   ```bash
   nvm use
   ```

2. **Install deps:**
   ```bash
   yarn install
   ```
   `patch-package` runs automatically via `postinstall`.

3. **Config file** — copy sample, never commit `config.yml`:
   ```bash
   cp config.sample.yml config.yml
   ```
   Edit `config.yml`: set `db.type`, host/port/user/pass, and `port` (default 3000).

4. **Database** — create the DB manually in postgres/mysql/sqlite first. Wiki.js runs migrations on first start.

5. **Start dev server:**
   ```bash
   yarn dev
   ```
   Webpack HMR + Node server. Client rebuilds on save. Server requires manual restart on server-side changes.

6. **First-run setup wizard** — browse to `http://localhost:3000`. Complete setup to create admin account and finish DB migration.

## Notes

- `yarn dev` uses `cross-env NODE_OPTIONS=--openssl-legacy-provider` — required for webpack 4 on Node 20+. Do not strip it.
- `yarn watch` builds client only (no server). Use when you want webpack watch without starting the server.
- Devcontainer config at `.devcontainer/devcontainer.json` — use if Docker preferred.
- `save-exact = true` in `.npmrc` — never add `^` to package versions.

## Common Issues

| Problem | Fix |
|---------|-----|
| `ERR_OSSL_EVP_UNSUPPORTED` | Missing `NODE_OPTIONS=--openssl-legacy-provider`. Use `yarn dev` not `node dev`. |
| DB connection refused | DB must exist before starting. Wiki.js creates tables, not the DB itself. |
| Blank page after start | Assets not built. Run `yarn build` or use `yarn dev` (includes webpack). |
| patch-package errors | Delete `node_modules`, re-run `yarn install`. |
