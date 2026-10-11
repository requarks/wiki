import { useI18n } from 'vue-i18n'
import * as monaco from 'monaco-editor'
import { Range } from 'monaco-editor'

/**
 * Completion of a block's name and of its parameters, for a source editor built on Monaco -- the
 * Markdown and the AsciiDoc editor both offer it.
 *
 * Everything here is the same for both: which blocks and props are offered, how they are described,
 * in what order, and what picking one writes. What differs is only how a block is spelled, so each
 * editor hands in its own three functions for that:
 *
 *   - `nameContext(text, line, column)`: whether the caret is in a block's NAME, as
 *     `{ prefix, startColumn, endColumn, bare }` or null. `prefix` is what the line holds before the
 *     name (`::block-`, `[block-`), `startColumn`/`endColumn` span the name to replace, and `bare` says
 *     the line holds nothing else yet -- in which case `endColumn` is the end of the line, since the
 *     whole line is replaced by a whole block.
 *   - `attributeContext(text, line, column)`: whether the caret is in a block's attribute list, as
 *     `{ block, written, kind: 'name', startColumn, insertPrefix? }`,
 *     `{ block, written, kind: 'value', name, quoted, startColumn }` or null. `written` is the props
 *     already given, and `insertPrefix` anything a name has to be preceded by where it is typed.
 *   - `blockSnippet(definition, nameContext)`: a whole new block, as a Monaco snippet.
 *
 * Answered from the definitions the editor already reads for its "Edit Block Parameters" lens, so a
 * block the site does not list gets nothing.
 *
 * Call it during `setup`. Then `register()` once the editor exists, and `dispose()` with the editor.
 *
 * @param {object} opts
 * @param {() => object} opts.getEditor The Monaco editor, once there is one.
 * @param {() => Array<object>} opts.getBlocks The blocks this site has, as the API describes them.
 * @param {string} opts.languageId What the provider is registered against.
 * @param {string[]} opts.triggerCharacters The characters that open the list without Ctrl+Space.
 * @param {(text: string, line: number, column: number) => object|null} opts.nameContext
 * @param {(text: string, line: number, column: number) => object|null} opts.attributeContext
 * @param {(definition: object, context: object) => string} opts.blockSnippet
 */
