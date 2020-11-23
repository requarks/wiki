// Header matching code by CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

import CodeMirror from 'codemirror'

const maxDepth = 100
const codeBlockStartMatch = /^`{3}[a-zA-Z0-9]+$/
const codeBlockEndMatch = /^`{3}$/

CodeMirror.registerHelper('fold', 'markdown', function (cm, start) {
  const firstLine = cm.getLine(start.line)
  const lastLineNo = cm.lastLine()
  let end

  function isHeader(lineNo) {
    const tokentype = cm.getTokenTypeAt(CodeMirror.Pos(lineNo, 0))
    return tokentype && /\bheader\b/.test(tokentype)
  }

  function headerLevel(lineNo, line, nextLine) {
    let match = line && line.match(/^#+/)
    if (match && isHeader(lineNo)) return match[0].length
    match = nextLine && nextLine.match(/^[=-]+\s*$/)
    if (match && isHeader(lineNo + 1)) return nextLine[0] === '=' ? 1 : 2
    return maxDepth
  }

  // -> CODE BLOCK

  if (codeBlockStartMatch.test(cm.getLine(start.line))) {
    end = start.line
    let nextNextLine = cm.getLine(end + 1)
    while (end < lastLineNo) {
      if (codeBlockEndMatch.test(nextNextLine)) {
        end++
        break
      }
      end++
      nextNextLine = cm.getLine(end + 1)
    }
  } else {
    // -> HEADER

    let nextLine = cm.getLine(start.line + 1)
    const level = headerLevel(start.line, firstLine, nextLine)
    if (level === maxDepth) return undefined

    end = start.line
    let nextNextLine = cm.getLine(end + 2)
    while (end < lastLineNo) {
      if (headerLevel(end + 1, nextLine, nextNextLine) <= level) break
      ++end
      nextLine = nextNextLine
      nextNextLine = cm.getLine(end + 2)
    }
  }

  return {
    from: CodeMirror.Pos(start.line, firstLine.length),
    to: CodeMirror.Pos(end, cm.getLine(end).length)
  }
})
