/**
 * The pages the admin area's **Generate Sample Content** writes, and the tag it puts on them.
 *
 * Content rather than code: a development instance starts empty, and checking a stylesheet, a
 * renderer or the navigation against it means writing dummy pages by hand first. This is that
 * writing, done once.
 *
 * **Loaded on demand.** `AdminUtilities.vue` imports this dynamically, so the whole set sits in a
 * chunk nobody fetches unless they press the button.
 *
 * Generated here rather than on the server for one reason: a page stores the HTML its editor produced,
 * and the only markdown renderer this project has is the one in `renderers/markdown.js`, which runs in
 * a browser. Rendering server-side means driving a headless browser through the Puppeteer extension,
 * which a plain checkout does not install — so a backend generator would write pages that are blank
 * until somebody re-renders them, which is precisely the opposite of the point.
 *
 * Paths are absolute from the site root, and the folders in them are created by the tree as each page
 * lands. Links between the pages are written the same way, which is what makes the set navigable.
 */

/**
 * The tag every page here carries, and the only thing the purge looks for.
 *
 * **Also written in `backend/api/system.ts`** as `SAMPLE_CONTENT_TAG`, since the three workspaces
 * share no package. Changing one without the other leaves content nothing will clean up.
 */
export const SAMPLE_CONTENT_TAG = 'test'

/**
 * @typedef {object} SamplePage
 * @property {string} path Absolute from the site root, without a leading slash.
 * @property {string} title
 * @property {string} description
 * @property {string} icon An Iconify reference, materialized before the pages are written.
 * @property {string[]} tags Beside {@link SAMPLE_CONTENT_TAG}, which is added to every page.
 * @property {string} content Markdown source. The render is produced from it at generation time.
 */

