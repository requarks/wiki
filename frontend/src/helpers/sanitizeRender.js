import sanitizeHtml from 'sanitize-html'
import { sanitizeRender as sanitizeWith } from '@backend/sanitizeRender'

/**
 * Sanitize HTML this browser rendered from a source, before anything puts it on screen.
 *
 * The server sanitizes every render it stores, but a preview never comes from there: an editor's
 * preview, a live note and a visual editor's block are rendered here from the SOURCE, which is
 * whatever its author typed -- or whatever a collaborator is typing right now. Put into the page as
 * it came out of the renderer, an `<img onerror>` in it runs in the session of everybody looking.
 *
 * The rules are the server's own, read from the backend (`backend/helpers/sanitizeRender.ts`), and so
 * is the library: the same pinned `sanitize-html`, handed in here. What the preview shows is therefore
 * what saving it would store, short of what the server does after sanitizing.
 *
 * @param {string} html
 * @param {object} [opts]
 * @param {{ scripts: boolean, styles: boolean }} [opts.permissions] What the session may embed here --
 *   see `renderPermissionsOf`. None, when not given.
 * @param {Array<{ block: string, attributes: string[] }>} [opts.blocks] The blocks that may stay, as
 *   `sites/:siteId/blocks` lists them. A preview passes every one, disabled ones included, since it
 *   shows a disabled block as one; saving is what removes it.
 * @param {boolean} [opts.blobImages] Let an image load from a `blob:` URL -- an editor's pending asset.
 * @returns {string}
 */
export function sanitizeRender(
  html,
  { permissions = { scripts: false, styles: false }, blocks = [], blobImages = false } = {}
) {
  return sanitizeWith(sanitizeHtml, html ?? '', { permissions, blocks, blobImages })
}

/**
 * What the session may embed on the page in front of it, from `userStore.pagePermissions`.
 *
 * @param {string[]} pagePermissions
 * @returns {{ scripts: boolean, styles: boolean }}
 */
export function renderPermissionsOf(pagePermissions) {
  return {
    scripts: pagePermissions.includes('write:scripts'),
    styles: pagePermissions.includes('write:styles')
  }
}
