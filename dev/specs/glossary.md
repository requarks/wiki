# Glossary

**Status:** phases 1 to 3 of [§11](#11-suggested-order) implemented — storage, permissions, the API
and the overlay. URLs (§7) and the page-move rewrite (§5.3) are still to come. Where building it
changed the design, this document was changed with it.
**Covers:** what a glossary term is, how it is stored, who may read and edit it, the overlay it is read
and edited in, its URL, and what the first version does to leave room for linking terms automatically
in page text later.

A wiki accumulates vocabulary: product names, acronyms, words that mean something narrower here than
they do anywhere else. A glossary gives each of them one place to be defined, one page that documents
it properly, and a way of saying which terms belong together.

The constraints this is written against:

- **One site, one locale, one glossary.** A term belongs to a site and to a locale, the same way a page
  does. Nothing is shared between sites, and a term is not translated by being edited in another
  locale.
- **A name means one term.** A term's name and every one of its aliases are unique within its site and
  locale, compared case-insensitively. That is what lets a URL, a related-terms list and, later, a
  word in a paragraph each resolve to exactly one entry.
- **The glossary is read over the page, not instead of it.** It is an overlay, fetched the first time
  somebody opens it, so a reader who never does pays nothing for it.

---

## 1. Goals and non-goals

**Goals**

- A **Glossary overlay**, opened from the header's **Library** menu: terms listed in a sidebar, the
  selected term in the main panel, and a **New Term** button at the top of the sidebar that opens the
  form in the main panel.
- The fields in [§3.1](#31-glossaryterms): term, expansion, definition, aliases, related terms,
  documentation page and its label, external references, case sensitivity, category, and auto-link.
- **Two-way related terms.** Relating A to B relates B to A.
- **A URL per term**, so a term can be linked to from a chat message or another page
  ([§7](#7-urls)).
- **Two new permissions** ([§4](#4-permissions)): `read:glossary` for reading a site's glossary in a
  locale, and `manage:glossary` for creating, editing and deleting its terms. Both are page-rule
  permissions whose rule's path is ignored.
- **Moving a page with `updateLinks` updates every term documented by it** ([§5.3](#53-moving-a-page)).
- **Lost updates are refused, not silent**: a save against a term somebody else changed in the meantime
  answers 409 ([§5.2](#52-concurrent-edits)).
- **A per-site switch**, `features.glossary`.

**Non-goals for the first version**

- **Linking terms in page text automatically.** Planned; the `autoLink` column ships now and its
  toggle is shown disabled. [§9](#9-auto-linking-later) is the design the first version is built to
  accommodate.
- **A `block-glossary` content block**, listing terms (or one category's) inside a page, and an inline
  block for marking a term explicitly.
- **Glossary terms in site search results.**
- **Linking equivalent terms across locales**, the way pages are grouped into locale groups.
- **Import and export** (CSV, JSON).
- **Revision history of a term.** The audit log records who changed what and which fields; it does not
  keep the previous text ([§8](#8-audit-log)).
- **Real-time collaborative editing.** [§5.2](#52-concurrent-edits) is the whole of the concurrency
  story.

---

## 2. Architecture

| Piece | Where |
| --- | --- |
| Tables | `glossaryTerms`, `glossaryTermRelations` in `backend/db/schema.ts`, one generated migration (`--name=glossary`) |
| Model | `backend/models/glossary.ts`, exposed as `WIKI.models.glossary` |
| API | `backend/api/glossary.ts`, schemas in `backend/api/schemas/` |
| Permissions | `read:glossary` and `manage:glossary` in `PAGE_PERMISSIONS` and `LOCALE_PERMISSIONS` (`models/groups.ts`); the group editor's rule list (`GroupEditOverlay.vue`); the lists in CLAUDE.md |
| Overlay | `frontend/src/components/GlossaryOverlay.vue`, registered in `MainOverlayDialog.vue`, opened by `siteStore.openGlossary()` |
| Definition renderer | `frontend/src/renderers/glossary.js`, built on `createProseMarkdown` from `renderers/comment.js` ([§6.4](#64-the-definition)) |
| Access | `frontend/src/stores/glossary.js`, from `GET /glossary/access` ([§4.5](#45-on-the-frontend)) |
| Entry point | The Glossary row of `HeaderLibraryMenu.vue` |
| Strings | `glossary.*` in `backend/locales/en.json` |

---

## 3. Storage

### 3.1 `glossaryTerms`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `siteId` | uuid, → `sites`, on delete cascade | |
| `locale` | varchar(255), not null | Same shape as `pages.locale` |
| `term` | varchar(255), not null | Trimmed, inner whitespace collapsed, NFC |
| `expansion` | varchar(255), nullable | The full form, when the term is an abbreviation |
| `definition` | text, not null, default `''` | Basic markdown source, never HTML ([§6.4](#64-the-definition)) |
| `aliases` | text[], not null, default `{}` | Alternate forms and inflections; normalized like `term` |
| `documentationPath` | varchar(255), nullable | A page path in the term's own locale, no locale prefix |
| `documentationLabel` | varchar(255), nullable | Null means the default, "Read more", which comes from the locale strings and is not stored |
| `references` | jsonb, not null, default `[]` | `[{ url, label }]`, in the order given |
| `caseSensitive` | boolean, not null, default false | How the term is *matched in text*; never how it is compared for uniqueness ([§3.3](#33-uniqueness)) |
| `autoLink` | boolean, not null, default true | Whether the term is linked automatically in page text; no effect until [§9](#9-auto-linking-later) ships |
| `category` | varchar(255), nullable | One per term, free text, used to group terms in the sidebar |
| `creatorId` | uuid, → `users`, on delete set null | |
| `authorId` | uuid, → `users`, on delete set null | Who saved it last |
| `createdAt` | timestamp, default now | |
| `updatedAt` | timestamp, default now | Also the concurrency token ([§5.2](#52-concurrent-edits)) |

Indexes:

- `(siteId, locale)` for the list.
- **Unique `(siteId, locale, lower(term))`**: the database's half of [§3.3](#33-uniqueness).
- `(siteId, locale, documentationPath)` where `documentationPath` is not null, for
  [§5.3](#53-moving-a-page).

**Category is a column, not the site `tags` table.** That table counts how many pages use each tag and
is what `/_tags` is drawn from; glossary categories in it would appear on the Tags page as page tags
that no page carries. The category suggestions in the form come from
`SELECT DISTINCT category` over the locale's terms.

### 3.2 `glossaryTermRelations`

| Column | Type |
| --- | --- |
| `termId` | uuid, → `glossaryTerms`, on delete cascade |
| `relatedId` | uuid, → `glossaryTerms`, on delete cascade |

Primary key `(termId, relatedId)`, a `CHECK (termId < relatedId)`, and an index on `relatedId`.

**One row per pair, read from both sides.** The check stores each relation exactly once with the
smaller id first, so "B is related to A" and "A is related to B" are the same row and cannot drift
apart. A term's related terms are the union of `relatedId where termId = $1` and
`termId where relatedId = $1`. Saving a term's `relatedTerms` replaces the rows touching that term, in
the same transaction as the term itself, so removing B from A's list removes A from B's.

A join table rather than a uuid array on the term, so that deleting a term takes it out of every other
term's list through the cascade alone, with no cleanup code to forget.

Related terms must be in the same site and locale; the model refuses any other id with 400.

### 3.3 Uniqueness

**A term's name and its aliases share one namespace with every other term's name and aliases** in the
same site and locale, compared with `lower()` after normalization. So:

- `REST` and `rest` cannot be two terms. `caseSensitive` on `REST` says that the word `rest` in a
  paragraph is not a mention of it; it does not make room for a second entry spelled `rest`.
- An alias may not equal another term's name, nor one of its aliases.
- An alias equal to the term's own name, or repeated, is dropped silently on save rather than refused.

The unique index covers term against term. Everything involving an alias is checked in the model,
inside the save's transaction, and refused with **409** naming the term that already holds the name, so
the form can say which one. Two saves racing to claim the same alias are not caught by the index; that
is accepted, since the outcome is two terms sharing an alias, which a later edit of either one refuses
and so surfaces.

Comparison uses Postgres `lower()` on the server and `toLocaleLowerCase(locale)` in the browser. The two
agree for every case a glossary is likely to meet; the server is the one that decides.

### 3.4 Limits

| Field | Limit |
| --- | --- |
| `term`, `expansion`, `category`, `documentationLabel`, each alias | 255 characters |
| `aliases` | 50 |
| `definition` | 10,000 characters |
| `references` | 20; `url` is `http:` or `https:` only, `label` up to 255 characters and optional (the URL stands in) |
| `relatedTerms` | 50 |

---

## 4. Permissions

Two permissions of the same kind: page-rule permissions whose rule's path is ignored, so that both are
granted per site and per locale. A site may open its glossary to the readers of one locale and not
another, and hand the maintenance of each locale's glossary to the people who write in it.

### 4.1 The rule

Both are **page-rule permissions**, added to `PAGE_PERMISSIONS` and granted through a group's rules like
`read:pages`. They are the page permissions whose rule's **path is ignored** (`LOCALE_PERMISSIONS`): the
question they answer is about a site and a locale, and a glossary has no path.

**Every rule naming the permission that is scoped to the site and the locale applies, whatever its
`match`, `path` or `tags`, and the modes rank as they do for any other rule:**

    ALLOW  <  DENY  <  FORCE ALLOW

So: no such rule, denied; only ALLOWs, granted; any DENY overrides every ALLOW; any FORCE ALLOW
overrides every DENY. This is step 4 of the ordering in
[`helpers/pageRules.ts`](../../backend/helpers/pageRules.ts) on its own (`resolveLocaleRule`). Steps 1
to 3, which rank rules by how precisely they address a page, have nothing to rank when no page is being
asked about, so every rule counts as equally specific and mode alone decides.

What follows from ignoring the path, and what the permissions' hints in the group editor have to say:

- **A rule anywhere speaks for the whole locale.** An ALLOW written for `/docs` opens the entire
  glossary, the same as one for the site root.
- **A DENY anywhere closes the whole locale**, and a more specific ALLOW does not reopen it the way it
  would for pages. Only a FORCE ALLOW does. A DENY rule for `/confidential` that also names
  `read:glossary` therefore hides the glossary from that group entirely.

Both are asked by `groups.checkLocaleAccess(actor, permission, siteId, locale)`, and `checkAccess` routes
them there, so asking about one at a page gets the locale's answer. The worker-side `rulesAllow` is not
involved: nothing in a worker reads the glossary. `manage:system` implies both, as it implies
everything. No route declares either in `config.permissions` (the hook reads the global list only);
every glossary route checks in the handler, with a `No route-level permissions:` comment as
`api/pages.ts` does.

### 4.2 `read:glossary`

- **`manage:glossary` in a locale implies it there.** Editing a glossary one may not read is not a state
  worth supporting, and the editor has to see the list to pick related terms. Each is decided on its own
  rules first, so a DENY on reading does not take managing with it.
- **Guests may hold it**: it joins `GUEST_ROLES` in `models/groups.ts` (and the copy in
  `GroupEditOverlay.vue`), which is what lets a public wiki open its glossary to readers without an
  account.
- **Seeding**: `read:glossary` is added beside `read:pages` in the Users group's seeded ALLOW rule
  (`groups.init()`) and in the starting rule of a newly created group (`createGroup`). It is
  deliberately **not** added to the Guests group's seeded DENY rule. Guests are denied anyway with no
  rule at all, and a DENY there would mean an administrator's later ALLOW for guests did nothing (the
  DENY outranks it, path or no path), leaving FORCE ALLOW or editing the default rule as the only ways
  in. Without it, a fresh install's guests cannot read the glossary until an administrator writes an
  ALLOW rule for it, as with pages.

### 4.3 `manage:glossary`

Create, edit and delete terms in the rule's locales. A write is asked about in the locale of the term it
touches: the body's `locale` on a create, the stored term's on a save or a delete. A term the caller may
not even read answers 404 there, as it does on the read route; one they may read but not manage, 403.

- **Not seeded anywhere** and not in `GUEST_ROLES`: maintaining the glossary is something an
  administrator hands out, and a guest has no session to attribute an edit to.

### 4.4 What a reader sees

**The documentation link is shown to every reader of the term**, whether or not they may read the page
it points at; following it answers as the page route always does. Hiding it would need a page-rule check
per term in the list, for no information the reader does not already have from the term itself.

### 4.5 On the frontend

`userStore.pagePermissions` cannot answer `read:glossary`: it is what the session holds at the current
PATH, it now arrives with the page payload rather than from `pages/userPermissions`, and it is empty on
every route that is not a page — `/_tags` included, where the Library menu is still drawn. So the
answer has an endpoint of its own, `GET /sites/:siteId/glossary/access`, which reports the site switch,
the active locales the session may read the glossary in, and the ones it may edit it in.
`stores/glossary.js` asks it once per site and session (again after a login or a logout), since none
of it changes from page to page.

- The Library menu's Glossary row shows when `features.glossary` is on and at least one locale is
  readable. The overlay opens in the interface's locale when that one is readable, and in the first
  readable one otherwise.
- New Term, Edit and Delete show where the locale on screen is one of the editable ones.
- The overlay's locale picker offers every active locale. One the session may not read the glossary in
  answers the list with 403, and the sidebar says so in place of the list.

---

## 5. Backend

### 5.1 API

All under `/_api/sites/:siteId/glossary`, tagged `Glossary`.

| Method and path | Permission | What it does |
| --- | --- | --- |
| `GET /access` | none (it reports the permissions) | `{ enabled, readableLocales, manageableLocales }` for the caller ([§4.5](#45-on-the-frontend)) |
| `GET /?locale=` | `read:glossary` in the locale | The list: `id`, `term`, `expansion`, `aliases`, `category`, `caseSensitive`, `autoLink`. Everything the sidebar draws and everything [§9](#9-auto-linking-later) will need, and nothing else |
| `GET /categories?locale=` | `read:glossary` in the locale | Distinct categories, for the form's suggestions |
| `GET /:termId` | `read:glossary` in the term's locale | The whole term, with `relatedTerms` as `[{ id, term }]` and `documentation` as `{ path, label, title, exists }` |
| `GET /lookup?locale=&name=` | `read:glossary` in the locale | Resolves a name or alias to a term id, for [§7](#7-urls); 404 when nothing matches |
| `POST /` | `manage:glossary` in the body's locale | Creates a term; answers it in full |
| `PUT /:termId` | `manage:glossary` in the term's locale | Replaces a term; carries `expectedUpdatedAt`; answers it in full |
| `DELETE /:termId` | `manage:glossary` in the term's locale | Deletes a term and, by cascade, its relations |

`relatedTerms` is written as an array of ids. `locale` is set on create and cannot be changed by `PUT`:
moving a term to another locale would orphan its relations and its documentation path at once, and a
term in another locale is a different term.

Every write fails with 404 when `features.glossary` is off for the site, the two lists answer empty, and
a single term and a lookup answer 404, so that turning the switch off hides the glossary without
deleting it.

### 5.2 Concurrent edits

`PUT` carries `expectedUpdatedAt`, the `updatedAt` the form was opened with. The model compares it inside
the save's transaction (`UPDATE … WHERE id = $1 AND "updatedAt" = $2`), and when no row matches because
the term has changed since, answers **409** with the term as it now stands. The form then says that
somebody else changed it, shows who and when, and offers to reload it (losing the draft) or to keep the
draft and save over the newer version, which re-sends with the new `updatedAt`.

A term deleted while it was open answers 404, and the form says so.

`updatedAt` is compared at millisecond precision, as written by the rest of the codebase.

### 5.3 Moving a page

`pages.relinkMovedPage` is what `PUT /pages/:id/move` calls when `updateLinks` is set. It also rewrites
`documentationPath` on every term in the page's site and old locale that points at the old path, in the
same call:

- **Same locale**: the path is replaced.
- **Another locale**: the term's path is cleared, since a documentation page must be in the term's own
  locale. The move's result reports the terms affected, so the dialog can say so.

These are not edits to somebody else's work in the way relinking a page is, so they are not asked about
per term: the person moving the page with `updateLinks` has asked for what pointed at it to follow.
`updatedAt` is bumped on each term touched, so a form open on one of them gets the 409 above.

**Not covered**: a move without `updateLinks`, a deletion, and a **folder rename**, which moves the pages
beneath it without relinking anything today. Folder renames are deliberately out of scope here; they
will be handled, for links and documentation paths together, as a separate improvement. A term then
points at a path with no page, and the term view says the page was not found rather than offering a
dead link.

### 5.4 Site switch

`features.glossary`, on by default, in the site defaults in `models/sites.ts` and under **General →
Features**. Off, the Library menu has no Glossary row and the API behaves as in
[§5.1](#51-api). Nothing is deleted.

---

## 6. The overlay

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Glossary                                          [ en ▾ ]       [×] │
├──────────────────────┬───────────────────────────────────────────────┤
│ [ + New Term ]       │                                               │
│ [ Filter…          ] │   TERM                                        │
│ [Category ▾]         │   Expansion                                   │
│                      │                                               │
│ A                    │   Definition…                                 │
│   API                │                                               │
│   Application Prog…  │   Also: aliases                               │
│ ▸ ACL                │   Related: [chip] [chip]                      │
│ B                    │   Read more → /docs/api                       │
│   …                  │   References: …                               │
│                      │   Category: Networking                        │
│                      │                               [Edit] [Delete] │
└──────────────────────┴───────────────────────────────────────────────┘
```

- **Header**: title, the locale picker (only where the site has more than one active locale), close.
- **Sidebar**: New Term (for `manage:glossary`), a filter field matching names and aliases, an
  **A–Z / Category** switch, then the terms, each with its expansion as a second line.
  - **A–Z**, the default: under letter headings. Letters are the term's first character, upper-cased
    in the locale; everything that is not a letter goes under `#`.
  - **Category**: under one heading per category, sorted by name, A–Z within each, with the terms that
    have none last under "Uncategorized".

  The switch is remembered per browser (`localStorage`, as a convenience that may come back empty). The
  whole list for the locale is fetched once when the overlay opens, which is comfortable to a few
  thousand terms; beyond that the filter would move to the server.
- **Main panel**: one of three states, below.

Below 900px the two columns become a list → detail flow: the list fills the overlay, a term replaces it,
and a back button returns. The same breakpoint the header's action buttons collapse at.

### 6.2 Viewing a term

Name, expansion, the rendered definition, aliases, related terms as chips (clicking one moves the panel to
it and updates the URL), the documentation link (its label, or "Read more"; "page not found" where the
path no longer resolves), references as a list of external links, and the category (clicking it switches the
sidebar to Category and scrolls to that heading). Edit and Delete for `manage:glossary`; Delete confirms first.

### 6.3 The form

Shown by New Term and by Edit, in the main panel.

| Field | Control |
| --- | --- |
| Term | Text input, required |
| Expansion | Text input |
| Definition | Textarea with a Write / Preview toggle |
| Aliases | Chip input |
| Related terms | Autocomplete over the locale's terms, excluding this one |
| Documentation page | `LinkPickerDialog` with `pagesOnly` (a new prop hiding the URL tab), locked to the term's locale; a clear button |
| Documentation label | Text input, placeholder "Read more" |
| References | Repeatable rows of URL + label, with add and remove |
| Case sensitive | Toggle |
| Auto-link | Toggle, shown on and **disabled**, with a "Coming soon" hint ([§9](#9-auto-linking-later)) |
| Category | Select with suggestions from `GET /categories`; Enter on a new name uses it; shown as a removable chip |

**Renaming.** When the Term field of an existing term is changed, a checkbox appears under it: *Keep
"‹old name›" as an alias*, **unchecked by default**. Checked, the form adds the old name to `aliases`
before saving, so that `?glossary=` links to the old name keep resolving ([§7](#7-urls)). It is the
form's doing rather than the API's: the server sees an ordinary save, and the uniqueness check runs
against the term's new name and aliases as usual, which the old name, now freed by the rename, passes.

A name collision answers 409 from the server and is shown against the field that caused it, naming the
term that holds the name. The sidebar's list is also checked as the user types, which catches most
collisions before a save; the server's answer is the one that counts.

**Unsaved changes**: choosing another term, New Term, switching locale or closing the overlay with a
changed form asks before discarding it.

### 6.4 The definition

**Basic markdown, stored as source and rendered in the browser at display time**, which is the bargain
the built-in comments already make. `html: false` is the security boundary: nothing stored is ever HTML,
so there is nothing to sanitize and nothing sanitized by older rules to serve back.

The comment renderer (`renderers/comment.js`) is the right feature set (paragraphs, emphasis, inline
code, code blocks, lists, links; no headings, images or tables) with two things the glossary does not
want: `@handle` mentions, and `rel="nofollow ugc"` on links that a holder of `manage:glossary`, not an
anonymous commenter, wrote. So `comment.js` exports `createProseMarkdown({ rel })`, the configuration
both use, and `renderers/glossary.js` builds its own instance from it with `rel="noopener"` and no
mention pass.

---

## 7. URLs

**`?glossary=<name>` on any path the main layout draws** opens the overlay on that term, in the locale of
the path. `<name>` is the term's name, URL-encoded, resolved with `GET /lookup`, which matches aliases
too, so a term renamed with its old name kept as an alias keeps its old links working.

- Opening the overlay from the menu adds `?glossary` with no value (the list, nothing selected).
- Selecting a term replaces the value; closing the overlay removes the parameter. Both use
  `router.replace`, so browsing the glossary does not fill the history with one entry per term.
- A name that resolves to nothing opens the list with a notice, rather than an error page.
- Switching locale in the overlay adds `&glossaryLocale=<code>` when it differs from the path's locale,
  and removes it when it does not.

A query parameter rather than a route of its own, so a shared link opens the term **over the page it was
shared from**, which is usually the context it was being discussed in. The overlay is only mounted by
`MainLayout`, so the admin area and the profile pages ignore the parameter.

---

## 8. Audit log

A new kind, `glossary`, with three actions: `createGlossaryTerm`, `updateGlossaryTerm`,
`deleteGlossaryTerm`. Each records `siteId`, `locale`, `termId` and `term`; an update also records which
fields changed, not their values, as configuration routes do. The terms rewritten by a page move are
recorded in that move's own entry (`meta.glossaryRelinked: [termId…]`) rather than as entries of their
own.

Strings: `admin.audit.kinds.glossary` and `admin.audit.actions.<action>`.

---

## 9. Auto-linking (later)

Recognising terms in page text and linking them to their definitions. Not built in the first version,
but the first version is shaped for it: the `autoLink` and `caseSensitive` columns, aliases, the list
endpoint carrying exactly what a matcher needs, and the uniqueness rule that makes every match resolve to
a single term.

**It happens in the reader's browser, when the page is drawn.** A page's render is produced once at save
time; linking terms into it then would mean re-rendering every page whenever any term changes, and would
freeze a link to whatever a word meant on the day the page was saved. Drawn at display time, a new term
appears in every page at once and a deleted one disappears.

Sketch, to be settled when it is built:

- **The list**, `GET /?locale=` filtered to `autoLink`, fetched once per locale per session and
  revalidated with an ETag derived from the locale's newest `updatedAt` and term count.
- **The matcher** is compiled from every name and alias, longest first, so `REST API` wins over `REST`.
  Case-insensitive terms compare with `toLocaleLowerCase(locale)`. Word boundaries come from
  `Intl.Segmenter(locale, { granularity: 'word' })`, which is what makes it work in languages written
  without spaces.
- **Where it looks**: text in the article body only. Not in headings, links, `code`, `pre`, `kbd`, blocks,
  or the table of contents.
- **How often**: the first occurrence of each term per page, so a paragraph about REST is not a wall of
  underlines.
- **What a match looks like**: an underline, a hover card (expansion and the first lines of the
  definition), and a click that opens the overlay on the term. It has to be focusable and reachable by
  keyboard.
- **Switches**: the term's `autoLink`, a site setting, and a page property to opt a page out.
- **Crawlers** never see it. The app shell's prerendered body is the stored render, unchanged.

**Open design point: spans or highlights.** Wrapping matches in elements is the simplest way to get
hover, focus and keyboard access, but changes the DOM of the article. Annotations deliberately insert
nothing and use the CSS Custom Highlight API with click hit-testing (`PageAnnotationsLayer.vue`); the two
features have to coexist on one article, and annotations find their passages again by text, which
wrapped matches must not disturb.

---

## 10. Behaviour worth pinning down

- **Deleting a term** removes it from every related list (cascade) and breaks any `?glossary=` link to it,
  which then opens the list with a notice.
- **Renaming a term** breaks `?glossary=` links to the old name, unless the editor ticks the option to
  keep it as an alias ([§6.3](#63-the-form)).
- **A related term in the list but deleted before the save** is refused with 400, and the form reloads the
  list.
- **A term's documentation page deleted** leaves the path in place, shown as "page not found", so that
  restoring the page restores the link.
- **Turning `features.glossary` off** hides the glossary everywhere and keeps every term.
- **Deleting a site** deletes its terms (cascade on `siteId`).

---

## 11. Suggested order

1. Schema and migration; `read:glossary` and `manage:glossary` (model lists, `checkLocaleAccess`, the
   seeded default rule, the group editor, CLAUDE.md); the site switch.
2. Model and API, including uniqueness, two-way relations, the `updatedAt` check and the audit entries.
3. The overlay: list, view, form, and the Library menu row.
4. URLs.
5. `relinkMovedPage` rewriting documentation paths.
6. Later: auto-linking ([§9](#9-auto-linking-later)), then the other non-goals as they are wanted.

---

## 12. Open questions

None at the moment.
