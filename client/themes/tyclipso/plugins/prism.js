import Prism from 'prismjs'
import ClipboardJS from 'clipboard'

export default function initializePrism() {
  Prism.plugins.autoloader.languages_path = '/_assets/js/prism/'
  Prism.plugins.NormalizeWhitespace.setDefaults({
    'remove-trailing': true,
    'remove-indent': true,
    'left-trim': true,
    //'right-trim': true,
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

    const getExpandedStyle = () => {
      const contentWrapper = env.element.closest('.ty-content-wrapper')
      const content = env.element.closest('.page-col-content')
      const innerContent = env.element.closest('.contents')

      const contentMargin = contentWrapper.offsetWidth - content.offsetWidth
      const contentPadding = content.offsetWidth - innerContent.offsetWidth

      return {
        width: `${contentWrapper.offsetWidth - contentPadding}px`,
        marginLeft: `-${(contentMargin) / 2}px`,
      }
    }

    const updateInlineStyle = () => {
      codeBlock.style.width = `${codeBlock.closest('.contents').offsetWidth}px`
      codeBlock.style.marginLeft = '0px'

      if (expanded) {
        window.requestAnimationFrame(() => {
          const style = getExpandedStyle()
          codeBlock.style.marginLeft = style.marginLeft
          codeBlock.style.width = style.width
        })
      } else {
        setTimeout(() => {
          codeBlock.style.marginLeft = codeBlock.style.width = null
        }, 500)
      }
    }

    const expandButton = document.createElement('button')
    expandButton.innerHTML = expandIcon

    expandButton.addEventListener('click', () => {
      expanded = !expanded

      updateInlineStyle()

      // switch icon
      expandButton.innerHTML = expanded ? collapseIcon : expandIcon

      document.activeElement.blur()
    })

    window.addEventListener('resize', updateInlineStyle)

    return expandButton
  })
}
