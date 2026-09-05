/**
 * How a page's source points at an uploaded file.
 *
 * From the site root, so that the path says where the file is rather than where it is being written
 * about: a page that later moves to another folder keeps pointing at the same picture, which a path
 * relative to the page's own folder would not.
 *
 * The renderer resolves it to the `/_files/` URL this server answers, at render time -- see `fileSrc`
 * in `renderers/markdown.js` -- so what is stored is a path anybody can read rather than the shape
 * this instance happens to serve files under. That resolution also accepts a path relative to the
 * page, which is what markdown written for a repository uses, so imported content keeps working; this
 * is only about what the wiki's own editors write.
 */

/**
 * @param {string} folderPath Folder the asset sits in, slash-separated, empty at the site root.
 * @param {string} fileName The asset's stored file name.
 * @returns {string} A path from the site root, e.g. `/media/photo.png`.
 */
export function assetPath(folderPath, fileName) {
  return folderPath ? `/${folderPath}/${fileName}` : `/${fileName}`
}

/**
 * Which folder a file pasted or dropped into the editor is filed in.
 *
 * The site's `uploads.pastedDestination` decides, and it has three forms — see the setting in the admin
 * area's General section:
 *
 * - **empty**: the page's own folder, so a screenshot sits beside the page that shows it.
 * - **relative** (`assets`): a folder under the page's own, per page.
 * - **absolute** (`/media/uploads`): from the site root, so every page's pasted files land together.
 *
 * The leading slash is the whole of what separates the last two, which is why the setting keeps one.
 * `/` alone is therefore the site root, and is a different answer from empty.
 *
 * Nothing here checks that the folder exists: the upload creates what it needs. `.` and `..` segments
 * are dropped rather than followed — in a wiki tree they name a literal folder, never a parent — which
 * matches what the upload route does with whatever it is sent.
 *
 * @param {string} destination The site's `uploads.pastedDestination`.
 * @param {string} pageFolderPath The folder the page being edited is in, empty at the site root.
 * @returns {string} A folder path from the site root, empty for the root itself.
 */
export function pastedAssetFolder(destination, pageFolderPath) {
  const configured = (destination ?? '').trim()
  const base = configured.startsWith('/') ? '' : (pageFolderPath ?? '')
  return [base, configured]
    .join('/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/')
}

/** Where uploaded files are served from — `backend/controllers/files.ts`. */
export const FILES_PREFIX = '/_files/'

/**
 * Where an uploaded file actually loads from.
 *
 * The other half of the pair: `assetPath` is what a page's source stores and this is what it resolves
 * to, so anything handing a file straight to a browser -- a link to copy, an `<img>` built outside the
 * renderer -- uses this one. Writing it into a page instead would nail the content to the shape this
 * server happens to serve files under.
 *
 * @param {string} folderPath Folder the asset sits in, slash-separated, empty at the site root.
 * @param {string} fileName The asset's stored file name.
 * @returns {string} A root-relative URL, e.g. `/_files/media/photo.png`.
 */
export function assetUrl(folderPath, fileName) {
  return `${FILES_PREFIX}${folderPath ? `${folderPath}/${fileName}` : fileName}`
}

/**
 * Where an uploaded file's bytes come from when it is addressed by ID rather than by path.
 *
 * The API's own download route, which `/_api` fronts and the session cookie authenticates -- so it
 * can be handed straight to an `<img>`. Preferred over `assetUrl` wherever the ID is in hand: a path
 * exists once per locale and carries none, so `/_files/` answers with the primary locale's file of
 * that name, which is a different file whenever another locale is being browsed.
 *
 * @param {string} siteId UUID of the site the asset belongs to.
 * @param {string} assetId UUID of the asset.
 * @returns {string} A root-relative URL.
 */
export function assetContentUrl(siteId, assetId) {
  return `/_api/sites/${siteId}/assets/${assetId}/content`
}
