---
paths:
  - "backend/controllers/metrics.ts"
  - "backend/models/metrics.ts"
  - "backend/helpers/network.ts"
  - "backend/api/system.ts"
  - "backend/index.ts"
  - "frontend/src/pages/AdminMetrics.vue"
---

# Metrics

A Prometheus exposition, served by `controllers/metrics.ts` and configured by `models/metrics.ts` —
the `metrics` settings blob, the admin area's **Metrics** screen, `GET`/`PUT /system/metrics`.
Everything about it is read per request through the `WIKI` global, so a change applies at once and on
every instance; nothing here is captured at boot.

- **A hook, not a route**, because the path is a setting and a route table is fixed at boot. It does
  nothing unless the endpoint is enabled AND the path matches, which is exactly what leaves a page at
  `/metrics` serving normally while metrics are off. Turned on, it shadows that page — the one thing
  the endpoint is *allowed* to shadow. `validate` refuses a path whose first segment starts with `_`
  (the server's and the frontend router's namespace) or that names a `RESERVED_ROOT_FILES` entry,
  because breaking those breaks the instance from a screen that cannot then be reached to undo it.
- **It is registered before the SEO hook** in `index.ts`, and that ordering is load-bearing: a metrics
  path looks like a page path, so the redirects there would send a scrape to the site's locale prefix
  or strip a page extension off it. It is registered *after* the session and API key hooks, whose work
  it reads.
- **Anonymous access is per address class** — local, private, external (`helpers/network.ts`,
  `net.BlockList`). An address in a class the operator opened is answered with no credentials at all;
  every other address must hold `read:metrics`, as a bearer API key or as a signed-in session. Which
  is why the bearer hook in `index.ts` lets the metrics path through as well as `/_api/`: one place
  verifies a token. Anything that is not an IP address is `external`, so the unknown case is the
  strict one. What an address *means* depends on `security.trustProxy` — with it off, a wiki behind a
  proxy sees the proxy for every request, and the admin screen says so.
- **Two registries, for two lifetimes.** `collectDefaultMetrics` attaches probes to a registry for the
  life of the process, so the runtime registry is built once, lazily — a wiki that never turns metrics
  on carries no probes. The wiki gauges are database counts, so they are built and thrown away per
  scrape — and are off by default, since a scrape of them costs about a dozen queries. The exposition is line-based, so the two outputs simply concatenate.
- **Runtime metrics are this instance's; wiki metrics are the cluster's.** In an HA set a scrape lands
  on whichever instance answered, which is what `wiki_info`'s `instance` label and
  `wiki_start_time_seconds` are for.
