import { isNil, isPlainObject, set, startCase, transform } from 'lodash-es'
import crypto from 'node:crypto'

/* eslint-disable promise/param-names */
export function createDeferred () {
  let result, resolve, reject
  return {
    resolve: function (value) {
      if (resolve) {
        resolve(value)
      } else {
        result = result || new Promise(function (r) { r(value) })
      }
    },
    reject: function (reason) {
      if (reject) {
        reject(reason)
      } else {
        result = result || new Promise(function (x, j) { j(reason) })
      }
    },
    promise: new Promise(function (r, j) {
      if (result) {
        r(result)
      } else {
        resolve = r
        reject = j
      }
    })
  }
}

/**
 * Decode a tree path
 *
 * @param {string} str String to decode
 * @returns Decoded tree path
 */
export function decodeTreePath (str) {
  return str?.replaceAll('.', '/')
}

/**
 * Encode a tree path
 *
 * @param {string} str String to encode
 * @returns Encoded tree path
 */
export function encodeTreePath (str) {
  return str?.toLowerCase()?.replaceAll('/', '.') || ''
}

/**
 * Generate SHA-1 Hash of a string
 *
 * @param {string} str String to hash
 * @returns Hashed string
 */
export function generateHash (str) {
  return crypto.createHash('sha1').update(str).digest('hex')
}

/**
 * Get default value of type
 *
 * @param {any} type primitive type name
 * @returns Default value
 */
export function getTypeDefaultValue (type) {
  switch (type.toLowerCase()) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return false
  }
}

export function parseModuleProps (props) {
  return transform(props, (result, value, key) => {
    let defaultValue = ''
    if (isPlainObject(value)) {
      defaultValue = !isNil(value.default) ? value.default : getTypeDefaultValue(value.type)
    } else {
      defaultValue = getTypeDefaultValue(value)
    }
    set(result, key, {
      default: defaultValue,
      type: (value.type || value).toLowerCase(),
      title: value.title || startCase(key),
      hint: value.hint || '',
      enum: value.enum || false,
      enumDisplay: value.enumDisplay || 'select',
      multiline: value.multiline || false,
      sensitive: value.sensitive || false,
      icon: value.icon || 'rename',
      order: value.order || 100,
      if: value.if ?? []
    })
    return result
  }, {})
}

export function getDictNameFromLocale (locale) {
  const loc = locale.length > 2 ? locale.substring(0, 2) : locale
  if (loc in WIKI.config.search.dictOverrides) {
    return WIKI.config.search.dictOverrides[loc]
  } else {
    return WIKI.data.tsDictMappings[loc] ?? 'simple'
  }
}
