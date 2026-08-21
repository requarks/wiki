const {
  getSiteDisplayName,
  getPwaAppName,
  SITE_DISPLAY_NAME,
  PWA_APP_NAME,
  DEFAULT_WIKI_TITLE
} = require('../../helpers/siteDisplayName')

describe('helpers/siteDisplayName', () => {
  const originalWiki = global.WIKI

  beforeEach(() => {
    global.WIKI = {
      config: {
        title: DEFAULT_WIKI_TITLE
      }
    }
  })

  afterEach(() => {
    global.WIKI = originalWiki
  })

  it('exports branded defaults', () => {
    expect(SITE_DISPLAY_NAME).toBe('সুন্নি নূর')
    expect(PWA_APP_NAME).toBe('Sunni Noor')
    expect(DEFAULT_WIKI_TITLE).toBe('Wiki.js')
  })

  it('returns Bengali site name when config.title is Wiki.js default', () => {
    expect(getSiteDisplayName()).toBe('সুন্নি নূর')
  })

  it('returns Bengali site name when config.title is empty', () => {
    WIKI.config.title = ''
    expect(getSiteDisplayName()).toBe('সুন্নি নূর')
  })

  it('returns custom admin title when set', () => {
    WIKI.config.title = 'Custom Wiki'
    expect(getSiteDisplayName()).toBe('Custom Wiki')
  })

  it('always returns Latin PWA app name', () => {
    expect(getPwaAppName()).toBe('Sunni Noor')
    WIKI.config.title = 'Custom Wiki'
    expect(getPwaAppName()).toBe('Sunni Noor')
  })
})
