/**
 * Where the tag browser lives, and how a selection is written into its URL.
 *
 * The selection is in the query rather than in the path, so a set of tags is a link somebody can be
 * handed -- which is the whole point of a screen that exists to be arrived at from a tag. `t` rather
 * than `tags`, because the path already says which of the two this is: `/_tags?t=api` reads where
 * `/_tags?tags=api` stutters.
 *
 * Here rather than in `pages/Tags.vue` because the name is a contract between that screen and
 * everything that links INTO it -- the tag chips on a page, today -- and a parameter known in two
 * places is a parameter that can be renamed in one.
 */
export const TAG_BROWSER_PATH = '/_tags'
export const TAG_BROWSER_PARAM = 't'

/**
 * A router target for the tag browser showing `tags`.
 *
 * @param {string[]} tags Tags to preselect. Empty for the browser with nothing chosen, which is the
 *   screen's own starting state rather than an error.
 */
export function tagBrowserRoute(tags = []) {
  const selection = tags.filter((tag) => tag).join(',')
  return {
    path: TAG_BROWSER_PATH,
    query: selection ? { [TAG_BROWSER_PARAM]: selection } : {}
  }
}
