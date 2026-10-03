import { asciidocQuoteValue } from '@/helpers/blocks'
import { IMAGE_STYLES } from '@/helpers/markdownImages'

/**
 * The images a page written in AsciiDoc already carries, read back and rewritten.
 *
 * The twin of `markdownImages.js`, for the "Image Properties" lens in the AsciiDoc editor. The dialog
 * is the same one and speaks the same values; this is only how an image is spelled here:
 *
 *     image::path/to/file.png[Alt text,640,480,role=decor-shadow,align=center]
 *     An inline image:path/to/file.png[Alt,32,float=right] in a sentence.
 *
 * The first three positional attributes are the alt text, the width and the height. Alignment is
 * AsciiDoc's own -- `align=center` and `float=right`, which Asciidoctor turns into `text-center` and
 * `right` on the image's wrapper -- rather than a role, so a page reads the same to any other AsciiDoc
 * tool. The framing is roles, the same `decor-*` classes the markdown side writes; Asciidoctor puts a
 * role on the wrapper as well, which `_page-contents.scss` styles alongside the markdown form.
 *
 * Three things about the attribute list are not what they look like, and Asciidoctor was asked rather
 * than guessed at for each:
 *
 *   - A missing alt text is the file's name, while `""` is an empty one -- which is what an image that
 *     is decoration wants. So an image that had none keeps none unless the field is actually edited.
 *   - `\]` is an escape in an INLINE image and a literal backslash in a block one. A block macro owns
 *     its whole line and ends at the last `]` on it, so a `]` in its alt text needs nothing.
 *   - An attribute's position counts every entry before it, named ones included, so `alt=X,640` is a
 *     width of 640.
 */

/** A verbatim delimiter -- listing, literal, passthrough or comment. Nothing inside one is markup. */
const VERBATIM_DELIMITER = /^(-{4,}|\.{4,}|\+{4,}|\/{4,})[ \t]*$/

/** A block image, which owns its line from the first column. Indented, it is a literal block. */
const BLOCK_IMAGE = /^image::(\S|\S.*?\S)\[(.*)\][ \t]*$/

/**
 * An inline image, as Asciidoctor's own `InlineImageMacroRx` reads one: the target may hold a space
 * but neither starts nor ends with one, and the list ends at the first `]` that is not escaped.
 */
