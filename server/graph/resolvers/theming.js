const graphHelper = require('../../helpers/graph')
const _ = require('lodash')
const CleanCSS = require('clean-css')
const fs = require('fs')
const path = require('path')
const YAML = require('js-yaml')
const themingHelper = require('../../helpers/theming')

/* global WIKI */

module.exports = {
  Query: {
    async theming() { return {} }
  },
  Mutation: {
    async theming() { return {} }
  },
  ThemingQuery: {
    async themes(obj, args, context, info) {
      WIKI.logger.info('Themes resolver called')
      const themes = []
      let themesDir = path.join(WIKI.ROOTPATH, 'client', 'themes')

      // Robust path detection
      if (!fs.existsSync(themesDir)) {
        themesDir = path.resolve(__dirname, '..', '..', '..', 'client', 'themes')
      }

      WIKI.logger.info(`Scanning themes directory: ${themesDir}`)

      try {
        if (!fs.existsSync(themesDir)) {
          throw new Error(`Themes directory not found at ${themesDir}`)
        }

        const themeDirs = fs.readdirSync(themesDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name)

        WIKI.logger.info(`Found theme directories: ${themeDirs.join(', ')}`)

        for (const themeKey of themeDirs) {
          const themeYmlPath = path.join(themesDir, themeKey, 'theme.yml')
          try {
            if (fs.existsSync(themeYmlPath)) {
              const themeConfig = YAML.load(fs.readFileSync(themeYmlPath, 'utf8'))
              themes.push({
                key: themeKey,
                title: themeConfig.name || themeKey,
                author: themeConfig.author || 'Unknown'
              })
              WIKI.logger.info(`Loaded theme: ${themeKey} - ${themeConfig.name}`)
            } else {
              WIKI.logger.warn(`theme.yml not found for ${themeKey}`)
            }
          } catch (err) {
            WIKI.logger.warn(`Failed to load theme ${themeKey}: ${err.message}`)
          }
        }

        if (themes.length === 0) {
          throw new Error('No themes could be loaded from directories')
        }
      } catch (err) {
        WIKI.logger.warn(`Failed to scan themes directory: ${err.message}`)
        // Return default theme as fallback
        themes.push({
          key: 'default',
          title: 'Default',
          author: 'requarks.io'
        })
      }

      WIKI.logger.info(`Returning ${themes.length} themes`)
      return themes
    },
    async config(obj, args, context, info) {
      const theme = await themingHelper.ensureValidThemeSelection({ fallbackTheme: 'default', persist: true })
      return {
        theme,
        iconset: WIKI.config.theming.iconset,
        darkMode: WIKI.config.theming.darkMode,
        tocPosition: WIKI.config.theming.tocPosition || 'left',
        injectCSS: new CleanCSS({ format: 'beautify' }).minify(WIKI.config.theming.injectCSS).styles,
        injectHead: WIKI.config.theming.injectHead,
        injectBody: WIKI.config.theming.injectBody
      }
    }
  },
  ThemingMutation: {
    async setConfig(obj, args, context, info) {
      try {
        const requestedTheme = themingHelper.isThemeAvailable(args.theme) ? args.theme : 'default'
        const didFallback = requestedTheme !== args.theme

        if (!_.isEmpty(args.injectCSS)) {
          args.injectCSS = new CleanCSS({
            inline: false
          }).minify(args.injectCSS).styles
        }

        WIKI.config.theming = {
          ...WIKI.config.theming,
          theme: requestedTheme,
          iconset: args.iconset,
          darkMode: args.darkMode,
          tocPosition: args.tocPosition || 'left',
          injectCSS: args.injectCSS || '',
          injectHead: args.injectHead || '',
          injectBody: args.injectBody || ''
        }

        await WIKI.configSvc.saveToDb(['theming'])

        return {
          responseResult: graphHelper.generateSuccess(didFallback ? 'Selected theme not found. Falling back to Default.' : 'Theme config updated')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deleteTheme(obj, args, context, info) {
      try {
        if (args.key === 'default') {
          throw new Error('Cannot delete the default theme.')
        }

        const themesDir = path.join(WIKI.ROOTPATH, 'client', 'themes')
        const themePath = path.join(themesDir, args.key)

        if (!fs.existsSync(themePath)) {
          throw new Error(`Theme ${args.key} does not exist.`)
        }

        fs.rmSync(themePath, { recursive: true, force: true })

        // Ensure active theme is still valid (handles manual deletions / races)
        await themingHelper.ensureValidThemeSelection({ fallbackTheme: 'default', persist: true })

        return {
          responseResult: graphHelper.generateSuccess('Theme deleted successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
