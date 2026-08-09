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
