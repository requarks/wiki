# Building wikijs-ng locally with Podman

Quick reference for building and running the container image on your own machine. The CI equivalent lives in `.gitea/workflows/build-harbor.yml`.

## Prerequisites

- Podman 4+ (Docker works the same way; on some hosts `docker` is just a Podman alias)
- **Rootless Podman needs subuid/subgid ranges.** If the build fails while pulling the base image with an error like
  `potentially insufficient UIDs or GIDs available in user namespace ... check /etc/subuid`, add ranges for your user and migrate:

  ```bash
  sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 $USER
  podman system migrate
  ```

## Single-arch build (host architecture)

Run from the repository root — the Dockerfile is **not** in the root, so `-f` is required:

```bash
podman build -f dev/build/Dockerfile -t wikijs-ng:local .
```

The build installs all dependencies and compiles the client assets inside the image (first run takes several minutes; Node native modules like `sqlite3` are compiled during install).

Optional version metadata (used for the OCI image labels):

```bash
podman build -f dev/build/Dockerfile \
  --build-arg VERSION="v$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)" \
  --build-arg REVISION="$(git rev-parse HEAD)" \
  --build-arg CREATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t wikijs-ng:local .
```

## Multi-arch build (amd64 + arm64)

Requires QEMU binfmt handlers (one-time per boot):

```bash
podman run --privileged --rm docker.io/tonistiigi/binfmt --install all

podman build --pull \
  --platform linux/amd64,linux/arm64 \
  --manifest localhost/wikijs-ng:local \
  -f dev/build/Dockerfile .
```

Note: the arm64 half runs the full yarn install + webpack build under emulation and is much slower than the native half.

`dev/build-arm/Dockerfile` is **not** used for this — it is only for the GitHub CI flow that reuses pre-built assets from a build artifact.

## Running the image

Quickest start with SQLite (data kept in a named volume):

```bash
podman run -d --name wikijs-ng -p 3000:3000 \
  -e DB_TYPE=sqlite -e DB_FILEPATH=/wiki/data/db.sqlite \
  -v wikijs-data:/wiki/data \
  wikijs-ng:local
```

Then open http://localhost:3000 and complete the setup wizard.

For PostgreSQL & co. either pass the `DB_*` environment variables (see `dev/build/config.yml` for the supported set) or mount your own config:

```bash
podman run -d --name wikijs-ng -p 3000:3000 \
  -v ./config.yml:/wiki/config.yml:ro,Z \
  wikijs-ng:local
```

A full compose example (app + PostgreSQL) is in `dev/examples/docker-compose.yml`.

## Known harmless build warnings

- `warning lru.min@…: The engine "bun"/"deno" appears to be invalid` — Yarn 1 does not know the `bun`/`deno` engine fields declared by that package (a mysql2 dependency); nothing to fix.
- `info There appears to be trouble with your network connection. Retrying...` — transient registry hiccup, Yarn retries automatically.
