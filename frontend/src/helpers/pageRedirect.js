/**
 * What a redirection page holds instead of a body.
 *
 * A redirection is an ordinary page authored with the `redirect` editor: it has a path, a title and a
 * place in the tree, and nothing to read. Where it points is its content, as JSON — see
 * `normalizeRedirectContent` in the backend's `models/pages.ts`, which is the authority on the shape
 * and refuses a save that does not match it. This file is the same reading, in front of the author:
 * the editor round-trips through it, and the page view follows what it returns.
 */

/**
 * How long the interstitial is shown before the reader is taken on, in milliseconds.
 *
 * Long enough to read one line and see where they are going, short enough that nobody waits on it.
 */
export const REDIRECT_INTERSTITIAL_MS = 2500

/** An empty redirection, which is what a page being created starts as. */
export function emptyRedirect() {
  return { kind: 'page', target: '', showInterstitial: false }
}

/**
 * Read a stored redirection. Never throws: content that is missing or unparseable comes back as an
 * empty redirection, which the editor opens on and the page view reports as having nowhere to go.
 */
export function parseRedirect(content) {
  let parsed = null
  try {
    parsed = JSON.parse(content ?? '')
  } catch {
    // -> An empty redirection is the answer; see above
  }
  return {
    kind: parsed?.kind === 'url' ? 'url' : 'page',
    target: typeof parsed?.target === 'string' ? parsed.target.trim() : '',
    showInterstitial: parsed?.showInterstitial === true
  }
}

/** The canonical spelling of a redirection, which is what gets saved. */
export function serializeRedirect({ kind, target, showInterstitial } = {}) {
  return JSON.stringify({
    kind: kind === 'url' ? 'url' : 'page',
    target: (target ?? '').trim(),
    showInterstitial: showInterstitial === true
  })
}

/**
 * Whether a redirection can actually be followed.
 *
 * The same two rules the server enforces: a page target is a rooted path within this wiki, and a URL
 * target is a complete `http(s)` address — anything else is either not a destination or, for
 * `javascript:`, a link nobody chose to follow.
 */
export function isFollowable({ kind, target } = {}) {
  const value = (target ?? '').trim()
  if (value.length < 1) {
    return false
  }
  return kind === 'url'
    ? /^https?:\/\/\S/i.test(value)
    : value.startsWith('/') && !value.startsWith('//')
}
