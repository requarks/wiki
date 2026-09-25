/**
 * Image helpers
 *
 * Only what the server needs to accept an uploaded image safely: recognizing what it actually is, and
 * normalizing it when the Sharp extension is available.
 */

import { CustomError } from './common.ts'

/** The image formats an upload may use. */
export const imageMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

export type ImageMimeType = (typeof imageMimeTypes)[number]

/**
 * SVG, which is markup rather than an image format and so is handled apart from the raster ones
 * everywhere: it is recognized by reading it, it cannot be resized or re-encoded, and serving one
 * back means serving a document a browser will happily execute scripts from.
 */
export const svgMimeType = 'image/svg+xml'

/**
 * Recognize SVG markup.
 *
 * There is no magic number to match: an SVG may open with a byte order mark, an XML declaration, a
 * doctype or comments before the root element ever appears. So the start of the file is read as text
 * and the root element looked for — enough to tell an SVG from a file claiming to be one, which is
 * all this decides.
 */
export function detectSvg(data: Buffer): boolean {
  return /<svg[\s>]/i.test(data.subarray(0, 1024).toString('utf8'))
}

/**
 * Recognize an image from its leading bytes.
 *
 * The declared `Content-Type` of an upload is whatever the client felt like sending, so the stored
 * bytes are what decides — both for rejecting a file that is not an image at all and for serving it
 * back with a truthful type later.
 *
 * @returns The MIME type, or null if these bytes are not one of the supported formats
 */
