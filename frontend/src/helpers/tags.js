/**
 * What a tag may be made of: letters and numbers in any script -- with the combining marks some
 * scripts cannot be written without -- plus space, hyphen, underscore and dot.
 *
 * The server's rule, `backend/helpers/tags.ts`, mirrored so that an author is told while typing rather
 * than when the save is refused. The server is what enforces it, and only for tags a save ADDS: a tag
 * written before the rule existed stays on its page until somebody takes it off.
 */
const TAG_CHARACTERS = /^[\p{L}\p{M}\p{N} ._-]+$/u

/** At least one of these, so that a tag of nothing but punctuation (`-`, `...`) is not one. */
const TAG_WORD_CHARACTER = /[\p{L}\p{N}]/u

/** Whether `tag` is one a page may be given. Surrounding whitespace counts against it. */
export function isValidTag(tag) {
  return (
    typeof tag === 'string' &&
    tag === tag.trim() &&
    TAG_CHARACTERS.test(tag) &&
    TAG_WORD_CHARACTER.test(tag)
  )
}

/**
 * Split what was typed into a tag field into tags, the way every such field does: a comma or a
 * semicolon separates them, so a list can be pasted in one go.
 *
 * @returns `valid`, the tags to add, and `invalid`, the ones to tell the author about
 */
export function parseTypedTags(val) {
  const typed = (val ?? '')
    .split(/[,;]+/)
    .map((v) => v.trim())
    .filter(Boolean)
  return {
    valid: typed.filter(isValidTag),
    invalid: typed.filter((tag) => !isValidTag(tag))
  }
}
