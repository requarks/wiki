---
paths:
  - "backend/models/importXwiki.ts"
  - "backend/helpers/xwikiSyntax.ts"
  - "backend/helpers/htmlToMarkdown.ts"
  - "backend/api/import.ts"
  - "backend/models/import.ts"
  - "frontend/src/components/ImportXwikiOverlay.vue"
  - "frontend/src/helpers/xwikiSource.js"
  - "frontend/src/helpers/xwikiImport.js"
---

# Import from XWiki

`dev/specs/xwiki-import.md` is the design. It is the DokuWiki import's arrangement
([Import from DokuWiki](./dokuwiki-import.md)) for a XAR; the points worth knowing:

- **The source is a XAR** — a ZIP of one `<xwikidoc>` XML per document and translation. It is read by
  the hand-written `parseXml` in `xwikiSource.js`, not `DOMParser`: XWiki writes XML 1.1, whose
  `&#1;` an XML 1.0 parser refuses the whole file over.
- **References are keyed the same on both sides.** `referenceKey` in `xwikiSource.js` and in
  `xwikiSyntax.ts` must spell a document identically (wiki dropped, only `\` and `.` escaped): the
  browser uploads the index under it and the converter asks for it. Change one, change both.
- **The browser decides paths, the server decides content**, as for DokuWiki. A space is a folder, its
  `WebHome` the page AT it; `Main.WebHome` is the home page. Everything a body may point at goes up
  first as the `index` stream (`page`, `space`, `file`, `user` rows in `importRefs`).
- **An untyped reference has several candidates** (terminal page, nested page, then the same as
  siblings), tried in XWiki's order. So `#convertBatch` converts every body twice — first against a
  resolver that only records keys (`collectXwikiRefs`), then for real. A new reference rule needs no
  separate collector; it is recorded by running.
- **Syntax → HTML → `htmlToMarkdown`**, never straight to markdown. A rule that only makes sense for
  XWiki belongs in `xwikiSyntax.ts`. A `markdown/1.x` page bypasses the converter and is stored as is.
- **One read of the XAR per document during the run.** `runXwikiImport` queues each document's page,
  versions, comments and attachment rows per stream; the history and comments queues flush the pages
  queue first, since their records name a page that must already be written.
- **History is the `<versions>` RCS archive**, the head whole and older versions whole (`full`) or as
  reverse edit scripts (`diff`). A version that cannot be rebuilt costs that page's history, counted
  in the log, never the batch. Ids are `<doc>@<version>` and comments `<doc>#<number>`, so re-running
  is the resume.
- **Authors are users' profile documents** (`XWiki.jdoe`), mapped in the overlay and passed as the
  session's `users`, pre-matched by the email on their `XWiki.XWikiUsers` object
  (`POST /import/match-users`, shared). The guest is the importer.
