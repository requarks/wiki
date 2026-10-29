---
paths:
  - "backend/models/comments.ts"
  - "backend/api/comments.ts"
  - "backend/modules/comments/**"
  - "frontend/src/pages/AdminComments.vue"
  - "frontend/src/components/PageComment*.vue"
  - "frontend/src/components/PageTalk.vue"
  - "frontend/src/components/PageAnnot*.vue"
  - "frontend/src/renderers/comment.js"
  - "frontend/src/helpers/annotations.js"
  - "frontend/src/helpers/commentsEmbed.js"
---

# Comments

Two things wearing one name, and `models/comments.ts` is the seam between them. **Only one provider
is in use per site** — two comment widgets on a page are two separate discussions of it, and neither
of them is the discussion. That is what makes this screen different from Analytics, where several
providers may be on at once.

**A third-party provider is two YAML files**, exactly as an analytics provider is: a
`definition.yml` (what it is, what it needs configured, the same `props` shape read through
`parseModuleProps`) and a `code.yml` with the markup it contributes. Nine ship — Artalk, Comentario,
Discourse, Disqus, Giscus, Hyvor Talk, Isso, Remark42, Waline. There is no `comments.ts` beside them
and nothing to load: the discussion lives in somebody else's service. A directory that cannot be read
is skipped with a warning rather than emptying the list, as under `modules/analytics/`.

**The built-in provider is this wiki**, and deliberately has no module directory: its comments are
rows in the `comments` table, served by `api/comments.ts` and drawn on a Talk tab beside the article.
Its settings are declared as `BUILTIN_DEFINITION` in the model so that the admin screen renders one
kind of form for every provider rather than two.

**Where the markup goes is the one thing that is not like Analytics.** An analytics tag is served in
the document; a comment widget belongs at the bottom of the *article*, and moving between wiki pages
is a router transition and not a document load — a snippet baked into the shell would initialise once
and then show the first page's discussion for ever. So the rendered snippet rides along on the site
payload (`comments.publicConfigFor`, narrow on purpose — the stored configuration holds an Akismet
key) and `PageCommentsEmbed.vue` mounts it per page. `code.yml` has three slots: `head` (added once
per document and awaited), `main` (the container), `body` (the init script, run after both). Scripts
are re-created as real elements — one that arrived through `innerHTML` never runs — and go INSIDE the
container, which giscus and Isso depend on.

**Placeholders are split between the two sides.** `{{js:prop}}` / `{{attr:prop}}` / `{{num:prop}}` /
`{{bool:prop}}` are resolved on the server as they are for analytics; `{{js:page.url}}` and the rest
of the `page.*` family are left in the string for `helpers/commentsEmbed.js` to fill in per page,
escaping by the same rules. A provider that is selected but missing a required prop serves nothing at
all rather than a widget pointed at no account.

**The built-in provider's permissions are PAGE rules**, not the group-wide list, so none of its routes
declares `config.permissions` — every one resolves the page and asks `mayOnPage`. `read:comments` to
see a discussion, `write:comments` to post and to edit or delete your own, `manage:comments` to edit or
delete anybody's. The two are not interchangeable and neither implies the other.

- **Guests can take part**, where a rule grants them `write:comments` — that is how a public wiki opens
  a discussion. A name and an email are required of them; the email is stored and never served, and is
  what the spam check is given. A guest cannot edit or delete, because there is no session that
  identifies them as the author and "their own" has nothing to mean.
- **Two things stand between a comment and the table.** The site's **posting cooldown** (`30s` by
  default, `0` for none) is counted per account and per address for a guest, through the same
  postgres-backed counter the login limit uses, so instances behind a load balancer agree about it;
  `manage:comments` on the page is exempt, since answering five threads in a row is what moderating
  looks like. And an optional **Akismet key**, which is the one `sensitive` prop here: masked at the
  API boundary like every other module secret. Akismet **fails open** — a timeout or a revoked key
  lets the comment through and logs it, because a wiki that silently stops accepting comments is worse
  than one that lets a spam comment past. A comment it calls spam is refused outright; there is no
  moderation queue yet, which is what the `meta` column is room for.
