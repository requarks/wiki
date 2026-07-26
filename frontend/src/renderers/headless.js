/**
 * Headless rendering entry point.
 *
 * The server cannot render markdown — the pipeline lives here, in the browser, and duplicating it
 * would mean two renderers that drift apart and an editor preview that stops matching the saved page.
 * So when the server needs to re-render a page from its source, it drives a real browser instead:
 * Puppeteer loads the `/_render` shell, which loads this bundle, and calls `__wikiRender`.
 *
 * Built to a fixed filename (`_assets/renderer.js`, see `vite.config.js`) because the backend has to
 * reference it from a static page and cannot resolve a hashed one.
 */
import { MarkdownRenderer } from './markdown'

/**
 * Render markdown the way the editor does.
 *
 * @param {string} content Markdown source
 * @param {object} config The site's markdown editor config, so the result matches what an author
 *                        would have produced in the editor
 * @returns {string} Rendered HTML, before the server's own post-processing
 */
window.__wikiRender = function (content, config = {}) {
  const renderer = new MarkdownRenderer(config)
  return renderer.render(content ?? '')
}

// -> Polled by the caller: a module script is deferred, so the page can be "loaded" before this ran
window.__wikiRenderReady = true
