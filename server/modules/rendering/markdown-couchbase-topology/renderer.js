const topologyUi = require('@couchbaselabs/topology-ui')
const mdAttrUtils = require('markdown-it-attrs/utils')

const ATTR_OPTIONS = {
  leftDelimiter: '{',
  rightDelimiter: '}',
  allowedAttributes: ['id', 'class']
}

function applyAttributes(token, attrs) {
  for (const [key, value] of attrs) {
    if (key === 'class') {
      token.attrJoin('class', value)
    } else if (token.attrIndex(key) >= 0) {
      token.attrSet(key, value)
    } else {
      token.attrPush([key, value])
    }
  }
}

function getLineText(state, line) {
  const start = state.bMarks[line] + state.tShift[line]
  const end = state.eMarks[line]
  return state.src.slice(start, end)
}

function parseAttributeBlock(source) {
  const trimmed = source.trim()

  if (!trimmed || trimmed.charAt(0) !== ATTR_OPTIONS.leftDelimiter || !trimmed.endsWith(ATTR_OPTIONS.rightDelimiter)) {
    return null
  }

  const attrs = mdAttrUtils.getAttrs(trimmed, 0, ATTR_OPTIONS)
  return attrs.length > 0 ? attrs : null
}

function renderWrappedTopology(md, token) {
  return `<div${md.renderer.renderAttrs(token)}>${token.content}</div>`
}

module.exports = {
  init(mdinst, conf) {
    mdinst.use((md, opts) => {
      const openMarker = opts.openMarker || '```couchbase-topology'
      const openChar = openMarker.charCodeAt(0)
      const closeMarker = opts.closeMarker || '```'
      const closeChar = closeMarker.charCodeAt(0)
      const assetRoot = opts.assetRoot || '/_assets/topology-ui/images'
      const allowJavaScript = opts.allowJavaScript !== false

      md.block.ruler.before('fence', 'couchbase_topology', (state, startLine, endLine, silent) => {
        let nextLine
        let markup
        let token
        let i
        let autoClosed = false
        let closeLineAttrs = []
        let start = state.bMarks[startLine] + state.tShift[startLine]
        let max = state.eMarks[startLine]
        const openingLineAttrs = parseAttributeBlock(getLineText(state, startLine).slice(openMarker.length)) || []

        if (openChar !== state.src.charCodeAt(start)) { return false }

        for (i = 0; i < openMarker.length; ++i) {
          if (openMarker[i] !== state.src[start + i]) { return false }
        }

        markup = state.src.slice(start, start + i)

        if (silent) { return true }

        nextLine = startLine

        for (;;) {
          nextLine++
          if (nextLine >= endLine) {
            break
          }

          start = state.bMarks[nextLine] + state.tShift[nextLine]
          max = state.eMarks[nextLine]

          if (start < max && state.sCount[nextLine] < state.blkIndent) {
            break
          }

          if (closeChar !== state.src.charCodeAt(start)) {
            continue
          }

          if (state.sCount[nextLine] > state.sCount[startLine]) {
            continue
          }

          let closeMarkerMatched = true
          for (i = 0; i < closeMarker.length; ++i) {
            if (closeMarker[i] !== state.src[start + i]) {
              closeMarkerMatched = false
              break
            }
          }

          if (!closeMarkerMatched) {
            continue
          }

          const remainder = state.src.slice(start + i, max)
          const parsedCloseLineAttrs = parseAttributeBlock(remainder)

          if (remainder.trim().length > 0 && !parsedCloseLineAttrs) {
            continue
          }

          closeLineAttrs = parsedCloseLineAttrs || []
          autoClosed = true
          break
        }

        let standaloneLineAttrs = []
        let consumedStandaloneAttrs = false

        if (autoClosed && nextLine + 1 < endLine) {
          const parsedStandaloneAttrs = parseAttributeBlock(getLineText(state, nextLine + 1))
          if (parsedStandaloneAttrs) {
            standaloneLineAttrs = parsedStandaloneAttrs
            consumedStandaloneAttrs = true
          }
        }

        const source = state.src
          .split('\n')
          .slice(startLine + 1, nextLine)
          .join('\n')

        token = state.push('couchbase_topology', '', 0)
        token.block = true
        token.attrJoin('class', 'cb-topology-renderer-host')
        applyAttributes(token, [
          ...openingLineAttrs,
          ...closeLineAttrs,
          ...standaloneLineAttrs
        ])
        token.content = renderTopologyBlock(md, source, {
          allowJavaScript,
          assetRoot
        })
        token.map = [startLine, nextLine + (consumedStandaloneAttrs ? 1 : 0)]
        token.markup = markup

        state.line = nextLine + (autoClosed ? 1 : 0) + (consumedStandaloneAttrs ? 1 : 0)

        return true
      }, {
        alt: ['paragraph', 'reference', 'blockquote', 'list']
      })

      md.renderer.rules.couchbase_topology = (tokens, idx) => renderWrappedTopology(md, tokens[idx])
    }, {
      allowJavaScript: conf.allowJavaScript,
      assetRoot: conf.assetRoot,
      openMarker: conf.openMarker,
      closeMarker: conf.closeMarker
    })
  }
}

function renderTopologyBlock(md, source, options) {
  try {
    const data = topologyUi.parseTopologySource(source, {
      allowJavaScript: options.allowJavaScript
    })
    return topologyUi.renderTopology(data, {
      assetRoot: options.assetRoot
    })
  } catch (err) {
    return [
      '<div class="cb-topology-renderer cb-topology-renderer--error">',
      '<pre><code>',
      md.utils.escapeHtml(err.message),
      '</code></pre>',
      '</div>'
    ].join('')
  }
}
