const SPEC_ATTR = 'data-infographic-spec'
const OPTS_ATTR = 'data-opts'
const RENDERED_ATTR = 'data-infographic-rendered'

const INFOGRAPHIC_VERSION = '0.2.19'
const CDN_URL = `https://cdn.jsdelivr.net/npm/@antv/infographic@${INFOGRAPHIC_VERSION}/dist/infographic.min.js`
const GLOBAL_NAME = 'AntVInfographic'

const ALLOWED_OPT_KEYS = new Set(['width', 'height', 'theme'])

let libraryPromise = null

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-infographic-cdn="${url}"]`)
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
    script.dataset.infographicCdn = url
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)))
    document.head.appendChild(script)
  })
}

async function loadInfographicLib() {
  if (libraryPromise) {
    return libraryPromise
  }
  libraryPromise = (async () => {
    await loadScript(CDN_URL)
    const ns = window[GLOBAL_NAME]
    if (!ns || typeof ns.Infographic !== 'function') {
      throw new Error(`Loaded ${CDN_URL} but window.${GLOBAL_NAME}.Infographic is missing`)
    }
    return ns.Infographic
  })().catch(err => {
    libraryPromise = null
    throw err
  })
  return libraryPromise
}

function readSpecText(el) {
  if (el.hasAttribute(SPEC_ATTR)) {
    return el.getAttribute(SPEC_ATTR)
  }
  const text = el.textContent
  el.setAttribute(SPEC_ATTR, text)
  return text
}

function parseOpts(raw) {
  const out = {}
  if (!raw) {
    return out
  }
  raw.trim().split(/\s+/).forEach(pair => {
    const eq = pair.indexOf('=')
    if (eq <= 0) {
      return
    }
    const key = pair.slice(0, eq)
    const value = pair.slice(eq + 1)
    if (ALLOWED_OPT_KEYS.has(key)) {
      out[key] = value
    }
  })
  return out
}

function coerceDimension(v, fallback) {
  if (v === undefined || v === null || v === '') {
    return fallback
  }
  // Allow numeric pixels ("400"), CSS strings ("100%", "30rem").
  if (/^\d+$/.test(v)) {
    return Number(v)
  }
  return v
}

function renderError(el, message) {
  const sourceText = el.getAttribute(SPEC_ATTR) || el.textContent
  el.classList.add('infographic-error')
  el.replaceChildren()

  const heading = document.createElement('strong')
  heading.textContent = 'Infographic render error'

  const messageEl = document.createElement('p')
  messageEl.textContent = message

  const sourceEl = document.createElement('pre')
  sourceEl.textContent = sourceText

  el.appendChild(heading)
  el.appendChild(messageEl)
  el.appendChild(sourceEl)
}

export async function hydrateInfographic(rootEl, { darkMode = false } = {}) {
  const root = rootEl || document
  const elements = Array.from(root.querySelectorAll(`.infographic:not([${RENDERED_ATTR}])`))
  if (elements.length === 0) {
    return
  }

  // Capture spec text before any DOM mutation so re-runs stay idempotent.
  elements.forEach(el => readSpecText(el))

  let Infographic
  try {
    Infographic = await loadInfographicLib()
  } catch (err) {
    elements.forEach(el => renderError(el, `Failed to load infographic library: ${err.message}`))
    // eslint-disable-next-line no-console
    console.error('[infographic] failed to load library from CDN', err)
    return
  }

  await Promise.all(elements.map(async el => {
    const spec = readSpecText(el)
    let opts
    try {
      opts = parseOpts(el.getAttribute(OPTS_ATTR))
    } catch (err) {
      renderError(el, `Invalid data-opts: ${err.message}`)
      return
    }

    const finalOpts = {
      container: el,
      width: coerceDimension(opts.width, '100%'),
      height: coerceDimension(opts.height, 480),
      theme: opts.theme || (darkMode ? 'dark' : undefined),
      editable: false
    }

    el.setAttribute(RENDERED_ATTR, '1')
    el.replaceChildren()
    el.classList.remove('infographic-error')

    try {
      const inst = new Infographic(finalOpts)
      const result = inst.render(spec)
      if (result && typeof result.then === 'function') {
        await result
      }
    } catch (err) {
      el.removeAttribute(RENDERED_ATTR)
      renderError(el, err && err.message ? err.message : String(err))
    }
  }))
}
