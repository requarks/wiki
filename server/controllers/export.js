const express = require('express')
const router = express.Router()
const { JSDOM } = require('jsdom')
const pageHelper = require('../helpers/page')
const _ = require('lodash');
const assetHelper = require('../helpers/asset')
const mime = require('mime-types');

const getSite = async (sitePath) => {
  return WIKI.models.sites.getSiteByPath({ path: sitePath, forceReload: false })
}

const prepareInternalImages = async (document, req) => {
  const images = document.querySelectorAll('img');
  const internalImages = Array.from(images).filter(img => !img.src.startsWith('data:image'));
  for (const img of internalImages) {
    const pageArgs = pageHelper.parsePath(img.src.split('/assets/')[1], {});
    const sitePath = img.src.split('/')[1] || 'default';
    const site = await getSite(sitePath);
    if (!site) {
      WIKI.logger.warn(`Retrieval of the site of ${img.src} failed. Site ${sitePath} not found.`);
      continue
    }
    pageArgs.siteId = site.id;
    const extension = assetHelper.getPathInfo(img.src).ext;

    if (!WIKI.auth.checkAccess(req.user, ['read:assets'], pageArgs) || !assetHelper.isSafeExtension(extension)) {
      continue
    }
    const base64Asset = await WIKI.models.assets.getAsset(site.path, pageArgs.path, null, true);

    if (base64Asset === false) {
      continue
    }
    const mimeType = mime.lookup(extension);
    img.src = `data:${mimeType};base64,${base64Asset}`;
  }
};

router.get('/export/docx/:pageId', async (req, res) => {
  try {
    if (!req.query.locale || !req.query.path || !req.query.sitePath) {
      const requiredParams = ['locale', 'path', 'sitePath']
      return res.status(400).send('Missing parameters: ' +
        requiredParams.filter(p => Object.keys(req.query).indexOf(p) < 0)
          .join(', ')
      )
    }
    if (!WIKI.auth.checkAccess(req.user, ['read:page'], req.query)) {
      return res.status(403).send('Access denied')
    }

    const { pageId } = req.params;
    const page = await WIKI.models.pages.getPage(Number(pageId))

    if (!page) {
      return res.status(404).send('Page not found')
    }

    let pageHTML = `
        <html>
          <head>
            <title>${page.title}</title>
          </head>
          <body>
            ${page.render}
          </body>
        </html>
      `
    // HTML adaptions
    pageHTML = pageHTML.replaceAll('¶</a>', '</a>')
    const dom = new JSDOM(pageHTML);
    const document = dom.window.document;

    await prepareInternalImages(document, req);
    pageHTML = dom.serialize();

    const response = await convertToWord(pageHTML)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Length', Buffer.byteLength(response))
    res.setHeader('Content-Disposition', `attachment; filename="${page.title.replaceAll(" ", "_")}.docx"`)
    res.send(Buffer.from(response))
  } catch (error) {
    console.error('Error exporting to DOCX:', error)
    res.status(500).send('Error exporting to DOCX')
  }
})



async function convertToWord(pageHTML) {
  try {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16);

    const body = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="input.html"` +
      `Content-Type: text/html\r\n\r\n` +
      `${pageHTML}\r\n` +
      `--${boundary}--\r\n`;

    const response = await fetch('http://localhost:80/convert-to-docx',
      //'http://localhost:80/convert-to-docx',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(body)
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

module.exports = router
