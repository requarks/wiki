import Prism from 'prismjs'
import ClipboardJS from 'clipboard'

export default function initializePrism() {
  Prism.plugins.autoloader.languages_path = '/_assets/js/prism/'
  Prism.plugins.NormalizeWhitespace.setDefaults({
    'remove-trailing': true,
    'remove-indent': true,
    'left-trim': true,
    'right-trim': true,
    'remove-initial-line-feed': true,
    'tabs-to-spaces': 2
  })
  copyButton()
  expandButton()
}

function copyButton() {
  Prism.plugins.toolbar.registerButton('copy', (env) => {
    let linkCopy = document.createElement('button')
    const copyIcon = '<i aria-hidden="true" class="v-icon notranslate mdi mdi-content-copy"></i>'
    const successIcon = '<i aria-hidden="true" class="v-icon notranslate mdi mdi-check-circle"></i>'
    linkCopy.innerHTML = copyIcon

    const clip = new ClipboardJS(linkCopy, {
      text: () => {
        document.activeElement.blur()
        return env.code
      }
    })

    clip.on('success', () => {
      linkCopy.innerHTML = successIcon
      resetClipboardText()
    })
    clip.on('error', () => {
      linkCopy.innerHTML = 'Press Ctrl+C to copy'
      resetClipboardText()
    })

    return linkCopy

    function resetClipboardText() {
      setTimeout(() => {
        linkCopy.innerHTML = copyIcon
      }, 5000)
    }
  })
}

function expandButton() {
  const expandIcon = '<i aria-hidden="true" class="v-icon notranslate mdi mdi-arrow-expand-horizontal"></i>'
  const collapseIcon = '<i aria-hidden="true" class="v-icon notranslate mdi mdi-arrow-collapse-horizontal"></i>'

  Prism.plugins.toolbar.registerButton('expand', env => {
    let expanded = false
    const codeBlock = env.element.closest('.code-toolbar')
    const container = env.element.closest('.page-col-content.ty-max-width')

    const codeBlockWidth = codeBlock.style.width = `${codeBlock.offsetWidth}px`;
    const applyInlineStyles = (marginLeft, width) => {
      codeBlock.style.marginLeft = expanded ? `${marginLeft}px` : '0px'
      codeBlock.style.width = expanded ? `${width}px` : codeBlockWidth
    }

    applyInlineStyles()
    const expandButton = document.createElement('button')

    expandButton.innerHTML = expandIcon

    expandButton.addEventListener('click', () => {
      const containerMargin = parseFloat(window.getComputedStyle(container).marginLeft)
      const containerPadding = parseFloat(window.getComputedStyle(container).paddingLeft)

      expanded = !expanded

      // switch icon
      expandButton.innerHTML = expanded ? collapseIcon : expandIcon

      // compute expanded size
      const expandedWidth = container.offsetWidth - containerPadding * 2 + containerMargin * 2;

      // apply inline styles to code block
      applyInlineStyles(-containerMargin, expandedWidth)

      document.activeElement.blur()
    })

    return expandButton
  })
}
