import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

/**
 * Reading a DokuWiki data directory in the browser, for **Import from DokuWiki**.
 *
 * DokuWiki keeps everything in files, so there is no export to make: the operator hands over the data
 * directory itself — a ZIP of it, or the folder picked whole — and this finds its way round it. The
 * layout is DokuWiki's own and has not changed in years:
 *
 * ```
 * data/pages/<ns>/<page>.txt                  the current text of every page
 * data/attic/<ns>/<page>.<rev>.txt.gz         every earlier revision (or .txt, or .bz2)
 * data/meta/<ns>/<page>.changes               one line per revision: date, ip, type, id, user, summary
 * data/media/<ns>/<file>                      every media file, current version
 * data/media_meta/<ns>/<file>.changes         the same log, for a file
 * conf/users.auth.php                         login:hash:name:email:groups, for the plain auth backend
 * conf/interwiki.conf, interwiki.local.conf   the `[[shortcut>…]]` map
 * conf/local.php                              `$conf['start']`, `$conf['title']`, …
 * ```
 *
 * Where the data directory is inside what was picked is found by looking (`openSource`), since a ZIP
 * of a whole install, of `data/` alone, or of its contents are all reasonable things to hand over.
 * `conf/` is looked for beside it; without it the import still works, with nobody's name or address and
 * DokuWiki's default interwiki map.
 *
 * Nothing here needs a library beyond the ZIP reader the other imports already load: an attic revision
 * is gzip, which is the browser's own `DecompressionStream`. One compressed with bzip2 (`compression`
 * set to `bz2`) cannot be read, and is counted.
 */

/** Refused by the reader, since the server never sees the source. */
export class SourceError extends Error {}

/**
 * DokuWiki's own `conf/interwiki.conf`, for a source handed over without `conf/`. The shop links are
 * left out; they carried the DokuWiki author's affiliate tag.
 */
const DEFAULT_INTERWIKI = {
  wp: 'https://en.wikipedia.org/wiki/{NAME}',
  wpfr: 'https://fr.wikipedia.org/wiki/{NAME}',
  wpde: 'https://de.wikipedia.org/wiki/{NAME}',
  wpes: 'https://es.wikipedia.org/wiki/{NAME}',
  wppl: 'https://pl.wikipedia.org/wiki/{NAME}',
  wpjp: 'https://ja.wikipedia.org/wiki/{NAME}',
  wpru: 'https://ru.wikipedia.org/wiki/{NAME}',
  wpmeta: 'https://meta.wikipedia.org/wiki/{NAME}',
  doku: 'https://www.dokuwiki.org/',
  rfc: 'https://tools.ietf.org/html/rfc',
  man: 'http://man.cx/',
  phpfn: 'https://secure.php.net/{NAME}',
  google: 'https://www.google.com/search?q=',
  'google.de': 'https://www.google.de/search?q=',
  go: 'https://www.google.com/search?q={URL}&btnI=lucky',
  user: ':user:{NAME}',
  skype: 'skype:{NAME}',
  callto: 'callto://{NAME}',
  tel: 'tel:{NAME}'
}

/**
 * Open what was picked: a ZIP (`File`), or a folder (`FileList` from `<input webkitdirectory>`).
 *
 * @returns {Promise<{ kind: 'zip'|'folder', root: string, has(path), names(), size(path),
 *   modified(path), bytes(path), text(path), conf(name), close() }>} Paths are relative to the data
 *   directory: `pages/start.txt`. `conf(name)` is a file of `conf/` as text, or null.
 */
