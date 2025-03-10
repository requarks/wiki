const { convertToWord } = require('../../helpers/conversion');

jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

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
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Network error');
    fetch.mockRejectedValue(error);

    await expect(convertToWord(pageHTML)).rejects.toThrow('Network error');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error converting document:', error);
    consoleErrorSpy.mockRestore();
  });
});
