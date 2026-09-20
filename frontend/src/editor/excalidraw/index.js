// -> First, and deliberately: it has to run before Excalidraw does. See the file itself.
import './assetPath.js'

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Excalidraw, exportToSvg, languages, serializeAsJSON } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

import { FILES_PREFIX } from '@/helpers/assets'

/**
 * The Excalidraw drawing surface, as one function that puts it on the page and hands back a handle.
 *
 * Excalidraw is a React application and this wiki is a Vue one, so the whole of React lives behind
 * this module and nothing outside it imports either. `EditorExcalidraw.vue` owns a `<div>` and calls
 * `mountExcalidraw` on it; what comes back is a plain object of methods. There is no JSX anywhere —
 * `createElement` is what one component needs and it costs no build step to call it directly.
 *
 * Nothing here is in the app's bundle. The Vue component that reaches this is loaded by
 * `defineAsyncComponent`, so React, Excalidraw and their stylesheet are fetched the first time
 * somebody opens a drawing, and never at all on a wiki that has none. A READER of a drawing does not
 * come through here either: what a page stores is the SVG exported at save time, which is ordinary
 * markup that needs none of this to display.
 *
 * ## What a drawing is stored as
 *
 * `.excalidraw`, the format Excalidraw itself writes — `serializeAsJSON`, unchanged — so a page's
 * source opens in any Excalidraw and a file exported from one opens here. See `PAGE_FILE_EXTENSIONS`
 * on the server for the extension that follows from it.
 *
 * ## What happens to an image inside a drawing
 *
 * Excalidraw keeps images in a `files` map beside the elements, each holding a `dataURL` it hands
 * straight to an `Image`. Left alone that is a base64 copy of every picture inside the page's own
 * source, which would put a megabyte screenshot in the `content` column and in every version of the
 * page for ever after.
 *
 * So it holds a URL instead, which works because nothing about that field requires a `data:` — the
 * editor assigns it to `img.src` and the SVG export writes it as an `href`. A picture is uploaded to
 * the wiki's asset store like any other, and the two sides of that are the two functions at the bottom
 * of this file: `toStoredPath` writes the site-relative path the rest of the wiki stores (see
 * `helpers/assets.js` for why a path and not a URL), and `toLiveUrl` turns it back into something a
 * browser can fetch. An image the author has just pasted is a `blob:` URL under both, until the upload
 * that runs just before a save replaces it.
 */

/** The padding around a drawing in the exported SVG, in Excalidraw's own units. */
const EXPORT_PADDING = 8

/**
 * The scene an empty drawing starts from.
 *
 * `null` rather than a number for `gridSize`: that is how Excalidraw spells "no grid", and a zero
 * there draws a grid with no spacing.
 */
const EMPTY_SCENE = {
  elements: [],
  appState: { viewBackgroundColor: '#ffffff', gridSize: null },
  files: {}
}

/**
 * Excalidraw's UI language for one of this wiki's locale codes.
 *
 * Exact match first, then the language without its region — the wiki says `fr` where Excalidraw says
 * `fr-FR`, and meeting halfway is better than English for both. English for anything else, which is
 * also what Excalidraw falls back to on a code it does not know.
 */
export function resolveLangCode(locale) {
  const code = String(locale || '').trim()
  if (!code) {
    return 'en'
  }
  const codes = languages.map((lang) => lang.code)
  if (codes.includes(code)) {
    return code
  }
  const base = code.split('-')[0].toLowerCase()
  return codes.find((c) => c.toLowerCase().split('-')[0] === base) ?? 'en'
}

/**
 * A stored drawing, as the three things Excalidraw is given.
 *
 * Anything that will not parse comes back as an empty scene rather than throwing. A page whose source
 * is damaged should open on a blank canvas the author can draw on, not an editor that refuses to
 * appear — and the source is still in the page's history either way.
 */
export function parseScene(content) {
  if (!content || !content.trim()) {
    return structuredClone(EMPTY_SCENE)
  }
  let parsed = null
  try {
    parsed = JSON.parse(content)
  } catch {
    return structuredClone(EMPTY_SCENE)
  }
  return {
    elements: Array.isArray(parsed?.elements) ? parsed.elements : [],
    appState: { ...EMPTY_SCENE.appState, ...parsed?.appState },
    files: filesWith(parsed?.files ?? {}, toLiveUrl)
  }
}

/**
 * The source a save sends, in Excalidraw's own format.
 *
 * `serializeAsJSON` is what drops the elements a delete left behind and the parts of `appState` that
 * belong to whoever was looking at it — the scroll position, the zoom, what was selected — so what is
 * stored is the drawing rather than one author's view of it.
 */
export function serializeScene({ elements, appState, files }) {
  return serializeAsJSON(elements, appState, filesWith(files ?? {}, toStoredPath), 'local')
}

