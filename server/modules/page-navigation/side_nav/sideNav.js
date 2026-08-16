/* global WIKI */

function clampNumber (value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, parsed))
}

function normalizeMatch (value, fallback) {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

module.exports = {
  /**
   * Resolve side navigation settings for the current page view.
   *
   * @param {Object} page Page instance
   * @param {Object} config Module configuration
   * @returns {Object} Side nav settings
   */
  resolve (page, config = {}) {
    return {
      parentIconMatch: normalizeMatch(config.parentIconMatch, 'mdi-flower'),
      childIconMatch: normalizeMatch(config.childIconMatch, 'mdi-chevron-right'),
      childIndentPx: clampNumber(config.childIndentPx, 36, 0, 120)
    }
  }
}
