
import DOMPurify from 'dompurify'

/* global siteConfig */
export default function drawioSanitize(
  content) {
  if (siteConfig.drawio.sanitizing === false) {
    return content
  }

  console.log('DEBUG: Performing sanitizing ...')

  content =
    DOMPurify.sanitize(
      content,
      {
        USE_PROFILES:
        {
          svg: true,
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
      })

  return content
}
