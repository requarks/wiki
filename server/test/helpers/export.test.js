const { JSDOM } = require('jsdom')
const pageHelper = require('../../helpers/page')
const {
  handleInternalLinks,
  prepareInternalImages,
  convertToFile,
  getPageContent,
  getPageTreeExportHtml,
  getExportHtmlContent,
  anonymizeMentionedUsers,
  ANONYMIZED_MENTION
} = require('../../helpers/export')
const Page = require('../../models/pages')

jest.mock('node-fetch', () => jest.fn())
const fetch = require('node-fetch')

jest.mock('../../helpers/page', () => ({
  parsePath: jest.fn()
}))

jest.mock('../../models/pages', () => ({
  convertMarkdown2HTML: jest.fn()
}))

jest.mock('jsdom', () => {
  const actualJsdom = jest.requireActual('jsdom')
  return {
    ...actualJsdom,
    JSDOM: jest.fn().mockImplementation((html) => {
      const dom = new actualJsdom.JSDOM(html)
      dom.serialize = jest.fn()
      return dom
    })
  }
})

const WIKI = {
  models: {
    sites: {
      getSiteByPath: jest.fn()
    },
    assets: {
      getAsset: jest.fn()
    },
    pages: {
      getPageTreeFrom: jest.fn()
    }
  },
  auth: {
    checkAccess: jest.fn()
  },
  logger: {
    warn: jest.fn()
  },
  config: {
    host: 'http://internal.com',
    pandocPath: 'http://pandoc-service-path.com'
  }
}
global.WIKI = WIKI

function createImageTestDom() {
  const html = `
    <html>
      <body>
        <img src="/assets/site1/image1.png" />
        <img src="data:image/png;base64,..." />
        <img src="/assets/site1/image2.jpg" />
      </body>
    </html>
  `
  const dom = new JSDOM(html)
  return dom.window.document
}

function createMentionTestDom() {
  const html = `
    <html>
      <body>
        <span data-mention="dummyuser@dummy.com" class="mention">@dummyuser@dummy.com</span>
        <div>
          <span data-mention="nested@company.com" class="mention">@nested@company.com</span>
          <div>
            <span data-mention="deep@company.com" class="mention">@deep@company.com</span>
          </div>
        </div>
      </body>
    </html>
  `
  const dom = new JSDOM(html)
  return dom.window.document
}

function createDomWithSerialize(expectedHTML) {
  let dom
  JSDOM.mockImplementationOnce((html) => {
    dom = new (require('jsdom').JSDOM)(html)
    dom.serialize = jest.fn().mockReturnValue(expectedHTML)
    return dom
  })
  return dom
}

function setupDomForMention(html) {
  let dom
  JSDOM.mockImplementationOnce((htmlContent) => {
    dom = new (require('jsdom').JSDOM)(htmlContent)
    dom.serialize = jest.fn(() => dom.window.document.documentElement.outerHTML)
    return dom
  })
  return dom
}

function getMarkdownPage() {
  return {
    title: 'Markdown Page',
    contentType: 'markdown',
    content: 'Hello @someone@company.com',
    path: 'markdown-path'
  }
}

function getQueryParams(path) {
  return {
    sitePath: 'sitePath',
    locale: 'en',
    path
  }
}


