const request = require('supertest');
const express = require('express');
const { JSDOM } = require('jsdom');

const router = require('../../controllers/export');
const {
  handleInternalLinks,
  prepareInternalImages,
  convertToWord
} = require('../../helpers/export');
const Page = require('../../models/pages')

const WIKI = {
  auth: {
    checkAccess: jest.fn()
  },
  models: {
    pages: {
      getPage: jest.fn()
    }
  }
};

jest.mock('../../helpers/export', () => ({
  handleInternalLinks: jest.fn(),
  prepareInternalImages: jest.fn(),
  convertToWord: jest.fn()
}));

jest.mock('../../models/pages', () => ({
  convertMarkdown2HTML: jest.fn()
}));

jest.mock('jsdom', () => {
  const actualJsdom = jest.requireActual('jsdom');
  return {
    ...actualJsdom,
    JSDOM: jest.fn().mockImplementation((html) => {
      const dom = new actualJsdom.JSDOM(html);
      dom.serialize = jest.fn();
      return dom;
    })
  };
});

jest.spyOn(console, 'error').mockImplementation(() => {});

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = { id: 1 };
  next();
});
app.use('/', router);

describe('GET /export/docx/:pageId', () => {

  beforeEach(() => {
    global.WIKI = WIKI;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if query parameters are missing', async () => {
    const response = await request(app)
      .get('/export/docx/1')
      .query({ locale: 'en' });

    expect(response.status).toBe(400);
    expect(response.text).toBe('Missing parameters: path, sitePath');
  });

  it('should return 403 if user does not have access', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false);

    const response = await request(app)
      .get('/export/docx/1')
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' });

    expect(response.status).toBe(403);
    expect(response.text).toBe('Access denied');
  });

  it('should return 404 if page is not found', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true);
    WIKI.models.pages.getPage.mockResolvedValue(null);

    const response = await request(app)
      .get('/export/docx/1')
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' });

    expect(response.status).toBe(404);
    expect(response.text).toBe('Page not found');
  });

  it('should return 500 if page content type is not supported', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true);
    WIKI.models.pages.getPage.mockResolvedValue({ title: 'Test Page', contentType: 'unkonwn_content_type' });

    const response = await request(app)
      .get('/export/docx/1')
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' });

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith( 'Error exporting to DOCX:', new Error('Unsupported content type: unkonwn_content_type') );
    expect(response.status).toBe(500);
    expect(response.text).toBe('Error exporting to DOCX');
  });

  it('should return 500 if convertToWord throws an error', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true);
    WIKI.models.pages.getPage.mockResolvedValue({ title: 'Test Page', render: '<p>Test Content</p>', contentType: 'html' });
    convertToWord.mockRejectedValue(new Error('Conversion error'));

    const response = await request(app)
      .get('/export/docx/1')
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' });

    expect(response.status).toBe(500);
    expect(response.text).toBe('Error exporting to DOCX');
  });

  it('should return 200 and the DOCX file if all parameters are correct for HTML pages', async () => {
    // GIVEN
    const expectedArgument = `
        <html>
          <head>
            <title>Test Page</title>
          </head>
          <body>
            <a>Test Content</a>
          </body>
        </html>
      `;
    const expectedResponse = Buffer.from('DOCX content');

    WIKI.auth.checkAccess.mockReturnValue(true);
    WIKI.models.pages.getPage.mockResolvedValue({ title: 'Test Page', render: '<a>Test Content¶</a>', contentType: 'html' });
    handleInternalLinks.mockResolvedValue();
    let dom;
    JSDOM.mockImplementationOnce((html) => {
      dom = new (require('jsdom').JSDOM)(html);
      dom.serialize = jest.fn().mockReturnValue(expectedArgument);
      return dom;
    });
    prepareInternalImages.mockResolvedValue();
    convertToWord.mockResolvedValue(Buffer.from('DOCX content'));

    //WHEN
    const response = await request(app)
      .get('/export/docx/1')
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' });

    // THEN
    expect(handleInternalLinks).toHaveBeenCalledTimes(1);
    expect(handleInternalLinks).toHaveBeenCalledWith(expectedArgument, '/site/path', '/some/path');

    expect(prepareInternalImages).toHaveBeenCalledTimes(1);
    expect(prepareInternalImages).toHaveBeenCalledWith(dom.window.document, expect.any(Object));

    expect(convertToWord).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(response.headers['content-length']).toBe(String(expectedResponse.length));
    expect(response.headers['content-disposition']).toBe('attachment; filename="Test_Page.docx"');
  });

  it('should return 200 and the DOCX file if all parameters are correct for markdown pages', async () => {
    // GIVEN
    const expectedArgument = `
        <html>
          <head>
            <title>Test Page</title>
          </head>
          <body>
            <h1>Test Content</h1>
          </body>
        </html>
      `;
    const expectedResponse = Buffer.from('DOCX content');

    WIKI.auth.checkAccess.mockReturnValue(true);
    WIKI.models.pages.getPage.mockResolvedValue({ title: 'Test Page', render: '# Test Content', contentType: 'markdown' });
    handleInternalLinks.mockResolvedValue();
    Page.convertMarkdown2HTML.mockReturnValue('<h1>Test Content</h1>');
    let dom;
    JSDOM.mockImplementationOnce((html) => {
      dom = new (require('jsdom').JSDOM)(html);
      dom.serialize = jest.fn().mockReturnValue(expectedArgument);
      return dom;
    });
    prepareInternalImages.mockResolvedValue();
    convertToWord.mockResolvedValue(Buffer.from('DOCX content'));

    //WHEN
    const response = await request(app)
      .get('/export/docx/1')
      .query({ locale: 'en', path: '/some/path', sitePath: '/site/path' });

    // THEN
    expect(Page.convertMarkdown2HTML).toHaveBeenCalledTimes(1);
    expect(Page.convertMarkdown2HTML).toHaveBeenCalledWith({ title: 'Test Page', render: '# Test Content', contentType: 'markdown' });

    expect(handleInternalLinks).toHaveBeenCalledTimes(1);
    expect(handleInternalLinks).toHaveBeenCalledWith(expectedArgument, '/site/path', '/some/path');

    expect(prepareInternalImages).toHaveBeenCalledTimes(1);
    expect(prepareInternalImages).toHaveBeenCalledWith(dom.window.document, expect.any(Object));

    expect(convertToWord).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(response.headers['content-length']).toBe(String(expectedResponse.length));
    expect(response.headers['content-disposition']).toBe('attachment; filename="Test_Page.docx"');
  });
});