export function useBlockCompletions({
  getEditor,
  getBlocks,
  languageId,
  triggerCharacters,
  nameContext,
  attributeContext,
  blockSnippet
}) {
  const { t } = useI18n()

  /**
   * The provider, which is registered against the language rather than this editor -- so it has to be
   * disposed with the component, or a second visit to the editor would offer everything twice.
   */
  let provider = null

  function register() {
    provider = monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters,
      provideCompletionItems
    })
  }

  function dispose() {
    provider?.dispose()
    provider = null
  }

  /**
   * The block's name first, then its attribute list. Any other model of the same language on the page
   * gets nothing: the provider is per-language, and only this editor's model is the page.
   */
  function provideCompletionItems(model, position) {
    const none = { suggestions: [] }
    if (model !== getEditor()?.getModel()) {
      return none
    }
    const text = model.getValue()
    const name = nameContext(text, position.lineNumber, position.column)
    if (name) {
      return { suggestions: nameSuggestions(name, position) }
    }
    const context = attributeContext(text, position.lineNumber, position.column)
    const definition = context && getBlocks().find((block) => block.block === context.block)
    if (!definition?.props?.length) {
      return none
    }
    const range = new Range(
      position.lineNumber,
      context.startColumn,
      position.lineNumber,
      position.column
    )
    return {
      suggestions:
        context.kind === 'value'
          ? valueSuggestions(definition, context, range)
          : propSuggestions(definition, context, range)
    }
  }

  /**
   * The blocks the name could be: the ones this site has switched on.
   *
   * On a line holding nothing past the name, picking one writes the whole block as the picker would —
   * its starter body and closing delimiter, a tab stop in each required prop, and the caret left in the
   * attribute list for the parameter suggestions to take over. Anywhere else the block is already there
   * and only its name is replaced.
   *
   * A child block is left out, as the picker leaves it out: `block-tab` outside a tabset draws nothing,
   * and nothing about its definition says which block it belongs inside.
   */
  function nameSuggestions(context, position) {
    const range = new Range(
      position.lineNumber,
      context.bare ? 1 : context.startColumn,
      position.lineNumber,
      context.endColumn
    )
    return getBlocks()
      .filter((definition) => definition.isEnabled && !definition.isChild)
      .map((definition) => {
        const firstRequired = (definition.props ?? []).find((prop) => prop.required)
        return {
          label: { label: definition.block, description: definition.name },
          kind: monaco.languages.CompletionItemKind.Module,
          detail: definition.name,
          documentation: definition.description,
          ...(context.bare
            ? {
                // -> The range starts at the line, so what is typed is matched against the line
                filterText: `${context.prefix}${definition.block}`,
                insertText: blockSnippet(definition, context),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                command: firstRequired && opensValueList(firstRequired)
              }
            : { insertText: definition.block }),
          range
        }
      })
  }

  /**
   * The props the list does not give yet. Required ones first, then in the order the block declares
   * them. Inserted with the quotes and the caret between them, and where there is a list to pick the
   * value from, that list opens straight away.
   */
  function propSuggestions(definition, context, range) {
    return definition.props
      .map((prop, index) => ({ prop, index }))
      .filter(({ prop }) => !context.written.has(prop.name))
      .map(({ prop, index }) => ({
        label: { label: prop.name, description: prop.label },
        kind: monaco.languages.CompletionItemKind.Property,
        detail: prop.label,
        documentation: [
          prop.hint,
          prop.required ? t('editor.markup.blockPropRequired') : null,
          (prop.default ?? '') !== ''
            ? t('editor.markup.blockPropDefault', { value: String(prop.default) })
            : null
        ]
          .filter(Boolean)
          .join('\n\n'),
        filterText: prop.name,
        insertText: `${context.insertPrefix ?? ''}${prop.name}="$1"`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: `${prop.required ? 0 : 1}${String(index).padStart(4, '0')}`,
        command: opensValueList(prop),
        range
      }))
  }

  /** A select's options or a boolean's two words, inside the value of the prop the caret is in. */
  function valueSuggestions(definition, context, range) {
    const prop = definition.props.find((entry) => entry.name === context.name)
    return (prop ? propChoices(prop) : []).map((choice, index) => ({
      label: {
        label: choice.value,
        description: choice.label !== choice.value ? choice.label : undefined
      },
      kind: monaco.languages.CompletionItemKind.EnumMember,
      insertText: context.quoted ? choice.value : `"${choice.value}"`,
      sortText: String(index).padStart(4, '0'),
      range
    }))
  }

  return { register, dispose }
}

/**
 * What a prop's value can be completed with: a select's options, or a boolean's two words. Anything
 * else is free text, with nothing to offer.
 *
 * A select option whose value is empty is left out. It means "write no attribute" — Normal on a tab —
 * and completing to `header=""` is not a way of saying that.
 */
function propChoices(prop) {
  if (prop.type === 'boolean') {
    return [
      { label: 'true', value: 'true' },
      { label: 'false', value: 'false' }
    ]
  }
  if (prop.type !== 'select') {
    return []
  }
  return (prop.options ?? [])
    .map((option) =>
      typeof option === 'object'
        ? { label: String(option.label ?? option.value), value: String(option.value) }
        : { label: String(option), value: String(option) }
    )
    .filter((option) => option.value !== '')
}

/** The command that opens the list again once a prop is written, for one whose value has a list. */
function opensValueList(prop) {
  return propChoices(prop).length > 0
    ? { id: 'editor.action.triggerSuggest', title: '' }
    : undefined
}