export async function openSource(input) {
  const files = new Map()
  let close = async () => {}
  if (input instanceof Blob) {
    const reader = new ZipReader(new BlobReader(input))
    let entries
    try {
      entries = await reader.getEntries()
    } catch (err) {
      await reader.close().catch(() => {})
      throw new SourceError(`This file could not be opened as a ZIP archive. (${err.message})`)
    }
    for (const entry of entries) {
      if (!entry.directory) {
        files.set(entry.filename.replaceAll('\\', '/'), {
          size: entry.uncompressedSize,
          modified: entry.lastModDate?.getTime?.() ?? 0,
          read: () => entry.getData(new Uint8ArrayWriter())
        })
      }
    }
    close = () => reader.close().catch(() => {})
  } else {
    for (const file of input ?? []) {
      files.set((file.webkitRelativePath || file.name).replaceAll('\\', '/'), {
        size: file.size,
        modified: file.lastModified,
        read: async () => new Uint8Array(await file.arrayBuffer())
      })
    }
  }

  const root = findDataRoot(files.keys())
  if (root === null) {
    await close()
    throw new SourceError(
      'No DokuWiki data directory was found in what was selected: there is no pages/ folder holding .txt pages. Select the data directory (or a ZIP of it, or of the whole DokuWiki).'
    )
  }
  // -> `conf/` is beside `data/` in an install; a ZIP of the data directory alone has none
  const parent = root.replace(/[^/]+\/$/, '')
  const confRoots = [...new Set([`${parent}conf/`, `${root}conf/`])]
  const confFile = (name) => {
    for (const dir of confRoots) {
      const file = files.get(`${dir}${name}`)
      if (file) {
        return file
      }
    }
    return null
  }
  const decoder = new TextDecoder()
  const get = (path) => files.get(`${root}${path}`) ?? null

  return {
    kind: input instanceof Blob ? 'zip' : 'folder',
    root,
    hasConf: confRoots.some((dir) => [...files.keys()].some((name) => name.startsWith(dir))),
    has: (path) => files.has(`${root}${path}`),
    *names() {
      for (const name of files.keys()) {
        if (name.startsWith(root)) {
          yield name.slice(root.length)
        }
      }
    },
    size: (path) => get(path)?.size ?? 0,
    modified: (path) => get(path)?.modified ?? 0,
    bytes: async (path) => (await get(path)?.read()) ?? null,
    text: async (path) => {
      const bytes = await get(path)?.read()
      return bytes ? decoder.decode(bytes) : null
    },
    conf: async (name) => {
      const bytes = await confFile(name)?.read()
      return bytes ? decoder.decode(bytes) : null
    },
    close
  }
}

/**
 * Where the data directory is: the folder holding `pages/` with the most pages in it, the shallowest
 * one on a tie. A plugin's own `pages/` folder, if one ships any, holds a handful.
 */
function findDataRoot(names) {
  const counts = new Map()
  for (const name of names) {
    const match = /^(.*?)pages\/.+\.txt$/.exec(name)
    if (match && (match[1] === '' || match[1].endsWith('/'))) {
      counts.set(match[1], (counts.get(match[1]) ?? 0) + 1)
    }
  }
  let best = null
  for (const [root, n] of counts) {
    if (
      best === null ||
      n > counts.get(best) ||
      (n === counts.get(best) && root.length < best.length)
    ) {
      best = root
    }
  }
  return best
}

/**
 * A file name back to the id part it stores. DokuWiki's default `fnencode` (`url`) percent-encodes
 * anything outside ASCII; `utf-8` leaves it as it is. (`safe`, a scheme of DokuWiki's own, is not
 * read, and such a name is kept as it is spelt.)
 */
function decodeName(name) {
  if (!name.includes('%')) {
    return name
  }
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

function idOf(relativePath) {
  return relativePath.split('/').map(decodeName).join(':')
}

/** One `.changes` file, oldest first. Older DokuWiki wrote fewer columns; every one past the date is optional. */
function parseChanges(text) {
  const entries = []
  for (const line of (text ?? '').split('\n')) {
    const fields = line.split('\t')
    const date = Number.parseInt(fields[0], 10)
    if (fields.length > 2 && Number.isFinite(date)) {
      entries.push({
        date,
        type: fields[2] ?? '',
        user: (fields[4] ?? '').trim(),
        summary: fields[5] ?? ''
      })
    }
  }
  return entries.sort((a, b) => a.date - b.date)
}

/**
 * `conf/users.auth.php`: `login:passwordhash:Real Name:email:groups`, one per line, `#` for a comment.
 * A colon inside a field is written `\:`; older releases percent-encoded the name instead.
 */
function parseUsers(text) {
  const users = new Map()
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const fields = []
    let current = ''
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\' && i + 1 < line.length) {
        current += line[++i]
      } else if (line[i] === ':' && fields.length < 4) {
        fields.push(current)
        current = ''
      } else {
        current += line[i]
      }
    }
    fields.push(current)
    const login = fields[0]?.trim()
    if (login) {
      users.set(login, {
        id: login,
        name: decodeName(fields[2] ?? '').trim(),
        email: decodeName(fields[3] ?? '').trim()
      })
    }
  }
  return users
}

