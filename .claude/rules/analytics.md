---
paths:
  - "backend/modules/analytics/**"
  - "backend/models/analytics.ts"
  - "backend/api/analytics.ts"
  - "backend/helpers/appShell.ts"
  - "frontend/src/pages/AdminAnalytics.vue"
---

# Analytics

A tracking tag from one of a dozen third-party services, turned on per site under **Admin →
Analytics**. `models/analytics.ts`, `api/analytics.ts` and `modules/analytics/<key>/`.

**A module here is two YAML files and nothing else.** `definition.yml` declares what the provider is
and what it needs configured (the same `props` shape every other module type uses, read through
`parseModuleProps`), and `code.yml` holds the markup it contributes. There is no `analytics.ts`
beside them and there is nothing to load: the whole of what a provider does happens in the reader's
browser, so the wiki's only job is to put the right string in the right place. Unlike
`modules/storage/`, a directory that cannot be read is skipped with a warning rather than emptying
the list — a provider nobody can turn on is better than every site's existing tags going quiet.

**The markup is served, never injected by the app.** It goes into the document `renderAppShell`
hands out, so it is in the HTML of every response — including the one a client that will not run
JavaScript receives. That is the point rather than an implementation detail: several providers verify
an installation by fetching the page and looking for their snippet, which a tag the SPA adds after
boot would fail, and a tag that arrives after boot has already missed the page load it exists to
measure. `code.yml` has two slots, `head` and `bodyStart`; the second exists only because Google Tag
Manager's `<noscript>` fallback is an `<iframe>` and so cannot go in the head. The analytics head goes
in ahead of the theme's own head injection — a tag runs as early as it can, and the theme field is an
override.

**The administration area is the exception and gets no tag.** What happens under `/_admin` is the
wiki being configured rather than read, and it has no business in a report of what a site's readers
looked at — nor in whatever a session-replay provider would make of somebody typing a credential into
an authentication strategy. `analyticsInjections` sorts documents by their own URL and nothing else,
so it is a hard navigation to an admin path that comes back clean; walking into the admin area
through the app still carries whatever tag the document it started from loaded, and there is no
taking that back without the per-provider client-side layer described below.

**The consequence is that a provider sees the initial document load and no more.** This is a single
page app, so moving between wiki pages is a router transition and not a navigation; a provider that
reports views on its own (`gtag`'s page_view, Plausible's automatic pageview) will count one per hard
navigation. There is no per-provider client-side layer dispatching a view per route change, and
adding one means writing a dispatch for each provider's own API.

**Configuration lives in the site's config blob**, under `analytics.providers`, keyed by module —
not in a table. Every request that produces a document needs it, `WIKI.sites` already holds the site
configurations in memory on every instance, and `sites.updateSite` already reloads them across the
cluster and drops the app shell cache. So a tag costs no query and a saved change applies to the next
request.

**Values are escaped by context, declared in the template.** A placeholder is `{{js:prop}}`,
`{{attr:prop}}`, `{{num:prop}}` or `{{bool:prop}}`, because the same value goes into different
places — a Matomo server URL is a JavaScript string in the tracker and an attribute in the
`<noscript>` pixel below it. The `js` escape also covers `<`, `>` and `&` as `\uXXXX`: the contents
of a `<script>` are not parsed for entities, but the HTML parser still ends the element at
`</script`. This is about **correctness**, not privilege — `manage:sites` is the trust boundary here,
the same as for the raw head and body fields under **Admin → Theme** that this markup lands beside.

**An enabled provider with an empty required prop renders nothing at all.** `requires` in the
definition names the props that must be filled; a tag carrying an empty tracking ID is not collecting
less, it is reporting to nothing, so the provider is skipped and the admin area names the empty field
instead. A `num` placeholder that is not a number drops its whole snippet for the same reason — a bare
`var x=;` would take every other script on the page with it.

**Nothing here can be `sensitive`.** Every value is rendered into a document served to the public, so
a prop that had to be kept out of a browser could not be used by a provider in the first place. This
is why `api/analytics.ts` is the one module-prop surface with no `maskSensitiveProps` on the way out.
