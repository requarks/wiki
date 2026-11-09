---
paths:
  - "backend/helpers/common.ts"
  - "backend/models/tree.ts"
  - "backend/models/pages.ts"
  - "backend/api/tree.ts"
  - "backend/api/pages.ts"
  - "backend/api/assets.ts"
  - "backend/helpers/pageRules.ts"
  - "backend/models/groups.ts"
  - "frontend/src/helpers/pagePaths.js"
  - "frontend/src/components/Tree*.vue"
---

# Page paths and the tree

A path segment — a folder name, a page's own name, an asset's file name — may be written in any
script: letters, digits and combining marks of any language, plus the hyphen, which may separate
them but never start or end a segment (`isValidPathSegment` in `helpers/common.ts`, mirrored in the
frontend's `helpers/pagePaths.js`), at most
`MAX_PATH_SEGMENT_BYTES` (240) UTF-8 bytes. Always lowercase and NFC-normalized. Nothing that means
something in a URL, a file system or a git pathspec is allowed, which is why a path can be
concatenated into a link or a file path without escaping.

- **Written and looked up are two different normalizations.** `normalizeNewPagePath` is for a path
  being written (create, move, folder create or rename): it turns every run of spaces, underscores
  and hyphens into a single hyphen, then drops any hyphen left at either end of a segment.
  `normalizePagePath` is for a lookup and turns only spaces into hyphens, because pages written before
  the underscore rule keep their `_` and must stay reachable. A move or rename that asks for a page's
  or folder's current name again gets exactly that name back (`pagePathToWrite(input, current)` in
  `helpers/common.ts`, `pathSegmentToWrite` in the frontend), so editing only a title never moves
  anything.
- **A permission check is asked of the path that will be STORED.** Rules are matched against stored
  paths, exactly, so a route that checks the path as the request spelled it and then hands it to a
  model that normalizes it lets `HR/Notice` past a DENY over `hr` and lands it at `hr/notice`. A write
  route normalizes first — `pagePathToWrite` for a page (the model's own normalizer), the tree's own
  resolution for a folder (`tree.folderPathAsFiled`, or the lowercased spelling `createFolder` gives a
  parent), `sanitizeFileName` / `renamedFileName` for an asset's name — checks that, and passes that
  same value to the model. The same goes for a
  locale the model would default. Rule paths are stored in page-path spelling for the same reason
  (`normalizeRulePath` in `helpers/pageRules.ts`, on every group save).
- **ltree labels are hex, never the name.** `tree.folderPath` is an ltree whose every label is
  `encodeTreeLabel(name)`, the hex of the name's UTF-8 bytes, while `fileName` holds the name itself.
  This is because ltree accepts in a label only what the database's locale calls alphanumeric (ASCII
  on a `C` database, and never a combining mark). `encodeTreePath` and `decodeTreePath` convert a
  whole slash path. Neither is idempotent, so encode a human path once and decode a value read off a
  row once. A query that builds a child's path from a row's own `fileName` in SQL wraps it in
  `treeLabelSql`, never the bare column. `childPathOf` and `splitPath` in `models/tree.ts` are the
  JavaScript side of the same rule.
- **A URL path is percent-encoded and a page path is not.** Decode with `decodeUrlPath` (backend and
  frontend) before normalizing or hashing anything that came from a request line, an `href` or
  `route.path`. The router never decodes a path for you.
