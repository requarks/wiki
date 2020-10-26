const zlib = require('zlib')

// ------------------------------------
// Markdown - PlantUML Preprocessor
// ------------------------------------

module.exports = {
  init (mdinst, conf) {
    mdinst.use((md, opts) => {
      const openMarker = opts.openMarker || '```plantuml'
      const openChar = openMarker.charCodeAt(0)
      const closeMarker = opts.closeMarker || '```'
      const closeChar = closeMarker.charCodeAt(0)
      const imageFormat = opts.imageFormat || 'svg'
      const server = opts.server || 'https://plantuml.requarks.io'

      md.block.ruler.before('fence', 'uml_diagram', (state, startLine, endLine, silent) => {
        let nextLine
        let markup
        let params
        let token
        let i
        let autoClosed = false
        let start = state.bMarks[startLine] + state.tShift[startLine]
        let max = state.eMarks[startLine]

        // Check out the first character quickly,
        // this should filter out most of non-uml blocks
        //
        if (openChar !== state.src.charCodeAt(start)) { return false }

        // Check out the rest of the marker string
        //
        for (i = 0; i < openMarker.length; ++i) {
          if (openMarker[i] !== state.src[start + i]) { return false }
        }

        markup = state.src.slice(start, start + i)
        params = state.src.slice(start + i, max)

        // Since start is found, we can report success here in validation mode
        //
        if (silent) { return true }

        // Search for the end of the block
        //
        nextLine = startLine

        for (;;) {
          nextLine++
          if (nextLine >= endLine) {
            // unclosed block should be autoclosed by end of document.
            // also block seems to be autoclosed by end of parent
            break
          }

          start = state.bMarks[nextLine] + state.tShift[nextLine]
          max = state.eMarks[nextLine]

          if (start < max && state.sCount[nextLine] < state.blkIndent) {
            // non-empty line with negative indent should stop the list:
            // - ```
            //  test
            break
          }

          if (closeChar !== state.src.charCodeAt(start)) {
            // didn't find the closing fence
            continue
          }

          if (state.sCount[nextLine] > state.sCount[startLine]) {
            // closing fence should not be indented with respect of opening fence
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

          // make sure tail has spaces only
          if (state.skipSpaces(start + i) < max) {
            continue
          }

          // found!
          autoClosed = true
          break
        }

        const contents = state.src
          .split('\n')
          .slice(startLine + 1, nextLine)
          .join('\n')

        // We generate a token list for the alt property, to mimic what the image parser does.
        let altToken = []
        // Remove leading space if any.
        let alt = params ? params.slice(1) : 'uml diagram'
        state.md.inline.parse(
          alt,
          state.md,
          state.env,
          altToken
        )

        const zippedCode = encode64(zlib.deflateRawSync('@startuml\n' + contents + '\n@enduml').toString('binary'))

        token = state.push('uml_diagram', 'img', 0)
        // alt is constructed from children. No point in populating it here.
        token.attrs = [ [ 'src', `${server}/${imageFormat}/${zippedCode}` ], [ 'alt', '' ], ['class', 'uml-diagram prefetch-candidate'] ]
        token.block = true
        token.children = altToken
        token.info = params
        token.map = [ startLine, nextLine ]
        token.markup = markup

        state.line = nextLine + (autoClosed ? 1 : 0)

        return true
      }, {
        alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
      })
      md.renderer.rules.uml_diagram = md.renderer.rules.image
    }, {
      openMarker: conf.openMarker,
      closeMarker: conf.closeMarker,
      imageFormat: conf.imageFormat,
      server: conf.server
    })
  }
}

function encode64 (data) {
  let r = ''
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), 0)
    } else if (i + 1 === data.length) {
      r += append3bytes(data.charCodeAt(i), 0, 0)
    } else {
      r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), data.charCodeAt(i + 2))
    }
  }
  return r
}

function append3bytes (b1, b2, b3) {
  let c1 = b1 >> 2
  let c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
  let c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
  let c4 = b3 & 0x3F
  let r = ''
  r += encode6bit(c1 & 0x3F)
  r += encode6bit(c2 & 0x3F)
  r += encode6bit(c3 & 0x3F)
  r += encode6bit(c4 & 0x3F)
  return r
}

function encode6bit(raw) {
  let b = raw
  if (b < 10) {
    return String.fromCharCode(48 + b)
  }
  b -= 10
  if (b < 26) {
    return String.fromCharCode(65 + b)
  }
  b -= 26
  if (b < 26) {
    return String.fromCharCode(97 + b)
  }
  b -= 26
  if (b === 0) {
    return '-'
  }
  if (b === 1) {
    return '_'
  }
  return '?'
}
