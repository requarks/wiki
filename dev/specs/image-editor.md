# Image editor

**Status:** implemented — every step of [§10](#10-suggested-order). Annotation
([§11](#11-later-annotation)) is the planned later phase. Where building it changed the design, this
document was changed with it.
**Covers:** the full-screen editor opened from the file manager for a raster image, the edits it
offers, how they are previewed in the browser and applied on the server, and how the result is saved.

The file manager can already resize an image (`AssetResizeDialog.vue`, `POST …/assets/:assetId/resize`).
Everything else a person routinely does to a picture before putting it on a page — turning it the
right way up, cutting it down to the part that matters, hiding a name or a token in a screenshot —
currently means downloading it, editing it elsewhere and uploading it again. This adds an editor for
those, in the file manager, working on the file in place.

The constraints this is written against:

- **The server makes the file; the browser only previews it.** The browser keeps a list of edits and
  draws what they would produce. On save, the list is sent to the server, and Sharp replays it on the
  original and encodes the result once. A `<canvas>` cannot encode GIF at all, Safari's
  `toBlob('image/webp')` hands back a PNG, a canvas flattens an animation to one frame and drops the
  colour profile, and the server already holds the format rules, the permission checks, the
  replace/save-as logic, the thumbnail and the audit entry for the resize. So no pixel the browser
  draws is ever uploaded.
- **Every value the server is sent is in the original's pixels**, after EXIF orientation — the image
  as a viewer sees it, which is what the resize already measures against. The preview may be drawn
  smaller; its coordinates are converted before they are kept.
- **Replacing a file is permanent.** Assets have no version history, so "replace the original"
  overwrites the only copy, and every page showing the file changes at once. The editor says so
  before doing it ([§7.3](#73-replace-the-original)).
- **The existing `/resize` route stays.** It is committed and documented in the API, so it is kept,
  and reimplemented as a one-edit call into the same pipeline ([§5.4](#54-the-resize-route)).

---

## 1. Goals and non-goals

**Goals**

- A **full-screen editor**, opened by right-clicking a PNG, JPEG, WebP or GIF in the file manager and
  choosing **Edit Image...**.
- The image in the main pane, scaled down to fit when it is larger than the pane, shown at its own size
  otherwise — never scaled up.
- A **sidebar of actions** ([§4](#4-actions)): Rotate Right, Rotate Left, Mirror, Flip, Crop, Resize,
  Straighten, Trim, Redact, Pad, and Adjust.
- **Undo, Redo and Reset.**
- **Discard** and **Save...** in the top-right. Discard asks for confirmation when there is anything to
  lose. Save... opens a menu: **as a new image...** and **replace the original**.
- **Choosing the format and quality** when saving ([§7](#7-saving)).
- **Keyboard shortcuts** for the frequent actions ([§3.4](#34-keyboard)).

**Non-goals**

- **Annotation** — arrows, boxes, text, step numbers. Wanted, and planned as a later phase
  ([§11](#11-later-annotation)), but a drawing tool is a much larger piece of work than the rest of this
  put together.
- **SVG.** A vector image has no pixels to crop or redact; it is excluded exactly as the resize
  excludes it. HEIC, TIFF and the other formats `fileTypes.js` does not mark `imageEdit` are excluded
  too.
- **Enlarging.** Resize makes an image smaller, as the resize dialog does. Pad and Straighten add
  canvas around the picture, which is not the same thing.
- **Keeping the previous version of a replaced file.** That needs asset history, which is its own
  feature with its own schema and migration.
- **Editing with others at the same time**, or saving an edit in progress to come back to later. An
  edit lives in the open editor and nowhere else.

---

## 2. Architecture

```
FileManager.vue ── right-click → Edit Image...
  └─ AssetEditorDialog.vue          full-screen w-dialog, stacked over the file manager overlay
       ├─ preview <canvas>          draws the edit state (§3.2)
       ├─ ImageRegionBox.vue        the resizable rectangle for Crop, Trim and Redact (§4.5)
       ├─ sidebar                   actions, their panels, Undo / Redo / Reset
       │    └─ ImageFillPicker.vue  none / white / black / custom, for Straighten, Pad and Redact
       └─ Save... menu
            └─ AssetEditorSaveDialog.vue   save as new: name, format, quality
                                           replace: the warning, and quality for JPEG / WebP

helpers/imageEdit.js                sizes, merging, the canvas preview, trim, crop to fit
composables/imageSizeFields.js      width / height / scale, shared with AssetResizeDialog
composables/imageSaveFields.js      file name, format and quality, shared with AssetResizeDialog

GET  /sites/:siteId/assets/:assetId/editing   what the session may do, Sharp, frames (§6)
POST /sites/:siteId/assets/:assetId/edit      { operations, adjust, mode, fileName?, quality?,
  │                                             unchangedSince? }
  └─ assets.editImage()               models/assets.ts
       └─ editImage()                 helpers/images.ts — Sharp, first frame only
            ├─ upload()               save as new
            └─ replace()              replace the original
```

The file manager is itself the main overlay (`siteStore.overlay = 'FileManager'`), so the editor cannot
be another `MainOverlayDialog` entry: it is opened with `dialog()` like `AssetPreviewDialog`, as a
`full-width full-height persistent` `w-dialog` stacked over it, and lazily imported, so a reader who
never edits an image never fetches it.

---

## 3. The editor

### 3.1 Layout

- **Header bar:** the file name, with its current pixel size beneath it (and the frame count for an
  animation), then — on the right — **Discard** and **Save...** as one `push` button group, styled as
  the other editing overlays close (`GroupEditOverlay`). Below 600px they keep their icons and lose
  their labels, so that the name still has room beside them on a phone. Save is disabled while there is nothing to save or a panel is open.
- **Main pane:** the preview, centred, on a checkerboard so that transparency shows, against the
  same dark stage as the full-view image viewer. Sized explicitly from the stage's measured size
  (a `ResizeObserver`) rather than with `max-width`: fitted when larger, its own size when smaller,
  never enlarged. Explicit, because the region box laid over it places itself in percentages of
  exactly that box.
- **Sidebar, on the right:** one row per action ([§4](#4-actions)), with its shortcut where it has
  one and a faint rule between rows, then **Undo**, **Redo** and **Reset** side by side at the bottom
  — the three that step through the history ([§3.3](#33-undo-redo-reset)). Dark in both themes, on `dark-4` — a step above the stage's
  near-black, so the two read as separate panes. It is a `.w-dark-surface`, which is what lets its
  ordinary form controls render dark in light mode (see the frontend `CLAUDE.md`); the menus it opens
  (the aspect ratio, the colour picker) pass `dark` to `WMenu` for the same reason. An action that needs settings (Straighten, Crop, Trim, Resize, Pad, Redact,
  Adjust) opens its panel in the sidebar in place of the list — headed by the `.card-header` band a
  dialog opens with, the action's icon beside its name — with **Apply** and **Cancel** — Apply
  disabled while it would change nothing. While a panel is open, the other actions, Undo, Redo and
  Save are disabled: one thing is being set up at a time.
- **Below 1024px** the sidebar goes under the image: the actions become a scrolling row of icons
  over words, and an open panel takes the same place.

### 3.2 The edit state and the preview

The state is two things:

- `operations` — an ordered list of geometric and pixel edits ([§4](#4-actions)), each one a plain
  object, e.g. `{ op: 'rotate', angle: 90 }` or `{ op: 'crop', left, top, width, height }`.
- `adjust` — one set of colour settings (brightness, contrast, saturation, grayscale, sharpen), applied
  after every operation. It is a single setting rather than a list of edits, since applying brightness
  twice is never what anybody means.

The original is fetched once, as a blob from `GET …/assets/:assetId/content` — as `measureInBrowser` in
the resize dialog does, not from `/_files/`, which resolves a path in the site's primary locale and
could hand back a different file of the same name. It is decoded with
`createImageBitmap(blob, { imageOrientation: 'from-image' })`, which applies EXIF orientation the same
way the server's `autoOrient` does.

Every change to `operations` redraws the committed preview by replaying the list from the decoded
original (`drawOperations` in `helpers/imageEdit.js`), which is what makes undo trustworthy. An open
panel's own operations — a straighten, a resize, a pad, a redaction being placed — are drawn on top of
that, once per animation frame at most, so a slider or a drag never replays the whole list. `adjust` is
not drawn into the canvas: it is a CSS `filter` on the canvas element (with an SVG convolution filter
for sharpen), which changes as a slider moves without redrawing anything.

**Large images.** Browsers cap a canvas's area (iOS at roughly 16 megapixels). Below a budget of
16 MP the preview is drawn at full resolution; above it, at the largest scale that fits. Either way,
everything kept in `operations` is in the original's pixels ([the constraints](#image-editor)).

**Animated GIF and WebP** are previewed from their first frame, which is all that is edited, and a
banner at the top of the sidebar says so — over the list of actions only, not inside a tool's panel,
which opens with its own heading band. See [§8](#8-animated-images).

### 3.3 Undo, Redo, Reset

Undo and redo step through snapshots of the whole state (`operations` and `adjust` together). A
snapshot is taken when an action is applied — a panel's Apply, a rotate button — never as a slider
moves. Adjust is a panel with Apply like the others rather than a set of sliders that commit as they
are released, so that its three sliders and two switches are one step to undo. Reset returns to the original and is itself undoable. The stack
holds at most 100 snapshots, dropping the oldest.

### 3.4 Keyboard

| Key                                        | Does                          |
| ------------------------------------------ | ----------------------------- |
| `R` / `Shift+R`                            | Rotate right / left           |
| `H` / `V`                                  | Mirror / flip                 |
| `C`                                        | Crop                          |
| `Ctrl+Z` / `Ctrl+Shift+Z` (`Cmd` on macOS) | Undo / redo                   |
| `Enter` / `Esc`                            | Apply / cancel the open panel |
| Arrow keys (`Shift` for 10px)              | Nudge the region box          |
| `Esc` with no panel open                   | Discard ([§3.5](#35-discard)) |

None of them fires while focus is in a text field, or while one of the editor's own dialogs (the
save dialog, a confirmation) is over it. Only Escape and Enter work while a panel is open, and Enter
not on a button, where it already presses the button. An Escape that closes an open menu — the aspect
ratio's, say — goes no further.

### 3.5 Discard

Closes the editor. When `operations` is empty and `adjust` is at its defaults there is nothing to lose
and it closes at once; otherwise it asks first ("Discard your changes to this image?"). The dialog is
`persistent`, so `Esc` and the backdrop go through this too, rather than closing the editor without
asking.

---

## 4. Actions

Each action is listed with the operation it adds, what it does on the server, and how it is previewed.
Sizes and positions are whole pixels.

### 4.1 Rotate Right, Rotate Left

`{ op: 'rotate', angle: 90 }` / `angle: -90`. Applied at once, no panel. Sharp `rotate(angle)`.
Consecutive quarter turns are merged into one operation in the list, so four presses leave nothing.

### 4.2 Mirror

`{ op: 'flop' }` — left becomes right. Sharp `flop()`. Two in a row cancel out.

### 4.3 Flip

`{ op: 'flip' }` — top becomes bottom. Sharp `flip()`. Two in a row cancel out.

### 4.4 Straighten

A slider from −45° to 45° in tenths of a degree — held to tenths when it is set, since 0.1 steps added
up in floating point drift (`8.000000000000352°` was both shown and about to be sent) — previewed live
with a grid over the image, and a
**fill** for the corners the rotation exposes: transparent (for a format that has transparency),
white, black or a custom colour (`w-color-picker`). **Crop to fit**, on by default, crops to the
largest upright rectangle inside the rotated picture, so no corners are exposed at all.

Adds `{ op: 'rotate', angle, background }`, followed by a `crop` when Crop to fit is on — worked out in
the browser, so the server sees an ordinary crop. Sharp `rotate(angle, { background })`, which enlarges
the canvas to hold the rotated picture.

### 4.5 Crop

Opens the **region box** over the preview (`ImageRegionBox.vue`): a rectangle with eight handles,
dragged to move, the outside dimmed, thirds drawn across it. Pointer events, so mouse, pen and touch
alike; arrow keys nudge it. With an aspect ratio, the side a handle moves leads and the other follows,
and the box is scaled down about its fixed edges until it fits the image. The panel offers:

- **Aspect ratio:** free, original, 1:1, 4:3, 3:2, 16:9, and the portrait form of each.
- **Width and height** fields, kept in step with the box both ways.

Apply adds `{ op: 'crop', left, top, width, height }`. Sharp `extract()`.

The region box is written in-house rather than taken from `cropperjs`: only a rectangle is needed, and
written here it follows the theme, dark mode and the component library.

The dimming is a shadow cast by a hole placed exactly as the box is, in a layer of its own that clips
to the image. Not a shadow on the box itself with the root clipping: that was the first version, and
it cut every handle on an edge of the image in half — which is where a crop's handles start.

### 4.6 Resize

The resize dialog's fields, in the panel: width, height, the ratio lock and the percentage. The logic
moves out of `AssetResizeDialog.vue` into a composable (`useImageSizeFields`) that both use, so the two
cannot drift. As in the dialog, neither side may exceed the current size — the size at that point in
the list, after any crop or rotation before it.

Adds `{ op: 'resize', width, height }`. Sharp `resize(width, height, { fit: 'fill' })`.

### 4.7 Trim

Removes a border of one colour — the white or grey margin round a screenshot. One slider, the
**tolerance** (0–50% of the range a channel can differ by), previewed as the region box showing what
would be kept. The box can still be adjusted by hand before Apply, and the panel says so when there
is no border to find.

Trim is worked out in the browser and adds an ordinary `crop`: the box is found on the preview canvas
by scanning in from each edge for the first pixel differing from the top-left one by more than the
tolerance. So the server needs no trim operation, and the preview and the result cannot disagree. When
the preview is drawn smaller than the image ([§3.2](#32-the-edit-state-and-the-preview)), the box is
scaled up and rounded outwards, so that it can leave a sliver of border but never cut into the
picture.

### 4.8 Pad

Adds space round the picture: four sides, linked by default so one number sets them all, and a fill —
transparent, white, black or custom, as for Straighten.

Adds `{ op: 'extend', top, right, bottom, left, background }`. Sharp `extend()`.

### 4.9 Redact

Hides part of the picture — an email address, a token, a face. Opens the region box as Crop does, plus
a choice of **style**:

- **Fill** (the default): a solid block, in a colour picked as for Pad.
- **Pixelate**: blocks of a size from 8 to 64 pixels.
- **Blur**: a gaussian blur, strength from 5 to 50.

Apply adds `{ op: 'redact', left, top, width, height, style, color?, size? }`, and the panel stays open
for the next region, with the box back in the middle of the image — left where it was, it sat on the
block it had just added and nothing on screen changed. If the block went in the middle, the new box
starts a little down and to the right of it, so that it reads as a second one. On the server the region is extracted and transformed (a solid block for fill;
shrunk to one pixel per block and enlarged again with the `nearest` kernel for pixelate; `blur()`).
It is composited back in two steps: the region is punched out with the `dest-out` blend, then the
patch is laid `over` the hole, so nothing under a half-transparent patch shows through. The `source`
blend would do this in one step, but it clears everything _outside_ the patch too, which is how the
first version of this left a redacted image transparent everywhere else.

**Fill is the default because it is the only one that cannot be undone.** Pixelated or blurred text
can often be read back, by guessing the original and comparing — there are published tools that do
it. The panel says so under the style choice: pixelate and blur are for when it only needs to be
unreadable at a glance.

### 4.10 Adjust

Sliders for **brightness**, **contrast** and **saturation** (each 0–200%, 100% being unchanged), a
**grayscale** switch and a **sharpen** switch. Sets `adjust`, not `operations`
([§3.2](#32-the-edit-state-and-the-preview)).

The server applies them in a fixed order after every operation, chosen to match the CSS filter
functions the preview uses, so that the preview is faithful:

| Setting        | Preview                | Sharp                                                                       |
| -------------- | ---------------------- | --------------------------------------------------------------------------- |
| brightness `b` | `brightness(b)`        | `linear(b, 0)`                                                              |
| contrast `c`   | `contrast(c)`          | `linear(c, 127.5 × (1 − c))`                                                |
| saturation `s` | `saturate(s)`          | `recomb()` with the Filter Effects `saturate` matrix for `s`                |
| grayscale      | `grayscale(1)`         | `recomb()` with the Filter Effects `grayscale` matrix — stays three-channel |
| sharpen        | SVG `feConvolveMatrix` | `sharpen()`                                                                 |

Each setting is its own pass, because a browser clamps between filter functions and two `linear()`
calls in one Sharp pipeline would be one (the second replaces the first). `linear` and `recomb` leave
the alpha channel alone.

Sharpen is the one approximated: the preview's kernel is not what Sharp does. The rest was compared
with Chrome 154 drawing the same image, through both `ctx.filter` and an element's CSS `filter`
(`--force-color-profile=srgb`): every setting on its own agrees with the browser to within one level
in 255, and brightness, contrast, saturation and grayscale chained together to within three.

---

## 5. Backend

### 5.1 `helpers/images.ts`

`editImage(data, { operations, adjust, format, quality })` replaces `resizeImage`, returning the bytes
and the size they came out at. `resizableFormats` is renamed `editableFormats`. The errors are
`imageEditSharpMissing` (503), `imageEditUnreadable` (422), `imageEditTooLarge` (422) and
`imageEditInvalid` (400), plus `imageResizeEnlarge` (400), kept for a `resize` operation. The resize
route's `imageResize*` codes went with it, which nothing outside the backend read.

- **Only the first frame of an animation is read** ([§8](#8-animated-images)): the image is opened
  without `animated`, so its size is the first frame's and decoding yields that frame alone.
- **Every operation is its own pass.** The image is decoded with `autoOrient` into raw RGBA, and each
  operation hands raw pixels to the next, so nothing is compressed until the end. Sharp does not apply
  a pipeline in the order its methods are called (`rotate`, `flip` and `flop` have a fixed place in
  it), so a list in which order matters could not be one pipeline anyway.
- **Replayed as sent.** Merging runs of rotations and mirrors is the editor's job
  ([§4.1](#41-rotate-right-rotate-left)); a merge on the server would also renumber the operations
  that error messages refer to.
- **Every operation is checked before any pixel moves**, against the size the ones before it leave: a
  crop or redaction has to lie inside the image (`imageEditInvalid`, naming the operation by its
  position in the list), a resize may not enlarge it, and no step may take a side past 16383 pixels
  (WebP's limit, the tightest of the four formats) or the image past 100 megapixels — 400 MB of RGBA,
  held raw while it runs (`imageEditTooLarge`).
- `adjust` is applied after the operations, then the result is encoded once as `format`. JPEG has
  transparency flattened onto white first, as the resize does. Anything else that came out fully
  opaque has its alpha channel removed (`stats().isOpaque`), since the image was held with one
  throughout; otherwise an opaque PNG would come out a third larger for nothing.
- **Colour profiles are converted, not kept.** Decoding converts an embedded ICC profile to sRGB:
  a Display P3 pure red decodes as `255,0,0`. So the pixels the result is written from are already
  correct sRGB, and attaching the original profile with `keepIccProfile()` would be _wrong_. The cost
  is that colours outside sRGB are clipped, which is what most screens show anyway. Every other piece of
  metadata is removed, which is Sharp's default and what is wanted: a photo's GPS position should not
  survive an edit.
- `isImageEditingAvailable()` says whether Sharp is installed and loaded, and `countImageFrames(data)`
  how many frames an image has — from its header, decoding nothing — both for the editor's opening
  request ([§6](#6-permissions)).

### 5.2 `models/assets.ts`

`editImage({ siteId, id, operations, adjust, quality, saveAs, unchangedSince, authorId })` replaces
`resizeImage`. It checks the source and target formats (`imageEditUnsupported`), reads the content,
edits it, and either `upload()`s the result as a new file or `replace()`s the original with a fresh
thumbnail and the size the edit reported. `unchangedSince` is compared with the file's `updatedAt`, and
a mismatch is `assetChanged` (409) ([§9](#9-behaviour-worth-pinning-down)). `countFrames(id)` reads the
content and counts its frames.

### 5.3 The routes

`POST /sites/:siteId/assets/:assetId/edit`, in `api/assets.ts`.

```jsonc
{
  "operations": [
    { "op": "rotate", "angle": 90 },
    { "op": "crop", "left": 10, "top": 0, "width": 400, "height": 300 }
  ],
  "adjust": {
    "brightness": 1,
    "contrast": 1.1,
    "saturation": 1,
    "grayscale": false,
    "sharpen": false
  },
  "mode": "replace", // or "saveAs"
  "fileName": "chart-v2.webp", // saveAs only, extension decides the format
  "quality": 85, // JPEG and WebP only
  "unchangedSince": "2026-10-30T09:12:44.120Z" // the file's updatedAt when the editor opened it
}
```

- The schema is a `oneOf` over the operation shapes, each told apart by a `const` on `op`. Colours use
  the `hexcolor` format already registered in `index.ts`. `operations` holds at most 100 entries; the
  list may be empty when only `adjust` changed, but not with `adjust` at its defaults as well — an
  edit that changes nothing is a 400. Every `adjust` field defaults to its neutral value, and `quality`
  to 85.
- `applyImageEdit` holds what the edit and resize routes share, in the same order the resize had: a
  user is required (`requestUserId`), not an API key acting as nobody; `read:assets` on the source, or
  404; `write:assets` at the destination, or 403. No route-level permissions, for the same reason, with
  the same comment. Each route audits on its own.
- Audit entry `editAsset` (kind `asset`), with the source and resulting asset IDs, the mode, the
  operations, `adjust`, and the size before and after. Added to `models/auditLog.ts` and given its
  `admin.audit.actions.editAsset` string.

`GET /sites/:siteId/assets/:assetId/editing` is what the editor asks when it opens
([§6](#6-permissions)): `{ imageEditing, frames, mayReplace, maySaveAs, updatedAt }`. Needs
`read:assets` on the file.

### 5.4 The resize route

`POST …/resize` keeps its contract, and its handler is `applyImageEdit` with one `resize` operation.
Its audit action stays `resizeAsset`, so that filtering the audit log by it goes on finding what it
found before. One thing changes along the way: an animation used to be resized as Sharp's strip and
keep its frames, and now comes out a still of its first frame, like any other edit
([§8](#8-animated-images)). The Resize dialog warns about it as the editor does.

### 5.5 Storage

Nothing stored changes shape: no schema change and no migration.

---

## 6. Permissions

- The **Edit Image...** row is shown for an asset whose type is marked `imageEdit`, when
  `userStore.can('write:assets')` — the same test as the Resize row. It used to sit behind the
  experimental flag with no handler; the flag is gone from it. That answers whether
  `write:assets` is held anywhere; the rule over this file's folder is the server's to check.
- **On opening**, the editor asks the server what the session may do with this file, so that nobody
  edits for five minutes to be refused on save: `GET …/assets/:assetId/editing` answers `mayReplace`
  and `maySaveAs`, from `mayOnAsset(req, 'write:assets', …)` on the file itself and on the name a copy
  is offered under by default (`<name>-edited.<ext>`, beside it). The name actually chosen is checked
  again on save. An option the session may not use is shown disabled in the Save... menu, with a
  tooltip saying why. If neither is allowed the editor does not open, and says so. A route of its own
  rather than fields on `GET …/assets/:assetId`, whose `Asset` shape is shared by every listing.
- **Sharp missing.** The same answer carries `imageEditing: false` when Sharp is not installed, and the
  editor says so and closes before any work is done, rather than letting the person meet the 503 at
  the end. It is not taken from `GET /system/extensions`, which needs `manage:system`.
- **The frame count and `updatedAt`** come with it too: the first so that the editor, its save dialog
  and the Resize dialog can warn that only the first frame of an animation is kept, the second to send
  back as `unchangedSince`.

---

## 7. Saving

### 7.1 The menu

**Save...** opens a menu with two rows: **as a new image...** and **replace the original**. Either one
may be disabled ([§6](#6-permissions)).

### 7.2 As a new image

Opens `AssetEditorSaveDialog.vue`:

- **File name**, prefilled `<name>-edited.<ext>`, validated as in the resize dialog: required, and
  ending in `.png`, `.jpg`, `.jpeg`, `.webp` or `.gif`.
- **Format**, a select of the same four, kept in step with the name's extension both ways — choosing
  WebP rewrites the extension, typing `.png` sets the select.
- **Quality**, 5–100 in steps of 5, default 85, disabled for PNG and GIF with the resize dialog's note
  that they are lossless.
- For an animation, whatever the format, a note that only the first frame is kept.

The new file goes in the same folder and locale, settled by the site's upload conflict behaviour like
any other upload. The name field, its rules and the format follow-through are shared with the resize
dialog rather than copied (`useImageSaveFields`); `setFormat` rewrites the extension, and the select
reads it back, so the format is never held apart from the name the server decides it by.

### 7.3 Replace the original

The same `AssetEditorSaveDialog.vue` in its other mode — a confirmation, not a form:

> **Replace the original?** Every page showing this image will show the edited one. The original
> cannot be recovered afterwards.

…with the quality slider for a JPEG or WebP (and nothing else for PNG or GIF), and **Replace** in the
negative colour. The file keeps its ID, name and format.

Either way the dialog only answers `{ fileName?, quality }`; the editor does the saving, so that a
refused save leaves it open with every edit in place.

### 7.4 After saving

The editor closes, a notification says which file was written, and the file manager lists the folder
again — a new file has to appear, a replaced one has a new size and thumbnail. As `resizeImage(item)`
already does. A refused save leaves the editor open with its state intact, and says why.

---

## 8. Animated images

**Only the first frame of an animated GIF or WebP is edited, and the result is a still image**,
whatever format it is saved as. The editor says so from the moment it opens, in a banner at the top of
the sidebar, and again in the save dialog; the Resize dialog says so too. It knows from the frame count
`GET …/editing` reports ([§6](#6-permissions)), which is read from the file's header.

Every frame used to be edited. It was dropped because it made the server's memory a function of the
frame count: every frame was held raw while the operations ran, and a GIF of a few thousand large
frames is easy to make and cheap to upload, so the 100-megapixel limit was all that stood between one
request and a lot of memory. Editing an animation is also uncommon enough that a still of its first
frame, said up front, is the better trade.

Two things learned along the way, worth keeping if animation is ever taken up again. Read with
`animated: true`, Sharp 0.35 hands over one tall strip of frames, and half of these operations go wrong
on it:

| Operation                                                            | On the strip                                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `extract`, `extend`, `resize`, `flop`, `linear`, `recomb`, `sharpen` | Correct — applied to each frame                                                                      |
| `rotate(90)`, `rotate(-90)`, `rotate(15)`                            | Refused: "Rotate is not supported for multi-page images"                                             |
| `rotate(180)`, `flip()`                                              | **Wrong without an error** — the whole strip is turned over, so the frames come out in reverse order |
| `composite`                                                          | **Wrong without an error** — only the first frame is drawn on                                        |

And decoding each frame on its own (`page: i`), editing it, and encoding the frames back as one raw
strip (`raw.pageHeight`) with the original `delay` and `loop` does work, in GIF and WebP alike. What it
needs is a bound on the frames as well as on their pixels.

---

## 9. Behaviour worth pinning down

- **The preview and the result.** Geometry, trim, pad and redact are exact. Adjust agrees to within
  rounding, sharpen approximately ([§4.10](#410-adjust)). Resampling in a resize can differ by a shade
  between the browser and libvips.
- **JPEG and WebP lose a little each time they are saved.** Rotating a JPEG could in principle be done
  without re-encoding, but Sharp does not do that, and every edit here re-encodes. The quality
  default of 85 keeps this small.
- **Transparency into JPEG** comes out white, as for the resize.
- **The file changed under the editor.** If somebody replaces the file while it is open, the edit is
  applied to their version and its coordinates may no longer fit. The editor sends the `updatedAt` it
  loaded; the server answers 409 if the file has changed since, and the editor offers to reload.
- **Escape inside a panel** cancels the panel, not the editor.
- **A stale editor after a 409** offers Reload, which fetches the file again and starts over with an
  empty history: the edits were worked out on the other version, and replaying them on this one is
  exactly what the check exists to prevent.

---

## 10. Suggested order

1. **Animated images.** Establish what Sharp does with every operation on a multi-page GIF and WebP
   ([§8](#8-animated-images)), since it decides which operations need a special case. _Done. Every
   frame was edited at first, and that was later dropped for the first frame alone._
2. **Backend.** `editImage` in the helper and the model, the shared save path, the route, the
   `editAsset` audit action, and `/resize` moved onto it. _Done._ `dev/scripts/verify-image-edit.ts`
   (`node dev/scripts/verify-image-edit.ts`, Sharp only, no database) checks three sequences where
   order matters against a hand-written reference pixel by pixel, that an animation comes out a
   still of its first frame, the size a rotation by any angle comes out at, the refusals, and that pixelate and blur touch
   nothing outside their region. The Adjust table was checked against Chrome once, by hand
   ([§4.10](#410-adjust)); a browser is not something the script can count on.
3. **The editor shell.** The dialog, the preview, rotate / mirror / flip, undo / redo / reset, the
   keyboard, Discard, and both save paths with their permission checks. The context-menu row loses the
   experimental flag. _Done._
4. **Region box, then Crop, Redact and Trim** — all three build on it. _Done._
5. **Resize** (with `useImageSizeFields` taken out of the resize dialog), **Straighten** and **Pad**.
   _Done; `useImageSaveFields` came out of the resize dialog with it._
6. **Adjust.** _Done._
7. Locale strings for everything above under `fileman.imageEditor*`. _Done._

Being new UI against the component library, with real save round trips, the editor was checked in a
browser on a throwaway instance, light and dark, at 1440px and at 412px. Every panel was driven, a crop
handle dragged, and these round trips confirmed against what the server stored:

- trim → redact → rotate saved as a new PNG: the server received exactly the trim the browser found
  (60, 40, 680 × 420), and stored a 420 × 680 file with the original's top-left colour in its top-right
  corner and black where the redaction was;
- mirror on a three-frame GIF, replacing it: still three frames at 300 ms (when every frame was
  edited; see [§8](#8-animated-images));
- Discard with a change made asks first, then closes;
- the file overwritten through the API while the editor was open: the save got 409 `assetChanged`,
  and Reload brought up the new file with the history cleared.

What that turned up and was fixed: the region box's handles were cut in half on the image's edges
([§4.5](#45-crop)), the straighten angle drifted in floating point ([§4.4](#44-straighten)), and the
header did not fit a phone ([§3.1](#31-layout)).

---

## 11. Later: annotation

Arrows, rectangles, ellipses, text and numbered steps drawn over the image — the most-asked-for thing
for documentation screenshots, and deferred because it is a drawing tool, not an edit. Two ways to
build it, to be weighed when it is taken up:

- **As more operations.** Each shape is an operation (`{ op: 'arrow', from, to, color, width }`), drawn
  on the server as an SVG composited onto the image. It fits the list, undo and the server-side
  encoding as they are, but every shape needs an editor of its own: selecting, moving and restyling a
  shape after it is drawn is most of the work.
- **With Excalidraw**, which the wiki already ships for drawings. A complete drawing tool for free, at
  the cost of its ~405 kB gzipped bundle and of the React quarantine (`frontend/src/editor/excalidraw/`)
  growing a second caller. The image would be an Excalidraw image element under the shapes, and the
  export a PNG.

---

## 12. Open questions

- **Annotation's approach** ([§11](#11-later-annotation)), when it is taken up.
