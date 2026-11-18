# Import from Confluence

**Status:** implemented — **Administration → Utilities → Import from Confluence**. Built against two
real backups of the same Confluence Cloud site (November 2026), one in each format below; what is
written here about the formats was read off those files, not out of Atlassian's documentation, which
does not describe them.

The flow is the [`.wkbackup` import](./wkbackup.md)'s: the backup is never uploaded as a file. The
browser opens it, reads it, and drives the import session routes (`api/import.ts`) a batch at a time,
reporting into a progress log. A session is opened with `source: 'confluence'`, and every site stream
of such a session is written by `models/importConfluence.ts` rather than by the 2.x reader.

| Piece | File |
| --- | --- |
| Overlay | `frontend/src/components/ImportConfluenceOverlay.vue` |
| Reading a backup (both formats → one index) | `frontend/src/helpers/confluenceBackup.js` |
| Planning paths, driving the session | `frontend/src/helpers/confluenceImport.js` |
| Writing the streams | `backend/models/importConfluence.ts` |
| Storage format → HTML | `backend/helpers/confluenceStorage.ts` |
| HTML → markdown (shared) | `backend/helpers/htmlToMarkdown.ts` |

---

## 1. The two formats

Both are a ZIP of a whole site — every space — made under **Backup manager** in Confluence Cloud's
admin, at most **one backup per 24 hours**.

### CSV — "Create backup for cloud"

Cloud's format from now on. Atlassian ends support for the XML export on **1 December 2026** (it
keeps working, without fixes) and recommends this one.

```
metadata.json                 cloudId, backupId, …
data/<table>.csv.gz           one gzipped CSV per database table, PostgreSQL COPY … CSV
attachments/<FILESTORE_ID>    every attachment, by its file-store id
```

The tables read: `content` (every page, folder, comment, attachment, and every OLD VERSION of each),
`bodycontent`, `spaces`, `contentproperties`, `label`, `content_label`, `user_mapping`.

- **Bodies are base64 zstd** — most of them, not all: a body starting `KLUv/` (zstd's magic number,
  base64-encoded) is compressed, anything else is plain. The browser has no zstd decoder and none is
  bundled; the body is posted as it is (`bodyEncoding: 'zstd'`) and the server inflates it with Node's
  own `zlib.zstdDecompressSync`.
- **No email addresses and no names.** `user_mapping` is account ids and nothing else. The only name
  in the whole backup is a personal space's `spacename`, which is its owner's display name.
- `bodytypeid` 2 is the storage format; 0 and 1 are plain text and a property's JSON.

### XML — "Create backup for server", and every Data Center export

```
exportDescriptor.properties   source=cloud|server, buildNumber, …
entities.xml                  every row as a Hibernate <object>, in no useful order
attachments/<page id>/<attachment id>/<version>
```

- `entities.xml` is one file of every object, which on a real wiki is gigabytes. It is streamed by a
  reader written for its one shape (`readXmlObjects`): `<object class>`, its `<id>`, `<property>`
  (a value, or a reference when it has a `class`), `<collection>` of `<element><id>`.
- **Users have addresses.** `InternalUser` carries `displayName` and `emailAddress`, joined to the
  `ConfluenceUserImpl` key content points at by `externalId` (Cloud: the account id) or by user name
  (Data Center).
- A content property is owned through its content's `contentProperties` collection rather than
  pointing back, the opposite of the CSV's `contentid` column.
