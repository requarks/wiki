/**
 * How a blog behaves, as its front page holds it.
 *
 * A blog is a page authored with the `blog` editor: it has a path, a title and a place in the tree,
 * and nothing to read. What an author fills in is how the blog should look, and that is its content,
 * as JSON — see `BlogContent` and `normalizeBlogContent` in the backend's `models/pages.ts`, which is
 * the authority on the shape and rewrites a save into it. This file is the same reading, in front of
 * the author: the editor round-trips through it and the blog view follows what it returns.
 *
 * Which pages are the blog's POSTS is not here and is not stored anywhere — they are the pages under
 * the blog's path, worked out by the server at read time. See `models/blogs.ts`.
 */

/**
 * The ways a listing can draw its posts. See `BLOG_LAYOUTS` on the server for why there are two.
 *
 * Order matters here and not there: the editor's layout dropdown is this array mapped to labels, so
 * this is the order an author reads them in, default first.
 */
export const BLOG_LAYOUTS = ['cards', 'list']

/** Which end of the blog a listing starts at. */
export const BLOG_SORTS = ['newest', 'oldest']

/** The widest a page of the listing may be set to. Mirrors `BLOG_MAX_PER_PAGE` on the server. */
export const BLOG_MAX_PER_PAGE = 100

/** As deep below itself as a blog may collect posts from. Mirrors `BLOG_MAX_DEPTH`. */
export const BLOG_MAX_DEPTH = 10

/** As long an introduction as a front page will carry. Mirrors `BLOG_MAX_INTRO`. */
export const BLOG_MAX_INTRO = 2000

/** A blog with nothing filled in, which is what a page being created starts as. */
export function emptyBlog() {
  return {
    // -> Cards; see `BLOG_DEFAULTS` on the server, which is the authority on every default here
    layout: 'cards',
    perPage: 10,
    sort: 'newest',
    depth: 5,
    intro: '',
    show: { icon: true, description: true, author: true, date: true, tags: true },
    sidebar: { tags: true, archive: true }
  }
}

/**
 * Read a stored blog's settings. Never throws: content that is missing or unparseable comes back as
 * an empty blog, which is a working blog rather than a broken screen — every field here is a display
 * decision and none of them is a destination the way a redirection's target is.
 */
export function parseBlog(content) {
  let parsed = null
  try {
    parsed = JSON.parse(content ?? '')
  } catch {
    // -> An empty blog is the answer; see above
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    parsed = {}
  }
  const defaults = emptyBlog()
  const perPage = Number.parseInt(parsed.perPage, 10)
  const depth = Number.parseInt(parsed.depth, 10)
  return {
    layout: BLOG_LAYOUTS.includes(parsed.layout) ? parsed.layout : defaults.layout,
    perPage:
      Number.isFinite(perPage) && perPage > 0
        ? Math.min(perPage, BLOG_MAX_PER_PAGE)
        : defaults.perPage,
    sort: BLOG_SORTS.includes(parsed.sort) ? parsed.sort : defaults.sort,
    depth: Number.isFinite(depth) && depth >= 0 ? Math.min(depth, BLOG_MAX_DEPTH) : defaults.depth,
    intro: typeof parsed.intro === 'string' ? parsed.intro : defaults.intro,
    show: {
      icon: parsed.show?.icon ?? defaults.show.icon,
      description: parsed.show?.description ?? defaults.show.description,
      author: parsed.show?.author ?? defaults.show.author,
      date: parsed.show?.date ?? defaults.show.date,
      tags: parsed.show?.tags ?? defaults.show.tags
    },
    sidebar: {
      tags: parsed.sidebar?.tags ?? defaults.sidebar.tags,
      archive: parsed.sidebar?.archive ?? defaults.sidebar.archive
    }
  }
}

/** The canonical spelling of a blog's settings, which is what gets saved. */
export function serializeBlog(blog = {}) {
  const value = parseBlog(JSON.stringify(blog))
  return JSON.stringify(value)
}
