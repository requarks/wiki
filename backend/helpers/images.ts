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
