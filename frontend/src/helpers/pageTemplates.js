/**
 * What went wrong starting a page from a template, in words the person who asked can use.
 *
 * Shared by the two ways a page is started from one -- a `/_create?template=` link and the From
 * Template dialog -- which can fail for the same reasons, since both end in
 * `pageStore.pageFromTemplate`.
 *
 * @param {Error} err What `pageFromTemplate` threw.
 * @param {Function} t The caller's `t`, from `useI18n`.
 * @param {string} [editor] The editor a link named, for the mismatch message.
 */
export function templateErrorMessage(err, t, editor) {
  switch (err.message) {
    case 'ERR_TEMPLATE_NOT_FOUND':
      return t('editor.template.notFound')
    case 'ERR_TEMPLATE_NOT_TEMPLATE':
      return t('editor.template.notTemplate')
    case 'ERR_TEMPLATE_LOCKED':
      return t('editor.template.locked')
    case 'ERR_TEMPLATE_NO_SOURCE':
      return t('editor.template.noSource')
    case 'ERR_TEMPLATE_EDITOR_MISMATCH':
      return t('editor.template.editorMismatch', { editor, templateEditor: err.templateEditor })
    default:
      return err.message
  }
}

/**
 * Whether a template answers a search: every word of it found in the title, the path or the
 * description, case- and accent-insensitively. Words rather than the whole string, so that
 * "note feature" finds Feature Note.
 *
 * @param {{ title: string, path: string, description: string }} template
 * @param {string} query What the reader typed.
 */
export function templateMatches(template, query) {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean)
  if (words.length < 1) {
    return true
  }
  const haystack = foldForSearch(`${template.title} ${template.path} ${template.description}`)
  return words.every((word) => haystack.includes(word))
}

/** Lowercase with the accents taken off, so that "resume" finds "Résumé". */
function foldForSearch(str) {
  return (str ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}
