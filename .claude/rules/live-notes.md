---
paths:
  - "backend/models/liveNotes.ts"
  - "backend/api/liveNotes.ts"
  - "backend/core/collab.ts"
  - "frontend/src/pages/LiveNote.vue"
  - "frontend/src/pages/ProfileLiveNotes.vue"
  - "frontend/src/layouts/LiveNoteLayout.vue"
  - "frontend/src/components/LiveNote*.vue"
  - "frontend/src/stores/liveNote.js"
  - "frontend/src/components/EditorMarkdown.vue"
---

# Live notes

A markdown scratch document written together in real time at `/n/<key>` (HedgeDoc-style), by whoever
holds the URL and may use notes on the site. `models/liveNotes.ts`, `api/liveNotes.ts`, the note room in
`core/collab.ts`; on the frontend `pages/LiveNote.vue`, `stores/liveNote.js`, and `EditorMarkdown.vue`
under its `noteKey` prop. The site switch is `features.liveNotes` (on by default), which also needs
`collaborativeEditing`.

- **Two permissions bound everything else**: `read:notes` to open a note and follow it live, and
  `write:notes` to create one, write in one, and own one (see [Permissions](../../CLAUDE.md#permissions)). The
  frontend learns them from `GET /sites/:siteId/notes/_access` (`liveNoteStore.ensureAccess`) — `_`
  because `access` is a key somebody could pick. A guest holding `read:notes` reads through the same
  routes and joins the room as a reader, with no awareness state of its own (every guest shares one
  placeholder id); a guest is never handed the Editor, Publish to Page, or an image upload.

- **Not a page.** No tree entry, no path for a page rule to match, no render, no save. The key is the credential: 24
  characters from `crypto` (~143 bits) for a note made at `/n`, or whatever somebody typed — visiting
  `/n/<key>` for a key no note on the site has yet creates one under it (1–64 of `[A-Za-z0-9-]`,
  case-sensitive, unique per site; `KEY_PATTERN`, mirrored as `NOTE_KEY_PATTERN` in
  `stores/liveNote.js`). Only a navigation creates, and only for somebody holding `write:notes` — anybody
  else is told there is no such note: a note deleted under its readers reloads as gone.
  Either way it never goes in a log or an audit entry (record `noteId`), nor in
  any listing but its creator's own: **Profile → My Live Notes** (`GET /sites/:siteId/notes`,
  `liveNotes.listByCreator`) lists only the notes the caller created, whose keys they already hold. Beyond the key, `liveNotes.rightsFor` is the only thing that decides access. Owners (the
  creator while they hold `write:notes`, plus `manage:system`) can always do everything, and everybody
  else gets what `access` allows (`editable` / `locked` / `private`) within their own `read:notes` /
  `write:notes`. Every route and the socket ask it; nothing works it out for itself.
- **The collaboration room is the storage.** A note room (id `note:<noteId>`) persists its Yjs
  document through `liveNotes.persist`: 2s after the last edit, at least every 10s while typing goes
  on, and once more when it closes. It writes under the row lock and merges into what is stored,
  because several instances may each hold the note open. `state` is the Yjs document itself, never
  re-seeded from text, so a client that reconnects with offline edits merges into the same document
  instead of duplicating it. `content` and `title` are derived from `state` on every write.
  `titleOf` (backend) and `noteTitleOf` (`stores/liveNote.js`) must agree.
- **An untouched note is deleted after a day** (`liveNotes.purgeUntouched`, hourly off
  `SYSTEM_SCHEDULE`): empty content, no revision, and `updatedAt` older than
  `UNTOUCHED_NOTE_TTL_HOURS`. Only typing moves `updatedAt`, so opening a note does not keep it, and a
  note written and then cleared keeps its history and is not touched.
- **Revisions** are whole copies, taken at most every `REVISION_INTERVAL_MS` (5 min) and when the last
  participant leaves, and only when the content changed.
- **Deleting a note or changing its access doesn't reach open rooms by itself.** The route calls
  `collab.noteDeleted` / `collab.noteAccessChanged`, which disconnect people on every instance.
- **Images** are uploaded the moment they are pasted, dropped or picked (`liveNotes.addImage`): into
  the root folder `NOTE_IMAGES_FOLDER` (`n`) as `/_files/n/<uuid>.<ext>`, as ordinary assets, so
  every storage target gets them. The type is read from the bytes (PNG, JPEG, GIF, WebP, SVG) and SVG
  goes through `uploadScanSVG`. `groups.checkAccess` says no to every page permission under `n/` for
  everybody, which is what hides it from the File Manager and every API. `/_files/` serves it to
  anybody holding `read:notes` on the site instead, guests included, and the tree refuses `n` as a new root name. `liveNoteImages` lists each
  note's images, and `liveNotes.delete` removes them with the note. The images are kept until then,
  even after the text stops showing them, because a revision may still use them.
- **Publish to Page** (`publishToPage` in `LiveNote.vue`) makes a page of a note in the browser, with
  no route of its own: the note's `content` minus its opening H1 (the page's title instead), its
  images COPIED out of `n/` to where a pasted image would go — the note and its revisions keep the
  originals — rendered for the destination and posted to `POST /pages`. The note is left as it was.
