# Wiki.js Helm chart

Deploys Wiki.js 3.x, with a bundled PostgreSQL 18 or an existing PostgreSQL 16+ server.

## Installing

The chart is published as an OCI artifact, so no `helm repo add` is needed:

```sh
helm install wiki oci://ghcr.io/requarks/charts/wiki --version 3.0.0-beta.<build>
```

Pass `--version` explicitly while the chart is a pre-release, because Helm skips pre-release
versions unless you name one or pass `--devel`. With no values set, you get one wiki replica
reachable inside the cluster only, backed by a bundled PostgreSQL on an 8 GiB claim. The first
start runs the database migrations; `kubectl rollout status deployment/wiki` shows when it is done.

Unless `admin.password` is set, the first login is `admin@example.com` / `12345678`, and it has to be
changed.

## Database

### Bundled

`postgresql.enabled: true` (the default) runs the official `postgres:18` image as a single
StatefulSet replica. The wiki connects as `postgresql.auth.username`, an ordinary role that owns its
own database. The `postgres` superuser is never handed to the wiki.

- **Passwords** are generated on first install and kept in the `<release>-postgresql` Secret, which
  survives `helm uninstall`. Tools that render without cluster access, Argo CD among them, would
  generate new passwords on every sync, so set `postgresql.auth.password` and `postgresPassword`, or
  point `postgresql.auth.existingSecret` at a Secret with `password` and `postgres-password` keys.
- **Everything under `postgresql.auth` is applied once**, when the data directory is initialised.
  Changing it afterwards changes what the wiki is told, not the database; alter the role to match.
- **Server settings** go in `postgresql.parameters` (passed as `-c key=value`), first-run SQL or
  shell in `postgresql.initdbScripts`.
- **Major upgrades** (18 → 19) need a dump and restore, as they would anywhere. Pin a minor tag
  (`postgresql.image.tag: "18.4"`) if you want upgrades to happen only when you choose.

For replication, backups and failover, run PostgreSQL with an operator (CloudNativePG, for example)
and use it as an external database.

### External

Set `postgresql.enabled: false`, then say where the server is in **one** of two ways. Fill in
`externalDatabase.connectionString` or `externalDatabase.parameters` and leave the other empty; the
chart refuses to render with both. `externalDatabase.schema` (`wiki` by default) and
`externalDatabase.ssl` apply to either.

The database user needs to own the database, or at least be allowed to create a schema in it.

#### Option 1: a connection string

Passed to the wiki as `DATABASE_URL`, so an operator's generated Secret can be used as it is. For
CloudNativePG:

```yaml
postgresql:
  enabled: false
externalDatabase:
  connectionString:
    existingSecret: mycluster-app # created by CloudNativePG for the cluster's app database
    existingSecretKey: uri
  ssl:
    enabled: true
    existingSecret: mycluster-ca # key: ca.crt
```

`connectionString.value` takes the string itself instead, and the chart stores it in a Secret.
Either way, percent-encode special characters in the password. TLS parameters in the string
(`sslmode`, `sslrootcert`, …) replace everything under `externalDatabase.ssl`. CloudNativePG's
`uri` has none, which is why it is paired with `ssl` and the cluster's CA above.

#### Option 2: individual parameters

```yaml
postgresql:
  enabled: false
externalDatabase:
  parameters:
    host: pg.databases.svc
    database: wiki
    user: wiki
    existingSecret: wiki-db # key: password
  ssl:
    enabled: true
    existingSecret: pg-ca # key: ca.crt, and optionally tls.crt / tls.key
```

## Exposing it

Both can be on at once, which is useful while moving from one to the other.

- **Gateway API**: `httpRoute.enabled`, with `parentRefs` naming your Gateway and `hostnames`.
  `rules` are passed through as written, and the chart adds the `backendRefs`.
- **Ingress**: `ingress.enabled`, `className`, `hosts`, `tls`. Most controllers cap request body
  size, which also caps uploads; raise the limit with the controller's own annotation
  (`nginx.ingress.kubernetes.io/proxy-body-size` for ingress-nginx).

Behind either one, turn on **Admin → Security → Trust Proxy**, so the wiki records the visitor's
address rather than the proxy's.

## Replicas

`replicaCount` can be raised freely. Replicas coordinate through the database, collaborative editing
included, so no sticky sessions are needed.

The data directory (`/wiki/data`) is per replica unless `persistence` points every replica at one
ReadWriteMany claim. That does not matter for the caches it normally holds, which are rebuilt from
the database. It does matter for a **Local Disk** or **Git** storage target left at its default
location under `data/`, which would otherwise be a separate copy on each replica.

With one replica on a ReadWriteOnce claim, set `strategy.type: Recreate`. Otherwise a rolling
update's new pod may land on a node the volume cannot be attached to.

## Hardening

Both workloads run as non-root, with a read-only root filesystem, every capability dropped, no
privilege escalation, `RuntimeDefault` seccomp and no service account token. The wiki writes only to
`/wiki/data`, `/tmp` and `/home/node`; PostgreSQL writes only to its data volume,
`/var/run/postgresql`, `/tmp` and `/dev/shm`.

The one thing the read-only root filesystem rules out is installing an extension from
**Admin → Extensions**, which runs `npm install` inside the image. Puppeteer is already in the
image; to add anything else, build an image `FROM` this one.

## Health and shutdown

`/_live` backs the startup and liveness probes, `/_ready` the readiness probe. The startup probe
allows five minutes for migrations before liveness takes over. `KUBERNETES_SERVICE_HOST` is set on
the container. It switches the wiki's shutdown to Kubernetes semantics: on SIGTERM `/_ready` turns
503 while in-flight and still-routed requests keep being served. The default `preStop` sleep gives
load balancers five seconds to drop the pod first.

## Upgrading

Every build of the wiki publishes a chart of the same version, `3.0.0-beta.<build>`, whose
`appVersion` is that build's image. Upgrading the wiki is therefore upgrading the chart:

```sh
helm upgrade wiki oci://ghcr.io/requarks/charts/wiki --version 3.0.0-beta.<newer> -f my-values.yaml
```

`helm rollback` returns to the previous image along with everything else. Leave `image.tag` unset,
since setting it pins the image no matter which chart version is installed.

## Publishing

The build workflow (`.github/workflows/build.yml`) publishes the chart. It writes the release
version into `version` and `appVersion` in `Chart.yaml`, and pushes the chart to
`oci://ghcr.io/requarks/charts` once the image is up. The two values committed in `Chart.yaml` are
placeholders, so nothing is bumped by hand.

To try a change locally:

```sh
helm lint --strict dev/chart
helm template wiki dev/chart -f my-values.yaml
```
