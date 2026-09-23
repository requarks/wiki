import { BlobReader, TextWriter, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

/**
 * Reading a `.wkbackup` package in the browser.
 *
 * The format is `dev/specs/wkbackup.md`; §12 of it is the contract for the records this yields. The
 * package is never uploaded — the browser holds the `File`, walks it, and drives the import API a
 * batch at a time — so everything here is about getting at one part of a possibly enormous archive
 * without materialising the rest.
 *
 * ZIP earns its keep for exactly that reason: a local `File` is a `Blob` with random access, so the
 * central directory at the end of the file is an asset rather than the liability it is over a socket.
 * `manifest.json` is readable in the first second whatever the other eight gigabytes weigh.
 *
 * `@zip.js/zip.js` runs inflation in a pool of workers of its own, which is the part that would jank
 * the log this is drawing. What is left on the main thread is a line split and a `JSON.parse` per
 * batch, between uploads that dominate the wall clock by orders of magnitude.
 */

/** Refused by the reader rather than by the server, since the server never sees the file. */
export class PackageError extends Error {}

/**
 * Open a package and read its manifest.
 *
 * @returns `{ manifest, entry(path), has(path), close() }`. `entry` is how every other function here
 *          is reached — a stream is named by the manifest, never guessed at from a convention.
 */
export async function openPackage(file) {
  const reader = new ZipReader(new BlobReader(file))
  let entries
  try {
    entries = await reader.getEntries()
  } catch (err) {
    await reader.close().catch(() => {})
    throw new PackageError(
      `This file could not be opened as a Wiki.js backup package. (${err.message})`
    )
  }

  const byName = new Map()
  for (const entry of entries) {
    if (!entry.directory) {
      byName.set(entry.filename, entry)
    }
  }

  const manifestEntry = byName.get('manifest.json')
  if (!manifestEntry) {
    await reader.close().catch(() => {})
    throw new PackageError(
      'The package has no manifest.json, so it is not a Wiki.js backup package.'
    )
  }

  let manifest
  try {
    manifest = JSON.parse(await manifestEntry.getData(new TextWriter()))
  } catch (err) {
    await reader.close().catch(() => {})
    throw new PackageError(`The package manifest could not be read. (${err.message})`)
  }

  return {
    manifest,
    entry: (path) => byName.get(path) ?? null,
    has: (path) => byName.has(path),
    close: () => reader.close().catch(() => {})
  }
}

/** One whole entry as parsed JSON, for the small documents (`navigation.json`, `settings.json`). */
export async function readJson(entry) {
  return JSON.parse(await entry.getData(new TextWriter()))
}

/** One whole entry as bytes. Used for blobs, which are stored rather than deflated. */
export async function readBytes(entry) {
  return entry.getData(new Uint8ArrayWriter())
}

/**
 * The records of an NDJSON stream, one at a time.
 *
 * Streamed rather than read whole: `pages.ndjson` for a large wiki is hundreds of megabytes, and the
 * point of one entry per stream instead of one per page is that it can be walked in a single pass.
 *
 * A line that will not parse is **skipped**, not thrown — one corrupt line in ninety thousand is not
 * a reason to abandon a migration — and reported through `onMalformed` so it reaches the log.
 */
export async function* readRecords(entry, { onMalformed } = {}) {
  const stream = new TransformStream()
  // -> Kicked off, not awaited: it resolves when the last byte has been written, which is after the
  //    loop below has consumed it. Its rejection is claimed here so it is never unhandled.
  const finished = entry.getData(stream.writable)
  finished.catch(() => {})

  const reader = stream.readable.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += value
      let breakAt = buffer.indexOf('\n')
      while (breakAt >= 0) {
        const line = buffer.slice(0, breakAt).trim()
        buffer = buffer.slice(breakAt + 1)
        if (line) {
          const record = parseLine(line, onMalformed)
          if (record) {
            yield record
          }
        }
        breakAt = buffer.indexOf('\n')
      }
    }
    // -> A writer that did not end the file with a newline still wrote a record
    const tail = buffer.trim()
    if (tail) {
      const record = parseLine(tail, onMalformed)
      if (record) {
        yield record
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  await finished
}

function parseLine(line, onMalformed) {
  try {
    return JSON.parse(line)
  } catch {
    onMalformed?.(line)
    return null
  }
}

/**
 * Group an async iterable into batches, bounded by BOTH a record count and a rough payload size.
 *
 * Batching is what keeps the import to one request per few hundred records instead of one per record,
 * and it is also why nothing here ever holds a whole stream: only the batch in flight is resident.
 *
 * The size bound is the one that matters. A count alone is fine for rows — a locale, a group, a tree
 * entry — and hopeless for the two streams that carry whole documents: 500 page-history records off a
 * real wiki is tens of megabytes, which is a request no sane body limit accepts. Counting records was
 * how this shipped and how it fell over on the first package with a page history in it.
 *
 * `JSON.stringify(...).length` is UTF-16 code units rather than bytes, so it UNDER-counts by up to 3x
 * for text that is not Latin — which is why the budget the caller passes sits well under what the
 * server will take, and why the caller also halves a batch that comes back 413 rather than trusting
 * this. An item bigger than the budget on its own is yielded alone: a record cannot be split, and one
 * enormous page is the server's business to accept or refuse.
 */
export async function* inBatches(iterable, { maxRecords, maxBytes }) {
  let batch = []
  let bytes = 0
  for await (const item of iterable) {
    const size = JSON.stringify(item).length
    if (batch.length > 0 && (batch.length >= maxRecords || bytes + size > maxBytes)) {
      yield batch
      batch = []
      bytes = 0
    }
    batch.push(item)
    bytes += size
  }
  if (batch.length > 0) {
    yield batch
  }
}

/**
 * The SHA-256 of some bytes, as lowercase hex.
 *
 * Used to check a blob against the name it is filed under before it is uploaded: the name being the
 * checksum is the whole of what content addressing buys, and a reader that took it on trust would be
 * uploading whatever the file happened to hold under a digest the server would then reject.
 */
export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
