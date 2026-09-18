import { asciidocQuoteValue, blockAttributes } from '@/helpers/blocks'

/**
 * The blocks a page written in AsciiDoc already carries, read back and rewritten.
 *
 * The twin of `markdownBlocks.js`, answering the same four questions for the other syntax so that the
 * AsciiDoc editor can offer the same two code lenses -- "Edit Block Parameters" over any block that
 * declares props, and "Edit Content" over one whose body is a single source block. Everything about
 * WHAT those lenses do lives in the editor; this is only how a block is spelled.
 *
 * Where markdown writes
 *
 *     ::block-tabs{a="1"}
 *     …
 *     ::
 *
 * AsciiDoc writes an attribute line above a delimited block:
 *
 *     [block-tabs, a="1"]
 *     ====
 *     …
 *     ====
 *
 * Two consequences run through this whole file. A block's opening line is the ATTRIBUTE LINE, one
 * above the delimiter, so a line number here means the attribute line and the body starts two lines
 * down. And nesting works by ALTERNATING the delimiter rather than by growing it -- a tabset is
 * `====` with each tab a `--` inside it -- so a closing delimiter has to be matched against the one
 * that opened its own block rather than by length.
 */

/**
 * A line that is nothing but a delimiter of one of the four blocks that can hold other blocks.
 *
 * Four of them, which is the ceiling on how deeply the wiki's blocks can nest: a fifth level would
 * have no delimiter left to alternate to. Example, sidebar and quote take four characters or more;
 * an open block is exactly two hyphens, which is why it is not written as a run.
 */
const DELIMITER = /^(={4,}|\*{4,}|_{4,}|--)[ \t]*$/

/**
 * A verbatim delimiter -- a listing, a literal, a passthrough or a comment block.
 *
 * Nothing inside one is markup, so a `[block-x]` written in a code sample is a code sample. Matched
 * by its own repeated character, since AsciiDoc allows a run of four or more.
 */
const VERBATIM_DELIMITER = /^(-{4,}|\.{4,}|\+{4,}|\/{4,})[ \t]*$/

/**
 * The attribute line that names one of the wiki's blocks: `[block-tabs, label="One"]`.
 *
 * Anchored to the start of the line, as AsciiDoc anchors a block attribute list. The style is the
 * first positional attribute, and everything after the first comma is the block's own props.
 */
const OPENING = /^\[(block-[a-z\d-]+)[ \t]*(?:,[ \t]*(.*))?\][ \t]*$/

/**
 * A source block inside a wiki block's body: `[source,mermaid]` over a `----` fence.
 *
 * The language is the second positional attribute. `[source]` with no language is matched too, since
 * a block's body editor is chosen by the block's definition rather than by what the fence says.
 */
const SOURCE_OPENING = /^\[source[ \t]*(?:,[ \t]*([^\s,\]]*))?[^\]]*\][ \t]*$/

/** The fence a source block is written between. */
const SOURCE_FENCE = /^(-{4,})[ \t]*$/

/**
 * One entry in an AsciiDoc attribute list: `name="value"`, `name='value'`, `name=value`, or a bare
 * positional value. `.role` and `#id` shorthands are matched too, since AsciiDoc accepts both.
 *
 * Ordered so a quoted value wins over the unquoted reading, which would stop at the comma.
 */
