const fetch = require('node-fetch');
const _ = require('lodash');
const assetHelper = require('../helpers/asset')
const mime = require('mime-types');
const pageHelper = require('../helpers/page')

const getSite = async (sitePath) => {
  return WIKI.models.sites.getSiteByPath({ path: sitePath, forceReload: false })
}
async function prepareInternalImages(document, req) {
  const images = document.querySelectorAll('img');
  const internalImages = Array.from(images).filter(img => !img.src.startsWith('data:image'));

  const processImage = async (img) => {
    const [_, assetPath] = img.src.split('/assets/');
    const sitePath = img.src.split('/')[1] || 'default';
    const site = await getSite(sitePath);

    if (!site) {
      WIKI.logger.warn(`Retrieval of the site of ${img.src} failed. Site ${sitePath} not found.`);
      return;
    }

    const pageArgs = { ...pageHelper.parsePath(assetPath, {}), siteId: site.id };
    const extension = assetHelper.getPathInfo(img.src).ext;

    if (!WIKI.auth.checkAccess(req.user, ['read:assets'], pageArgs) || !assetHelper.isSafeExtension(extension)) {
      return;
    }

    const base64Asset = await WIKI.models.assets.getAsset(site.path, pageArgs.path, null, true);

    if (base64Asset === false) {
      return;
    }

    const mimeType = mime.lookup(extension);
    img.src = `data:${mimeType};base64,${base64Asset}`;
  };

  await Promise.all(internalImages.map(img => processImage(img)));
}

async function convertToWord(pageHTML) {
  try {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16);

    const body = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="input.html"` +
      `Content-Type: text/html\r\n\r\n` +
      `${pageHTML}\r\n` +
      `--${boundary}--\r\n`;

    const response = await fetch('http://pandoc-service.default.svc.cluster.local/convert-to-docx',
      //'http://localhost:80/convert-to-docx',
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

module.exports = { prepareInternalImages, convertToWord };
