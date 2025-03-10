
async function convertToWord(pageHTML) {
  try {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16);

    const body = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="input.html"` +
      `Content-Type: text/html\r\n\r\n` +
      `${pageHTML}\r\n` +
      `--${boundary}--\r\n`;

    const response = await fetch(//'http://pandoc-service.default.svc.cluster.local/convert-to-docx',
      'http://localhost:80/convert-to-docx',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length':  Buffer.byteLength(body)
        },
        body: Buffer.from(body)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error converting document:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.arrayBuffer();

  } catch (error) {
      console.error('Error converting document:', error);
      throw error;
  }
}

module.exports = { convertToWord };
