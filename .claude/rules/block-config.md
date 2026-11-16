---
paths:
  - "backend/models/blocks.ts"
  - "backend/api/blocks.ts"
  - "backend/api/schemas/block.ts"
  - "backend/helpers/sanitizeRender.ts"
  - "frontend/src/pages/AdminBlocks.vue"
  - "frontend/src/components/BlockConfigDialog.vue"
  - "frontend/src/components/BlockPropsForm.vue"
  - "frontend/src/components/BlockParamsDialog.vue"
  - "frontend/src/components/BlockPickerOverlay.vue"
  - "frontend/src/helpers/blocks.js"
---

# Block defaults and locks

A site's administrator can set what each block's props start on, and lock any of them to a value
authors cannot change — **Admin → Content Blocks → Configure**. A private PlantUML or draw.io server
is the case it exists for.

**It is the block row's `config` column**, `BlockConfig` in `models/blocks.ts`: `{ [propName]: {
value, locked } }`, with an entry only for a prop that was changed or locked. `{}` is a block used as
its component declares it, which is what every row is created with — so there is no "unset" case to
handle anywhere. An empty `value` stands for the block's own default (that is how a prop is locked to
what the block would do anyway). `normalizeConfig` refuses a prop the block does not offer an author
and a value that prop cannot take, and drops entries that say nothing. It is saved by the same
`PUT /sites/:siteId/blocks` as the enable switches, staged in the admin screen until Apply.

**A default is applied when a block is written; a lock is applied when a page is rendered.**

- Defaults: `initialValues(block)` in `frontend/src/helpers/blocks.js` is what the picker's form
  starts on, and what `blockMarkdown` / `blockAsciidoc` write when given no values — so a toolbar
  shortcut or the Visual editor's slash menu inserts a configured block too — and what the block-name
  completion writes (`snippetAttributes`). Changing a default changes nothing already in a page.
- Locks: `writtenProps` writes the locked value whatever it is handed, so every editor path agrees,
  and the forms show the field disabled. But the source is text anybody can type an attribute into,
  so the lock that counts is in `sanitizeRender` (shared by the server and the browser preview): a
  `transformTags` entry per block with a lock replaces the attribute, both spellings of its name,
  before the attribute allow list and scheme check run. A page that already embeds the block picks a
  new lock up the next time it is rendered, the same as a block being switched off.
- The "Edit Content" overlay is handed the locked values too (`lockedValues`), since a canvas editor
  such as draw.io's reads its server from the block's params.

Child blocks have no row and so no config; they are configured, if at all, by nothing.
