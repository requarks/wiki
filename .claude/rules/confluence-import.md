---
paths:
  - "backend/models/importConfluence.ts"
  - "backend/helpers/confluenceStorage.ts"
  - "backend/helpers/htmlToMarkdown.ts"
  - "backend/api/import.ts"
  - "backend/models/import.ts"
  - "frontend/src/components/ImportConfluenceOverlay.vue"
  - "frontend/src/helpers/confluenceBackup.js"
  - "frontend/src/helpers/confluenceImport.js"
---

# Import from Confluence

`dev/specs/confluence-import.md` is the design and what was learned about both backup formats from
real files. The points worth knowing before touching any of it:

- **Two formats, one index.** A Cloud backup is CSV (`data/*.csv.gz`), a Server / Data Center one is
  XML (`entities.xml`); `helpers/confluenceBackup.js` reads either into the same index, and nothing
  after it may ask which it was. Both readers are hand-written for exactly what Confluence writes —
  there is no XML, CSV or zstd library in the frontend, by design.
- **The browser decides paths, the server decides content.** Paths need the whole page tree, which only
  the browser holds (`buildPlan`); conversion needs cheerio, Turndown and zstd, which only the server
  has. What a body points at reaches the server as the `index` stream, stored in `importRefs` and read
  per batch — never send a whole map with every batch.
- **A Confluence session has its own streams** (`index`, `tree`, `assets`, `pages`, `page-history`,
  `comments`), dispatched on `session.source` in `models/import.ts`. Everything else — batching, staged
  blobs, the id map, `authorFor`, finishing, and the pieces Import from DokuWiki uses too (`putRefs` /
  `getRefs`, `folderStream`, `fileStream`, `matchUsers`, `pageIdAt`) — is the shared import's.
- **Authors come from the session, not a stream.** The operator's mapping is passed as `users` when the
  session is opened and stored as the `user` id map; anybody unmapped is the importer. A CSV backup
  has no addresses at all, so matching by email (`POST /import/match-users`) is an XML-only convenience.
- **Attachments are uploaded through `POST …/uploads`**, which hashes on the server: the browser cannot
  hash outside a secure context, and a Confluence backup does not name files by content.
- **The `htmlToMarkdown` rules added for this are inverses of renders** (alert, `<details>`, inline
  blocks, tabs, the page index, image size), so they serve MCP as well. Keep any new one that way: a
  rule that only makes sense for Confluence markup belongs in `confluenceStorage.ts`, as a rewrite into
  HTML this wiki renders.
- **Re-running is the resume.** Records are keyed by derived ids in a namespace of the backup's own id
  and the target site, so a second run upserts history and comments and leaves existing pages alone
  unless Overwrite is on.
