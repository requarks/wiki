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
import { MarkdownRenderer } from './markdown'

/**
 * A page's source, rendered the way the editor that wrote it would have rendered it.
 *
 * Which pipeline is the caller's to say. A source is not self-describing — the server holds the
 * editor in a column and passes it in, and guessing from the text would be guessing.
 *
 * Asciidoctor is reached through a dynamic import, so the chunk it lives in is fetched the first time
 * an AsciiDoc page is rendered and never on an instance that has none. It is roughly as large as
 * everything else in this bundle put together, and most wikis will never ask for it.
 *
 * @param {string} content The page source
 * @param {object} config The site's config for that editor, so the result matches what an author
 *                        would have produced in it
 * @param {object} context What the source cannot say about itself: `pagePath`, which a relative image
 *                         in it resolves against, and `editor`, which picks the pipeline
 * @returns {Promise<string>} Rendered HTML, before the server's own post-processing
 */
window.__wikiRender = async function (content, config = {}, context = {}) {
  const { editor = 'markdown', ...rest } = context
  if (editor === 'asciidoc') {
    const { AsciidocRenderer } = await import('./asciidoc')
    return new AsciidocRenderer(config).render(content ?? '', rest)
  }
  return new MarkdownRenderer(config).render(content ?? '', rest)
}

// -> Polled by the caller: a module script is deferred, so the page can be "loaded" before this ran
window.__wikiRenderReady = true
