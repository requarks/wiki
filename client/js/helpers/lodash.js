'use strict'

// ====================================
// Load minimal lodash
// ====================================

import cloneDeep from 'lodash/cloneDeep'
import concat from 'lodash/concat'
import debounce from 'lodash/debounce'
import deburr from 'lodash/deburr'
import delay from 'lodash/delay'
import filter from 'lodash/filter'
import find from 'lodash/find'
import findKey from 'lodash/findKey'
import forEach from 'lodash/forEach'
import includes from 'lodash/includes'
import isBoolean from 'lodash/isBoolean'
import isEmpty from 'lodash/isEmpty'
import isNil from 'lodash/isNil'
import join from 'lodash/join'
import kebabCase from 'lodash/kebabCase'
import last from 'lodash/last'
import map from 'lodash/map'
import nth from 'lodash/nth'
import pullAt from 'lodash/pullAt'
import reject from 'lodash/reject'
import slice from 'lodash/slice'
import split from 'lodash/split'
import startCase from 'lodash/startCase'
import startsWith from 'lodash/startsWith'
import toString from 'lodash/toString'
import toUpper from 'lodash/toUpper'
import trim from 'lodash/trim'

// ====================================
// Build lodash object
// ====================================

module.exports = {
  deburr,
  concat,
  cloneDeep,
  debounce,
  delay,
  filter,
  find,
  findKey,
  forEach,
  includes,
  isBoolean,
  isEmpty,
  isNil,
  join,
  kebabCase,
  last,
  map,
  nth,
  pullAt,
  reject,
  slice,
  split,
  startCase,
  startsWith,
  toString,
  toUpper,
  trim
}
