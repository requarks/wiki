const express = require('express')
const router = express.Router()
const {
  convertToFile,
  getSiteIdByPath,
  getExportHtmlContent
} = require('../helpers/export')

/* global WIKI */

router.get('/export/docx/:pageId', async (req, res) => {
  try {
    const exportData = await prepareExport(req, res)
    if (!exportData) return // Stop execution if validation fails

    const { page, pageHTML } = exportData
    const response = await convertToFile(pageHTML, 'docx')

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Length', Buffer.byteLength(response))
    res.setHeader('Content-Disposition', `attachment; filename="${page.title.replaceAll(' ', '_')}.docx"`)
    res.send(Buffer.from(response))
  } catch (error) {
    console.error('Error exporting to DOCX:', error)
    res.status(500).send('Error exporting to DOCX')
  }
})

router.get('/export/pdf/:pageId', async (req, res) => {
  try {
    const exportData = await prepareExport(req, res)
    if (!exportData) return // Stop execution if validation fails

    const { page, pageHTML } = exportData
    const response = await convertToFile(pageHTML, 'pdf')

    res.setHeader('Content-Type', 'application/pdf') // Set Content-Type for PDF
    res.setHeader('Content-Length', Buffer.byteLength(response))
    res.setHeader('Content-Disposition', `attachment; filename="${page.title.replaceAll(' ', '_')}.pdf"`)
    res.send(Buffer.from(response))
  } catch (error) {
    console.error('Error exporting to PDF:', error)
    res.status(500).send('Error exporting to PDF')
  }
})

async function prepareExport(req, res) {
  const requiredParams = ['locale', 'path', 'sitePath']
  const missingParams = requiredParams.filter(p => !req.query[p])
  if (missingParams.length > 0) {
    res.status(400).send('Missing parameters: ' + missingParams.join(', '))
    return null
  }

  const siteId = await getSiteIdByPath(req.query.sitePath)
  if (!WIKI.auth.checkAccess(req.user, ['read:pages'], { siteId: siteId, ...req.query })) {
    res.status(403).send('Access denied')
    return null
  }

  const { pageId } = req.params
  const page = await WIKI.models.pages.getPage(Number(pageId))
  if (!page) {
    res.status(404).send('Page not found')
    return null
  }

  const pageHTML = await getExportHtmlContent(page, req.user, req.query)
  return { page, pageHTML }
}

module.exports = router
