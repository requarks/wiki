import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * The width / height / scale fields of an image resize, kept in step with each other: the Resize
 * Image dialog's, and the image editor's Resize panel's.
 *
 * Values are strings, as the inputs hand them back: a field being typed into is not always a number
 * yet. Neither side may exceed the size it starts from, since a resize only makes smaller.
 *
 * @param {() => { width: number, height: number }} limits The size being resized FROM
 */
export function useImageSizeFields(limits) {
  const { t } = useI18n()

  const fields = reactive({
    width: '',
    height: '',
    percent: '100',
    isRatioLocked: true
  })

  /** Back to the full size, locked. */
  function reset() {
    const { width, height } = limits()
    fields.width = String(width)
    fields.height = String(height)
    fields.percent = '100'
    fields.isRatioLocked = true
  }

  /** A scale as the percent field shows it: at most one decimal, and no trailing `.0`. */
  function formatPercent(ratio) {
    return String(Math.round(ratio * 1000) / 10)
  }

  /**
   * Bring the percent field in line with the two dimensions.
   *
   * Locked, it is simply the width's scale. Unlocked, it is only shown when both sides are at the same
   * scale -- to the same tenth of a percent, which is as fine as the field is drawn -- since a stretched
   * pair has no single number that describes it.
   */
  function syncPercent() {
    const w = Number(fields.width)
    const h = Number(fields.height)
    if (!(w > 0) || !(h > 0)) {
      return
    }
    const { width, height } = limits()
    const scaleW = formatPercent(w / width)
    fields.percent = fields.isRatioLocked || scaleW === formatPercent(h / height) ? scaleW : ''
  }

  function setWidth(val) {
    fields.width = val
    const w = Number(val)
    const { width, height } = limits()
    if (fields.isRatioLocked && w > 0) {
      fields.height = String(Math.max(1, Math.round((w * height) / width)))
    }
    syncPercent()
  }

  function setHeight(val) {
    fields.height = val
    const h = Number(val)
    const { width, height } = limits()
    if (fields.isRatioLocked && h > 0) {
      fields.width = String(Math.max(1, Math.round((h * width) / height)))
    }
    syncPercent()
  }

  /** A percentage scales both sides alike, whether or not the ratio is locked: that is what it means. */
  function setPercent(val) {
    fields.percent = val
    const p = Number(val)
    if (val === '' || !(p > 0)) {
      return
    }
    const { width, height } = limits()
    fields.width = String(Math.max(1, Math.round((width * p) / 100)))
    fields.height = String(Math.max(1, Math.round((height * p) / 100)))
  }

  /** Locking again puts the height back in proportion to the width, which is the side typed first. */
  function toggleRatioLock() {
    fields.isRatioLocked = !fields.isRatioLocked
    if (fields.isRatioLocked) {
      setWidth(fields.width)
    }
  }

  /** A whole number of pixels, at least one and no more than the original: this only makes smaller. */
  function dimensionRule(max) {
    return (val) => {
      const n = Number(val)
      return (
        (Number.isInteger(n) && n >= 1 && n <= max) ||
        t('fileman.resizeImageDimensionInvalid', { max })
      )
    }
  }

  const widthValidation = computed(() => [dimensionRule(limits().width)])
  const heightValidation = computed(() => [dimensionRule(limits().height)])

  // -> Empty is allowed: an unlocked pair that is not the same scale both ways has no one percentage
  const percentValidation = [
    (val) => {
      if (val === '') {
        return true
      }
      const n = Number(val)
      return (n > 0 && n <= 100) || t('fileman.resizeImagePercentInvalid')
    }
  ]

  /** Both sides whole numbers within the limits, which is what the server will take. */
  const isValid = computed(() => {
    const { width, height } = limits()
    const w = Number(fields.width)
    const h = Number(fields.height)
    return (
      Number.isInteger(w) && Number.isInteger(h) && w >= 1 && h >= 1 && w <= width && h <= height
    )
  })

  return {
    fields,
    reset,
    setWidth,
    setHeight,
    setPercent,
    toggleRatioLock,
    widthValidation,
    heightValidation,
    percentValidation,
    isValid
  }
}
