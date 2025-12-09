const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

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
        ADD_TAGS: allowedTags
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
      
      input = dom.serialize()
    }
    input = input.replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, '')
    return input
  }
}
