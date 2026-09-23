# `.wkbackup` — backup and migration package format

**Status:** the v3 importer is implemented for `source.kind: "wikijs2"`; the v2 exporter that writes
the packages it reads is not, and neither is the 3.x export or a `wikijs3` restore. The open questions
this document carried are answered — [§10](#10-decisions-taken) — and what implementing the importer
changed is recorded in [§11](#11-amendments-made-while-implementing-the-v3-importer).
**The record shapes are [§12](#12-the-wikijs2-stream-records)**, and that section is written FROM the
2.x exporter (`server/core/backup.js` in the 2.x repository) rather than the other way round: it ships
already, so it is the authority and this reader is held to it.
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

---

## 11. Amendments made while implementing the v3 importer

The importer described in [§7](#7-the-v3-importer) is implemented for `source.kind: "wikijs2"`
(`backend/models/import.ts`, `backend/api/import.ts`, `frontend/src/helpers/wkbackup/`). Three things
in this document did not survive contact with the code, and the reasons are here rather than in a
commit message.

### Blobs are uploaded before the metadata that references them

[§7](#order-of-operations) ordered a site's streams `pages → page-history → assets → comments`, with
assets as "metadata, then blobs". That order cannot be run. An asset is created by
`assets.adoptStoredFile`, which takes the bytes — there is no half-created asset for a later upload
to fill in — and the same section requires a blob to be uploaded **once** however many records
reference it, which a blob-per-asset request cannot express either.

So a blob is staged before the batch that references it is posted:

```
locales → groups → users
        → per site:  tree → pages → page-history → assets → comments → navigation
        → finish
```

and for each batch of any stream, the blobs its records name (`blob`, `contentBlob`) are uploaded
first, once each across the whole import. Demand-driven rather than a phase of its own, because
`blobs/` holds every file in the wiki and an import of pages alone has no business moving eight
gigabytes of images nobody asked for. Content addressing is what makes that safe to decide a batch at
a time — "have I already sent this?" is a question about the digest and nothing else.

Staging is `<dataPath>/cache/import/<sessionId>/<sha256>`, which is a cache in the sense
`<dataPath>/cache/blocks` is: derived, disposable, and removed by `finish` (and by a sweep of
sessions older than `SESSION_MAX_AGE_HOURS`, for the import that never finished). Every blob's
SHA-256 is verified on arrival — the name *is* the checksum, so a reader that did not check it would
be trusting the uploader about the one thing the naming scheme exists to establish.

### The reading is not in a Web Worker of the importer's own

[§7](#frontend) called for one. `@zip.js/zip.js` already runs inflation in a pool of its own workers
by default, which is the part that would jank the main thread; what is left on it is a line split and
a `JSON.parse` per batch of 500 records, between `await`ed uploads that dominate the wall clock by
orders of magnitude. A second worker layer would have to re-export the session's cookie-authenticated
uploads across a message port to buy nothing measurable.

### Identity is natural keys where 2.x has one, derived UUIDs where it does not

[§4](#4-identity-derive-uuids-do-not-map-them) derives every id. That is right for a 3.x restore,
where the package and the target speak the same schema; for a 2.x migration most records have a
natural key in 3.x and using it is what makes the import *converge* with a wiki that is already
running rather than shadowing it:

| Record | Matched on |
| --- | --- |
| user | `email`, lowercased — see below |
| group | `name` |
| page | `siteId` + `locale` + `path` |
| folder | `siteId` + `locale` + `path` |
| asset | `siteId` + `locale` + folder path + file name |
| navigation | `siteId` + `locale` — the site-wide menu |
| comment, page history | derived: `uuidv5(session.namespace, "<site>:<entity>:<sourceId>")` |

The last row is what [§4](#4-identity-derive-uuids-do-not-map-them) is for and keeps its property:
those two are the records with nothing in them that identifies a row, so replaying a batch upserts
rather than duplicates.

**The namespace is derived, not issued.** §4 has the server mint one per session, which makes a batch
safe to *retry* and nothing more. There is no resume button: an import that fell over is re-run from
the top, and with a fresh namespace each run that means a second copy of every comment and every
history entry — precisely the two kinds with no natural key to save them. So it is
`uuidv5(source-kind | source-instance-id | each package-site > target-site, fixed root)`, which is
the same value next week and on a rebuilt instance, and a different one for another wiki's package or
another target site.

**A user is matched on the email address and nothing else.** Not the display name, which is not
unique and which people change; not the 2.x row id, which means nothing here. An address that already
has an account IS that person, so the import fills in what the account is missing rather than making
a second one beside it.

**The account running the import is never written to**, whatever `overwrite` says. It is in practice
the root administrator, it is the session the rest of the import is authenticated by, and the package
was produced by a wiki whose copy of that address may carry a different password hash, a different
2FA secret, or `isActive: false`. Overwriting it mid-import is how an operator locks themselves out
of the instance they are migrating into, with thousands of records still to write. It is reported in
the log rather than passed over quietly.

**2.x system groups are mapped, not created.** `Administrators` (id 1) and `Guests` (id 2) exist in
3.x already, with rules of their own that are not 2.x's to overwrite; their *memberships* are what
carries, onto `systemIds.administratorsGroupId` and `systemIds.guestsGroupId`.

**And the ids have to be joined up somewhere.** A record from 2.x references other records by 2.x's
integers — a page's `authorId`, a comment's `pageId`, a user's `groups` — while this wiki matches on
natural keys, so neither end can resolve the other alone. `importIdMap` is a row per user, page and
group, written as the owning stream runs and read in bulk by the streams after it. A table rather
than a blob on the session because users and pages are unbounded: a jsonb column rewritten once per
batch is megabytes of write amplification by the end of a large import. Rows go with the session,
which is what stops it becoming a permanent record of somebody's old instance.

### Settings: the site's, yes; the instance's, not yet

[§10](#10-decisions-taken) item 5 stands — the exporter judges nothing and the importer owns the
mapping — and the mapping is now drawn for the SITE's settings, from `sites/<site>/site.json`. The
named keys are listed in [§12](#sitessitesitejson); everything else in that document is left as this
site has it.

The instance-wide `streams/settings.json` — mail, authentication strategies, storage, API keys — is
still only reported. Those are not a site's settings and several of them carry credentials for
services this instance may not be able to reach; each wants deciding on its own rather than as part
of a content import.

---

## 12. The `wikijs2` stream records

**This section is written from the exporter, not the other way round.** It is
`server/core/backup.js` in the 2.x repository, and the importer here is read against it. An earlier
revision of this section guessed at the field names and every one of the guesses was wrong, which
cost a migration that reported success and imported nothing — so the rule is that a change to this
section follows a change to that file, never precedes it.

### A record is a 2.x database row

The exporter selects a table and writes it out. It renames nothing and resolves nothing, which is the
right division of labour — it cannot know which version will read the package — and it means three
things hold everywhere below:

- **The field names are 2.x's own column names.** `localeCode`, not `locale`. `editorKey`, not
  `editor`. `filename`, not `fileName`.
- **The ids are 2.x's own integers**, and every cross-reference is one: a page's `authorId`, a
  comment's `pageId`, a user's `groups`. They mean nothing in a 3.x database, so the importer keeps an
  `importIdMap` row per user, page and group as the owning stream runs, and the streams after it
  resolve through that — see [§11](#identity-is-natural-keys-where-2x-has-one-derived-uuids-where-it-does-not).
- **Columns that mean nothing here come along anyway** — `hash`, `privateNS`, `isPrivate`,
  `contentType`, `render` on a comment. They are ignored. Nothing is refused for carrying more than
  this reader knows about, which is what lets a 2.x point release add a column without breaking
  every import.

Every stream is `schema: 1`. A record missing a field this reader actually needs is skipped with a
warning that **names the missing field and lists the keys the record did carry** — the single most
useful thing a log can say when a package and a reader disagree, and the thing whose absence made the
first failure unreadable.

### `streams/locales.ndjson`

Rows of 2.x's `locales`, plus two flags the exporter adds:

```json
{ "code": "en", "name": "English", "nativeName": "English", "isRTL": false,
  "availability": 100, "isPrimary": true, "isActive": true }
```

Only `code` is read. The importer checks each against the locales installed here and reports the ones
that are not; it installs nothing, because that is a download from a third party in the middle of
somebody's migration.

### `streams/groups.ndjson`

Rows of 2.x's `groups`:

```json
{ "id": 5, "name": "Editors", "isSystem": false,
  "permissions": ["read:pages", "write:pages", "manage:api"],
  "pageRules": [
    { "id": "rul3", "path": "docs", "roles": ["read:pages"], "match": "START",
      "deny": false, "locales": ["en"] }
  ],
  "redirectOnLogin": "/", "createdAt": "…", "updatedAt": "…" }
```

2.x keeps one permission list where 3.x keeps two, so `permissions` carries page permissions alongside
global ones. A page permission is dropped from the group's global list **in silence** — it is not a
meaningless name, it is a name that lives in `rules` here, and `pageRules` is where it arrives. A name
in neither vocabulary is dropped **loudly**, which in practice means `manage:api`. The exporter warns
about those in `manifest.warnings` too, having checked against the same list.

`deny` becomes `mode: "DENY"`, otherwise `"ALLOW"`; 2.x has no `FORCEALLOW`. `match` carries across
unchanged for the kinds both versions have (`START`, `EXACT`, `END`, `REGEX`, `TAG`) and a rule using
anything else is dropped, named. Every imported rule is **scoped to the target site** — a rule from a
wiki that had one site must not start speaking for the others here.

`Administrators` (id 1) and `Guests` (id 2) are mapped onto 3.x's own rather than created; only their
memberships carry.

### `streams/users.ndjson`

Rows of 2.x's `users`, with `groups` flattened to a list of group ids:

```json
{ "id": 3, "email": "ana@example.com", "name": "Ana",
  "providerKey": "local",
  "password": "$2a$12$…",
  "tfaIsActive": true, "tfaSecret": "JBSWY3DPEHPK3PXP", "mustChangePwd": false,
  "isSystem": false, "isActive": true, "isVerified": true,
  "localeCode": "en", "jobTitle": "", "location": "", "timezone": "",
  "groups": [5], "createdAt": "…", "updatedAt": "…" }
```

`password` and `tfaSecret` carry over verbatim into `users.auth[<localAuthId>]`
([§10](#10-decisions-taken) item 2) — but only for `providerKey: "local"`. An account that
authenticated somewhere else arrives with no credentials at all and the log says which strategy has
to be configured before they can sign in.

`localeCode` becomes `prefs.locale`; `jobTitle`, `location` and `timezone` become `meta`. A record with
`isSystem` is skipped — 3.x seeds its own guest.

Matching is on **`email`, lowercased**, and the account running the import is never written to. Both
are [§11](#identity-is-natural-keys-where-2x-has-one-derived-uuids-where-it-does-not).

### `sites/<site>/tree.ndjson`

Rows of 2.x's `pageTree` where `isFolder`:

```json
{ "id": 10, "path": "docs/guides", "depth": 2, "title": "Guides",
  "isPrivate": false, "privateNS": null, "parent": 10, "localeCode": "en" }
```

Pages and assets create the folders they need on the way in, so this stream is for the two things
they cannot supply: the title somebody gave a folder, and a folder with nothing in it.

### `sites/<site>/pages.ndjson`

Rows of 2.x's `pages` minus `render` and `toc`, with `tags` flattened to a list of strings:

```json
{ "id": 42, "path": "docs/intro", "localeCode": "en",
  "title": "Introduction", "description": "The first page",
  "editorKey": "markdown", "contentType": "markdown",
  "isPublished": true, "isPrivate": false,
  "tags": ["onboarding"],
  "content": "# Hello…", "contentBlob": null,
  "authorId": 3, "creatorId": 3,
  "createdAt": "…", "updatedAt": "…" }
```

**No render**, which is the exporter's own decision and the right one
([§8](#8-the-bottleneck-that-shapes-the-schedule)). `contentBlob` is a `blobs/<sha256>` digest and
replaces `content` (set to `null`) when the source is over 1 MiB.

`editorKey` maps `markdown → markdown`, `asciidoc → asciidoc` and `redirect → redirect`. 2.x's two
HTML editors both lose their counterpart, since 3.x has no editor over HTML at all — but only one of
them raises a question.

**`ckeditor`, 2.x's WYSIWYG editor**, is the operator's choice (`htmlConversion` on the session,
**Options → Visual Editor Conversion** in the overlay). Those pages were WRITTEN as formatted text and
merely stored as HTML, so converting gives their author back the editor they had:

- **Convert to markdown**, the default. The HTML is converted with Turndown plus the GitHub-flavoured
  rules — the Joplin fork, which is maintained where the original is not, and not optional: a WYSIWYG
  page is mostly tables and plain Turndown has no rule for one, so it would flatten a table to loose
  text. The page is filed under 3.x's `visual` editor, so it opens the way it was written in 2.x.
- **Keep as raw HTML.** The body is stored untouched and filed under `markdown`, which is configured
  with `allowHTML` and so renders it exactly as it stood — but the page is only editable as source.

**`code`, 2.x's raw-HTML editor, is never converted**, whatever that option says. Its author chose to
write HTML: the markup IS the document rather than a representation of one, and converting it would
throw away the thing they were editing — the `<div>` wrappers, the classes, the inline styles. Such a
page becomes a `markdown` page holding that HTML, which renders identically and is still edited as
source, exactly as it was in 2.x.

Either way the count is reported per editor kind. Two things follow from converting, and both are
the price of markdown having no syntax for them: a `<figure>`/`<figcaption>` becomes an image
followed by a paragraph, and inline styling markdown cannot express is dropped. What it does NOT lose
is text that looks like markup — `5 * 3 * 2` and `my_file_name.txt` come back escaped, so they render
as themselves.

**The conversion runs after the page icon is extracted**, because 2.x marks a corner image with a CSS
class and a class is precisely what does not survive the trip to markdown.

Page history is converted the same way, so restoring an old version does not quietly convert a page
back in the opposite direction.

A 2.x redirection's `content` is the target path; 3.x holds a redirection as JSON, so it is rewritten.

**A corner image becomes the page's icon.** 2.x had no icon field, so a per-page emblem was an image
anywhere in the body carrying `.align-abstopright`, which its stylesheet lifted out of the article and
pinned to the top right of the header. 3.x has `pages.icon` for exactly that, so the first such image
per page is promoted to `img:<url>` and removed from the body — resolved to a `/_files/` URL the way
the renderer resolves any image, including one written relative to the page's own folder.

Not a nicety: 3.x parses `{.align-abstopright}` too and its sanitizer keeps the class, but nothing
styles it, so the image would otherwise render as an ordinary full-size picture wherever it happened
to sit in the source. Both spellings are recognised — the markdown attribute block and the `<img
class="…">` a ckeditor page holds — and the same strip runs over page history, so restoring an old
version does not put the image back in a body the page no longer keeps it in.

### `sites/<site>/page-history.ndjson`

Rows of 2.x's `pageHistory`, with `tags`:

```json
{ "id": 900, "pageId": 42, "path": "docs/intro", "localeCode": "en",
  "action": "updated", "title": "Introduction", "description": "",
  "editorKey": "markdown", "isPublished": true,
  "content": "…", "contentBlob": null,
  "authorId": 3, "versionDate": "…", "createdAt": "…" }
```

The page is resolved by **`pageId` through the id map**, not by the path on the record. A history row
records the path the page had AT THE TIME — that is what the column is for, here as much as in 2.x —
so every version written before a page was renamed carries its old path, and matching on that throws
away the history of exactly the pages whose history is most worth having. `pageId` survives a rename.
The path is still what gets **stored**, since "where was this page when this version was written" is
what a history list shows and what finding a deleted page again depends on. Falling back to
`localeCode` + `path` covers a package whose history is imported over pages that are already here.

History must therefore be written after the pages, which the stream order already requires. A row with
nothing to attach to is skipped and **said so**, with a count and examples rather than a line each:
either the pages were not imported, or the page was deleted in the source wiki, which keeps its
history deliberately so that a deleted page can be recovered.

The row's own id is derived, since history has no natural key, so a re-run updates rather than
duplicates.

### `sites/<site>/assets.ndjson`

Rows of 2.x's `assets` minus the bytes, plus two fields the exporter adds:

```json
{ "id": 77, "filename": "logo.png", "ext": ".png", "kind": "image",
  "mime": "image/png", "fileSize": 4211, "metadata": {},
  "folderId": 2, "folderPath": "docs/img", "blob": "e3b0c442…",
  "authorId": 3, "createdAt": "…", "updatedAt": "…" }
```

**There is no locale on an asset.** 2.x files assets in a tree of their own that has no locales in it,
so there is nothing to read and nothing to guess: they go in the target site's **primary locale**,
which is where a one-language 3.x site keeps everything anyway.

`folderPath` is resolved by the exporter from `folderId`, because 2.x's asset folders are a table the
package does not otherwise carry. `blob` names an entry under `blobs/` that must be uploaded first
([§11](#blobs-are-uploaded-before-the-metadata-that-references-them)). `mime` and `fileSize` are read
for the log and nothing else — 3.x derives both from the name and the bytes it actually received.

### `sites/<site>/comments.ndjson`

Rows of 2.x's `comments`:

```json
{ "id": 5, "pageId": 42,
  "content": "Looks good to me.", "render": "<p>…</p>",
  "name": "Ana", "email": "ana@example.com", "ip": "10.0.0.1",
  "authorId": 3, "createdAt": "…", "updatedAt": "…" }
```

**The page is named by 2.x page id and nothing else** — there is no path on the row — so the pages
stream has to have run and recorded what each one became. A comment whose page was not imported is
skipped and named.

`name`, `email` and `ip` are the commenter's own, kept by 2.x for guests and signed-in authors alike.
`authorId` resolves to an account here; when it does not, the comment stays a guest comment under that
name and address, which is what it already was for anybody who commented without signing in. `render`
is ignored — 3.x renders a comment in the browser at display time.

2.x comments are flat, so nothing carries a `parentId`. The row's own id is derived, as page history's
is and for the same reason.

### `sites/<site>/navigation.json`

2.x's `navigation` table, keyed by its `key` column:

```json
{ "mode": "MIXED",
  "trees": {
    "site": [
      { "locale": "en",
        "items": [
          { "id": "n1", "kind": "link", "label": "Home", "icon": "mdi-home",
            "targetType": "home", "target": "/",
            "visibilityMode": "all", "visibilityGroups": [] }
        ] },
      { "locale": "fr", "items": [ … ] }
    ]
  } }
```

**Neither half of that key/value pair is what it looks like**, and reading either one wrong produces a
sidebar that imports, reports success and then draws nothing.

- **The key is not a locale.** 2.x keeps its one site-wide tree under the literal `site` — its
  navigation model is `idColumn = 'key'` and fetches with `findOne('key', 'site')`. Nothing about the
  key says anything about language.
- **The value is not a list of items.** It is a list of **per-locale trees**, `[{ locale, items }]`,
  which is what that same model iterates to fill its `nav:sidebar:<locale>` cache. The locale comes
  from inside each entry, so the key carries no information the reader needs at all.

One exception, and it is 2.x's own: a config whose **first entry has a `kind`** is the pre-2.3 flat
format, a bare array of items, which 2.x reads as the `en` tree. The exporter writes the column raw,
so a wiki that has not re-saved its navigation since 2.2 still exports that shape.

Each tree becomes **the 3.x site-wide menu for its locale** ([§6](#mapping-notes)) — the sidebar every
page in that locale inherits. The importer logs the item count per locale, because this is a mapping
whose failure is silent.

`kind` maps `link → link`, `header → header`, `divider → separator`, **with no default**: an item that
cannot say what it is is dropped and named, rather than becoming a blank link. `targetType` maps
`home` and `page` onto a path and `external`/`externalblank` onto the URL, the latter with
`openInNewWindow`. A `mdi-home` or `las la-cog` icon is rewritten to its Iconify spelling rather than
stored as a webfont name 3.x no longer ships. `visibilityMode: "restricted"` carries its groups
through the id map.

### `sites/<site>/site.json`

The site's own settings, and the one document the manifest does not declare — the exporter writes it
unconditionally at this path, so it is read by convention.

```json
{ "id": "default", "title": "Wiki.js", "company": "requarks.io",
  "contentLicense": "alr", "footerOverride": "",
  "pageExtensions": ["md", "html", "txt"],
  "locales": { "primary": "en", "active": ["en", "ar", "fr"], "namespacing": false },
  "theme": { "darkMode": false, "injectCSS": "", "injectHead": "", "injectBody": "" },
  "features": { "featurePageComments": false },
  "seo": { "description": "Documentation for Wiki.js", "robots": ["index", "follow"] } }
```

Only the keys below are read, named one by one rather than merged wholesale: 2.x's config is a bag of
a hundred settings whose names mostly do not survive the move, and copying whatever happened to match
would write nonsense into a site the first time 2.x reused a name for something else.

| 2.x | 3.x |
| --- | --- |
| `title`, `company`, `contentLicense` | the same, unchanged — even the licence codes agree |
| `footerOverride` | `footerExtra` — the same field under another name |
| `pageExtensions` | the same; a comma string is accepted as well as a list |
| `seo.description` | `description`, which is where the rest of what describes a site lives |
| `seo.robots` | `robots.index` / `robots.follow` |
| `theme.darkMode` | `theme.dark` |
| `theme.injectCSS` / `injectHead` / `injectBody` | the same |
| `features.featurePageComments` | `features.comments` |
| `locales.primary` / `locales.active` | the same, after the matching below |

`seo.robots` is 2.x's list of the directives it emits. A directive and its negation can both be
absent — 2.x emitting nothing, which means the default rather than false — so each of the two is read
as "not denied" rather than "present".

**Deliberately not imported**: `hostname`, which is this instance's to decide; `logoUrl`, since 3.x
keeps a site's logo as an uploaded asset; and 2.x's `security`, `uploads` and `editShortcuts`, which
have no 3.x counterpart worth guessing at.

#### Locale codes are not the same vocabulary

2.x lowercases everything and carries a mixture of bare languages and language-region pairs (`en`,
`fr`, `pt-br`); 3.x uses BCP-47 as it is published upstream, where the region is capitalised
(`pt-BR`, `zh-CN`). So a code is matched **exactly first, ignoring case**, and failing that on its
**language subtag alone** — which turns `pt-br` into `pt-BR` and a bare `zh` into whichever Chinese
this wiki publishes. A language match prefers the shortest candidate, so a bare `pt` wins over
`pt-BR` where both exist: picking a region for somebody who never chose one is a guess, where falling
back to the language is what they already had.

Every matched locale is then **installed**, which pulls its strings from upstream. That needs the
network, is skipped entirely on an `offline` instance, and is never allowed to fail the import: a
locale that cannot be fetched is reported and left out of the active list, because a site set to a
language whose strings are not here reads as a half-translated wiki. A primary locale that did not
survive falls back to one that did rather than leaving the site pointed at nothing.

### `streams/settings.json`

Read far enough to be reported, not applied — [§11](#settings-the-sites-yes-the-instances-not-yet).
