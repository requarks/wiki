---
paths:
  - "backend/models/glossary.ts"
  - "backend/api/glossary.ts"
  - "backend/mcp/tools/glossary.ts"
  - "dev/specs/glossary.md"
  - "frontend/src/components/GlossaryOverlay.vue"
  - "frontend/src/components/PageGlossaryCard.vue"
  - "frontend/src/components/MainOverlayDialog.vue"
  - "frontend/src/helpers/glossary*.js"
  - "frontend/src/renderers/glossary.js"
  - "frontend/src/stores/glossary.js"
  - "frontend/src/pages/Index.vue"
---

# Glossary

Terms per site and per locale, read and edited in an overlay opened from the header's **Library**
menu. **`dev/specs/glossary.md` is the design**; `models/glossary.ts`, `api/glossary.ts`,
`components/GlossaryOverlay.vue`.

- **A name means one term.** A term's name and its aliases share one namespace per site and locale,
  compared case-insensitively. The unique index covers term against term; aliases are checked by the
  model, which answers 409 naming the holder. `caseSensitive` is about matching in text, never about
  uniqueness.
- **Related terms are two-way**: one row per pair in `glossaryTermRelations`, smaller id first, read
  from both sides. Saving a term's list replaces every pair touching it.
- **A save names the `updatedAt` it was opened with** (`expectedUpdatedAt`), compared at millisecond
  precision inside the UPDATE; a mismatch is 409 with the term as it now stands. Dates are written
  from JS rather than `now()` so that what is stored is what the client was given.
- **The definition is basic markdown, rendered in the browser** by `renderers/glossary.js` — the
  comment renderer's feature set without `nofollow ugc` or mentions. Never HTML.
- **The frontend learns access from `GET /sites/:siteId/glossary/access`** (`stores/glossary.js`),
  once per site and session — the locales the session may read in and may edit in. Neither permission
  changes from page to page, and the per-page permissions are empty on every route that is not a page.
- **`?glossary=<name>` opens a term over the page it is on** (`helpers/glossaryUrl.js`), answered by
  `MainOverlayDialog.vue` — which every screen able to show an overlay mounts, not only `MainLayout`.
  The overlay keeps the parameter in step with `router.replace`; a link in an article pushes it, so
  Back puts the overlay away.
- **Terms are linked in page text in the reader's browser, never in the stored render**
  (`helpers/glossaryLinker.js`, run by `pages/Index.vue`; spec §9). The first mention of each term per
  page is wrapped in a real `<a class="glossary-term" href="?glossary=…">`, matched on `Intl.Segmenter`
  word boundaries, longest name first. A link written by hand to `?glossary=` — or
  `[[Glossary:Term]]` — is drawn the same way regardless of what the switches say: the term's `autoLink`, the
  site's `features.glossaryAutoLink` and the page's `allowGlossaryLinks`. **Linking moves text into
  elements, which puts any live `Range` boundary inside a term on its edge**, so `Index.vue` bumps
  `contentRevision` and the annotation components find their passages again by text; anything new that
  holds ranges into the article needs the same.
- **A bare `?query` href is not a page link** to the server (`resolveLink`), as a bare `#fragment` is
  not — it is the page it sits on, asked something.
- **A page move with `updateLinks` takes the terms it documents along** (`glossary.relinkDocumentation`,
  from `relinkMovedPage`): rewritten in the same locale, cleared when the page leaves it.
