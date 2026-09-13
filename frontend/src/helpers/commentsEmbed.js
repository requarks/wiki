/**
 * Mounting the markup of a third-party comments provider.
 *
 * The server renders each provider's snippet with everything it knows (`models/comments.ts`) and
 * leaves the placeholders it cannot know behind: the ones about the page, which is different on every
 * router transition. Those are what this file fills in, by the same rules and with the same escaping
 * the server uses -- `{{js:page.url}}` is a JavaScript string literal, `{{attr:page.path}}` is an
 * attribute value, and the two escape differently.
 *
 * Why this is done in the browser at all, rather than served in the document the way an analytics tag
 * is: a comment widget belongs at the bottom of the article, and moving between wiki pages here is a
 * router transition and not a document load. A snippet baked into the shell would initialise once and
 * then show the first page's discussion for ever.
 */

/** The placeholder pattern, identical to `PLACEHOLDER` in `backend/models/comments.ts`. */
const PLACEHOLDER = /\{\{(js|attr|num|bool):page\.([A-Za-z0-9_]+)\}\}/g

/** What a character becomes inside a JavaScript string literal. As `models/comments.ts`, verbatim. */
const JS_ESCAPES = {
  '\\': '\\\\',
  "'": "\\'",
  '"': '\\"',
  '`': '\\`',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '<': '\\u003C',
  '>': '\\u003E',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
}

const JS_ESCAPE_PATTERN = /[\\'"`\n\r\t<>&\u2028\u2029]/g

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * Head elements already added to this document, keyed by the markup that produced them.
 *
 * A provider's `head` slot is a stylesheet and an SDK: the same for every page, and expensive to
 * re-fetch and re-evaluate on each router transition. So it is added once and left, which also means
 * a provider's own globals survive the move from one page to the next -- which is exactly what
 * Disqus's `reset` and Remark42's `createInstance` are written to be called against.
 */
const mountedHead = new Map()

function jsEscape(value) {
  return `${value}`.replace(JS_ESCAPE_PATTERN, (char) => JS_ESCAPES[char])
}

function htmlEscape(value) {
  return `${value}`.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

/**
 * Fill a provider's remaining placeholders in with the page in front of the reader.
 *
 * @param {string} template Markup as the server rendered it
 * @param {object} page `{ id, path, title, locale, url }`
 * @returns {string|null} The markup, or null where a `num` placeholder could not be resolved to a
 *   number -- a bare numeric literal that is not one is a syntax error taking the whole snippet with
 *   it, so the snippet is dropped rather than emitted broken. The server does the same.
 */
export function resolvePageTemplate(template, page) {
  if (!template) {
    return ''
  }
  let usable = true
  const rendered = template.replace(PLACEHOLDER, (_match, context, key) => {
    const value = page?.[key]
    switch (context) {
      case 'num': {
        const num = Number(value)
        if (!Number.isFinite(num)) {
          usable = false
          return '0'
        }
        return `${num}`
      }
      case 'bool':
        return value === true ? 'true' : 'false'
      case 'attr':
        return htmlEscape(value ?? '')
      default:
        return jsEscape(value ?? '')
    }
  })
  return usable ? rendered : null
}

/**
 * Parse a fragment of markup into nodes, without running or fetching anything.
 *
 * `<template>` rather than `innerHTML` on a live element: its contents are inert, so a `<script>` in
 * here is a node to be looked at rather than one the browser has already decided not to run.
 */
function parseFragment(markup) {
  const tpl = document.createElement('template')
  tpl.innerHTML = markup
  return [...tpl.content.childNodes]
}

/**
 * A `<script>` the browser will actually run.
 *
 * A script node that arrived through `innerHTML` is inert for ever -- the HTML parser marks it
 * "already started" -- so the only way to run one is to build a fresh element and copy the original
 * over, attributes and all. `type` matters as much as `src`: Waline's snippet is an ES module.
 */
function executableScript(original) {
  const script = document.createElement('script')
  for (const attr of original.attributes) {
    script.setAttribute(attr.name, attr.value)
  }
  script.textContent = original.textContent
  return script
}

/** A script that has to be fetched, resolved once it has run or once it has failed to. */
function whenLoaded(script) {
  if (!script.src) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    script.addEventListener('load', resolve, { once: true })
    // -> A provider that cannot be reached must not leave the rest of the snippet unrun for ever:
    //    its own init script is usually what draws the error the reader is owed
    script.addEventListener('error', resolve, { once: true })
  })
}

/**
 * Add a provider's `head` slot to the document, once per document.
 *
 * Awaited, because the `body` slot is the init call and the thing it initialises is what these load.
 */
async function mountHead(head) {
  if (!head || mountedHead.has(head)) {
    return
  }
  const pending = []
  const nodes = []
  for (const node of parseFragment(head)) {
    const element =
      node.nodeName === 'SCRIPT' && node.nodeType === Node.ELEMENT_NODE
        ? executableScript(node)
        : node
    document.head.appendChild(element)
    nodes.push(element)
    if (element.nodeName === 'SCRIPT') {
      pending.push(whenLoaded(element))
    }
  }
  mountedHead.set(head, nodes)
  await Promise.all(pending)
}

/**
 * Draw one provider's comment widget into a container.
 *
 * The three slots in order: whatever the document needs loaded, the container markup, and then the
 * script that starts the widget -- which is run only once the first has finished, since it is the
 * call into what was loaded.
 *
 * Scripts go INSIDE the container rather than into the head, which several providers depend on:
 * giscus and Isso draw themselves where their own script tag sits.
 *
 * @param {HTMLElement} container Emptied first, so that mounting twice draws once
 * @param {{head: string, main: string, body: string}} code As the site payload carries it
 * @param {object} page `{ id, path, title, locale, url }`
 * @returns {Promise<void>}
 */
export async function mountCommentsEmbed(container, code, page) {
  container.textContent = ''
  await mountHead(resolvePageTemplate(code.head, page))

  const main = resolvePageTemplate(code.main, page)
  if (main) {
    container.innerHTML = main
  }

  const body = resolvePageTemplate(code.body, page)
  if (!body) {
    return
  }
  for (const node of parseFragment(body)) {
    if (node.nodeName === 'SCRIPT' && node.nodeType === Node.ELEMENT_NODE) {
      container.appendChild(executableScript(node))
    } else {
      container.appendChild(node)
    }
  }
}
