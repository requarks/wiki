import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const window = new JSDOM('').window
const purify = DOMPurify(window)

/* global WIKI */
export function sanitizer(
  content,
  config) {
  let purifyConfig = {}

  if (('htmlOnly' in config) &&
      (config.htmlOnly === true)) {
    WIKI.logger.info('Using htmlOnly sanitizer configuration ...')

    purifyConfig =
    {
      USE_PROFILES: {
        html: true
      },
      FORBID_TAGS: ['script'], // keep scripting disabled
      FORBID_ATTR: ['onload', 'onclick', 'onmouseover'] // prevent XSS
    }
  } else if (('svgOnly' in config) &&
            (config.svgOnly === true)) {
    WIKI.logger.info('Using svgOnly sanitizer configuration')

    purifyConfig =
    {
      USE_PROFILES: {
        svg: true,
        svgFilters: true
      }
    }
  } else {
    WIKI.logger.info('Using renderer sanitizer configuration')

    purifyConfig =
    {
      USE_PROFILES: {
        svg: true,
        svgFilters: true,
        html: true
      },
      HTML_INTEGRATION_POINTS:
      {
        foreignobject: true
      },
      ADD_TAGS: [
        'div',
        'foreignObject',
        'switch',
        'style',
        'title',
        'desc',
        'metadata'],
      ADD_ATTR: [
        'xmlns', 'xmlns:xlink', 'xlink:href', 'xml:space', 'xml:base',
        'font-family', 'font-size', 'font-style', 'font-weight',
        'alignment-baseline', 'dominant-baseline', 'baseline-shift',
        'vector-effect', 'text-anchor', 'clip-path', 'mask',
        'fill-rule', 'stroke-linejoin', 'stroke-linecap',
        'transform', 'viewBox', 'preserveAspectRatio',
        'overflow', 'filter', 'style', 'data-name', 'aria-label', 'requiredFeatures', 'pointer-events'],
      FORBID_TAGS: ['script'], // keep scripting disabled
      FORBID_ATTR: ['onload', 'onclick', 'onmouseover'], // prevent XSS
      ALLOW_UNKNOWN_PROTOCOLS: true // for xlink:href
    }

    if (!config.allowIFrames) {
      purifyConfig.FORBID_TAGS.push('iframe')
      purifyConfig.FORBID_ATTR.push('allow')
    }
  }

  return purify.sanitize(
    content,
    purifyConfig)
}
