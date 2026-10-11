import { useI18n } from 'vue-i18n'
import * as monaco from 'monaco-editor'
import { Range, Selection } from 'monaco-editor'

import { ALL_LANGUAGES, COMMON_LANGUAGES } from '@/helpers/codeLanguages'
import {
  FENCE_ATTRIBUTES,
  fenceAttributeContext,
  fenceJustOpened,
  fenceLanguageContext
} from '@/helpers/markdownFences'

/** The label and the hint of each attribute, by name. */
const STRINGS = {
  title: ['editor.codeBlock.attributes.title', 'editor.codeBlock.attributes.titleHint'],
  linesStart: [
    'editor.codeBlock.attributes.linesStart',
    'editor.codeBlock.attributes.linesStartHint'
  ],
  linesHighlight: [
    'editor.codeBlock.attributes.linesHighlight',
    'editor.codeBlock.attributes.linesHighlightHint'
  ]
}

/**
 * Help with writing a fenced code block, for the Markdown editor:
 *
 *   - Typing the third backtick of an opening fence puts the closing one on the line below, leaves the
 *     caret where it was and opens the list of languages. Escape puts the list away for a block with
 *     no language.
 *   - The language is completed from the list the toolbar's code block menu offers.
 *   - After the language, a space offers the optional attributes -- `title`, `linesStart` and
 *     `linesHighlight` -- that the fence rule in `renderers/markdown.js` reads.
 *
 * Call it during `setup`. Then `register()` once the editor exists, and `dispose()` with the editor.
 *
 * @param {object} opts
 * @param {() => object} opts.getEditor The Monaco editor, once there is one.
 */
export function useFenceCompletions({ getEditor }) {
  const { t } = useI18n()

  /**
   * The provider, which is registered against the language rather than this editor -- so it has to be
   * disposed with the component, or a second visit to the editor would offer everything twice. And the
   * editor's own content listener, which goes with it.
   */
  let provider = null
  let listener = null

  function register() {
    provider = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: [' '],
      provideCompletionItems
    })
    listener = getEditor().onDidChangeModelContent(onContentChange)
  }

  function dispose() {
    provider?.dispose()
    provider = null
    listener?.dispose()
    listener = null
  }

  /**
   * A backtick typed here, by this author: the one change, at this editor's caret.
   *
   * Monaco has no event for a character being typed, so this is read off the content change, which
   * also carries an undo, a paste, a reload and -- in a collaborative session -- every other author's
   * keystrokes. Undo, redo and reload say so on the event; somebody else's backtick is told apart by
   * where the caret is, which is checked once the change has settled, since the caret moves after the
   * content does. Deferred for that reason, and because editing from inside a content listener would
   * be an edit landing in the middle of another.
   */
  function onContentChange(event) {
    if (event.isUndoing || event.isRedoing || event.isFlush || event.changes.length !== 1) {
      return
    }
    const [change] = event.changes
    if (change.text !== '`') {
      return
    }
    const line = change.range.startLineNumber
    const column = change.range.startColumn + 1
    setTimeout(() => closeFence(line, column), 0)
  }

  /**
   * The closing fence and the language list, for a line that has just become an opening fence.
   *
   * The closing fence is added only where nothing already closes this one -- see `fenceJustOpened` --
   * and as an undo step of its own, so Ctrl+Z takes it back and leaves the backticks the author typed.
   * The list opens either way: retyping a block's opening fence is as good a time to pick its language
   * as writing a new one.
   */
  function closeFence(line, column) {
    const editor = getEditor()
    const model = editor?.getModel()
    const selections = editor?.getSelections() ?? []
    if (!model || !editor.hasTextFocus() || selections.length !== 1) {
      return
    }
    const [selection] = selections
    if (
      !selection.isEmpty() ||
      selection.positionLineNumber !== line ||
      selection.positionColumn !== column
    ) {
      return
    }
    const opened = fenceJustOpened(model.getValue(), line)
    if (!opened) {
      return
    }
    if (opened.unclosed) {
      editor.pushUndoStop()
      editor.executeEdits(
        'fence',
        [{ range: new Range(line, column, line, column), text: `\n${opened.indent}\`\`\`` }],
        [new Selection(line, column, line, column)]
      )
      editor.pushUndoStop()
    }
    editor.trigger('fence', 'editor.action.triggerSuggest', {})
  }

  /** The fence's language while it is being typed, and its attributes once it has been. */
  function provideCompletionItems(model, position) {
    const none = { suggestions: [] }
    if (model !== getEditor()?.getModel()) {
      return none
    }
    const text = model.getValue()
    const language = fenceLanguageContext(text, position.lineNumber, position.column)
    if (language) {
      return {
        suggestions: languageSuggestions(
          new Range(
            position.lineNumber,
            language.startColumn,
            position.lineNumber,
            language.endColumn
          )
        )
      }
    }
    const context = fenceAttributeContext(text, position.lineNumber, position.column)
    if (!context) {
      return none
    }
    return {
      suggestions: attributeSuggestions(
        context,
        new Range(position.lineNumber, context.startColumn, position.lineNumber, position.column)
      )
    }
  }

  /**
   * Every language, with the toolbar menu's shortlist at the top -- less Plain Text, which is no
   * language at all and is what Escape leaves. Matched on the aliases as well as the id, so `zsh` finds
   * Bash; what is written is the id.
   */
  function languageSuggestions(range) {
    const entry = (language, group, index) => ({
      label: { label: language.id, description: language.label },
      kind: monaco.languages.CompletionItemKind.Value,
      filterText: [language.id, ...(language.aliases ?? [])].join(' '),
      insertText: language.id,
      sortText: `${group}${String(index).padStart(4, '0')}`,
      range
    })
    return [
      ...COMMON_LANGUAGES.filter((language) => language.id).map((language, index) =>
        entry(language, 0, index)
      ),
      ...ALL_LANGUAGES.map((language, index) => entry(language, 1, index))
    ]
  }

  /**
   * The attributes the fence does not give yet, in the order the syntax documents them, each inserted
   * with its quotes and the caret between them. Compared in lower case, as the renderer reads them.
   */
  function attributeSuggestions(context, range) {
    return FENCE_ATTRIBUTES.filter((name) => !context.written.has(name.toLowerCase())).map(
      (name, index) => ({
        label: { label: name, description: t(STRINGS[name][0]) },
        kind: monaco.languages.CompletionItemKind.Property,
        detail: t(STRINGS[name][0]),
        documentation: t(STRINGS[name][1]),
        insertText: `${name}="$1"`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: String(index).padStart(4, '0'),
        range
      })
    )
  }

  return { register, dispose }
}
