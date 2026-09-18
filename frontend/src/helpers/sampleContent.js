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

Held site-wide, bound to no path. \`access:admin\`, \`read:users\`, \`write:users\`,
\`manage:users\`, \`read:groups\`, \`write:groups\`, \`manage:groups\`, \`read:audit\`,
\`read:metrics\`, \`manage:theme\`, \`manage:storage\`, \`manage:sites\`, \`read:webhooks\`,
\`manage:webhooks\`, \`manage:system\`. That list is the whole of it.

\`manage:system\` bypasses every check everywhere.

A site's settings are split across three permissions that do not overlap: \`manage:sites\` for its
general settings, \`manage:theme\` for its appearance and \`manage:storage\` for where its content
is kept. Changing all of them takes all three.

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

/**
 * The blog the sample content writes, and the posts filed under it.
 *
 * Separate from {@link SAMPLE_PAGES} because a blog is not a page with a body: its front page is
 * authored with the `blog` editor, and what its content column holds is a settings document rather
 * than markdown — so it is created differently and cannot go through the same loop untouched. See
 * `helpers/pageBlog.js` for the shape, and `models/blogs.ts` for what the server does with it.
 *
 * Filed at `/my-blog` rather than under `/sample`, so that the one thing on the site that is a
 * DESTINATION sits where a real one would: a blog's path is its address, and a reader who has to
 * walk three folders down to find it is not testing what a blog does.
 *
 * Twenty-five posts, which is a deliberate figure: at the blog's own `perPage` of ten it is three
 * pages of listing, so the pager is exercised rather than merely present.
 *
 * Their dates fall in twenty distinct months across two calendar years, five of those months holding
 * two posts — so the sidebar's archive has two years to fold, and counts that are not all 1. Icons
 * and tags vary for the same reason: a listing whose every row carries the same icon and the same
 * tag says nothing about how it draws either, and a tag cloud of one tag is not a cloud. The eight
 * tags are spread unevenly on purpose, since that is what a cloud is for.
 */
export const SAMPLE_BLOG = {
  path: 'my-blog',
  title: 'My Blog',
  description: 'A blog of release notes, tips and announcements — sample content.',
  icon: 'mdi:newspaper-variant-outline',
  tags: ['guide'],
  /**
   * How the front page is set up. Passed through `serializeBlog`, so anything left out here takes
   * the same default a blog created in the editor would — see `emptyBlog` in `helpers/pageBlog.js`.
   */
  settings: {
    layout: 'cards',
    perPage: 10,
    sort: 'newest',
    depth: 5,
    intro: `Notes from a team that does not exist, about a wiki that does.

Everything here was written by Generate Sample Content, and every post carries the \`test\` tag — Purge Sample Content takes the whole blog away again.`,
    show: { icon: true, description: true, author: true, date: true, tags: true },
    sidebar: { tags: true, archive: true }
  }
}

/**
 * @typedef {object} SampleBlogPost
 * @property {string} path Absolute from the site root, without a leading slash. Under the blog.
 * @property {string} title
 * @property {string} description Shown in the listing under the title.
 * @property {string} icon An Iconify reference, materialized before the posts are written.
 * @property {string[]} tags Beside {@link SAMPLE_CONTENT_TAG}, which is added to every page.
 * @property {string} publishedAt Sent as the page's `publishStartDate`, which is what a blog orders
 *   and dates a post by — see `BlogPost.publishedAt` in `models/blogs.ts`. Every one is in the past:
 *   a future date would list the post today under tomorrow's heading, which is a real thing a blog
 *   does and a confusing thing for a seed to do.
 * @property {string} content Markdown source. The render is produced from it at generation time.
 */

