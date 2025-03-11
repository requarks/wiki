const { prepareInternalImages, convertToWord } = require('../../helpers/conversion');
const { JSDOM } = require('jsdom');
const pageHelper = require('../../helpers/page');

jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

jest.mock('../../helpers/page', () => ({
  parsePath: jest.fn()
}));

const WIKI = {
  models: {
    sites: {
      getSiteByPath: jest.fn()
    },
    assets: {
      getAsset: jest.fn()
    }
  },
  auth: {
    checkAccess: jest.fn()
  },
  logger: {
    warn: jest.fn()
  }
};
global.WIKI = WIKI;


describe('prepareInternalImages', () => {
  let document;
  let req;

  beforeEach(() => {
    const html = `
      <html>
        <body>
          <img src="/assets/site1/image1.png" />
          <img src="data:image/png;base64,..." />
          <img src="/assets/site1/image2.jpg" />
        </body>
      </html>
    `;
    const dom = new JSDOM(html);
    document = dom.window.document;
    req = {
      user: {}
    };
  });

  it('should convert internal images to base64', async () => {
    WIKI.models.sites.getSiteByPath.mockResolvedValue({ id: 1, path: 'site1' });
    WIKI.auth.checkAccess.mockReturnValue(true);
    WIKI.models.assets.getAsset.mockResolvedValue('base64data');
    pageHelper.parsePath.mockReturnValue({ path: 'image1.png' });

    await prepareInternalImages(document, req);

    const images = document.querySelectorAll('img');
    expect(images[0].src).toBe('data:image/png;base64,base64data');
    expect(images[1].src).toBe('data:image/png;base64,...');
    expect(images[2].src).toBe('data:image/jpeg;base64,base64data');
  });

  it('should log a warning if site is not found', async () => {
    WIKI.models.sites.getSiteByPath.mockResolvedValue(null);

    await prepareInternalImages(document, req);

    expect(WIKI.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Retrieval of the site of'));
  });

  it('should skip images if access is denied', async () => {
    WIKI.models.sites.getSiteByPath.mockResolvedValue({ id: 1, path: 'site1' });
    WIKI.auth.checkAccess.mockReturnValue(false);
    pageHelper.parsePath.mockReturnValue({ path: 'image1.png' });

    await prepareInternalImages(document, req);

    const images = document.querySelectorAll('img');
    expect(images[0].src).toBe('/assets/site1/image1.png');
  });


  it('should skip images if asset is not found', async () => {
    WIKI.models.sites.getSiteByPath.mockResolvedValue({ id: 1, path: 'site1' });
    WIKI.auth.checkAccess.mockReturnValue(true);
    WIKI.models.assets.getAsset.mockResolvedValue(false);
    pageHelper.parsePath.mockReturnValue({ path: 'image1.png' });

    await prepareInternalImages(document, req);

    const images = document.querySelectorAll('img');
    expect(images[0].src).toBe('/assets/site1/image1.png');
  });
});
describe('convertToWord', () => {
  const pageHTML = '<html><body><h1>Test</h1></body></html>';
  const mockResponse = {
    ok: true,
    arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked buffer')),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should convert HTML to Word document successfully', async () => {
    fetch.mockResolvedValue(mockResponse);

    const result = await convertToWord(pageHTML);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'http://pandoc-service.default.svc.cluster.local/convert-to-docx',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': expect.stringContaining('multipart/form-data; boundary=----WebKitFormBoundary'),
        }),
        body: expect.any(Buffer),
      })
    );
    expect(result).toEqual(Buffer.from('mocked buffer'));
  });

  it('should throw an error if the response is not ok', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal Server Error'),
    });

    await expect(convertToWord(pageHTML)).rejects.toThrow('HTTP error! status: 500');

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should log and throw an error if fetch fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const error = new Error('Network error');
    fetch.mockRejectedValue(error);

    await expect(convertToWord(pageHTML)).rejects.toThrow('Network error');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error converting document:', error);
    consoleErrorSpy.mockRestore();
  });
});
