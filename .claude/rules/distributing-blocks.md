---
paths:
  - "blocks/**"
  - "backend/helpers/wkblock.ts"
  - "backend/controllers/blocks.ts"
  - "backend/api/blocks.ts"
  - "backend/models/blocks.ts"
  - "dev/specs/wkblock.md"
  - "frontend/src/pages/AdminBlocks.vue"
---

# Distributing a block

A block need not ship with the wiki. `npm run package -- block-xyz` compiles one block on its own and
writes `blocks/packages/block-xyz.wkblock`, a single file an administrator uploads under
**Admin → Content Blocks → Install Block...**. So the whole of writing one is: clone this repository, add
a directory under `blocks/`, package it, upload it — nothing of the instance is rebuilt or restarted,
and the author never touches the wiki they are writing for.

**A packaged block is the same thing as a built-in one, arriving by a different road.** Same
`component.js`, same `static definition`, same rollup build; what differs is where its files end up
and where its definition is read from. So a block being written is developed in a full checkout —
`npm run build` and the compiled tree — and packaged once it works. There is no second authoring API.

`blocks/package.mjs` is the packager and `backend/helpers/wkblock.ts` reads what it writes. **The
format itself is specified in `dev/specs/wkblock.md`, and that document is the contract**: `blocks/`
and `backend/` are separately installed workspaces and the backend does not type-check JavaScript, so
there is no module the two halves could share and nothing that checks one against the other. The two
files are independent implementations of the spec and carry only the rationale for how each is
written — so a change to the format is a change to the spec first, then both files, in one commit.

- **One block per package, and the directory name is the identity.** `blocks/block-xyz/` declares
  `block: 'xyz'`, is packaged as `block-xyz.wkblock`, serves as `block-xyz.js` and renders as
  `<block-xyz>`. The packager refuses a mismatch, because every one of those names is derived from the
  same key. A **child block** (`isChild`) is refused outright: it is part of whatever holds it, has no
  row and nothing to switch on, so a package of one would install nothing.
- **Everything is namespaced under the block's own name**, which is what lets an imported block and a
  built-in one be served from the same `/_blocks/` without either standing on the other. A package
  holds `block-xyz.js`, optionally `block-xyz.worker.js`, and `block-xyz/**` — the assets from its
  `assets.json` and, unlike the full build, its shared chunks, which `buildConfig({ only })` names
  into that directory rather than leaving at the root. Both the packager and the importer check it.
- **The package is the only copy.** It is stored verbatim on the block's row (`packageData`) with its
  definition and a `checksum`. Nothing is written to `blocks/` on the server, which is a build output
  and in a container is part of the image.
- **Re-importing the same key is an upgrade, not a second block.** The row is updated, so what the
  site had switched on and configured on it survives; the reply says `isNew: false`. A key a built-in
  block already uses is refused with 409 rather than shadowing it.
- **`manage:sites` is what it takes**, the same permission the screen already needs — and deliberately
  not something stricter. A block is code that runs in every reader's browser on that site, which is
  exactly what the raw head and body fields under **Admin → Theme** already are. It is not a new kind
  of power, it is a tidier way to exercise one the admin area already grants.
- **The container is parsed as something a stranger uploaded**, because the trust boundary above is
  about the CODE, not about the file: every length is bounded before it is acted on, every file's
  SHA-256 is checked, and every path has to fall inside the block's namespace.

**The files are served from `/_blocks/` like a built-in's, and `controllers/blocks.ts` is what decides
which.** That route replaced the `@fastify/static` registration for `/_blocks/`, because a static
plugin claims the whole prefix and leaves nothing to ask the question in front of it; the plugin is
still registered with `serve: false`, for `reply.sendFile`.

- **The first path segment names the block, and that is the whole decision** — which is the reason the
  namespace above is enforced.
- **It depends on which SITE was asked**, since a custom block belongs to one, and two sites on an
  instance may each have imported a different block under the same key. The frontend has no site in
  hand when it loads a block (it reads a tag out of the page and asks for it), so the hostname
  resolves it, the same `WIKI.sitesMappings` lookup the request hooks do.
- **`<dataPath>/cache/blocks/<siteId>/block-<key>/` is a cache, not storage.** `servingPathFor`
  unpacks the stored package into it on the first request and `block-<key>.checksum` beside it says
  which version is there — written last, so an unpack that died halfway is done again rather than half
  served. Which also means an upgrade reaches every instance of an HA set on its own, including one
  that was not running when the upload happened, and a fresh container needs nothing restored.
- **Custom files are revalidated (`no-cache` + ETag), built-ins are held for an hour.** The names are
  the same across versions of a custom block, and the point of uploading a fixed one is that the fix
  is live.

**A custom block's definition is read from its row wherever a built-in's is read from the manifest** —
its props in `getSiteBlocks`, and its tag and attributes in the sanitiser's allow list
(`getEnabledForRender`, which fetches both in the one query `postProcess` was already making, for the
same reason that query is not cached: a definition this misses is a block stripped out of somebody's
page). Everything else about it is identical, the enable toggle included: a custom block that is
switched off is stripped from a page being saved exactly as a built-in one is.
