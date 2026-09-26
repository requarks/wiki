# `wiki.directory` — connecting wikis to each other

**Status:** a proposal. Nothing here is implemented. The building blocks have been chosen —
[§9](#9-decisions-taken) — but every name, path and payload shape below is still illustrative.
**Covers:** what a small shared service at `wiki.directory` could do for Wiki.js instances, what each
wiki would have to expose for it to work, and which existing standards it is built from.

`wiki.directory` is a domain intended to make wikis discoverable to each other and to make linking
between them dependable. An administrator opts a site in, and in return links to it from other wikis
survive the site moving domain, its pages moving path, and the other wiki never having heard of it
before.

The hard constraint is that **`wiki.directory` must stay light**: no content database, no crawler, no
relay that traffic has to pass through. Every feature below is judged against that.

**Standards first.** Where an existing protocol does the job, it is used as written — AT Protocol's
handle pattern, WebFinger, Webmention, OpenSearch, Robust Links and Memento. What is left over and
genuinely new is small: a site identity that outlives its domain, and three page-level endpoints that
turn a page UUID into where the page is now. [§8](#8-prior-art-and-what-was-not-chosen) covers what
was considered and not chosen.

---

## 1. Goals and non-goals

**Goals**

- **Links between wikis that do not rot.** A reference from wiki A to a page on wiki B keeps working
  when B changes domain or the page is moved — and when B is gone for good, still leads somewhere.
- **Discovery.** Somebody can find wikis about a subject, and a wiki can find its neighbours.
- **Connections that are cheap to make.** Previews, backlinks, shared search — each a small exchange
  between two wikis rather than a service somebody has to run.
- **Works with one participant.** Anything that is only valuable once hundreds of wikis have joined
  will never get them. The first feature shipped should pay for itself on day one
  ([§4.4](#44-a-shared-interwiki-map) is the candidate). Using standards helps here too: a Webmention
  from a blog or an OpenSearch query from a browser is useful whether or not anybody else runs Wiki.js.

**Non-goals**

- **A central index of content.** The directory never holds a page, a search index or a copy of
  anything a wiki publishes.
- **A relay.** Wikis talk to each other directly. The directory is asked "where is this wiki and what
  is its key", and nothing else is routed through it.
- **ActivityPub-scale federation.** Following, timelines and replication of edits are a different and
  much heavier project. Nothing here precludes it; nothing here needs it.
- **Non-public content.** Everything exchanged between wikis is what the public may already read on
  the wiki answering. See [§3.1](#31-the-public-scoping-rule).

---

## 2. Architecture: a phone book, not a hub

The directory holds one small **signed record per participating site**. Everything else — content,
search, permissions, backlinks — stays on the wikis themselves.

### 2.1 Identity is a key, not a domain

A site that opts in ([§3.3](#33-nothing-happens-until-a-site-opts-in)) generates an Ed25519 keypair ([RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)).
The **key is the site's identity**; the domain is merely where it currently lives. Changing domain is
publishing a new record signed by the same key, and nothing that refers to the site by its handle or
key has to change.

**Per site, not per instance.** One Wiki.js instance hosts several sites on different hostnames, and
they are unrelated to the outside world. Each site has its own key and its own record. The private key
is a secret of the site and is stored like any other `sensitive` value — never served, masked at the
API boundary.

### 2.2 The record

```json
{
  "handle": "example",
  "key": "ed25519:MCowBQYDK2VwAyEA…",
  "baseUrl": "https://wiki.example.org",
  "manifest": "https://wiki.example.org/.well-known/wiki",
  "updatedAt": "2026-09-26T12:00:00.000Z",
  "sig": "…"
}
```

- **`handle`** is the short human name, unique across the directory and used in links
  (`example:Some Page`). It is a pointer to the key, not the identity itself.
- **`sig`** covers the canonical form of every other field. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)
  (JSON Canonicalization Scheme) is the obvious candidate for "canonical".
- **`updatedAt`** is what makes a replayed old record lose to a newer one.

### 2.3 Why signed records

Because the directory cannot forge a record, it only has to **store and serve** them, and that is
what keeps it light:

- It can be a Cloudflare Worker over KV, static JSON files behind a CDN, or a git repository that
  sites register in by pull request (the model the Public Suffix List and Homebrew taps use). Any of
  these is a few kilobytes per site.
- **Anyone can mirror it**, and a mirror is as trustworthy as the original, because a wiki verifies
  the signature and not the server it got the record from.
- **Wikis cache records for days.** The directory being down stalls new lookups; it does not break a
  single link that has been resolved before.

### 2.4 Handles: the AT Protocol pattern

A site has two names, and they are verified the way AT Protocol (Bluesky) verifies a handle against an
identity: **in both directions, or not at all**.

- **Its domain**, `wiki.example.org`. The domain names the key, through either
  - a DNS TXT record at `_wikidirectory.wiki.example.org` reading `key=ed25519:…` — AT's
    `_atproto.<handle>` record, or
  - the key published in `https://wiki.example.org/.well-known/wiki`
    ([RFC 8615](https://www.rfc-editor.org/rfc/rfc8615)) — AT's `/.well-known/atproto-did`.
- **Its short handle**, `example`, which is also the host `example.wiki.directory` — the equivalent of a
  provider-hosted handle like `alice.bsky.social`. It is allocated by the directory and names the key
  through the signed record.

**A binding counts only when both sides agree.** The record, signed by the key, says the site lives at
`wiki.example.org`; the domain, independently, says its key is that key. A record alone could claim
anybody's domain, and a domain alone could point at anybody's key, so a resolver that sees only one
half treats the binding as absent. This is the AT rule, and it is what lets the directory accept
registrations without judging them.

The well-known file is the default because the wiki can serve it itself with no DNS access; the TXT
record exists for the case where the wiki cannot answer yet — a migration in progress.

Because the domain is verified directly, **the directory is optional for anybody who already has the
domain**: `wiki.example.org` resolves to a key with no lookup at `wiki.directory` at all. The directory
adds the short handle, and the ability to find a site again after its domain has changed.

### 2.5 Rotation and recovery

- **Rotation:** the old key signs a record naming the new one. The chain is kept, so a verifier that
  cached the old key can follow it.
- **Recovery** from a lost key: re-prove control of the domain currently in the record, after a
  waiting period during which the old key may object. This is the one path where the directory
  exercises judgement, and so the one that most needs a written policy.
- An alternative worth weighing is did:plc's arrangement: a second **recovery key**, kept offline by
  the administrator, that can override anything the working key signed within a fixed window
  (72 hours in did:plc). Recovery then needs no judgement from the directory, at the price of an
  administrator having to keep a key somewhere safe for years.

### 2.6 The manifest

`/.well-known/wiki` describes the site and names the endpoints that are specific to this proposal:

```json
{
  "handle": "example",
  "key": "ed25519:…",
  "name": "Example Wiki",
  "description": "…",
  "locales": ["en"],
  "license": "CC-BY-4.0",
  "logo": "https://wiki.example.org/_site/…/logo",
  "software": { "name": "wikijs", "version": "3.0.0" },
  "endpoints": {
    "resolve": "/_api/federation/resolve",
    "status": "/_api/federation/pages/status",
    "describe": "/_api/federation/pages/{id}"
  }
}
```

**Where a standard defines its own discovery, the manifest does not repeat it.** WebFinger lives at
`/.well-known/webfinger`; a Webmention endpoint is announced by a `rel="webmention"` link on the page
it is for; an OpenSearch description by `rel="search"` in the document head; a Memento TimeGate by
`rel="timegate"`. Listing them here as well would give a client two answers to disagree between, and
a non-Wiki.js client knows the standard mechanism and not this file.

The directory caches the manifest; the listing in [§4.5](#45-discovery) is built from those copies.

---

## 3. What a participating wiki exposes

**Specific to this proposal** — named in the manifest:

| Endpoint   | Purpose                                                          | Used by                 |
| ---------- | ---------------------------------------------------------------- | ----------------------- |
| `resolve`  | path or alias → page UUID                                        | authoring a link, §4.1  |
| `status`   | batch of UUIDs → `ok` / `moved` / `gone`, current path and title | link revalidation, §4.1 |
| `describe` | one UUID → title, description, icon, locale, last edited         | previews, §4.2          |

**Standard** — discovered the standard's own way:

| Standard | What the wiki serves | Used by |
| -------- | -------------------- | ------- |
| [WebFinger](https://www.rfc-editor.org/rfc/rfc7033) (RFC 7033) | `/.well-known/webfinger?resource=acct:…` for users with a handle | mentions, §4.8 |
| [Webmention](https://www.w3.org/TR/webmention/) (W3C) | an endpoint receiving `source`/`target` notifications | backlinks, §4.3; mentions, §4.8 |
| [OpenSearch 1.1](https://github.com/dewitt/opensearch) | a description document and a results feed | federated search, §4.5 |
| [Memento](https://www.rfc-editor.org/rfc/rfc7089) (RFC 7089) | a TimeGate and a TimeMap per page, over the versions `/_version/<id>` already serves | durable links, §4.1; upstream tracking, §4.6 |

All of them are read-only except the Webmention endpoint, all are open to anonymous callers, and all
need CORS so that a reader's browser can call them directly where that is the design (previews and
embedding, §4.2; the reader's link menu, §4.1).

### 3.1 The public scoping rule

**Every endpoint answers as the public.** A remote wiki is an anonymous client, so what it learns
about a page is exactly what the guests group may read — through `groups.actorForPublic()`, the actor
the sitemap and the crawler half of the app shell are already built from, and
`pages.describePageForPublic`, which already produces the description `describe` needs. Search results,
TimeMaps and mementos are cut the same way, and history is its own permission: a version is served
only where the guests group holds `read:history` on the page as well as `read:pages`, the same terms
`/_version/<id>` already applies to anybody else. Otherwise it does not exist, as far as a remote
caller can tell.

A page the public may not read, an unpublished page and a page that does not exist are **one answer**,
for the same reason the app shell gives them one 404: the difference is not something to tell whoever
is asking. So a link to a private page on another wiki is indistinguishable from a broken one, and
that is correct.

### 3.2 Abuse

These endpoints are public and some are batch-shaped, so each needs a rate limit and a batch-size cap
— the postgres-backed counter `helpers/rateLimit.ts` already provides. The Webmention endpoint also
makes the wiki fetch a URL somebody else chose (to verify the source), so it gets the protections any
outbound fetch of a user-supplied URL needs: no private addresses, a size cap, a timeout, and
verification in a job rather than in the request. Each site keeps a block list of handles and of
source domains.

### 3.3 Nothing happens until a site opts in

Participation is **off by default and switched on per site**, from the **Discovery** card under
**Administration → General**: the "Make Discoverable in the Wiki Directory" toggle. It already exists —
the site config key `discoverable`, `false` by default (`models/sites.ts`, `api/sites.ts`,
`AdminGeneral.vue`) — and nothing reads it yet. General is behind `manage:sites`, which is the
permission registering needs anyway (§6).

**Off**, which is how every site starts, nothing in this document exists for that site. No key is
generated and no record is published; `/.well-known/wiki` and every endpoint in the tables above
answer 404; no `rel` links or `Link` headers are added to its documents; and it makes no request to
`wiki.directory` or to any other wiki.

**On**, the site:

- generates its key if it has none, and publishes its record;
- serves the manifest and the endpoints above, subject to the finer controls below;
- appears in the browsable listing (§4.5), which is what the toggle's own label promises.

**Turning it off again** publishes a signed deactivation of the record rather than simply deleting
it, so the directory, its mirrors and every wiki holding a cached copy learn the handle is withdrawn
instead of waiting for the cache to run out. It then stops serving everything above. The key is kept,
so switching back on is the same site under the same handle. Links other wikis already hold keep
working as ordinary links, because their `href` is direct (§4.1); what stops is their ability to
follow the site after a move.

**Finer controls, in the same card**, shown only while the toggle is on. The controls and their
defaults are a proposal:

| Control | Default when on | What turning it off withholds |
| ------- | --------------- | ----------------------------- |
| Show in the public listing | on | the §4.5 listing only — wikis that already know the handle still resolve it |
| Accept backlinks | from registered wikis | the Webmention endpoint (§4.3); the choices are off, registered wikis only, or everyone |
| Allow search from other wikis | on | the OpenSearch description and results (§4.5) |
| Allow previews and embedding | on | `describe`, and the CORS on it (§4.2) |
| Allow mentions of users | off | WebFinger (§4.8) |
| Link to other wikis | on | the outgoing half: resolving other sites' handles, fetching the interwiki map, sending Webmentions |

`resolve` and `status` have no control of their own: answering for its own pages is what
participating *is*, so they follow the toggle itself.

**Deliberately not in the card: whether versions are public.** That is the guests group's
`read:history` (§6) — a permission, set where permissions are set, and one this feature must not
change on the site's behalf.

**The instance's `offline` setting overrides all of it.** An offline instance makes no outbound
request for icons today, and it makes none for this either: it neither publishes a record nor
resolves one, whatever the card says.

---

## 4. Features

### 4.1 Durable cross-wiki links

The headline feature. Pages have stable UUIDs, and `/i/:pageId` already resolves one to wherever the
page currently lives (`helpers/pageLinks.ts`, `kind: 'pageId'`). So a durable reference is
**handle + page UUID**, resolved in two steps:

1. **handle → current `baseUrl`**, from the directory record (cached). This absorbs a domain move.
2. **`baseUrl/i/<uuid>` → current path**, by wiki B's own redirect. This absorbs a page move.

A third case — **B is gone for good** — is what Robust Links and Memento are for, below.

**Authors write names; the wiki stores identities.** The author writes
`[[example:Guides/Getting Started]]` — the wikilink syntax with an interwiki prefix. At save time wiki A
calls B's `resolve` endpoint for that path and keeps the UUID alongside the name: the name so the
source stays readable, the UUID as the real target.

#### The stored render: a Robust Link

A render is produced once, in the editor's browser, so whatever the link needs later has to be in the
markup from the start. [Robust Links](https://mementoweb.org/robustlinks/spec/) is the existing
convention for exactly that — an ordinary `<a>` that also records *when* it was made and *where a
copy from that time is*, so that a reader can get to what the author cited after the live page has
changed or gone:

```html
<a href="https://wiki.example.org/guides/getting-started"
   data-versiondate="2026-09-26"
   data-versionurl="https://wiki.example.org/_version/9f1c…"
   data-wiki-ref="example/5b0c7e2a-…">Getting started guide</a>
```

- **`href`** is B's direct URL as `resolve` reported it at save time. A click goes straight to B and
  never touches the directory.
- **`data-versiondate`** is the Robust Links date of linking. On its own it is enough to ask any
  Memento TimeGate — B's own or a web archive's — for the version nearest to it, years later.
- **`data-versionurl`** is a memento of the page as it was when linked: B's own `/_version/<id>` URL
  where the public may read B's history (below), a web archive snapshot where one was made, or
  absent.
- **`data-wiki-ref`** is the one attribute this proposal adds: the durable reference, from which the
  current location can always be worked out again.

Robust Links' rule is that when `href` is the live page, the version attributes are what is recorded,
and `data-originalurl` is used only when `href` points at the memento. The live page is the right
`href` for a wiki, which is linking to a living document rather than citing a fixed text.

The sanitiser in `models/rendering.ts` has to allow these four attributes on `<a>`, if it does not
already.

#### Keeping the `href` right

`pageLinks` gains a `remote` kind, so that the link table — which today deliberately records nothing
leaving the wiki — tracks these. A scheduled task posts batches of UUIDs to each linked site's
`status` endpoint:

- `moved` updates the stored `href`, or — more conservatively — reports "N links point to moved
  pages" for an editor to accept (open question, [§10](#10-open-questions)).
- `gone` flags the link as broken on the page and in a link report. `gone` is more useful than a bare
  404: B can answer with a tombstone carrying the title the page had and, where it was merged, where it
  went.
- A site whose handle has been deactivated, or that has not answered for long enough, is marked as
  **gone as a whole**, and its links switch to their archived form (below).

#### What a reader sees

A link carrying `data-wiki-ref` gets a small menu in the reader's browser, in the manner of the
reference `robustlinks.js`, but drawn by the app:

- **Current page** — `href`, or `https://example.wiki.directory/i/<uuid>` when revalidation has said the
  `href` is stale and it has not been rewritten yet.
- **As it was on 26 September 2026** — `data-versionurl` when present, otherwise a TimeGate asked for
  `data-versiondate`.
- **Copy durable link** — the redirector form, which is what a link pasted into an email should be,
  since there is no wiki behind that email to revalidate it.

#### Memento: the version as linked

[Memento](https://www.rfc-editor.org/rfc/rfc7089) (RFC 7089) is the HTTP-level half of Robust Links:
a **TimeGate** takes an original URL and an `Accept-Datetime` and redirects to the **memento** — the
version current at that time — and a **TimeMap** lists every memento there is. A wiki with page
history is a natural Memento origin server; MediaWiki has had an extension doing exactly this for a
decade.

- **B serves its own mementos.** Every version already has a URL of its own, `/_version/<id>`, which
  is the memento. What Memento adds around it: each page document carries
  `Link: <…/timegate>; rel="timegate", <…/timemap>; rel="timemap"`; the TimeGate maps a datetime to the
  `pageHistory` version current then and redirects to its `/_version/<id>`; and that document is served
  with `Memento-Datetime` and a `rel="original"` link back to the page. This is what `data-versionurl`
  points at, and it means "as it was when linked" works with no third party involved — where the
  public may read the page's history (§3.1, §6).
- **Web archives cover B being gone.** When B no longer answers, the same `href` and
  `data-versiondate` go to a public TimeGate instead — the Internet Archive's, or an aggregator such as
  Memento Time Travel that asks several archives at once. That only finds something if an archive
  captured the page, which is why A may *ask* for a capture at link time (open question, §10).
- **The TimeMap doubles as the history endpoint** for upstream tracking ([§4.6](#46-reusing-content-across-wikis)),
  so there is no separate `history` endpoint to specify.

A reader's browser cannot set `Accept-Datetime` on a plain navigation, so the "as it was" item asks the
TimeGate with `fetch` and then navigates to the `Location` it answers with. B's TimeGate therefore
needs CORS that allows the `Accept-Datetime` header and exposes `Location`.

#### The redirector

`https://example.wiki.directory/i/<uuid>` costs almost nothing to run: wildcard DNS on
`*.wiki.directory` and a Worker that reads the handle's record and answers 302 to
`<baseUrl>/i/<uuid>`. Its job is the **current** location and nothing more. It cannot do the archival
fallback — it knows a UUID, not what URL the page had or when it was linked — which is precisely why
that information lives in the Robust Links attributes of the render rather than anywhere central.

### 4.2 Previews and embedding

Once A can address `example/<uuid>`, it can ask B to `describe` it:

- **Hover cards** on cross-wiki links — title, summary, icon, last edited — in the way Wikipedia's
  page previews work. Fetched in the reader's browser, cached briefly, never stored by A.
- **Embedding a section** as a block: `<block-remote-page ref="example/<uuid>#section">`, a read-only
  excerpt with an attribution line. Fetched by the reader's browser over CORS, so A holds nothing.
  The manifest's `license` decides whether the block agrees to render at all, and the excerpt goes
  through the same sanitiser rules as any render.

### 4.3 Backlinks across wikis: Webmention

"Referenced by 3 other wikis", on B's page. This is [Webmention](https://www.w3.org/TR/webmention/)
as written, with a signature layered on top for wikis in the directory.

**The standard part:**

1. B announces its endpoint on every page document: `Link: <https://wiki.example.org/_webmention>;
   rel="webmention"`. The app shell (`renderAppShell`) is where that header goes.
2. When A saves a page that links to a page on B, A fetches the target, discovers the endpoint, and
   POSTs `source=<A's page URL>&target=<B's page URL>` as `application/x-www-form-urlencoded`.
3. B answers `202 Accepted` and verifies in a job: it fetches `source` and checks that it really links
   to `target`. The crawler half of A's app shell already puts the page's render in the document, so
   the link is there to find with no JavaScript run — and fetching it anonymously is also what proves
   the source page is public.
4. When A removes the link, or deletes the page, it sends the same notification again. B re-verifies,
   finds the link gone or the page answering 404/410, and drops the backlink.

**The addition:** a Webmention from a wiki in the directory is signed with that site's key using
[HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421) (RFC 9421), with the handle as the
key id. B checks it against the directory record.

- **Signed** Webmentions from registered sites are accepted once verified.
- **Unsigned** ones — any blog, any IndieWeb site, any other wiki engine that speaks Webmention — are a
  per-site setting: refused, accepted, or held for moderation. Holding needs a moderation queue that
  does not exist yet.

The directory sees none of this. Because the transport is standard, a Wiki.js site gets backlinks from
the whole Webmention-speaking web on day one, whether or not a single other wiki has joined.

The same endpoint carries **cross-wiki mentions** (§4.8): a mention is a Webmention whose target is the
mentioned user's profile URL.

### 4.4 A shared interwiki map

The cheapest feature and the one that is useful with a single participant. MediaWiki has had
interwiki prefixes for twenty years, but each installation keeps its own table by hand.
`wiki.directory/interwiki.json` would be one shared map:

- **Registered sites** resolve durably, through §4.1.
- **Everything else** is a URL template — `wikipedia:` → `https://en.wikipedia.org/wiki/$1`,
  `rfc:` → `https://www.rfc-editor.org/rfc/rfc$1`, `arch:`, `mdn:` and so on — with no durability
  and no claims beyond "this is where that prefix points". Wikimedia's global interwiki map on Meta is
  the obvious seed, rather than starting empty.

Each site can add prefixes of its own on top, and override shared ones. The map is static JSON, so it
is served from a CDN and cached by every wiki.

### 4.5 Discovery

- **A browsable listing** at `wiki.directory`, built from the cached manifests of discoverable sites
  that have not turned off **Show in the public listing** (§3.3) — a site may want durable links
  without appearing in a directory. Topics, languages, license, size, recent activity. Static, regenerated
  on a schedule.
- **Federated search over OpenSearch, run by the wiki and not the directory.** Described below.
- **Collections.** A signed list of handles — "every team wiki of one organisation". Members get a shared
  navigation strip, prefix resolution scoped to the collection, and search across the collection by
  default. This suits organisations that run many small wikis more than any single feature above.

#### OpenSearch

Each site publishes an [OpenSearch 1.1](https://github.com/dewitt/opensearch) description document
and announces it in the document head, which the app shell writes:

```html
<link rel="search" type="application/opensearchdescription+xml"
      title="Example Wiki" href="/_site/opensearch.xml">
```

Under `/_site`, the per-site resource controller, rather than at the root: a root file name has to be
added to `RESERVED_ROOT_FILES` and taken away from pages, and nothing about OpenSearch needs the root.

The description declares URL templates by result type:

- **`text/html`** → the wiki's own search page. This alone makes browsers offer the wiki as a search
  engine, which is worth having independently of anything else here.
- **`application/atom+xml`** → results as an Atom feed with the `opensearch:` elements
  (`totalResults`, `startIndex`, `itemsPerPage`). This is the interoperable form, and what A reads
  from a peer that is not Wiki.js.
- **`application/json`** → the same results with what a Wiki.js peer can show and Atom has no place
  for: locale, icon, tags, the page UUID.

Federated search is then: an administrator picks peer sites; the search page offers "also search in
…"; A fetches each peer's description once, fills in the template, and merges the results. There is
no central index, and the directory's only part was telling A where the peers are — and for a peer
named by its domain, not even that.

### 4.6 Reusing content across wikis

- **Fork with an upstream.** Import a page from B into A and record `derivedFrom: example/<uuid>` with the
  memento it was copied from. A later look at B's TimeMap shows whether newer mementos exist —
  "upstream has changed since this was copied" — and the two mementos give the diff. Shared
  procedures, style guides and templates are the use case. The copy's attribution line is itself a
  link to B, so B learns about the fork through an ordinary Webmention.
- **Translations across wikis.** A page's translation group (`localeGroupId`) currently links pages of
  one site. A group with a remote member would let a community run a French wiki that is formally a
  translation of an English one, and send the locale switcher across.

### 4.7 A block registry

`.wkblock` ([wkblock.md](./wkblock.md)) already makes a block a single, checksummed file installed by
upload. `wiki.directory` is the natural catalogue for them:

- Authors sign packages with a key of their own, registered the same way a site's is.
- **Administration → Content Blocks** gains a browse view that lists community blocks and installs one
  by URL, with the signature checked before the importer's own checks run.
- The directory holds metadata, the checksum and the signature; the package itself can stay on the
  author's release page.

This answers the first of `wkblock.md`'s known gaps — that a signature proves nothing useful without
a notion of publishers — by providing the publishers. The same shape fits the YAML-only module types
(analytics and comment providers) and icon sets, all of which are data rather than server code.

### 4.8 Identity across wikis

The heaviest idea, and the one to leave until the rest has proven itself.

#### Mentions: WebFinger, then Webmention

`@alice@example` in a page on A names Alice on B. Handles are already unique per wiki (`users.handle`),
so the pair is unique across the directory.

1. **`example` → `wiki.example.org`**, through the directory. A mention written with the domain,
   `@alice@wiki.example.org`, skips this step — the same form the fediverse uses.
2. **WebFinger** ([RFC 7033](https://www.rfc-editor.org/rfc/rfc7033)):
   `GET https://wiki.example.org/.well-known/webfinger?resource=acct:alice@wiki.example.org` answers a JRD
   whose `http://webfinger.net/rel/profile-page` link is Alice's profile, `/_user/<userId>`. Only an
   account with a handle has an answer; one without is not mentionable, exactly as it is locally.
3. **Webmention** to B, with `target` set to that profile URL. B verifies it as any other (§4.3) and
   notifies Alice.

**A caveat from verification:** Webmention requires the source document to contain the link, and the
crawler half of the app shell carries the page render only. Comments are rendered in the browser at
display time, so a mention inside a comment is not in any document B could fetch. Mentions are
therefore limited to page content, unless the crawler document grows the page's comments.

#### "Sign in with your wiki"

Each site can act as an OIDC or IndieAuth provider for its own users, with WebFinger and the
directory supplying discovery. Alice comments on C with her identity from B and no account on C.

The trust questions here — what C should believe about an identity B vouches for, and what happens
when B is hostile — are real and are not answered by anything in this document.

---

## 5. What already exists

| Piece | Where | Relevant to |
| ----- | ----- | ----------- |
| Page UUIDs and `/i/:pageId` | `db/schema.ts` `pages.id`, `frontend/src/router/routes.js` | §4.1 |
| Link table with kinds | `db/schema.ts` `pageLinks`, `helpers/pageLinks.ts` | §4.1 revalidation |
| Wikilink syntax | `frontend/src/renderers/modules/markdown-it-wikilinks.js` | §4.1, §4.4 prefixes |
| Page history | `pageHistory` | §4.1 mementos, §4.6 |
| A URL per version | `/_version/:versionId`, `GET /sites/:siteId/versions/:versionId` | §4.1 mementos |
| The app shell: head, headers, crawler body | `helpers/appShell.ts` | §4.1 `Link` headers, §4.3, §4.5 |
| The public as an actor | `groups.actorForPublic()` | §3.1 |
| A page described for the public | `pages.describePageForPublic` | `describe`, §4.2 |
| Per-site resource routes | `controllers/site.ts` (`/_site`) | §4.5 OpenSearch description |
| Sitemap with `hreflang` | `controllers/rootFiles.ts` | §4.5 |
| Translation groups | `pages.localeGroupId` | §4.6 |
| Unsigned block packages | `helpers/wkblock.ts`, `blocks/package.mjs` | §4.7 |
| User handles and profile pages | `users.handle`, `/_user/:userId` | §4.8 WebFinger |
| Postgres-backed rate limiter | `helpers/rateLimit.ts`, `models/rateLimits.ts` | §3.2 |
| The Discovery card and `discoverable` | `AdminGeneral.vue`, `models/sites.ts`, `api/sites.ts` | §3.3 |

None of WebFinger, Webmention, OpenSearch or Memento is implemented anywhere today.

---

## 6. Prerequisites in the wiki itself

**A page UUID has to be a permanent identity**, and today it is not quite one:

- **A storage import mints new ids.** `pageMeta` in `helpers/storageFiles.ts` writes no `id` into a
  page file's front matter, so a site rebuilt from its disk or git target comes back with every page
  under a new UUID, and every durable link pointing at it breaks. Writing the id, and honouring it on
  import when it does not collide, closes that.
- **A restore into a different site re-keys everything** — by design, per
  [wkbackup.md §4](./wkbackup.md#4-identity-derive-uuids-do-not-map-them), so a copy can sit beside
  the original. That is right for a copy and wrong for a site that is *moving* to a new instance. A
  move should either restore into the same site id, or the re-keying should be recorded so that the
  old UUIDs keep redirecting.

**Mementos are only as public as history is.** Every version already has a URL of its own —
`/_version/<id>` — so nothing new is needed to address one. But reading it takes `read:history` on the
page as well as the right to read the page, and nothing is granted by default, so on most wikis the
public holds no `read:history` anywhere. There, the "as it was when linked" link would answer 404 to
every reader on another wiki, and `data-versionurl` should not be written at all. A site that wants
the version as linked to work grants guests `read:history` where it wants that — this proposal must
not loosen it on the site's behalf. `data-versiondate` still leads to a web archive either way.

What Memento adds on top of the existing route is headers — `Memento-Datetime` and `rel="original"`
on the `/_version/<id>` document the app shell serves — plus the TimeGate and TimeMap.

**The site's key needs a home**: a site-level secret, masked like other `sensitive` values, included in
a backup (or a restored site cannot prove it is the same site) and excluded from anything served.

**Naming.** The Webmention endpoint is not called an "inbox" anywhere in the product: `/_inbox` is
already the user's own messages and review queue.

**Registering is the Discovery card on Administration → General** (§3.3), and `manage:sites` — the
permission General already requires — is the one that covers what it touches. No new global permission is proposed here; if one turns out to be needed,
that is the maintainer's call.

---

## 7. Suggested order

1. **Identity:** keys per site, signed records, the two-way handle check, `/.well-known/wiki`, the
   directory as a store of records — all switched by the existing `discoverable` toggle, with the
   finer controls of §3.3 added as each feature they govern arrives. Everything else depends on it.
2. **The interwiki map** (§4.4) and the **OpenSearch description** (§4.5). Both small, and both
   valuable before anyone else has joined.
3. **Durable links** (§4.1) as Robust Links, with revalidation and the redirector, then **previews**
   (§4.2). The headline feature, and the page-identity prerequisites in §6 come with it.
4. **Memento** on B (headers on `/_version/<id>`, TimeGate, TimeMap) and **Webmention** (§4.3), in
   either order.
   Both are standard on the wire, so both are useful with peers that are not Wiki.js.
5. The **block registry** (§4.7), then everything else as demand shows up.

At the end of step 4 the directory is still a key-value store of a few kilobytes per site, a static
JSON map and a static listing — which is the constraint this document started from.

---

## 8. Prior art, and what was not chosen

| Considered | What it is | Why not |
| ---------- | ---------- | ------- |
| **did:webvh** | A DID method: a hash-chained, signed log hosted on the site itself, with a self-certifying id that survives a domain move | Closest fit for identity, and needs no registry. Not chosen: a log, hash chain, multikey encoding and Data Integrity proofs are a good deal more machinery than one signed record, and it still cannot find a site again after a move — a lookup from its id to the current domain is needed either way, which is the directory. |
| **did:plc** | Bluesky's DID method: a central directory of signed operation logs | The design in §2 is essentially this, minus the DID document format. Its recovery-key window is kept as an option in §2.5. |
| **did:web** | A DID resolved from `/.well-known/did.json` on a domain | The identity *is* the domain, so it cannot move — the problem this proposal exists to solve. |
| **DOI / Handle System, ARK, PURL, w3id.org** | Persistent identifier registries that redirect | Durable per *resource*: every page that moves needs its registry entry changed, which is the heavy central database this avoids. Here the directory knows sites, and each wiki answers for its own pages. |
| **ActivityPub** (e.g. Ibis) | Server-to-server federation; Ibis mirrors articles and edits across instances | Replication, following and timelines are the non-goal in §1. |
| **Federated Wiki** | Ward Cunningham's wiki, where pages are forked between sites and search covers a "neighbourhood" | The conceptual ancestor of §4.5–4.6, with its own protocol and a small community. Inspiration, not a dependency. |
| **Linked Data Notifications** | A W3C inbox protocol | Webmention does the same job with less, and far more of the web already speaks it. |
| **NodeInfo** | The fediverse's `/.well-known/nodeinfo` software and usage metadata | Overlaps the manifest's `software` block. Could be served alongside it later; nothing depends on it. |

---

## 9. Decisions taken

Taken on 2026-09-26.

- **Participation is opt-in, per site**, from the Discovery card on **Administration → General** —
  the existing "Make Discoverable in the Wiki Directory" toggle, with finer controls in the same card
  (§3.3). Off, a site publishes nothing and contacts nobody.
- **Identity and handles are the design in §2**: a per-site Ed25519 key, a signed record, and handles
  verified in both directions after the AT Protocol pattern. did:webvh was considered and not adopted
  (§8).
- **WebFinger** resolves users for mentions (§4.8).
- **Webmention** is the transport for backlinks and mentions, with RFC 9421 signatures added for
  registered sites (§4.3).
- **OpenSearch** describes each site's search, for browsers and for federated search (§4.5).
- **Robust Links** is the form of a cross-wiki link in the stored render, and **Memento** (RFC 7089)
  is how the version as linked is reached — from B's own history while B exists, from web archives
  after (§4.1). This replaces the "direct vs redirector" choice this document used to leave open: the
  `href` is direct, and the redirector is the current-location fallback and the copyable form.

---

## 10. Open questions

- **Handle policy.** First come, first served? Reserved names? What happens to a handle whose domain
  has lapsed and been bought by somebody else — who wins, the key or the domain?
- **Governance.** Recovery (§2.5) and disputes need somebody to decide them. Who, under what written
  rules, and how does a site appeal? Or does a did:plc-style recovery key remove the need?
- **Rewriting stored renders.** When revalidation finds a moved page, should the `href` in the render
  be rewritten — given that a render is otherwise only ever produced by an editor's browser — or
  should it only be reported for an editor to accept?
- **Capturing at link time.** Should A ask a web archive to capture B's page when the link is saved,
  so that `data-versionurl` has something outside B to point at? It makes the gone-for-good case work,
  and it also tells a third party what the wiki links to.
- **Privacy of the redirector.** Should it log anything at all?
- **Unsigned Webmentions.** The card offers the choice (§3.3). Should "everyone" hold them for
  moderation rather than accept them — and holding needs a moderation queue that does not exist yet.
- **WebFinger exposure.** The site decides whether users can be mentioned at all (§3.3). Once it
  has, answering for every account with a handle confirms to anybody that the account exists. Is
  having a handle consent enough, or is being findable a separate per-user choice?
- **Non-Wiki.js wikis.** The three specific endpoints in §3 are small enough for a MediaWiki extension
  or a DokuWiki plugin to implement, and everything else is already standard. Is that a goal? If so,
  the protocol wants its own document separate from any one implementation — as `wkblock.md` is
  separate from its writer and reader.
- **Licensing.** Embedding (§4.2) and forking (§4.6) copy content between sites. Is the manifest's
  `license` field enough, or does a page need a license of its own?
- **Linking out without joining.** Every outgoing feature sits under the toggle, so a site that
  wants `[[other:Page]]` links to resolve durably has to publish a record of its own first. Is a
  consume-only mode worth having — resolving others' handles with nothing published — or is joining
  a fair price for using the directory?
- **The defaults in the card** (§3.3) are a first guess, in particular "Show in the public listing"
  being on: the toggle's label says *discoverable*, which argues for it.
