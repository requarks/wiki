const fs = require('fs')
const path = require('path')

/* global WIKI */

const REQUIRED_THEME_FILES = [
  'theme.yml',
  path.join('scss', 'app.scss'),
  path.join('js', 'app.js')
]

function getThemesDir() {
  const candidates = [
    path.join(WIKI.ROOTPATH, 'client', 'themes'),
    path.resolve(__dirname, '..', '..', 'client', 'themes')
  ]

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    } catch {
      // ignore
    }
  }

  return candidates[0]
}

function isThemeAvailable(themeKey) {
  if (!themeKey || typeof themeKey !== 'string') return false

  const themesDir = getThemesDir()
  const themeDir = path.join(themesDir, themeKey)
  if (!fs.existsSync(themeDir)) return false

  return REQUIRED_THEME_FILES.every(rel => fs.existsSync(path.join(themeDir, rel)))
}

function listThemeKeys() {
  const themesDir = getThemesDir()
  if (!fs.existsSync(themesDir)) return []

  return fs.readdirSync(themesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(isThemeAvailable)
}

async function ensureValidThemeSelection({ fallbackTheme = 'default', persist = true } = {}) {
  const current = WIKI?.config?.theming?.theme

  if (isThemeAvailable(current)) {
    return current
  }

  let next = fallbackTheme
  if (!isThemeAvailable(next)) {
    next = listThemeKeys()[0] || 'default'
  }

  if (WIKI?.config?.theming && WIKI.config.theming.theme !== next) {
    WIKI.config.theming.theme = next
    if (persist && WIKI?.configSvc?.saveToDb) {
      await WIKI.configSvc.saveToDb(['theming'])
    }
  }

  return next
}

module.exports = {
  getThemesDir,
  isThemeAvailable,
  listThemeKeys,
  ensureValidThemeSelection
}
