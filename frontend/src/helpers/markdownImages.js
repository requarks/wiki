/**
 * The images already in a page's markdown source, read back and rewritten.
 *
 * What the "Image Properties" lens in the Markdown editor works from: `findImages` says where each one
 * is and what it says, `writeImage` writes the answer back over exactly the characters it came from.
 *
 * Only the inline form, `![alt](src "title" =WxH){.class}`, and only where it sits on one line. A
 * reference image (`![alt][ref]`) keeps its address somewhere else in the page, and markdown lets an
 * inline one break across lines -- both are rare enough in practice that offering a form over them is
 * not worth reading them. Nothing is lost by it: they simply get no lens.
 *
 * The grammar is the one `markdown-it-imsize` parses, which replaces markdown-it's own image rule:
 * the title comes BEFORE the size, and the size needs a space in front of it. The braces after the
 * closing parenthesis are MDC's inline props, which is the reading the renderer gives a brace that
 * abuts what precedes it -- see `renderers/markdown.js`.
 */

/** The opening or closing line of a fenced block, indented up to the three spaces markdown allows. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/

/** `=WxH`, with either half optional -- exactly what `parseImageSize` in `markdown-it-imsize` takes. */
const SIZE = /^=(\d[\d%]*)?x([\d%]*)/

/** A `.class` in a props list. Anything else in there -- an `#id`, a `key=value` -- is not ours. */
const CLASS = /(?:^|\s)\.([^\s.#"'=}]+)/g

/**
 * The classes the dialog sets, which are therefore the classes it is allowed to take away -- by the
 * dialog's own name for each alignment, since the AsciiDoc side spells the same two differently.
 *
 * `align-left` is deliberately not among them: "Left" is what an image with no alignment does, so the
 * dialog writes no class for it -- but an image somebody floated left by hand keeps its float unless
 * they pick another alignment, rather than losing it to a dialog opened only to change its size.
 */
const ALIGNMENT_CLASSES = { center: 'align-center', right: 'align-right' }

/**
 * The framing classes, shared with the AsciiDoc side, where they are written as roles. Both renderers
 * end up with them as classes, which `_page-contents.scss` styles.
 */
export const IMAGE_STYLES = ['decor-shadow', 'decor-border', 'decor-rounded']

/** Index of the bracket closing the one at `start`, or -1. Brackets nest; a backslash escapes. */
function closingBracket(line, start) {
  let depth = 0
  for (let index = start; index < line.length; index++) {
    const char = line[index]
    if (char === '\\') {
      index++
    } else if (char === '[') {
      depth++
    } else if (char === ']' && --depth === 0) {
      return index
    }
  }
  return -1
}

/**
 * The link destination at `start`: `<anything but a newline>` or a run with balanced parentheses.
 *
 * @returns {{ src: string, raw: string, end: number } | null} The address as the author meant it --
 *          angle brackets off, escapes undone -- as it was written, and where it stopped.
 */
function readDestination(line, start) {
  if (line[start] === '<') {
    for (let index = start + 1; index < line.length; index++) {
      if (line[index] === '\\') {
        index++
      } else if (line[index] === '>') {
        const raw = line.slice(start, index + 1)
        return { src: unescape(raw.slice(1, -1)), raw, end: index + 1 }
      } else if (line[index] === '<') {
        return null
      }
    }
    return null
  }
  let depth = 0
  let index = start
  for (; index < line.length; index++) {
    const char = line[index]
    if (char === '\\') {
      index++
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      if (depth === 0) {
        break
      }
      depth--
    } else if (/\s/.test(char)) {
      break
    }
  }
  const raw = line.slice(start, index)
  return depth === 0 ? { src: unescape(raw), raw, end: index } : null
}

/** A link title, `"…"`, `'…'` or `(…)`, as written -- quotes and all, so it goes back untouched. */
function readTitle(line, start) {
  const close = { '"': '"', "'": "'", '(': ')' }[line[start]]
  if (!close) {
    return null
  }
  for (let index = start + 1; index < line.length; index++) {
    if (line[index] === '\\') {
      index++
    } else if (line[index] === close) {
      return { title: line.slice(start, index + 1), end: index + 1 }
    }
  }
  return null
}

/** The inside of `{…}` at `start`, if one opens there. A `}` inside quotes does not close it. */
function readProps(line, start) {
  if (line[start] !== '{') {
    return null
  }
  let quote = null
  for (let index = start + 1; index < line.length; index++) {
    const char = line[index]
    if (quote) {
      quote = char === quote ? null : quote
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '}') {
      return { props: line.slice(start + 1, index), end: index + 1 }
    }
  }
  return null
}

function skipSpaces(line, index) {
  while (index < line.length && (line[index] === ' ' || line[index] === '\t')) {
    index++
  }
  return index
}

function unescape(text) {
  return text.replace(/\\([()<>[\]])/g, '$1')
}

/**
 * The image whose `![` is at `start`, read to the end of its props, or null where what follows is not
 * an inline image after all.
 */
function readImage(line, start) {
  const labelEnd = closingBracket(line, start + 1)
  if (labelEnd < 0 || line[labelEnd + 1] !== '(') {
    return null
  }
  let index = skipSpaces(line, labelEnd + 2)
  const destination = readDestination(line, index)
  if (!destination) {
    return null
  }
  index = destination.end

  let title = ''
  let afterSpace = skipSpaces(line, index)
  if (afterSpace > index) {
    const found = readTitle(line, afterSpace)
    if (found) {
      title = found.title
      index = found.end
      afterSpace = skipSpaces(line, index)
    }
  }

  let width = ''
  let height = ''
  if (afterSpace > index) {
    const size = SIZE.exec(line.slice(afterSpace))
    if (size) {
      width = size[1] ?? ''
      height = size[2] ?? ''
      index = afterSpace + size[0].length
    }
  }

  index = skipSpaces(line, index)
  if (line[index] !== ')') {
    return null
  }
  index++

  const props = readProps(line, index)
  const classes = props ? [...props.props.matchAll(CLASS)].map((match) => match[1]) : []
  return {
    column: start + 1,
    raw: line.slice(start, props?.end ?? index),
    alt: unescape(line.slice(start + 2, labelEnd)),
    rawAlt: line.slice(start + 2, labelEnd),
    src: destination.src,
    rawSrc: destination.raw,
    title,
    width,
    height,
    classes,
    // -> Whatever else the braces held, verbatim and in order, for `writeImage` to put back
    otherProps: props ? props.props.replace(CLASS, '').trim() : ''
  }
}

/**
 * Every inline image in the source, in the order they appear. Line and column are 1-based, to be
 * handed straight to the editor.
 *
 * An image inside a fenced code block or a code span is a code sample and not an image, so those are
 * skipped -- the same reading `findEditableTables` and `findBlocks` take of the same lines. An image
 * inside a link (`[![badge](…)](…)`) is still an image, and is found.
 *
 * @param {string} text The page source.
 * @returns {Array<{ line: number, column: number, raw: string, alt: string, src: string,
 *          title: string, width: string, height: string, classes: string[], otherProps: string }>}
 */
export function findImages(text) {
  const lines = text.split('\n')
  const images = []
  let fence = null

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const edge = FENCE.exec(line)
    if (fence) {
      if (edge && edge[1][0] === fence[0] && edge[1].length >= fence.length) {
        fence = null
      }
      continue
    }
    if (edge) {
      fence = edge[1]
      continue
    }
    if (!line.includes('![')) {
      continue
    }

    for (let index = 0; index < line.length; index++) {
      const char = line[index]
      if (char === '\\') {
        index++
      } else if (char === '`') {
        // -> A code span closes on a run of exactly as many backticks; one that never closes is
        //    literal backticks, and the scan carries on after them
        const run = /^`+/.exec(line.slice(index))[0]
        const close = line.slice(index + run.length).search(new RegExp(`(?<!\`)${run}(?!\`)`))
        index += close < 0 ? run.length - 1 : run.length * 2 + close - 1
      } else if (char === '!' && line[index + 1] === '[') {
        const image = readImage(line, index)
        if (image) {
          images.push({ line: lineIndex + 1, ...image })
          index += image.raw.length - 1
        }
      }
    }
  }
  return images
}