/**
 * A drawing as an SVG, which is what the page stores as its render and every reader is served.
 *
 * `skipInliningFonts` matters twice over. It keeps a base64 copy of a subsetted font out of every
 * drawing on the wiki — the same font, again, in every page that uses it — and it is what keeps the
 * fonts the app already ships as the ones a drawing is lettered in. It also avoids loading the font
 * subsetter, which is a megabyte of WebAssembly-in-JavaScript that nothing else here has any use for.
 *
 * The empty `<style>` Excalidraw leaves behind when it inlines nothing goes too: the sanitizer would
 * strip it from any author without `write:styles` anyway, and a page's stored HTML should not carry an
 * element that says nothing.
 *
 * **The drawing is exported LIGHT, whatever theme it was drawn in.** Excalidraw does dark mode by
 * inverting the finished picture rather than by recolouring what is in it, and on an export that means
 * a `filter` baked onto the root element. Stored that way, a drawing made at night would be inverted
 * for every reader for ever — right on a dark page, and a photographic negative on a light one. There
 * is one stored render and two themes to serve it in, so it is stored as the artwork and the page
 * applies the same inversion in CSS when the reader is in the dark: `svg.excalidraw-render` in
 * `_page-contents.scss` carries Excalidraw's own filter, and the two have to stay in step.
 */
export async function exportSceneSvg({ elements, appState, files }) {
  const svg = await exportToSvg({
    elements: (elements ?? []).filter((el) => !el.isDeleted),
    appState: { ...appState, exportBackground: false, exportWithDarkMode: false, theme: 'light' },
    files: files ?? {},
    exportPadding: EXPORT_PADDING,
    skipInliningFonts: true
  })
  for (const style of svg.querySelectorAll('style')) {
    if (!style.textContent.trim()) {
      style.remove()
    }
  }
  /*
    Sized by the drawing and laid out by the page. Excalidraw writes the drawing's own dimensions onto
    the element, which in an article is a picture that refuses to shrink on a narrow screen; the
    viewBox it also writes is what actually carries the shape, so handing the width over to CSS scales
    it instead of cropping it. Kept in `.page-contents`, with the rest of the content typography.
  */
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.setAttribute('class', 'excalidraw-render')
  return svg.outerHTML
}

/**
 * Put the editor on the page.
 *
 * @param {HTMLElement} container An element with a size — Excalidraw fills it and measures itself
 *   against it, so a box that collapses to nothing draws a canvas of nothing.
 * @param {object} options
 * @param {object} options.initialScene From `parseScene`.
 * @param {string} options.theme `light` or `dark`.
 * @param {string} options.langCode From `resolveLangCode`.
 * @param {Function} options.onChange `(elements, appState, files)`, on every change including ones
 *   this wiki made itself — see the guard in `EditorExcalidraw.vue`.
 * @param {Function} [options.onPointerUpdate] `({ pointer, button })`, for a collaborative session's
 *   cursors. Called on every mouse move, so whatever it does has to be cheap.
 * @returns {object} The handle: `api` is Excalidraw's own, and the rest is what this wiki needs of it.
 */
export function mountExcalidraw(
  container,
  { initialScene, theme, langCode, onChange, onPointerUpdate }
) {
  const root = createRoot(container)
  let api = null

  return new Promise((resolve) => {
    root.render(
      createElement(Excalidraw, {
        initialData: {
          ...initialScene,
          // -> The canvas fits the drawing when it opens, which for a page somebody is coming back
          //    to is the whole of it rather than wherever the last author happened to be looking
          scrollToContent: true
        },
        theme,
        langCode,
        onChange,
        onPointerUpdate,
        excalidrawAPI: (instance) => {
          api = instance
          resolve(handle)
        },
        UIOptions: {
          canvasActions: {
            // -> The page is saved by the wiki's own header, and the rest of this menu offers ways to
            //    put a drawing somewhere that is not this page
            saveToActiveFile: false,
            loadScene: false,
            export: false,
            saveAsImage: true,
            toggleTheme: false
          }
        }
      })
    )

    const handle = {
      get api() {
        return api
      },
      /** The scene as it stands, which is what a save and an export are both taken from. */
      getScene() {
        return {
          elements: api?.getSceneElementsIncludingDeleted() ?? [],
          appState: api?.getAppState() ?? {},
          files: api?.getFiles() ?? {}
        }
      },
      updateScene(scene) {
        api?.updateScene(scene)
      },
      addFiles(files) {
        api?.addFiles(files)
      },
      /** Redraw in the other theme, for a reader who switches while the editor is open. */
      setTheme(next) {
        api?.updateScene({ appState: { theme: next } })
      },
      destroy() {
        // -> Asynchronously, because React refuses to unmount a root from inside a render or an effect
        //    it is currently running, which is exactly where a Vue component being torn down can be
        setTimeout(() => root.unmount(), 0)
      }
    }
  })
}

// ----------------------------------------
// Where an image in a drawing actually lives
// ----------------------------------------

/** Run every file's `dataURL` through `map`, leaving the rest of each entry alone. */
function filesWith(files, map) {
  return Object.fromEntries(
    Object.entries(files ?? {}).map(([id, file]) => [id, { ...file, dataURL: map(file?.dataURL) }])
  )
}

/**
 * What a page stores for an image: the site-relative path, as everything else in this wiki stores one.
 *
 * A `blob:` URL is left as it is. That is an image pasted in this session and not yet uploaded, and
 * rewriting it is the upload's job — see `UploadPendingAssetsDialog`, which does the same to the
 * source of a markdown page.
 */
export function toStoredPath(url) {
  const value = String(url ?? '')
  return value.startsWith(FILES_PREFIX) ? `/${value.slice(FILES_PREFIX.length)}` : value
}

/** And back: what the browser actually fetches the image from. */
export function toLiveUrl(path) {
  const value = String(path ?? '')
  return value.startsWith('/') ? `${FILES_PREFIX}${value.slice(1)}` : value
}
