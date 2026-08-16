/* global WIKI */

function clampNumber (value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, parsed))
}

module.exports = {
  /**
   * Resolve iframe embed display settings for a page.
   *
   * @param {Object} page Page instance
   * @param {Object} config Module configuration
   * @returns {Object} Iframe sizing settings
   */
  resolve (page, config = {}) {
    return {
      desktopHeightPx: clampNumber(config.desktopHeightPx, 1000, 200, 5000),
      desktopMinHeightVh: clampNumber(config.desktopMinHeightVh, 75, 0, 100),
      mobileHeightPx: clampNumber(config.mobileHeightPx, 480, 120, 2000),
      mobileMaxHeightVh: clampNumber(config.mobileMaxHeightVh, 60, 10, 100)
    }
  }
}
