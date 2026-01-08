// Test if potential opening or closing delimieter
// Assumes that there is a "$" at state.src[pos]
function isValidDelim (state, pos) {
  let prevChar
  let nextChar
  let max = state.posMax
  let canOpen = true
  let canClose = true

  prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1
  nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1

  // Check non-whitespace conditions for opening and closing, and
  // check that closing delimeter isn't followed by a number
  if (prevChar === 0x20/* " " */ || prevChar === 0x09/* \t */ ||
          (nextChar >= 0x30/* "0" */ && nextChar <= 0x39/* "9" */)) {
    canClose = false
  }
  if (nextChar === 0x20/* " " */ || nextChar === 0x09/* \t */) {
    canOpen = false
  }

  return {
    canOpen: canOpen,
    canClose: canClose
  }
}

export default {
  katexInline (state, silent) {
    if (state.src[state.pos] !== '$') return false;

    if (!isValidDelim(state, state.pos).canOpen) {
      return handleNoOpen(state, silent);
    }

    const start = state.pos + 1;
    const match = findClosingDelimiter(state.src, start);

    if (match === -1) {
      return handleNoMatch(state, silent, start);
    }

    if (match - start === 0) {
      return handleEmptyContent(state, silent, start);
    }

    if (!isValidDelim(state, match).canClose) {
      return handleNoClose(state, silent, start);
    }

    if (!silent) {
      const token = state.push('katex_inline', 'math', 0);
      token.markup = '$';
      token.content = escapeCurlyBraces(state.src.slice(start, match));
    }

    state.pos = match + 1;
    return true;
  },
  katexBlock (state, start, end, silent) {
    let pos = state.bMarks[start] + state.tShift[start];
    let max = state.eMarks[start];
    if (!isValidBlockStart(pos, max, state)) return false;

    pos += 2;
    let firstLine = state.src.slice(pos, max);
    if (silent) return true;

    let found = false;
    if (isSingleLineBlock(firstLine)) {
      firstLine = firstLine.trim().slice(0, -2);
      found = true;
    }

    let next = start, lastLine = '', lastPos;
    ({ next, lastLine, found } = findBlockEnd(state, start, end, found));

    state.line = next + 1;
    const token = state.push('katex_block', 'math', 0);
    token.block = true;
    token.content = (firstLine && firstLine.trim() ? firstLine + '\n' : '') +
      state.getLines(start + 1, next, state.tShift[start], true) +
      (lastLine && lastLine.trim() ? lastLine : '');
    token.map = [ start, state.line ];
    token.markup = '$$';
    return true;
  }
}

function handleNoOpen(state, silent) {
  if (!silent) state.pending += '$';
  state.pos += 1;
  return true;
}

function findClosingDelimiter(src, start) {
  let match = start;
  while ((match = src.indexOf('$', match)) !== -1) {
    let pos = match - 1;
    while (src[pos] === '\\') pos -= 1;
    if (((match - pos) % 2) === 1) break;
    match += 1;
  }
  return match;
}

function handleNoMatch(state, silent, start) {
  if (!silent) state.pending += '$';
  state.pos = start;
  return true;
}

function handleEmptyContent(state, silent, start) {
  if (!silent) state.pending += '$$';
  state.pos = start + 1;
  return true;
}

function handleNoClose(state, silent, start) {
  if (!silent) state.pending += '$';
  state.pos = start;
  return true;
}

function escapeCurlyBraces(str) {
  return str.replaceAll('{', '{{').replaceAll('}', '}}');
}
