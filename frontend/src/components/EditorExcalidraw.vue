<template>
  <div class="editor-excalidraw">
    <div ref="canvasEl" class="editor-excalidraw-canvas" />
    <!--
      Over the canvas while the editor is being fetched, and it is a real wait: Excalidraw and React
      together are the largest thing this app loads on demand, so an empty rectangle with no
      explanation is what a slow connection would otherwise show for several seconds.
    -->
    <div v-if="!state.ready" class="editor-excalidraw-veil">
      <w-spinner size="42px" color="primary" />
      <div class="mt-3 text-caption">{{ t('editor.excalidraw.loading') }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { debounce, throttle } from 'es-toolkit/function'

import { useDark } from '@/composables/dark'
import { notify } from '@/composables/notify'
import { collabHandles, startCollabSession, stopCollabSession } from '@/composables/collab'

import { useCollabStore } from '@/stores/collab'
import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { FILES_PREFIX } from '@/helpers/assets'

/*
  Ordinary static imports, though every one of these is large. This component is itself reached by
  `defineAsyncComponent` (`pages/Index.vue`), so its whole import graph is already a chunk nobody
  fetches until a drawing is opened -- and importing them from inside `onMounted` instead would only
  turn one download into a waterfall of them.
*/
import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw'
import {
  exportSceneSvg,
  mountExcalidraw,
  parseScene,
  resolveLangCode,
  serializeScene
} from '@/editor/excalidraw'
import {
  collabElements,
  collabFiles,
  collabParticipants,
  collabScene,
  publishScene,
  readScene,
  seedIfEmpty
} from '@/editor/excalidraw/collab'

/**
 * The Excalidraw editor: a page whose whole body is one drawing.
 *
 * Everything React lives behind `editor/excalidraw/index.js`, which this mounts into a `div` and then
 * talks to through a handle. Read that file first — it covers what a drawing is stored as, and why an
 * image inside one is an asset rather than base64.
 *
 * The contract with the rest of the app is the one every editor here has: the source goes into
 * `pageStore.content`, the HTML a reader will be served goes into `pageStore.setRender`, and
 * `editorStore.lastChangeTimestamp` is what turns the header's Save button on. Nothing about saving
 * happens in this file.
 *
 * The render is the drawing exported as an SVG. It is produced HERE, at edit time, for the same
 * reason the markdown pipeline runs here — a page's HTML is made once, by the browser that changed it,
 * and the server post-processes what arrives. So a reader of a drawing downloads an SVG and none of
 * this: not Excalidraw, not React, not the fonts beyond the glyphs actually lettered on it.
 */

// STORES

const collabStore = useCollabStore()
const commonStore = useCommonStore()
const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// COMPOSABLES

const dark = useDark()

// DATA

const canvasEl = ref(null)

const state = reactive({
  ready: false
})

/**
 * The editor itself, and everything that follows it around.
 *
 * Outside Vue's reactivity on purpose: Excalidraw holds a scene graph and a React tree, and wrapping
 * either in a proxy is both pointless and slow. The same reasoning as `composables/collab.js`.
 */
let handle = null

/** Watchers created after this component's first `await`, which Vue cannot bind to it. See below. */
const collabWatchers = []

/** Whether a session is live and this editor is bound to it. */
let collaborating = false

/** The elements as they were last published, which is what the next publish is diffed against. */
let published = new Map()

/**
 * Set while a change that came from somebody else is being put on the canvas.
 *
 * Excalidraw calls `onChange` for that too, and without this the change would be published straight
 * back to the room it arrived from.
 */
let applyingRemote = false

/**
 * How many pasted images are on their way to being assets.
 *
 * Nothing is written to the page store while this is above zero — see `syncToStore`. An image arrives
 * from Excalidraw as base64 and is turned into an upload a moment later, and a save that landed in
 * between would put the whole picture in the page's source, which is the one thing this editor's
 * handling of images exists to prevent.
 */
let converting = 0

/** File ids that have been through `adoptPastedImages` already, successfully or not. */
const adopting = new Set()

/** Bumped per sync, so a slow export cannot overwrite a newer one. */
let syncToken = 0

// COMPUTED

/**
 * Whether this editor joins a room.
 *
 * The same four questions the other editors ask, and for the same reasons — see `EditorVisual.vue`.
 * A page being created has no id to open a room for.
 */
const collabEnabled = computed(
  () =>
    siteStore.features.collaborativeEditing &&
    userStore.authenticated &&
    editorStore.mode === 'edit' &&
    Boolean(pageStore.id)
)

// METHODS

/**
 * The drawing into the page store: the source a save sends, and the SVG made from it.
 *
 * @param {boolean} touch Whether this counts as an EDIT. True for everything the author does, and
 *   false for the one write that happens before they have done anything — see `onMounted`. Opening an
 *   editor sets `lastChangeTimestamp` and `lastSaveTimestamp` to the same instant, which is how "no
 *   unsaved changes" is spelled, so a mount-time write that touched the first of them would offer to
 *   save a drawing nobody had drawn on and ask about discarding it on the way out.
 */
async function writeToStore({ touch }) {
  if (!handle || converting > 0) {
    return
  }
  const token = ++syncToken
  const scene = handle.getScene()
  const content = serializeScene(scene)
  let render = ''
  try {
    render = await exportSceneSvg(scene)
  } catch (err) {
    /*
      The source is still good, so the page is still saveable -- it is the picture a reader would be
      served that is missing. Reported rather than swallowed, because the alternative is a page that
      saves and then displays nothing, with nothing anywhere to say why.
    */
    console.error('Failed to export the drawing as SVG', err)
    notify({ type: 'negative', message: t('editor.excalidraw.exportFailed') })
    return
  }
  // -> A newer change finished while this export was running; its answer is the current one
  if (token !== syncToken) {
    return
  }
  pageStore.$patch({
    content,
    // -> What the author has drawn IS the source, whatever the load did or did not deliver; see the
    //    guard in `pageSave`
    contentLoaded: true
  })
  pageStore.setRender(render)
  if (touch) {
    editorStore.lastChangeTimestamp = Temporal.Now.instant()
  }
}

/**
 * The same, on the author's clock.
 *
 * Debounced, because Excalidraw reports every change as it happens — a line is a change per frame
 * while it is being drawn — and both halves of `writeToStore` are whole-document work.
 *
 * It is also the only thing that sets `lastChangeTimestamp`, which is what makes the Save button
 * possible. That ordering is the guarantee: the button cannot be pressed before this has run, so a
 * save always sends a source and a render that go together. It is also why the pending-image guard is
 * a reason to do nothing rather than to do half of it.
 */
const syncToStore = debounce(() => writeToStore({ touch: true }), 600)

/**
 * One change from the canvas.
 *
 * Three separate jobs, on three different clocks: the room hears about it almost at once, the page
 * store a moment later, and a pasted image is dealt with as soon as it is noticed.
 */
function onChange() {
  if (applyingRemote) {
    return
  }
  adoptPastedImages()
  publish()
  syncToStore()
}

/**
 * This author's changes into the shared document.
 *
 * Throttled rather than debounced: the others should see a line being drawn as it is drawn, so this
 * has to fire DURING a burst of changes and not after it. Trailing, so the last frame of a stroke is
 * never the one that gets dropped.
 */
const publish = throttle(() => {
  if (!collaborating || !handle) {
    return
  }
  const handles = collabHandles()
  if (handles) {
    published = publishScene(handles.ydoc, handle.getScene(), published)
  }
}, 100)

/** Where this author's pointer is, for everybody else's canvas. Throttled for the same reason. */
const publishPointer = throttle((payload) => {
  const handles = collabHandles()
  if (!collaborating || !handles) {
    return
  }
  handles.awareness.setLocalStateField('pointer', payload?.pointer ?? null)
  handles.awareness.setLocalStateField('button', payload?.button ?? 'up')
}, 80)

/**
 * Turn an image Excalidraw has just taken in into one of the wiki's assets.
 *
 * Excalidraw stores a pasted or dropped picture as base64 on a `files` entry, which is what would end
 * up in the page's source — a megabyte screenshot in a text column, in every version of the page for
 * ever, and again in the SVG every reader is served. So it is registered as a pending asset the way
 * the markdown editor registers a pasted one, and the file entry is repointed at the blob URL that
 * comes back; the upload that runs just before a save turns that into a path.
 *
 * The entry is repointed by giving the image a NEW file id rather than by correcting the old one:
 * `addFiles` deliberately leaves an id it already holds alone, so the only way to change what an image
 * element refers to is to make it refer to something else. The abandoned entry is not cleaned up and
 * does not need to be — `serializeScene` keeps only the files an element actually uses.
 */
function adoptPastedImages() {
  for (const [id, file] of Object.entries(handle.getScene().files)) {
    /*
      `adopting` is what stops the same picture being uploaded several times over. This runs on every
      change, and the base64 entry is still there for the whole of the round trip below -- so without
      it, moving the image that was just dropped would start a second upload of it, and dragging it
      across the canvas would start a dozen.
    */
    if (!String(file?.dataURL ?? '').startsWith('data:') || adopting.has(id)) {
      continue
    }
    adopting.add(id)
    converting++
    replaceWithAsset(id, file)
      .catch((err) => {
        // -> Left in `adopting`, so a failure is not retried on every mouse move for the rest of the
        //    session. The picture stays on the canvas as base64 and the save is what refuses it
        console.error('Failed to take in an image dropped on the drawing', err)
        notify({ type: 'negative', message: t('editor.excalidraw.imageFailed') })
      })
      .finally(() => {
        converting--
        // -> The store was held back while this ran, so it is asked again now that it may proceed
        syncToStore()
      })
  }
}

/** Swap one base64 file entry for an upload, and point the image elements at the new one. */
async function replaceWithAsset(fileId, file) {
  const blob = await (await fetch(file.dataURL)).blob()
  const nextId = repointFile(fileId, { ...file, dataURL: editorStore.addPendingAsset(blob) })
  adopting.add(nextId)
}

/**
 * Give a file a new id carrying `next`, and move every element that used the old one onto it.
 *
 * A new id rather than a corrected entry because `addFiles` deliberately ignores an id it already
 * holds, so the only way to change what an image refers to is to make it refer to something else. The
 * entry left behind is not cleaned up and does not need to be: `serializeScene` keeps only the files
 * an element actually uses.
 *
 * @returns {string} The new file id.
 */
function repointFile(fileId, next) {
  const nextId = `${fileId}~${Date.now().toString(36)}`
  handle.addFiles([{ ...next, id: nextId }])
  handle.updateScene({
    elements: handle
      .getScene()
      .elements.map((el) => (el.fileId === fileId ? newElementWith(el, { fileId: nextId }) : el))
  })
  return nextId
}

/**
 * Rewrite the blob URLs of pending assets, once the upload has given them real paths.
 *
 * Runs from `UploadPendingAssetsDialog`, immediately before the page is saved, and everything it does
 * has to be finished by the time it returns — the same requirement the markdown editor's copy of this
 * documents, and the reason both of them work in place rather than waiting for a timer.
 *
 * The page's SOURCE is not touched here: the dialog has already rewritten it, which it can do because
 * a stored path is exactly the string it put in. The render cannot be left to the dialog in the same
 * way — the SVG refers to an image by the URL a browser fetches it from, not by the path a page stores
 * — so it is rewritten here, as a string, which is what makes this synchronous. Re-exporting the SVG
 * would be the obvious alternative and is the wrong one: it is asynchronous, and the save that follows
 * would not wait for it.
 */
function reloadEditorContent({ replacements = [] } = {}) {
  if (replacements.length === 0 || !handle) {
    return
  }
  const urls = new Map(
    replacements.map(({ from, to }) => [from, `${FILES_PREFIX}${String(to).replace(/^\//, '')}`])
  )

  // -> The canvas keeps drawing from the uploaded file rather than from a blob the dialog is about
  //    to revoke out from under it
  for (const [id, file] of Object.entries(handle.getScene().files)) {
    const url = urls.get(file?.dataURL)
    if (url) {
      adopting.add(repointFile(id, { ...file, dataURL: url }))
    }
  }

  let render = pageStore.render
  for (const [from, to] of urls) {
    render = render.replaceAll(from, to)
  }
  pageStore.setRender(render)
}

/** Take the room's drawing onto this canvas. */
function applyRemote() {
  const handles = collabHandles()
  if (!handles || !handle) {
    return
  }
  const { elements, files, appState } = readScene(handles.ydoc)
  applyingRemote = true
  try {
    handle.addFiles(Object.values(files))
    /*
      `NEVER` keeps a change that arrived from somebody else off this author's undo stack, which would
      otherwise offer to undo a shape they did not draw -- the same reason the Visual editor takes its
      undo from Yjs rather than from ProseMirror.
    */
    handle.updateScene({ elements, appState, captureUpdate: CaptureUpdateAction.NEVER })
    published = new Map(elements.map((el) => [el.id, el]))
  } finally {
    applyingRemote = false
  }
  // -> The store follows what is now on the canvas, which is not what this browser loaded
  syncToStore()
}

/** Everyone else's cursors. Excalidraw draws them itself, given the map. */
function refreshCollaborators() {
  const handles = collabHandles()
  if (handles && handle) {
    handle.updateScene({ collaborators: collabParticipants(handles.awareness) })
  }
}

/**
 * Join the room, once the editor exists to be bound to it.
 *
 * The drawing the room holds REPLACES the one this browser loaded, including anything unsaved that
 * somebody else has done to it, which is why `seedIfEmpty` only fills a room that is genuinely empty.
 */
function enableCollab() {
  const handles = collabHandles()
  if (!handles || !handle) {
    return
  }
  seedIfEmpty(handles.ydoc, handle.getScene())
  collaborating = true

  const onDocChange = (events, transaction) => {
    // -> Not this browser's own writes coming back round
    if (!transaction.local) {
      applyRemote()
    }
  }
  collabElements(handles.ydoc).observeDeep(onDocChange)
  collabFiles(handles.ydoc).observeDeep(onDocChange)
  collabScene(handles.ydoc).observeDeep(onDocChange)
  handles.awareness.on('change', refreshCollaborators)

  applyRemote()
  refreshCollaborators()
}

// LIFECYCLE

onMounted(async () => {
  editorStore.$patch({ hideSideNav: true })

  handle = await mountExcalidraw(canvasEl.value, {
    initialScene: parseScene(pageStore.content),
    theme: dark.isActive ? 'dark' : 'light',
    langCode: resolveLangCode(commonStore.locale),
    onChange,
    onPointerUpdate: publishPointer
  })
  state.ready = true

  EVENT_BUS.on('reloadEditorContent', reloadEditorContent)

  /*
    Live collaboration. Unlike the text editors there is nothing to lock while the room answers: a
    drawing is not a document somebody is typing into the middle of, and a shape drawn a moment before
    the room arrives is merged rather than overwritten -- it is one more element in a map of them.
  */
  if (collabEnabled.value) {
    startCollabSession({ siteId: siteStore.id, pageId: pageStore.id })
    /*
      Stopped by hand on the way out. This hook is `async`, so everything after its first `await` runs
      with no component instance current and Vue has nothing to bind these to -- see the same note in
      `EditorVisual.vue`, where leaving them running reached into the next session's editor.
    */
    collabWatchers.push(
      watch(
        () => collabStore.status,
        (status) => {
          if (status === 'connected') {
            enableCollab()
          }
          if (status === 'denied') {
            notify({ type: 'warning', message: t('editor.collab.notAllowed') })
          }
        }
      ),
      watch(
        () => collabStore.lastSave,
        (lastSave) => {
          if (lastSave && lastSave.authorId !== userStore.id) {
            notify({
              type: 'positive',
              message: t('editor.collab.savedBy', { name: lastSave.authorName })
            })
          }
        }
      )
    )
  }

  /*
    The store gets the source and the render before anything is drawn. A page opened and saved without
    an edit must not go up with whatever was in the store before it, and a page being created has
    neither until this runs. Not an edit, so it does not touch the change clock -- see `writeToStore`.
  */
  await writeToStore({ touch: false })
})

/*
  The canvas follows the reader's own theme. A drawing is stored once and drawn in both, so this is
  the editor matching the app around it rather than anything about the page.
*/
watch(
  () => dark.isActive,
  (isDark) => handle?.setTheme(isDark ? 'dark' : 'light')
)

onBeforeUnmount(() => {
  // -> Anything still pending is dropped: the editor is going, and the store must not be written to
  //    after the page has moved on
  syncToStore.cancel()
  publish.cancel()
  publishPointer.cancel()
  // -> First, because everything below is what they reach for
  for (const stop of collabWatchers.splice(0)) {
    stop()
  }
  // -> Before the editor goes: leaving the room is what takes this author's cursor off everyone
  //    else's canvas
  stopCollabSession()
  collaborating = false
  EVENT_BUS.off('reloadEditorContent', reloadEditorContent)
  handle?.destroy()
  handle = null
})
</script>

<style lang="scss">
.editor-excalidraw {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;

  &-canvas {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* -> Over the canvas rather than instead of it: Excalidraw is mounting behind this the whole time */
  &-veil {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 1rem;

    @at-root .body--light & {
      background-color: #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
    }
  }
}
</style>
