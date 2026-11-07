import * as monaco from 'monaco-editor'

import { isCanvasBlock } from '@/helpers/blocks'

/**
 * Folding over the blocks in a page's source, for a source editor built on Monaco -- the Markdown and
 * the AsciiDoc editor both use it.
 *
 * Every block with a body can be folded from the gutter, down to its opening and closing lines. A
 * block whose body is a drawing (`isCanvasBlock`) also starts folded when the editor opens: nobody
 * reads that body as text, it can run to hundreds of lines, and "Edit Content" above it is the way to
 * change it.
 *
 * Each editor hands in how a block is spelled and how it looks one up:
 *
 *   - `findBlockRegions(text)`: every block with a body, 1-based `start` and `end` as Monaco wants a
 *     folding range, and the `block` name.
 *   - `blockDefinition(name)`: the block as the API describes it, or nothing for one the site lacks.
 *
 * Call `register()` once the editor exists, `foldCanvasBlocks()` once it holds the page -- again after
 * a collaborative session has replaced the text, which unfolds everything -- `refoldCanvasBlock()` when
 * a content editor has written a drawing back, and `dispose()` with the editor.
 *
 * @param {object} opts
 * @param {() => object} opts.getEditor The Monaco editor, once there is one.
 * @param {string} opts.languageId What the folding provider is registered against.
 * @param {(text: string) => Array<{ block: string, start: number, end: number }>} opts.findBlockRegions
 * @param {(name: string) => object|undefined} opts.blockDefinition
 */
export function useBlockFolding({ getEditor, languageId, findBlockRegions, blockDefinition }) {
  /** The provider, which is registered against the language rather than this editor. */
  let provider = null

  /*
    The PROVIDER is per-language and process-wide, so it has to be disposed with the component or a
    second visit to the editor would offer every range twice.

    A page with no blocks answers null rather than nothing, which is what lets Monaco fall back to
    folding by indentation as it did before -- an empty list would be taken as "nothing folds here".
    Monaco uses that fallback only when every provider has nothing to say, so on a page that does hold
    a block it is the blocks that fold, not indented runs as well.
  */
  function register() {
    provider = monaco.languages.registerFoldingRangeProvider(languageId, {
      provideFoldingRanges(model) {
        const regions = findBlockRegions(model.getValue())
        return regions.length > 0
          ? regions.map(({ start, end }) => ({
              start,
              end,
              kind: monaco.languages.FoldingRangeKind.Region
            }))
          : null
      }
    })
  }

  function dispose() {
    provider?.dispose()
    provider = null
  }

  /**
   * Fold every block whose body is a drawing, as the editor opens on a page.
   *
   * Through the editor's own fold action, which waits for the folding model to have read the ranges
   * above -- registering the provider has just set that recomputing, and folding a line before it
   * lands would fold nothing. `selectionLines` are 0-based, unlike everything else Monaco is handed.
   */
  function foldCanvasBlocks() {
    const editor = getEditor()
    const model = editor?.getModel()
    if (!model) {
      return
    }
    const lines = findBlockRegions(model.getValue())
      .filter((region) => isCanvasBlock(blockDefinition(region.block)))
      .map((region) => region.start - 1)
    if (lines.length > 0) {
      editor.trigger('blockFolding', 'editor.fold', { selectionLines: lines, levels: 1 })
    }
  }

  /**
   * Fold a drawing back up after "Edit Content" has written it, and put the caret where it shows.
   *
   * The body is edited from the overlay, so the block stays folded unless the author unfolded it
   * themselves -- yet writing the new body back unfolds it twice over: the edit lands inside the hidden
   * lines, and a caret left anywhere in them makes Monaco reveal it. So the caret goes on the block's
   * OPENING line, the one a fold leaves visible, before the fold is asked for.
   *
   * `line` is anywhere in the body that was replaced, which says whose body it was: the innermost
   * block around it. A block that is not a drawing is left as the edit left it.
   *
   * @param {number} line 1-based.
   * @returns {boolean} Whether it was a drawing, and the caret has been placed -- otherwise that is
   *          still the caller's to do.
   */
  function refoldCanvasBlock(line) {
    const editor = getEditor()
    const region = findBlockRegions(editor.getModel().getValue())
      .filter((entry) => entry.start < line && line <= entry.end)
      .at(-1)
    if (!region || !isCanvasBlock(blockDefinition(region.block))) {
      return false
    }
    editor.setPosition({ lineNumber: region.start, column: 1 })
    editor.trigger('blockFolding', 'editor.fold', { selectionLines: [region.start - 1], levels: 1 })
    return true
  }

  return { register, dispose, foldCanvasBlocks, refoldCanvasBlock }
}
