import { addAPIProvider } from 'iconify-icon'

/**
 * Point Iconify at this wiki instead of the public Iconify API.
 *
 * The `iconify-icon` element resolves `<prefix>:<name>` by asking an API for the icon data, batching
 * every icon a page needs into one request per set and caching the answers in localStorage. Replacing
 * the default provider means that traffic goes to `/_icons` on this instance: icons are served from
 * the wiki's own store, nothing about which pages a reader visits leaks to a third party, and the wiki
 * keeps working when it has no outbound access at all.
 *
 * Importing the package for its side effect is what defines the `<iconify-icon>` custom element.
 */
export function initializeIconify () {
  addAPIProvider('', {
    resources: [`${window.location.origin}/_icons`]
  })
}