/** An interwiki file: `shortcut  template`, a `#` not escaped and not part of an entity ends the line. */
function parseInterwiki(text, into) {
  for (const raw of (text ?? '').split('\n')) {
    const line = raw
      .replace(/(?<![&\\])#.*$/, '')
      .replaceAll('\\#', '#')
      .trim()
    const match = /^(\S+)\s+(\S+)$/.exec(line)
    if (match) {
      into[match[1].toLowerCase()] = match[2]
    }
  }
}

/** A `$conf['key'] = 'value';` setting out of a `conf/local.php`, or null. */
function confValue(php, key) {
  const match = new RegExp(
    String.raw`\$conf\[['"]${key}['"]\]\s*=\s*(['"])((?:\\.|(?!\1).)*)\1`
  ).exec(php ?? '')
  return match ? match[2].replaceAll(/\\(.)/g, '$1') : null
}

/** A page's title as DokuWiki takes it: its first heading. */
function firstHeading(text) {
  // -> Not inside a code block, which is the one place a heading line is not one
  const visible = (text ?? '').replaceAll(/<(code|file)\b[^>]*>[\s\S]*?<\/\1>/g, '')
  const match = /^[ \t]*(={2,})(.+?)={2,}[ \t]*$/m.exec(visible)
  return match ? match[2].trim() : ''
}

/**
 * Everything but the page and revision bodies, which are read again as they are posted.
 *
 * @returns {Promise<{
 *   start: string, title: string, hasConf: boolean,
 *   pages: Map<string, { id, file, modified, title }>,
 *   attic: Map<string, Array<{ rev: number, file: string, encoding: 'gzip'|'plain'|'bz2' }>>,
 *   changes: Map<string, Array<{ date, type, user, summary }>>,
 *   media: Map<string, { id, file, size, authorId }>,
 *   users: Map<string, { id, name, email }>,
 *   interwiki: Record<string, string>,
 *   templates: number
 * }>}
 */
export async function readIndex(source, { onProgress } = {}) {
  const local = [await source.conf('local.php'), await source.conf('local.protected.php')]
  const setting = (key) => local.reduce((found, php) => confValue(php, key) ?? found, null)

  const pages = new Map()
  const attic = new Map()
  const changes = new Map()
  const media = new Map()
  const mediaChanges = new Map()
  let templates = 0

  const names = [...source.names()]
  for (const name of names) {
    if (name.startsWith('pages/') && name.endsWith('.txt')) {
      const rel = name.slice('pages/'.length, -'.txt'.length)
      // -> `_template.txt` and `__template.txt` are the namespace template plugin's, not pages: no
      //    id DokuWiki makes can start with an underscore
      if (rel.split('/').some((part) => part.startsWith('_'))) {
        templates++
        continue
      }
      const id = idOf(rel)
      pages.set(id, { id, file: name, modified: source.modified(name), title: '' })
    } else if (name.startsWith('attic/')) {
      const match = /^attic\/(.+)\.(\d+)\.txt(\.gz|\.bz2)?$/.exec(name)
      if (match) {
        const id = idOf(match[1])
        const list = attic.get(id) ?? []
        list.push({
          rev: Number(match[2]),
          file: name,
          encoding: match[3] === '.gz' ? 'gzip' : match[3] === '.bz2' ? 'bz2' : 'plain'
        })
        attic.set(id, list)
      }
    } else if (name.startsWith('media/')) {
      const id = idOf(name.slice('media/'.length))
      media.set(id, { id, file: name, size: source.size(name), authorId: null })
    }
  }

  // -> The logs: one per page and one per file. `_dokuwiki.changes` and `_media.changes` at the top
  //    are the whole wiki's, and say nothing the per-page ones do not
  let done = 0
  const total = names.length
  for (const name of names) {
    done++
    if (done % 500 === 0) {
      onProgress?.(done / total / 2)
    }
    if (!name.endsWith('.changes')) {
      continue
    }
    if (name.startsWith('meta/')) {
      const rel = name.slice('meta/'.length, -'.changes'.length)
      if (!rel.split('/').some((part) => part.startsWith('_'))) {
        changes.set(idOf(rel), parseChanges(await source.text(name)))
      }
    } else if (name.startsWith('media_meta/')) {
      const rel = name.slice('media_meta/'.length, -'.changes'.length)
      mediaChanges.set(idOf(rel), parseChanges(await source.text(name)))
    }
  }
  for (const [id, file] of media) {
    const log = mediaChanges.get(id)
    file.authorId = log?.at(-1)?.user || null
  }

  // -> Titles, which the folders are named after before any page is written
  done = 0
  for (const page of pages.values()) {
    page.title = firstHeading(await source.text(page.file))
    if (++done % 200 === 0) {
      onProgress?.(0.5 + done / pages.size / 2)
    }
  }

  const interwiki = {}
  const conf = await source.conf('interwiki.conf')
  if (conf) {
    parseInterwiki(conf, interwiki)
  } else {
    Object.assign(interwiki, DEFAULT_INTERWIKI)
  }
  parseInterwiki(await source.conf('interwiki.local.conf'), interwiki)

  onProgress?.(1)
  return {
    start: setting('start') || 'start',
    title: setting('title') || '',
    hasConf: source.hasConf,
    pages,
    attic,
    changes,
    media,
    users: parseUsers(await source.conf('users.auth.php')),
    interwiki,
    templates
  }
}

/** A revision's text out of the attic, or null when it cannot be read here (bzip2). */
export async function readRevision(source, revision) {
  if (revision.encoding === 'bz2') {
    return null
  }
  const bytes = await source.bytes(revision.file)
  if (!bytes) {
    return null
  }
  if (revision.encoding === 'plain') {
    return new TextDecoder().decode(bytes)
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}
