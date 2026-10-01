/**
 * Headless rendering entry point.
 *
 * The server cannot render a page — the pipelines live here, in the browser, and duplicating one
 * would mean two renderers that drift apart and an editor preview that stops matching the saved
 * page. So when the server needs to re-render a page from its source, it drives a real browser
 * instead: Puppeteer loads the `/_render` shell, which loads this bundle, and calls `__wikiRender`.
 *
 * Built to a fixed filename (`_assets/renderer.js`, see `vite.config.js`) because the backend has to
 * reference it from a static page and cannot resolve a hashed one.
 */
import { renderSource } from './source'

/** See `renderSource`, which the admin area's Rerender All Pages calls too. */
window.__wikiRender = renderSource

// -> Polled by the caller: a module script is deferred, so the page can be "loaded" before this ran
window.__wikiRenderReady = true
