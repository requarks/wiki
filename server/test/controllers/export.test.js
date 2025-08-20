const request = require('supertest')
const express = require('express')

const router = require('../../controllers/export')
const {
  getSiteIdByPath,
  getExportHtmlContent,
  convertToFile
} = require('../../helpers/export')

const WIKI = {
  auth: {
    checkAccess: jest.fn()
  },
  models: {
    pages: {
      getPage: jest.fn()
    }
  }
}

jest.mock('../../helpers/export', () => ({
  handleInternalLinks: jest.fn(),
  prepareInternalImages: jest.fn(),
  convertToFile: jest.fn(),
  getSiteIdByPath: jest.fn(),
  getExportHtmlContent: jest.fn()
}))

jest.spyOn(console, 'error').mockImplementation(() => { })

const app = express()
app.use(express.json())
app.use((req, res, next) => {
  req.user = { id: 1 }
  next()
})
app.use('/', router)

describe.each([
  { type: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
  { type: 'pdf', contentType: 'application/pdf', extension: 'pdf' }
])('GET /export/$type/:siteId/:pageId', ({ type, contentType, extension }) => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return 400 if query parameters are missing', async () => {
    const response = await request(app)
      .get(`/export/${type}/1/2`)
      .query({ locale: 'en' })

    expect(response.status).toBe(400)
    expect(response.text).toBe('Missing parameters: path, sitePath')
  })

  it('should return 403 if user does not have access', async () => {
    getSiteIdByPath.mockResolvedValue('1234')
    WIKI.auth.checkAccess.mockReturnValue(false)

    const response = await request(app)
      .get(`/export/${type}/1/2`)
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' })

    expect(response.status).toBe(403)
    expect(response.text).toBe('Access denied')
  })

  it('should return 404 if page is not found', async () => {
    getSiteIdByPath.mockResolvedValue('1234')
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.models.pages.getPage.mockResolvedValue(null)

    const response = await request(app)
      .get(`/export/${type}/1/2`)
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' })

    expect(response.status).toBe(404)
    expect(response.text).toBe('Page not found')
  })

  it('should return 500 if convertToFile throws an error', async () => {
    getSiteIdByPath.mockResolvedValue('1234')
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.models.pages.getPage.mockResolvedValue({ title: 'Test Page', render: '<p>Test Content</p>', contentType: 'html' })
    convertToFile.mockRejectedValue(new Error('Conversion error'))

    const response = await request(app)
      .get(`/export/${type}/1/2`)
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' })

    expect(response.status).toBe(500)
    expect(response.text).toBe(`Error exporting to ${type.toUpperCase()}`)
  })

  it(`should return 200 and the ${type.toUpperCase()} file if all parameters are correct for HTML pages`, async () => {
    // GIVEN
    const expectedArgument = `
        <html>
          <head>
            <title>Test Page</title>
          </head>
          <body>
            <a>Test Content</a>
          </body>
        </html>`
    const expectedResponse = Buffer.from(`${type.toUpperCase()} content`)

    getSiteIdByPath.mockResolvedValue('1234')
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.models.pages.getPage.mockResolvedValue({ title: 'Test Page', render: '<a>Test Content¶</a>', contentType: 'html' })
    getExportHtmlContent.mockReturnValue(expectedArgument)
    convertToFile.mockResolvedValue(expectedResponse)

    // WHEN
    const response = await request(app)
      .get(`/export/${type}/1/2`)
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' })

    // THEN
    expect(getExportHtmlContent).toHaveBeenCalledTimes(1)
    expect(getExportHtmlContent).toHaveBeenCalledWith({ title: 'Test Page', render: '<a>Test Content¶</a>', contentType: 'html' }, { id: 1 }, { locale: 'en', path: '/some/path', sitePath: '/site/path' })
    expect(convertToFile).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe(contentType)
    expect(response.headers['content-length']).toBe(String(expectedResponse.length))
    expect(response.headers['content-disposition']).toBe(`attachment; filename="Test_Page.${extension}"`)
  })
})
