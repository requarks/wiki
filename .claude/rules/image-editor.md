---
paths:
  - "backend/helpers/images.ts"
  - "backend/models/assets.ts"
  - "backend/api/assets.ts"
  - "dev/specs/image-editor.md"
  - "dev/scripts/verify-image-edit.ts"
  - "frontend/src/components/AssetEditorDialog.vue"
  - "frontend/src/components/AssetEditorSaveDialog.vue"
  - "frontend/src/components/AssetResizeDialog.vue"
  - "frontend/src/components/ImageRegionBox.vue"
  - "frontend/src/components/ImageFillPicker.vue"
  - "frontend/src/helpers/imageEdit.js"
  - "frontend/src/composables/imageSizeFields.js"
  - "frontend/src/composables/imageSaveFields.js"
---

# The image editor

The file manager's **Edit Image...** (and its older sibling, **Resize Image...**). The design, and why
each piece is the way it is, is `dev/specs/image-editor.md`; this is what breaks if forgotten.

**The browser previews, the server makes the file.** The editor keeps a list of operations and draws
them on a canvas; saving sends the list to `POST …/assets/:assetId/edit`, and `editImage` in
`helpers/images.ts` replays it on the original with Sharp. No pixel the browser draws is uploaded. So
every position and size in an operation is in the ORIGINAL's pixels, after EXIF orientation — never in
the preview canvas's, which is drawn smaller above 16 MP.

**Two implementations of the same arithmetic, kept in step by hand.** `rotatedSize` exists on both
sides (`helpers/images.ts`, `helpers/imageEdit.js`) — Sharp grows the canvas for a rotation by any
angle and rounds each side to the nearest pixel, and the editor has to predict exactly that, or a crop
worked out after a straighten does not fit. Likewise `sizeAfter` and `checkOperation`, and the colour
settings: `adjustFilter` (CSS) and `applyAdjust` (Sharp) use the same functions in the same order, and
match Chrome to within a level or two in 255. Change one side, change the other, and run
`node dev/scripts/verify-image-edit.ts`.

**Only the first frame of an animation is ever read.** `editImage` opens the file without
`animated`, so the size it checks and the pixels it decodes are the first frame's, and the result is a
still. On purpose: editing every frame made memory a function of the frame count, which a large GIF
turns into abuse. The editor, its save dialog and the Resize dialog all warn, from the frame count
`GET …/editing` reads off the header. Do not pass `animated: true` to make an animation "work" — Sharp
gets half the operations wrong on the strip it returns; the spec's §8 has what it takes instead.

**A redaction punches out before it paints.** `dest-out` then `over`, so a half-transparent patch
still hides what was under it. Not the `source` blend: it does that in one step but clears everything
outside the patch too.

**`/resize` is `/edit` with one `resize` operation** (`applyImageEdit` in `api/assets.ts`), and keeps
its own audit action, `resizeAsset`. Both dialogs share `useImageSizeFields` and `useImageSaveFields`.

**`unchangedSince` is the file's `updatedAt` when the editor opened**, from
`GET …/assets/:assetId/editing`; a save against a file written since is a 409 `assetChanged`, and the
editor's answer is to reload and start over, never to replay the list on the new file.
