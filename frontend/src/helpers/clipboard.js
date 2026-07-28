/**
 * Copy text to the clipboard.
 *
 * Replaces Quasar's `copyToClipboard`. The async Clipboard API covers every browser the app
 * supports, but it is unavailable on insecure origins -- a real case here, since a wiki is often
 * reached over plain http on an internal network -- so the legacy `execCommand` path is kept as a
 * fallback rather than letting the copy silently fail there.
 *
 * @param {string} text
 * @returns {Promise<void>} Rejects if the text could not be copied.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const el = document.createElement('textarea')
  el.value = text
  // -> Off-screen but still focusable; `display: none` would make the selection fail
  el.setAttribute('readonly', '')
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  document.body.appendChild(el)

  try {
    el.select()
    if (!document.execCommand('copy')) {
      throw new Error('Copy command was rejected by the browser.')
    }
  } finally {
    document.body.removeChild(el)
  }
}
