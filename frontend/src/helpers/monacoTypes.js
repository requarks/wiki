// Adapted from https://github.com/trofimander/monaco-markdown/blob/master/src/ts/extHostTypes.ts
// by https://github.com/trofimander
// MIT Licensed

// export function values<V = any>(set: Set<V>): V[];
// export function values<K = any, V = any>(map: Map<K, V>): V[];
export function values (forEachable) {
  const result = []
  forEachable.forEach(value => result.push(value))
  return result
}

export class Position {
  static Min (...positions) {
    if (positions.length === 0) {
      throw new TypeError()
    }
    let result = positions[0]
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i]
      if (p.isBefore(result)) {
        result = p
      }
    }
    return result
  }

  static Max (...positions) {
    if (positions.length === 0) {
      throw new TypeError()
    }
    let result = positions[0]
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i]
      if (p.isAfter(result)) {
        result = p
      }
    }
    return result
  }

  static isPosition (other) {
    if (!other) {
      return false
    }
    if (other instanceof Position) {
      return true
    }
    const { line, character } = other
    if (typeof line === 'number' && typeof character === 'number') {
      return true
    }
    return false
  }

  get line () {
    return this._line
  }

  get character () {
    return this._character
  }

  constructor (line, character) {
    if (line < 0) {
      throw new Error('line must be non-negative')
    }
    if (character < 0) {
      throw new Error('character must be non-negative')
    }
    this._line = line
    this._character = character
  }

  isBefore (other) {
    if (this._line < other._line) {
      return true
    }
    if (other._line < this._line) {
      return false
    }
    return this._character < other._character
  }

  isBeforeOrEqual (other) {
    if (this._line < other._line) {
      return true
    }
    if (other._line < this._line) {
      return false
    }
    return this._character <= other._character
  }

  isAfter (other) {
    return !this.isBeforeOrEqual(other)
  }

  isAfterOrEqual (other) {
    return !this.isBefore(other)
  }

  isEqual (other) {
    return this._line === other._line && this._character === other._character
  }

  compareTo (other) {
    if (this._line < other._line) {
      return -1
    } else if (this._line > other.line) {
      return 1
    } else {
      // equal line
      if (this._character < other._character) {
        return -1
      } else if (this._character > other._character) {
        return 1
      } else {
        // equal line and character
        return 0
      }
    }
  }

  translate (lineDeltaOrChange, characterDelta = 0) {
    if (lineDeltaOrChange === null || characterDelta === null) {
      throw new Error()
    }

    let lineDelta
    if (typeof lineDeltaOrChange === 'undefined') {
      lineDelta = 0
    } else if (typeof lineDeltaOrChange === 'number') {
      lineDelta = lineDeltaOrChange
    } else {
      lineDelta = typeof lineDeltaOrChange.lineDelta === 'number' ? lineDeltaOrChange.lineDelta : 0
      characterDelta = typeof lineDeltaOrChange.characterDelta === 'number' ? lineDeltaOrChange.characterDelta : 0
    }

    if (lineDelta === 0 && characterDelta === 0) {
      return this
    }
    return new Position(this.line + lineDelta, this.character + characterDelta)
  }

  with (lineOrChange, character = this.character) {
    if (lineOrChange === null || character === null) {
      throw new Error()
    }

    let line
    if (typeof lineOrChange === 'undefined') {
      line = this.line
    } else if (typeof lineOrChange === 'number') {
      line = lineOrChange
    } else {
      line = typeof lineOrChange.line === 'number' ? lineOrChange.line : this.line
      character = typeof lineOrChange.character === 'number' ? lineOrChange.character : this.character
    }

    if (line === this.line && character === this.character) {
      return this
    }
    return new Position(line, character)
  }

  toJSON () {
    return { line: this.line, character: this.character }
  }
}

export class Range {
  static isRange (thing) {
    if (thing instanceof Range) {
      return true
    }
    if (!thing) {
      return false
    }
    return Position.isPosition(thing.start) && Position.isPosition(thing.end)
  }

  get start () {
    return this._start
  }

  get end () {
    return this._end
  }

  constructor (startLineOrStart, startColumnOrEnd, endLine, endColumn) {
    let start
    let end

    if (typeof startLineOrStart === 'number' && typeof startColumnOrEnd === 'number' && typeof endLine === 'number' && typeof endColumn === 'number') {
      start = new Position(startLineOrStart, startColumnOrEnd)
      end = new Position(endLine, endColumn)
    } else if (startLineOrStart instanceof Position && startColumnOrEnd instanceof Position) {
      start = startLineOrStart
      end = startColumnOrEnd
    }

    if (!start || !end) {
      throw new Error('Invalid arguments')
    }

    if (start.isBefore(end)) {
      this._start = start
      this._end = end
    } else {
      this._start = end
      this._end = start
    }
  }