export function detectImageMime(data: Buffer): ImageMimeType | null {
  if (data.length < 12) {
    return null
  }
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg'
  }
  if (/^GIF8[79]a$/.test(data.subarray(0, 6).toString('latin1'))) {
    return 'image/gif'
  }
  // -> A WebP is a RIFF container whose form type, at byte 8, is `WEBP`
  if (
    data.subarray(0, 4).toString('latin1') === 'RIFF' &&
    data.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * Resize an image to a square JPEG, using the Sharp extension.
 *
 * Sharp ships as an optional dependency, so it is normally there — but an optional dependency is
 * exactly one that may be missing, whether because the platform has no prebuilt binary or because the
 * install skipped it. So this reports back rather than failing, leaving the caller to decide whether
 * the original bytes will do; the admin area's extensions view is where it gets (re)installed.
 *
 * @returns The resized JPEG, or null if Sharp is not usable on this system
 */
export async function resizeImageToSquareJpeg(data: Buffer, size: number): Promise<Buffer | null> {
  const definition = WIKI.models.extensions.getDefinition('sharp')
  if (!definition || !(await WIKI.models.extensions.isInstalled(definition))) {
    return null
  }
  // -> The specifier is held in a variable on purpose: Sharp is an *optional* dependency, so a literal
  //    `import('sharp')` would be a type error wherever the optional install was skipped.
  const specifier = 'sharp'
  try {
    const { default: sharp } = await import(specifier)
    return await sharp(data)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch (err: any) {
    // -> Present but unusable, which is what a native binary built for another platform looks like. The
    //    caller falls back to the original bytes rather than refusing the upload; the failure is
    //    recorded because Node will keep replaying it until the server restarts, so reinstalling Sharp
    //    from the admin area cannot help this process.
    WIKI.models.extensions.noteLoadFailure(specifier)
    WIKI.logger.warn(`Could not resize an image with Sharp: ${err.message}`)
    return null
  }
}

/** How an uploaded image is brought down to the size and format it will be served at. */
export type ImageNormalization = {
  width: number
  height: number
  /**
   * `cover` crops to the target aspect ratio, for an image whose frame is fixed — a favicon, a
   * background. `inside` fits within the box instead, for one whose own proportions matter, such as
   * a logo that may be any shape.
   */
  fit: 'cover' | 'inside'
  /** `webp` for anything displayed by the app itself; `png` where the widest support is worth the
   * bytes, as it is for a favicon. Both keep transparency, which a logo usually depends on. */
  format: 'webp' | 'png'
}

/**
 * Re-encode an image to the given size and format, using the Sharp extension.
 *
 * Never enlarges: upscaling a small upload would cost bytes to look worse. So the result is at most
 * the requested size, and an image already smaller than the box is only re-encoded.
 *
 * @returns The re-encoded image, or null if Sharp is not usable on this system
 */
export async function normalizeImage(
  data: Buffer,
  { width, height, fit, format }: ImageNormalization
): Promise<Buffer | null> {
  const definition = WIKI.models.extensions.getDefinition('sharp')
  if (!definition || !(await WIKI.models.extensions.isInstalled(definition))) {
    return null
  }
  const specifier = 'sharp'
  // -> Loading Sharp and running it are kept apart, as they are for a thumbnail: the upload may simply
  //    be an image Sharp cannot read, which must not be recorded as Sharp itself being broken
  let sharp: any
  try {
    ;({ default: sharp } = await import(specifier))
  } catch (err: any) {
    WIKI.models.extensions.noteLoadFailure(specifier)
    WIKI.logger.warn(`Could not load Sharp to re-encode an image: ${err.message}`)
    return null
  }
  try {
    const resized = sharp(data).resize(width, height, {
      fit,
      position: 'centre',
      withoutEnlargement: true
    })
    return await (
      format === 'png' ? resized.png({ compressionLevel: 9 }) : resized.webp({ quality: 80 })
    ).toBuffer()
  } catch (err: any) {
    WIKI.logger.warn(`Could not re-encode an uploaded image: ${err.message}`)
    return null
  }
}

/**
 * Shrink an image to a WebP thumbnail, using the Sharp extension.
 *
 * Unlike an avatar, a thumbnail has no fallback: a file manager that cannot make one simply shows the
 * file type icon instead, so null here is an ordinary outcome rather than a degraded one.
 *
 * @returns The thumbnail, or null if Sharp is not usable on this system or these bytes are not an
 *          image it can read
 */
export async function makeImageThumbnail(
  data: Buffer,
  width: number,
  height: number
): Promise<Buffer | null> {
  const definition = WIKI.models.extensions.getDefinition('sharp')
  if (!definition || !(await WIKI.models.extensions.isInstalled(definition))) {
    return null
  }
  const specifier = 'sharp'
  // -> Loading Sharp and running it are kept apart here, unlike above: whatever a user uploaded may
  //    simply not be an image Sharp can read, and that must not be recorded as Sharp itself being
  //    broken for the rest of the process
  let sharp: any
  try {
    ;({ default: sharp } = await import(specifier))
  } catch (err: any) {
    WIKI.models.extensions.noteLoadFailure(specifier)
    WIKI.logger.warn(`Could not load Sharp to generate a thumbnail: ${err.message}`)
    return null
  }
  try {
    return await sharp(data)
      .resize(width, height, { fit: 'cover', position: 'centre', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  } catch (err: any) {
    WIKI.logger.debug(`Could not generate a thumbnail for an upload: ${err.message}`)
    return null
  }
}

/** How big an image is, in pixels, as it is meant to be displayed. */
export type ImageDimensions = {
  width: number
  height: number
}

/**
 * Read an image's pixel dimensions, using the Sharp extension.
 *
 * Recorded once, when the file arrives, so that showing them later costs nothing — the file manager
 * lists a folder at a time and must not read every image to describe one.
 *
 * The dimensions are the ones a viewer will show, not the ones the pixels are stored in: an EXIF
 * orientation of 5 or above means the decoder turns the image a quarter turn, and Sharp reports the
 * pre-rotation size, so the two are swapped back here. A portrait photo off a phone is exactly this
 * case, and reporting it as landscape is worse than reporting nothing.
 *
 * @returns The dimensions, or null if Sharp is not usable on this system or these bytes are not an
 *          image it can read
 */
export async function readImageDimensions(data: Buffer): Promise<ImageDimensions | null> {
  const definition = WIKI.models.extensions.getDefinition('sharp')
  if (!definition || !(await WIKI.models.extensions.isInstalled(definition))) {
    return null
  }
  const specifier = 'sharp'
  // -> Loading Sharp and running it are kept apart, as everywhere else here: whatever a user uploaded
  //    may simply not be an image Sharp can read, which must not be recorded as Sharp being broken
  let sharp: any
  try {
    ;({ default: sharp } = await import(specifier))
  } catch (err: any) {
    WIKI.models.extensions.noteLoadFailure(specifier)
    WIKI.logger.warn(`Could not load Sharp to measure an image: ${err.message}`)
    return null
  }
  try {
    const { width, height, orientation } = await sharp(data).metadata()
    if (!width || !height) {
      return null
    }
    return orientation && orientation >= 5 ? { width: height, height: width } : { width, height }
  } catch (err: any) {
    WIKI.logger.debug(`Could not read the dimensions of an upload: ${err.message}`)
    return null
  }
}

/**
 * The raster formats an image can be resized INTO, keyed by the file extension that names each one.
 *
 * The extension decides rather than the source: a file is served as the type its name says, so a
 * `photo.png` saved as `photo.jpg` has to actually be a JPEG afterwards.
 */
export const resizableFormats = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  gif: 'gif'
} as const

export type ResizableFormat = (typeof resizableFormats)[keyof typeof resizableFormats]

/** The formats that can hold an animation, and so keep every frame of one. */
const animatedFormats = new Set<ResizableFormat>(['gif', 'webp'])

/** The formats that honour a quality setting. PNG and GIF are lossless, and ignore one. */
const lossyFormats = new Set<ResizableFormat>(['jpeg', 'webp'])

/** What an image is resized to, and how it is encoded afterwards. */
export type ImageResize = {
  width: number
  height: number
  format: ResizableFormat
  /** 1 to 100. Only consulted for a lossy format. */
  quality: number
}

/**
 * Resize an image to exactly the given size, using the Sharp extension.
 *
 * Unlike the helpers above, this is something a person asked for rather than something done on their
 * behalf, so there is no quiet fallback to the original bytes: every way it can fail is thrown as an
 * error the caller can show them. Sharp being absent is the one they can do something about, and is
 * reported apart from an image Sharp could not read.
 *
 * Both dimensions are applied as given, so a pair that does not keep the ratio stretches the image —
 * keeping it is the dialog's job, where the lock is. Neither may exceed the original, measured as a
 * viewer sees it (after EXIF orientation, which is applied here too): enlarging costs bytes to look
 * worse.
 *
 * An animated GIF or WebP keeps every frame, unless it is saved as a format that cannot animate.
 *
 * @throws `imageResizeSharpMissing` (503), `imageResizeUnreadable` (422) or `imageResizeEnlarge` (400)
 */
export async function resizeImage(
  data: Buffer,
  { width, height, format, quality }: ImageResize
): Promise<Buffer> {
  const definition = WIKI.models.extensions.getDefinition('sharp')
  if (!definition || !(await WIKI.models.extensions.isInstalled(definition))) {
    throw new CustomError(
      'imageResizeSharpMissing',
      'Resizing an image needs the Sharp extension, which is not installed on this server. An administrator can install it under Administration → Extensions.',
      503
    )
  }
  const specifier = 'sharp'
  let sharp: any
  try {
    ;({ default: sharp } = await import(specifier))
  } catch (err: any) {
    WIKI.models.extensions.noteLoadFailure(specifier)
    WIKI.logger.warn(`Could not load Sharp to resize an image: ${err.message}`)
    throw new CustomError(
      'imageResizeSharpMissing',
      'Resizing an image needs the Sharp extension, which could not be loaded on this server. An administrator can reinstall it under Administration → Extensions, then restart the server.',
      503
    )
  }

  // -> Every frame where the result can hold them, so that resizing an animation does not quietly
  //    turn it into a still. PNG and JPEG cannot, and read all frames they would come out as every
  //    frame stacked into one tall picture, so they take the first. A still reads the same either way.
  const input = { animated: animatedFormats.has(format), autoOrient: true }
  let original: ImageDimensions | null
  try {
    const { width: w, height: h, pageHeight, orientation } = await sharp(data, input).metadata()
    // -> An animation is stacked frame over frame, so its height as a whole is every frame's together
    const frameHeight = pageHeight || h
    original =
      w && frameHeight
        ? orientation && orientation >= 5
          ? { width: frameHeight, height: w }
          : { width: w, height: frameHeight }
        : null
  } catch (err: any) {
    WIKI.logger.debug(`Could not read an image to resize: ${err.message}`)
    original = null
  }
  if (!original) {
    throw new CustomError('imageResizeUnreadable', 'This image could not be read.', 422)
  }
  if (width > original.width || height > original.height) {
    throw new CustomError(
      'imageResizeEnlarge',
      `An image can only be made smaller: this one is ${original.width} × ${original.height}.`
    )
  }

  try {
    let pipeline = sharp(data, input).resize(width, height, { fit: 'fill' })
    if (format === 'jpeg') {
      // -> JPEG has no alpha channel, and dropping one leaves whatever was transparent black
      pipeline = pipeline.flatten({ background: '#ffffff' })
    }
    return await pipeline.toFormat(format, lossyFormats.has(format) ? { quality } : {}).toBuffer()
  } catch (err: any) {
    WIKI.logger.warn(`Could not resize an image: ${err.message}`)
    throw new CustomError('imageResizeUnreadable', 'This image could not be resized.', 422)
  }
}
