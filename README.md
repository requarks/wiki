# Shadows Over Westgate Wiki.js Deployment Guide

This repository is a Wiki.js 2.x application checkout with the custom `westgate`
theme built into `client/themes/westgate`.

The important deployment detail: Wiki.js custom themes are compiled into the
application bundle. You cannot deploy the stock `ghcr.io/requarks/wiki:2` image
and expect this theme to appear. Build this repository into a custom Wiki.js
image, then run that image with PostgreSQL.

Official references:

- Wiki.js install overview: https://docs.requarks.io/s/en/install
- Wiki.js Docker install guide: https://docs.requarks.io/s/en/install/docker
- Wiki.js requirements: https://docs.requarks.io/s/en/install/requirements

## Recommended VPS Shape

For a small wiki, use a VPS with:

- Ubuntu 22.04 or 24.04 LTS.
- 2 CPU cores if possible. Wiki.js can run on 1 core, but 2 is better.
- At least 1 GB RAM; 2 GB is more comfortable.
- Enough disk for uploaded assets and database backups.
- A DNS record such as `wiki.example.com` pointed at the VPS.

Wiki.js requires a real domain or subdomain. It is not designed to live under a
subpath such as `example.com/wiki`.

## Install Docker On The VPS

Use Docker Compose so Wiki.js and PostgreSQL are managed together.

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Optional, but convenient:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

## Clone This Repository

```bash
sudo mkdir -p /opt/westgate
sudo chown "$USER":"$USER" /opt/westgate
cd /opt/westgate
git clone <YOUR_REPO_URL> wiki
cd wiki
```

Use the private Shadows Over Westgate repository URL in place of
`<YOUR_REPO_URL>`.

## Create Production Compose Files

Create a deployment directory outside the checkout:

```bash
sudo mkdir -p /opt/westgate/deploy
sudo chown "$USER":"$USER" /opt/westgate/deploy
cd /opt/westgate/deploy
```

Create `.env`:

```bash
cat > .env <<'EOF'
POSTGRES_DB=wiki
POSTGRES_USER=wikijs
POSTGRES_PASSWORD=change-this-long-random-password
WIKI_IMAGE=westgate-wikijs:latest
WIKI_HTTP_PORT=3000
EOF
```

Create `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data

  wiki:
    image: ${WIKI_IMAGE}
    restart: unless-stopped
    depends_on:
      - db
    environment:
      DB_TYPE: postgres
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: ${POSTGRES_USER}
      DB_PASS: ${POSTGRES_PASSWORD}
      DB_NAME: ${POSTGRES_DB}
    ports:
      - "${WIKI_HTTP_PORT}:3000"
    volumes:
      - wiki-content:/wiki/data/content

volumes:
  db-data:
  wiki-content:
```

This keeps PostgreSQL data and Wiki.js local content in Docker volumes.

## Build The Custom Westgate Image

From the repository checkout:

```bash
cd /opt/westgate/wiki
docker build -f dev/build/Dockerfile -t westgate-wikijs:latest .
```

That Dockerfile runs the application build, including:

- `client/themes/westgate/scss/app.scss`
- `client/themes/westgate/js/app.js`
- `client/themes/westgate/components/`
- shared Wiki.js client components and generated server views

This is the step that makes the custom theme exist in production.

## Start Wiki.js

```bash
cd /opt/westgate/deploy
docker compose up -d
docker compose logs -f wiki
```

Open:

```text
http://YOUR_SERVER_IP:3000
```

Complete the first-run Wiki.js setup in the browser.

## Put It Behind HTTPS

For a public VPS, put a reverse proxy in front of Wiki.js. Caddy is the simplest:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```caddyfile
wiki.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy will request and renew TLS certificates automatically. Replace
`wiki.example.com` with the real wiki hostname.

If using Caddy, keep the compose port bound to localhost only:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

Then restart:

```bash
cd /opt/westgate/deploy
docker compose up -d
```

## Select The Westgate Theme

After the first run, sign into Wiki.js as an administrator.

In the admin interface, choose the `Westgate` theme if it appears in the theme
settings. If the admin UI does not expose it cleanly, set it directly in the
database.

Enter PostgreSQL:

```bash
cd /opt/westgate/deploy
docker compose exec db psql -U wikijs -d wiki
```

Inspect the theming setting:

```sql
SELECT key, value FROM settings WHERE key = 'theming';
```

The `value` column is JSON. Make sure its `theme` property is `westgate`, then
restart Wiki.js:

```bash
docker compose restart wiki
```

The exact JSON shape can vary with Wiki.js settings, so inspect before updating.
Do not blindly overwrite unrelated theming settings.

## Updating The Site

When this repository changes:

```bash
cd /opt/westgate/wiki
git pull
docker build -f dev/build/Dockerfile -t westgate-wikijs:latest .
cd /opt/westgate/deploy
docker compose up -d
```

If the database schema changes during a Wiki.js upgrade, watch the logs:

```bash
docker compose logs -f wiki
```

## Backups

Back up PostgreSQL:

```bash
cd /opt/westgate/deploy
docker compose exec db pg_dump -U wikijs wiki > wiki-$(date +%F).sql
```

Back up Docker volumes if you use local file storage:

```bash
docker run --rm \
  -v deploy_wiki-content:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/wiki-content-$(date +%F).tar.gz -C /data .
```

Keep backups off the VPS as well as on it.

## Development Notes

Inside the development container, use:

```bash
yarn dev
```

`yarn dev` live-reloads theme and client changes. During visual iteration, do
not repeatedly run `yarn build`. Use `yarn build` for production-style validation
or when building the deploy image.

## Troubleshooting

If the site loads but does not look like Westgate:

- Confirm the deployed image was built from this repository.
- Confirm the active theme setting is `westgate`.
- Confirm the browser is not serving stale assets.
- Rebuild the image after theme changes.

If Wiki.js cannot connect to the database:

- Confirm `DB_HOST` matches the compose service name, usually `db`.
- Confirm `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` match the
  Wiki.js environment variables.
- Check `docker compose logs db` and `docker compose logs wiki`.

If HTTPS does not work:

- Confirm DNS points to the VPS.
- Confirm ports 80 and 443 are open in the VPS firewall/security group.
- Check `sudo journalctl -u caddy -f`.