  contains (positionOrRange) {
    if (positionOrRange instanceof Range) {
      return this.contains(positionOrRange._start) &&
      this.contains(positionOrRange._end)
    } else if (positionOrRange instanceof Position) {
      if (positionOrRange.isBefore(this._start)) {
        return false
      }
      if (this._end.isBefore(positionOrRange)) {
        return false
      }
      return true
    }
    return false
  }

  isEqual (other) {
    return this._start.isEqual(other._start) && this._end.isEqual(other._end)
  }

  intersection (other) {
    const start = Position.Max(other.start, this._start)
    const end = Position.Min(other.end, this._end)
    if (start.isAfter(end)) {
      // this happens when there is no overlap:
      // |-----|
      //          |----|
      return undefined
    }
    return new Range(start, end)
  }

  union (other) {
    if (this.contains(other)) {
      return this
    } else if (other.contains(this)) {
      return other
    }
    const start = Position.Min(other.start, this._start)
    const end = Position.Max(other.end, this.end)
    return new Range(start, end)
  }

  get isEmpty () {
    return this._start.isEqual(this._end)
  }

  get isSingleLine () {
    return this._start.line === this._end.line
  }

  with (startOrChange, end = this.end) {
    if (startOrChange === null || end === null) {
      throw new Error()
    }

    let start
    if (!startOrChange) {
      start = this.start
    } else if (Position.isPosition(startOrChange)) {
      start = startOrChange
    } else {
      start = startOrChange.start || this.start
      end = startOrChange.end || this.end
    }

    if (start.isEqual(this._start) && end.isEqual(this.end)) {
      return this
    }
    return new Range(start, end)
  }

  toJSON () {
    return [this.start, this.end]
  }
}

export class Selection extends Range {
  static isSelection (thing) {
    if (thing instanceof Selection) {
      return true
    }
    if (!thing) {
      return false
    }
    return Range.isRange(thing) &&
      Position.isPosition(thing.anchor) &&
      Position.isPosition(thing.active) &&
      typeof thing.isReversed === 'boolean'
  }

  get anchor () {
    return this._anchor
  }

  get active () {
    return this._active
  }

  constructor (anchorLineOrAnchor, anchorColumnOrActive, activeLine, activeColumn) {
    let anchor
    let active

    if (typeof anchorLineOrAnchor === 'number' && typeof anchorColumnOrActive === 'number' && typeof activeLine === 'number' && typeof activeColumn === 'number') {
      anchor = new Position(anchorLineOrAnchor, anchorColumnOrActive)
      active = new Position(activeLine, activeColumn)
    } else if (anchorLineOrAnchor instanceof Position && anchorColumnOrActive instanceof Position) {
      anchor = anchorLineOrAnchor
      active = anchorColumnOrActive
    }

    if (!anchor || !active) {
      throw new Error('Invalid arguments')
    }

    super(anchor, active)

    this._anchor = anchor
    this._active = active
  }

  get isReversed () {
    return this._anchor === this._end
  }

  toJSON () {
    return {
      start: this.start,
      end: this.end,
      active: this.active,
      anchor: this.anchor
    }
  }
}

export const EndOfLine = {
  LF: 1,
  CRLF: 2
}

export class TextEdit {
  static isTextEdit (thing) {
    if (thing instanceof TextEdit) {
      return true
    }
    if (!thing) {
      return false
    }
    return Range.isRange(thing) && typeof thing.newText === 'string'
  }

  static replace (range, newText) {
    return new TextEdit(range, newText)
  }

  static insert (position, newText) {
    return TextEdit.replace(new Range(position, position), newText)
  }

  static delete (range) {
    return TextEdit.replace(range, '')
  }

  static setEndOfLine (eol) {
    const ret = new TextEdit(new Range(new Position(0, 0), new Position(0, 0)), '')
    ret.newEol = eol
    return ret
  }

  get range () {
    return this._range
  }

  set range (value) {
    if (value && !Range.isRange(value)) {
      throw new Error('range')
    }
    this._range = value
  }

  get newText () {
    return this._newText || ''
  }

  set newText (value) {
    if (value && typeof value !== 'string') {
      throw new Error('newText')
    }
    this._newText = value
  }

  get newEol () {
    return this._newEol
  }

