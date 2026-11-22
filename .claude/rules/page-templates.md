---
paths:
  - "frontend/src/components/PageTemplateDialog.vue"
  - "frontend/src/components/PageNewMenu.vue"
  - "frontend/src/helpers/pageTemplates.js"
  - "frontend/src/stores/page.js"
  - "frontend/src/pages/Index.vue"
---

# Page templates

A page marked `isTemplate` is one new pages can be started from: through **New Page → From Template**
(`PageTemplateDialog.vue`, listing `GET …/pages/templates`) or a `/_create?template=<path or id>`
link (`openCreateRoute` in `Index.vue`). Both end in `pageStore.pageFromTemplate`, which opens the
editor on an unsaved page — nothing is written until the author saves.

- **The flag is `manage:pages` on the page, carried by the page save.** `templateFlagFor` in
  `models/pages.ts` writes the author's value only when they hold it and otherwise IGNORES the field,
  as `buildScripts` ignores scripts from an author without `write:scripts`. Never refuse the save over
  it: the editor sends every field on every save, so an author who may not change the flag still
  sends the value they were shown. The properties panel shows the toggle read-only to them.
- **Not part of a version** (`EXCLUDED_FROM_META` in `models/pageHistory.ts`), like the edit lock:
  restoring a version, or a page from the recycle bin, never changes whether it is a template.
- **A template copies less than a duplicate does.** `TEMPLATE_PAGE_PROPS` and not
  `DUPLICATED_PAGE_PROPS`: never scripts, CSS or the password, because a link names its template and
  the person following it did not choose it — a saver with `write:scripts` would store a script
  written by someone without it, out of sight in the properties panel. Never `publishState`,
  `isBrowsable` or `isSearchable` either: how a template is kept out of the way is about the template,
  not the pages made from it. A DUPLICATE of a template does carry `isTemplate`, subject to the same
  `manage:pages` check at its destination.
- **Only a marked page can be a template**, in the dialog and by link alike (`ERR_TEMPLATE_NOT_TEMPLATE`).
- **The listing asks what opening the source asks**: `mayKnowOfPage` (`read:pages` and the live rule),
  `mayReadSource`, and a password already behind the requester. A new filter on one belongs on the
  other, or the dialog lists templates that then fail to open.
- **Marking a page also turns off Show in Navigation and Search** in the panel — a default for the
  author to undo, not a rule. Nothing server-side hides a template.
- **A `/_create` link naming a path that already has a page opens that page** instead of an editor
  whose save would 409, so an outside tool can hand out one create link per item.