/** @type {SamplePage[]} */
export const SAMPLE_PAGES = [
  {
    path: 'sample/home',
    title: 'Sample Content',
    description: 'A tour of everything a page can do in this wiki.',
    icon: 'mdi:book-open-variant',
    tags: ['guide'],
    content: `# Sample Content

Every page under here was written by **Generate Sample Content** in the admin area's Utilities
page. It exists so a fresh instance has something to look at — formatting to check a stylesheet
against, blocks to check a renderer against, and a folder tree deep enough to exercise navigation.

> [!NOTE] Everything here is disposable
> Every one of these pages carries the \`test\` tag. **Purge Sample Content**, on the same Utilities
> page, deletes exactly those and nothing else.

## Formatting

How the markdown renderer draws the ordinary things.

- [Text Formatting](/sample/formatting/text) — headings, emphasis, and the inline marks
- [Lists and Tasks](/sample/formatting/lists) — bullets, numbers, definitions, checkboxes
- [Tables](/sample/formatting/tables) — alignment, spans of content, a wide one that scrolls
- [Code Blocks](/sample/formatting/code) — titles, line numbering, highlighted lines
- [Alerts and Quotes](/sample/formatting/alerts) — the five GitHub alert kinds
- [Links, Images and Footnotes](/sample/formatting/media) — how a page points elsewhere

## Blocks

The web components a page can embed. Each is a \`::block-name\` in the source.

- [Tabs](/sample/blocks/tabs)
- [Diagrams](/sample/blocks/diagrams)
- [Mathematics](/sample/blocks/math)
- [Infoboxes and Spoilers](/sample/blocks/callouts)
- [Widgets](/sample/blocks/widgets)
- [Index and Include](/sample/blocks/navigation)

## A folder tree to walk

- [Getting Started](/sample/guides/getting-started/installation) — three pages, two levels down
- [Advanced](/sample/guides/advanced/permissions) — three more beside them
- [Reference](/sample/reference/glossary) — a glossary, an API page and a changelog

## What is under here

::block-index{path="sample" depth="2" columns="2" showIcons="true"}
::
`
  },
  {
    path: 'sample/formatting/text',
    title: 'Text Formatting',
    description: 'Headings, emphasis, and every inline mark the renderer understands.',
    icon: 'mdi:format-text',
    tags: ['formatting'],
    content: `# Text Formatting

The first heading on a page is its title in the table of contents; everything below nests under it.

## Second level

### Third level

#### Fourth level

Regular text, with *emphasis*, **strong emphasis**, ***both at once***, ~~struck through~~ and
\`inline code\`. The renderer also draws ==highlighted text==, H~2~O as a subscript and E=mc^2^ as a
superscript.

Typography is applied where it is turned on: "quotes" become curly ones, -- becomes an en dash,
--- an em dash, and ... an ellipsis.

## Abbreviations

The HTML spec is what a browser implements, and CSS is what it paints with.

*[HTML]: HyperText Markup Language
*[CSS]: Cascading Style Sheets

## A horizontal rule

---

## Line breaks

A paragraph is separated by a blank line.
This line follows a single newline, which is a break only where the editor has soft breaks on.

## See also

- [Lists and Tasks](/sample/formatting/lists)
- [Alerts and Quotes](/sample/formatting/alerts)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/formatting/lists',
    title: 'Lists and Tasks',
    description: 'Bulleted, numbered, nested, definition and task lists.',
    icon: 'mdi:format-list-bulleted',
    tags: ['formatting'],
    content: `# Lists and Tasks

## Bulleted

- A first item
- A second item
  - Nested one level
  - And another
    - Two levels down
- Back to the top level

## Numbered

1. Install the wiki
2. Configure a storage target
3. Write a page
   1. Give it a title
   2. Give it some content
4. Publish it

## Tasks

- [x] Write the sample content generator
- [x] Tag every page it writes
- [ ] Decide what to have for lunch
- [ ] Purge it all again

## Definitions

Page
: A document in the wiki, addressed by its path.

Folder
: A branch of the tree. It holds pages and other folders, and is not a page itself.

Block
: A web component embedded in a page's source with \`::block-name\`.

## See also

- [Text Formatting](/sample/formatting/text)
- [Tables](/sample/formatting/tables)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/formatting/tables',
    title: 'Tables',
    description:
      'Column alignment, inline formatting inside cells, and a table wide enough to scroll.',
    icon: 'mdi:table',
    tags: ['formatting'],
    content: `# Tables

## Alignment

| Left        |   Centered   |         Right |
| :---------- | :----------: | ------------: |
| \`markdown\`  |   Default    |            42 |
| \`html\`      |   WYSIWYG    |         1,024 |
| \`asciidoc\`  |   Optional   |             7 |

## Formatting inside cells

| Setting              | Default   | What it does                                        |
| -------------------- | --------- | --------------------------------------------------- |
| **\`sitePrefix\`**     | \`false\`   | Files the tree under a folder named after the site   |
| **\`localePrefix\`**   | \`true\`    | Brackets the tree by locale                          |
| **\`largeThreshold\`** | \`10 MB\`   | The size at which a file becomes *large*             |

## A wide one

A table wider than the page scrolls inside its own box rather than stretching it.

| Target | Reads | Writes | Presigns | History | Notes                                     |
| ------ | :---: | :----: | :------: | :-----: | ----------------------------------------- |
| \`db\`   |  yes  |  yes   |    no    |   no    | Always on, cannot be turned off           |
| \`disk\` |  yes  |  yes   |    no    |   no    | The wiki's tree as files on a filesystem  |
| \`git\`  |  yes  |  yes   |    no    |   yes   | The same tree, committed and synced       |
| \`s3\`   |  yes  |  yes   |   yes    |   no    | S3 and anything speaking its API          |
| \`azure\`|  yes  |  yes   |   yes    |   no    | Azure Blob Storage                        |
| \`gcs\`  |  yes  |  yes   |   yes    |   no    | Google Cloud Storage                      |
| \`sftp\` |  yes  |  yes   |    no    |   no    | A copy, never a delivery source           |

## See also

- [Code Blocks](/sample/formatting/code)
- [Storage Targets](/sample/guides/advanced/storage)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/formatting/code',
    title: 'Code Blocks',
    description: 'Fenced code with a title, a starting line number and highlighted lines.',
    icon: 'mdi:code-braces',
    tags: ['formatting'],
    content: `# Code Blocks

A plain fence, with the language named:

\`\`\`js
const wiki = await connect()
await wiki.pages.create({ path: 'home', title: 'Home' })
\`\`\`

## With a title

\`\`\`ts title="backend/models/mail.ts"
export const mail = new Mail()
\`\`\`

## Numbered from somewhere else

Useful when the excerpt starts partway through a file.

\`\`\`ts title="api/authentication.ts" linesStart=482
app.post('/sites/:siteId/auth/verifyEmail', {
  config: { publicAccess: true },
  onRequest: limitAuthAttempts
}, async (req, reply) => {
  await WIKI.models.users.verifyUserEmail(req.body.token)
  return { ok: true }
})
\`\`\`

## With lines called out

\`\`\`js title="fetchStrategies" linesHighlight="3,6-8"
async function fetchStrategies() {
  try {
    state.strategies = await API_CLIENT.get('auth/strategies').json()
  } catch (err) {
    notify({ type: 'negative', message: err.message })
  } finally {
    state.strategiesLoaded = true
  }
}
\`\`\`

## Other languages

\`\`\`yaml title="config.yml"
port: 3000
db:
  host: db
  user: postgres
\`\`\`

\`\`\`sql
SELECT "folderPath", "fileName" FROM tree WHERE tree = 'folder';
\`\`\`

\`\`\`bash
node backend
\`\`\`

## See also

- [Tables](/sample/formatting/tables)
- [Diagrams](/sample/blocks/diagrams)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/formatting/alerts',
    title: 'Alerts and Quotes',
    description: 'The five GitHub alert kinds, and ordinary block quotes.',
    icon: 'mdi:alert-circle-outline',
    tags: ['formatting'],
    content: `# Alerts and Quotes

## The five kinds

> [!NOTE]
> Useful information a reader should take in even when skimming.

> [!TIP] Give it a title of your own
> Text after the marker replaces the label, which is how an aside says what it is about rather than
> only what kind of thing it is.

> [!IMPORTANT]
> Something the reader needs in order to succeed at what they came here to do.

> [!WARNING]
> Something that deserves immediate attention to avoid a problem.

> [!CAUTION]
> A risk of something going irreversibly wrong.

## Ordinary quotes

> A block quote is not an alert. It is somebody else's words.
>
> — Someone, probably

Quotes nest:

> The outer quote.
>
> > And one inside it.

## See also

- [Text Formatting](/sample/formatting/text)
- [Infoboxes and Spoilers](/sample/blocks/callouts)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/formatting/media',
    title: 'Links, Images and Footnotes',
    description: 'How a page points at another page, at a file, and at a note of its own.',
    icon: 'mdi:link-variant',
    tags: ['formatting'],
    content: `# Links, Images and Footnotes

## Links within the wiki

An absolute path addresses a page from the site root: [the glossary](/sample/reference/glossary),
[the permissions guide](/sample/guides/advanced/permissions), or
[three folders down](/sample/guides/getting-started/first-page).

A link can also carry a fragment, to land on a heading: [straight to the tables](/sample/formatting/tables#a-wide-one).

## Links that leave

[The Wiki.js website](https://js.wiki) is marked as external by the renderer, because it resolves to
a different origin than the page it is written on.

## Images

An image is addressed the way a file beside the page would be, and resolved at render time — so the
source stays readable if the page is ever exported to a repository.

![The wiki's own logo](/_assets/logo-wikijs.svg =120x)

## Footnotes

The storage system writes to every target that claims a content type[^write] and reads from exactly
one[^read].

[^write]: An upload goes to all of them; a write that fails anywhere fails the upload.
[^read]: \`assetDelivery.servedTypes\` names it, at most one target per type.

## See also

- [Index and Include](/sample/blocks/navigation)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/blocks/tabs',
    title: 'Tabs',
    description: 'Content split across tabbed panels.',
    icon: 'mdi:tab',
    tags: ['blocks'],
    content: `# Tabs

A set of tabs is fenced with three colons, because the panels inside it are blocks of their own.

:::block-tabs
::block-tab{label="npm"}
Install the dependencies from the workspace directory:

\`\`\`bash
npm install
\`\`\`
::

::block-tab{label="Docker"}
Or build the production image:

\`\`\`bash
docker build -f dev/build/Dockerfile -t wikijs .
\`\`\`
::

::block-tab{label="From source"}
Node 26 runs the backend's TypeScript directly, so there is no build step:

\`\`\`bash
node backend
\`\`\`
::
:::

## Tabs with icons

:::block-tabs
::block-tab{label="Linux" icon="mdi:linux"}
Everything the wiki needs is in the package manager.
::

::block-tab{label="macOS" icon="mdi:apple"}
Homebrew has Node and PostgreSQL.
::

::block-tab{label="Windows" icon="mdi:microsoft-windows"}
Use the installers, or WSL.
::
:::

## See also

- [Diagrams](/sample/blocks/diagrams)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/blocks/diagrams',
    title: 'Diagrams',
    description: 'Mermaid and Kroki, rendered in the page.',
    icon: 'mdi:sitemap-outline',
    tags: ['blocks'],
    content: `# Diagrams

## Mermaid

::block-diagram{caption="What happens when somebody registers" align="center"}
\`\`\`mermaid
flowchart TD
  A[Register form] --> B{Email validation on?}
  B -->|No| C[Signed in straight away]
  B -->|Yes| D[Account created unverified]
  D --> E[Confirmation email sent]
  E --> F[Reader presses Confirm]
  F --> G[Account verified]
  G --> H[Sign in]
\`\`\`
::

## A sequence

::block-diagram{caption="A password reset, end to end"}
\`\`\`mermaid
sequenceDiagram
  participant R as Reader
  participant W as Wiki
  participant M as Mail server
  R->>W: I forgot my password
  W->>M: Send a reset link
  W-->>R: Check your email
  M-->>R: Reset link
  R->>W: Here is my new password
  W-->>R: Done, sign in
\`\`\`
::

## Kroki

::block-kroki{type="graphviz" caption="A tiny graph"}
\`\`\`kroki
digraph G {
  rankdir=LR
  Pages -> Tree
  Pages -> Storage
  Storage -> Disk
  Storage -> Git
}
\`\`\`
::

## See also

- [Mathematics](/sample/blocks/math)
- [Code Blocks](/sample/formatting/code)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/blocks/math',
    title: 'Mathematics',
    description: 'Formulas rendered with KaTeX and MathJax.',
    icon: 'mdi:function-variant',
    tags: ['blocks'],
    content: `# Mathematics

## KaTeX

::block-katex{caption="The quadratic formula"}
\`\`\`latex
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
\`\`\`
::

::block-katex{align="left"}
\`\`\`latex
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
\`\`\`
::

## MathJax

::block-mathjax{caption="Euler's identity"}
\`\`\`latex
e^{i\\pi} + 1 = 0
\`\`\`
::

## See also

- [Diagrams](/sample/blocks/diagrams)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/blocks/callouts',
    title: 'Infoboxes and Spoilers',
    description: 'A summary box beside the text, and content hidden until it is asked for.',
    icon: 'mdi:card-text-outline',
    tags: ['blocks'],
    content: `# Infoboxes and Spoilers

## An infobox

::block-infobox{name="Wiki.js" image="/_assets/logo-wikijs.svg" imageCaption="The project logo"}
\`\`\`yaml
Written in: JavaScript and TypeScript
License: AGPL-3.0
Database: PostgreSQL 16+
Runtime: Node.js 26+
Website: https://js.wiki
\`\`\`
::

The box floats beside the text on a wide screen and stacks above it on a narrow one, so a paragraph
of ordinary content is needed to see the difference. This is that paragraph, and it goes on a little
longer than it strictly needs to for exactly that reason.

## A spoiler

::block-spoiler{label="The answer" hint="Click to reveal"}
Forty-two. The content is laid out either way and only hidden from view, so nothing below the box
moves when it opens.
::

## See also

- [Alerts and Quotes](/sample/formatting/alerts)
- [Widgets](/sample/blocks/widgets)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/blocks/widgets',
    title: 'Widgets',
    description: 'A QR code and a countdown.',
    icon: 'mdi:widgets-outline',
    tags: ['blocks'],
    content: `# Widgets

## QR code

::block-qr-code{value="https://js.wiki" size="180" caption="js.wiki"}
::

## Countdown

::block-countdown{date="2030-01-01T00:00:00Z" label="Until 2030" expiredMsg="It is 2030."}
::

## See also

- [Infoboxes and Spoilers](/sample/blocks/callouts)
- [Index and Include](/sample/blocks/navigation)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/blocks/navigation',
    title: 'Index and Include',
    description: 'Listing the pages under a folder, and pulling one page into another.',
    icon: 'mdi:file-tree-outline',
    tags: ['blocks'],
    content: `# Index and Include

## An index of a folder

Everything filed under the guides, two levels deep:

::block-index{path="sample/guides" depth="2" columns="2" showIcons="true"}
::

## An index by tag

Every page in this sample set carries the \`test\` tag, which is also what the purge action looks for:

::block-index{tags="blocks" limit="10" orderBy="title"}
::

## Including another page

The glossary, rendered inside this one:

::block-include{path="sample/reference/glossary" showTitle="true"}
::

## See also

- [Links, Images and Footnotes](/sample/formatting/media)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/guides/getting-started/installation',
    title: 'Installation',
    description: 'What the wiki needs before it will start.',
    icon: 'mdi:download',
    tags: ['guide'],
    content: `# Installation

## Requirements

| Component  | Version   |
| ---------- | --------- |
| Node.js    | 26 or later |
| PostgreSQL | 16 or later |

## Steps

1. Install the dependencies in each workspace — they are installed separately, and there is no root
   package.
2. Copy \`config.sample.yml\` to \`config.yml\` and point it at your database.
3. Build the frontend, which is what the backend serves.
4. Start the backend from the repository root.

\`\`\`bash
cd backend && npm install
cd ../frontend && npm install && npm run build
cd .. && node backend
\`\`\`

> [!TIP] The dev container does all of this
> Open the repository in the dev container and it installs everything, brings up PostgreSQL, pgAdmin
> and a mail server, and leaves you at a prompt.

## Next

- [Configuration](/sample/guides/getting-started/configuration)
- [Your First Page](/sample/guides/getting-started/first-page)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/guides/getting-started/configuration',
    title: 'Configuration',
    description: 'Where settings live, and which of them are files.',
    icon: 'mdi:cog-outline',
    tags: ['guide'],
    content: `# Configuration

Settings come from three places, merged in this order:

1. \`base.yml\` — the defaults for every key, which defines the shape.
2. \`config.yml\` — what this instance overrides, and the only one an operator edits.
3. The \`settings\` table — everything the admin area writes.

::block-infobox{name="config.yml"}
\`\`\`yaml
Read at: boot
Also read by: the frontend dev server
Holds: port, database, data path
Never holds: anything the admin area can change
\`\`\`
::

## What belongs where

A value an operator sets before the wiki starts belongs in \`config.yml\`. A value an administrator
changes while it is running belongs in the database, because changing it must not need a restart.

> [!WARNING]
> \`base.yml\` is not a user-facing config. It defines the shape of what the other two merge into.

## Next

- [Your First Page](/sample/guides/getting-started/first-page)
- [Storage Targets](/sample/guides/advanced/storage)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/guides/getting-started/first-page',
    title: 'Your First Page',
    description: 'Writing, saving and publishing.',
    icon: 'mdi:file-document-edit-outline',
    tags: ['guide'],
    content: `# Your First Page

## Choose an editor

:::block-tabs
::block-tab{label="Markdown"}
The default. The source is markdown, and the editor renders a live preview beside it.
::

::block-tab{label="Visual"}
A WYSIWYG editor that stores HTML.
::

::block-tab{label="Redirect"}
Not a document at all — a page whose only content is where it points.
::
:::

## Save

A save asks for a reason, which is recorded on the version rather than on the page. That is what a
history timeline is made of.

- [x] Give the page a title
- [x] Write something
- [ ] Add it to the navigation
- [ ] Tell somebody about it

## Next

- [Permissions](/sample/guides/advanced/permissions)
- [Search](/sample/guides/advanced/search)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/guides/advanced/permissions',
    title: 'Permissions',
    description: 'The two kinds, and why they are not interchangeable.',
    icon: 'mdi:shield-key-outline',
    tags: ['guide'],
    content: `# Permissions

There are two kinds, granted separately and checked in different places.

## Global permissions

Held site-wide, bound to no path. \`access:admin\`, \`manage:users\`, \`manage:groups\`,
\`manage:navigation\`, \`manage:theme\`, \`manage:sites\`, \`manage:system\`. That list is the whole of it.

\`manage:system\` bypasses every check everywhere.

## Page rule permissions

Bound to paths, and to locales and sites. A group grants them through **rules**: each rule names some
permissions, says how it addresses pages, and says what it does with them.

| Mode         | What it means                                |
| ------------ | -------------------------------------------- |
| \`ALLOW\`      | Grant these, unless something more specific denies |
| \`DENY\`       | Refuse these                                  |
| \`FORCEALLOW\` | Grant these, and let nothing override it      |

> [!IMPORTANT]
> A page permission cannot be enforced by a route-level check — that reads the group-wide list only,
> so declaring one there refuses everybody.

::block-spoiler{label="Which kind is \`manage:pages\`?" hint="Click to check yourself"}
A page rule permission. It does not imply \`write:pages\` either — a rule grants the exact strings it
names.
::

## See also

- [Storage Targets](/sample/guides/advanced/storage)
- [Glossary](/sample/reference/glossary)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/guides/advanced/storage',
    title: 'Storage Targets',
    description: 'Where a page goes when it is saved.',
    icon: 'mdi:database-outline',
    tags: ['guide'],
    content: `# Storage Targets

Content is **written** to every target that claims it, and **read** from one. Those are two separate
questions with two separate answers.

::block-diagram{caption="One upload, several destinations"}
\`\`\`mermaid
flowchart LR
  U[Upload] --> S{Which targets claim this type?}
  S --> DB[(Database)]
  S --> D[Disk]
  S --> G[Git]
  DB --> R[Served to readers]
\`\`\`
::

## The targets that ship

| Key     | What it is                                        |
| ------- | ------------------------------------------------- |
| \`db\`    | Bytes in the asset's own row. Always on.          |
| \`disk\`  | The wiki's tree as files                          |
| \`git\`   | That same tree, with history and a remote         |
| \`s3\`    | S3, and anything speaking its API                 |
| \`azure\` | Azure Blob Storage                                |
| \`gcs\`   | Google Cloud Storage                              |
| \`sftp\`  | The tree on another host. A copy, never a source. |

> [!CAUTION]
> A pull from a git remote is authoritative, and that includes deletions. Push access to the remote
> is effectively write access to the wiki.

## See also

- [Configuration](/sample/guides/getting-started/configuration)
- [Search](/sample/guides/advanced/search)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/guides/advanced/search',
    title: 'Search',
    description: 'What is indexed, and when.',
    icon: 'mdi:magnify',
    tags: ['guide'],
    content: `# Search

A page is indexed from its rendered HTML rather than its source, which is why a block's output is
searchable and its \`::block-name\` line is not.

1. The page is saved.
2. Its render is reduced to plain search text.
3. The row is written to the index.

::block-index{path="sample/reference" columns="1" showIcons="true"}
::

## See also

- [Permissions](/sample/guides/advanced/permissions)
- [API Reference](/sample/reference/api)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/reference/glossary',
    title: 'Glossary',
    description: 'The words this wiki uses for its own parts.',
    icon: 'mdi:book-alphabet',
    tags: ['reference'],
    content: `# Glossary

Asset
: Any uploaded file. Where its bytes live is decided by the site's storage targets, not by the asset.

Block
: A web component embedded in a page with \`::block-name\`. Its code is fetched only when its tag turns
  up in a page.

Folder
: A branch of the tree. It holds pages and other folders, and is not itself a page.

Page rule
: How a group grants the permissions that are bound to paths. See
  [Permissions](/sample/guides/advanced/permissions).

Storage target
: One storage module configured for one site. See
  [Storage Targets](/sample/guides/advanced/storage).

Tree
: The structure of the wiki — what is filed where. A page is served from its own row and only located
  through the tree.
`
  },
  {
    path: 'sample/reference/api',
    title: 'API Reference',
    description: 'A worked example of the REST API, and where the real documentation lives.',
    icon: 'mdi:api',
    tags: ['reference'],
    content: `# API Reference

The whole API is browsable at \`/_api\` in a running instance, generated from the route schemas
themselves — so it is never out of date with the server answering it.

## Authenticating

Session cookie for a browser, bearer token for everything else.

\`\`\`bash
curl -H "Authorization: Bearer $WIKI_API_KEY" https://wiki.example.com/_api/sites
\`\`\`

## Creating a page

\`\`\`js title="create-page.mjs"
const res = await fetch(\`/_api/sites/\${'$'}{siteId}/pages\`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    path: 'notes/first',
    title: 'My first page',
    editor: 'markdown',
    content: '# Hello',
    render: '<h1>Hello</h1>',
    tags: ['test']
  })
})
\`\`\`

> [!NOTE]
> \`content\` is the source and \`render\` is the HTML produced from it. The server sanitizes the render
> against what the author is allowed to embed, so read the response rather than assuming what was
> sent is what was stored.

## See also

- [Search](/sample/guides/advanced/search)
- [Changelog](/sample/reference/changelog)
- [Back to the sample home](/sample/home)
`
  },
  {
    path: 'sample/reference/changelog',
    title: 'Changelog',
    description: 'A page of nothing but lists and dates, for checking vertical rhythm.',
    icon: 'mdi:history',
    tags: ['reference'],
    content: `# Changelog

## 3.0.0 — unreleased

### Added

- Self-registration, email confirmation and password reset on the login screen
- A mail transport, and a test button in the admin area
- Sample content generation, which is what wrote this page

### Changed

- The login identifier now declares \`autocomplete="username"\` rather than \`email\`
- Pages hold their own render, sanitized against the author's permissions

### Fixed

- Enforced two-factor authentication, which read the wrong property and did nothing
- Dark mode on the login screen, where nothing set a foreground colour

## 2.5.308

### Fixed

- Various

---

*This page is fictional. It exists so there is something with a lot of short list items in it.*
`
  }
]
