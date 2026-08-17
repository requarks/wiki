const PAGINATION_NAV_WIDTH = 52
const PAGINATION_ELLIPSIS_WIDTH = 38
const PAGINATION_ITEM_MARGIN = 10
const PAGINATION_ITEM_MIN_WIDTH = 34
const PAGINATION_CHAR_WIDTH = 9
const PAGINATION_ITEM_PADDING = 10
const PAGINATION_MIN_TOTAL_VISIBLE = 5
const PAGINATION_MAX_TOTAL_VISIBLE = 15

function range (from, to) {
  const result = []
  const start = from > 0 ? from : 1

  for (let i = start; i <= to; i++) {
    result.push(i)
  }

  return result
}

function getPaginationItems (length, value, maxLength) {
  if (length <= maxLength) {
    return range(1, length)
  }

  const even = maxLength % 2 === 0 ? 1 : 0
  const left = Math.floor(maxLength / 2)
  const right = length - left + 1 + even

  if (value > left && value < right) {
    const start = value - left + 2
    const end = value + left - 2 - even
    return [1, '...', ...range(start, end), '...', length]
  }

  if (value === left) {
    const end = value + left - 1 - even
    return [...range(1, end), '...', length]
  }

  if (value === right) {
    const start = value - left + 1
    return [1, '...', ...range(start, length)]
  }

  return [
    ...range(1, left),
    '...',
    ...range(right, length)
  ]
}

function pageItemWidth (num) {
  const digits = String(num).length
  const contentWidth = digits * PAGINATION_CHAR_WIDTH + PAGINATION_ITEM_PADDING

  return Math.max(PAGINATION_ITEM_MIN_WIDTH, contentWidth) + PAGINATION_ITEM_MARGIN
}

function estimateItemsWidth (items) {
  return items.reduce((sum, item) => {
    if (item === '...') {
      return sum + PAGINATION_ELLIPSIS_WIDTH
    }

    return sum + pageItemWidth(item)
  }, 0)
}

function calcTotalVisible (containerWidth, length, value) {
  if (!containerWidth || !length || length <= 1) {
    return PAGINATION_MIN_TOTAL_VISIBLE
  }

  const available = containerWidth - (PAGINATION_NAV_WIDTH * 2)

  for (let maxLength = Math.min(PAGINATION_MAX_TOTAL_VISIBLE, length); maxLength >= PAGINATION_MIN_TOTAL_VISIBLE; maxLength--) {
    const items = getPaginationItems(length, value, maxLength)

    if (estimateItemsWidth(items) <= available) {
      return maxLength
    }
  }

  return PAGINATION_MIN_TOTAL_VISIBLE
}

module.exports = {
  calcTotalVisible,
  PAGINATION_MIN_TOTAL_VISIBLE,
  PAGINATION_MAX_TOTAL_VISIBLE
}
