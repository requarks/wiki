import { useI18n } from 'vue-i18n'
import { minBy } from 'es-toolkit/array'
import * as monaco from 'monaco-editor'
import { Position, Range } from 'monaco-editor'

import { useImagePropertiesDialog } from '@/composables/imagePropertiesDialog'
import { notify } from '@/composables/notify'

/**
 * The "Image Properties" code lens, for a source editor built on Monaco -- the Markdown and the
 * AsciiDoc editor both draw it, over `useImagePropertiesDialog`.
 *
 * Everything here is the same for both: where the lens goes and how the answer is written over the
 * image. What differs is only how an image is spelled, so each editor hands in its own three functions
 * for that:
 *
 *   - `findImages(text)`: every image it can offer a form for, each with a 1-based `line` and
 *     `column` and the `raw` source it occupies, which has to sit on that one line.
 *   - `imageValues(found)`: what the dialog opens on -- see `ImagePropertiesDialog`'s props.
 *   - `writeImage(found, values)`: the source to replace `raw` with.
 *
 * Call it during `setup`, since it watches the overlay. Then `register()` once the editor exists,
 * `takePick()` first thing in the editor's `insertAsset` handler, and `dispose()` with the editor.
 *
 * @param {object} opts
 * @param {() => object} opts.getEditor The Monaco editor, once there is one.
 * @param {string} opts.languageId What the lens provider is registered against.
 * @param {(text: string) => Array<object>} opts.findImages
 * @param {(found: object) => object} opts.imageValues
 * @param {(found: object, values: object) => string} opts.writeImage
 */
export function useImagePropertiesLens({
  getEditor,
  languageId,
  findImages,
  imageValues,
  writeImage
}) {
  const { t } = useI18n()
  const { open, takePick } = useImagePropertiesDialog({ apply })

  /** The lens provider, which is registered against the language rather than this editor. */
  let provider = null

  /*
    "Image Properties" over every image in the page, for the reason tables and blocks have a lens: an
    image's size, alignment and framing are syntax nobody remembers.

    A line holding several images gets a lens for each, numbered, since otherwise there would be
    nothing to tell "Image Properties | Image Properties" apart. The source goes with the line, for the
    reason `edit` gives.

    The PROVIDER is per-language and process-wide, so it has to be disposed with the component or a
    second visit to the editor would draw every lens twice.
  */
  function register() {
    const editor = getEditor()
    const command = editor.addCommand(0, (_accessor, line, raw) => edit(line, raw))
    provider = monaco.languages.registerCodeLensProvider(languageId, {
      provideCodeLenses(model) {
        const images = findImages(model.getValue())
        const lenses = images.map((image) => {
          const onLine = images.filter((other) => other.line === image.line)
          return {
            range: new Range(image.line, 1, image.line, 1),
            command: {
              id: command,
              title:
                onLine.length > 1
                  ? t('editor.markup.imagePropertiesNth', { n: onLine.indexOf(image) + 1 })
                  : t('editor.markup.imageProperties'),
              arguments: [image.line, image.raw]
            }
          }
        })
        return { lenses, dispose() {} }
      }
    })
  }

  function dispose() {
    provider?.dispose()
    provider = null
  }

  /**
   * The dialog, over an image already in the page — what the lens above one opens.
   *
   * Looked up again at the moment of the click rather than taken from the lens, which is provided once
   * and then moves with the text. Matched on its source as well as its line: a line can hold several
   * images, and an edit to the left of one moves its column without moving its line.
   */
  function edit(line, raw) {
    const found = findImages(getEditor().getModel().getValue()).find(
      (entry) => entry.line === line && entry.raw === raw
    )
    if (found) {
      open(found, imageValues(found))
    }
  }

  /**
   * The dialog's answer, over the characters the image occupies and nothing else, as one undo.
   *
   * Found again first: the dialog may have been open a while, a trip to the file manager included, and
   * in a collaborative session somebody else may have been typing all along. The same source nearest
   * the line it was on is the same image; where there is none, it was edited away under the dialog,
   * and writing over whatever is at that position now would destroy something else.
   */
  function apply(found, values) {
    const editor = getEditor()
    const candidates = findImages(editor.getModel().getValue()).filter(
      (entry) => entry.raw === found.raw
    )
    const current = minBy(candidates, (entry) => Math.abs(entry.line - found.line))
    if (!current) {
      notify({ type: 'warning', message: t('editor.markup.image.gone') })
      return
    }
    editor.executeEdits('image', [
      {
        range: new Range(
          current.line,
          current.column,
          current.line,
          current.column + current.raw.length
        ),
        text: writeImage(current, values)
      }
    ])
    editor.setPosition(new Position(current.line, current.column))
    editor.focus()
  }

  return { register, takePick, dispose }
}
