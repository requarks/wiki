# Import from XWiki

**Status:** implemented — **Administration → Utilities → Import from XWiki**. Built against XWiki
17.10's own XARs (the Help and Sandbox applications, which carry real XWiki 2.1 pages, nested spaces,
translations and attachments) and a synthetic backup XAR with history, comments, annotations, tags and
user profiles. The RCS history reader has not yet met an archive written by XWiki itself.

The flow is the [DokuWiki import](./dokuwiki-import.md)'s, itself the
[Confluence import](./confluence-import.md)'s: nothing is uploaded as a file. The browser opens the XAR,
decides every path, and drives the import session routes (`api/import.ts`) a batch at a time. A
session is opened with `source: 'xwiki'`, and its site streams are written by `models/importXwiki.ts`.

| Piece | File |
| --- | --- |
| Overlay | `frontend/src/components/ImportXwikiOverlay.vue` |
| Reading the XAR, the XML, the history archive | `frontend/src/helpers/xwikiSource.js` |
| Planning paths, driving the session | `frontend/src/helpers/xwikiImport.js` |
| Writing the streams | `backend/models/importXwiki.ts` |
| XWiki syntax → HTML, reference resolution | `backend/helpers/xwikiSyntax.ts` |
| HTML → markdown (shared) | `backend/helpers/htmlToMarkdown.ts` |
| Index, folders, files, author matching (shared) | `backend/models/import.ts` |

---

## 1. The source

A XAR is a ZIP of XML files, one per document and per translation:

```
package.xml                      <package><infos><name/>…</infos><files>…</files></package>
<Space>/<Sub>/<Page>.xml         <xwikidoc reference="Space.Sub.Page" locale=""> … </xwikidoc>
<Space>/<Page>.<locale>.xml      a translation: <translation>1</translation>
```

An `<xwikidoc>` holds the document's fields (`title`, `syntaxId`, `hidden`, `author`, `contentAuthor`,
`creationDate` and `date` in epoch milliseconds, `version`, `comment`), its `<content>`, its
`<attachment>`s with their bytes in base64, its `<object>`s, and — in an export with history — a
`<versions>` element holding an RCS archive of every version's own `<xwikidoc>`.

