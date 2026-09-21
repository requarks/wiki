# `.wkblock` — block package format

**Status:** implemented, format version 1.
**Implemented by:** [`blocks/package.mjs`](../../blocks/package.mjs) (writer) and
[`backend/helpers/wkblock.ts`](../../backend/helpers/wkblock.ts) (reader).

A `.wkblock` is the single file one content block is distributed as. An administrator uploads it
under **Administration → Content Blocks → Install Block…** and the block is available to authors
immediately — nothing on the instance is rebuilt and nothing is restarted.

> **This document is the format.** The writer and the reader are two independent implementations of
> what is written here — `blocks/` and `backend/` are separately installed workspaces with no module
> between them, and the backend does not type-check JavaScript, so there is nothing either half could
> import and nothing that could check one against the other. Stating it in both files meant two
> statements drifting apart by hand; stating it here means both implement one document.
>
> If an implementation disagrees with this document, **the implementation is wrong** — with the single
> exception that a stated limit found to be unsafe should be tightened in code first and written down
> immediately after. See [Changing the format](#9-changing-the-format).

---

## 1. What the format is for

A block author clones this repository, writes a directory under `blocks/`, runs the packager, and
uploads the result to a wiki they have never otherwise touched. The design follows from that:

- **A packaged block is the same thing as a built-in one arriving by a different road.** Same
  `component.js`, same `static definition`, same rollup build. What differs is where its files end up
  and where its definition is read from. There is deliberately no second authoring API.
- **The package is the only copy.** It is stored verbatim on the block's row and unpacked into a cache
  on demand. Nothing is ever written into `blocks/` on the server, which is a build output and, in a
  container, part of the image.
- **The container is parsed as something a stranger uploaded.** The trust boundary is about the *code*
  — see [§7](#7-trust-boundary) — but the file itself is untrusted input before anyone has vouched for
  anything.

---

## 2. Container

All integers are big-endian. The file is a fixed 16-byte preamble, a gzipped JSON header, then each
file's gzipped bytes concatenated in the header's order.

```
offset  size      field
0       8         magic      "WKBLOCK\0"   (0x57 4B 42 4C 4F 43 4B 00)
8       4         version    uint32be, currently 1
12      4         headerLen  uint32be, byte length of the gzipped header
16      headerLen header     gzip(JSON, level 9)  — see §3
16+hl   …         payload    gzip(file bytes, level 9) × N, in header order
```

There is no index of payload offsets. Each file's position is the running sum of the
`compressedSize` values before it, which is why the reader walks the entries in order and why
`compressedSize` is in the header at all.

**The file length must equal `16 + headerLen + Σ compressedSize` exactly.** The reader checks this
before decompressing anything; a mismatch means a truncated download or a doctored file, and both are
refused with the same message.

### Why per-file gzip rather than one stream over the lot

A block's assets are frequently already-compressed images and fonts sitting beside a bundle that
compresses four to one. Compressing each file separately means the incompressible ones cost almost
nothing, and — more importantly — the reader can verify a digest as it goes rather than having to
hold the whole package twice.

### Why not ZIP

The sibling format in this repo, [`.wkbackup`](./wkbackup.md), *is* a ZIP, and the reasoning there
is worth contrasting. A `.wkbackup` is gigabytes, read in a browser, and needs random access to one
entry out of thousands. A `.wkblock` is a couple of megabytes read whole into server memory in one
pass. ZIP's central directory buys nothing at that size, and a hand-written 300-line reader with
explicit bounds on every claimed length is easier to audit than a ZIP parser's edge cases (data
descriptors, ZIP64, filename encodings). Different problems, different answers.

---

## 3. Header

Gzipped UTF-8 JSON:

```json
{
  "block": "xyz",
  "definition": { "block": "xyz", "name": "…", "description": "…", "icon": "…", "props": [] },
  "packagedAt": "2026-09-19T12:00:00.000Z",
  "packagedWith": "3.0.0",
  "files": [
    { "path": "block-xyz.js", "size": 12345, "compressedSize": 4321, "sha256": "…64 hex chars…" }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `block` | The key. Must match `/^[a-z0-9][a-z0-9-]{0,62}$/`. |
| `definition` | The component's `static definition`, verbatim — see [§5](#5-the-definition). |
| `packagedAt` | ISO 8601. Diagnostics only; the reader defaults it to `''` if absent or not a string. |
| `packagedWith` | Version of the wiki the packager came from. Diagnostics only, same tolerance. |
| `files` | Payload entries, in payload order. `sha256` is of the **uncompressed** bytes. |

`packagedAt` and `packagedWith` are the only optional fields, and nothing branches on either.

---

## 4. Namespacing: the rule everything else rests on

**One block per package, and the directory name is the identity.** `blocks/block-xyz/` declares
`block: 'xyz'`, packages as `block-xyz.wkblock`, serves as `block-xyz.js`, and renders as
`<block-xyz>`. The packager refuses a mismatch, because every one of those names is derived from the
same key.

**Every path in a package must fall inside that block's own namespace:**

```
block-<key>.js           ← required; the file the wiki loads the block from
block-<key>.worker.js    ← optional
block-<key>/**           ← assets and shared chunks
```

This is what lets an imported block and a built-in one be served from the same `/_blocks/` without
either standing on the other, and it is enforced **on both sides** — by the packager, where the author
can still do something about it, and by the reader, where it is a security check.

Note this differs from a full `npm run build`: there, shared chunks sit at the output root.
`buildConfig({ only })` names them into `block-<key>/` instead, precisely so a package can be
namespaced.

A path is rejected unless it is a plain relative path. The reader refuses any of: empty, longer than
255 characters, containing `\`, leading `/`, any `.` or `..` segment, trailing `/`, `//`, or any
character below U+0020. The backslash rule matters because the path is joined onto a cache directory
and a Windows instance would read `\` as a separator where this check would not.

### Child blocks are refused outright

A block with `isChild` is part of whatever holds it — it has no row, no enable toggle and nothing to
switch on — so a package of one would install nothing. Both halves refuse it, with a message saying to
package the parent instead.

---

## 5. The definition

The definition is **read key by key, not spread**. What comes back is stored on the block's row,
handed to the editor to build a form from, and turned into the sanitiser's allow list for the block's
tag — an unknown key would travel all of that way meaning nothing.

| Key | Rule |
| --- | --- |
| `block` | Must equal the header's `block`. |
| `name` | String, ≤ 255. Required. |
| `description` | String, ≤ 255. Defaults to `''`. |
| `icon` | String, ≤ 255. Defaults to `''`. |
| `props` | Array, ≤ 64 entries. |
| `template` | Optional string, ≤ 8192. |
| `asciidocTemplate` | Optional string, ≤ 8192. |
| `contentEditor` | Optional string, ≤ 64. |

Each prop:

| Key | Rule |
| --- | --- |
| `name` | `/^[A-Za-z][A-Za-z0-9-]{0,63}$/`. **This becomes an attribute on the block's tag**, so a name that is not a valid attribute name would either be dropped silently or widen the sanitiser's allow list in a way nobody wrote down. |
| `type` | One of `string`, `number`, `boolean`, `select`, `icon`. |
| `label`, `hint` | Optional strings, truncated to 1024 rather than refused. |
| `required` | Kept only when exactly `true`. |
| `default` | Kept only when a string, number or boolean. |
| `options` | Optional array, first 128 kept. A string, or coerced to `{ label, value }` with both stringified. |

---

## 6. Limits

All checked **before** anything is decompressed, so a package cannot talk the reader into
decompressing more than it is prepared to hold. `gunzipSync` is additionally called with
`maxOutputLength` set per entry, so a lying `size` cannot become a zip bomb.

| Limit | Value | Note |
| --- | --- | --- |
| `MAX_PACKAGE_SIZE` | 32 MiB | Also the body limit of the import route. |
| `MAX_HEADER_SIZE` | 4 MiB | Applies to the gzipped header *and* its output. |
| `MAX_UNPACKED_SIZE` | 128 MiB | Sum of every entry's `size`. |
| `MAX_FILE_COUNT` | 4096 | At least 1 required. |

`MAX_PACKAGE_SIZE` is deliberately **not** the site's asset upload limit. That one is about what
readers may attach to pages and is usually turned down; a block carrying a PDF engine and its
character maps is legitimately a couple of dozen megabytes.

### Reader checks, in order

1. Length ≥ 16 and magic matches → else "not a Wiki.js block package".
2. `version === 1` → else a message naming both versions, since the likely cause is a newer wiki.
3. `headerLen` ≥ 1, ≤ `MAX_HEADER_SIZE`, and `16 + headerLen ≤ file length`.
4. Header gunzips and parses as JSON.
5. `block` matches the key pattern; definition validates ([§5](#5-the-definition)).
6. `files` is an array, 1 … `MAX_FILE_COUNT`.
7. **Every entry**: path is servable and namespaced; `size` and `compressedSize` are non-negative
   integers; `sha256` is 64 lowercase hex.
8. `Σ size ≤ MAX_UNPACKED_SIZE`.
9. `16 + headerLen + Σ compressedSize === file length`.
10. Then, per entry in order: no duplicate path, gunzip with `maxOutputLength`, and the decompressed
    bytes must match both the stated `size` and the stated `sha256`.
11. `block-<key>.js` is present.

Every failure is a `CustomError('blockPackageInvalid', …)` naming what is wrong, because every one of
them is something the administrator who uploaded the file can act on — a truncated download, the wrong
file, a package built by a newer wiki.

---

## 7. Trust boundary

**`manage:sites` is what it takes to import one** — the same permission the screen already needs, and
deliberately not something stricter.

A block is code that runs in every reader's browser on that site. That is exactly what the raw head
and body fields under **Administration → Theme** already are, and those take `manage:theme`. Block
import is not a new kind of power; it is a tidier way to exercise one the admin area already grants.

What that permission covers is the **code**. It says nothing about the **container**, which is parsed
before anybody has vouched for anything — hence the bounds in [§6](#6-limits), the digest on every
file, and the namespace check on every path.

---

## 8. Lifecycle on the server

### Import

`POST /sites/:siteId/blocks/import`, `manage:sites`, body is the file itself as
`application/octet-stream` — not a multipart form.

- **Re-importing the same key is an upgrade, not a second block.** The row is updated, so what the
  site had switched on and configured on it survives. The reply says `isNew: false`.
- **A key a built-in block already uses is refused with 409** (`blockPackageConflict`), since both
  would be served from the same address. Two conditions raise it: the key belongs to a block compiled
  into this wiki, or the site already has a non-custom row under it.
- The block is registered **enabled** and is available to authors immediately.

### Storage

On the `blocks` row:

| Column | Contents |
| --- | --- |
| `packageData` | The `.wkblock` verbatim. Null for a built-in. **This is the only copy.** |
| `definition` | The package's copy of the definition. Empty for a built-in, whose definition is read from the compiled manifest so that an updated block describes itself the moment it is deployed. |
| `checksum` | SHA-256 of the package, and the name of its directory in the disk cache. Empty for a built-in. |

### Serving

`backend/controllers/blocks.ts` answers `/_blocks/` for both kinds. It replaced the
`@fastify/static` registration for that prefix, because a static plugin claims the whole prefix and
leaves nothing to ask the question in front of it; the plugin is still registered with `serve: false`
for `reply.sendFile`.

- **The first path segment names the block, and that is the whole decision** — which is why the
  namespace rule in [§4](#4-namespacing-the-rule-everything-else-rests-on) is enforced so hard.
- **It depends on which site was asked.** Two sites on one instance may each have imported a different
  block under the same key. The frontend has no site in hand when it loads a block — it reads a tag out
  of a page and asks for it — so the hostname resolves it through the same `WIKI.sitesMappings` lookup
  the request hooks use.
- **`<dataPath>/cache/blocks/<siteId>/block-<key>/` is a cache, not storage.** `servingPathFor`
  unpacks the stored package into it on first request. `block-<key>.checksum` beside it says which
  version is there and **is written last**, so an unpack that died halfway is redone rather than half
  served; the directory is built under a temporary name and moved into place for the same reason.
- Consequently an upgrade reaches every instance of an HA set on its own — including one that was not
  running when the upload happened — and a fresh container needs nothing restored.
- **Files for a block that has gone are swept, not left.** Deleting a block discards its unpacked
  files on the instance that handled the request. Every other instance reconciles instead of being
  told: the `reloadBlocks` event says the set of custom blocks changed but not how, so on receiving
  it each instance re-reads the index and then deletes anything cached for a block the index no
  longer has. The same sweep runs at boot, which is what catches an instance that was down when the
  delete happened and comes back to a volume it left behind.
- **A whole site's directory goes the same way.** The index holds only the sites that have a custom
  block, so a directory for any other site is stale by definition — which is what clears up after a
  site that was deleted.
- The sweep acts only on names it recognises: `block-<key>`, `block-<key>.checksum`, and a
  `block-<key>.<12 hex>` staging directory left by a process killed mid-unpack. Anything else in the
  cache is left alone, since a sweep deleting what it does not recognise would be a worse failure
  than the leak it is fixing.
- **Custom files are revalidated (`no-cache` + ETag); built-ins are held for an hour.** The file names
  are the same across versions of a custom block, and the point of uploading a fixed one is that the
  fix is live.

### Rendering

A custom block's definition is read from its row wherever a built-in's is read from the manifest — its
props in `getSiteBlocks`, and its tag and attributes in the sanitiser's allow list via
`getEnabledForRender`, which fetches both in the one query `postProcess` was already making. That
query is deliberately not cached: a definition it misses is a block stripped out of somebody's page.

Everything else is identical to a built-in, the enable toggle included — a custom block that is
switched off is stripped from a page being saved exactly as a built-in one is.

---

## 9. Changing the format

This document is the contract. Both implementations follow it, and neither is a place to decide
something new about the format.

1. **Change this document first.** A change that is not written here has not been agreed with the
   other half.
2. Change `blocks/package.mjs` and `backend/helpers/wkblock.ts` to match. They are separate
   workspaces and can be edited in either order, but both belong in the same commit as the change
   here.
3. **Bump `FORMAT_VERSION` in both files** if the change is not backward compatible. The reader
   refuses any version but its own and says so in a message naming both numbers, which is the whole
   of the compatibility story: there is no migration path for a package, because rebuilding one is a
   single command.

Nothing enforces step 2 automatically — there is no test runner in any of the three workspaces, so
there is nowhere such a check could currently live. If the two implementations do drift, the cheapest
guard would be a committed fixture `.wkblock` and something that reads it: that catches the reader
drifting from a file the writer actually produced, which is the failure that matters.

---

## 10. Known gaps

- **No signature or publisher identity.** Anyone who can reach the import screen can install any
  block, and nothing about the file says where it came from. That is consistent with the trust
  boundary in [§7](#7-trust-boundary) — `manage:sites` already implies running arbitrary code in
  readers' browsers — but it means there is no way to distribute a block with any assurance attached.
  A signature would be a meaningful addition *only* alongside a notion of trusted publishers; on its
  own it proves nothing useful.
- **No dependency or compatibility declaration.** A package does not say which wiki versions it works
  with. `packagedWith` is recorded but never acted on.
- **One block per file.** A suite of related blocks is *n* uploads. This is a consequence of the key
  being the identity and is not obviously worth changing.
