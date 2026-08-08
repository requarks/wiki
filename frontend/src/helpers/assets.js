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