- **XWiki writes XML 1.1**, so that control characters can be `&#1;`. An XML 1.0 parser (the
  browser's `DOMParser`) refuses such a file whole, so `xwikiSource.js` has a small reader of its own.
- **A reference** is `wiki:Space.Sub.Page` with `\.`, `\:`, `\@`, `\\` escapes. The wiki is dropped,
  and both sides spell a document as `referenceKey` does (only `\` and `.` escaped) — the index the
  browser uploads is looked up by what the converter asks for.
- **The history archive**: the head version is whole; an older one is either whole (state `full`,
  kept every few versions) or an RCS edit script (state `diff`) that turns the version after it into it
  — `dL N` deletes, `aL N` adds the N lines that follow, line numbers counted in the newer text. A
  state XWiki did not write is told by looking: a whole version is XML.
- **Objects that matter**: `XWiki.XWikiComments` (`author`, `comment`, `date` as `yyyy-MM-dd
  HH:mm:ss.S` in the server's zone, `replyto` as an object number, and for an annotation `selection`,
  `selectionLeftContext`, `selectionRightContext`), `XWiki.TagClass` (`tags`, a list), and
  `XWiki.XWikiUsers` (`first_name`, `last_name`, `email`) on a user's profile document.

## 2. Decisions

| Question | Answer |
| --- | --- |
| What goes | Spaces at the top, ticked in the overlay. `XWiki`, `Help` and `Sandbox`, and any space holding nothing but hidden documents, start unticked. |
| Not documents | Translations (the default language only comes over), `WebPreferences`, user profiles (read as the people), group documents. Each is counted in the log. |
| Hidden | A document marked hidden, or carrying a class definition or an object of the wiki's machinery (a skin, a stylesheet, a UI extension, a wiki macro…), is left out unless **Include hidden pages** is on. |
| Where | Under one path for the whole wiki, empty for the site root. |
| Spaces | A folder each, named after the space and titled after its `WebHome`. The `WebHome` is the page AT the folder. |
| Home | `Main.WebHome` is the site's home page, or the page at the prefix. The rest of `Main` is in a `main` folder. |
| Page names | `pathSegmentFromTitle` of the document's name, `-2`, `-3`… on a collision — a page or a space. A name already a segment as it stands keeps it. |
| Title | The document's title, unless it is a script (`$…`, `#…`); otherwise its name, or its space's for a `WebHome`. A first heading saying the same as the title is dropped from the body. |
| Authors | Users (`XWiki.jdoe`), mapped in the overlay onto accounts here, pre-matched by the email of their profile. The guest, and a comment signed with a bare name, are the importer. |
| History | Every version but the current one, rebuilt out of `<versions>`, each with its own title, author, date and comment. A version that cannot be rebuilt costs its page's history, which is counted. |
| Attachments | Latest version, in the folder of the page they are on: the space's folder for a `WebHome`, a folder at the page's own path otherwise. |
| Comments | `XWiki.XWikiComments`. A reply to a reply names its thread, since replies are one level deep here. An annotation becomes an annotation of its passage: the comment empty and the passage carrying the note. |
| Tags | `XWiki.TagClass`. |
| Rights | Not imported; the log says so before anything is written. |
| Format | The session's `htmlConversion`: markdown under the visual editor (default), or HTML under the markdown editor. A page in `markdown/1.x` is stored as it is, under the same editor. |
| Re-running | Pages are matched by path; versions keyed by `<doc>@<version>` and comments by `<doc>#<number>`, derived in a namespace of the prefix and the target site, so a second run upserts. |

## 3. The syntax

`xwikiSyntax.ts` lifts out `~` escapes, `{{{verbatim}}}` and macros in one left-to-right pass, then
reads lines for the block syntax and substitutes for the inline syntax. It writes HTML, which
`htmlToMarkdown` escapes for the wiki's markdown. A macro or a verbatim block standing alone on its
lines is a block; anywhere else it is inline. XWiki Syntax 2.0 and 2.1 are read alike.

| XWiki | Here |
| --- | --- |
| `**b**` `//i//` `--s--` `##m##` `^^sup^^` `,,sub,,` | bold, italic, strikethrough, code, `^sup^`, `~sub~` |
| `__u__` | dropped to its text |
| `= H =` to `====== H ======` | `#` to `######` |
| `*`, `1.`, `1*.` lists | the marker is the item's whole path; a jump of two levels gets an empty item between |
| `; term` / `: definition` | the term in bold, its definitions under it a line each |
| `\|=` / `!=` header, `\|` / `!!` cell | a table; a header row on top becomes the head; a line that starts no block goes on in the last cell |
| `>` quotes, `----`, a newline, `\\` | the same; a newline in a paragraph is a line break, as in XWiki |
| `(((…)))` groups | their content; inside a line (a cell) in a `<div>` |
| `(% … %)` parameters | dropped |
| `[[label>>reference\|\|anchor="H…"]]`, untyped, `doc:`, `space:`, `page:` | a link to the page here — see below |
| `attach:`, `pageAttach:`, `image:`, `[[image:…\|\|width=…]]` | a link to the file, or an image sized by its width |
| `url:`, `mailto:`, bare URLs | the same |
| `interwiki:`, `unc:`, `path:` | the label kept, counted |
| `{{code language}}`, `{{{…}}}` | fenced code; inline code |
| `{{info}}` `{{success}}` `{{warning}}` `{{error}}` | alerts, with their `title` |
| `{{box}}`, `{{expand}}` | a quote; a `<details>` |
| `{{html}}` | kept as HTML |
| `{{toc}}`, `{{id}}`, `{{comment}}` | dropped |
| `{{footnote}}`, `{{putFootnotes}}` | `[^n]`, at the end |
| `{{children}}`, `{{documentTree root}}` | `::block-index` of that folder |
| `{{include}}`, `{{display}}` | a link to the page, counted |
| `{{mention}}` | `@Name`, from the user's profile |
| `{{office}}`, `{{pdfviewer}}`, `{{video}}` | a link to the attachment |
| `{{formula}}`, `{{mathjax}}`, `{{markdown}}`, `{{mermaid}}`, `{{plantuml}}` | a code block of that language; the first three counted |
| `{{velocity}}`, `{{groovy}}`, `{{liveData}}`, `{{activity}}`… | dropped and counted |
| any other macro | a line naming it, and counted |
| `xhtml/1.0` | kept as HTML |
| `plain/1.0` | paragraphs |
| `xwiki/1.0` and anything else | kept as text in a code block, counted |

**References resolve as XWiki resolves them.** An untyped `[[A]]` is the terminal page `A` in the
current space if it exists, then the nested page `A` there; from a nested page (a `WebHome`), the same
two as siblings follow, the last regardless of whether it exists. Two or more names (`[[A.B]]`) are
absolute: the terminal page, then the nested one. `page:` is slash-separated, `./` under the current
page and `../` beside it. Each candidate is asked of the index in order, so a body is converted twice:
once against a resolver that records every key asked for (`collectXwikiRefs`), so a batch is looked
up in one query per kind, and once for real. A page that is in no candidate points where it would be
— the nearest known space's folder plus the rest of its names — and is counted as `missingPages`.

## 4. Known gaps

- Translations are not imported; a site here has one locale per page path.
- A section link to another page loses its section: XWiki's anchor (`HMyheading`) cannot be turned
  back into the heading it was made from without that page's text. Within a page it is kept.
- `{{velocity}}` and the other script macros are dropped, and with them anything they wrapped. A page
  left with nothing is given a listing of its children, or a line saying it was empty.
- An application entry (an AppWithinMinutes record) keeps its content, which is usually empty: its
  data lives in an object, drawn by a sheet.
- An attachment's earlier versions are not imported; a file here has one.
- A comment's date is read in the importing browser's time zone, since XWiki does not write one.
- XWiki 1.0 syntax is not converted.
- Markdown pages keep XWiki references in their links as written.