const INLINE_IMAGE = /(\\?)image:([^:\s[](?:[^\n[]*[^\s[])?)\[((?:\\.|[^\]\\])*)\]/g

/** A named attribute's name. Anything else in front of an `=` is part of a positional value. */
const NAME = /^[A-Za-z_][\w-]*$/

/**
 * What the dialog's alignment means here. Center is a BLOCK alignment -- an inline image is part of a
 * line of text and Asciidoctor has nothing to centre it with -- so an inline one is offered Left and
 * Right only, through the dialog's `alignments`.
 */
const BLOCK_ALIGNMENTS = ['', 'center', 'right']
const INLINE_ALIGNMENTS = ['', 'right']

/**
 * Split an attribute list into its entries, each with the slot it occupies.
 *
 * @param {string} source The inside of the brackets.
 * @param {boolean} inline Whether `\]` is an escape -- see the note at the top.
 * @returns {Array<{ name: string|null, value: string, quoted: boolean, raw: string }>}
 */
function parseAttributes(source, inline) {
  const entries = []
  let index = 0
  while (index <= source.length && source.trim()) {
    // -> One entry: up to the next comma that is not inside quotes
    let end = index
    let quote = null
    for (; end < source.length; end++) {
      const char = source[end]
      if (char === '\\') {
        end++
      } else if (quote) {
        quote = char === quote ? null : quote
      } else if (char === '"' || char === "'") {
        // -> Only where a value starts: a quote in the middle of a word is just a character
        const sofar = source.slice(index, end).trim()
        quote = sofar === '' || sofar.endsWith('=') ? char : null
      } else if (char === ',') {
        break
      }
    }
    const raw = source.slice(index, end).trim()
    const equals = raw.indexOf('=')
    const named = equals > 0 && NAME.test(raw.slice(0, equals).trim())
    const text = named ? raw.slice(equals + 1).trim() : raw
    const quoted = /^(["']).*\1$/s.test(text) && text.length > 1
    let value = quoted ? text.slice(1, -1).replace(/\\(["'\\])/g, '$1') : text
    if (inline) {
      value = value.replace(/\\\]/g, ']')
    }
    entries.push({ name: named ? raw.slice(0, equals).trim() : null, value, quoted, raw })
    index = end + 1
  }
  return entries
}

/** The value of attribute `name`, or of the positional one at `slot` (0-based), or null. */
function attribute(entries, name, slot) {
  const named = entries.find((entry) => entry.name === name)
  if (named) {
    return named
  }
  const positional = entries[slot]
  return positional && positional.name === null ? positional : null
}

/** The image whose macro was matched, in the shape the lens and the writer both work from. */
function describe({ line, column, raw, inline, target, attrlist }) {
  const entries = parseAttributes(attrlist, inline)
  const alt = attribute(entries, 'alt', 0)
  const roles = (entries.find((entry) => entry.name === 'role')?.value ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const align = entries.find((entry) => entry.name === 'align')?.value ?? ''
  const float = entries.find((entry) => entry.name === 'float')?.value ?? ''
  return {
    line,
    column,
    raw,
    inline,
    src: target,
    // -> Whether there was one at all, as opposed to an empty one -- see the note at the top
    hasAlt: Boolean(alt) && (alt.value !== '' || alt.quoted),
    alt: alt?.value ?? '',
    width: attribute(entries, 'width', 1)?.value ?? '',
    height: attribute(entries, 'height', 2)?.value ?? '',
    roles,
    align,
    float,
    entries
  }
}

/**
 * Every image in the source, in the order they appear. Line and column are 1-based, to be handed
 * straight to the editor.
 *
 * An image inside a verbatim block or a comment line is a code sample or a note and not an image, so
 * those are skipped -- the same reading `findBlocks` takes. An escaped `\image:` is literal text.
 *
 * @param {string} text The page source.
 * @returns {Array<object>} See `describe`.
 */
export function findImages(text) {
  const lines = text.split('\n')
  const images = []
  let verbatim = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (verbatim) {
      if (line.trimEnd() === verbatim) {
        verbatim = null
      }
      continue
    }
    const fence = VERBATIM_DELIMITER.exec(line)
    if (fence) {
      verbatim = fence[1]
      continue
    }
    if (line.startsWith('//') || !line.includes('image:')) {
      continue
    }

    const block = BLOCK_IMAGE.exec(line)
    if (block) {
      images.push(
        describe({
          line: index + 1,
          column: 1,
          raw: line.trimEnd(),
          inline: false,
          target: block[1],
          attrlist: block[2]
        })
      )
      continue
    }
    for (const match of line.matchAll(INLINE_IMAGE)) {
      if (match[1]) {
        continue
      }
      images.push(
        describe({
          line: index + 1,
          column: match.index + 1,
          raw: match[0],
          inline: true,
          target: match[2],
          attrlist: match[3]
        })
      )
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
    alignment:
      found.float === 'right' ? 'right' : !found.inline && found.align === 'center' ? 'center' : '',
    alignments: found.inline ? INLINE_ALIGNMENTS : BLOCK_ALIGNMENTS,
    styles: IMAGE_STYLES.filter((name) => found.roles.includes(name))
  }
}

/** A value written into the list, quoted only where it would otherwise be misread. */
function writeValue(value, inline) {
  const text = /^\s|\s$|[,"'=]/.test(value) ? asciidocQuoteValue(value) : value
  return inline ? text.replaceAll(']', '\\]') : text
}

/**
 * The image written back out, from what the dialog answered.
 *
 * Applying the dialog without touching anything gives back exactly what was read. Otherwise the alt
 * text, width and height are written as the first three positional attributes; every other attribute
 * stays as it was written, in its own order; and the role, `align` and `float` go last. Roles the dialog
 * does not manage are kept, and so is an `align` or a `float` it has no option for -- `float=left` on
 * an image opened only to resize it is not the dialog's to take away.
 *
 * @param {object} found What `findImages` read.
 * @param {{ src: string, alt: string, width: string, height: string, alignment: string,
 *          styles: string[] }} values What the dialog answered.
 * @returns {string} The AsciiDoc for the image.
 */
export function writeImage(found, values) {
  const before = imageValues(found)
  const unchanged =
    ['src', 'alt', 'width', 'height', 'alignment'].every((key) => values[key] === before[key]) &&
    values.styles.length === before.styles.length &&
    values.styles.every((name) => before.styles.includes(name))
  if (unchanged) {
    return found.raw
  }

  const { inline } = found
  const altText =
    values.alt === ''
      ? found.hasAlt || values.alt !== before.alt
        ? '""'
        : ''
      : writeValue(values.alt, inline)
  const slots = [altText, values.width, values.height]
  while (slots.length > 0 && slots.at(-1) === '') {
    slots.pop()
  }

  const managed = new Set(['alt', 'width', 'height', 'role', 'align', 'float'])
  const others = found.entries
    .filter((entry, index) => (entry.name === null ? index > 2 : !managed.has(entry.name)))
    .map((entry) => entry.raw)

  const roles = found.roles.filter(
    (name) => !IMAGE_STYLES.includes(name) || values.styles.includes(name)
  )
  roles.push(...values.styles.filter((name) => !roles.includes(name)))

  let align = found.align
  let float = found.float
  if (values.alignment === 'center') {
    align = 'center'
    float = ''
  } else if (values.alignment === 'right') {
    align = ''
    float = 'right'
  } else {
    align = align === 'center' ? '' : align
    float = float === 'right' ? '' : float
  }

  const list = [
    ...slots,
    ...others,
    roles.length > 1 ? `role=${asciidocQuoteValue(roles.join(' '))}` : '',
    roles.length === 1 ? `role=${writeValue(roles[0], inline)}` : '',
    align ? `align=${align}` : '',
    float ? `float=${float}` : ''
  ]
  // -> Empty positional slots hold their place; anything after them that came out empty does not
  const attrlist = [...list.slice(0, slots.length), ...list.slice(slots.length).filter(Boolean)]
    .join(',')
    .replace(/^,+$/, '')

  return `image:${inline ? '' : ':'}${values.src}[${attrlist}]`
}
