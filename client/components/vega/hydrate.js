const VEGA_SPEC_ATTR = 'data-vega-spec'

const VEGA_VERSION = '6.2.0'
const VEGA_LITE_VERSION = '6.4.3'
const VEGA_EMBED_VERSION = '7.1.0'

const CDN_BASE = 'https://cdn.jsdelivr.net/npm'
const VEGA_SCRIPTS = [
  { url: `${CDN_BASE}/vega@${VEGA_VERSION}/build/vega.min.js`, global: 'vega' },
  { url: `${CDN_BASE}/vega-lite@${VEGA_LITE_VERSION}/build/vega-lite.min.js`, global: 'vegaLite' },
  { url: `${CDN_BASE}/vega-embed@${VEGA_EMBED_VERSION}/build/vega-embed.min.js`, global: 'vegaEmbed' }
]

let vegaEmbedPromise = null

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-vega-cdn="${url}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)))
      return
    }
    const script = document.createElement('script')
    script.src = url
    script.async = false
    script.dataset.vegaCdn = url
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)))
    document.head.appendChild(script)
  })
}

async function loadVegaEmbed() {
  if (vegaEmbedPromise) {
    return vegaEmbedPromise
  }
  vegaEmbedPromise = (async () => {
    for (const { url, global } of VEGA_SCRIPTS) {
      await loadScript(url)
      if (typeof window[global] === 'undefined') {
        throw new Error(`Loaded ${url} but ${global} global is undefined`)
      }
    }
    return window.vegaEmbed
  })().catch(err => {
    vegaEmbedPromise = null
    throw err
  })
  return vegaEmbedPromise
}

function readSpecText(el) {
  if (el.hasAttribute(VEGA_SPEC_ATTR)) {
    return el.getAttribute(VEGA_SPEC_ATTR)
  }
  const text = el.textContent
  el.setAttribute(VEGA_SPEC_ATTR, text)
  return text
}

function renderError(el, message) {
  const sourceText = el.getAttribute(VEGA_SPEC_ATTR) || el.textContent
  el.classList.add('vega-error')
  el.replaceChildren()

  const heading = document.createElement('strong')
  heading.textContent = 'Vega render error'

  const messageEl = document.createElement('p')
  messageEl.textContent = message

  const sourceEl = document.createElement('pre')
  sourceEl.textContent = sourceText

  el.appendChild(heading)
  el.appendChild(messageEl)
  el.appendChild(sourceEl)
}

function normalizeRawCodeBlocks(root) {
  // Some pipelines (e.g., editor preview) leave fenced vega blocks as
  // `<pre><code class="language-vega">…</code></pre>`. Convert those to the
  // same `<div class="vega|vega-lite">…</div>` shape produced by the server-
  // side renderer, so the rest of the hydrator works uniformly.
  const codeNodes = root.querySelectorAll('pre > code.language-vega, pre > code.language-vega-lite')
  codeNodes.forEach(code => {
    const lang = code.classList.contains('language-vega-lite') ? 'vega-lite' : 'vega'
    const div = document.createElement('div')
    div.className = lang
    div.textContent = code.textContent
    const pre = code.parentElement
    pre.parentNode.replaceChild(div, pre)
  })
}

export async function hydrateVega(rootEl, { darkMode = false } = {}) {
  const root = rootEl || document
  normalizeRawCodeBlocks(root)
  const elements = Array.from(root.querySelectorAll('.vega, .vega-lite'))
  if (elements.length === 0) {
    return
  }

  // Capture spec text before any DOM mutation so re-runs stay idempotent.
  elements.forEach(el => readSpecText(el))

  let embed
  try {
    embed = await loadVegaEmbed()
  } catch (err) {
    elements.forEach(el => renderError(el, `Failed to load Vega library: ${err.message}`))
    // eslint-disable-next-line no-console
    console.error('[vega] failed to load vega-embed from CDN', err)
    return
  }

  const theme = darkMode ? 'dark' : undefined

  await Promise.all(elements.map(async el => {
    const specText = readSpecText(el)
    const mode = el.classList.contains('vega-lite') ? 'vega-lite' : 'vega'

    let spec
    try {
      spec = JSON.parse(specText)
    } catch (err) {
      renderError(el, `Invalid JSON: ${err.message}`)
      return
    }

    el.replaceChildren()
    el.classList.remove('vega-error')

    try {
      await embed(el, spec, { mode, actions: false, theme })
    } catch (err) {
      renderError(el, err.message || String(err))
    }
  }))
}
