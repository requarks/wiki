'use strict'

module.exports = {
  /**
   * Set Input Selection
   * @param {DOMElement} input The input element
   * @param {number} startPos The starting position
   * @param {nunber} endPos The ending position
   */
  setInputSelection: (input, startPos, endPos) => {
    input.focus()
    if (typeof input.selectionStart !== 'undefined') {
      input.selectionStart = startPos
      input.selectionEnd = endPos
    } else if (document.selection && document.selection.createRange) {
      // IE branch
      input.select()
      var range = document.selection.createRange()
      range.collapse(true)
      range.moveEnd('character', endPos)
      range.moveStart('character', startPos)
      range.select()
    }
  }
}
