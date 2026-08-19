const {
  buildPageHref,
  buildTagIndexHref,
  getActiveLocaleCode,
  shouldPrefixLocaleInPath
} = require('../../modules/page-navigation/_lib/urlHelpers')

describe('page-navigation/_lib/urlHelpers', () => {
  const originalWiki = global.WIKI

  beforeEach(() => {
    global.WIKI = {
      config: {
        lang: {
          code: 'en',
          namespacing: false
        }
      }
    }
  })

  afterEach(() => {
    global.WIKI = originalWiki
  })

  describe('getActiveLocaleCode', () => {
    it('prefers page localeCode, then options.locale, then site default', () => {
      expect(getActiveLocaleCode({ localeCode: 'bn' }, { locale: 'en' })).toBe('bn')
      expect(getActiveLocaleCode({}, { locale: 'bn' })).toBe('bn')
      expect(getActiveLocaleCode({}, {})).toBe('en')
    })
  })

  describe('shouldPrefixLocaleInPath', () => {
    it('prefixes when namespacing is enabled', () => {
      WIKI.config.lang.namespacing = true
      expect(shouldPrefixLocaleInPath('bn')).toBe(true)
    })

    it('prefixes non-default locale when namespacing is disabled', () => {
      expect(shouldPrefixLocaleInPath('bn')).toBe(true)
      expect(shouldPrefixLocaleInPath('en')).toBe(false)
    })
  })

  describe('buildPageHref', () => {
    it('includes locale prefix when namespacing is enabled', () => {
      WIKI.config.lang.namespacing = true
      expect(buildPageHref({ localeCode: 'bn' }, 'topic/01')).toBe('/bn/topic/01')
    })

    it('uses request locale fallback when page localeCode is missing', () => {
      WIKI.config.lang.namespacing = true
      expect(buildPageHref({}, 'topic/01', { locale: 'bn' })).toBe('/bn/topic/01')
    })

    it('normalizes leading slashes in target paths', () => {
      WIKI.config.lang.namespacing = true
      expect(buildPageHref({ localeCode: 'bn' }, '/topic/01')).toBe('/bn/topic/01')
    })

    it('omits locale for default locale when namespacing is disabled', () => {
      expect(buildPageHref({ localeCode: 'en' }, 'topic/01')).toBe('/topic/01')
    })
  })

  describe('buildTagIndexHref', () => {
    it('includes lang query when locale prefix is required', () => {
      WIKI.config.lang.namespacing = true
      expect(buildTagIndexHref({ localeCode: 'bn' }, 'up:series/download'))
        .toBe('/t/up:series/download?lang=bn')
    })

    it('returns plain tag path for default locale without namespacing', () => {
      expect(buildTagIndexHref({ localeCode: 'en' }, 'up:series/download'))
        .toBe('/t/up:series/download')
    })
  })
})
