# Feedback Boards

**Status:** implemented — every step of [§11](#11-build-order), on 2026-10-23. Where building it
changed the design, this document was changed with it.
**Covers:** what a feedback board and a feedback idea are, where an idea's status and categories
live, how upvoting reuses page ratings, what the board's listing does, how an idea's page is drawn,
how an idea is submitted, who may do what, and the order to build it in.

A feedback board is the place readers propose things and vote on them: a list of ideas, each with a
status the maintainers move along (Open → Under Review → Planned → In Progress → Completed, or
Closed), categories, an upvote count and a discussion. It is built as a sibling of the blog: a board
is a page written with its own editor, and its ideas are the pages under it.

The constraints this is written against:

- **An idea is a page.** It has a path, history, page rules, a place in the tree, search, storage
  targets, watching and notifications, the same as any other page. Nothing about the feature needs a
  second content store.
- **Membership is where the page sits**, exactly as for a blog (`models/blogs.ts`). Nothing is
  written on an idea to say it belongs to a board. Moving it out of the board's folder is how it
  stops being an idea.
- **What maintainers say about an idea is not the idea's content.** Changing an idea's status must
  not create a page version, re-render it, re-index it, mirror it to a storage target or need
  `write:pages` on it. Ratings and comments already work this way, and status does too.
- **Access is the board's, all or nothing.** Whoever may read the board may read every idea in it,
  and the same goes for every other page permission. Rules written for a path under the board, and
  tag rules matching an idea's own tags, are not consulted ([§4.1](#41-access-is-the-boards)).

---

## 1. Goals and non-goals

**Goals**

- A **Feedback Board** page type: a new `feedback` editor, bodyless like `blog`, whose content column
  holds the board's settings ([§3.1](#31-the-board-feedback-editor)).
- **Every page directly in the board's folder is an idea**, found the way a blog finds its posts
  ([§3.2](#32-membership)).
- **A status per idea**: Open, Under Review, Planned, In Progress, Completed or Closed
  ([§3.3](#33-status)). It is set by somebody holding `review:pages` or `manage:pages`, never by
  editing the page, and may carry a comment that is posted to the discussion with it.
- **Categories per idea**, any number of them, stored as tags picked from the board's own list
  ([§3.4](#34-categories)).
- **Upvotes** through the existing page ratings, thumbs up only ([§3.5](#35-upvotes)).
- **The board's listing**: search, filtering by status and category, and sorting by Top, Newest,
  Recent Activity or Trending, with a vote button on each row ([§5](#5-the-board-page)).
- **The idea's page**: status, categories and the vote button above the body, and **comments listed
  directly under the body** rather than on a Talk tab ([§6](#6-the-idea-page)).
- **A two-step submission**: a title first, with possible duplicates shown as it is typed, then the
  full form ([§7](#7-submitting-an-idea)).
- **A notification category** for status changes, sent to the idea's author and voters
  ([§8](#8-notifications)).
- **A new page permission, `write:feedback`**, for submitting ideas and editing one's own
  ([§4](#4-permissions)).
- **One access decision per board**, applied to everything under it
  ([§4.1](#41-access-is-the-boards)).

**Non-goals for the first version**

- **A roadmap view** (a kanban of Planned / In Progress / Completed). The listing filtered by status
  covers it for now. It is the obvious next step and nothing here should prevent it.
- **Merging duplicate ideas** (moving votes and comments from one idea onto another).
- **Custom statuses.** The six are fixed and translated.
- **Voting on behalf of somebody else** (recording a customer's vote as an admin), and vote
  weighting.
- **Guests submitting or voting.** Both need an account to hang them on.
- **Annotations on ideas.** They are turned off ([§6](#6-the-idea-page)).
- **MCP tools** for boards. Ideas are pages, so the existing page tools already read them. A
  `set_feedback_status` tool can come later.
- **Import and export of status.** Status, like ratings and comments, is not part of what a storage
  target holds ([§3.3](#33-status)).

---

## 2. Vocabulary

| Term | Meaning |
| ---- | ------- |
| **Board** | A page whose editor is `feedback`. Its URL is the board's URL. |
| **Idea** | A page directly inside a board's folder that has a body of its own ([§3.2](#32-membership)). |
| **Status** | One of the six states in [§3.3](#33-status). An idea with no status row is `open`. |
| **Category** | One of the board's configured tags. An idea carries any number of them as ordinary page tags. |
| **Upvote** | A thumbs-up rating (`pageRatings`, `kind = 'thumbs'`, `value = 1`) on an idea. |
| **Status comment** | A comment posted by a status change, carrying that change in its `meta`. |
| **Listing page** | A blog or a board: a bodyless page whose descendants are listed by it. |

---

## 3. Data model

### 3.1 The board (`feedback` editor)

A new editor, `feedback`, joins `redirect` and `blog` in `BODYLESS_EDITORS` (`models/pages.ts`). It
is a destination in the way a blog is: it stays in the sitemap and stays indexable and searchable.
`EDITOR_CONTENT_TYPES.feedback = 'feedback'` and `PAGE_FILE_EXTENSIONS.feedback = 'json'`, so a
storage target writes it as a JSON document carrying `editor: 'feedback'` at the top level, the same
way it writes a blog. `EDITOR_FOR_PAGE_EXTENSION` does not change: a hand-written `.json` file is
still read as a redirection.

`normalizeFeedbackContent` / `parseFeedbackContent` follow the blog's pair exactly. Every field has a
default, numbers outside what a listing can serve are refused, and the document is re-serialized
into one canonical spelling. The frontend's reading of the same document is
`helpers/pageFeedback.js`, the counterpart of `helpers/pageBlog.js`.

```ts
interface FeedbackBoardContent {
  /**
   * Basic markdown above the listing, rendered in the reader's browser from the source the board
   * stores (`renderBoardIntro` in `renderers/feedback.js`, the comment renderer's feature set with
   * links that keep their `follow`). Same 2000-character ceiling as a blog's intro.
   */
  intro: string
  /**
   * The categories an idea may be filed under, in the order the board offers them. Each is a tag
   * (normalized the way page tags are) plus the label it is shown under.
   */
  categories: { tag: string; label: string }[]
  /**
   * Whether the submission form offers the categories. Off, ideas arrive uncategorized and are
   * filed by whoever may edit them. Has no effect while `categories` is empty.
   */
  submitterCategories: boolean
  /** The order the listing opens in. */
  sort: 'top' | 'newest' | 'recent' | 'trending'
  perPage: number            // default 20, ceiling 100
  /** Whether new ideas may be submitted from the board ([§7](#7-submitting-an-idea)). */
  acceptsIdeas: boolean
  /** Whether ideas on this board may be voted on. Off freezes the counts and hides the buttons. */
  voting: boolean
  /**
   * A notice at the top of the submission dialog's first step, above the title
   * ([§7](#7-submitting-an-idea)): where the board sends what it does not take -- bugs, say, or ideas
   * that belong somewhere else. The intro's markdown, renderer and ceiling. Empty shows nothing.
   */
  submitNotice: string
}
```

- **Which statuses the listing opens on is not a setting.** It follows from the sort
  ([§5.1](#51-api)): Closed is always hidden by default, and Completed is hidden by default under Top
  and Trending. The board's creator chooses the default sort, and the default statuses come with it.
- **There is no `depth`, unlike a blog.** A blog is often filed by year, while a board's ideas are
  flat: the submission form puts them directly in the board's folder ([§7](#7-submitting-an-idea)),
  and nothing else may go there at all ([§3.2](#32-membership)).

### 3.2 Membership

**An idea is a page directly inside the board's folder that has a body of its own.** That excludes
a redirection, and the front page of a blog or board nested in the board. With no depth to
configure, membership is one equality on `tree.folderPath`.

**A board's folder holds its ideas and nothing else.** No sub-folder, no attachment, no
redirection, no blog or board of its own, and no page further down (`/feedback/some-folder/page`):
anything of the kind would sit under the board's access ([§4.1](#41-access-is-the-boards)) without
ever being listed by it. The models refuse it wherever something is put somewhere, with
`feedbackIdeasOnly`, against the in-memory board list so that it costs no query:

- **`feedback.refuseNonIdea`**, asked with the folder a thing goes INTO, by `createPage`,
  `movePage` and `restorePage`; by `tree.createFolder` (which every folder made along the way to a
  path goes through), `moveFolder` and `duplicateFolder`; and by `assets.upload`, `moveAsset` and
  `adoptStoredFile` — the last skipping the file, as an import skips everything it cannot take. The
  upload route asks it before the body is read as well. Only a page in the folder itself, written
  with an editor that has a body, gets through.
- **`feedback.refuseAsBoardFolder`**, for a folder renamed, moved or copied to the board's own path,
  which would bring its contents in at once. Creating that folder empty is allowed, since that is
  how `blogs.ensureFolder` gives a board one.
- **`feedback.guardBoardFolder`**, for a board created, moved or restored over a folder that
  already holds a sub-folder, a file or a bodyless page — the one check that has to query.

Anything placed under a board before this rule existed is left where it is: it is still under the
board's access and still not listed, and moving or deleting it is allowed.

- **A blog has to learn about boards too.** The "nested roots" filter in `blogs.postsFor` stops at a
  nested blog today. It has to stop at a nested board as well, or a board placed inside a blog would
  have its ideas listed as blog posts.
- **Whether a page is an idea costs no query.** Its parent path is looked up in the in-memory board
  list ([§4.1](#41-access-is-the-boards)) by `feedback.boardOfIdea`. Only a page that is not an idea
  goes on to `blogs.listingFor` — what `blogs.blogFor` became — which asks for
  `editor IN ('blog', 'feedback')` among the page's ancestors and returns the nearest with its kind,
  so that a page in a board's sub-folder is not mistaken for a post of a blog further up. The page
  payload carries either `blog` or `feedback` ([§6](#6-the-idea-page)), and never both.

`blogs.ensureFolder` is reused as is when a board is created or restored, as it is for a blog: a
board with no folder has nowhere to file the first idea in.

### 3.3 Status

**A table of its own, keyed by page.**

```ts
export const feedbackStatuses = pgTable('feedbackStatuses', {
  pageId: uuid().primaryKey().references(() => pages.id, { onDelete: 'cascade' }),
  status: varchar({ length: 32 }).notNull(),        // FEEDBACK_STATUSES, validated by the model
  /** The status comment posted with the latest change, if one was. */
  commentId: uuid().references(() => comments.id, { onDelete: 'set null' }),
  updatedAt: timestamp().notNull().defaultNow(),
  updatedById: uuid().references(() => users.id, { onDelete: 'set null' })
}, (table) => [index('feedbackStatuses_status_idx').on(table.status)])
```

`FEEDBACK_STATUSES = ['open', 'underReview', 'planned', 'inProgress', 'completed', 'closed'] as
const` in `models/feedback.ts`, mirrored in `helpers/pageFeedback.js` with a colour and an icon
per status.

Why this shape and not one of the alternatives:

- **Not in `pages.config` or a column on `pages`.** Both are written through `updatePage`, which
  records a version, re-renders, re-indexes, mirrors to every storage target and needs `write:pages`.
  None of that belongs to "a reviewer marked this Planned", and the reviewer is usually not the
  idea's author.
- **Not a tag** (`status:planned`). A tag is editable by whoever can edit the page, so the idea's
  author could mark their own idea Completed. It would also be stored in the page's history and
  front matter.
- **No row means `open`**, so creating an idea writes nothing here and a page moved into a board
  becomes an Open idea without anything having to notice the move. A row left behind when an idea
  is moved out of a board does no harm: nothing reads it until the page is under a board again, and
  then it is that page's status. That is the right answer for an idea moved from one board to
  another.
- **Not on storage targets.** Status is the board's opinion of the idea, in the same category as
  its ratings and comments, which are not exported either. An `importAllOverwrite` restore therefore
  brings ideas back as Open. That is acceptable for a first version, and is noted under non-goals.

**Every change is recorded in the audit log**, comment or not: `setFeedbackStatus` with
`{ pageId, from, to, commentId }`. That is the idea's status history. Only the current status is
stored on the row.

#### The status comment

A status change may carry a comment, which is how a maintainer explains it ("Planned for 3.2",
"Closed: this is what X already does"). The comment and the change go together:

- **It is a real comment in the idea's discussion**, posted as the person who changed the status, at
  the moment of the change. `comments.meta.feedbackStatus = { from, to }` marks it. The discussion
  draws it with a "**Ana Ruiz** moved this from *Open* to *Planned*" header above the text, and
  `feedbackStatuses.commentId` points at it so that the idea header can link to the latest one.
- **No comment, nothing in the discussion.** A status change without one changes the badge and the
  audit log and nothing else.
- **It is offered only where the discussion is shown**: the site uses the built-in comments
  provider, `features.comments` is on and the idea's `allowComments` is on. Anywhere else the field
  is not in the dialog, and the route refuses a comment with 400.
- **It is written through the comments model, inside the status route**, not through
  `POST …/comments`. Posting it is part of an act that `review:pages` or `manage:pages` already
  authorizes, so it does not also need `write:comments`, and the posting cooldown and Akismet do not
  apply to a moderator answering a feedback board. Everything else a new comment does is still
  done: the audit entry (`createComment`, beside `setFeedbackStatus`) and the `comment:new` webhook.
  The one exception is the notification event, which is replaced by the status event
  ([§8](#8-notifications)).
- **Afterwards it is an ordinary comment.** It can be replied to, and edited or deleted under the
  usual comment rules. Deleting it does not revert the status, and `commentId` is set to null.
- **A status change must change the status.** Setting the status an idea already has answers 409.
  To say something without changing anything, post a comment.

### 3.4 Categories

**A category is a tag from the board's list, and an idea may carry any number of them.**

- They are stored where tags already are (`pages.tags`, `tree.tags`). So `/_tags`, site search's tag
  filter and tag-based page rules all work on categories with nothing added, and an author with
  `write:pages` can re-file an idea from the properties dialog.
- The board's `categories` list is what turns some tags into categories. The listing counts only
  those tags in its category facet, and counts an idea under each of its categories. An idea's other
  tags are still ordinary tags and are shown as such.
- An idea with none of the board's categories counts as **Uncategorized**, which the facet offers as
  a filter of its own.
- Removing a category from the board leaves the tag on its ideas. They become uncategorized in the
  listing and keep the tag.

### 3.5 Upvotes

**Reused from `pageRatings`, with nothing added to the schema.** An upvote is a row with
`kind = 'thumbs'` and `value = 1`, and the count is `pages.ratings.thumbs.up`, which is already
cached on the page row and kept current by `rate` / `unrate`.

- **An idea is always rated on thumbs, regardless of what the site's `features.ratingsMode` says.**
  `loadRateable` in `api/ratings.ts` asks for the page's listing first. For an idea, the mode is
  `thumbs`, only `value: 1` is accepted (a `-1` is a 400), and the board's `voting` switch stands in
  for the site's ratings mode. The page's own `allowRatings` still applies, so a single idea can be
  frozen.
- **A Completed or Closed idea takes no more votes**, cast or withdrawn (`SETTLED_STATUSES` and
  `takesVotes` in `models/feedback.ts`, a 403 from `loadRateable`): it keeps the count it was settled at. The vote
  button is disabled for it in the listing, on the idea and among the similar ideas in the submission
  dialog. Moving it back to any other status opens voting again.
- **Its discussion closes too, to everybody but whoever may move it.** `POST …/comments` refuses a
  comment or a reply on a Completed or Closed idea (`takesComments`) unless the requester holds
  `review:pages` or `manage:pages` at the board, the status route's own pair. What was said is kept and
  shown, and editing or deleting it follows the usual rules. The discussion says why it has no box
  (`canSetStatus` on the payload is the exception, client-side).
- Withdrawing a vote is `DELETE …/rating`, unchanged.
- **A page that already had ratings before it was moved into a board** keeps them under their own
  kind. Stars are ignored, and earlier thumbs-downs stay in `thumbs.down`, which a board never shows.
  The reader's own rating reads as "not voted" unless it is `+1`, and voting replaces it. No data is
  changed by the move.
- **Voting does not watch the idea.** A voter hears about status changes ([§8](#8-notifications)),
  and about the discussion only if they watch the page themselves.
- Guests cannot vote. That is already true of ratings: one vote per person needs a person.

---

## 4. Permissions

Every page permission on an idea is asked at its board ([§4.1](#41-access-is-the-boards)), so
"at the board" below is not a shortcut: it is the only place the question can be asked.

| Act | Permission, at the board |
| --- | ------------------------ |
| See the board and its ideas | `read:pages` |
| Vote | `read:pages` + an account |
| Comment | `write:comments` (built-in provider) |
| **Submit an idea** | **`write:feedback`** + an account |
| **Edit / delete own idea, while Open** | **`write:feedback`** + being its creator |
| Edit / delete / move any idea | `write:pages` / `delete:pages` / `manage:pages` |
| **Set status (and post its comment)** | **`review:pages` or `manage:pages`** |
| **Edit any idea and file it into categories, at any status** | **`review:pages` or `manage:pages`** |
| Configure the board | `write:pages` |

**`write:feedback` is a new page permission**, approved on 2026-10-23. Page rules have no notion of
"your own page", so `write:pages` under a board would let a submitter rewrite everybody else's ideas.
`write:feedback` grants exactly two things, both through `api/feedback.ts` and never through
`/pages`:

- **creating an idea under a board, as the requester**, through the submission form
  ([§7](#7-submitting-an-idea)), on a board whose `acceptsIdeas` is on, and
- **editing or deleting an idea whose `creatorId` is the requester, while its status is `open`.** Once
  a maintainer has moved an idea on, its wording is what they answered, and it is no longer the
  author's alone to rewrite. Anybody holding `write:pages` at the board can still edit it in the
  normal editor.

It is path-bound like every page permission, and like every page permission on a board it is
asked at the board, for a submission and an edit alike. Adding it means:

- `PAGE_PERMISSIONS` in `models/groups.ts`, the group editor's picker, and the locale strings.
- **Not `GUEST_ROLES`.** Guests cannot submit, and the routes also refuse a requester with no
  account regardless of what the rules say, the way `liveNotes.permissionsFor` refuses
  `write:notes` to a guest.
- **Seeded on the Users group.** `write:feedback` joins the roles of the Users group's Default Rule
  in `groups.init()`, beside `write:comments` — and the roles a group created afterwards starts with
  (`groups.createGroup`), which are the Users group's. That rule matches every path, but the permission
  has an effect only under a board, and only one whose `acceptsIdeas` is on, so **`acceptsIdeas` is
  the switch**: a board created with it on accepts ideas from any account at once, and an
  administrator narrows that with a DENY rule like any other page permission.
- **First-run seed only, with no migration.** An installation seeded before this keeps its Users
  group as it is, so no account there can submit until an administrator adds `write:feedback` to a
  rule. Nothing stored changes shape, so the CLAUDE.md migration rule does not apply: this changes
  what a new installation starts with, not what an existing one holds. The help text under
  `acceptsIdeas` in the board editor names the permission, so the administrator of an older
  installation knows what is missing.

**Status is `review:pages` or `manage:pages` at the board**, either one. `review:pages` already means
"may pass judgement on contributions to this page" (`api/approvals.ts`), which is what moving an
idea along is, and `manage:pages` is the broader authority over the page that includes it. Neither
name implies the other, so the check asks for both explicitly. `manage:system` gets it through the
usual bypass.

**The same pair moderates the board's ideas through the submission form**: it may open the form on
any idea, at any status, and is always offered the board's categories there, on a submission of its
own too — regardless of `submitterCategories`, which is about what a *submitter* is asked
(`feedback.mayModerate`, `feedback.mayEdit`). That is how an idea is filed on a board whose
submitters do not pick categories: the properties dialog offers raw tags, with nothing to say which
of them are the board's categories. Withdrawing stays the author's; anybody else deletes an idea
with `delete:pages`, like any page.

### 4.1 Access is the board's

**Whoever may do something on the board may do it on everything in the board, and nobody else
may.** Page rules are resolved once, at the board, for every page, folder and asset at or under the
board's path: its ideas, and anything else older data left there before the board's folder was
held to ideas alone ([§3.2](#32-membership)). A rule written for a path below the board is never consulted,
and neither is a tag rule matching an idea's own tags. The board's own path and tags are what rules
are matched against, so a rule over `/feedback`, or one matching a tag carried by the board's
front page, decides for the whole board.

- **For a nested board, the outermost board decides.** A board inside a board inherits the outer
  board's answer, which is what "everything in the board" means. Listing is still the nearest
  listing page's job ([§3.2](#32-membership)): a nested board lists its own ideas, under the outer
  board's access. A board inside a *blog* is not under any board, so it is ruled by its own path as
  usual, and its ideas by it.
- **Every permission, not only `read:pages`.** Write, delete, comments, history, assets, navigation,
  `write:feedback`, `review:pages`: an idea answers the same as its board. The same holds for whether
  an unpublished idea may be seen (`maySeeUnpublished`, which asks `write:pages` and `manage:pages`),
  so that question is also one answer for the whole board.
- **The idea's own page settings still apply.** A password, a publish state, `allowComments` and
  `allowRatings` are settings on a page, not rules, and are unchanged.

**It is enforced where every page permission is already decided**, so that it holds on every surface
at once (the page view, site search, the sitemap and app shell, the tree and file manager, MCP,
comments, assets) rather than one filter at a time. There are exactly two such places:

- **`groups.checkAccess`**, on the main thread. Before resolving a rule, it replaces the page
  reference with its board's (`feedback.ruleRefFor(ref)`: the outermost board at or above
  `ref.path` in that site and locale, as `{ siteId, locale, path, tags }` of the board's front page;
  the reference unchanged otherwise). This is the same spot where the live notes' image folder is
  already special-cased, for the same reason.
- **`rulesAllow` in the notification fan-out**, in a worker thread, which has no `WIKI.models`. The
  event carries the answer instead: `notifications.emit` puts `ruleRef` on the event's page snapshot,
  resolved by `ruleRefFor` when the event is written, and `rulePageOf` (`notifications/types.ts`)
  matches against it when it is there.

A reference with no locale cannot name a board, which belongs to one, and is left as it is. Every
caller passes one: the tree listing's items were the exception and now carry their `locale`, and
`reviewerFor` in `api/approvals.ts` passes the page's.

**`ruleRefFor` is an in-memory lookup**, since `checkAccess` is asked per row by search and the tree.
`models/feedback.ts` holds every board's path, tags and settings per site and locale, outermost
first, read off the partial index `pages_feedback_boards_idx` (`WHERE editor = 'feedback'`). It is
loaded in `postBoot` with the groups' rules, and reloaded by every change that can touch a board:

- `createPage`, `updatePage` (tags and settings live in it), `movePage`, `deletePage` and
  `restorePage` call `feedback.pageChanged(editor)`, which reloads only for a `feedback` page;
- `deleteOrphaned`, `tree.renameFolder` and `tree.moveFolder` reload outright, since a board may be
  anywhere under the folder;
- the reload is broadcast to the other instances of an HA set with a `reloadFeedbackBoards` event,
  the way `reloadSites` is, and `flushCaches` reloads it too.

**What it buys besides consistency** is that the board's listing needs one access decision rather
than one per idea, which is what lets it run entirely in SQL ([§5.1](#51-api)).

---

## 5. The board page

### 5.1 API

`api/feedback.ts`, registered in `api/index.ts`. No route-level permissions, because every check is
a page rule (the same comment `api/blogs.ts` carries). `config.scope: 'pages'` throughout.

**`GET /sites/:siteId/feedback/ideas`.** One page of a board's listing, with its facets.

| Query | Meaning |
| ----- | ------- |
| `path`, `locale` | The board, as for blogs. |
| `q` | Full-text search over the ideas' title, description and body. |
| `sort` | `top` / `newest` / `recent` / `trending`. Absent means the board's `sort`. |
| `status` | Comma list of statuses, or `all`. Absent means the default for the sort (below). |
| `category` | One category tag, or `none` for uncategorized. |
| `page` | 1-based, clamped as a blog's is. |

**The default statuses depend on the sort.** Without a `status`, the listing shows:

| Sort | Shown by default | Hidden by default |
| ---- | ---------------- | ----------------- |
| Top, Trending | Open, Under Review, Planned, In Progress | Completed, Closed |
| Newest, Recent Activity | Open, Under Review, Planned, In Progress, Completed | Closed |

Under Top and Trending the point is what to work on next, and done work at the top would bury it.
Under Newest and Recent Activity, something having just shipped is news. Closed is never news. A
reader who picks statuses explicitly gets exactly what they picked, under any sort.

**The sorts:**

| Sort | Ordered by | Tie-break |
| ---- | ---------- | --------- |
| `top` | Upvotes: `coalesce((ratings->'thumbs'->>'up')::int, 0)`, off the cached column with no join | newest |
| `newest` | `createdAt` | — |
| `recent` | `lastActivityAt`: the later of the page's `updatedAt`, its newest comment and its latest status change | newest |
| `trending` | Upvotes in the last `TRENDING_WINDOW_DAYS` (14) | upvotes, then newest |

- **The window is a constant**, `TRENDING_WINDOW_DAYS = 14` in `models/feedback.ts`, and not a
  board setting.
- **Trending** is a grouped count of the upvotes cast in the window (`kind = 'thumbs' AND value = 1
  AND "updatedAt" >= now() - window`), joined to the board's ideas. `updatedAt` rather than
  `createdAt`, because a thumbs-down changed to an upvote is a vote cast today. A partial index on
  `pageRatings ("updatedAt") WHERE kind = 'thumbs' AND value = 1` keeps the count to the votes of the
  last two weeks rather than every vote ever cast. An idea that nobody voted for inside the window
  scores 0 and is ordered among the rest by its total.
- **Recent Activity** takes the newest comment per idea from a lateral subquery on the comments'
  `pageId` index, plus `feedbackStatuses.updatedAt` from the join that is already there. Ordering by
  it computes it for every idea matching the filters, so it is the first thing to measure on a big
  board. If it is too slow, the newest comment's date moves onto `feedbackStatuses` (written by the
  comment routes for an idea), which makes it a column like the others.

Each idea in the answer contains `{ id, path, title, description, status, categories, tags,
upvotes, viewerVoted, commentsCount, authorId, authorName, createdAt, lastActivityAt }`, where the
author is the page's CREATOR — who submitted it, not who last tidied its wording. The answer also
says the `sort` and `statuses` it was narrowed to, which are the defaults when none were asked for.
The facets are `{ statuses: {status, count}[], categories: {tag, label, count}[], uncategorized:
count }`.

**It is answered entirely in SQL, with no ceiling on the size of a board.** A blog cannot do this:
its posts are each subject to their own page rules, which are resolved in code, so it reads every
post, filters in memory and stops at `MAX_POSTS`. A board's access is one decision
([§4.1](#41-access-is-the-boards)), so the route asks it once and the database does the rest:

1. **Access:** `read:pages` at the board, or 404. Then whether this reader may see unpublished
   ideas, which is also one answer for the board: true adds nothing to the query, and false adds
   `liveCondition`.
2. **The ideas:** `tree.folderPath` equal to the board's path, `type = 'page'`, the editor not a
   bodyless one, left-joined to `feedbackStatuses`, and narrowed by `q` when there is one.
3. **The facets**, over that set, in one query: a filtered `count(*)` per status
   (`coalesce(status, 'open')`) and per category tag — both lists are short and known up front, so
   no `GROUP BY` over `unnest(tags)` is needed — plus a count of the ideas carrying none of them.
4. **The total**, with the status and category filters added: a count, which is what the requested
   page is clamped against.
5. **The page:** `ORDER BY` the sort, `LIMIT perPage OFFSET …`.

So `total`, `pageCount` and every facet count are exact however large the board grows, and there is
no `truncated` in the answer.

- **Facets are counted over every idea matching `q`, before the status and category filters.** This is
  the blog's rule (picking a filter must never remove the control that undoes it), with one change:
  search narrows the counts. "12 Planned" next to a search for "dark mode" should mean 12 Planned
  ideas about dark mode.
- **`q` is a SQL condition on step 2**, built by the tsquery and dictionary logic
  `models/search.ts` already has for `searchPages`. That logic is extracted into a helper rather than
  called through `searchPages`, which paginates and ranks for a different purpose. A
  password-protected idea is matched on title and description only, as in site search. Sorting stays
  the reader's choice and does not switch to relevance: somebody searching a board is looking for
  whether their idea already exists, and the most-voted match answers that best.
- **`viewerVoted`** is one `pageRatings` lookup over the ids on the page being returned, and none for
  a guest. **`commentsCount`** is one grouped count over the same ids, which is a new
  `comments.countForPages(ids)` next to `countForPage`. Both run after slicing, so they cost at most
  `perPage` rows each.

**`GET /feedback/boards`**, behind `read:groups`, `write:groups` or `manage:groups`: where every board
on the instance is, for the group editor's warning ([§9](#9-everything-else-an-idea-touches)).

**`GET /sites/:siteId/feedback/similar`** `?path&locale&title`. Up to five ideas on the board whose
title or description resembles a title being typed, for the first step of the submission form
([§7](#7-submitting-an-idea)). Unlike the listing it ranks by relevance, and its query ORs the
title's terms rather than requiring all of them, since two people rarely describe the same idea in
the same words. Every status is included, because "this was already done" and "this was already
declined" are both worth knowing before submitting. Each result has the same fields as a listing
row. The route needs an account and `write:feedback` at the board (403 otherwise; 404 when the board
is not readable at all), since only somebody about to submit has a reason to ask, and it shares
step 2 of the listing's query, matched on the title and description weights (`ts_filter(ts,
'{a,b}')`), ranked by `ts_rank` and limited to five.

**`PUT /sites/:siteId/feedback/ideas/:pageId/status`** with `{ status, comment? }`. Needs an account,
and `review:pages` or `manage:pages` at the idea's board, and the idea must be in a board, since status
means nothing elsewhere. In one transaction it writes the status row, posts the status comment if
there is one ([§3.3](#the-status-comment)) and records `commentId`. After the transaction it writes
the audit entries, fires the `comment:new` webhook if a comment was posted, and emits the notification
event ([§8](#8-notifications)). It returns the idea's status block and the comment.

The submission routes are in [§7](#7-submitting-an-idea).

### 5.2 Frontend

This mirrors the blog component for component, so the review of each half can lean on the other:

| Blog | Board |
| ---- | ----- |
| `components/EditorBlog.vue` | `components/EditorFeedback.vue`: intro, submission notice, categories (add, rename label, reorder, remove), whether submitters pick categories, default sort, per page, accepts ideas, voting |
| `components/PageBlog.vue` | `components/PageFeedback.vue`: toolbar and listing |
| `components/PageBlogSidebar.vue` | `components/PageFeedbackSidebar.vue`: status and category facets with counts |
| `composables/blog.js` | `composables/feedback.js`: the module-singleton listing state both halves read |
| `helpers/blogFilter.js` | `helpers/feedbackFilter.js`: `q`, `sort`, `status`, `category`, `p` in the query string, and the default statuses per sort |
| `helpers/pageBlog.js` | `helpers/pageFeedback.js`: parse and defaults, plus `FEEDBACK_STATUSES` with a colour and an icon each |
| — | `FeedbackVote.vue` and `FeedbackStatusBadge.vue`, drawn the same way in the listing, at the head of an idea and in the duplicate check |

**The listing** is a toolbar followed by one row per idea, laid out as a single list (there is no
card layout as there is for a blog, because a board is scanned rather than browsed):

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search ideas…         ]  Sort: [Trending ▾]             [+ Submit idea] │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌────┐  Dark mode for the editor                                 💬 14    │
│ │ ▲  │  Make the editor follow the system theme…                          │
│ │ 87 │  [Planned]  [Editor] [Accessibility]  · Ana Ruiz · 3 Mar 2026      │
│ └────┘                                                                    │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌────┐  Export a page to PDF                                     💬 3     │
│ │ ▲  │  …                                                                 │
│ │ 41 │  [Open]  [Export]  · …                                             │
│ └────┘                                                                    │
└────────────────────────────────────────────────────────────────────────────┘
                    « 1 2 3 »
```

- The vote box is a toggle that calls the existing `PUT` and `DELETE …/rating` and updates the
  count in place from the response. For a guest it is a link to log in. It is disabled when the
  board's `voting` is off or the idea's `allowRatings` is off, and the count is still shown.
- Search is debounced and written into the URL, so a search result can be linked to, as a blog's
  tag filter can.
- **The sidebar** carries two lists. Status lists all six, each with its count, as checkboxes. Until
  the reader touches them they show the default for the current sort, so changing the sort changes
  them too. Once the reader has picked statuses, `status` is in the URL and changing the sort leaves
  their choice alone. Category is single select, with "All" and "Uncategorized".
- **Submit idea** appears only to somebody holding `write:feedback` at the board, and only on a board
  that accepts ideas. Whether the reader holds it comes with the page's permissions
  (`userStore.pagePermissions`), as every other per-page control does.
- The empty board and the "nothing matches" state are different messages. So is a board whose
  folder has been moved away from it, which `listing` reports as its own answer, as blogs do.

`pages/Index.vue` gains `isFeedbackBoard` next to `isBlog`. It is handled the same way at each of
the places `isBlog` is tested: no Talk tab, no article, the listing in its place and the board
sidebar in place of the contents, tags and rating column. All the new components are
`defineAsyncComponent`, so a wiki without boards does not download them.

---

## 6. The idea page

The page payload (`GET /sites/:siteId/pages/...` in `api/pages.ts`) gains a `feedback` object
alongside `blog`, null for a page that is not an idea:

```ts
feedback: {
  board: { path, title, voting, acceptsIdeas, submitterCategories, categories },
  status: FeedbackStatus,
  statusUpdatedAt: Date | null,
  statusUpdatedBy: { id, name } | null,
  statusCommentId: string | null,
  canSetStatus: boolean,        // review:pages or manage:pages at the board
  canEditOwn: boolean           // write:feedback here + creator + still open
                                // Edit is offered on canEditOwn || canSetStatus, Withdraw on canEditOwn
} | null
```

This comes from the in-memory board list ([§3.2](#32-membership)) plus one primary-key read of
`feedbackStatuses`, and only when the page turns out to be an idea. On an idea the page's `rating`
is always the thumbs summary, regardless of the site's ratings mode, so the vote box reads its count
from `rating.up`.

The idea is always drawn in the centered layout — the column held to the measure the theme's
Centered content width uses — regardless of what width the site's theme sets, since its head, body
and discussion read as one short piece rather than as an article running to the column's edges.

What the reader sees, from the top:

1. **The byline strip** that a blog post has ("Posted in *Engineering Notes*"), worded for a board:
   "Idea on *Product Feedback*", linking back to the board.
2. **An idea header** above the body: the large vote box from the listing, the status badge with
   "set by Ana Ruiz, 3 Mar" (linking to the status comment when there is one), and the category
   chips. Somebody with `review:pages` or `manage:pages` gets a **Change status** button that opens a
   dialog (`FeedbackStatusDialog.vue`): the six statuses and an optional comment, in a markdown
   field with a preview (`FeedbackMarkdownField.vue`, the comment box without its own submit
   button). The comment field is shown only where a status comment can be posted
   ([§3.3](#the-status-comment)). The idea's author, while `canEditOwn`, gets **Edit** and
   **Withdraw**, which open the submission form on the idea ([§7](#7-submitting-an-idea)). A
   moderator gets **Edit** too, at any status, with the board's categories always in the form.
3. **The body.**
4. **The discussion, inline.** `PageTalk.vue` is mounted directly under the article instead of
   behind the Talk tab. `showTalkTab` is false for an idea, the way it is for a blog's front page.
   Status comments are in it, in order, with their status header.

What has to change for the discussion to be inline:

- `PageTalk.vue` gets an `inline` prop. Inline, it is headed **Discussion** with the count, since
  there is no tab to carry one, and set off from the article by a rule; the composer it already has
  at the bottom of the thread is the one a reader writes in. It exposes `reload`, which the page view
  calls after a status change so that the comment it posted is drawn and scrolled to.
- **Opening an idea reads its discussion.** The page view's `markSeen` counts the discussion as on
  screen for an idea, so a comment notification about it is marked read on arrival, and
  `feedbackStatus` is one of the content categories that opening the page marks read.
- **Annotations are off on ideas**, inline or not. `PageTalk` hides their controls and the server
  refuses `annotations` on a comment posted to an idea, so that none can be made through the API
  either. The selection toolbar that starts one is not mounted.
- The comments payload carries `statusChange: { from, to } | null` per comment, read from
  `meta.feedbackStatus`, so `PageComment.vue` can draw the header.
- The side column's **rating section is hidden for an idea**, because the vote box in the header
  replaces it, and a thumbs-down button next to a board's upvote would contradict it.
- **A third-party comments provider** already draws itself under the article (`PageCommentsEmbed`),
  so it works on an idea with no changes. Status comments are not available there
  ([§3.3](#the-status-comment)).

---

## 7. Submitting an idea

**Two steps, in one dialog** (`FeedbackSubmitDialog.vue`), opened from **Submit idea** on the
board. It is not the page editor: somebody
proposing an idea should not have to understand properties, paths, publish states or the save-as
tree.

**Step 1: the title.** The dialog asks for a title and nothing else, under the board's
`submitNotice` where it has one. From the third character on,
debounced, it asks `GET …/feedback/similar` and lists what comes back under the field, each idea with
its status badge, upvote count and comment count. The list is headed with an invitation to vote or
comment on an existing idea rather than submit a duplicate. Each row has a working vote button and
opens the idea in a new tab, so the dialog stays where it was. **Continue** goes to step 2 and is
available whether or not anything was found.

**Step 2: the form.**

- **Title**, carried over from step 1 and still editable.
- **Description**, in basic markdown: `FeedbackMarkdownField.vue`, a text area with Write and
  Preview toggles, whose preview is drawn in the article's own typography. It is rendered by a
  restricted pipeline, `renderers/feedback.js`, which has the comment renderer's feature set
  (`html: false`, no images, headings, tables or blocks, and links leave with
  `rel="nofollow ugc noopener"`). The restriction
  is about what a submission looks like. It is not the security boundary: `render` is still
  sanitized on the server like every save, and the idea gets no script or style permission
  regardless of what the submitter holds, as for imported content.
- **Categories**, as a multi-select of the board's labels. Shown only when the board has categories
  and `submitterCategories` is on, or the reader holds `review:pages` or `manage:pages` at the board.
  None is a valid answer.

**`POST /sites/:siteId/feedback/ideas`** `{ path (board), locale, title, content, render, categories
}`. Needs an account and `write:feedback` at the board, and `acceptsIdeas` on.

- The server works out the idea's path: the board's path followed by `normalizeNewPagePath(title)`.
  On a collision it appends `-2`, `-3` and so on. A title that normalizes to nothing is a 400.
- `categories` must all be on the board's list (compared lowercased), and must be empty while
  `submitterCategories` is off, unless the requester holds `review:pages` or `manage:pages` at the
  board. They become the page's tags.
- `description`, the short field the listing shows, is the first 200 characters of the markdown
  with its punctuation taken out.
- The page is created through `pages.createPage` as the requester, so it gets history, indexing,
  storage, watching, the `pageCreated` notification and the audit entry like any other page.
  Defaults: `editor: 'markdown'`, `publishState: 'published'`, `allowComments`, `allowRatings`.
  `markdown` and not a new editor, so that a moderator holding `write:pages` opens it in the normal
  editor.
- **The author's upvote comes with it.** Straight after the page is created, the route records a
  thumbs-up from the requester through `pageRatings.rate`, so a new idea starts at 1 and the count
  means "people who want this" from the start. It is an ordinary vote, which the author can withdraw
  like any other. It is skipped on a board whose `voting` is off, since nobody else could vote
  there either. It records no `ratePage` audit entry of its own: the `createPage` entry already
  covers the act.
- **Rate limited** to one submission per account per the site's **submission interval**, a minute
  by default, set under Admin → Editors → Feedback Board Editor (`EditorFeedbackConfigOverlay.vue`)
  and stored as `editors.feedback.config.submissionInterval`: a duration as the comment cooldown is
  written (`30s`, `1m`, `5m`), or `0` for no limit. A value that will not parse is read as the
  default, never as no limit (`feedback.submissionIntervalFor`). Its own setting rather than the
  comment cooldown, since a form that creates pages is dearer to flood than a comment box. On the
  postgres-backed counter the login and comment limits use (`feedback:<site>:<user>` in
  `rateLimits`), so that the API, a token and a scripted browser meet the same limit as the
  dialog, across every instance; not per address, since an office behind one address is many
  people with an idea each. Past it the route answers 429 with `Retry-After`.
- The answer is the new idea's path, and the dialog navigates to it.

**`PATCH /sites/:siteId/feedback/ideas/:pageId`** (`{ title, content, render, categories }`) and
**`DELETE` on the same path** are how an author edits or withdraws their own idea, under the rule in
[§4](#4-permissions). A moderator of the board may `GET` and `PATCH` any idea at any status, with
the categories offered as they are on a moderator's submission; `DELETE` stays the author's. The edit form is step 2 of the same dialog, without step 1, filled from
**`GET` on the same path**: the page route hands a page's source only to whoever holds
`read:source` or may write it, which an idea's author usually does not, so this hands the author
their own idea's title, source and categories under the same rule as the edit. Both go through
`updatePage` / `deletePage`, so history and audit are the usual ones. An edit does not move the page
when the title changes: the URL is what was shared, so only the title changes. Categories are
replaced only among the board's own tags, and any other tags a moderator added are kept.

---

## 8. Notifications

**One new category, `feedbackStatus`**, under `notifications/categories/`: "An idea you submitted or
voted on changed status".

- **The event is `feedback:status`**, emitted by the status route with `{ page, from, to, commentId,
  excerpt, mentionHandles }`. **A status change posts no `comment:new` event, even when it posted a
  comment.** One event lets the fan-out deduplicate across everybody it reaches
  ([`notifications.md` §7.4](notifications.md#74-one-entry-per-person-per-event)). Two events would
  give an author who also watches the page two entries for one act.
- **Which categories react to it:**

  | Category | Candidates | Only when |
  | -------- | ---------- | --------- |
  | `feedbackStatus` | the idea's creator, plus everybody holding an upvote on it (`kind = 'thumbs' AND value = 1`) | always |
  | `watchedPageComment` | the idea's watchers | a comment was posted |
  | `mention` | handles written in the comment | a comment was posted |

  `feedbackStatus` gets the highest priority (45, above `mention`'s 40), so somebody who is both a
  voter and mentioned gets one entry, and it is the one that says what happened. A watcher who did
  not write or vote for the idea hears about a status change only through its comment, which is the
  same as before: they asked to hear about edits and comments, and a status change without a comment
  is neither.
- **The entry's variant is the status the idea moved TO**, which picks the sentence — "{actor} marked
  {page} as planned" (`notifications.messages.feedbackStatus.<status>`) — so the inbox and the mail
  need no placeholder beyond the two every message has.
- **The entry and the mail carry the comment** when there is one, quoted by its excerpt the same way
  a comment notification quotes the comment. Without one the excerpt is set to null rather than left
  out, or an entry still unread from an earlier change would go on quoting that one's comment.
- Must hold now: `read:pages` at the idea's board (the event's `ruleRef`,
  [§4.1](#41-access-is-the-boards)). The audience is read by `submitterAndVotersOf`
  (`notifications/recipients.ts`). Default: in-app ✓, email ✓. Coalesces on
  `feedbackStatus:<pageId>`, so two changes in a row before the reader looks are one entry showing the
  latest. Origins: `user`.
- Voting does not watch the page ([§3.5](#35-upvotes)), so a voter hears about comments only if they
  watch the idea themselves.
- Strings: `notifications.categories.feedbackStatus.*`, `notifications.messages.feedbackStatus.*`,
  and `mail.notification.actions.feedbackStatus`.

---

## 9. Everything else an idea touches

- **Site search, `/_tags`, the tree, the sitemap, `robots`, the app shell, MCP:** ideas are pages, so
  all of these already work, and each asks `checkAccess`, so each applies the board's access without
  being changed ([§4.1](#41-access-is-the-boards)). A board's front page behaves like a blog's: it is
  in the sitemap, and `appShell` describes it by title, description and intro.
- **Storage targets:** a board is written as `.json` with its settings and an idea is written as
  `.md`. Status and votes are not exported ([§3.3](#33-status)).
- **Audit:** a new `setFeedbackStatus` action (kind `page`) in `AUDIT_ACTIONS`, with its string.
  Submissions, edits and withdrawals record `createPage`, `updatePage` and `deletePage`, and votes are
  already `ratePage` and `unratePage`.
- **`PageNewMenu.vue`:** gains **Feedback Board** next to **Blog**. The board itself offers
  **Submit idea** rather than a New Post button; somebody holding `write:pages` who wants to write an
  idea in the full editor starts a page from the header while on the board, which files it in the
  board's folder the way starting one from a blog files it under the blog (`pageCreate` in
  `stores/page.js`).
- **`AdminEditors.vue`:** the `feedback` editor can be switched off per site, like `blog`, and has a
  Configuration screen for the site's submission interval ([§7](#7-submitting-an-idea)).
- **The group editor** (`GroupEditOverlay.vue`) warns under a rule whose path falls inside a board
  that it has no effect there, for the kinds whose path says where they reach (starts with, branch,
  exact) and where the rule's sites and locales include the board's. The board paths come from
  `GET /feedback/boards`, read off the same in-memory list. The rule is still saved: it may be meant
  for a time when the board has been moved or deleted. It also offers `write:feedback` in its
  picker, except to the guests group.
- **CLAUDE.md:** `write:feedback` joins the page permission list, with a line on what it covers and
  the fact that the Users group is seeded with it, and the Permissions section says that a board's
  access covers everything under it.
- **Sample content** (`helpers/sampleContent.js`): a board at `/feedback` with ten ideas spread
  across the statuses, three of them with a status comment, the generating account's vote on four,
  and a short discussion on one by the sample discussion's accounts.
- **Migration:** one, `20261023005815_feedback-boards`: `feedbackStatuses`, the partial index on
  recent upvotes in `pageRatings`, the partial index on boards in `pages` — and a data step giving
  every existing site `editors.feedback` (with its `submissionInterval` default), since a site's
  settings are read back verbatim and never merged with the defaults a new site is created with (as
  `20260914043258_visual_editor` explains).
- **The 2.x importer and the page problems check** count `feedback` among the editors with no body
  to render or read.
- **The crawler's document** for a board (`helpers/appShell.ts`) lists its intro and the first twenty
  ideas the public sees, the way a blog's lists its posts. The server has no markdown renderer, so
  the intro is given as its words, a paragraph each (`markdownToPlainText` in `helpers/common.ts`,
  which an idea's excerpt is cut from too).

---

## 10. Risks

- **Rules under a board are silently ignored.** An administrator who writes a DENY for
  `/feedback/some-idea` gets nothing from it, by design. The group editor's warning
  ([§9](#9-everything-else-an-idea-touches)) is what keeps that from being a surprise, and it has to
  be there from the first release.
- **The board map is a cache, and access depends on it.** Between a board being created, moved or
  deleted and another instance hearing `reloadFeedbackBoards`, that instance resolves the pages
  under it by their own paths. The window is the same one a site's configuration already has after
  `reloadSites`. At boot the list is loaded in `postBoot` together with the groups' rules — the same
  moment page access as a whole becomes possible.
- **Moving a board changes the access of everything under it**, since the pages move with it and are
  then ruled by its new path. That is the same thing that happens to any folder that is moved, but
  here it is one rule deciding a whole board, so it is worth a line in the move dialog.
- **Membership by path** has the same weakness for boards that it has for blogs: renaming the folder
  out from under a board empties it. Statuses survive because they are keyed by page, so moving the
  ideas back restores everything.
- **Recent Activity on a very large board** computes the newest comment for every idea matching the
  filters before it can sort. It is an indexed read per idea, and [§5.1](#51-api) says what replaces
  it if that is too slow.

---

## 11. Build order

1. **Listing lookup.** `listingFor` in place of `blogs.blogFor`, and the blog's nested-roots filter
   stopping at a board too.
2. **Board editor and storage:** the `feedback` editor, content normalize and parse,
   `EditorFeedback.vue`, the New menu entry and `ensureFolder`.
3. **Board access:** the in-memory board map and its reload event, `ruleRefFor`, the substitution in
   `checkAccess`, `ruleRef` on notification snapshots, and the group editor's warning. Everything
   after this step relies on it.
4. **Status:** schema, migration, `models/feedback.ts`, the status route (without the comment), audit,
   and the `feedback` object on the page payload.
5. **Board listing:** API with Top and Newest first, `PageFeedback.vue`, the sidebar and the filter in
   the URL. Then `q`, then Recent Activity and Trending.
6. **Votes:** the board-aware branch of `loadRateable`, and the vote box in the listing and on the
   idea.
7. **Idea page:** header, status dialog, inline `PageTalk`, annotations off. Then the status comment
   and its header in the discussion.
8. **Permission:** `write:feedback` in `PAGE_PERMISSIONS`, the Users group's seeded rule, the group
   editor and the strings.
9. **Submission:** the similar-ideas route, the two-step dialog, the restricted renderer, create
   with the author's upvote, edit and withdraw, and the rate limit.
10. **Notifications:** the `feedback:status` event and the `feedbackStatus` category, with
     `watchedPageComment` and `mention` reacting to it.
11. **Sample content and CLAUDE.md.** A *Feedback boards* section under Conventions, next to the
    blog's material, covering what an agent would get wrong: no row means open, thumbs regardless of
    site mode, the board's access covering everything under it, and a status comment emitting no
    `comment:new`.

