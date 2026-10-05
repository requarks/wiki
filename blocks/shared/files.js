/**
 * File addresses, for blocks.
 *
 * Shared because more than one block takes a picture by its path, and an author who learned to write
 * one in one block should not have to learn it again in the next.
 */

/** Where an uploaded file is served from, and so what a bare path is taken to mean. */
const FILES_PREFIX = '/_files/'

/**
 * An address that already says where it points: a full URL, a protocol-relative one, a data URI —
 * or one of the wiki's own `/_` routes, `/_files/` among them.
 */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/_)/i

/**
 * The address a path written into a block points at.
 *
 * Anything that names its own location is left exactly as written. Everything else is a path into the
 * file manager, which is where the images on a wiki page live — so `photos/summer.jpg` and
 * `/photos/summer.jpg` both mean `/_files/photos/summer.jpg`, and an author can paste the path the
 * file manager shows without having to remember the prefix. Wiki routes are spared that: they all
 * start with `/_`, and `/_files/` is one of them, so a path already carrying the prefix is not given
 * a second one.
 *
 * @param {string} value
 * @returns {string}
 */
export function resolveFilePath(value) {
  const address = value.trim()
  if (ABSOLUTE.test(address)) {
    return address
  }
  return FILES_PREFIX + address.replace(/^\/+/, '')
}
