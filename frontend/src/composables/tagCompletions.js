import { useI18n } from 'vue-i18n'
import * as monaco from 'monaco-editor'
import { Range } from 'monaco-editor'

import { isOutsideFences } from '@/helpers/markdownFences'

/** The HTML tags offered after `<`, each with the string describing it. */
const TAGS = [{ name: 'kbd', label: 'editor.markup.keyboardKey' }]

/**
 * The HTML tags worth writing in Markdown, for the Markdown editor: typing `<` offers them, and picking
 * one writes the opening and closing tags with the caret between them.
 *
 * The item replaces the `<` it was asked from, and the `>` Monaco auto-closes it with when that is
 * still right after the caret -- otherwise picking `kbd` would leave that `>` behind the closing tag.
 * Which is also why each is filtered on `<name>` rather than its label: Monaco filters on the text from
 * the start of the range to the caret, and that text starts with the `<`.
 *
 * Call it during `setup`. Then `register()` once the editor exists, and `dispose()` with the editor.
 *
 * @param {object} opts
 * @param {() => object} opts.getEditor The Monaco editor, once there is one.
 */
export function useTagCompletions({ getEditor }) {
  const { t } = useI18n()

  /**
   * Registered against the language rather than this editor, so it has to be disposed with the
   * component, or a second visit to the editor would offer everything twice.
   */
  let provider = null

  function register() {
    provider = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['<'],
      provideCompletionItems
    })
  }

  function dispose() {
    provider?.dispose()
    provider = null
  }

  /** The tags, after a `<` and whatever of a tag name has been typed since -- outside code blocks. */
  function provideCompletionItems(model, position) {
    const none = { suggestions: [] }
    if (model !== getEditor()?.getModel()) {
      return none
    }
    const line = model.getLineContent(position.lineNumber)
    const typed = line.slice(0, position.column - 1).match(/<[a-z]*$/i)
    if (!typed || !isOutsideFences(model.getLinesContent(), position.lineNumber - 1)) {
      return none
    }
    const endColumn = line[position.column - 1] === '>' ? position.column + 1 : position.column
    const range = new Range(
      position.lineNumber,
      position.column - typed[0].length,
      position.lineNumber,
      endColumn
    )
    return {
      suggestions: TAGS.map((tag) => ({
        label: { label: tag.name, description: t(tag.label) },
        kind: monaco.languages.CompletionItemKind.Property,
        detail: `<${tag.name}></${tag.name}>`,
        filterText: `<${tag.name}`,
        insertText: `<${tag.name}>$0</${tag.name}>`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range
      }))
    }
  }

  return { register, dispose }
}
