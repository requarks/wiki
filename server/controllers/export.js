const express = require('express')
const router = express.Router()
const { JSDOM } = require('jsdom')
const {
  handleInternalLinks,
  prepareInternalImages,
  convertToWord
} = require('../helpers/export')

router.get('/export/docx/:pageId', async (req, res) => {
  try {
    if (!req.query.locale || !req.query.path || !req.query.sitePath) {
      const requiredParams = ['locale', 'path', 'sitePath']
      return res.status(400).send('Missing parameters: ' +
        requiredParams.filter(p => Object.keys(req.query).indexOf(p) < 0)
          .join(', ')
      )
    }
    const siteId = await WIKI.models.sites.getSiteIdByPath({path: req.query.sitePath})
    if (!WIKI.auth.checkAccess(req.user, ['read:pages'], { siteId, ...req.query})) {
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
      `;

    // HTML Aadaptions
    pageHTML = pageHTML.replaceAll('¶</a>', '</a>');
    pageHTML = handleInternalLinks(pageHTML, req.query.sitePath, req.query.path);

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

module.exports = router
