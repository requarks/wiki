# Import from DokuWiki

**Status:** implemented — **Administration → Utilities → Import from DokuWiki**. Built against a
synthetic data directory laid out as DokuWiki writes one (namespaces, start pages, attic, changelogs,
media, `users.auth.php`, interwiki map), not yet against a real installation.

The flow is the [Confluence import](./confluence-import.md)'s: nothing is uploaded as a file. The
browser opens the source, decides every path, and drives the import session routes (`api/import.ts`)
a batch at a time. A session is opened with `source: 'dokuwiki'`, and its site streams are written by
`models/importDokuwiki.ts`.

| Piece | File |
| --- | --- |
| Overlay | `frontend/src/components/ImportDokuwikiOverlay.vue` |
| Reading the data directory | `frontend/src/helpers/dokuwikiSource.js` |
| Planning paths, driving the session | `frontend/src/helpers/dokuwikiImport.js` |
| Writing the streams | `backend/models/importDokuwiki.ts` |
| DokuWiki syntax → HTML | `backend/helpers/dokuwikiSyntax.ts` |
| HTML → markdown (shared) | `backend/helpers/htmlToMarkdown.ts` |
| Index, folders, files, author matching (shared with Confluence) | `backend/models/import.ts` |

---

## 1. The source

DokuWiki keeps everything in files, so there is no export to make. The operator hands over a ZIP of
the data directory (or of the whole install), or picks the folder itself.

```
data/pages/<ns>/<page>.txt              current text
data/attic/<ns>/<page>.<rev>.txt.gz     every revision, the current one included (or .txt, or .bz2)
data/meta/<ns>/<page>.changes           date \t ip \t type \t id \t user \t summary \t extra \t size
data/media/<ns>/<file>                  current media
data/media_meta/<ns>/<file>.changes     the same log, for a file
conf/users.auth.php                     login:hash:name:email:groups (`\:` escapes a colon)
conf/interwiki.conf, .local.conf        shortcut → URL template
conf/local.php                          $conf['start'], $conf['title']
```

- An id is the file path with `/` as `:`. The default `fnencode` (`url`) percent-encodes non-ASCII
  names; they are decoded. The `safe` encoding is not.
- `_template.txt` / `__template.txt` are the namespace templates, not pages (no id can start with `_`).
- `.changes` `type` is `C` create, `E` edit, `e` minor, `D` delete, `R` revert. A page whose log ends in
  `D` and has no file is deleted, and is counted, not imported.

## 2. Decisions

| Question | Answer |
| --- | --- |
| What goes | Namespaces at the top, ticked in the overlay, plus the root's own pages. `wiki` and `playground` start unticked when they hold nothing but DokuWiki's sample pages. |
| Where | Under one path for the whole wiki, empty for the site root. The root start page is the home page, or the page at that path. |
| Namespaces | A folder each, named after the namespace and titled after its start page. The start page is the page AT the folder: `ns:start`, then `ns:ns`, then the page `ns` beside the namespace. |
| Page names | `pathSegmentFromTitle` of the id's last part, `-2`, `-3`… on a collision — a page or a namespace. A page whose name is already a segment as it stands keeps it. |
| Title | The first heading (what DokuWiki's `useheading` takes), dropped from the body when it opens the page; otherwise the name as words. |
| Authors | Logins, mapped in the overlay onto accounts here, pre-matched by email from `users.auth.php`. Anonymous edits and unmapped logins are the importer's. |
| History | Every attic revision but the current one, with its author and summary from `.changes`. bzip2 revisions are counted, not read. |
| Media | Latest version, in the folder of its namespace, under its own name. |
| Tags | The tag plugin's `{{tag>…}}`. |
| ACLs | Not imported; the log says so before anything is written. |
| Format | The session's `htmlConversion`: markdown under the visual editor (default), or HTML under the markdown editor. |
| Re-running | Pages are matched by path, revisions by an id derived from `<page id>@<rev>` in a namespace of the target path and site, so a second run skips (or, with Overwrite, replaces) and never duplicates. |

## 3. The syntax

`dokuwikiSyntax.ts` reads lines for the block syntax and substitutes for the inline syntax, with
anything that must not be looked inside lifted out into slots first. It writes HTML, which
`htmlToMarkdown` escapes for the wiki's markdown — a single newline, `[[`, `<x>` and `:x:` all mean
something there that they did not in DokuWiki.

| DokuWiki | Here |
| --- | --- |
| `**b**` `//i//` `''m''` `<del>` `<sub>` `<sup>` | bold, italic, code, strikethrough, `~sub~`, `^sup^` |
| `__u__` | dropped to its text (markdown has no underline the visual editor keeps) |
| `====== H ======` (6 to 2 `=`) | `#` to `#####` |
| lists (indent ÷ 2, `*` / `-`), `>` quotes, `----` | the same |
| tables, `^` header, `\|\|` colspan, `:::` rowspan, alignment by spaces | a markdown table; a merged cell is written once and the cells it covered left empty |
| `<code lang file>`, `<file>`, indented lines | fenced code, the file name above it |
| `%%…%%`, `<nowiki>` | literal text |
| `<html>` / `<HTML>` | kept as HTML; `<php>` becomes code and is counted |
| `[[id\|label]]`, `[[id#section]]`, `[[ns:]]`, `.:` / `..:` | a link to the path here; a section through `slugifyHeading` |
| `[[wp>Page]]` | through the wiki's interwiki map; an unknown shortcut keeps its text |
| `{{id?200x100\|caption}}` | an image sized with `=Wx`, or a link for a non-image |
| `((footnote))` | `[^n]` |
| `<WRAP info>`, `<note warning>` | alerts; a layout-only `WRAP` is unwrapped |
| `{{indexmenu>ns}}`, `nspages`, `simplenavi`, `catlist` | `::block-index{path}` of the namespace's folder |
| `{{topic>ns?tag +tag2 -tag3&flags}}` | `::block-index{tags}` over every level of the namespace's folder (the site for none, `*` or `:`), every `+tag` asked of it; the `&` flags are dropped |
| `~~NOTOC~~`, `~~NOCACHE~~` | dropped |
| `{{changes>}}`, `backlinks`, `rss`, `~~DISCUSSION~~`… | dropped and counted (an `rss` feed keeps its address) |
| any other `{{plugin>…}}` | a line naming the plugin, and counted |
| `->`, `<=>`, `(c)`… | the characters, as DokuWiki's typography draws them |

## 4. Known gaps

- Comments (the discussion plugin) are not imported.
- A media file's earlier versions (`media_attic`) are not imported; a file here has one.
- `fnencode = safe` names are kept as spelt.
- `.txt` media is refused on a site where `txt` is a page extension (the default); each is reported.
- Two media names that sanitise to the same file (`a_b.png`, `a-b.png`) keep the first; the second is
  skipped.
- A topic listing of several plain tags (any of them) becomes one index per tag, since an index lists
  the pages carrying all of its tags; a `-tag` (none of them) is dropped, so those pages are listed.
- A link's text, when written without a label, is the target's title, as with `useheading` on.
