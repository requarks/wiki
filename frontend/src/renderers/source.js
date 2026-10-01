import { MarkdownRenderer } from './markdown'

/**
 * A page's source, rendered the way the editor that wrote it would have rendered it.
 *
 * Shared by the two things that render a page away from its editor: the headless bundle Puppeteer
 * drives (`headless.js`) and the admin area's Rerender All Pages, which runs in the admin's own
 * browser so that an instance without Puppeteer can re-render too. One function, so that the two can
 * never produce different HTML for the same page.
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
export async function renderSource(content, config = {}, context = {}) {
  const { editor = 'markdown', ...rest } = context
  if (editor === 'asciidoc') {
    const { AsciidocRenderer } = await import('./asciidoc')
    return new AsciidocRenderer(config).render(content ?? '', rest)
  }
  return new MarkdownRenderer(config).render(content ?? '', rest)
}
