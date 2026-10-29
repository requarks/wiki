# Search suggestions

**Status:** page suggestions ([§4](#4-page-suggestions)) are implemented. Word completion
([§5](#5-word-completion)) is designed and not built. [§2](#2-what-exists-today) describes the
full-text search this sits beside, as it stood before.
**Covers:** what the header search box offers while a query is being typed, why that is harder than it
looks on a wiki with page rules, what was built, and the plan for completing words.

The header search box only answers once Enter is pressed, with a full-text search on `/_search`.
Autocomplete — offering something while the reader is still typing — is the obvious next step. On a wiki
whose pages are not all readable by everyone, it is also an easy way to leak what those pages say.

The constraints this is written against:

- **A suggestion never tells a reader more than the full search would.** If they could not find a page,
  or a word in it, by searching and opening the results, nothing in the dropdown may hint at it.
- **An index per user is not practical.** Page rules are pooled across a user's groups and can be
  regular expressions or tag sets, so the set of pages one person can read has to be computed per page.
  A vocabulary materialized per account would multiply storage by the number of users and go stale on
  every rule change.
- **It is asked on every keystroke.** Each request has a hard cost ceiling, whoever is asking and
  however little of the wiki they may read.

---

## 1. Goals and non-goals

**Goals**

- **Page suggestions**: pages whose title or path matches what has been typed, exact for whoever is
  typing, opened with a click or the keyboard.
- **Word completion**: completing the word being typed from the wiki's vocabulary, without leaking
  vocabulary from pages the reader cannot open. Designed in §5, not built.

**Non-goals**

- **Matching on page text in suggestions.** That is the full search's job, and the text is what a
  page password covers.
- **Typo tolerance** (`similarity()` / `word_similarity()` from `pg_trgm`). Substring matching is what
  a reader typing a title expects; see [§7](#7-open-questions).
- **Suggesting tags or glossary terms** in the same dropdown.

---

## 2. What exists today

Full-text search is `searchPages` in `backend/models/search.ts`, served at
`GET /sites/:siteId/pages/search`:

- Every page has a `ts` tsvector (GIN-indexed): title weighted `A`, description `B`, body `C`, built
  with a per-locale dictionary (`DEFAULT_DICTIONARIES`, overridable from **Admin → Search**). The vector
  holds **stemmed** lexemes (`comput`, `configur`), so it cannot be shown to a reader as words.
- Access is checked **per row, before paging**: the query ranks every match while reading only the
  columns a rule looks at, filters them through `groups.checkAccess(actor, 'read:pages', …)` and the
  unpublished rule, and only then pages. `manage:system` skips the rules and gets database paging.
- A password-protected page can only be matched on its title and description (`ts_filter(ts, '{a,b}')`),
  is ranked on them alone, and comes back with no excerpt — for every searcher, including whoever
  could open it without the password. A page with no password is ranked on its whole index.
- `isSearchable = false` keeps a page out of the results for everyone.

`pg_trgm` was already in `REQUIRED_EXTENSIONS` (`core/db.ts`), with nothing using it.

---

## 3. Two kinds of suggestion

"Autocomplete" covers two different features, with very different leak profiles:

| | Page suggestions | Word completion |
| --- | --- | --- |
| Offers | Pages to jump to | Words to finish the query with |
| Unit of access | One page — checkable per row | A word drawn from many pages — not checkable per row |
| Exact per reader | Yes, cheaply | Only with a materialized index per access class |
| Status | Implemented ([§4](#4-page-suggestions)) | Planned ([§5](#5-word-completion)) |

Page suggestions are most of the value — MediaWiki's search box is exactly this — and they can be made
exact with no index and no settings, because every suggestion *is* a page and only a handful are needed.
So they were built first.

---

## 4. Page suggestions

### 4.1 API

`GET /sites/:siteId/pages/suggest?query=&locale=&limit=` (`api/pages.ts`), with no route-level
permission, like the search: an anonymous request is the guests group.

| Param | |
| --- | --- |
| `query` | Required, 1–255 characters. What has been typed. |
| `locale` | Required. Only pages in this locale are suggested. |
| `limit` | 1–20, default 8. |

The answer is `{ results: [{ id, path, locale, title, description, icon }] }`, best match first.

### 4.2 Matching

`search.suggestPages` (`models/search.ts`):

- The query is lowercased, whitespace is collapsed, and it is split into words. Duplicates are dropped,
  and only the first 8 words count (`SUGGEST_MAX_WORDS`).
- **Every word must occur in the title (`ILIKE`) or the path (`LIKE`, paths being lowercase)**, in any
  order and anywhere in the string. So `start guide` finds `guides/getting-started/installation`.
- LIKE wildcards in what was typed are escaped (`escapeLike`), so `%` is a literal percent sign.
- **Titles and paths only.** A password-protected page is suggested, because its title is not what the
  password covers, the same rule the search applies.
- **One locale**, the reader's. A list offering the same title once per translation is mostly pages the
  reader cannot read. The full search is where the other locales are.

Both columns have a GIN trigram index (`pages_title_trgm_idx`, `pages_path_trgm_idx`, migration
`20261015020847_page-suggest-trgm`), which is what answers `ILIKE '%word%'`.

### 4.3 Ranking

| Rank | Match |
| --- | --- |
| 0 | The whole phrase is the title, or the phrase with spaces as hyphens is the path |
| 1 | The title starts with the phrase |
| 2 | A word of the title starts with the phrase |
| 3 | The title contains the phrase |
| 4 | The title contains every word, in any order |
| 5 | Otherwise — at least one word matched only in the path |

Ties are broken by shorter title, then by title alphabetically, then by path.

### 4.4 Access

The same rules as `searchPages`. The per-row check is shared between the two as `search.mayList`:

- `isSearchable = true`, always.
- Pages that are not live are included only for a session (`unpublished`) whose actor holds
  `write:pages` or `manage:pages` somewhere (`maySeeUnpublishedAnywhere`). After that, each one is
  checked against `maySeeUnpublished` for that page.
- `read:pages` per page through `groups.checkAccess`.

**What bounds the cost:** candidates are read in rank order, with a cap of 200
(`SUGGEST_CANDIDATES`). The access check walks them and stops once `limit` pages pass. A reader who may
open most of the wiki is answered from the first few rows. A reader who may open almost none of a large
wiki can get fewer suggestions than exist, or none, rather than a scan of every page whose title
contains the letter typed. The API description says so. `manage:system` skips the rules and the query
uses `LIMIT limit` directly.

Nothing is shared between readers and nothing is cached, so there is nothing to leak through.

### 4.5 The header search box

`frontend/src/components/HeaderSearch.vue`:

- **What is asked.** Tokens that only mean something to the full search are dropped: `#tags`,
  `-excluded` and `!excluded` words, quotes, `*`, and `,`/`|` used as OR. Nothing is asked under 2
  characters (`SUGGEST_MIN_LENGTH`), or while the field is not focused. The request is debounced 150 ms,
  and a newer request aborts the one in flight. A failed request shows nothing; the full search is still
  one Enter away.
- **What is shown.** While there are suggestions, a "Page Suggestions" list
  (`common.header.searchSuggestions`) replaces the popular tags and the search operator tips. Each row
  shows the page's icon (or `DEFAULT_PAGE_ICON`), its title, and its address, built as on the search
  page from `localeUrlPrefix(locale)` plus the path. The previous list stays up while the next one
  loads, so the panel does not flicker on each keystroke.
- **Rows are real `<router-link>`s**, so middle-click and modifier-clicks open a new tab. A plain click
  or Enter navigates, then empties the field and blurs it. A modifier-click leaves both alone.
- **Keyboard.** ↓/↑ move through the list. Down from the last row and Up from the first both return to
  the field. Enter opens the highlighted row, or runs the full search when none is highlighted — what
  Enter always did. Escape hides the list until the text changes. Enter is now handled on **keydown**
  rather than keyup, and is ignored while `isComposing`, because an IME commits with Enter.
- **Accessibility.** The input is a `combobox` with `aria-autocomplete="list"`, `aria-expanded`,
  `aria-controls` and `aria-activedescendant`. The list is a `listbox` of `option`s with ids from
  `useId()`, since the phone header and the desktop header can each mount a copy.

---

## 5. Word completion

Not built. This section is the plan, including the alternative that was considered first and why it
was set aside.

### 5.1 The first proposal: one index, built as one group sees the wiki

Build one vocabulary from the pages readable by a chosen group (default **Users**), refreshed on a
schedule. **Admin → Search** would select the group and whether unauthenticated visitors may use it
(off by default).

The shape is right — one shared vocabulary built from a reference view, refreshed in the background —
but as stated it leaks in three ways:

1. **A group's view is not the floor of its members' view.** A user's rules are all of their groups'
   rules pooled, and a second group can narrow what the first allowed (`helpers/pageRules.ts`). Someone
   in Users and in a Contractors group with a DENY on `/finance` would be offered every word from
   `/finance`. Users is not even automatic: it is only the default group for new registrations
   (`groupUserId` in `core/config.ts`), so the index would at least have to be gated on membership — and
   that gate still does not close the DENY case. Nothing can enforce the condition the setting depends
   on: "everyone in this group may read at least what it can".
2. **The guest toggle publishes internal vocabulary.** Serving a Users-built index to anonymous
   visitors tells the public which words appear in pages they cannot open — a project codename, say.
3. **Rare words are the actual leak.** Even inside a correctly chosen group, a word that appears on a
   single page is the most sensitive thing in the index and the least useful one to complete.

### 5.2 The plan: one index per group set

Leaving aside pages that are not live — which the index excludes anyway — the set of pages a user can
read depends only on **which groups they are in**. Users collapse into a small number of distinct group
combinations: tens on a typical installation, not one per account. The notification fan-out already
relies on this (`rulesAllow` over the pooled rules of a group set, memoized — `notifications/fanout.ts`).

- **One vocabulary per distinct group set**, per site and per locale, each built from exactly the pages
  that set may read. It is exact, and it needs no admin setting. A set holding `manage:system` is one
  more set, built from every page.
- **Guests are the set `[guestsGroupId]`**, built from `groups.actorForPublic()` — the view the sitemap
  and the crawler document already use. It is safe to hand to anyone by construction, and on a private
  wiki it is empty. "Allow unauthenticated users" then becomes a plain feature switch that cannot leak.
- **Built lazily**, for the sets that actually search, with a cap on how many are kept (least recently
  used goes first). A set with no index yet gets no completions until its build lands, rather than
  waiting on it.
- **Fallback.** If real installations turn out to have too many distinct sets — memberships handed out
  very individually — fall back to §5.1 with its fixes: guests always on the public vocabulary, members
  of the configured group only, and the DENY caveat stated on the admin screen.

### 5.3 What goes into a vocabulary

- **Display words, not lexemes.** The `ts` column is stemmed and cannot be shown. A vocabulary is built
  with the `simple` configuration (`ts_stat` over `to_tsvector('simple', …)`), keeping each word and
  the number of pages it appears on.
- **A minimum document frequency** — on the order of 3 pages. This removes most of the rare-word leak
  and most of the junk (typos, IDs, hashes). It reduces exposure; it is not a guarantee, and §5.2 is
  what makes the index correct.
- **The search's exclusions:** pages that are not live, `isSearchable = false`, and for a
  password-protected page only its title and description.
- **Storage:** a table keyed by site, locale, group-set fingerprint and word, with the document count.
  Prefix lookups use a `text_pattern_ops` index; `pg_trgm` if typo tolerance is wanted later.

### 5.4 Keeping it current

- **Built by the scheduler**, on whichever instance gets the job, into the database, so every instance
  of an HA set reads the same index.
- **A schedule alone is not enough.** On a schedule, a deleted page or a tightened rule keeps leaking
  until the next run. Queue a debounced rebuild:
  - of every set, when a group's rules change or a page is deleted, moved or retagged (tags can be what
    a rule matches on);
  - of the affected set, when a user's group membership changes and creates a set that has no index yet.
- A page saved with new words can wait for the scheduled refresh: a word missing from completion leaks
  nothing.

---

## 6. Suggested order

1. Page suggestions: API, trigram indexes, header dropdown. **Done.**
2. Word completion for guests only, from the public vocabulary. This is the simplest case, carries no
   leak risk, and exercises the vocabulary build and the rebuild triggers.
3. Word completion per group set, with lazy builds and the cap.
4. Measure the number of distinct group sets on real installations, and fall back to §5.1 only if it
   calls for it.

---

## 7. Open questions

- **Accents.** `ILIKE` does not fold diacritics, so `resume` does not suggest `Résumé`. `unaccent` is
  not a required extension. Adding it is a change to `REQUIRED_EXTENSIONS` and to both trigram indexes,
  which would need to be on `unaccent(lower(...))`, an expression that requires an immutable wrapper.
- **Typo tolerance.** Ranking by `word_similarity()` after the substring tiers would catch `instalation`.
  It costs a less predictable list and is not obviously wanted while typing.
- **The candidate cap.** 200 is a guess. It should be revisited if readers with narrow access on large
  wikis report empty suggestions.
- **Whether word completion is worth building at all** once page suggestions have been in use for a
  while.
