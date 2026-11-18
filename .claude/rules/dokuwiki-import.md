---
paths:
  - "backend/models/importDokuwiki.ts"
  - "backend/helpers/dokuwikiSyntax.ts"
  - "backend/helpers/htmlToMarkdown.ts"
  - "backend/api/import.ts"
  - "backend/models/import.ts"
  - "frontend/src/components/ImportDokuwikiOverlay.vue"
  - "frontend/src/helpers/dokuwikiSource.js"
  - "frontend/src/helpers/dokuwikiImport.js"
---

# Import from DokuWiki

`dev/specs/dokuwiki-import.md` is the design. It is the Confluence import's arrangement
([Import from Confluence](./confluence-import.md)) for a smaller source; the points worth knowing:

- **The source is the data directory itself**, as a ZIP or a picked folder (`webkitdirectory`).
  `openSource` finds the data root by looking for the `pages/` folder with the most `.txt` in it, and
  `conf/` beside it. Without `conf/` the import still runs, with nobody's name or address and
  DokuWiki's default interwiki map.
- **The browser decides paths, the server decides content** — as for Confluence. A namespace is a
  folder; its start page (`ns:start`, then `ns:ns`, then the page `ns` beside it — DokuWiki's order) is
  the page AT that folder. Everything a body may point at goes up first as the `index` stream
  (`page`, `namespace`, `file`, `interwiki` rows in `importRefs`), keyed by DokuWiki id; relative ids
  are resolved on the server (`resolveId`), which has the page's own id.
- **Syntax → HTML → `htmlToMarkdown`**, never straight to markdown: the editor's markdown draws a
  single newline as a break, reads `[[` as a wiki link and `<x>` as HTML, and `htmlToMarkdown` already
  escapes all of that. A rule that only makes sense for DokuWiki belongs in `dokuwikiSyntax.ts`; one
  added to `htmlToMarkdown` must be the inverse of a render (footnotes, sub/sup, span tables were).
- **A link to a page not in the import points where it would be** (the nearest known namespace's
  folder plus the rest of the id), so following it offers to create it — DokuWiki's red links work
  the same way. Counted as `missingPages`, not as a loss.
- **DokuWiki text can hold U+2028 / U+2029**, which it treats as ordinary characters and which `.` in
  a JavaScript pattern does not match — so a line-level pattern in `dokuwikiSyntax.ts` takes the `s`
  flag. A page the converter still falls over on is skipped with a warning naming it
  (`#convertBatch` returns the error in its place), never a failed batch.
- **The first heading is the title** and is dropped from the body when the page opens with it.
- **Authors are logins**, mapped in the overlay and passed as the session's `users`; matched by email
  only when `conf/users.auth.php` came along (`POST /import/match-users`, shared with Confluence).
- **History is the attic minus the current revision**, which DokuWiki also keeps there. bzip2 attic
  files cannot be read by a browser and are counted. Re-running derives the same history ids
  (`<page id>@<rev>` in a namespace of the prefix and the target site), so it is the resume.
