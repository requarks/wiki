# Dependency patches

Fixes to installed packages that upstream has not released, applied by
[patch-package](https://github.com/ds300/patch-package) from the `postinstall` script in
`frontend/package.json`. Every `npm install` / `npm ci` re-applies them, so a patch here is part of the
build. Editing `node_modules` by hand is not: the next install overwrites it.

The script runs with `--error-on-fail --error-on-warn`, so the install **stops** when a patch no longer
applies, and also when the package's version no longer matches the version in the patch's file name, even
if it would still apply. Without the flags patch-package only warns outside CI, and a dropped fix would go
unnoticed. Because of this, upgrading a patched package always means looking at its patch. That is
deliberate.

Each patch is described below: what it fixes, how to see the bug, and when the patch can be removed.

## `y-prosemirror+1.3.7.patch`: marks on non-text nodes

**File:** `node_modules/y-prosemirror/src/plugins/sync-plugin.js`. This is the ESM build, which Vite and
Node load through the `import` export. The CommonJS build in `dist/` is not patched, and nothing in the
app loads it.

**Symptom.** With collaborative editing on, the Visual editor drops every mark on an inline node that is
not text. A linked image (`[![alt](pic.png)](/target)`) opens without its link, and saving makes the loss
permanent. The same happens to a bold emoji, a linked icon, and a link around a footnote reference, an
inline block, inline HTML or a line break. Reported in
[requarks/wiki#8209](https://github.com/requarks/wiki/discussions/8209).

**Cause.** When collaborative editing is on, the editor's document is built by y-prosemirror from a shared
`Y.XmlFragment` (see `src/editor/visual/collab.js`). y-prosemirror stores marks only on text, as
formatting attributes of a `Y.XmlText`. A non-text node becomes a `Y.XmlElement` holding the node's
attributes, and its `marks` are dropped. The editor's own code cannot work around this, because the marks
are already gone by the time it receives the document.

**Upstream.** [yjs/y-prosemirror#47](https://github.com/yjs/y-prosemirror/issues/47) and the PRs that
would have fixed it in 1.x (#63, #135, #157) were closed unmerged in March 2026. 1.3.7 was the latest 1.x
release when this patch was written.

**What the patch does.** A node's marks are stored as JSON, `[mark.toJSON(), ...]`, in a single
attribute of its `Y.XmlElement` named `ymarks` (constant `YMARKS`). The attribute is never passed to
ProseMirror as a node attribute. The patch touches five places:

| Where | Change |
| --- | --- |
| `createTypeFromElementNode` | writes `ymarks` when the node has marks |
| `createNodeFromYElement` | reads `ymarks` back into real marks, `schema.node(name, attrs, children, marks)` |
| `equalYTypePNode` | compares attributes without `ymarks`, then compares the marks separately |
| `updateYFragment` | leaves `ymarks` out of "remove attributes ProseMirror no longer has", then sets or removes it from the node's marks, writing only when they differ |
| new helpers before `hashedMarkNameRegex` | `YMARKS`, `nodeMarksToYAttr`, `yAttrToNodeMarks` |

A mark the schema does not know is skipped rather than passed to `schema.markFromJSON`. That call would
throw, and y-prosemirror handles a throw by **deleting the whole node** from the shared document.

**Stored data.** `ymarks` only exists in collaboration rooms, which live while people are editing. Pages
are saved as markdown. Dropping or changing the format therefore needs no migration: at worst, a room
that is open during the deploy loses the marks this patch was keeping.

### Upgrading y-prosemirror

1. Bump the version and run `npm install`. The install stops at the patch.
2. If the new release supports marks on non-text nodes (search its `sync-plugin.js` for how
   `createTypeFromElementNode` handles `node.marks`), delete this patch, and its section here, and go to
   step 4. If no other patch is left, remove the `postinstall` script and the `patch-package`
   devDependency as well.
3. Otherwise, make the changes in the table above in the new `node_modules/y-prosemirror/src/plugins/sync-plugin.js`.
   The old patch file shows each hunk in full. Then run `npx patch-package y-prosemirror`, which writes
   `y-prosemirror+<new version>.patch`. Delete the old file and update the section heading above.
4. Run `npm run visual:check`. The cases `linked image`, `linked image beside linked text` and
   `emphasised emoji and icon` go through the shared document (`throughCollab` in
   `scripts/check-visual-roundtrip.mjs`) and fail when the marks are lost. They passing does not prove an
   in-place edit (adding a link to an image already in a room) syncs correctly, so also try that in two
   browser windows on the same page.

A 2.x line is published under a different package name, `@y/prosemirror` (only a `2.0.0-0`
prerelease as of November 2026). Moving to it means changing the import in `collab.js` and checking its
API, not just bumping a version. Check whether it handles marks on non-text nodes before carrying this
patch over.