/**
 * What the dialog should open on, for an image `findImages` read.
 *
 * @param {object} found An image from `findImages`.
 * @returns {object} The dialog's props.
 */
export function imageValues(found) {
  return {
    src: found.src,
    alt: found.alt,
    width: found.width,
    height: found.height,
    ...classValues(found.classes)
  }
}

/**
 * The dialog's alignment and styles, read off an image's classes.
 *
 * Exported for the Visual editor, which holds the same classes on its image node (`mdAttrs.class`)
 * and offers the same dialog over them.
 *
 * @param {string[]} classes
 * @returns {{ alignment: string, styles: string[] }}
 */
export function classValues(classes) {
  return {
    alignment:
      Object.keys(ALIGNMENT_CLASSES).find((key) => classes.includes(ALIGNMENT_CLASSES[key])) ?? '',
    styles: IMAGE_STYLES.filter((name) => classes.includes(name))
  }
}

/**
 * An image's classes, with the dialog's alignment and styles applied.
 *
 * Classes the dialog does not manage are kept, in their own order, and so are the managed ones still
 * wanted; new ones go at the end. `align-left` survives a "Left" -- see `ALIGNMENT_CLASSES`.
 *
 * @param {string[]} classes What the image has now.
 * @param {{ alignment: string, styles: string[] }} values What the dialog answered.
 * @returns {string[]}
 */
