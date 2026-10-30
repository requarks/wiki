/**
 * The image editor's working parts that are not UI: what an edit does to an image's size, how a list
 * of edits is kept tidy, and how it is previewed on a canvas.
 *
 * The preview is only a preview. The server replays the same list with Sharp on the original and
 * encodes the result (`editImage` in backend/helpers/images.ts), so every position and size here is in
 * the ORIGINAL's pixels, as a viewer sees it after EXIF orientation -- never in the preview canvas's,
 * which may be drawn smaller. See dev/specs/image-editor.md.
 */

/** What an edited image can be saved as, by extension. The same list the server holds. */
export const EDITABLE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif']

/** JPEG and WebP take a quality; PNG and GIF are lossless, and the server ignores one for them. */
export const LOSSY_EXTS = new Set(['jpg', 'jpeg', 'webp'])

/** Colour settings that change nothing. */
export const NEUTRAL_ADJUST = Object.freeze({
  brightness: 1,
  contrast: 1,
  saturation: 1,
  grayscale: false,
  sharpen: false
})

/**
 * The most pixels the preview is drawn with. Browsers cap a canvas's area -- iOS at roughly 16
 * megapixels -- so a larger image is previewed at the largest scale that fits.
 */
const PREVIEW_PIXEL_BUDGET = 16_000_000

/** Fully transparent, as the server's default rotation background. */
export const TRANSPARENT = '#00000000'

/** The SVG filter the preview approximates Sharp's `sharpen()` with. Rendered once by the editor. */
export const SHARPEN_FILTER_ID = 'wk-image-editor-sharpen'

/** @param {object} adjust */
export function isNeutralAdjust(adjust) {
  return Object.keys(NEUTRAL_ADJUST).every((key) => adjust[key] === NEUTRAL_ADJUST[key])
}

/** The extension of a file name, lower-cased, or empty when it has none. */
export function extensionOf(fileName) {
  const idx = fileName.lastIndexOf('.')
  return idx > 0 ? fileName.slice(idx + 1).toLowerCase() : ''
}

/**
 * The size a rotation leaves an image at.
 *
 * Sharp grows the canvas to hold the rotated picture and rounds each side to the nearest pixel; this
 * is that rule, so that a crop worked out after a rotation fits what the server makes.
 */
export function rotatedSize(width, height, angle) {
  const turns = ((angle % 360) + 360) % 360
  if (turns % 90 === 0) {
    return turns % 180 === 0 ? { width, height } : { width: height, height: width }
  }
  const rad = (angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    width: Math.round(width * cos + height * sin),
    height: Math.round(width * sin + height * cos)
  }
}

/** The size one operation leaves an image at. */
export function sizeAfter(size, op) {
  switch (op.op) {
    case 'rotate':
      return rotatedSize(size.width, size.height, op.angle)
    case 'crop':
    case 'resize':
      return { width: op.width, height: op.height }
    case 'extend':
      return {
        width: size.width + op.left + op.right,
        height: size.height + op.top + op.bottom
      }
    default:
      return size
  }
}

/** The size a list of operations leaves an image at. */
export function sizeAfterAll(size, operations) {
  return operations.reduce(sizeAfter, size)
}

/**
 * Add an operation to a list, folding it into the last one where the two are one step.
 *
 * Quarter turns add up -- four presses of Rotate Right leave nothing -- and a second mirror or flip
 * undoes the first. Only the very last operation is looked at: a rotation either side of a crop is two
 * steps, since the crop between them is in a different orientation from both.
 *
 * @returns {Array} A new list; the one passed in is left alone, since it is an undo snapshot
 */
export function pushOperation(operations, op) {
  const last = operations.at(-1)
  const head = operations.slice(0, -1)
  if (last && (op.op === 'flip' || op.op === 'flop') && last.op === op.op) {
    return head
  }
  if (op.op === 'rotate' && op.angle % 90 === 0 && last?.op === 'rotate' && last.angle % 90 === 0) {
    // -> Back into -90, 90 or 180, the three a quarter-turn rotation is ever sent as
    const turns = ((((last.angle + op.angle) % 360) + 360) % 360) / 90
    return turns === 0 ? head : [...head, { op: 'rotate', angle: [0, 90, 180, -90][turns] }]
  }
  return [...operations, op]
}

/**
 * The CSS filter that previews colour settings: the same functions, in the same order, the server
 * applies them in, so that the two agree to within a level or two in 255.
 */
export function adjustFilter(adjust) {
  const parts = []
  if (adjust.brightness !== 1) {
    parts.push(`brightness(${adjust.brightness})`)
  }
  if (adjust.contrast !== 1) {
    parts.push(`contrast(${adjust.contrast})`)
  }
  if (adjust.saturation !== 1) {
    parts.push(`saturate(${adjust.saturation})`)
  }
  if (adjust.grayscale) {
    parts.push('grayscale(1)')
  }
  if (adjust.sharpen) {
    parts.push(`url(#${SHARPEN_FILTER_ID})`)
  }
  return parts.length > 0 ? parts.join(' ') : 'none'
}

