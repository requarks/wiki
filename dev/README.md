# Wiki.js local Docker setup

This repo ships two compose files. Use **one role per file** to avoid confusion.

## Overview

| Compose file | Purpose | Wiki URL | Database |
|--------------|---------|----------|----------|
| `dev/examples/docker-compose.yml` | Prod-like local wiki (official release image) | http://localhost | `examples-db-1` (`examples_db-data` volume) |
| `dev/containers/docker-compose.yml` | Source / UI development (your code changes) | http://localhost:3000 | **Same DB** as examples (`examples-db-1`) |

There is **one Postgres instance** for both stacks. Do not run a second database unless you intentionally want an isolated empty copy.

### Version note

Your local source tracks **Wiki.js v2.5.314** (same commit as `upstream/main` and tag `v2.5.314`).
In development, `package.json` `version` is set to match prod. Official Docker images patch this at CI build time; locally we set it manually so the admin UI shows `2.5.314` instead of `2.0.0`.

---

## Prod-like wiki (port 80)

For running Wiki.js as shipped, with your imported/production data:

```bash
cd dev/examples
docker compose up -d
```

- Image: `requarks/wiki:2`
- DB: `postgres:15-alpine`, volume `examples_db-data`
- Does **not** include local code changes from this repo

**Keep your data safe**

- OK: `docker compose stop`, `docker compose down`
- **Deletes DB**: `docker compose down -v`

---

## UI / code development (port 3000)

For testing changes such as the mobile navbar:

### 1. Ensure the shared DB is running

```bash
cd dev/examples
docker compose up -d db
# or keep the full examples stack up — that's fine too
```

### 2. Start the dev wiki container

```bash
cd dev/containers
docker compose up -d
```

### 3. Install deps and run dev server (first time or after clean volume)

```bash
docker compose exec wiki bash
npm install --legacy-peer-deps
npm run dev
```

Open **http://localhost:3000** — same database as port 80, but serving your local source with hot reload.

> **Important:** `http://localhost` (no port) is **port 80** = prod-like wiki from `dev/examples`.
> Your code changes are on **http://localhost:3000** only.
> To avoid confusion, stop the prod-like wiki while developing UI:
> ```bash
> cd dev/examples && docker compose stop wiki
> ```

### Optional: DB admin UI

Adminer runs at **http://localhost:3001** (server: `db`, user: `wikijs`, password: `wikijsrocks`, database: `wiki`).

---

## Typical daily workflow

```bash
# Terminal 1 — shared database + prod-like wiki (optional)
cd dev/examples && docker compose up -d

# Terminal 2 — dev wiki for UI work
cd dev/containers && docker compose up -d
docker compose exec wiki bash -c "npm install --legacy-peer-deps && npm run dev"
```

Compare:

- http://localhost — official image, no local UI changes
- http://localhost:3000 — your branch, same login/data

---

## Troubleshooting

**`network examples_default not found`**

Start the examples stack first (at least the `db` service):

```bash
cd dev/examples && docker compose up -d db
```

**Dev wiki can't connect to DB**

Check the DB container is up:

```bash
docker ps --filter name=examples-db-1
docker compose -f dev/examples exec db psql -U wikijs -d wiki -c "SELECT 1;"
```

**Mobile UI changes not visible on port 80**

Expected. Port 80 uses `requarks/wiki:2`. UI changes only appear on port 3000 via `dev/containers`.
