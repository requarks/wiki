---
paths:
  - "backend/models/feedback.ts"
  - "backend/api/feedback.ts"
  - "backend/api/ratings.ts"
  - "backend/notifications/categories/feedbackStatus.ts"
  - "dev/specs/feedback-boards.md"
  - "frontend/src/components/*Feedback*.vue"
  - "frontend/src/composables/feedback.js"
  - "frontend/src/helpers/*eedback*.js"
  - "frontend/src/renderers/feedback.js"
---

# Feedback boards

Ideas proposed, voted on and answered. A board is a page written with the `feedback` editor and its
ideas are the pages directly in its folder — the blog's model (`models/blogs.ts`), one level deep.
**`dev/specs/feedback-boards.md` is the design**; `models/feedback.ts`, `api/feedback.ts`; on the
frontend `PageFeedback.vue` (the listing), `PageFeedbackIdea.vue` (an idea's head) and the
`Feedback*.vue` dialogs.

- **A board's folder holds its ideas and nothing else** — no sub-folder, file, bodyless page or page
  further down. `feedback.refuseNonIdea` (in memory, asked with the folder a thing goes INTO) is
  called by every model method that places a page, folder or asset; `refuseAsBoardFolder` stops a
  folder renamed, moved or copied onto a board's own path, and `guardBoardFolder` a board created,
  moved or restored over a folder already holding something else. A new way of putting something
  somewhere asks them too.
- **A board never arrives over existing pages**, unless the actor holds `manage:system`.
  `guardBoardFolder` refuses an occupied folder outright, ordinary pages included, and a path the
  recycle bin holds a page deleted from at or under. `ruleRefFor` would otherwise void every rule
  already written for those pages, for every account, on nothing but `write:pages` at the board's
  own path. Ideas come after the board; an existing page is moved in, which asks `manage:pages` at
  the page.
- **Access is the board's, all or nothing** — see [Permissions](../../CLAUDE.md#permissions). `feedback.ruleRefFor`
  reads an in-memory list of every board (`reloadBoards`), which is why it costs `checkAccess` no
  query. Anything that creates, moves, retags or deletes a board's front page has to reload it:
  `pages.*` mutations call `feedback.pageChanged(editor)`, folder moves and renames call
  `reloadBoardsEverywhere`, and `reloadFeedbackBoards` carries it across an HA set. A notification is
  checked in a worker with no list, so `notifications.emit` puts the board's ref on the event
  (`PageSnapshot.ruleRef`).
- **That is also what lets the listing be SQL** — filtered, counted, sorted and paged by the
  database, where a blog reads every post and filters in code. Don't add a per-idea access check to
  it.
- **No `feedbackStatuses` row means `open`.** Status is not page content: setting one writes that
  row (and the audit log), never a page version. Changing it takes `review:pages` or `manage:pages`
  at the board.
- **A status change with a comment is ONE `feedback:status` event**, and posts no `comment:new`:
  `feedbackStatus` (author and voters), `watchedPageComment` and `mention` all react to it, so the
  fan-out can deduplicate. The comment is written by `feedback.setStatus` inside the same
  transaction, marked with `meta.feedbackStatus`.
- **An upvote is a page rating**: on an idea always `thumbs` and only `+1`, regardless of the site's
  ratings mode — the board's `voting` switch stands in for it (`api/ratings.ts`). Submitting votes for
  the author.
- **An idea's discussion is drawn under it** (`PageTalk` with `inline`), never on a Talk tab, and
  cannot be annotated — the comment route refuses annotations on an idea.
