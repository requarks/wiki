import { BUNDLED_ICONS } from '@/assets/icons.generated'

import { copyToClipboard } from './clipboard'
import { notify } from '@/composables/notify'

/**
 * The affordances a rendered page grows once it is on screen: a copy button on every code block, and a
 * pilcrow on every heading that copies a link to it.
 *
 * Scripted rather than rendered, because a page's HTML arrives through `v-html`: there is no template
 * to put a component in, and no Vue instance inside the render to hang one off. So the same treatment
 * is applied to whatever the render just produced -- in the page view and in the editor's preview
 * alike, both of which call `enhanceRenderedContent` after the content changes.
 *
 * Idempotent: a decorated element is marked, so re-running over content that has not been replaced
 * adds nothing. The controls carry their own listeners and are discarded wholesale when `v-html` next
 * writes over them, which is why nothing has to be torn down.
 */

/** Drawn from the same inlined set the interface uses; see `scripts/generate-icons.mjs`. */
const ICON_COPY = 'la:copy'
const ICON_DONE = 'mdi:check'

/** How long a control reports success before offering itself again. */
const COPIED_FOR_MS = 1600

/**
 * An inlined icon as SVG markup.
 *
 * `WIcon` does this in a template; a control built in script cannot use it, so the same record is read
 * directly. Missing icons are impossible in practice -- the names above are literals, so the generator
 * bundles them -- but an empty string is a nicer failure than a broken template string.
 */
function iconSvg(name) {
  const icon = BUNDLED_ICONS[name]
  if (!icon) {
    return ''
  }
  return `<svg viewBox="0 0 ${icon.width} ${icon.height}" width="16" height="16" aria-hidden="true" focusable="false">${icon.body}</svg>`
}

/**
 * Copy, then have the control say so itself: a toast for something this small would be noise, and the
 * pointer is already on the thing that changed.
 */
async function copyWithFeedback({ text, control, restingLabel, restingHtml, doneLabel }) {
  try {
    await copyToClipboard(text)
  } catch (err) {
    notify({ type: 'negative', message: 'Could not copy to the clipboard.', caption: err.message })
    return
  }

  control.classList.add('is-copied')
  control.innerHTML = iconSvg(ICON_DONE)
  setLabel(control, doneLabel)
  clearTimeout(control._resetTimer)
  control._resetTimer = setTimeout(() => {
    control.classList.remove('is-copied')
    control.innerHTML = restingHtml
    setLabel(control, restingLabel)
  }, COPIED_FOR_MS)
}

/**
 * One string for the two things that have to say it: the accessible name, and the tooltip a control
 * draws for itself (see `.heading-anchor::after`). `data-tooltip` is absent on controls whose icon
 * already says what they do, and the stylesheet then has nothing to render.
 */
function setLabel(control, label) {
  control.setAttribute('aria-label', label)
  if (control.dataset.tooltip !== undefined) {
    control.dataset.tooltip = label
  }
}

/** The code as the author wrote it, without the line numbers the gutter draws. */
function codeOf(pre) {
  const code = pre.querySelector('code')
  if (!code) {
    return pre.textContent
  }
  /*
    Cloned so the gutter can be dropped without touching what is on screen. Its spans hold no text --
    the numbers are drawn by a counter -- but the clone keeps the copy honest if that ever changes.
  */
  const copy = code.cloneNode(true)
  for (const gutter of copy.querySelectorAll('.line-numbers-rows')) {
    gutter.remove()
  }
  return copy.textContent.replace(/\n$/, '')
}

function addCodeCopyButtons(root) {
  for (const pre of root.querySelectorAll('pre.codeblock:not([data-code-copy])')) {
    // -> Marks the block as done, and is what the stylesheet keys the button's position off
    pre.dataset.codeCopy = ''

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'code-copy'
    setLabel(button, 'Copy code')
    button.innerHTML = iconSvg(ICON_COPY)
    button.addEventListener('click', () =>
      copyWithFeedback({
        text: codeOf(pre),
        control: button,
        restingLabel: 'Copy code',
        restingHtml: iconSvg(ICON_COPY),
        doneLabel: 'Copied'
      })
    )

    pre.appendChild(button)
  }
}

