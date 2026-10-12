# Drafts, autosave and live documents

**Status:** phase 1 of [§13](#13-suggested-order) implemented — the browser buffer and the leave
warnings ([§11](#11-the-browser-buffer)). Everything else is proposed.
**Covers:** where unpublished edits to a page are kept, how they are saved without the author asking,
what happens to a collaborative session when everybody leaves, the per-site draft workflow, and
per-page live documents.

Today an edit lives in exactly two places: the browser that is making it, and — once somebody presses
Save — the page itself. Everything in between is lost when a tab closes or a browser crashes. A
collaborative room is lost the moment its last participant leaves. And every save goes straight to
readers, so a change that takes three people a week has to be written somewhere else and pasted in.

This document adds one thing in the middle: **a draft, kept on the server, one per page**, separate
from the page row that readers are served. Autosave writes to it, a collaborative room is saved into
it, and publishing is the one act that copies it onto the page. Which of those a site and a page use
is a matter of settings ([§4](#4-editing-modes)); the storage underneath is the same for all of them.

The constraints this is written against:

- **The page row stays the published version.** Every reader of a page — the page route, the app
  shell, search, the sitemap, page links, storage targets — reads `pages` and goes on doing so
  unchanged. A draft is something only the editor and the people allowed to edit ever see.
- **The server cannot produce a page.** The render is made by the browser at save time. The server
  can only render with the Puppeteer extension, which is not installed by default, and only for some
  editors. Neither the Visual editor's ProseMirror tree nor an Excalidraw scene can be turned back
  into a page's source on the server at all. So the server may *store* an edit, but publishing
  always happens in a browser ([§6](#6-publishing)).
- **History records versions somebody meant to make.** One row per publish, not one per autosave.
  Every save today also fans out to search, links, storage targets (a git commit each), webhooks,
  notifications and the audit log, so autosaving onto the page would flood all of those as well.
- **Suggestions stay what they are.** An edit suggested by somebody who may only read the page is
  kept per author in `pageEditSubmissions` and reviewed, exactly as now
  ([§8.3](#83-suggestions)). A suggestion may well be unwanted and declined; a draft is work the
  page's own editors have chosen to do.

---

## 1. Goals and non-goals

**Goals**

- **No edit is lost** to a closed tab, a crashed browser, a dropped connection or a server restart.
  The browser keeps a local copy until the server has one ([§11](#11-the-browser-buffer)), and the
  server keeps the draft until it is published or discarded.
- **A collaborative session outlives its participants.** When the last person leaves a room, what
  they wrote is in the draft, and the next person to open the editor carries on from it
  ([§5](#5-drafts-and-collaborative-rooms)).
- **Autosave without flooding history.** Saving the draft records nothing in history; publishing
  records one version.
- **A draft workflow, per site** (`features.drafts`). One shared draft per page, worked on by any
  number of people over any number of days and published when it is ready, while readers go on
  seeing the last published version.
- **Live documents, per page.** A page marked live publishes itself as it is edited, within seconds,
  the way a HedgeDoc note is a live document. History is recorded in checkpoints rather than per
  keystroke ([§7](#7-live-documents)).
- **Direct edits to the live page are refused while a draft exists** on a site using drafts, or on a
  live document ([§8](#8-writes-to-the-page-while-a-draft-exists)), so that the draft cannot silently
  be built on top of a page that has since moved.
- **Each history version records everyone who wrote it**, not only whoever pressed Publish
  (`pageHistory.contributorIds`).

**Non-goals for the first version**

- **Readers watching a live document update in real time.** A reader sees the published version as
  of their page load. The shape of the follow-up is in [§7.5](#75-later-readers-watching-live).
- **More than one draft per page.** A draft is shared and there is exactly one. Branches are a
  different feature.
- **Drafting moves, deletions or translations.** Path, locale, alias, locale relations and
  deletion stay immediate actions ([§3.2](#32-what-a-draft-holds)).
- **Scheduled publishing of a draft** ("publish this on Monday"). The existing `scheduled` publish
  state is about when a page is visible, which is a different thing.
- **Rendering a draft on the server.** Even where Puppeteer could do it for markdown, the Visual and
  Excalidraw editors rule it out, and a feature that works for some editors only is worse than one
  that waits for a browser.
- **Thinning old history** (keep hourly versions for a week, daily after that). It is a separate
  retention policy, and becomes far less pressing once autosave stops writing versions.
- **Notifications about drafts.** Watchers are told when something is published, as now.

---

## 2. Vocabulary

Two existing words collide here, and the interface has to keep them apart.

- **`publishState`** answers *whether a page is visible to readers at all*: `draft`, `published` or
  `scheduled`, on the page row, unchanged by this document.
- **A draft** (this document) is *unpublished changes to a page*, which may itself be published or
  not.

So a page may be published and also have a draft (the case this feature exists for), or be
unpublished with no draft. The stored `publishState` value stays `draft`; renaming it would need a
migration for nothing a reader sees. **The interface labels that state "Unpublished"** (done: the
properties dialog, the badge over such a page and the search filter), so that "Draft" means only the
new thing. The locale keys keep their names (`editor.props.draft`, `search.publishStateDraft`), after
the stored value, so that the existing translations are flagged for review rather than orphaned.

Inside this document, **draft** always means a `pageDrafts` row, whatever the site's mode. In
[direct mode](#41-direct-drafts-off) the interface calls it "unsaved changes" instead, because there
it is a recovery buffer rather than something anybody chose to keep.

---

## 3. Storage

### 3.1 `pageDrafts`

One row per page at most.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `pageId` | uuid | FK → `pages.id`, **unique**, `on delete cascade` |
| `siteId` | uuid | FK → `sites.id` |
| `generation` | uuid | Identity of this draft's collaborative document ([§5.3](#53-generations)). New for every new row |
| `baseVersionId` | uuid | The `pageHistory` version the draft started from. Not a FK: history can be purged |
| `baseHash` | varchar(64) | SHA-256 of the page content the draft started from, as `pageEditSubmissions.baseHash` |
| `content` | text | The page source as the draft has it — written by a browser ([§5.2](#52-the-scribe)) |
| `meta` | jsonb | The other drafted fields ([§3.2](#32-what-a-draft-holds)) |
| `render` | text | Nullable. HTML for previewing the draft, post-processed as a page render is |
| `ydoc` | bytea | Nullable. The collaborative document as a Yjs update. **When present, it is the draft**, and `content`/`meta` are what a browser last read out of it |
| `contributorIds` | uuid[] | Everyone who has changed the draft since it started, or since a live page's last checkpoint |
| `createdById`, `updatedById` | uuid | FK → `users.id`, `on delete set null` |
| `createdAt`, `updatedAt` | timestamp | |
| `refreshedAt`, `checkpointedAt` | timestamp | Live documents only ([§7](#7-live-documents)) |

Indexes: unique on `pageId`, plus `siteId` for the drafts list.

**Why `ydoc` and `content` both exist.** The server can store a collaborative document but, for two
of the four editors, cannot read the page out of it ([the constraints](#drafts-autosave-and-live-documents)).
So the Yjs state is what the draft *is*, and `content` is a copy a browser keeps up to date for
everything that has no Yjs decoder: the page banner, a preview, the drafts list, a staleness check,
and a session outside a room. `content` may trail `ydoc` by a few seconds. Nothing publishes from it
without a browser having rebuilt it first.

`bytea` needs a drizzle `customType`; nothing in the schema uses one yet.

### 3.2 What a draft holds

**The draft holds what the editor edits; anything that moves or addresses the page stays
immediate.**

| Drafted (in `content` / `meta`) | Immediate (written to the page, as today) |
| --- | --- |
| content | path and locale (a move) |
| title, description, icon | alias |
| tags | locale relations |
| relations | publish state and dates — set at publish time ([§6.1](#61-what-publishing-does)) |
| scripts: `scriptJsLoad`, `scriptJsUnload`, `scriptCss` | password |
| display settings: `allowBacklinks`, `allowComments`, `allowContributions`, `allowGlossaryLinks`, `allowRatings`, `showLastEditedBy`, `showSidebar`, `showTags`, `showToc`, `tocDepth` | `isBrowsable`, `isSearchable` |
| | navigation (its own API) |
| | `liveDocument` ([§7](#7-live-documents)) |
| | the editor itself — conversion is refused while a draft exists |

A drafted field reaches the page when the draft is published, and only then.

### 3.3 `pageHistory.contributorIds`

`uuid[] NOT NULL DEFAULT '{}'`. Everyone whose changes are in this version, **including** the
author. `authorId` keeps its meaning: who made the version — the person who pressed Publish, or, for
a live checkpoint nobody asked for, the most recent contributor.

The migration backfills `ARRAY["authorId"]` on every row whose `authorId` is not null, so there is
one shape afterwards and nothing reads `authorId` as a stand-in for the list. An array has no FK, so
the id of a deleted account stays in the list. The history view shows it as a deleted user, as it
already does for a null `authorId`.

### 3.4 Settings

- **`features.drafts`** — site config, boolean, **default `false`**: a site behaves as it does today
  until an administrator turns this on. Set under **Admin → General → Features**. It goes into both
  default literals in `models/sites.ts`, and **a migration writes `false` into every existing site's
  `config.features`**. Site defaults are merged only when a site is created, so an existing site
  would otherwise not have the key at all.
- **`liveDocument`** — page config, boolean, one of `CONFIG_FIELDS`. Absent means `false`, following
  the convention every page config field already uses: the key is written only once somebody edits
  the page's properties. Offered only while the site has `features.collaborativeEditing` on — a live
  document is a shared one by nature, and outside a room two editors would spend their time
  answering each other's 409s.
- **Timings** are constants in code for the first version. Each one is named where it is used:
  [§5.1](#51-seeding-and-persisting-a-room), [§7.1](#71-refresh), [§7.2](#72-checkpoints),
  [§11](#11-the-browser-buffer).

### 3.5 Migrations

1. `pageDrafts` — `npm run db-generate -- --name=page-drafts`.
2. `pageHistory.contributorIds`, with the backfill in the same migration —
   `--name=history-contributors`.
3. `features.drafts: false` into each site's config — a hand-written SQL statement appended to one
   of the two.

The new scheduled tasks need no migration: `SYSTEM_SCHEDULE` is reconciled on every boot.

---

## 4. Editing modes

There is one mechanism and three ways of using it. The site's `features.drafts` setting picks
between the first two, and a page's `liveDocument` setting overrides both.

|  | Direct (`drafts` off) | Draft (`drafts` on) | Live (`liveDocument`) |
| --- | --- | --- | --- |
| The draft is | a recovery buffer | the work in progress | the room's saved state |
| Autosaved to the server | yes | yes | yes |
| Primary action | **Save** (publishes) | **Publish**, plus **Save draft** | none needed; **Save version** is optional |
| Readers see | the page as last saved | the page as last published | the page within seconds of an edit |
| History | one version per Save | one version per Publish | one version per checkpoint |
| Direct edits while a draft exists | allowed, and the draft goes stale | **refused** | **refused** |
| Closing the editor with unpublished changes | asks Save or Discard, as today | nothing to ask: it is saved | nothing to ask |

### 4.1 Direct (drafts off)

What an author does is unchanged: Save publishes, Discard throws the edit away. What changes is what
happens when the session ends badly:

- If the tab closes or crashes, the draft survives. The next person to open the editor on that page
  is told: "*Unsaved changes by Ana, from 14:02 — Continue / Discard*".
- If the last participant leaves a room with changes nobody saved, the draft survives the same way.

**Why direct edits are not refused here.** A draft in this mode is the state of a session that
ended without anybody deciding to keep it. Blocking an API client for days because a laptop crashed
would be the wrong trade. Instead, the draft goes stale ([§6.2](#62-staleness-and-merging)), and
whoever continues it merges.

**Abandoned buffers are purged.** A daily task (`purgePageDrafts`) deletes drafts that have not been
touched in **30 days** on sites with `features.drafts` off. On a site using drafts, a draft is never
deleted by anything but a person.

### 4.2 Draft (drafts on)

- **Edit opens the draft** if one exists, and otherwise starts one on the first change, based on the
  current version.
- **The editor saves as you go** ([§5](#5-drafts-and-collaborative-rooms), [§10](#10-api)). **Save
  draft** is the same save, done now and acknowledged, for the author who wants to see it happen.
- **Publish** opens the publish dialog — reason for change, publish state and dates — and publishes
  ([§6](#6-publishing)).
- **Discard draft** deletes it for everybody. It always asks first and names the other contributors,
  because the work being thrown away is often not only the author's.
- **Readers who may edit** see a banner on the page: "*Unpublished changes by Ana and Ben — last
  edited 2 hours ago. Open draft · Preview*". Everyone else sees nothing.

**Turning `features.drafts` off** while drafts exist turns them into direct-mode buffers. Nothing is
deleted, and the 30-day clock starts from each draft's `updatedAt`. The admin screen says how many
pages are affected before the switch is saved. **Turning it on** makes any existing buffer a draft.

### 4.3 Live

See [§7](#7-live-documents).

---

## 5. Drafts and collaborative rooms

Today `core/collab.ts` says a room is not storage: an empty room is destroyed with whatever it held.
That stops being true, and that paragraph is rewritten.

### 5.1 Seeding and persisting a room

- **Seeding.** A room starts from `pageDrafts.ydoc` when there is one, and every instance reads the
  same bytes. Only when there is no draft does it fall back to today's deterministic `buildSeed` from
  the page, or to the Visual and Excalidraw editors seeding themselves client-side. A stored Visual
  or Excalidraw document is not empty, so `seedIfEmpty` leaves it alone.
- **Persisting.** Each instance writes its room's state into the draft **2 s** after the last
  update, at most every **10 s** while updates keep coming, and immediately when its last local
  connection closes. The write is a merge, done in a transaction under `SELECT … FOR UPDATE`:
  `Y.mergeUpdates([stored, ours])`. Yjs updates merge in any order and merge with themselves as a
  no-op, so instances in an HA set can write without coordinating.
- **No instance has to know that "everybody has left".** An instance only knows about its own
  connections, and nothing here needs the answer for the whole cluster. Each instance saves what it
  holds, and the merge does the rest. This is the reason to persist continuously rather than "when
  the room empties".
- **Grace period.** An empty room is kept for **30 s** before it is destroyed, so that a reload
  rejoins the same room instead of re-reading the stored document. This is an optimisation only: the
  state is already persisted.
- **Contributors.** The server attributes each incoming Yjs update to the session of the socket it
  arrived on. The first update from a user not yet in `contributorIds` adds them, and records
  `editDraft` in the audit log ([§12](#12-audit-log)).

### 5.2 The scribe

`content`, `meta` and `render` have to be written by a browser, and a room has several. **The scribe
is the participant with the lowest awareness client id**, among clients that advertise the ability
in their awareness state (every editor does). Awareness is relayed between instances, so every
participant reaches the same answer. While a client joins or leaves they may briefly disagree, and
then two scribes write the same state, which is harmless because the last write wins.

The scribe writes the draft's materialized fields ([§10](#10-api)) **5 s** after the document goes
quiet, at most every **30 s**, and when it leaves. Outside a room, the one editor is its own scribe.

Fields the room does not share — tags, scripts, the properties dialog — are written by whoever
changes them, through the same route. They are last-write-wins, exactly as in a room today.

### 5.3 Generations

A Yjs client identifies its changes by client id and clock, and the room's seed is pinned to client
0 (and the Visual seed to client 1) so that two identical seeds merge into one. That trick has a
known sharp edge: a document built from a *different* seed under the same client id claims clocks
the room has already seen, and Yjs discards it without saying so (see `SEED_CLIENT_ID` in
`editor/visual/collab.js`). Once rooms survive their participants, a browser that held a document
from before a publish or a discard and then reconnects becomes an ordinary event rather than a rare
one.

So every draft has a `generation`, and **a room belongs to a generation, not only to a page**:

- The server sends the generation as the first message on a new connection, before sync step 1.
  This is a third message type beside the two y-websocket uses.
- A client holding a document of another generation discards it, along with any unsynced edits
  (its browser buffer has those, [§11](#11-the-browser-buffer)), and syncs from empty. It never
  answers sync step 1 with the old document.
- Deleting a draft (on publish, discard or compaction) ends its generation. The next room starts a
  new one, from the page.

### 5.4 Discarding

Discard deletes the draft and closes the room on every instance: the relay gains a `discarded`
message alongside `saved`. Connected participants are told who discarded it. Their editors reload
from the page as a new generation.

---

## 6. Publishing

### 6.1 What publishing does

`POST …/draft/publish` ([§10](#10-api)) is sent by a browser with the content and render it has just
built from its own copy of the draft, plus the publish dialog's answers. The server:

1. Checks that the page has not moved on since the draft started ([§6.2](#62-staleness-and-merging)).
2. Applies the drafted fields and the dialog's publish state and dates through `updatePage`, with the
   render permissions of [§6.3](#63-render-permissions). The rest is what any save already does: one
   history row (now with `contributorIds`), search, links, storage targets, webhooks, notifications
   and the app shell cache.
3. Deletes the draft, ending its generation. If a room is still open, the participants are told
   through the existing `saved` message, and the room's next persist starts a new draft based on the
   version just published.

The audit entry is `publishDraft`, carrying the version id and the contributors.

**Notifications leave out every contributor**, not only the actor. Somebody who wrote half a version
does not need to be told it was published.

**A brand new page** is created as it is today: Save As, the chosen path, the chosen publish state.
There is no page id to hang a draft on before that, so the [browser buffer](#11-the-browser-buffer)
covers the first session. Every later edit goes through a draft.

### 6.2 Staleness and merging

A draft is **stale** when the page's current content hash differs from `baseHash`. The page can move
on underneath a draft even with direct edits refused: an import, a git pull, a version restored
before the draft started ([§8](#8-writes-to-the-page-while-a-draft-exists)).

- `GET …/draft` reports `isStale`, and the editor shows it.
- Publishing a stale draft is refused with **409 `pageDraftStale`**, unless the request carries the
  `currentHash` the author merged against.
- **Merging is three-way**: base (`baseVersionId` from history), current page, and draft. The
  merged result is shown in a diff view, reusing the approvals review diff, where the author settles
  conflicts. If the base version has been purged, it falls back to a two-way diff.
- **Excalidraw** cannot be text-merged. Its own `reconcileElements`, which merges scenes element by
  element by id and version, is the candidate. Failing that, the author picks a side.

### 6.3 Render permissions

`rendering.postProcess` keeps or strips scripts and styles according to whoever saves. A draft has
several authors, and today's rooms already have a hole here: whoever presses Save publishes everyone
else's text under *their own* `write:scripts` / `write:styles`.

**Publishing renders with what every contributor may do:** `write:scripts` only if every
`contributorIds` member holds it on the page, and the same for `write:styles`, each checked with
`groups.checkAccess`. For a single author this is exactly today's rule. When the publisher holds a
permission that a contributor lacks, the publish dialog says so: "*Scripts will be removed: Ben may
not add scripts to this page*".

The draft's `scriptJsLoad` / `scriptJsUnload` / `scriptCss` fields are checked when they are
*saved*, against the person saving, as `PATCH /pages/:id` checks them now.

---

## 7. Live documents

A page with `liveDocument` on is edited the way a HedgeDoc note is: whoever has it open edits it, and
readers get the result without anybody pressing anything. The pieces are the same draft and room as
above. The difference is that **the scribe also publishes**, in two strengths.

### 7.1 Refresh

The scribe sends `POST …/draft/refresh` **5 s** after the document goes quiet, and at most every
**30 s** while it does not. A refresh writes the drafted fields and render onto the page row, then
updates search, links and the app shell cache, and sets `refreshedAt`. **It does not write history,
notifications, webhooks or storage targets, and does not delete the draft.** Readers see the page as
of the last refresh. A refresh whose content hash equals the page's is a no-op, so a second scribe
costs nothing.

Render permissions are those of [§6.3](#63-render-permissions), over the contributors since the last
checkpoint. A live page skips the staleness check: direct edits to it are refused
([§8](#8-writes-to-the-page-while-a-draft-exists)), and an import that lands anyway is overwritten
by the next refresh. That is the accepted trade for a page whose working copy *is* the document.

### 7.2 Checkpoints

A **checkpoint** is a full publish of what the page row already holds: one history row,
notifications, webhooks, storage targets. It needs no browser, since nothing is rendered: the row was
rendered by the last refresh. Checkpoints happen:

- **On idle** — a task, `checkpointLivePages`, runs every minute and checkpoints every live draft
  with `refreshedAt > checkpointedAt` and no update in **10 minutes**. This is what "save once
  everybody has left" means, and, as in [§5.1](#51-seeding-and-persisting-a-room), nobody has to
  establish that everybody has left.
- **During long sessions** — the same task checkpoints a draft whose last checkpoint is more than
  **60 minutes** old, so that a day of editing is a handful of versions rather than one.
- **On request** — **Save version** in the editor, which also lets the author give a reason.
  `reasonForChange` is never demanded of a live page, whatever the site's setting: an automatic
  version has nobody to ask.
- **Before any other history-writing action** on a live page with an unrecorded refresh — a move, a
  deletion, a switch out of live mode — so that the move's version does not absorb the content edits
  under the mover's name.

A checkpoint resets `contributorIds` and sets `checkpointedAt`. If the room is empty and the page row
matches the draft (`refreshedAt` ≥ `updatedAt`), the draft is deleted. That bounds the size of a live
page's Yjs document, which otherwise grows for the page's whole life. The next session starts a new
generation from the page.

The history entry's author is the most recent contributor, and `contributorIds` lists the rest.
Checkpoints run from the scheduler, so there is no audit row for them: the people involved were
recorded by `editDraft` as they joined ([§12](#12-audit-log)).

### 7.3 History is no longer always current

`pageHistory.list` documents that the newest row is the page as it stands. On a live page, between
a refresh and the checkpoint after it, the page row is ahead of its newest version. The history view
shows that interval as a synthetic first entry, "*Current — not yet recorded*", built from the page
row. Diff and restore already read the page itself for the current side, so this is a change to the
list and to that comment, not to the model.

### 7.4 What a crash leaves behind

If the last scribe vanishes between an edit and its refresh, the draft's `ydoc` holds edits the page
row does not, and the server cannot render them. They stay in the draft, and **the next browser to
open the editor refreshes as soon as it has synced**, so the page catches up then. Until then readers
see the last refresh, which is at most about 30 s of work behind. The checkpoint task does not
checkpoint such a draft (`refreshedAt` < `updatedAt`), but it does record what the row holds after
the 60-minute ceiling, so the history is never further behind than that.

Switching a page **into** live mode is refused while it has a draft: publish or discard first, so
that switching modes never publishes anything by itself. Switching **out** of it first checkpoints;
the draft, if any, then becomes an ordinary draft or buffer.

### 7.5 Later: readers watching live

Not in the first version. The shape it would take: a reader of a live page subscribes to a
lightweight `pageRefreshed` event and re-fetches the render. That costs no rendering in the reader's
browser, and the latency is the refresh interval. A keystroke-level view, as HedgeDoc has, would mean
readers joining the room read-only and rendering it themselves. That sends the raw source, which is
`read:source` rather than `read:pages`, and puts the markdown pipeline in every reader's bundle.

---

## 8. Writes to the page while a draft exists

### 8.1 Refused

On a site with `features.drafts` on, and on any live document, while a draft exists:

- `PATCH /sites/:siteId/pages/:pageId` setting any **drafted** field ([§3.2](#32-what-a-draft-holds))
  answers **409 `pageHasDraft`**, naming the contributors and `updatedAt`. Immediate fields go
  through.
- Changing the editor (`PUT …/editor`) is refused with the same error: the draft is in the old
  editor's format.
- Restoring a version onto the page is refused. "Restore into the draft" is the natural follow-up and
  is left for later.

In the interface, Edit always opens the draft, so none of these come up there.

### 8.2 Not refused

- **Imports and storage sync** (`adoptStoredPage`, the git target's pull) write the page as they do
  today. Their source is outside the wiki and is authoritative by design, so the draft goes stale
  ([§6.2](#62-staleness-and-merging)), or, on a live page, the next refresh overwrites the import.
- **Moves and deletion.** A draft follows its page id through a move. Deleting the page cascades to
  the draft, and the delete dialog warns when there is one, naming the contributors. Restoring the
  page from the recycle bin does not bring the draft back.
- **Re-rendering** (`queueRerender`, `storeRender`) changes the render, not the content.

### 8.3 Suggestions

Unchanged: per author, against the published page, reviewed in the approvals queue. People
suggesting edits never see a draft.

What changes is **accepting one while the page has a draft**, since accepting is a direct edit. The
proposal is to **accept into the draft**: the review screen applies the suggestion's patch to the
draft — joining the room as an ordinary participant if one is open — and the change reaches readers
with the next publish. The reviewer becomes a contributor. This keeps suggestions flowing during a
long draft, rather than queueing for its whole life. See [§14](#14-open-questions).

---

## 9. Permissions

No new permission names. Every route here is a page-rule check in the handler, with a
`No route-level permissions:` comment.

- **Seeing and editing a draft** takes `write:pages` or `manage:pages` on the page, from a signed-in
  session. This is the rule for seeing an unpublished page (`UNPUBLISHED_PERMISSIONS`), and for the
  same reason: work in progress belongs to people. **An API key never sees a draft**, and therefore
  cannot write a drafted field on a page that has one.
- **Publishing and discarding** take the same, through one function, `drafts.mayPublish(actor,
  page)`, so that the open question in [§14](#14-open-questions) changes one place.
- **Switching a page into or out of live mode** takes the same as publishing, since a live page
  publishes on its own.
- **Joining the room** is unchanged: today's editor permission check.

---

## 10. API

All under `/_api/sites/:siteId/pages/:pageId/draft`, with schemas in `api/schemas/` as usual.

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/draft` | The draft: `content`, `meta`, `render`, `generation`, `isStale`, `baseVersionId`, contributors (`id`, `name`), `createdAt`, `updatedAt`. 404 when there is none |
| `PUT` | `/draft` | Save. Creates the draft on the current version when there is none. Body: any of `content`, `meta`, `render`, plus `expectedUpdatedAt` |
| `DELETE` | `/draft` | Discard ([§5.4](#54-discarding)) |
| `POST` | `/draft/publish` | Publish ([§6](#6-publishing)). Body: `content`, `meta`, `render`, `reasonForChange`, `publishState`/dates, `currentHash` when merged. Answers a `PageChange` |
| `POST` | `/draft/refresh` | Live documents only ([§7.1](#71-refresh)). 400 otherwise |
| `POST` | `/draft/checkpoint` | Live documents only. **Save version** ([§7.2](#72-checkpoints)), with an optional reason |

Plus **`GET /_api/sites/:siteId/drafts`** — the drafts on the site that the caller may see, with
`?mine=true` for the ones they contributed to. People working on something over days need a way back
to it that does not depend on remembering the page.

**Concurrency outside a room** follows the glossary's rule: `PUT` carries the `updatedAt` it was
opened with, compared at millisecond precision inside the UPDATE, and a mismatch answers 409 with the
draft as it now stands. **Inside a room**, the room is the concurrency control. The scribe's `PUT`
omits `expectedUpdatedAt`, and the server's persists write only `ydoc`, `contributorIds` and
`updatedAt`, so the two never write the same column.

**The page payload** gains `draft: { updatedAt, contributors } | null`, filled only for a requester
who may see it ([§9](#9-permissions)). That is what the banner and the Edit button read.

---

## 11. The browser buffer

**Implemented** (phase 1): `frontend/src/helpers/editorBuffer.js` is the storage,
`frontend/src/composables/editorBuffer.js` decides when to write and what to offer back.

The server draft covers almost everything. The browser keeps a copy of what the server has not yet
acknowledged: a session offline, a request that failed, the first session of a page that does not
exist yet, and the seconds between keystroke and save. Until the server keeps drafts (phase 2) it is
the only copy of an unsaved edit there is.

- **Only the editors that hold a document**: Markdown, AsciiDoc, Visual and Excalidraw. A
  redirection and a blog's settings are a few fields each, quicker typed again than restored.
- **Only for a signed-in account.** Every guest is the same nobody.
- **IndexedDB**, one entry per user, site, mode and page, keyed `userId:siteId:mode:pageId` — an edit
  and a suggestion of the same page are different work. A page being created has no id and no settled
  path, and its route carries none to come back to, so it is keyed `userId:siteId:create:editor`:
  opening a new page in the same editor is what offers it back, path and all. An entry holds the
  source, the page fields a save sends (less the render, which the editor makes again, and the
  password, which is not written to disk), `savedAt`, and the page's `updatedAt` as the base. Phase 2
  adds the `baseHash` and `generation`.
- **Pending assets are kept as `File`s**, in a second object store so that the entry can be rewritten
  every second without copying them. Their `blob:` URLs do not survive a reload, so a restore makes
  new ones and rewrites the source to match. If the files will not fit, the entry is kept without
  them: the text is the part worth keeping.
- **Plain snapshots, never Yjs state.** A persisted Yjs document from another generation is exactly
  the hazard of [§5.3](#53-generations). `y-indexeddb` is therefore not used.
- Written **1 s** after a change, and at once when the editor closes or the document is hidden.
  Deleted when nothing is unsaved any more: a save, somebody else saving the room, a submitted
  suggestion, Discard.
- **On opening the editor**, an entry that differs from what was loaded is offered back: "*You made
  changes to this page on … that were never saved — Discard / Restore*". It is asked once the editor
  is ready (`editorStore.isReady`), which in a room means after the binding — the room's document
  would otherwise overwrite the restore, and is what the entry is compared with. One matching it says
  nothing and is dropped. The prompt warns when the page has been saved since, and when other people
  are in the room, since a restore replaces the whole document. Restoring goes through the editor
  (`restoreEditorContent`), so it is an edit like any other and reaches a room through the binding.
  Phase 2 turns the stale case into a merge.
- **Cleared for that user on logout.** Every read and write is wrapped in try/catch, because private
  windows and blocked site data both make IndexedDB throw. Losing the buffer means losing the safety
  net, not the editor.
- **`beforeunload` and the router's leave guard** warn while anything in the editor is unsaved, for
  every editor. With no server draft yet, "the buffer has it" is not a reason to let a tab close
  unasked. Once phase 2 autosaves, this narrows to a change that neither the server nor the buffer
  holds. Leaving through the guard is discarding, and clears the entry.

Assets in a draft: uploading still happens on save. **On a site using drafts that means on the
first draft save** after the asset was added, since co-authors cannot see a file that lives in one
person's browser. An asset therefore exists before the page that uses it is published. The draft's
`meta` records the asset ids it introduced, so that Discard can offer to delete them.

---

## 12. Audit log

Three new `page` actions in `AUDIT_ACTIONS`, each with its `admin.audit.actions.*` string:

| Action | Recorded when | `meta` |
| --- | --- | --- |
| `editDraft` | A person **first** becomes a contributor to a draft, or to a live page since its last checkpoint — through `PUT` or a room | page, generation |
| `publishDraft` | A draft is published | page, version id, contributor ids |
| `discardDraft` | A draft is discarded | page, contributor ids |

Not per autosave, which would bury the table, and not per refresh. Room contributions are recorded
by the collab controller, which has the upgrade request and its session in hand. That keeps them
written by a request handler for a person, as the audit log requires. Live checkpoints are the
scheduler's and leave no row.

---

## 13. Suggested order

Each phase ships on its own.

1. **The browser buffer and the unload guard** ([§11](#11-the-browser-buffer)). No schema; covers the
   crash case immediately for every site.
2. **`pageDrafts`, direct mode, and `contributorIds`.** The table, the API, autosave through `PUT`,
   the scribe in rooms writing `content` (no `ydoc` yet), resume or discard of a leftover buffer, the
   purge task.
3. **Draft mode.** `features.drafts`, Publish / Save draft / Discard, the banner, the refusals of
   [§8](#8-writes-to-the-page-while-a-draft-exists), the render-permission intersection, the audit
   actions, the "Not published" relabel.
4. **Rooms persist into the draft.** `ydoc`, seeding from it, merge-on-write, generations, the grace
   period, `discarded`.
5. **Live documents.** `liveDocument`, refresh, checkpoints and their task, the synthetic history
   entry.
6. **Later:** the stale-draft merge view, preview at `?draft`, the drafts list, accepting
   suggestions into a draft, readers watching live documents, restoring a version into a draft.

---

## 14. Open questions

1. **Does publishing need a permission of its own?** Undecided. The first version uses
   `write:pages`, through `drafts.mayPublish` alone. A separate page permission would let a group
   draft without publishing — but approval rules already cover "somebody else signs it off", and
   adding a permission is the maintainer's decision.
2. **Accepting a suggestion while a draft exists.** Proposed: accept into the draft
   ([§8.3](#83-suggestions)). Alternatives: refuse until the draft is published, or accept onto the
   page and let the draft go stale.
3. **Should drafts be reachable by API keys?** Proposed: no, consistent with unpublished pages. The
   cost is that automation cannot touch the content of a page somebody is drafting.
4. **The default of `features.drafts` for new sites.** Proposed: off, like existing sites.
5. **Should the timings be site settings** — autosave, refresh, idle checkpoint, the 60-minute
   ceiling, the 30-day purge? Proposed: constants until somebody asks.
6. **Should a site be able to forbid live documents?** Proposed: not needed — `features.collaborativeEditing`
   off already does, and per page it is an editor's choice.

---

## 15. Alternatives considered

- **A revisions table, with the page pointing at its published version.** Cleaner on paper. But
  every reader of `pages.content` and `pages.render` would have to follow the pointer, and the
  denormalized row is exactly what lets them not care.
- **Per-user drafts**, like `pageEditSubmissions`. They do not give "several people, several days"
  without merging drafts into each other, and the decision was a shared draft per page.
- **Folding suggestions into drafts.** Rejected: a suggestion from somebody who may only read is a
  proposal that may be declined, and a draft is the editors' own work. The two have different
  audiences, lifetimes and permissions.
- **A draft as a hidden copy of the page at another path.** It collides with the tree, links,
  search, ids and storage targets, which would all have to learn to ignore it.
- **Autosaving onto the page and merging recent history rows**, overwriting the newest version while
  the same author keeps editing. It spares history, but not search, git, webhooks or notifications. It
  also changes a version that an audit entry already points at by id.
- **Auto-publishing on the server when a room empties.** It needs Puppeteer, works for markdown only,
  and needs a cluster-wide answer to "is the room empty". The scribe plus checkpoints
  ([§7](#7-live-documents)) get the same result for every editor.
- **Electing the last participant to publish as they leave.** The last participant is exactly the one
  whose tab just crashed.
- **`y-indexeddb` for the browser buffer.** It merges stale Yjs state back into a room that may have
  been re-seeded since ([§5.3](#53-generations)). Plain snapshots plus a merge prompt do not have
  that failure.