- Dates carry no offset; they are UTC (they match the CSV's `+00` values exactly).

### What both mean

Read into one index (`readIndex`), so nothing after `confluenceBackup.js` asks which format it was:

- **An old version is a row of its own**, `status` current, pointing at the current page through
  `prevver` / `originalVersion`, with its own `version`, author and date.
- **A draft is a row with `status: draft`**: an unpublished edit of a published page (with
  `prevver`), or a page never published (without). Both are private to their author in Confluence.
- **A folder** is `contenttype FOLDER` (CSV) or a `Page` with `isFolder` (XML); **a Smart Link embed**
  is `EMBED` / `isEmbed`, with no body and no URL anywhere in the backup.
- **A comment** is on `pageid` / `containerContent`, a reply to `parentcommentid` / `parent`. An inline
  comment carries the properties `inline-comment`, `inline-marker-ref` and `inline-original-selection`
  (cut at ~250 characters and ended with ` ...`); the page body marks the passage with
  `<ac:inline-comment-marker ac:ref="…">`.
- **Labels** in the `global` namespace are what people typed. The rest — `my:favourite`, `team`, a
  blueprint's `blueprint-index-page` — are Confluence's bookkeeping.

---

## 2. Decisions

| Question | Answer |
| --- | --- |
| Which formats | Both, detected from what is in the ZIP. |
| Where a space goes | Under a path prefix per space, the space key by default (a personal space's owner name), editable; empty is the site root. Its home page is the page AT the prefix (`home` at the root). |
| Authors | The operator maps each one onto an account here, in the overlay. An XML backup's are pre-matched by email (`POST /import/match-users`). Anybody left unmapped is attributed to whoever runs the import. The mapping is the session's `user` id map, which `authorFor` already resolves through. |
| Blog posts | Not imported (counted). Blog posts could not be created on the test site, so there was nothing to build against. |
| Drafts | Not imported (counted): private in Confluence, while an unpublished page here is visible to every editor. |
| Permissions and restrictions | Not imported; the log says so before anything is written. |
| Format | The session's `htmlConversion`, as for 2.x: markdown under the visual editor (default), or the HTML under the markdown editor. Comments are always markdown. |

### Who decides what

**The browser decides paths; the server decides content.** A path needs the whole tree — ancestors'
titles, siblings' for a collision — which the browser has from its first pass. Content needs cheerio,
Turndown and zstd, which only the server has. So:

1. The browser posts an **index** (`index` stream → `importRefs` rows): every page by space and title
   and by id, every attachment by page and file name, every named person, every space's path.
2. Each batch of bodies is converted with only the keys it mentions looked up — one query per kind.
3. Inline comment markers are described as annotation anchors while their page is converted, and kept
   as `anchor` rows for the comments stream, which never sees the page body.

### Paths

- A segment is `pathSegmentFromTitle(title)`, or `page-<id>` / `folder-<id>` for a title with no
  letter or digit. Siblings — pages and folders together — are told apart with `-2`, `-3`… in
  Confluence's own order (`child_position`, then id). At the site root a name the app owns
  (`isPagePath`) counts as taken, and so does every prefix's own segment.
- A folder is created with a title for every Confluence folder, every page with children or
  attachments, and every prefix.
- Attachments go in the folder of their page, latest version only, named by `sanitizeFileName` — the
  same function the link to them is written with.

---

## 3. The storage format

`confluenceStorage.ts` rewrites every `ac:` / `ri:` element into HTML before `htmlToMarkdown` sees
it. Parsed with htmlparser2 in HTML mode (`recognizeCDATA`, `recognizeSelfClosing`), since Confluence
writes HTML entities into its "XHTML".

| Confluence | Here |
| --- | --- |
| `code`, `noformat` | fenced code with its language |
| `info` / `tip` / `note` / `warning` / `panel` | `> [!NOTE]` / `[!TIP]` / `[!WARNING]` / `[!CAUTION]` / `[!NOTE]` — Confluence's `note` is its YELLOW box |
| ADF `panel` (cloud editor) | by `panel-type`: info, note → important, success, warning, error → caution |
| `expand` | `<details><summary>`, body as markdown |
| ADF tabs (`multi-bodied-extension`, `native-tabs`) | `::block-tabs` / `::block-tab{label}` |
| `status` | `:block-badge[Title]{color}`, Confluence's colours onto the theme tones |
| `children`, `pagetree` | `::block-index{path}` of the page's (the space's) children |
| `contentbylabel`, `content-report-table`, `detailssummary` | `::block-index{tags}` of their labels — a blueprint's index page is one of these |
| task lists | `- [ ]` / `- [x]` |
| `ac:image` | an image, sized with `markdown-it-imsize`'s `=Wx` |
| `ac:link` to a page / attachment / space / heading | a link to its path here; `ac:anchor` through `slugifyHeading` |
| `ri:user` mention | `@Name` as text — a mention here is `@handle` and is resolved at display |
| emoticons | the character: `emoji-id`'s codepoint, the fallback, or a short table of Atlassian's names |
| `<time>` | the date as text — a calendar date, not a moment to shift by timezone |
| layouts | unwrapped, top to bottom |
| `toc`, `recently-updated`, `blog-posts`, `create-from-template`, reports… | dropped and counted: what they showed was computed |
| anything else | a line naming the macro where it stood, and counted |

The four markdown forms that are the inverse of a render — alert, `<details>`, inline blocks, tabs, the
index, image size — are rules in the shared `htmlToMarkdown`, so an agent reading a page's render
through MCP gets them too. A page left with nothing readable (only a dropped macro) becomes an index of
its children, or says it was empty; a page here cannot be.

---

## 4. Known gaps

- A resolved inline comment imports as open — no resolution state was found in either backup.
- An attachment's earlier versions are not imported; a file here has one.
- An `ac:anchor` to a custom anchor macro (rather than a heading) points at a heading that is not
  there; the link still reaches the page.
- Page likes, watchers and page restrictions are not imported.
