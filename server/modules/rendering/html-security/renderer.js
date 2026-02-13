const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

function ensureColgroupForImageColumns(document) {
  const tables = document.querySelectorAll('table')

  const isImageOnlyCell = (cell) => {
    // Consider a cell "image-only" if it contains at least one <img> and no other meaningful content.
    // Ignore empty text nodes / whitespace and <br>.
    if (!cell.querySelector('img')) return false

    for (const node of Array.from(cell.childNodes)) {
      if (node.nodeType === 1) {
        // Element
        const tag = (node.tagName || '').toLowerCase()
        if (tag === 'img' || tag === 'br') continue

        // If it's a wrapper that only contains images/br/whitespace, allow it.
        // e.g., <p><img/></p> or <span><img/></span>
        if (node.querySelector && node.querySelector('img')) {
          const text = (node.textContent || '').replace(/\s+/g, '')
          // If it contains ANY element besides img/br, it's not image-only.
          // (querySelectorAll('*:not(img)') always includes the wrapper itself, so use an explicit scan.)
          const hasNonImgElement = Array.from(node.querySelectorAll('*')).some(el => {
            const t = (el.tagName || '').toLowerCase()
            return t !== 'img' && t !== 'br'
          })
          if (text.length === 0 && !hasNonImgElement) {
            continue
          }
        }
        return false
      }

      if (node.nodeType === 3) {
        // Text
        if ((node.textContent || '').trim().length > 0) return false
      }
    }

    return true
  }

  tables.forEach((table) => {
    // Determine which column indices contain at least one <img>.
    // We keep it conservative: only consider the first row group we can find.
    const rows = table.querySelectorAll('tr')
    if (!rows || rows.length === 0) return

    const imageColumns = new Set()
    // Track which columns are eligible for fixed width:
    // start optimistic when we see an image-only cell, but revoke if we ever see mixed content.
    const imageOnlyCandidates = new Set()
    const imageMixedColumns = new Set()
    let maxColumns = 0

    rows.forEach((row) => {
      let colIndex = 0
      const cells = row.querySelectorAll('th,td')
      cells.forEach((cell) => {
        const colspan = Math.max(parseInt(cell.getAttribute('colspan') || '1', 10) || 1, 1)
        const hasImg = !!cell.querySelector('img')
        const imgOnly = isImageOnlyCell(cell)
        if (hasImg) {
          for (let i = 0; i < colspan; i++) {
            const idx = colIndex + i
            imageColumns.add(idx)
            if (imgOnly) {
              imageOnlyCandidates.add(idx)
            } else {
              imageMixedColumns.add(idx)
            }
          }
        }
        colIndex += colspan
      })
      maxColumns = Math.max(maxColumns, colIndex)
    })

    if (imageColumns.size === 0 || maxColumns === 0) return

    // Find or create a colgroup. Keep existing colgroup if present.
    let colgroup = table.querySelector(':scope > colgroup')
    if (!colgroup) {
      colgroup = document.createElement('colgroup')
      // Insert it as the first child (HTML spec: colgroup before thead/tbody/tr).
      table.insertBefore(colgroup, table.firstChild)
    }

    // Ensure it has enough cols.
    const cols = Array.from(colgroup.querySelectorAll(':scope > col'))
    for (let i = cols.length; i < maxColumns; i++) {
      const col = document.createElement('col')
      colgroup.appendChild(col)
      cols.push(col)
    }

    // Apply sizing to columns.
    // - Always apply min-width to any column containing images (prevents collapse)
    // - Apply width only to *image-only* columns (keeps mixed-content columns flexible)
    const imageOnlyColumns = new Set(Array.from(imageOnlyCandidates).filter(idx => !imageMixedColumns.has(idx)))

    imageColumns.forEach((idx) => {
      const col = cols[idx]
      if (!col) return

      const existingStyle = (col.getAttribute('style') || '').trim()

      // Avoid duplicating declarations if already present.
      const hasMinWidth = /min-width\s*:\s*25px/i.test(existingStyle)
      const hasWidth = /(^|[;\s])width\s*:\s*25px/i.test(existingStyle)

      const additions = []
      if (imageOnlyColumns.has(idx) && !hasWidth) additions.push('width:25px;')
      if (!hasMinWidth) additions.push('min-width:25px;')
      const newStyle = additions.length ? [existingStyle, ...additions].filter(Boolean).join(' ') : existingStyle

      col.setAttribute('style', newStyle)
    })
  })
}

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      const window = new JSDOM('').window
      const DOMPurify = createDOMPurify(window)

      // Allowed attributes extended to preserve image resize information.
      // The CKEditor ImageResize plugin stores user-defined dimensions via inline styles (width) on <img>.
      const allowedAttrs = ['v-pre', 'v-slot:tabs', 'v-slot:content', 'target', 'style', 'width', 'height']
      const allowedTags = ['tabset', 'template']

      if (config.allowDrawIoUnsafe) {
        allowedTags.push('foreignObject')
        DOMPurify.addHook('uponSanitizeElement', (elm) => {
          if (elm.querySelectorAll) {
            const breaks = elm.querySelectorAll('foreignObject br, foreignObject p')
            if (breaks && breaks.length) {
              for (let i = 0; i < breaks.length; i++) {
                breaks[i].parentNode.replaceChild(
                  window.document.createElement('div'),
                  breaks[i]
                )
              }
            }
          }
        })
      }

      if (config.allowIFrames) {
        allowedTags.push('iframe')
        allowedAttrs.push('allow')
      }

      input = DOMPurify.sanitize(input, {
        ADD_ATTR: allowedAttrs,
        ADD_TAGS: allowedTags,
        HTML_INTEGRATION_POINTS: { foreignobject: true }
      })

      // Transform resized images to match rendering requirements
      const dom = new JSDOM(input)
      const document = dom.window.document

      // Find all figure.image_resized elements with width styles
      const resizedFigures = document.querySelectorAll('figure.image_resized[style*="width"]')

      resizedFigures.forEach(figure => {
        const figureStyle = figure.getAttribute('style') || ''
        const widthMatch = figureStyle.match(/width:\s*([0-9.]+)(%|px)/)

        if (widthMatch) {
          const widthValue = parseFloat(widthMatch[1])
          const widthUnit = widthMatch[2]

          // Convert percentage to pixels based on actual content container width
          // Content container is 9/12 columns (lg) or 10/12 columns (xl) when sidebar is visible
          // Vuetify lg: ~960px container → 9/12 = 720px content width
          // Vuetify xl: ~1185px container → 10/12 = 987px content width
          // Using 850px as a reasonable middle ground for percentage calculations
          const contentWidth = 850
          const pixelWidth = widthUnit === '%' ? Math.round((widthValue / 100) * contentWidth) : widthValue

          // Transform img element inside figure
          const img = figure.querySelector('img')
          if (img) {
            // Get original image width from width attribute
            const originalWidth = parseInt(img.getAttribute('width')) || 0

            // Determine if image is enlarged (exceeds original dimensions)
            const isEnlarged = originalWidth > 0 && pixelWidth > originalWidth

            // Replace image_resized with image_unbounded for enlarged images only
            if (isEnlarged) {
              figure.classList.remove('image_resized')
              figure.classList.add('image_unbounded')
            }
            // For shrunken images, keep image_resized class

            // Set figure and img styles with explicit pixel width and max-width:none
            figure.setAttribute('style', `width: ${pixelWidth}px; max-width:none;`)
            img.setAttribute('style', `width: ${pixelWidth}px; max-width:none; height:auto;`)

            // Set width attribute on img
            img.setAttribute('width', pixelWidth.toString())

            // Remove height attribute to avoid conflicts
            img.removeAttribute('height')
          }
        }
      })

      // Ensure table columns containing images don't collapse by adding/patching colgroups.
      ensureColgroupForImageColumns(document)

      input = dom.serialize()
    }
    input = input.replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, '')
    return input
  }
}