- **Replies are one level deep, enforced in the model**: a `parentId` naming a comment that is itself a
  reply is rewritten to that reply's own parent, so answering the third message in a thread puts the
  answer at the bottom of the thread.
- **Deleting a comment keeps its replies** — they are other people's words. A comment that has any is
  kept as a placeholder row (`deletedAt` set; content, author and annotations cleared) that draws as
  "Comment was deleted." with the thread going on under it; one with none is deleted outright, and a
  placeholder goes once the last reply under it does (`discard` in the model). Taking the whole
  thread is `withReplies` on the delete route and is a moderator's call: `manage:comments` on the
  page, never the author's. Placeholders are not counted on the Talk badge.
- **Markdown is rendered in the browser, at display time**, by `frontend/src/renderers/comment.js` —
  a second, much smaller renderer than the page pipeline. `html: false` is the whole security
  boundary: markdown-it escapes every `<` it is given, so nothing stored is ever HTML and no
  sanitizer's older rules can be served back. No headings, no images, no tables; every link leaves
  with `rel="nofollow ugc noopener"`. Rendering at display rather than at write is also what lets a
  mention re-resolve instead of freezing whatever a handle pointed at on the day it was written.
- **A mention is `@handle`**, and `users.handle` is a column with a unique index on `lower(handle)` —
  `@ana` means one person or it means nothing. It is null until somebody picks one, and a user without
  one is simply not mentionable; nothing is derived from a display name on anybody's behalf. It is
  edited under **Profile → Info** and is NOT gated on `allowProfileEditing`, because no identity
  provider owns a wiki mention handle. The comments endpoint resolves the handles of a whole page in
  one query and the renderer links only those, so a mention never points at whoever took the handle
  later.
- **A comment that starts a thread can annotate the article**: passages picked from it (New
  Annotation, `PageAnnotator.vue`), each with a note, posted together as one comment whose own text
  may then be empty. Rows in `commentAnnotations`, signed-in authors only. A passage is stored as a
  DESCRIPTION — its text, ~32 characters either side, the heading it sat under — never as a pointer
  into the render, and is found again in the browser against the article as drawn
  (`helpers/annotations.js`): whitespace folded, found while the exact text is still there and can be
  told apart from its other occurrences, reported lost otherwise. Highlights use the CSS Custom
  Highlight API so nothing is ever inserted into the article — which also means a highlight cannot be
  clicked: View All Annotations (`PageAnnotationsLayer.vue`) hit-tests a click against each passage's
  client rects to open its note. Resolving, reopening and deleting one
  is the author's, `review:pages`' or `manage:comments`'; rewriting its note follows the comment's
  own edit rule. Deleting the last annotation of a comment with no text of its own deletes the
  comment too, in the same transaction and the same way its author would (`removeAnnotation`).
- **The Talk tab is for the built-in provider alone.** `Article` / `Talk` above the content, as on
  Wikipedia, with a count badge that comes with the page (`commentsCount` on the page payload) rather
  than with the comments — it has to be there before the tab is opened. Every other provider draws
  itself under the article instead. Both respect the page's own `allowComments`, which is the switch
  in its properties dialog.

**Configuration lives in the site's config blob** under `comments` — `provider` plus a `providers` map
keyed by module — for the same reasons the analytics configuration does. The settings of the providers
that are not in use are kept, so trying another one and coming back finds a form still filled in.

**Three settings, and they answer different questions.** `features.comments` (**General → Features**,
on by default) is whether the site has comments at all; `comments.provider` is which one handles them;
and a page's own `allowComments` (its properties dialog) is whether this page takes them. Enabling and
disabling is General's job alone — **the Comments screen only picks which provider**, which is why it
offers a radio per provider and no way to choose none. A site starts on the built-in provider, so a
wiki with comments switched on has somewhere for them to go without anybody choosing first.

The master switch is checked by `comments.isAllowed`, which `publicConfigFor` and `usesBuiltIn` both go
through — and deliberately NOT by `selectedProvider`, which the admin screen reads to show what is
selected: a screen reporting "no provider in use" because the master switch is off would then save that
back as the truth. It says so in a banner instead. `selectedProvider` still answers empty for a stored
key whose module has been dropped from the installation, which is the one case the screen cannot
produce and has to describe.