  set newEol (value) {
    if (value && typeof value !== 'number') {
      throw new Error('newEol')
    }
    this._newEol = value
  }

  constructor (range, newText) {
    this.range = range
    this._newText = newText
  }

  toJSON () {
    return {
      range: this.range,
      newText: this.newText,
      newEol: this._newEol
    }
  }
}

export class WorkspaceEdit {
  constructor () {
    this._edits = []
  }

  renameFile (from, to, options) {
    this._edits.push({ _type: 1, from, to, options })
  }

  createFile (uri, options) {
    this._edits.push({ _type: 1, from: undefined, to: uri, options })
  }

  deleteFile (uri, options) {
    this._edits.push({ _type: 1, from: uri, to: undefined, options })
  }

  replace (uri, range, newText) {
    this._edits.push({ _type: 2, uri, edit: new TextEdit(range, newText) })
  }

  insert (resource, position, newText) {
    this.replace(resource, new Range(position, position), newText)
  }

  delete (resource, range) {
    this.replace(resource, range, '')
  }

  has (uri) {
    for (const edit of this._edits) {
      if (edit._type === 2 && edit.uri.toString() === uri.toString()) {
        return true
      }
    }
    return false
  }

  set (uri, edits) {
    if (!edits) {
      // remove all text edits for `uri`
      for (let i = 0; i < this._edits.length; i++) {
        const element = this._edits[i]
        if (element._type === 2 && element.uri.toString() === uri.toString()) {
          this._edits[i] = undefined // will be coalesced down below
        }
      }
      // this._edits = coalesce(this._edits); TODO
    } else {
      // append edit to the end
      for (const edit of edits) {
        if (edit) {
          this._edits.push({ _type: 2, uri, edit })
        }
      }
    }
  }

  get (uri) {
    const res = []
    for (const candidate of this._edits) {
      if (candidate._type === 2 && candidate.uri.toString() === uri.toString()) {
        res.push(candidate.edit)
      }
    }
    return res
  }

  entries () {
    const textEdits = new Map()
    for (const candidate of this._edits) {
      if (candidate._type === 2) {
        let textEdit = textEdits.get(candidate.uri.toString())
        if (!textEdit) {
          textEdit = [candidate.uri, []]
          textEdits.set(candidate.uri.toString(), textEdit)
        }
        textEdit[1].push(candidate.edit)
      }
    }
    return values(textEdits)
  }

  _allEntries () {
    const res = []
    for (const edit of this._edits) {
      if (edit._type === 1) {
        res.push([edit.from, edit.to, edit.options])
      } else {
        res.push([edit.uri, [edit.edit]])
      }
    }
    return res
  }

  get size () {
    return this.entries().length
  }

  toJSON () {
    return this.entries()
  }
}

export const TextEditorRevealType = {
  Default: 0,
  InCenter: 1,
  InCenterIfOutsideViewport: 2,
  AtTop: 3
}

export const TextEditorSelectionChangeKind = {
  Keyboard: 1,
  Mouse: 2,
  Command: 3
}

export class SnippetString {
  static isSnippetString (thing) {
    if (thing instanceof SnippetString) {
      return true
    }
    if (!thing) {
      return false
    }
    return typeof thing.value === 'string'
  }

  static _escape (value) {
    return value.replace(/\$|}|\\/g, '\\$&')
  }

  constructor (value) {
    this._tabstop = 1
    this.value = value || ''
  }

  appendText (string) {
    this.value += SnippetString._escape(string)
    return this
  }

  appendTabstop (number = this._tabstop++) {
    this.value += '$'
    this.value += number
    return this
  }

  appendPlaceholder (value, number = this._tabstop++) {
    if (typeof value === 'function') {
      const nested = new SnippetString()
      nested._tabstop = this._tabstop
      value(nested)
      this._tabstop = nested._tabstop
      value = nested.value
    } else {
      value = SnippetString._escape(value)
    }

    this.value += '${'
    this.value += number
    this.value += ':'
    this.value += value
    this.value += '}'

    return this
  }

  appendVariable (name, defaultValue) {
    if (typeof defaultValue === 'function') {
      const nested = new SnippetString()
      nested._tabstop = this._tabstop
      defaultValue(nested)
      this._tabstop = nested._tabstop
      defaultValue = nested.value
    } else if (typeof defaultValue === 'string') {
      defaultValue = defaultValue.replace(/\$|}/g, '\\$&')
    }

    this.value += '${'
    this.value += name
    if (defaultValue) {
      this.value += ':'
      this.value += defaultValue
    }
    this.value += '}'

    return this
  }
}
