const zlib = require('zlib')

// ------------------------------------
// Markdown - Kroki Preprocessor
// ------------------------------------

module.exports = {
  init (mdinst, conf) {
    mdinst.use((md, opts) => {
      const openMarker = opts.openMarker || '```kroki'
      const openChar = openMarker.charCodeAt(0)
      const closeMarker = opts.closeMarker || '```'
      const closeChar = closeMarker.charCodeAt(0)
      const server = opts.server || 'https://kroki.io'

      md.block.ruler.before('fence', 'kroki', (state, startLine, endLine, silent) => {
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

        let contents = state.src
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

        let firstlf = contents.indexOf('\n')
        if (firstlf === -1) firstlf = undefined
        let diagramType = contents.substring(0, firstlf)
        contents = contents.substring(firstlf + 1)

        let result = zlib.deflateSync(contents).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')

        token = state.push('kroki', 'img', 0)
        // alt is constructed from children. No point in populating it here.
        token.attrs = [ [ 'src', `${server}/${diagramType}/svg/${result}` ], [ 'alt', '' ], ['class', 'uml-diagram prefetch-candidate'] ]
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
      md.renderer.rules.kroki = md.renderer.rules.image
    }, {
      openMarker: conf.openMarker,
      closeMarker: conf.closeMarker,
      server: conf.server
    })
  }
}
