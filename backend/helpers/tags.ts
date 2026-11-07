import { CustomError } from './common.ts'

/**
 * What a tag may be made of: letters and numbers in any script — with the combining marks some
 * scripts cannot be written without — plus space, hyphen, underscore and dot.
 *
 * An allowlist rather than a list of the characters known to cause trouble, because a tag is read
 * back out of more places than anybody keeps track of: a `#tag` token in a search, the `,`-separated
 * `?t=` of the tag browser and `tags=` of the search API, an attribute in a block's markdown, a page
 * rule. `=` was the one that got through and broke things, and the next one would have been found
 * the same way.
 *
 * Mirrored by `frontend/src/helpers/tags.js`, which tells an author before they save.
 */
const TAG_CHARACTERS = /^[\p{L}\p{M}\p{N} ._-]+$/u

/** At least one of these, so that a tag of nothing but punctuation (`-`, `...`) is not one. */
const TAG_WORD_CHARACTER = /[\p{L}\p{N}]/u

/** Whether `tag` is one a page may be given. Surrounding whitespace makes it a different tag, so it is refused rather than trimmed. */
export function isValidTag(tag: string): boolean {
  return tag === tag.trim() && TAG_CHARACTERS.test(tag) && TAG_WORD_CHARACTER.test(tag)
}

/**
 * Refuse the tags a save would add that are not valid ones.
 *
 * Only the ones it ADDS: tags written before this rule existed are left on the pages that carry them
 * for their authors to take off, so a page still carrying one has to stay savable — and the editor
 * sends every tag the page has on every save.
 *
 * @param tags The tags as the save leaves them
 * @param kept The tags already there, which ask nothing
 */
export function assertValidTags(tags: string[] | undefined, kept: string[] = []): void {
  const existing = new Set(kept)
  const invalid = (tags ?? []).filter((tag) => !existing.has(tag) && !isValidTag(tag))
  if (invalid.length > 0) {
    throw new CustomError(
      'tagInvalid',
      `Invalid tag ${invalid.map((tag) => `"${tag}"`).join(', ')}: a tag may only contain letters, numbers, spaces, hyphens, underscores and dots.`
    )
  }
}