describe('export helpers', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('handleInternalLinks', () => {
    const locale = 'en'
    const pagePaths = ['page', 'page2']

    it('should not modify links if sitePath is not a string', () => {
      const initialPageHTML = '<a href="/site/page#section">Link</a>'
      const sitePath = {} // not a string

      const result = handleInternalLinks(initialPageHTML, sitePath, locale, pagePaths)

      expect(result).toBe(initialPageHTML)
    })

    it('should not adapt external links', () => {
      const initialPageHTML = '<a href="http://external.com/site/page#section">Link</a>'
      const sitePath = 'site'

      const result = handleInternalLinks(initialPageHTML, sitePath, locale, pagePaths)

      expect(result).toBe(initialPageHTML)
    })

    it('should filter out the full path from links to sections on the same page when an external link was used', () => {
      const pageHTML = `<a href="http://internal.com/site/page#section1">Link1</a>
        <a href="http://internal.com/site/en/page2#section2">Link2</a>` // external link
      const sitePath = 'site'

      const result = handleInternalLinks(pageHTML, sitePath, locale, pagePaths)

      expect(result).toBe(`<a href="#section1">Link1</a>
        <a href="#section2">Link2</a>`)
    })

    it('should filter out the internal path from links to sections on the same page when an internal link was used', () => {
      const pageHTML = `<a href="/site/page#section1">Link1</a>
        <a href="/site/en/page2#section2">Link2</a>` // internal link
      const sitePath = 'site'

      const result = handleInternalLinks(pageHTML, sitePath, locale, pagePaths)

      expect(result).toBe(`<a href="#section1">Link1</a>
        <a href="#section2">Link2</a>`)
    })

    it('should add the path of links to different pages', () => {
      const pageHTML = `<a href="/site/other-page">Link</a>
        <a href="/site/en/other-page">Link with locale</a>`
      const sitePath = 'site'

      const result = handleInternalLinks(pageHTML, sitePath, locale, pagePaths)

      expect(result).toBe(`<a href="http://internal.com/site/other-page">Link</a>
        <a href="http://internal.com/site/en/other-page">Link with locale</a>`)
    })
  })

  describe('prepareInternalImages', () => {
    let document
    let req

    beforeEach(() => {
      document = createImageTestDom()
      req = {
        user: {}
      }
    })

    it('should convert internal images to base64', async () => {
      WIKI.models.sites.getSiteByPath.mockResolvedValue({ id: 1, path: 'site1' })
      WIKI.auth.checkAccess.mockReturnValue(true)
      WIKI.models.assets.getAsset.mockResolvedValue('base64data')
      pageHelper.parsePath.mockReturnValue({ path: 'image1.png' })

      await prepareInternalImages(document, req)

      const images = document.querySelectorAll('img')
      expect(images[0].src).toBe('data:image/png;base64,base64data')
      expect(images[1].src).toBe('data:image/png;base64,...')
      expect(images[2].src).toBe('data:image/jpeg;base64,base64data')
    })

    it('should log a warning if site is not found', async () => {
      WIKI.models.sites.getSiteByPath.mockResolvedValue(null)

      await prepareInternalImages(document, req)

      expect(WIKI.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Retrieval of the site of'))
    })

    it('should skip images if access is denied', async () => {
      WIKI.models.sites.getSiteByPath.mockResolvedValue({ id: 1, path: 'site1' })
      WIKI.auth.checkAccess.mockReturnValue(false)
      pageHelper.parsePath.mockReturnValue({ path: 'image1.png' })

      await prepareInternalImages(document, req)

      const images = document.querySelectorAll('img')
      expect(images[0].src).toBe('/assets/site1/image1.png')
    })

    it('should skip images if asset is not found', async () => {
      WIKI.models.sites.getSiteByPath.mockResolvedValue({ id: 1, path: 'site1' })
      WIKI.auth.checkAccess.mockReturnValue(true)
      WIKI.models.assets.getAsset.mockResolvedValue(false)
      pageHelper.parsePath.mockReturnValue({ path: 'image1.png' })

      await prepareInternalImages(document, req)

      const images = document.querySelectorAll('img')
      expect(images[0].src).toBe('/assets/site1/image1.png')
    })
  })

  describe('anonymizeMentionedUsers', () => {
    let document

    beforeEach(() => {
      document = createMentionTestDom()
    })

    it('should anonymize mentioned users', async () => {
      anonymizeMentionedUsers(document)

      const mentions = document.querySelectorAll('.mention[data-mention]')
      expect(mentions.length).toBe(3)
      mentions.forEach(m => {
        expect(m.getAttribute('data-mention')).toBe(ANONYMIZED_MENTION)
        expect(m.textContent).toBe(`@${ANONYMIZED_MENTION}`)
      })
    })
  })

  describe('convertToFile', () => {
    const pageHTML = '<html><body><h1>Test</h1></body></html>'
    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked buffer'))
    }

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should convert HTML to Word document successfully', async () => {
      fetch.mockResolvedValue(mockResponse)

      const result = await convertToFile(pageHTML, 'docx')

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        'http://pandoc-service-path.com/convert-to-docx',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': expect.stringContaining('multipart/form-data; boundary=----WebKitFormBoundary')
          }),
          body: expect.any(Buffer)
        })
      )
      expect(result).toEqual(Buffer.from('mocked buffer'))
    })

    it('should throw an error if the response is not ok', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error')
      })

      await expect(convertToFile(pageHTML, 'docx')).rejects.toThrow('HTTP error! status: 500')

      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should log and throw an error if fetch fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { })
      const error = new Error('Network error')
      fetch.mockRejectedValue(error)

      await expect(convertToFile(pageHTML, 'docx')).rejects.toThrow('Network error')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error converting document to docx:', error)
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getPageContent', () => {
    it('should return the page content for contentType html', () => {
      const page = {
        contentType: 'html',
        render: '<p>Test</p>'
      }

      const result = getPageContent(page)

      expect(result).toBe(page.render)
    })

    it('should return the converted page content for contentType markdown', () => {
      const page = {
        contentType: 'markdown',
        render: '## Test'
      }
      const expectedHTML = '<h2>Test</h2>'
      Page.convertMarkdown2HTML.mockReturnValue(expectedHTML)

      const result = getPageContent(page)

      expect(Page.convertMarkdown2HTML).toHaveBeenCalledTimes(1)
      expect(Page.convertMarkdown2HTML).toHaveBeenCalledWith(page)
      expect(result).toBe(expectedHTML)
    })

    it('should throw an error if the content type is not supported', () => {
      const page = {
        contentType: 'unsupported',
        render: 'Test'
      }

      expect(() => getPageContent(page)).toThrow('Unsupported content type: unsupported')
    })
  })

  describe('getPageTreeExportHtml', () => {
    it('should return the HTML content of the page tree', () => {
      const pageTree = [
        { title: 'Main Page', contentType: 'html', render: '<p>Main content</p>' },
        { title: 'Page 1', contentType: 'html', render: '<p>Page 1 content</p>' },
        { title: 'Page 2', contentType: 'html', render: '<p>Page 2 content</p>' }
      ]
      const user = {}
      const queryParams = {}
      WIKI.auth.checkAccess.mockReturnValue(true)

      const result = getPageTreeExportHtml(pageTree, user, queryParams)

      expect(result).toBe(`
    <html>
      <head>
        <title>Main Page</title>
      </head>
      <body>
        <article>
          <div>
            <p>Main content</p>
          </div>
        </article>
        <article>
          <h1>Page 1</h1>
          <div>
            <p>Page 1 content</p>
          </div>
        </article>
        <article>
          <h1>Page 2</h1>
          <div>
            <p>Page 2 content</p>
          </div>
        </article>
      </body>
    </html>`)
    })

    it('should skip pages the user does not have access to', () => {
      const pageTree = [
        { title: 'Main Page', contentType: 'html', render: '<p>Main content</p>' }, // user has access
        { title: 'Page 1', contentType: 'html', render: '<p>Page 1 content</p>' }, // user does not have access
        { title: 'Page 2', contentType: 'html', render: '<p>Page 2 content</p>' } // user has access
      ]
      const user = {}
      const queryParams = {}
      WIKI.auth.checkAccess.mockReturnValueOnce(false).mockReturnValueOnce(true) // the main page implicitly has access

      const result = getPageTreeExportHtml(pageTree, user, queryParams)

      expect(result).toBe(`
    <html>
      <head>
        <title>Main Page</title>
      </head>
      <body>
        <article>
          <div>
            <p>Main content</p>
          </div>
        </article>
        <article>
          <h1>Page 2</h1>
          <div>
            <p>Page 2 content</p>
          </div>
        </article>
      </body>
    </html>`)
    })
  })

  describe('getExportHtmlContent', () => {
    const page = {
      title: 'Main Page',
      contentType: 'html',
      render: '<h1 id="main-headline"><a href="#main-headline">¶</a>Main Headline</h1><p>Main content</p>',
      path: 'path'
    }
    const pageTree = [
      {
        title: 'Main Page',
        contentType: 'html',
        render: '<h1 id="main-headline"><a href="#main-headline">¶</a>Main Headline</h1><p>Main content</p>'
      },
      { title: 'Page 1', contentType: 'html', render: '<p>Page 1 content</p>' },
      { title: 'Page 2', contentType: 'html', render: '<p>Page 2 content</p>' }
    ]
    const user = {}

    beforeEach(() => {
      WIKI.auth.checkAccess.mockReturnValue(true)
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return the HTML content of a single page', async () => {
      const queryParams = getQueryParams('path')
      const expectedHTML = `
    <html>
      <head>
        <title>Main Page</title>
      </head>
      <body>
        <h1 id="main-headline"><a href="#main-headline"></a>Main Headline</h1><p>Main content</p>
      </body>
    </html>`
      createDomWithSerialize(expectedHTML)

      const result = await getExportHtmlContent(page, user, queryParams)
      expect(result).toBe(expectedHTML)
    })

    it('should return the HTML content of the page tree', async () => {
      const queryParams = { ...getQueryParams('path'), isPageTreeExport: true }
      const expectedHTML = `
    <html>
      <head>
        <title>Main Page</title>
      </head>
      <body>
        <article>
          <div>
            <h1 id="main-headline"><a href="#main-headline"></a>Main Headline</h1><p>Main content</p>
          </div>
        </article>
        <article>
          <h1>Page 1</h1>
          <div>
            <p>Page 1 content</p>
          </div>
        </article>
        <article>
          <h1>Page 2</h1>
          <div>
            <p>Page 2 content</p>
          </div>
        </article>
      </body>
    </html>`
      WIKI.models.pages.getPageTreeFrom.mockResolvedValue(pageTree)
      createDomWithSerialize(expectedHTML)

      const result = await getExportHtmlContent(page, user, queryParams)
      expect(result).toBe(expectedHTML)
    })

    it('should only export the content of a single page if isPageTreeExport is false', async () => {
      const queryParams = { ...getQueryParams('path'), isPageTreeExport: false }
      const expectedHTML = `
    <html>
      <head>
        <title>Main Page</title>
      </head>
      <body>
        <h1 id="main-headline"><a href="#main-headline"></a>Main Headline</h1><p>Main content</p>
      </body>
    </html>`
      createDomWithSerialize(expectedHTML)

      const result = await getExportHtmlContent(page, user, queryParams)
      expect(WIKI.models.pages.getPageTreeFrom).not.toHaveBeenCalled()
      expect(result).toBe(expectedHTML)
    })

    it('should anonymize mentioned users in the exported HTML', async () => {
      const pageWithMention = {
        title: 'Mention Page',
        contentType: 'html',
        render: `<h1 class="toc-header" id="header"><a href="#header" class="toc-anchor">¶</a> Header</h1>
<p>Your content here</p>
<p><span data-mention="dummy.user@dummy.com" class="mention">@dummy.user@dummy.com</span></p>`,
        path: 'mention-path'
      }
      const queryParams = getQueryParams('mention-path')
      setupDomForMention(pageWithMention.render)

      const result = await getExportHtmlContent(pageWithMention, user, queryParams)
      expect(result).toContain(`@${ANONYMIZED_MENTION}`)
      expect(result).toContain(`data-mention="${ANONYMIZED_MENTION}"`)
      expect(result).not.toContain('dummy.user@dummy.com')
    })

    it('should anonymize mentioned users in a markdown page', async () => {
      const markdownPage = getMarkdownPage()
      const queryParams = getQueryParams('markdown-path')

      Page.convertMarkdown2HTML.mockReturnValue('<p>Hello <span data-mention="someone@company.com" class="mention">@someone@company.com</span></p>')
      setupDomForMention('<p>Hello <span data-mention="someone@company.com" class="mention">@someone@company.com</span></p>')

      const result = await getExportHtmlContent(markdownPage, user, queryParams)
      expect(result).toContain(`@${ANONYMIZED_MENTION}`)
      expect(result).toContain(`data-mention="${ANONYMIZED_MENTION}"`)
      expect(result).not.toContain('someone@company.com')
    })
  })
})
