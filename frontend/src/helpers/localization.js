/**
 * Parse an error message for an error code and translate
 *
 * @param {String} val Value to parse
 * @param {Function} t vue-i18n translation method
 */
export function localizeError (val, t) {
  if (val?.startsWith('ERR_')) {
    return t(`error.${val}`)
  } else {
    return val
  }
}
