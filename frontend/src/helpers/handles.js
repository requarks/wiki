/**
 * What a mention handle may be: the same rule as `HANDLE_PATTERN` in `backend/models/comments.ts`
 * and the `handle` pattern of the user routes' schemas. Checked here only so that a form can say what
 * is wrong in the reader's language before the server refuses it with its pattern.
 */
const HANDLE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/

/**
 * Whether a handle as typed would be accepted. Empty counts, since saving an empty handle takes it off.
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
export function isValidHandle(value) {
  const trimmed = (value ?? '').trim()
  return trimmed === '' || HANDLE_PATTERN.test(trimmed)
}
