const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')

/* global WIKI */

const ALLOWED_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2']

const FORMAT_BY_EXT = {
  '.ttf': 'truetype',
  '.otf': 'opentype',
  '.woff': 'woff',
  '.woff2': 'woff2'
}

const MIME_BY_EXT = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

module.exports = {
  ALLOWED_EXTENSIONS,
  FORMAT_BY_EXT,
  MIME_BY_EXT,

  getFontsDir () {
    return path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'custom-fonts')
  },

  async ensureFontsDir () {
    await fs.ensureDir(this.getFontsDir())
  },

  getFormatFromExt (ext) {
    return FORMAT_BY_EXT[ext.toLowerCase()] || 'truetype'
  },

  getMimeFromExt (ext) {
    return MIME_BY_EXT[ext.toLowerCase()] || 'application/octet-stream'
  },

  getFontUrl (filename) {
    return `/_custom/fonts/${encodeURIComponent(filename)}`
  },

  normalizeUnicodeRange (value) {
    if (_.isEmpty(value)) {
      return ''
    }

    return String(value)
      .split(',')
      .map(part => part.trim().toUpperCase())
      .filter(Boolean)
      .join(',')
  },

  getFontStack (fonts) {
    const normalized = this.normalizeFonts(fonts)
    if (normalized.length < 1) {
      return ''
    }
    return `${_.uniq(normalized.map(font => font.family)).join(', ')}, sans-serif`
  },

  generateApplyCSS (fonts) {
    const stack = this.getFontStack(fonts)
    if (!stack) {
      return ''
    }

    const iconStack = `'Material Design Icons', sans-serif`
    const applyRule = (selector) => `${selector} *:not(.v-icon) {
  font-family: ${stack} !important;
}

${selector} .v-icon {
  font-family: ${iconStack} !important;
  line-height: 1;
}`

    return [
      applyRule('.v-main :is(.contents, .page-header-block, .page-col-sd, #arrow-boxes, .related-posts)'),
      applyRule('.v-application .v-navigation-drawer')
    ].join('\n\n')
  },

  generateFaceCSS (fonts) {
    const normalized = this.normalizeFonts(fonts)
    if (normalized.length < 1) {
      return ''
    }

    return normalized.map(font => {
      const lines = [
        '@font-face {',
        `  font-family: ${font.family};`,
        `  src: url('${this.getFontUrl(font.filename)}') format('${font.format}');`,
        `  font-weight: ${font.weight || 400};`,
        `  font-style: ${font.style || 'normal'};`
      ]

      if (!_.isEmpty(font.unicodeRange)) {
        lines.push(`  unicode-range: ${font.unicodeRange};`)
      }

      lines.push('}')
      return lines.join('\n')
    }).join('\n')
  },

  generateCSS (fonts) {
    const faceRules = this.generateFaceCSS(fonts)
    const applyRules = this.generateApplyCSS(fonts)
    return [faceRules, applyRules].filter(Boolean).join('\n\n')
  },

  buildInjectCSS (themingConfig) {
    const fonts = _.get(themingConfig, 'customFonts', [])
    const faceCSS = this.generateFaceCSS(fonts)
    const applyCSS = this.generateApplyCSS(fonts)
    const userCSS = _.get(themingConfig, 'injectCSS', '') || ''
    // Apply rules last so they override legacy font-family rules in injectCSS.
    return [faceCSS, userCSS, applyCSS].filter(Boolean).join('\n\n')
  },

  async cleanupOrphans (fonts) {
    await this.ensureFontsDir()
    const allowed = new Set(_.map(fonts || [], 'filename'))
    const entries = await fs.readdir(this.getFontsDir())

    await Promise.all(entries.map(async filename => {
      if (!allowed.has(filename)) {
        await fs.remove(path.join(this.getFontsDir(), filename))
      }
    }))
  },

  normalizeFonts (fonts) {
    return _.chain(fonts || [])
      .filter(font => font && font.id && font.family && font.filename && font.format)
      .map(font => ({
        id: String(font.id),
        family: String(font.family).trim(),
        filename: path.basename(String(font.filename)),
        format: String(font.format),
        weight: _.toInteger(font.weight) || 400,
        style: String(font.style || 'normal'),
        unicodeRange: this.normalizeUnicodeRange(font.unicodeRange)
      }))
      .uniqBy('id')
      .value()
  }
}