/** @type {SampleBlogPost[]} */
export const SAMPLE_BLOG_POSTS = [
  {
    path: 'my-blog/hello-world',
    title: 'Hello, world',
    description: 'A first post, which is mostly an excuse to have a second one.',
    icon: 'mdi:hand-wave',
    tags: ['announcement'],
    publishedAt: '2025-01-14T09:00:00.000Z',
    content: `# Hello, world

This is the first post on a blog that exists so there is a blog to look at. If you are reading it on
a fresh instance, somebody pressed **Generate Sample Content** in the admin area and this arrived
with everything else.

A blog in this wiki is a page like any other — it has a path, a title and a place in the tree. What
makes it a blog is the editor it was written with, and what that editor stores is not an article but
a set of decisions about how to draw the pages filed underneath it.

So there is nothing to read on the front page except what its author chose to say above the listing.
That is the paragraph at the top, and this is one of the twenty-five posts under it.
`
  },
  {
    path: 'my-blog/why-a-wiki',
    title: 'Why we went back to a wiki',
    description: 'Three tools became one, and the one is the boring option.',
    icon: 'mdi:lightbulb-on-outline',
    tags: ['announcement', 'design'],
    publishedAt: '2025-02-03T10:30:00.000Z',
    content: `# Why we went back to a wiki

We had notes in three places: a chat channel nobody searched, a folder of documents nobody opened,
and a handful of READMEs that were accurate for about a week after each release.

None of those failed because the tool was bad. They failed because none of them had a **path**. A
document at \`/guides/deploying\` can be linked to, bookmarked, sent to somebody new, and corrected
by the next person who notices it is wrong. A file called \`deploy-final-v2.docx\` cannot.

> [!TIP]
> If you are picking a structure, pick one you can say out loud. If the path does not survive being
> read down the phone, it will not survive being typed from memory either.

That is the whole argument. It is not exciting, which is rather the point.
`
  },
  {
    path: 'my-blog/markdown-habits',
    title: 'Five markdown habits worth picking up',
    description: 'Small things that make a page easier to edit six months later.',
    icon: 'mdi:language-markdown',
    tags: ['tips'],
    publishedAt: '2025-02-25T08:15:00.000Z',
    content: `# Five markdown habits worth picking up

1. **One sentence per line.** The rendered page is identical, and every diff becomes readable.
2. **Reference links for anything used twice.** Changing a URL in one place beats finding four.
3. **Write the heading you would search for**, not the one that sounds tidy in the outline.
4. **Tables last.** If a table is hard to write in markdown, it is usually a list wearing a costume.
5. **Leave the blank line after a heading.** Some renderers do not care. Yours will, eventually.

None of these are rules. They are the five things that kept coming up in review, which is a different
and more useful list.
`
  },
  {
    path: 'my-blog/three-oh-alpha',
    title: '3.0 alpha is out',
    description: 'Early, unstable, and not to be pointed at anything you care about.',
    icon: 'mdi:rocket-launch-outline',
    tags: ['release'],
    publishedAt: '2025-03-11T16:00:00.000Z',
    content: `# 3.0 alpha is out

An alpha in the sense that means it: there is no upgrade path from 2.x, the database schema changes
without notice, and a release two weeks from now may well require starting again.

## What works

- Pages, the markdown editor, and the tree
- Authentication with local accounts
- The admin area, for most values of "the admin area"

## What does not

- Anything to do with storage targets
- Search, beyond the most literal kind
- Roughly half the things the navigation offers

If that reads as a warning, it is meant to.
`
  },
  {
    path: 'my-blog/organising-early',
    title: 'Organising pages before you have too many',
    description: 'The folder structure you can still change is the one worth arguing about.',
    icon: 'mdi:file-tree',
    tags: ['tips', 'guide'],
    publishedAt: '2025-03-29T11:45:00.000Z',
    content: `# Organising pages before you have too many

At thirty pages a bad structure is an afternoon's work to fix. At three hundred it is a project
nobody will ever be given time for, so the structure you have at thirty is very likely the structure
you have for ever.

The one that keeps working: **group by what somebody is trying to do**, not by which team owns it.
Teams are reorganised roughly once a year. What somebody is trying to do changes far more slowly.

\`\`\`
guides/          — how to do a thing
reference/       — what a thing is
decisions/       — why a thing is the way it is
\`\`\`

Three folders is usually enough for the first year. Add a fourth when something genuinely will not
fit, rather than in anticipation of something that might.
`
  },
  {
    path: 'my-blog/dark-mode',
    title: 'Dark mode, and why it took a while',
    description: 'Two themes is not one theme with the colours swapped.',
    icon: 'mdi:weather-night',
    tags: ['design'],
    publishedAt: '2025-04-16T13:20:00.000Z',
    content: `# Dark mode, and why it took a while

The naive version took an afternoon: invert the greys, lighten the brand colour, ship it. It looked
fine in screenshots and wrong in use, and it took a while to work out why.

Shadows are the obvious case. A shadow is black in both themes, so the same \`rgba(0, 0, 0, 0.06)\`
that reads as a card lifted off a white page reads as nothing at all against a near-black one. Every
shadow needs its own value per theme, and the value is not a formula.

The subtler case is contrast between two *lit* surfaces. In a light theme a raised element is
brighter than the page. In a dark theme it is brighter too — not darker, which is what inverting
gives you. Elevation is light, and light does not invert.
`
  },
  {
    path: 'my-blog/search-that-finds-things',
    title: 'Making search that actually finds things',
    description: 'Ranking is the easy half. Knowing what a reader may see is the other one.',
    icon: 'mdi:magnify',
    tags: ['design', 'performance'],
    publishedAt: '2025-05-02T09:10:00.000Z',
    content: `# Making search that actually finds things

Full-text search over a few thousand pages is a solved problem. Postgres will do it, it will do it
quickly, and the ranking will be good enough that nobody complains.

The part that is not solved by the database is **permissions**. Which pages a given reader may open
is decided by rules that match on path, locale and tags, resolved one page at a time — which is not
something you can express as a \`WHERE\` clause. So the choice is either to filter after reading, or
to leak the existence of pages somebody was never told about.

We filter after reading. It costs more, and it is the only answer that is actually correct.
`
  },
  {
    path: 'my-blog/permissions-once',
    title: 'Permissions, explained once',
    description: 'Two kinds, granted separately, checked in different places.',
    icon: 'mdi:shield-key-outline',
    tags: ['guide'],
    publishedAt: '2025-05-27T15:40:00.000Z',
    content: `# Permissions, explained once

There are two kinds, and almost every confusion about this comes from treating them as one.

**Global permissions** are held across the whole site and are bound to no path. \`read:users\`,
\`manage:sites\`, \`access:admin\` — these say what somebody may do to the wiki as an installation.

**Page rule permissions** are bound to paths. \`read:pages\`, \`write:pages\`, \`manage:comments\` — these
say what somebody may do at a place in the tree, and a group grants them through rules that match
paths and tags.

> [!IMPORTANT]
> Nothing is granted by default, and where several rules match, the most specific one wins. A rule
> over \`/guides\` does not quietly extend to \`/guides-archive\`.

The practical consequence: if a permission has a path in the question, it is a page rule, and no
amount of adding global permissions will produce it.
`
  },
  {
    path: 'my-blog/three-oh-beta',
    title: '3.0 beta, and what changed',
    description: 'Still no upgrade path, but the schema has stopped moving under us.',
    icon: 'mdi:rocket-launch-outline',
    tags: ['release'],
    publishedAt: '2025-06-18T12:00:00.000Z',
    content: `# 3.0 beta, and what changed

The schema is stable enough that migrations are now written rather than regenerated, which is the
real difference between the alpha and this.

## Added since the alpha

- Storage targets, with disk and git both working
- Comments, both built in and through a provider
- The audit log, and a retention setting behind it

## Changed

- Page rules are resolved per path rather than per site
- The render is stored with the page rather than produced on read

Still no upgrade path from 2.x. That is not an oversight; it is the trade that made the rest of this
possible.
`
  },
  {
    path: 'my-blog/writing-for-arrivals',
    title: 'Writing for the person who arrives from a search',
    description: 'Most readers do not start at the top. Write the page they land on.',
    icon: 'mdi:account-search-outline',
    tags: ['tips'],
    publishedAt: '2025-07-07T10:05:00.000Z',
    content: `# Writing for the person who arrives from a search

Nobody reads a wiki front to back. They arrive in the middle, from a search result or a link
somebody pasted, with one question and no context.

So the first paragraph of every page has a job: say what this page is about and who it is for. Not
"Overview", not "Introduction" — an actual sentence that somebody can read and decide from.

The test is simple. Open a page at random, read only the title and the first paragraph, and ask
whether you could tell a colleague what is on it. If not, the page starts one paragraph too late.
`
  },
  {
    path: 'my-blog/where-content-lives',
    title: 'Where your content actually lives',
    description: 'Written to every target that claims it, read from exactly one.',
    icon: 'mdi:database-outline',
    tags: ['guide'],
    publishedAt: '2025-07-24T14:25:00.000Z',
    content: `# Where your content actually lives

A storage target is somewhere a site keeps its content: the database, a folder on disk, a git
repository, an object store. A site can have several at once, and this is where people trip.

**Writing and reading are two separate questions.**

- An upload goes to *every* target configured to hold that kind of content. All of them, or the
  upload fails.
- A reader's request is answered from *one* — the target nominated for that content type, and the
  database if nobody is nominated.

Which means enabling a target does not move anything. It changes where the next upload goes, and a
target switched on today holds nothing that was uploaded yesterday.
`
  },
  {
    path: 'my-blog/summer-roundup',
    title: 'Community roundup, summer edition',
    description: 'What people built, broke and fixed over the last few months.',
    icon: 'mdi:account-group-outline',
    tags: ['community'],
    publishedAt: '2025-08-12T08:50:00.000Z',
    content: `# Community roundup, summer edition

A few things worth pointing at, none of them ours.

- Somebody wrote a block that embeds a live train departure board. It is completely impractical and
  we have thought about it every day since.
- Two separate people reported the same bug in folder renaming within an hour of each other, having
  found it in entirely different ways. Both reports were better than our test for it.
- A translation of the admin area into Welsh landed, which took the locale count to a number we no
  longer have to round down when describing it.

Thank you, genuinely. The bug reports especially — a bug somebody bothered to describe properly is
worth more than most feature requests.
`
  },
  {
    path: 'my-blog/faster-page-loads',
    title: 'Shaving a second off every page load',
    description: 'Most of it was one query, and it was not the one anybody suspected.',
    icon: 'mdi:speedometer',
    tags: ['performance'],
    publishedAt: '2025-09-01T11:30:00.000Z',
    content: `# Shaving a second off every page load

The page itself was fast. The *document* was slow, and it took an embarrassing amount of profiling to
see the difference.

Every request was resolving the site's navigation tree, and the navigation tree was being rebuilt
from the page table each time rather than read from the cache it was supposedly in. The cache key
included a timestamp. It never hit. Not once, in about fourteen months.

\`\`\`diff
- const key = \`nav:\${siteId}:\${Date.now()}\`
+ const key = \`nav:\${siteId}\`
\`\`\`

Nine hundred milliseconds, on every page, for over a year. The fix is one line and the lesson is
about instrumenting cache hit rates, which we now do.
`
  },
  {
    path: 'my-blog/accessibility-pass',
    title: 'An accessibility pass over the editor',
    description: 'Keyboard traps, unlabelled controls, and one very confident toolbar.',
    icon: 'mdi:human',
    tags: ['design'],
    publishedAt: '2025-09-23T13:15:00.000Z',
    content: `# An accessibility pass over the editor

We went through the editor with a keyboard and nothing else for a day. The findings were not subtle.

- The formatting toolbar was fourteen buttons with icons and no accessible names. To a screen reader
  it was fourteen buttons called "button".
- Tab order went from the title field into the preview pane and back out of the document entirely,
  skipping the thing you were meant to be typing in.
- The unsaved-changes dialog could be opened by keyboard and closed by nothing.

All fixed, none of them hard. The uncomfortable part is that every one of these would have been
caught by trying it once, at any point in the preceding two years.
`
  },
  {
    path: 'my-blog/comments-arrive',
    title: 'Comments arrive',
    description: 'A discussion tab, a dozen providers, and one deliberate omission.',
    icon: 'mdi:comment-text-outline',
    tags: ['release', 'community'],
    publishedAt: '2025-10-14T09:45:00.000Z',
    content: `# Comments arrive

Two things wearing one name, and you pick one per site.

The **built-in** provider stores comments in this wiki, shows them on a Talk tab beside the article,
and resolves \`@handle\` mentions against real accounts. Markdown is rendered at display time with
HTML disabled outright, so nothing anybody types is ever HTML.

A **third-party** provider — Giscus, Isso, Disqus and the rest — puts somebody else's widget under
the article instead. The discussion lives in their service and this wiki only carries the snippet.

The deliberate omission is a moderation queue. A comment is accepted or it is not; there is nowhere
for one to sit and wait. That will change, and it has not yet.
`
  },
  {
    path: 'my-blog/backup-habits',
    title: 'Backup habits for small teams',
    description: 'A backup you have not restored from is a hypothesis.',
    icon: 'mdi:backup-restore',
    tags: ['guide', 'tips'],
    publishedAt: '2025-11-04T16:20:00.000Z',
    content: `# Backup habits for small teams

Three things, in order of how often they are skipped.

**Back up the database and the data path together.** The database holds the pages; the data path
holds uploaded files and, if you use the git target, a working copy. Either one alone restores to a
wiki with holes in it.

**Restore one, on purpose, into somewhere else.** Quarterly is plenty. The point is not to check the
backup is valid — it is to find out how long a restore takes before the day you need to know.

**Write down where the backups are.** Not in the wiki.

> [!CAUTION]
> That last one is not a joke. We have watched a team lose an afternoon to credentials stored in the
> system they were trying to bring back.
`
  },
  {
    path: 'my-blog/year-in-review',
    title: 'The year in review',
    description: 'Twelve months, one major version, and a lot of deleted code.',
    icon: 'mdi:calendar-check-outline',
    tags: ['announcement', 'community'],
    publishedAt: '2025-12-16T10:00:00.000Z',
    content: `# The year in review

The number we are most pleased with is the amount of code removed. GraphQL went, the icon webfont
went, two of the three date libraries went, and the result is a build that is smaller than it was in
January despite doing considerably more.

What shipped: storage targets, comments, the audit log, analytics, a metrics endpoint, and the app
shell that finally lets a link to a page unfurl properly when somebody pastes it into a chat.

What did not: the upgrade path from 2.x, which remains the single most-asked question and the single
hardest thing on the list.

Next year's post will say whether that changed.
`
  },
  {
    path: 'my-blog/three-oh-final',
    title: '3.0 is here',
    description: 'Two years, one rewrite, and a version number that finally means something.',
    icon: 'mdi:party-popper',
    tags: ['release'],
    publishedAt: '2026-01-20T12:00:00.000Z',
    content: `# 3.0 is here

Stable, documented, and safe to point at something you care about — which is more than any previous
post on this blog has been able to say.

## The short version

- A page stores the HTML its editor produced, sanitized against what its author may embed
- Content can live in the database, on disk, in git, or in an object store, at the same time
- Permissions are two systems that no longer pretend to be one
- Everything is REST, and browsable at \`/_api\`

## The honest version

There is still no automated upgrade from 2.x. Exporting content and importing it is the path, and it
is a real afternoon of work for a large wiki. We would rather say so than ship a migration that half
works.
`
  },
  {
    path: 'my-blog/migrating-from-2x',
    title: 'Migrating from 2.x',
    description: 'Export, import, fix the links. In that order, and no shortcuts.',
    icon: 'mdi:swap-horizontal',
    tags: ['guide'],
    publishedAt: '2026-02-10T11:15:00.000Z',
    content: `# Migrating from 2.x

There is no in-place upgrade. What follows is the path that works.

1. **Export from 2.x to disk.** The storage module writes your pages as markdown files with front
   matter, laid out by locale and folder.
2. **Stand up 3.0 empty**, on its own database. Do not point it at the old one.
3. **Configure a disk target** at the folder you exported to, then run **Import Everything**.
4. **Fix what moved.** Users, groups and permissions do not come across — the models are different
   enough that a translation would be a guess.

Budget an afternoon for a few hundred pages, and do it twice: once to find out what breaks, and once
for real.
`
  },
  {
    path: 'my-blog/security-notes',
    title: 'Security notes for self-hosters',
    description: 'Four settings that matter more than everything else on the page.',
    icon: 'mdi:lock-outline',
    tags: ['security', 'guide'],
    publishedAt: '2026-03-05T14:00:00.000Z',
    content: `# Security notes for self-hosters

**Turn on \`trustProxy\` if and only if you are behind one.** It decides whether the address in
\`X-Forwarded-For\` is believed. On, with nothing in front of the wiki, anybody can claim any address
— which defeats the rate limiter. Off, behind a proxy, every request appears to come from the proxy
— which also defeats the rate limiter, more quietly.

**Check what the guests group can do.** It is the anonymous reader, and on a public wiki that is
correct. On a private one it should deny everything, and it is worth verifying rather than assuming.

**Elevated permissions are a category, not a list.** Anything that can rewrite who holds what can
grant itself the rest, in one step or two.

**Audit log retention has a floor of thirty days**, deliberately, because the permission that
shortens it belongs to exactly the person the log exists to record.
`
  },
  {
    path: 'my-blog/blocks-deep-dive',
    title: 'A deep dive into content blocks',
    description: 'Web components in a page, and why they are not plugins.',
    icon: 'mdi:widgets-outline',
    tags: ['guide', 'design'],
    publishedAt: '2026-04-01T09:30:00.000Z',
    content: `# A deep dive into content blocks

A block is a web component you can put in a page. Tabs, diagrams, a map, a set of steps — things
markdown has no syntax for and never will.

They are deliberately **not** plugins. A block cannot read the wiki's data, call its API or know who
is reading; it gets its attributes and its slotted content and draws something. That boundary is why
a block can be added without a security review of what it might reach.

\`\`\`
::block-steps
1. Write the block
2. Build it
3. Reference it in a page
::
\`\`\`

Nothing is fetched until a block's tag actually appears in a page, so a block nobody uses costs a
reader nothing at all.
`
  },
  {
    path: 'my-blog/analytics-without-creeping',
    title: 'Analytics without creeping anybody out',
    description: 'What a tag can see here, and what it deliberately cannot.',
    icon: 'mdi:chart-line',
    tags: ['guide', 'community'],
    publishedAt: '2026-05-13T10:45:00.000Z',
    content: `# Analytics without creeping anybody out

A provider is turned on per site, and its snippet is served in the document rather than added by the
app afterwards. That matters for two reasons: several providers verify an installation by fetching
the page and looking for their code, and a tag that arrives after boot has already missed the page
load it exists to measure.

Two deliberate limits.

**The admin area gets no tag at all.** What happens there is the wiki being configured, not read, and
it has no business in a report about readers — still less in whatever a session-replay tool would
make of somebody typing a credential into an authentication strategy.

**Nothing here can be marked sensitive.** Every value is rendered into a document served to the
public, so a setting that had to be kept out of a browser could not be used by a provider anyway.
`
  },
  {
    path: 'my-blog/editor-shortcuts',
    title: 'Editor shortcuts worth memorising',
    description: 'Six of them. The rest you will look up once and forget.',
    icon: 'mdi:keyboard-outline',
    tags: ['tips'],
    publishedAt: '2026-06-09T08:20:00.000Z',
    content: `# Editor shortcuts worth memorising

| Keys | What it does |
| ---- | ------------ |
| \`Ctrl\` + \`S\` | Save, without leaving the editor |
| \`Ctrl\` + \`B\` / \`I\` | Bold, italic |
| \`Ctrl\` + \`K\` | Link, around the selection |
| \`Ctrl\` + \`/\` | Comment out the selected lines |
| \`Alt\` + \`↑\` / \`↓\` | Move the current line |
| \`Ctrl\` + \`D\` | Select the next occurrence of the selection |

The last one is the one people are most surprised by and end up using most. Renaming a term through
a long page is four keystrokes rather than a find and replace you have to check afterwards.
`
  },
  {
    path: 'my-blog/watching-with-prometheus',
    title: 'Watching a wiki with Prometheus',
    description: 'One endpoint, two registries, and a path you can move.',
    icon: 'mdi:gauge',
    tags: ['performance', 'guide'],
    publishedAt: '2026-07-21T15:10:00.000Z',
    content: `# Watching a wiki with Prometheus

The metrics endpoint is off by default and its path is a setting, which is why it is a hook rather
than a route — a route table is fixed at boot and this is not.

Two kinds of number come out of it.

**Runtime metrics** are this process: memory, event loop lag, garbage collection. In a cluster a
scrape lands on whichever instance answered, which is what the \`instance\` label is for.

**Wiki metrics** are the whole installation: pages, users, comments, assets. They are database counts
built fresh per scrape, so they cost about a dozen queries — which is why they are off unless you ask
for them.

Anonymous access is decided per address class. Local, private and external are three separate
answers, and anything that is not an IP address counts as external.
`
  },
  {
    path: 'my-blog/whats-next',
    title: "What's next",
    description: 'Three things being worked on, and one that is not.',
    icon: 'mdi:map-marker-path',
    tags: ['announcement'],
    publishedAt: '2026-08-28T13:00:00.000Z',
    content: `# What's next

**A moderation queue for comments.** The column is already there; what is missing is the screen and
the decision about who may see it.

**Better conflict handling on the git target.** A pull is authoritative today, which is correct and
occasionally brutal. There is room for a middle answer.

**Real-time collaborative editing**, which is further off than anybody wants and involves rather more
than turning on a library.

And one thing that is not being worked on: server-side rendering. A page's HTML is already a string
in the database, produced once when it was saved. Rendering it again on the server would solve a
problem this schema does not have.
`
  }
]
