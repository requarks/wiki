/**
 * Where Excalidraw fetches its own assets from, declared before Excalidraw itself is loaded.
 *
 * A side-effect module with one statement in it, rather than a line at the top of `index.js`, because
 * a static import is evaluated before the body of the module that writes it. ES modules evaluate in
 * the order they are imported, so naming this one first is what makes it run first.
 *
 * Without it Excalidraw fetches every font it draws with from a CDN. Note it appends that CDN as a
 * fallback even WITH this set, so this only moves the first attempt — what keeps a reader's browser
 * from reaching the internet is the build shipping the complete set of fonts, which is
 * `excalidrawAssets` in `vite.config.js`. The two have to name the same path, and this is one half of
 * it (`EXCALIDRAW_ROUTE` is the other).
 */
window.EXCALIDRAW_ASSET_PATH = '/_assets/excalidraw/'