const ATTRIBUTE =
  /([.#][^\s,"'=]+)|([\w-]+)[ \t]*=[ \t]*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^,]*))|([^,\s][^,]*)/g

/** `\"` inside a quoted AsciiDoc value is a literal quote. */
function unescapeValue(value) {
  return value.replace(/\\(["'])/g, '$1')
}

/**
 * Split an attribute list into what it says.
 *
 * `name` is null for a `.role`, a `#id` or a bare positional value, none of which belongs to a prop.
 * `raw` is what was written, kept so that anything the block does not declare survives a rewrite
 * untouched -- see `blockOpeningLine`.
 *
 * @param {string} source The inside of the brackets, after the style.
 * @returns {Array<{ name: string|null, value: string|null, raw: string }>}
 */
function parseAttributes(source) {
  return [...source.matchAll(ATTRIBUTE)]
    .filter((match) => match[0].trim())
    .map((match) => ({
      name: match[2] ?? null,
      value:
        match[3] !== undefined
          ? unescapeValue(match[3])
          : match[4] !== undefined
            ? unescapeValue(match[4])
            : (match[5]?.trim() ?? null),
      raw: match[0].trim()
    }))
}

/** Whether `line` closes a block opened with `delimiter`. */
function closes(line, delimiter) {
  const match = DELIMITER.exec(line)
  return Boolean(match) && match[1] === delimiter
}

/**
 * Every block in the source, in the order they appear. Line numbers are 1-based, to be handed
 * straight to the editor.
 *
 * `line` is the ATTRIBUTE line -- the one a lens is drawn over and the one `blockOpeningLine`
 * rewrites -- and `delimiter` is what the block was opened with, which is what its own closing line
 * has to match. `endLine` is that closing line, or the end of the source for a block still being
 * written.
 *
 * A block written inside a verbatim block is a code sample and not a block, so those are skipped.
 * Nesting needs no tracking of its own: an attribute line stands on its own whatever it is written
 * inside, and the first line matching a block's own delimiter is always its close -- AsciiDoc does
 * not allow a delimited block to nest inside another of the SAME kind, which is why they alternate.
 *
 * @param {string} text The page source.
 * @returns {Array<{ block: string, line: number, endLine: number, delimiter: string,
 *          attributes: Array }>}
 */
export function findBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
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

    const opening = OPENING.exec(line)
    /*
      The delimiter is read off the NEXT line rather than assumed, because it is what closes the
      block and the four are interchangeable. An attribute line with no delimiter under it is a
      styled paragraph, not a block with a body, and is not offered a lens.
    */
    const delimiter = opening ? DELIMITER.exec(lines[index + 1] ?? '') : null
    if (opening && delimiter) {
      blocks.push({
        block: opening[1].slice('block-'.length),
        line: index + 1,
        endLine: closingLineOf(lines, index + 1, delimiter[1]),
        delimiter: delimiter[1],
        attributes: parseAttributes(opening[2] ?? '')
      })
    }
  }
  return blocks
}

/**
 * Where a block opened at `delimiterIndex` closes, as a 1-based line.
 *
 * The first line matching its own delimiter, for the reason `findBlocks` gives. An unterminated block
 * is reported as running to the end of the source, which is what it looks like while it is being
 * typed and is the answer the editor's preview wants.
 */
function closingLineOf(lines, delimiterIndex, delimiter) {
  for (let index = delimiterIndex + 1; index < lines.length; index++) {
    if (closes(lines[index], delimiter)) {
      return index + 1
    }
  }
  return lines.length
}

/**
 * Every tabset in the source, in order, as the line range of each of its panels.
 *
 * The same shape -- and the same purpose -- as `tabsMap` in the markdown renderer: the editor's
 * preview keeps which panel is open in each block's own state, and the preview is rebuilt from
 * scratch on every keystroke, so without this, writing inside the second panel of a tabset would
 * throw the author back to the first.
 *
 * Built here rather than in the renderer because this side already reads the source for the code
 * lenses, and because the AsciiDoc renderer is async: a map produced as a side effect of rendering
 * would be a render behind whenever the caret moved between one keystroke and the next.
 *
 * A panel belongs to the innermost tabset containing it, which nesting by containment gives for
 * free: the panels are the `tab` blocks that fall inside a `tabs` block and inside no nearer one.
 *
 * @param {string} text The page source.
 * @returns {Array<Array<[number, number]>>} Per tabset, the 1-based `[first, last]` line of each
 *          panel, both inclusive.
 */
export function findTabsets(text) {
  const blocks = findBlocks(text)
  const tabsets = blocks.filter((block) => block.block === 'tabs')
  const tabs = blocks.filter((block) => block.block === 'tab')
  return tabsets.map((tabset) =>
    tabs
      .filter((tab) => {
        if (tab.line < tabset.line || tab.endLine > tabset.endLine) {
          return false
        }
        // -> Not this tabset's, if a nearer one also contains it
        return !tabsets.some(
          (nearer) =>
            nearer !== tabset &&
            nearer.line >= tabset.line &&
            nearer.endLine <= tabset.endLine &&
            tab.line >= nearer.line &&
            tab.endLine <= nearer.endLine
        )
      })
      .map((tab) => [tab.line, tab.endLine])
  )
}

/**
 * What the form should open on: the block's props, filled in from what the page gave them.
 *
 * A prop the source says nothing about starts at the block's own default, which is what the block
 * will do if left alone -- the same footing the picker starts a new block on.
 *
 * @param {{ attributes: Array }} found A block from `findBlocks`.
 * @param {{ props?: Array }} definition The same block as the API describes it.
 * @returns {Record<string, unknown>} Values by prop name.
 */
export function blockValues(found, definition) {
  const written = new Map(
    found.attributes.filter((attribute) => attribute.name).map((a) => [a.name, a.value])
  )
  return Object.fromEntries(
    (definition.props ?? []).map((prop) => {
      if (!written.has(prop.name)) {
        return [prop.name, prop.default ?? '']
      }
      const value = written.get(prop.name)
      switch (prop.type) {
        /*
          -> Read exactly as the markdown side reads one, and for the same reason: every prop reaches
             the element as a string, so anything but the word false is true.
        */
        case 'boolean':
          return [prop.name, value === null ? true : value !== 'false']
        case 'number': {
          const number = Number(value)
          return [prop.name, Number.isFinite(number) ? number : (prop.default ?? '')]
        }
        default:
          return [prop.name, value ?? '']
      }
    })
  )
}

/**
 * The attribute line to write back, from what the form now holds.
 *
 * Anything in the original list that the block does not declare is carried over as written: a
 * `.role`, or an attribute belonging to a version of the block that had a prop this one has not.
 * None of them survives being saved -- the renderer allows a block exactly the attributes its
 * definition declares -- but dropping them here would edit a line the author is still writing.
 *
 * @param {{ block: string, attributes: Array }} found A block from `findBlocks`.
 * @param {{ props?: Array }} definition The same block as the API describes it.
 * @param {Record<string, unknown>} values What the form holds, by prop name.
 * @returns {string} The line, with no trailing newline.
 */
export function blockOpeningLine(found, definition, values) {
  const declared = new Set((definition.props ?? []).map((prop) => prop.name))
  const kept = found.attributes
    .filter((attribute) => !attribute.name || !declared.has(attribute.name))
    .map((attribute) => attribute.raw)
  const attributes = [...blockAttributes(definition, values, asciidocQuoteValue), ...kept]
  return `[block-${found.block}${attributes.length > 0 ? `, ${attributes.join(', ')}` : ''}]`
}

/**
 * The source block in a block's body, for a block that declares a `contentEditor`.
 *
 * That kind of block holds one source block and nothing else -- a diagram, a drawing -- which is how
 * every source body in this wiki is written: the fence is what keeps the markup off the text, so a
 * line opening with `.` stays a line and not a block title.
 *
 * The whole thing is reported, its attribute line and both fences included, and `writeBlockContent`
 * puts one back the same way. Editing only the lines BETWEEN the fences cannot express an empty body
 * -- there are no lines there to replace.
 *
 * @param {string} text The page source.
 * @param {{ line: number, delimiter: string }} found The block, from `findBlocks`.
 * @returns {{ language: string, fence: string, source: string, startLine: number, endLine: number }|null}
 *          The body, or null for a block that does not hold exactly one source block.
 */
export function findBlockContent(text, found) {
  const lines = text.split('\n')
  let opening = null

  // -> `found.line` is the attribute line and the delimiter is under it, so the body starts below both
  for (let index = found.line + 1; index < lines.length; index++) {
    const line = lines[index]
    if (!opening) {
      // -> The block ended before any source block began: its body is prose, which this cannot edit
      if (closes(line, found.delimiter)) {
        return null
      }
      const source = SOURCE_OPENING.exec(line)
      const fence = source ? SOURCE_FENCE.exec(lines[index + 1] ?? '') : null
      if (source && fence) {
        opening = {
          language: source[1] ?? '',
          fence: fence[1],
          // -> The attribute line, which is replaced along with the fences
          attributeLine: index + 1,
          startLine: index + 2
        }
        index++
      }
      continue
    }
    if (SOURCE_FENCE.test(line) && line.trimEnd() === opening.fence) {
      return {
        language: opening.language,
        fence: opening.fence,
        source: lines.slice(opening.startLine, index).join('\n'),
        startLine: opening.attributeLine,
        endLine: index + 1
      }
    }
  }
  // -> An unterminated fence is a block still being written; there is nothing whole to hand an editor
  return null
}

/**
 * The source block to write back, from what an editor now holds.
 *
 * The language is the one that was there, so nothing about the block moves except the text an editor
 * was given. The fence is LENGTHENED where the new text contains a run of hyphens as long as it --
 * otherwise a body carrying its own fence would close this one early and the rest of it would land in
 * the page as AsciiDoc.
 *
 * @param {{ language: string, fence: string }} content The body, from `findBlockContent`.
 * @param {string} source What the editor produced.
 * @returns {string} The lines to put back, attribute line and fences included, no trailing newline.
 */
export function writeBlockContent(content, source) {
  const longest = Math.max(0, ...[...source.matchAll(/-{4,}/g)].map((match) => match[0].length))
  const fence = '-'.repeat(Math.max(content.fence.length, longest + 1))
  return `[source${content.language ? `,${content.language}` : ''}]\n${fence}\n${source}\n${fence}`
}