/**
 * Decode an image for the preview: oriented as a viewer sees it, and no larger than the canvas budget.
 *
 * @param {Blob} blob The original file
 * @returns {Promise<{ image: ImageBitmap, width: number, height: number }>} `width` and `height` are
 *          the ORIGINAL's, whatever size the bitmap was drawn at
 */
export async function decodeForPreview(blob) {
  const full = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const { width, height } = full
  if (width * height <= PREVIEW_PIXEL_BUDGET) {
    return { image: full, width, height }
  }
  full.close()
  const scale = Math.sqrt(PREVIEW_PIXEL_BUDGET / (width * height))
  const image = await createImageBitmap(blob, {
    imageOrientation: 'from-image',
    resizeWidth: Math.max(1, Math.round(width * scale)),
    resizeHeight: Math.max(1, Math.round(height * scale)),
    resizeQuality: 'high'
  })
  return { image, width, height }
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** Whether a colour is drawn at all: the editor sends `#rrggbbaa`, and `…00` is transparent. */
function isVisible(color) {
  return Boolean(color) && !(color.length === 9 && color.endsWith('00'))
}

/**
 * Draw one operation onto a new canvas.
 *
 * @param {HTMLCanvasElement|ImageBitmap} src The preview of the image before it
 * @param {object} op The operation, in true pixels
 * @param {{ width: number, height: number }} size The image's TRUE size before it
 * @param {number} scale How much smaller than true the preview is drawn: `src.width / size.width`
 */
export function drawOperation(src, op, size, scale) {
  const next = sizeAfter(size, op)
  const out = makeCanvas(next.width * scale, next.height * scale)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  switch (op.op) {
    case 'rotate': {
      if (isVisible(op.background)) {
        ctx.fillStyle = op.background
        ctx.fillRect(0, 0, out.width, out.height)
      }
      // -> A quarter turn lands every pixel on a pixel, so nothing is smoothed
      ctx.imageSmoothingEnabled = op.angle % 90 !== 0
      ctx.translate(out.width / 2, out.height / 2)
      ctx.rotate((op.angle * Math.PI) / 180)
      ctx.drawImage(src, -src.width / 2, -src.height / 2)
      break
    }
    case 'flip':
      ctx.translate(0, out.height)
      ctx.scale(1, -1)
      ctx.drawImage(src, 0, 0)
      break
    case 'flop':
      ctx.translate(out.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(src, 0, 0)
      break
    case 'crop':
      ctx.drawImage(
        src,
        op.left * scale,
        op.top * scale,
        op.width * scale,
        op.height * scale,
        0,
        0,
        out.width,
        out.height
      )
      break
    case 'resize':
      ctx.drawImage(src, 0, 0, out.width, out.height)
      break
    case 'extend':
      if (isVisible(op.background)) {
        ctx.fillStyle = op.background
        ctx.fillRect(0, 0, out.width, out.height)
      }
      ctx.drawImage(src, Math.round(op.left * scale), Math.round(op.top * scale))
      break
    case 'redact':
      ctx.drawImage(src, 0, 0)
      drawRedaction(ctx, src, op, scale)
      break
  }
  return out
}

/** Hide a region: punched out first, as the server does, so a half-transparent patch hides as well. */
function drawRedaction(ctx, src, op, scale) {
  const x = op.left * scale
  const y = op.top * scale
  const w = op.width * scale
  const h = op.height * scale
  ctx.clearRect(x, y, w, h)
  if (op.style === 'fill') {
    ctx.fillStyle = op.color ?? '#000000'
    ctx.fillRect(x, y, w, h)
  } else if (op.style === 'pixelate') {
    // -> One pixel per block, in the image's own pixels, blown back up without smoothing
    const size = op.size ?? 16
    const blocks = makeCanvas(Math.ceil(op.width / size), Math.ceil(op.height / size))
    const bctx = blocks.getContext('2d')
    bctx.imageSmoothingQuality = 'high'
    bctx.drawImage(src, x, y, w, h, 0, 0, blocks.width, blocks.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(blocks, x, y, w, h)
    ctx.imageSmoothingEnabled = true
  } else {
    const sigma = (op.size ?? 20) * scale
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    if ('filter' in ctx) {
      ctx.filter = `blur(${sigma}px)`
      ctx.drawImage(src, 0, 0)
    } else {
      // -> No canvas filters (older Safari): shrinking and enlarging again smooths about as much
      const factor = Math.max(1, sigma / 2)
      const small = makeCanvas(w / factor, h / factor)
      small.getContext('2d').drawImage(src, x, y, w, h, 0, 0, small.width, small.height)
      ctx.drawImage(small, x, y, w, h)
    }
    ctx.restore()
  }
}

/**
 * Draw a list of operations, from the decoded original.
 *
 * @param {ImageBitmap} image The original, decoded by `decodeForPreview`
 * @param {Array} operations
 * @param {{ width: number, height: number }} original The original's TRUE size
 * @returns {HTMLCanvasElement}
 */
export function drawOperations(image, operations, original) {
  const scale = image.width / original.width
  let canvas = makeCanvas(image.width, image.height)
  canvas.getContext('2d').drawImage(image, 0, 0)
  let size = original
  for (const op of operations) {
    canvas = drawOperation(canvas, op, size, scale)
    size = sizeAfter(size, op)
  }
  return canvas
}

/**
 * Find the border of one colour round a picture, as the region to keep.
 *
 * Scanned in from each edge for the first row or column holding a pixel that differs from the top-left
 * one by more than the tolerance in any channel, transparency included. Found on the preview, so when
 * that is drawn smaller than the image the region is scaled up and rounded OUTWARDS: it can leave a
 * sliver of border, but never cut into the picture.
 *
 * @param {HTMLCanvasElement} canvas The preview
 * @param {{ width: number, height: number }} size The image's true size
 * @param {number} tolerance 0 to 255
 * @returns {object|null} `{ left, top, width, height }` in true pixels, or null when every pixel is
 *          the border colour and there is nothing to keep
 */
export function findTrim(canvas, size, tolerance) {
  const { width, height } = canvas
  const data = canvas
    .getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, width, height).data
  const ref = data.slice(0, 4)
  const differs = (x, y) => {
    const i = (y * width + x) * 4
    return (
      Math.abs(data[i] - ref[0]) > tolerance ||
      Math.abs(data[i + 1] - ref[1]) > tolerance ||
      Math.abs(data[i + 2] - ref[2]) > tolerance ||
      Math.abs(data[i + 3] - ref[3]) > tolerance
    )
  }
  const rowDiffers = (y) => {
    for (let x = 0; x < width; x++) {
      if (differs(x, y)) {
        return true
      }
    }
    return false
  }
  const columnDiffers = (x, top, bottom) => {
    for (let y = top; y <= bottom; y++) {
      if (differs(x, y)) {
        return true
      }
    }
    return false
  }
  let top = 0
  while (top < height && !rowDiffers(top)) {
    top++
  }
  if (top === height) {
    return null
  }
  let bottom = height - 1
  while (!rowDiffers(bottom)) {
    bottom--
  }
  let left = 0
  while (!columnDiffers(left, top, bottom)) {
    left++
  }
  let right = width - 1
  while (!columnDiffers(right, top, bottom)) {
    right--
  }
  const rx = size.width / width
  const ry = size.height / height
  const region = {
    left: Math.floor(left * rx),
    top: Math.floor(top * ry),
    right: Math.min(size.width, Math.ceil((right + 1) * rx)),
    bottom: Math.min(size.height, Math.ceil((bottom + 1) * ry))
  }
  return {
    left: region.left,
    top: region.top,
    width: region.right - region.left,
    height: region.bottom - region.top
  }
}

/**
 * The largest upright rectangle inside a picture rotated by `angle`, centred in the canvas the
 * rotation leaves -- what Straighten's "crop to fit" keeps, so that no corner is left exposed.
 *
 * One pixel in from the exact answer on every side, since the edge of a rotated picture is smoothed
 * into its background.
 *
 * @returns {object} `{ left, top, width, height }`, in the rotated image's true pixels
 */
export function inscribedCrop(width, height, angle) {
  const rotated = rotatedSize(width, height, angle)
  const rad = (angle * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))
  const widthIsLonger = width >= height
  const long = widthIsLonger ? width : height
  const short = widthIsLonger ? height : width
  let w
  let h
  if (short <= 2 * sin * cos * long || Math.abs(sin - cos) < 1e-10) {
    const half = short / 2
    ;[w, h] = widthIsLonger ? [half / sin, half / cos] : [half / cos, half / sin]
  } else {
    const cos2a = cos * cos - sin * sin
    w = (width * cos - height * sin) / cos2a
    h = (height * cos - width * sin) / cos2a
  }
  const cropWidth = Math.max(1, Math.min(rotated.width, Math.floor(w) - 2))
  const cropHeight = Math.max(1, Math.min(rotated.height, Math.floor(h) - 2))
  return {
    left: Math.floor((rotated.width - cropWidth) / 2),
    top: Math.floor((rotated.height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight
  }
}

/**
 * The largest region of an aspect ratio that fits an image, centred in it -- where a crop box starts
 * when a ratio is chosen.
 *
 * @param {number|null} aspect Width over height, or null for the whole image
 */
export function centredRegion(size, aspect) {
  if (!aspect) {
    return { left: 0, top: 0, width: size.width, height: size.height }
  }
  let width = size.width
  let height = Math.round(width / aspect)
  if (height > size.height) {
    height = size.height
    width = Math.round(height * aspect)
  }
  width = Math.max(1, Math.min(size.width, width))
  height = Math.max(1, Math.min(size.height, height))
  return {
    left: Math.floor((size.width - width) / 2),
    top: Math.floor((size.height - height) / 2),
    width,
    height
  }
}
