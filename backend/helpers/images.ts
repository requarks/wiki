/**
 * Image helpers
 *
 * Only what the server needs to accept an uploaded image safely: recognizing what it actually is, and
 * normalizing it when the Sharp extension is available.
 */

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
