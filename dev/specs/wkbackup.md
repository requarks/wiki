# `.wkbackup` — backup and migration package format

**Status:** proposed. Nothing in this document is implemented. The open questions it carried are
answered — [§10](#10-decisions-taken).
**Covers:** Wiki.js 2.x → 3.x migration, and 3.x → 3.x backup/restore.

A `.wkbackup` is one file holding the whole content of a wiki — pages, history, assets, users, groups,
navigation and settings. It is produced by an export utility (in 2.x, by a new one written for the
purpose; in 3.x, by **Administration → Utilities → Export**) and consumed by
**Administration → Utilities → Import from Backup** or **Import from Wiki.js 2.x**.

**The import runs in the browser.** The file is never uploaded as a file: the browser opens it,
reads it a piece at a time, and drives the v3 REST API, reporting progress to the operator as it
goes. Every decision below follows from that, and [§9](#9-two-costs-this-design-accepts) is honest
about what it costs.

---

## 1. Container: ZIP

### Why

The deciding constraint is that the browser holds a local `File`, which is a `Blob` with **random
access** — not a network stream. That makes ZIP's central-directory-at-the-end layout an asset rather
than the liability it is when reading from a socket.

| | ZIP | tar.gz | bespoke |
| --- | --- | --- | --- |
| Read the manifest without touching 8 GB of assets | seek to EOCD | must inflate from byte 0 | — |
| Per-entry compression method | store media, deflate JSON | one stream over everything | — |
| Retry one failed asset | re-slice that entry | re-stream from the start | — |
| Decode in-browser with no dependency | `DecompressionStream('deflate-raw')` | `DecompressionStream('gzip')` | no |
| Inspect or salvage with ordinary tools | `unzip -l`, `zip -FF` | `tar tzf` | no |

A bespoke container — the road `.wkblock` took, and for good reasons there — buys only simplicity of
spec, and costs a parser written and maintained twice. See
[`wkblock.md` §2](./wkblock.md#2-container) for the contrast: that format is a couple of megabytes
read whole into server memory in one pass, where ZIP's machinery earns nothing.

### Writer constraints

The wiki controls both ends, so the writer is constrained to keep the reader small:

- **No data descriptors.** A streaming ZIP writer sets general-purpose bit 3 and puts each entry's
  CRC and sizes in a trailer, which forces a reader to either trust the central directory blindly or
  scan. Both exporters know every entry's size and CRC before writing it, so **sizes and CRC go in the
  local header** and bit 3 is never set. This is the single biggest simplification available.
- **UTF-8 filename flag (bit 11) always set.** Paths are ASCII by construction, but say so.
- **ZIP64 when required** — total size > 4 GiB, any entry > 4 GiB, or > 65535 entries. A 5 GB asset in
  a media wiki is not hypothetical, and the reader must handle it.
- **Entry order is part of the format**: `manifest.json` first, then metadata streams, then blobs.
  A random-access reader ignores this; a sequential one (a future server-side importer, or `unzip -p`)
  depends on it.
- **Compression method per entry**: `deflate` (8) for text, `store` (0) for anything already
  compressed. Deflating a JPEG costs CPU on both ends to make it very slightly larger.
- **No encryption and no signature.** See [§10](#10-decisions-taken). The package carries password
  hashes, TOTP secrets and possibly other credentials; the UI says so plainly rather than
  half-solving it with a password box.

---

## 2. Layout

```
manifest.json                      — always the first entry
streams/settings.json              — instance settings
streams/locales.ndjson
streams/groups.ndjson
streams/users.ndjson
sites/<site>/site.json             — site settings, theme, features
sites/<site>/navigation.json
sites/<site>/tree.ndjson           — folders
sites/<site>/pages.ndjson
sites/<site>/page-history.ndjson
sites/<site>/comments.ndjson
sites/<site>/assets.ndjson         — metadata only; bytes live in blobs/
blobs/<sha256>                     — one entry per distinct file, method: store
```

### Instance-wide at the root, site-scoped under `sites/`

**A package holds one site or several.** Users, groups, locales and instance settings belong to the
wiki rather than to any one site and stay at the root; everything a site owns — its settings and
theme, its tree, pages, history, comments, assets and navigation — sits under a directory of its own.
One site and forty are the same reader, walking `manifest.sites`.

`<site>` is `manifest.sites[].id`, **the site's id in the source instance**. A 3.x site has exactly
one thing that identifies it — the UUID on its row — so that is what is used; `hostname` is unique
too, but it is a setting an administrator changes, and a directory name that moves when somebody
re-points a domain is not an identifier. A 2.x package uses the literal **`default`**, because 2.x
has no sites and therefore no id to give: a stand-in for the one site that exists, which
`source.kind` already explains.

It is a path segment and a lookup key, and nothing else. It is **not** where the restored site's id
comes from — that is the operator's choice of target ([§7](#7-the-v3-importer)) — and the importer
compares it against a target site's UUID for exactly one purpose, deciding whether a site is being
restored over itself ([§4](#4-identity-derive-uuids-do-not-map-them)).

**A 2.x package always holds exactly one site**, since 2.x has no concept of them. That is a fact
about the source, not a second shape: a reader must not special-case it, and the single-site case is
simply the array of length one.

### NDJSON for records, separate entries for bytes

One ZIP entry per page would mean 100 000 central-directory entries — megabytes of directory before
any content — and 100 000 separate slice-and-inflate round trips. One NDJSON entry per stream is a
single sequential read, parsed line by line, and gives **exact progress**: bytes consumed ÷
uncompressed size, both known from the central directory before reading starts.

Blobs are separate entries because they are large, must not be deflated, must be streamable one at a
time without buffering the archive, and must be individually retryable when one upload fails.

### Blobs are content-addressed

`blobs/<sha256-of-contents>`. Three things fall out for free:

- **De-duplication.** The same logo embedded in forty pages is stored once — common enough in a real
  wiki to matter, and it holds across sites too, which is why `blobs/` is at the root rather than
  under each site.
- **Integrity.** The name *is* the checksum; a reader verifies without the manifest listing digests.
- **Resume.** "Have I already uploaded this blob?" is answerable without any bookkeeping.

A page's content lives inline in its NDJSON line, and so does its render in a `wikijs3` package —
a 2.x one carries no render at all ([§8](#8-the-bottleneck-that-shapes-the-schedule)). **Either
field over 1 MiB spills to a blob** and the line carries a reference instead, so no single line
forces a multi-megabyte string through the parser.

---

## 3. `manifest.json`

```json
{
  "format": "wkbackup",
  "formatVersion": 1,
  "createdAt": "2026-09-21T10:00:00.000Z",
  "generator": { "product": "wiki.js", "version": "2.5.308", "exporter": "1.0.0" },
  "source": {
    "kind": "wikijs2",
    "instanceId": "…",
    "baseUrl": "https://wiki.example.com"
  },
  "streams": {
    "users": { "schema": 1, "path": "streams/users.ndjson", "count": 214 }
  },
  "sites": [
    {
      "id": "default",
      "title": "My Wiki",
      "hostname": "wiki.example.com",
      "locales": ["en"],
      "streams": {
        "pages":  { "schema": 1, "path": "sites/default/pages.ndjson",  "count": 12043 },
        "assets": { "schema": 1, "path": "sites/default/assets.ndjson", "count": 3981, "blobBytes": 8402331122 }
      }
    }
  ],
  "options": { "includes": ["pages", "history", "comments", "assets", "users", "groups", "navigation"] },
  "warnings": []
}
```

### Two version numbers, and the distinction is what makes this reusable

- **`formatVersion`** — the container: ZIP layout, manifest shape, the NDJSON-plus-blobs convention.
  Changes rarely, and only for something structural.
- **`streams.<name>.schema`** — the record shape of *one* stream. Changes when 3.x adds a column to
  pages, and nothing else in the package is affected.

**Reader rules:**

| Situation | Behaviour |
| --- | --- |
| `formatVersion` above what the reader knows | Refuse, naming both numbers. |
| A stream's `schema` above what the reader knows | Refuse that stream, naming it. It is a newer wiki's backup. |
| A stream's `schema` below | Run forward-migration functions for that stream. |
| A stream name the reader does not recognise | **Skip with a warning. Never fatal.** |

That last rule is the one that lets a 3.2 backup restore into a 3.1 instance minus the parts 3.1 has
no concept of, instead of failing wholesale.

`sites` is an array always — one entry for a `wikijs2` package, one or more for a `wikijs3` one —
and each entry carries its own `streams` map, versioned by exactly the rules above.

The four fields describing a site come from one place each, and none of them is invented:

| Field | 3.x export | 2.x export |
| --- | --- | --- |
| `id` | `sites.id`, the row's UUID — also the directory segment under `sites/` | the literal `default` |
| `title` | `sites.config.title` | the `title` instance setting |
| `hostname` | `sites.hostname` | the configured host |
| `locales` | the site's locales, primary first | the 2.x locale list |

`id` is the only one the reader acts on. The other three are there so the overlay can ask the
operator where each site should land — *"My Wiki (wiki.example.com) → …"* — without reading a single
stream, which matters when the streams are eight gigabytes away at the other end of the file.

`source.kind` selects the mapping layer: `wikijs2` runs the 2.x → 3.x translation described in
[§6](#6-the-v2-exporter), `wikijs3` is a direct restore.

`warnings` is written by the **exporter**, for anything it could not represent — see
[§6](#6-the-v2-exporter). It is shown in the import log before the import starts.

---

## 4. Identity: derive UUIDs, do not map them

2.x identifies rows by integer; 3.x uses UUIDs. Records cross-reference each other — `page.authorId`,
`comment.pageId`, `tree.pageId`, `userGroups` — so something has to turn one into the other.

The obvious approach keeps an old→new `Map` in the browser. It breaks the moment the tab closes, and
it makes every request order-dependent on every request before it.

**Instead, derive the id:**

```
id = uuidv5(sessionNamespace, "<site>:<entity>:<sourceId>")   // e.g. uuidv5(ns, "default:page:1234")
```

where `sessionNamespace` is issued by the server when the import session is created, and `<site>` is
the package site the record came from — empty for the instance-wide streams (users, groups, locales),
which belong to no site. Two sites in one package each number their own rows, so the site has to be
part of the key or a page in one would derive the id of a page in the other.

For a 3.x → 3.x restore into the *same* site — the package site's `id` and the chosen target's UUID
being one and the same — the original UUIDs are used unchanged, so a restore puts the wiki back as
it was. Into a *different* site, the derivation re-keys everything, so the restored copy sits beside
the original without colliding.

What this buys:

- **No mapping table anywhere.** Any record is translatable without having seen any other, so streams
  can be processed in any order that satisfies foreign keys, and a record can be retried in isolation.
- **The import is idempotent.** Re-posting a record with the same id is an upsert. A tab that closed
  at page 50 000 resumes by replaying; nothing is duplicated.
- **Resume needs only a high-water mark**, not a serialised map.

The cost: **import endpoints must accept a client-supplied `id`.** That capability should exist on the
import routes and nowhere else.

---

## 5. Permissions

An import writes users, groups and settings. Creating a group that carries `manage:groups`, or placing
an account into one, is precisely the escalation `api/groups.ts` guards with `elevatedGroupGuard`.

**The import routes take `manage:system`.** Anything narrower would have to re-implement those guards
per record and would still amount to a route to every permission on the wiki.

A dedicated `manage:import` would be a **new global permission**, which per `CLAUDE.md` is the
maintainer's decision and not something to introduce alongside a feature. Express it with
`manage:system` until somebody decides otherwise.

---

## 6. The v2 exporter

A new utility in 2.x: **Administration → Utilities → Export for 3.x**.

**It must be a background job, not an HTTP response.** A 20 GB archive generated inside a request is a
request that dies. Write to 2.x's data path, then offer a download link.

### Sequence

1. `SELECT count(*)` per table — cheap, and it is what lets `manifest.json` be written **first** with
   real counts while the streams are produced afterwards.
2. Write the preamble and manifest.
3. Each stream in dependency order, via knex `.stream()`, so no table is ever fully resident.
4. Assets last, reading blob bytes per row.

### Where the file goes

The job writes the package into 2.x's data path and the utility offers it as a download, naming the
path it used. **There is no retention policy to define**, because no server ever holds the package
for the import's sake: the operator downloads it, and the 3.x side reads it out of the browser
([§7](#7-the-v3-importer)) without it ever being uploaded. What is left in the 2.x data directory is
an export like any other export — the operator's file, to keep or delete.

### Mapping notes

The 2.x column names below should be checked against the actual 2.x schema before implementing; what
matters here is the shape of the decisions.

- **Page content only; the render is not carried.** This is the one place the two sources part
  company — a 3.x export carries its render and a 2.x one does not
  ([§8](#8-the-bottleneck-that-shapes-the-schedule)). 2.x holds both, and it is tempting to bring the
  HTML along so the wiki reads immediately. Don't: 3.x renders differently enough that the result
  would be wrong — its own markdown-it configuration, blocks, icons drawn in at save time, a
  different sanitiser — and *silently* wrong, because a stored render says nothing about which
  pipeline produced it. Nothing would ever come back and re-do it. Carry the source; 3.x produces the
  HTML itself. See [§8](#8-the-bottleneck-that-shapes-the-schedule).
- **Permissions.** Some 2.x permission names have no 3.x equivalent, and vice versa. **Drop the
  unmappable ones loudly** — into `manifest.warnings` and the import log. Never invent a mapping:
  `CLAUDE.md` records that an unrecognised permission string silently never matches, so a wrong guess
  hides controls with no error anywhere.
- **Password hashes carry over.** Both versions use `bcryptjs` at cost 12 and store the same
  `$2a$12$…` string, so a 2.x hash is written straight into
  `users.auth[<localStrategyId>].password` and works on the first login. This is the difference
  between everybody carrying on and several hundred password resets.
- **2FA secrets carry over.** Both versions do plain RFC 6238 TOTP with a base32 secret — 3.x's
  `helpers/totp.ts` is HMAC-SHA1 over a 30-second counter truncated to six digits, which is what an
  `otpauth://` URI means when it names no parameters, and what 2.x's authenticator produced. So the
  secret is the same string in both and only the field it sits in differs: 2.x's per-user
  `tfaSecret` / `tfaIsActive` become `users.auth[<localStrategyId>].tfaSecret` and `tfaIsActive`,
  alongside the password hash, and the per-user 2FA requirement travels with them as `tfaRequired`.
  Somebody's authenticator app keeps working across the migration, which is the whole point of
  carrying the hashes too.

  Two things follow. A 2.x secret belongs to the **local** strategy and nowhere else; a provider that
  did its own 2FA is that provider's business. And a TOTP secret is a credential in the same sense a
  password is — it is the second thing that makes a `.wkbackup` a file to handle carefully, which
  [§10](#10-decisions-taken) says plainly rather than encrypting halfway.
- **Locales** carry as codes; the string sets themselves are 3.x's own and are not imported.
- **Navigation.** 2.x keeps one tree per locale; 3.x has per-page navigation modes plus menus owned by
  tree entries. The 2.x tree becomes the site-wide menu for its locale, which is the closest honest
  equivalent; anything finer is a decision for whoever runs the import.
- **Settings are exported whole and imported selectively.** The exporter writes everything 2.x holds
  to `streams/settings.json`, keyed as 2.x keys it, without judging what 3.x can use — it cannot
  know which version will read the package, and a key that means nothing to 3.1 may mean something
  to 3.4. The **importer** owns the mapping: it applies the keys that have a 3.x equivalent and
  reports the rest in the log, where they stay legible as a record of how the old wiki was
  configured. Nothing is quietly guessed at, for the same reason permissions are not.
- **One site.** A 2.x package is written as a single site named `default`
  ([§2](#instance-wide-at-the-root-site-scoped-under-sites)); everything site-scoped goes under it.

---

## 7. The v3 importer

### API

```
POST /import/sessions                               → { sessionId, namespace }
POST /import/sessions/:id/:stream                   → { records: [...] }   instance-wide streams
POST /import/sessions/:id/sites/:siteId/:stream     → { records: [...] }   site-scoped streams
POST /import/sessions/:id/blobs/:sha256             → the bytes
POST /import/sessions/:id/finish                    → rebuild tree, links, queue renders, drop caches
GET  /import/sessions/:id                           → progress, for resume
```

**The session is instance-level, not under `/sites/:siteId`**, because half of what it writes is:
users, groups, locales and settings belong to no site. Where each of the package's sites should land
is settled once, when the session is created — `{ source, sites: [{ sourceId, siteId }] }`, pairing
each `manifest.sites[].id` with the target site's UUID — and every site-scoped batch then says which
target it is for. A package site the operator did not map is never
read. For a 2.x package that mapping is a single choice in the overlay; for a multi-site 3.x restore
it is one per site, and a site may be restored over itself or into a new one.

The session is **a row, not memory** — in an HA set the next request is answered by a different
instance.

Batching: ~500 records per request for text streams, one request per blob. The browser keeps at most
four requests in flight and never materialises a whole stream as an array. Blobs are uploaded once
for the whole package however many sites reference them, which content addressing answers without
bookkeeping ([§2](#blobs-are-content-addressed)).

### Reuse the existing write paths

Each stream handler should be a thin translation onto the models that already exist. This is
deliberately **not** a second write path into the database. `pages.adoptStoredPage` already makes the
create-or-overwrite decision, writes history, mirrors to every configured storage target, and — this
matters — renders imported content **with no script or style permission, whoever ran the import**.
That rule exists because the file need not have been written by the administrator pressing the
button, which is exactly the situation here.

### Order of operations

```
locales → groups → users → userGroups → settings
        → per site:  site → tree → pages → page-history
                          → assets (metadata, then blobs) → comments → navigation
        → finish
```

Sites are done one after another rather than interleaved, so that a package of forty fails, resumes
and reports per site.

### Frontend

- **Lazy-load the ZIP reader.** `@zip.js/zip.js` (streaming, `BlobReader` random access, worker
  support, ~30 kB gzipped) rather than hand-rolling — a correct ZIP64 reader is not a small thing, and
  unlike `.wkblock` this one has to handle a format the wiki does not fully control the size of. It
  belongs in a lazy chunk, as the Excalidraw editor's React does: nothing is fetched until somebody
  opens the import overlay.
- **Do the reading in a Web Worker.** Inflating several gigabytes on the main thread janks the very
  progress log it is trying to draw.
- Per stream: `entry.readable → DecompressionStream → TextDecoderStream → line splitter → batch → POST`.
- **Emit log lines per batch, not per record**, or the DOM becomes the bottleneck.
- Counts come from the manifest, so the progress bar is a real fraction rather than a spinner.

---

## 8. The bottleneck that shapes the schedule

**Wiki.js 3.x does not render pages on the server in-process. It drives a headless browser, one page
at a time.** `models/rendering.ts` `drainQueue` is explicit — *"One browser, one page at a time"* —
because the render pipeline lives in the frontend. Importing 20 000 pages whose HTML has to be
produced here queues 20 000 browser renders, and that queue is the schedule of the import's second
half — which is the first reason to bring a render along wherever there is an honest one to bring.

**Whether the package carries a render depends on where it came from**, and the two cases are not
the same question wearing different hats:

- **A 3.x export carries its render**, and a restore stores it as it stands. It was produced by this
  very pipeline, it is the same HTML this wiki was serving, and a backup that came back needing
  20 000 browser renders before anybody could read it would not be much of a backup. Nothing is
  queued: the restored wiki reads exactly as the original did.
- **A 2.x export does not** ([§6](#6-the-v2-exporter)). A 2.x render is 2.x's output, and dropping it
  into 3.x's `render` column would produce a page that is subtly wrong in ways nothing could later
  detect — a stored render carries no record of which pipeline made it, so nobody would ever come
  back and re-do it. A wrong render that looks right is worse than no render.

**A page that arrives without one gets a pending-render placeholder**, and a real render follows in
the background. That is every page of a 2.x import, and any 3.x page whose row had no render to
begin with:

1. **The importer writes a placeholder into `render`** — a fixed fragment produced by the server, not
   anything the package supplied — saying the page is waiting to be rendered. Every read path works
   unchanged, and the first real render replaces it wholesale.
2. **The page is queued**, and `tasks/simple/render-pages.ts` drains the queue at its own pace.

A carried render is not trusted on the way in either: like any other imported content it is
post-processed **with no script or style permission** ([§7](#reuse-the-existing-write-paths)),
because a `.wkbackup` is a file somebody handed the administrator and need not have been written by
them. So a restored page whose author held `write:scripts` or `write:styles` comes back without
them, and needs re-rendering by somebody who holds them. Everything else about the render survives.

The placeholder path is `pages.adoptStoredPage`'s existing shape, which the import routes go
through anyway: it already queues a render best-effort and logs rather than failing when one cannot
be produced — *"An
imported page has no HTML until something renders it, which takes a headless browser this instance
may not have."* The placeholder is the only thing being added, and the reason for it is that an
import creates thousands of such pages at once rather than one.

Four consequences for an import that has pages to render — a 2.x migration, in practice — all of
which belong in the import log rather than in a surprise later:

- **The wait is real.** One browser, one page at a time, for as many pages as were imported. Say so
  at the end: *"12 043 pages imported. Rendering in the background — pages will fill in as it
  works."* A 3.x restore says nothing of the kind, because it has nothing to wait for.
- **Not every page can be rendered here.** `RENDERABLE_EDITORS` is markdown and asciidoc; a 2.x
  ckeditor or HTML page has no server-side renderer, so its placeholder stands until somebody opens
  and saves it. Count those separately and name the count — it is a to-do list, not a failure.
- **An instance without the Puppeteer extension renders nothing.** `ensureCanRender` refuses before
  anything is queued, so the import must not treat that as fatal: the content is in the wiki either
  way, and the admin area's re-render action is the way back once the extension is installed. The
  overlay should say this *before* the import starts, since it is the one thing an operator would
  want to fix first.
- **A page awaiting its first render is `noindex`.** The crawler document is built from the stored
  render (`helpers/appShell.ts`), so without this a crawler arriving mid-import is served a wiki of
  placeholder pages and indexes them. `robotsTagFor` already folds several such answers together;
  this is one more.

---

## 9. Two costs this design accepts

**Every asset byte travels twice through the operator's machine**: v2 disk → `.wkbackup` → laptop →
v3 server. For a 20 GB media wiki on a home connection, that transfer *is* the import. This is
inherent to a browser-driven import, not to the format.

**A browser tab is a fragile host for a multi-hour job.** Idempotent ids ([§4](#4-identity-derive-uuids-do-not-map-them))
and a server-side session make resume cheap, but they do not make the tab reliable.

The mitigation for both is the same, and it is why the layout constraints in [§1](#1-container-zip)
insist on manifest-first ordering: **the same file must be loadable server-side later**, from a path
or a URL, without a browser. Design for the browser; do not preclude the server.

---

## 10. Decisions taken

The questions this document opened with have been answered. Each is recorded here in one line, with
the section that acts on it.

1. **A 3.x export carries its render; a 2.x export does not.** A restore is byte-for-byte the wiki
   that was backed up, so its renders come with it and nothing is queued. A 2.x render would be
   wrong under 3.x's pipeline and undetectably so, so those pages arrive with a pending-render
   placeholder and are re-rendered in the background —
   [§8](#8-the-bottleneck-that-shapes-the-schedule).
2. **Password hashes and 2FA secrets carry over.** Same `bcryptjs` at cost 12, same stored string;
   same RFC 6238 TOTP with the same base32 secret, in a different field. Nobody resets a password or
   re-enrols an authenticator — [§6](#6-the-v2-exporter).
3. **A package may hold several sites**, and a 2.x package always holds exactly one, because 2.x has
   no concept of them. The layout is site-scoped either way and the importer maps each package site
   onto a target site — [§2](#instance-wide-at-the-root-site-scoped-under-sites),
   [§7](#7-the-v3-importer).
4. **No encryption and no signing in v1.** A `.wkbackup` holds password hashes, TOTP secrets and
   possibly other credentials; the UI says so plainly rather than half-solving it with a password
   box — [§1](#writer-constraints).
5. **2.x settings are exported in full and imported selectively.** The exporter judges nothing; the
   importer applies the keys that have a 3.x equivalent and reports the rest — [§6](#6-the-v2-exporter).
6. **There is no retention question.** The package is a download that the browser reads from the
   operator's own disk; no server ever holds it for the import — [§6](#6-the-v2-exporter),
   [§7](#7-the-v3-importer).
