# Glossary

**Status:** every phase of [§11](#11-suggested-order) implemented — storage, permissions, the API, the
overlay, URLs, the page-move rewrite and auto-linking. Where building it changed the design, this
document was changed with it.
**Covers:** what a glossary term is, how it is stored, who may read and edit it, the overlay it is read
and edited in, its URL, and how terms are linked in page text.

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
- **Linking terms in page text** ([§9](#9-linking-terms-in-page-text)): automatically, the first time
  each is mentioned on a page, and by hand with `[[Glossary:Term]]` or any link to `?glossary=Term`.

**Non-goals for the first version**

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
| Entry point | The Glossary row of `HeaderLibraryMenu.vue`, and `?glossary=` links answered by `MainOverlayDialog.vue` |
| URLs | `frontend/src/helpers/glossaryUrl.js` ([§7](#7-urls)) |
| Links in page text | `frontend/src/helpers/glossaryLinker.js` and `components/PageGlossaryCard.vue`, driven by `pages/Index.vue` ([§9](#9-linking-terms-in-page-text)) |
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
| `autoLink` | boolean, not null, default true | Whether the term is linked automatically in page text ([§9](#9-linking-terms-in-page-text)). A link written by hand is drawn either way |
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
| `GET /?locale=` | `read:glossary` in the locale | The list: `id`, `term`, `expansion`, `aliases`, `category`, `caseSensitive`, `autoLink`. Everything the sidebar draws, and nothing else |
| `GET /autolink?locale=` | `read:glossary` in the locale | The terms with `autoLink` on, as `id`, `term`, `expansion`, `aliases`, `caseSensitive`: what [§9](#9-linking-terms-in-page-text) matches page text against. Answers with an `ETag` and 304; empty while either switch is off |
| `GET /categories?locale=` | `read:glossary` in the locale | Distinct categories, for the form's suggestions |
| `GET /:termId` | `read:glossary` in the term's locale | The whole term, with `relatedTerms` as `[{ id, term }]` and `documentation` as `{ path, label, title, exists }` |
| `GET /lookup?locale=&name=` | `read:glossary` in the locale | Resolves a name or alias to a term id, for [§7](#7-urls); 404 when nothing matches |
| `POST /` | `manage:glossary` in the body's locale | Creates a term; answers it in full |
| `PUT /:termId` | `manage:glossary` in the term's locale | Replaces a term; carries `expectedUpdatedAt`; answers it in full |
| `DELETE /:termId` | `manage:glossary` in the term's locale | Deletes a term and, by cascade, its relations |

`relatedTerms` is written as an array of ids. `locale` is set on create and cannot be changed by `PUT`:
moving a term to another locale would orphan its relations and its documentation path at once, and a
term in another locale is a different term.

Every write fails with 404 when `features.glossary` is off for the site, the lists answer empty, and
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
- **Another locale**: the term's path is cleared, label and all, since a documentation page must be in
  the term's own locale.

The move's result reports both as counts (`relinked.glossary: { updated, cleared }`) — counts only,
since the terms are in a glossary the mover need not be able to read — and the mover is told: the first
as a passing notice, the second as one that stays, because it is something to go and fix. It runs
whether or not any page links to the moved one; a page can document a term without a single page
linking to it.

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
| Auto-link | Toggle, on by default ([§9](#9-linking-terms-in-page-text)) |
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

**`?glossary=<name>` on any path that can show the overlay** opens it on that term, in the locale of
the path. `<name>` is the term's name, URL-encoded, resolved through the list already loaded or
`GET /lookup`, which match aliases too, so a term renamed with its old name kept as an alias keeps its
old links working. `helpers/glossaryUrl.js` holds every piece of it.

- Opening the overlay from the menu adds `?glossary` with no value (the list, nothing selected).
- Selecting a term replaces the value, as does saving one (a rename changes what a link to it says).
  Both use `router.replace`, so browsing the glossary does not fill the history with one entry per term,
  and the router keeps its scroll position for a navigation that changed nothing else.
- Following a glossary link in an article **pushes** the parameter, as following any link would, so
  Back puts the overlay away again. Closing the overlay steps back over that entry when it was one,
  and otherwise takes the parameter off with `replace`.
- The parameter changing under an open overlay (Back, Forward) moves it to what the URL now says,
  asking first about an unsaved form; going away altogether closes it.
- A name that resolves to nothing opens the list with a notice, rather than an error page.
- Switching locale in the overlay adds `&glossaryLocale=<code>` when it differs from the path's locale,
  and removes it when it does not.
- A link in a definition to another term moves the panel to it rather than loading the page again.

A query parameter rather than a route of its own, so a shared link opens the term **over the page it was
shared from**, which is usually the context it was being discussed in. The parameter is answered by
`MainOverlayDialog.vue`, which is what every screen able to show an overlay mounts — `MainLayout`, and
the Tags, Search, inbox and profile screens that draw their own. The admin area mounts none, and ignores
it.

---

## 8. Audit log

A new kind, `glossary`, with three actions: `createGlossaryTerm`, `updateGlossaryTerm`,
`deleteGlossaryTerm`. Each records `siteId`, `locale`, `termId` and `term`; an update also records which
fields changed, not their values, as configuration routes do. The terms rewritten by a page move are
recorded in that move's own entry (`meta.glossaryRelinked: [termId…]`, and `meta.glossaryCleared` for
those whose documentation page left their locale) rather than as entries of their own.

Strings: `admin.audit.kinds.glossary` and `admin.audit.actions.<action>`.

---

## 9. Linking terms in page text

A term is linked where it is mentioned in an article: a dotted underline, a card with its definition on
hover or focus, and the overlay on click. Automatically, for the first mention of each term on a page,
and by hand anywhere.

**It happens in the reader's browser, when the page is drawn** (`helpers/glossaryLinker.js`, called from
`pages/Index.vue`). A page's render is produced once at save time; linking terms into it then would mean
re-rendering every page whenever any term changes, and would freeze a link to whatever a word meant on
the day the page was saved. Drawn at display time, a new term appears in every page at once and a
deleted one disappears. **Crawlers never see it**: the app shell's prerendered body is the stored render,
unchanged.

### 9.1 What is linked

- **The list** is `GET /autolink?locale=`, fetched once per locale per session (`stores/glossary.js`)
  and revalidated by the browser with an `ETag` built from the locale's term count, its newest
  `updatedAt` and the switch — every write changes one of them. The overlay drops it after every save
  and delete, which re-links the page behind it at once.
- **The matcher** is compiled from every name and alias, cut into word segments by
  `Intl.Segmenter(locale, { granularity: 'word' })` exactly as the text is, so a match starts and ends on
  a word boundary in any script — including those written without spaces — and `REST` is never found in
  `RESTful`. Candidates are tried longest first, so `REST API` wins over `REST`; where the longest name
  at a position belongs to a term already linked, nothing shorter is linked inside it. Case-insensitive
  terms compare with `toLocaleLowerCase(locale)`; a run of whitespace is one space.
- **Where it looks**: the article's text only. Never in headings, links, `code`, `pre`, `kbd`, `samp`,
  `var`, `abbr`, `dfn`, `nav`, form controls, media, SVG or MathML, a content block (any custom element),
  a rendered formula (`.katex`) or diagram (`.mermaid`) — nor in anything an author marked
  `.no-glossary` (`{.no-glossary}` in markdown).
- **How often**: the first occurrence of each term per page, in document order, so a paragraph about
  REST is not a wall of underlines. A link written by hand counts as that term's occurrence.
- **Where `Intl.Segmenter` is missing**, nothing is linked automatically.

### 9.2 Links written by hand

**Any link to `?glossary=<name>` on the page it sits on is a glossary link** — `[REST](?glossary=REST)`
in any editor — and markdown has a shorthand where the site has wikilinks on: `[[Glossary:REST]]` and
`[[Glossary:REST|shown text]]` (`renderers/modules/markdown-it-wikilinks.js`; the namespace is
case-insensitive, and everything after the colon is the name, `#` included). They are drawn exactly as
automatic ones are and open the same card, **whatever the auto-link switches say**: they are the way to
reference a term where nothing is linked automatically. The Visual editor writes `[[Glossary:REST]]`
back as it found it.

A bare `?query` href is not a link to a page for the server (`resolveLink` in `helpers/pageLinks.ts`),
as a bare `#fragment` is not: recorded, it would be the page linking to itself, and a move with
`updateLinks` would rewrite it into an absolute path.

### 9.3 What a match looks like

- **A real link**, `<a class="glossary-term" href="?glossary=<term>">`, around the matched words. That
  is what makes it focusable, reachable by keyboard, announced as a link and copyable as a URL without
  any of it being built by hand; the alternative, painting matches with the CSS Custom Highlight API as
  annotations do, could have none of that.
- **Drawn as an abbreviation is**: the paragraph's own ink, a dotted underline in the link colour, solid
  under the pointer or the keyboard (`_page-contents.scss`). Dotted is what tells it apart from the
  links around it, Underline Links setting included.
- **A card** (`PageGlossaryCard.vue`) after a short hover, or at once on focus: the name, the expansion,
  the first five lines of the definition and a **Read more** link that does what a click on the term
  does. A tooltip in the ARIA sense — the link is `aria-describedby` it while it is up — so Read more is
  for the pointer only, out of the tab order: keyboard focus stays on the term, whose Enter does the
  same thing. Escape puts the card away.
- **A click**, or Enter, pushes `?glossary=<term>` and the overlay opens on it ([§7](#7-urls)). A
  middle-click or a modified click is the browser's, as on any link.

### 9.4 Switches

All three must allow it, and none of them affects a link written by hand:

- the term's `autoLink` (the form's Auto-link toggle);
- the site's `features.glossaryAutoLink` (General → Features, **on** by default and read as on where it
  was never saved, as `features.glossary` is; nothing while the glossary itself is off);
- the page's `allowGlossaryLinks` (its properties, Relations card; on unless turned off, kept in the
  page's `config` beside `allowComments`).

And the reader must hold `read:glossary` in the page's locale: the list answers 403 otherwise, and a
page is linked for nobody who could not open what the link leads to.

### 9.5 Annotations

**Both live on the same article, and the links change its elements but never its text.** Annotations
find their passages again by text (`helpers/annotations.js`), and an `<a>` is not one of the elements
whose text they skip, so a link changes nothing about where a passage is.

What linking cannot keep is a live `Range` exactly where it was: moving the matched words into a link
takes them out of the tree for a moment, and the DOM puts a range boundary that was *inside* them on the
link's edge. So `Index.vue` bumps `contentRevision` whenever it links or unlinks anything, and the
annotation layer and the annotator find their passages again by text on it — as the layer already did
whenever the render changed.

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
6. Linking terms in page text ([§9](#9-linking-terms-in-page-text)), then the other non-goals as they
   are wanted.

All six are done.

---

## 12. Open questions

None at the moment.