/**
 * The link a heading's pilcrow copies.
 *
 * Built from the address bar rather than from the page store, so it carries whatever the reader is
 * actually on -- locale prefix included. The editor is the one place where those diverge: it previews a
 * page that lives at its own address, not at `/_edit/…`, so that prefix is dropped.
 */
function headingUrl(id) {
  const path = window.location.pathname.replace(/^\/_edit\//, '/')
  return `${window.location.origin}${path}#${id}`
}

/** The pilcrow, as a character: no icon set carries it, and every font does. */
const PILCROW = '¶'

function addHeadingAnchors(root) {
  const headings = 'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'

  for (const heading of root.querySelectorAll(headings)) {
    if (heading.dataset.headingAnchor !== undefined) {
      continue
    }
    heading.dataset.headingAnchor = ''

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'heading-anchor'
    // -> Declares that this control has a tooltip; `setLabel` keeps the two in step
    button.dataset.tooltip = ''
    setLabel(button, 'Copy link to this section')
    button.textContent = PILCROW
    button.addEventListener('click', () =>
      copyWithFeedback({
        text: headingUrl(heading.id),
        control: button,
        restingLabel: 'Copy link to this section',
        restingHtml: PILCROW,
        doneLabel: 'Link copied'
      })
    )

    heading.appendChild(button)
  }
}

/**
 * @param {HTMLElement|null} root The element the render was written into.
 */
export function enhanceRenderedContent(root) {
  if (!root) {
    return
  }
  addCodeCopyButtons(root)
  addHeadingAnchors(root)
}

/**
 * Paths the server owns rather than the router: assets, the API, block bundles, per-site files,
 * thumbnails and avatars. A link to one of these is a request for a file, not a page, and handing it
 * to the router would render the catch-all page view over the top of nothing.
 */
const SERVER_PATHS = [
  '/_assets/',
  '/_api/',
  '/_blocks/',
  '/_icons/',
  '/_site/',
  '/_thumb/',
  '/_user/'
]

/**
 * Where a link inside rendered content should take the reader, if the router should handle it.
 *
 * A page's HTML arrives through `v-html`, so every link in it is a plain anchor: left alone, the
 * browser tears the whole application down and builds it again to show a page the router could have
 * swapped in. This decides which links are worth intercepting, and everything it declines stays
 * exactly as the browser would have treated it.
 *
 * Declined, deliberately:
 *   - another origin, or a scheme that is not http(s) — `mailto:`, `tel:`, a download link
 *   - anything asking for a new context: `target`, `download`, `rel="external"`
 *   - a path the server owns rather than the router
 *   - a bare fragment on the page already open, which the browser scrolls to and which fires the
 *     `hashchange` the page view already listens for
 *
 * @param {object} link The anchor's own properties: `href` is the resolved absolute URL.
 * @param {Location|{origin: string, pathname: string}} current Where the reader is now.
 * @returns {string|null} A path to push, or null to let the browser do what it would have done.
 */
export function routableHref({ href, target, download, rel } = {}, current) {
  if (!href || (target && target !== '_self') || download || /\bexternal\b/.test(rel ?? '')) {
    return null
  }

  let url
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.origin !== current.origin || !/^https?:$/.test(url.protocol)) {
    return null
  }
  if (SERVER_PATHS.some((prefix) => url.pathname.startsWith(prefix))) {
    return null
  }
  // -> Same page, different fragment: the browser scrolls and announces it, and the router would do
  //    neither
  if (url.pathname === current.pathname && url.hash) {
    return null
  }

  return `${url.pathname}${url.search}${url.hash}`
}
