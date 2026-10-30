import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { EDITABLE_EXTS, extensionOf, LOSSY_EXTS } from '@/helpers/imageEdit'

/**
 * The name and quality an edited or resized image is saved with: the Resize Image dialog's, and the
 * image editor's save dialog's.
 *
 * The extension of the name decides the format, on the server as here, so the format is never held
 * apart from the name -- `setFormat` rewrites the extension, and `targetExt` reads it back.
 *
 * @param {object} opts
 * @param {string} opts.sourceFileName The file being saved from
 * @param {string} opts.suffix Added to its stem for the name a copy is offered under, e.g. `-resized`
 * @param {() => boolean} opts.isSaveAs Whether a new name is being given at all. While it is not, the
 *        name rules pass and `targetExt` is the source's own.
 */
export function useImageSaveFields({ sourceFileName, suffix, isSaveAs }) {
  const { t } = useI18n()

  const extIndex = sourceFileName.lastIndexOf('.')
  const sourceStem = extIndex > 0 ? sourceFileName.slice(0, extIndex) : sourceFileName
  const sourceExt = extensionOf(sourceFileName)

  const fileName = ref(`${sourceStem}${suffix}.${sourceExt}`)

  /** The extension the result is written under, which is what decides its format. */
  const targetExt = computed(() => (isSaveAs() ? extensionOf(fileName.value) : sourceExt))

  // -> A name that is not one of the formats yet has no say: the field's own rule complains about it
  const isLossy = computed(
    () => !EDITABLE_EXTS.includes(targetExt.value) || LOSSY_EXTS.has(targetExt.value)
  )

  const fileNameValidation = [
    (val) => !isSaveAs() || val.trim().length > 0 || t('fileman.resizeImageFileNameMissing'),
    (val) =>
      !isSaveAs() ||
      EDITABLE_EXTS.some((ext) => val.trim().toLowerCase().endsWith(`.${ext}`)) ||
      t('fileman.resizeImageFileNameInvalid')
  ]

  /** Save as another format: the name's extension is swapped, or added when it has none. */
  function setFormat(ext) {
    const name = fileName.value.trim()
    const idx = name.lastIndexOf('.')
    fileName.value = `${idx > 0 ? name.slice(0, idx) : name}.${ext}`
  }

  return { fileName, sourceExt, targetExt, isLossy, fileNameValidation, setFormat }
}