export function applyClassValues(classes, { alignment, styles }) {
  const wanted = [ALIGNMENT_CLASSES[alignment], ...styles].filter(Boolean)
  const managed = new Set([...Object.values(ALIGNMENT_CLASSES), ...IMAGE_STYLES])
  const kept = classes.filter((name) =>
    managed.has(name) ? wanted.includes(name) : !(alignment && name === 'align-left')
  )
  return [...kept, ...wanted.filter((name) => !kept.includes(name))]
}

/**
 * The image written back out, from what the dialog answered.
 *
 * Whatever the dialog did not change is written exactly as it was read -- the label and the address
 * with the author's own escaping, the title with its own quotes, the classes in their own order -- so
 * that applying the dialog without touching anything leaves the source as it was. Classes the dialog
 * does not manage are kept, and so is everything else in the braces; the braces are dropped
 * altogether once nothing is left in them.
 *
 * @param {object} found What `findImages` read.
 * @param {{ src: string, alt: string, width: string, height: string, alignment: string,
 *          styles: string[] }} values What the dialog answered.
 * @returns {string} The markdown for the image.
 */
export function writeImage(found, { src, alt, width, height, alignment, styles }) {
  const label = alt === found.alt ? found.rawAlt : alt.replace(/[[\]]/g, '\\$&')
  let destination = found.rawSrc
  if (src !== found.src) {
    // -> A space would end the destination, so such an address goes in angle brackets
    destination = /\s/.test(src)
      ? `<${src.replace(/[<>]/g, '\\$&')}>`
      : src.replace(/[()]/g, '\\$&')
  }
  const title = found.title ? ` ${found.title}` : ''
  const size = width || height ? ` =${width}x${height}` : ''

  const classes = applyClassValues(found.classes, { alignment, styles })
  const props = [found.otherProps, ...classes.map((name) => `.${name}`)].filter(Boolean).join(' ')

  return `![${label}](${destination}${title}${size})${props ? `{${props}}` : ''}`
}
