const fetch = require('node-fetch')
const { JSDOM } = require('jsdom')
const crypto = require('crypto')

const assetHelper = require('../helpers/asset')
const mime = require('mime-types')
const pageHelper = require('../helpers/page')
const Page = require('../models/pages')

/* global WIKI */

function handleInternalLinks(pageHTML, sitePath, locale, pagePaths) {
  if (
    typeof sitePath === 'string' &&
    sitePath.length > 0 &&
    pagePaths.length > 0
  ) {
    for (const pagePath of pagePaths) {
      const internalPath = `${sitePath}/${pagePath}`
      const internalPathWithLocale = `${sitePath}/${locale}/${pagePath}`

      pageHTML = pageHTML
      // when external links were used
        .replaceAll(`href="${WIKI.config.host}/${internalPath}#`, 'href="#')
        .replaceAll(`href="${WIKI.config.host}/${internalPathWithLocale}#`, 'href="#')
      // when page links were used
        .replaceAll(`href="/${internalPath}#`, 'href="#')
        .replaceAll(`href="/${internalPathWithLocale}#`, 'href="#')
      // link to a different page
        .replaceAll(`href="/${sitePath}`, `href="${WIKI.config.host}/${sitePath}`)
    }
  }
  return pageHTML
}

const getSite = async (sitePath) => {
  return WIKI.models.sites.getSiteByPath({ path: sitePath, forceReload: false })
}

async function getSiteIdByPath(sitePath) {
  return WIKI.models.sites.getSiteIdByPath({ path: sitePath })
}

async function prepareInternalImages(document, user) {
  const images = document.querySelectorAll('img')
  const internalImages = Array.from(images).filter(img => !img.src.startsWith('data:image') && !img.src.startsWith('/_assets/svg/twemoji'))

  const processImage = async (img) => {
    const assetPath = img.src.split('/assets/')[1]
    const sitePath = img.src.split('/')[1] || 'default'
    const site = await getSite(sitePath)

    if (!site) {
      WIKI.logger.warn(`Retrieval of the site of ${img.src} failed. Site ${sitePath} not found.`)
      return
    }

    const pageArgs = { ...pageHelper.parsePath(assetPath, {}), siteId: site.id }
    const extension = assetHelper.getPathInfo(img.src).ext

    if (!WIKI.auth.checkAccess(user, ['read:assets'], pageArgs) || !assetHelper.isSafeExtension(extension)) {
      return
    }

    const base64Asset = await WIKI.models.assets.getAsset(site.path, pageArgs.path, null, true)

    if (base64Asset === false) {
      return
    }

    const mimeType = mime.lookup(extension)
    img.src = `data:${mimeType};base64,${base64Asset}`
  }

  await Promise.all(internalImages.map(img => processImage(img)))
}

async function convertToWord(pageHTML) {
  try {
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex')

    const body = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="input.html"` +
      `Content-Type: text/html\r\n\r\n` +
      `${pageHTML}\r\n` +
      `--${boundary}--\r\n`

    const response = await fetch(`${WIKI.config.pandocPath}/convert-to-docx`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(body)
        },
        body: Buffer.from(body),
        timeout: 30_000
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Error converting document:', errorText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.arrayBuffer()
  } catch (error) {
    console.error('Error converting document:', error)
    throw error
  }
}

function getPageContent(page) {
  let pageContent = ''
  if (page.contentType === 'html') {
    pageContent = page.render
  } else if (page.contentType === 'markdown') {
    pageContent = Page.convertMarkdown2HTML(page)
  } else {
    throw new Error('Unsupported content type: ' + page.contentType)
  }
  return pageContent
}

function getPageTreeExportHtml(pageTree, user, queryParams) {
  const mainPageContent = getPageContent(pageTree[0])
  let pageHTML = `
    <html>
      <head>
        <title>${pageTree[0].title}</title>
      </head>
      <body>
        <article>
          <div>
            ${mainPageContent}
          </div>
        </article>`
  pageTree.shift() // Removing the main page
  for (const page of pageTree) {
    if (WIKI.auth.checkAccess(user, ['read:pages'], {siteId: page.siteId, page: page, ...queryParams})) {
      const pageContent = getPageContent(page)
      pageHTML += `
        <article>
          <h1>${page.title}</h1>
          <div>
            ${pageContent}
          </div>
        </article>`
    }
  }
  pageHTML += `
      </body>
    </html>`

  return pageHTML
}

function getPageExportHtml(page) {
  const pageContent = getPageContent(page)
  return `
    <html>
      <head>
        <title>${page.title}</title>
      </head>
      <body>
        ${pageContent}
      </body>
    </html>`
}

async function getExportHtmlContent(page, user, queryParams) {
  let pageTree = null
  let pageHTML = ''
  if (queryParams.isPageTreeExport) {
    pageTree = await WIKI.models.pages.getPageTreeFrom(page.id)
    pageHTML = getPageTreeExportHtml(pageTree, user, queryParams)
  } else {
    pageHTML = getPageExportHtml(page)
  }

  let pagePaths = [page.path]
  if (pageTree) {
    pagePaths = pagePaths.concat(pageTree.map(p => p.path))
  }

  // HTML Adaptions
  pageHTML = pageHTML.replaceAll('¶</a>', '</a>')
  pageHTML = handleInternalLinks(pageHTML, queryParams.sitePath, queryParams.locale, pagePaths)

  const dom = new JSDOM(pageHTML)
  const document = dom.window.document

  await prepareInternalImages(document, user)
  pageHTML = dom.serialize()

  return pageHTML
}

module.exports = {
  handleInternalLinks,
  getSiteIdByPath,
  prepareInternalImages,
  convertToWord,
  getPageContent,
  getPageTreeExportHtml,
  getPageExportHtml,
  getExportHtmlContent
}
