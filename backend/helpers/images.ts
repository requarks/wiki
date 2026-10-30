/**
 * Image helpers
 *
 * What the server needs to accept an uploaded image safely — recognizing what it actually is, and
 * normalizing it when the Sharp extension is available — and to edit one when a person asks.
 */

import * as cheerio from 'cheerio'

import { CustomError } from './common.ts'

import type { AnyNode, Element } from 'domhandler'

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
 * The elements a sanitized SVG may keep: everything that draws, and nothing that runs.
 *
 * Left out on purpose: `script`; `foreignObject`, which embeds arbitrary HTML; `iframe` and the other
 * HTML that a browser will happily parse inside one; and `metadata`, which carries nothing a picture
 * needs. Animation is kept, since a spinner is a legitimate SVG — but see `animate` in
 * {@link sanitizeSvg}, which is how an attribute is rewritten to a script URL after the fact.
 *
 * Case-sensitive, as SVG is: `clipPath` and `clippath` are different elements, and only one of them
 * draws.
 */
const SVG_ELEMENTS = new Set([
  'a',
  'animate',
  'animateMotion',
  'animateTransform',
  'circle',
  'clipPath',
  'defs',
  'desc',
  'ellipse',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'filter',
  'g',
  'image',
  'line',
  'linearGradient',
  'marker',
  'mask',
  'mpath',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'set',
  'stop',
  'style',
  'svg',
  'switch',
  'symbol',
  'text',
  'textPath',
  'title',
  'tspan',
  'use',
  'view'
])

/**
 * The attributes a sanitized SVG may keep. Every one of them names a length, a colour, a keyword, a
 * reference to another element or a number — except the two that carry a URL, `href` and
 * `xlink:href`, which {@link isSafeSvgUrl} decides separately. No `on*` handler is in the list, which
 * is the point of having a list rather than a set of things to remove.
 *
 * `style`, and the `<style>` element, are kept: drawing tools style by class, and an SVG stripped of
 * its stylesheet is a black silhouette. A stylesheet cannot run script in any browser that matters.
 */
const SVG_ATTRIBUTES = new Set([
  'accumulate',
  'additive',
  'alignment-baseline',
  'amplitude',
  'attributeName',
  'attributeType',
  'azimuth',
  'baseFrequency',
  'baseline-shift',
  'baseProfile',
  'begin',
  'bias',
  'by',
  'calcMode',
  'class',
  'clip',
  'clip-path',
  'clip-rule',
  'clipPathUnits',
  'color',
  'color-interpolation',
  'color-interpolation-filters',
  'cx',
  'cy',
  'd',
  'diffuseConstant',
  'direction',
  'display',
  'divisor',
  'dominant-baseline',
  'dur',
  'dx',
  'dy',
  'edgeMode',
  'elevation',
  'end',
  'exponent',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'filterUnits',
  'flood-color',
  'flood-opacity',
  'font-family',
  'font-size',
  'font-size-adjust',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'fr',
  'from',
  'fx',
  'fy',
  'gradientTransform',
  'gradientUnits',
  'height',
  'href',
  'id',
  'image-rendering',
  'in',
  'in2',
  'intercept',
  'isolation',
  'k1',
  'k2',
  'k3',
  'k4',
  'kernelMatrix',
  'kernelUnitLength',
  'keyPoints',
  'keySplines',
  'keyTimes',
  'lang',
  'lengthAdjust',
  'letter-spacing',
  'lighting-color',
  'limitingConeAngle',
  'marker-end',
  'marker-mid',
  'marker-start',
  'markerHeight',
  'markerUnits',
  'markerWidth',
  'mask',
  'maskContentUnits',
  'maskUnits',
  'max',
  'media',
  'method',
  'min',
  'mix-blend-mode',
  'mode',
  'numOctaves',
  'offset',
  'opacity',
  'operator',
  'order',
  'orient',
  'overflow',
  'paint-order',
  'path',
  'pathLength',
  'patternContentUnits',
  'patternTransform',
  'patternUnits',
  'points',
  'pointsAtX',
  'pointsAtY',
  'pointsAtZ',
  'preserveAlpha',
  'preserveAspectRatio',
  'primitiveUnits',
  'r',
  'radius',
  'refX',
  'refY',
  'repeatCount',
  'repeatDur',
  'restart',
  'result',
  'role',
  'rotate',
  'rx',
  'ry',
  'scale',
  'seed',
  'shape-rendering',
  'side',
  'slope',
  'spacing',
  'specularConstant',
  'specularExponent',
  'spreadMethod',
  'startOffset',
  'stdDeviation',
  'stitchTiles',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'style',
  'surfaceScale',
  'systemLanguage',
  'tableValues',
  'target',
  'targetX',
  'targetY',
  'text-anchor',
  'text-decoration',
  'text-rendering',
  'textLength',
  'to',
  'transform',
  'transform-origin',
  'type',
  'unicode-bidi',
  'values',
  'vector-effect',
  'version',
  'viewBox',
  'visibility',
  'width',
  'word-spacing',
  'writing-mode',
  'x',
  'x1',
  'x2',
  'xChannelSelector',
  'xlink:href',
  'xlink:title',
  'xml:lang',
  'xml:space',
  'xmlns',
  'xmlns:xlink',
  'y',
  'y1',
  'y2',
  'yChannelSelector',
  'z',
  'zoomAndPan'
])

/**
 * What kind of node this is, as a string: domhandler types it with an enum from a package this
 * workspace does not depend on directly, and in XML mode every element is a `tag` — never the
 * `script` and `style` kinds an HTML parse gives those two.
 */
function nodeType(node: AnyNode): string {
  return node.type as string
}

function isElement(node: AnyNode): node is Element {
  return nodeType(node) === 'tag'
}

/** The bitmap formats an `image` or `feImage` may carry inline as a `data:` URL. */
const SVG_INLINE_BITMAP = /^data:image\/(?:png|jpeg|gif|webp)[;,]/

/**
 * Whether a URL in an SVG may stay: a reference to an element in the same document, a relative or web
 * address, a `mailto:` on a link, and an inline bitmap on an image. Nothing else — `javascript:` above
 * all, and a `data:` document, which is a second SVG that was never looked at.
 *
 * Read the way a browser reads it, which drops whitespace and control characters before it decides
 * what the scheme is: `java&#9;script:` is `javascript:` by then. The parser has already decoded the
 * entity, so what is left to undo is the characters it stood for.
 */
function isSafeSvgUrl(value: string, element: string): boolean {
  // oxlint-disable-next-line no-control-regex
  const url = value.replaceAll(/[\u0000- \u007f]/g, '').toLowerCase()
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(url)?.[1]
  if (!scheme) {
    return true
  }
  if (scheme === 'http' || scheme === 'https') {
    return true
  }
  if (scheme === 'mailto') {
    return element === 'a'
  }
  return (element === 'image' || element === 'feImage') && SVG_INLINE_BITMAP.test(url)
}

/**
 * An uploaded SVG with everything that could run taken out, or null if it is not an SVG at all.
 *
 * What the security settings' **Scan and Sanitize SVG Uploads** (`uploadScanSVG`) does to an upload.
 * An SVG is a document: shown through an `<img>` it is inert, but opened at its own URL a browser
 * runs whatever scripts it holds, in this origin, as whoever is signed in. So this keeps what draws
 * and drops the rest, against lists of what is allowed rather than of what is known to be dangerous —
 * an element, an attribute or a URL scheme nobody thought of is dropped by default.
 *
 * Parsed as XML and written back out by the same serializer, which escapes every text node it writes.
 * That is the reason this is a walk over a parsed document rather than a pass through `sanitize-html`:
 * that library writes the contents of a `<style>` out exactly as it found them, so a `]]>` inside a
 * CDATA section in one can close the element and open a `<script>`.
 *
 * Everything outside the root element goes — an XML declaration, a doctype (whose internal subset the
 * parser does not understand, and leaves behind as stray text that would make the file invalid),
 * comments and processing instructions. The root must be an `svg`.
 */
export function sanitizeSvg(data: Buffer): Buffer | null {
  const $ = cheerio.load(data.toString('utf8'), { xml: true })
  const root = $.root()
    .contents()
    .filter((_, node) => isElement(node) && node.name === 'svg')
  if (root.length !== 1) {
    return null
  }
  $.root().contents().not(root).remove()

  /** Keep what draws and drop the rest, in an element already allowed, and everything below it. */
  const clean = (element: Element) => {
    for (const [name, value] of Object.entries(element.attribs)) {
      const allowed =
        name === 'href' || name === 'xlink:href'
          ? isSafeSvgUrl(value, element.name)
          : SVG_ATTRIBUTES.has(name) || name.startsWith('aria-')
      if (!allowed) {
        delete element.attribs[name]
      }
    }
    // -> A copy, since removing a node takes it out of the array being walked
    for (const node of element.children.slice()) {
      if (nodeType(node) === 'text' || nodeType(node) === 'cdata') {
        continue
      }
      /*
        An animation sets an attribute of its target to a value of its own, and an attribute it sets
        is one nothing here ever looked at: `<animate attributeName="href" to="javascript:…">` on a
        link is a script URL put back after the link was cleaned. Nothing legitimate animates a URL.
      */
      if (
        !isElement(node) ||
        !SVG_ELEMENTS.has(node.name) ||
        ((node.name === 'animate' || node.name === 'set') &&
          /href/i.test(node.attribs.attributeName ?? ''))
      ) {
        $(node).remove()
        continue
      }
      clean(node)
    }
  }
  clean(root[0] as Element)

  return Buffer.from($.xml(), 'utf8')
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
 * An SVG is rasterized, which is the one way to get it in front of a reader whose client will not
 * draw one. It has no size of its own to stay within, so it is drawn at whatever density fills the
 * box rather than at its nominal size — a logo written as a 24-pixel icon would otherwise come out
 * 24 pixels wide. It is sanitized first, so that the renderer only ever sees what draws.
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
    let input: { density?: number } = {}
    if (detectSvg(data)) {
      const sanitized = sanitizeSvg(data)
      if (!sanitized) {
        return null
      }
      data = sanitized
      // -> Measured at the default 72 DPI, then drawn at the density that brings it to the box: the
      //    smaller ratio for `inside`, the larger for `cover`, which crops the rest
      const { width: w, height: h } = await sharp(data).metadata()
      if (w && h) {
        const scale = (fit === 'inside' ? Math.min : Math.max)(width / w, height / h)
        input = { density: Math.min(Math.max(72 * scale, 1), 100000) }
      }
    }
    const resized = sharp(data, input).resize(width, height, {
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
 * The raster formats an edited image can be saved AS, keyed by the file extension that names each one.
 *
 * The extension decides rather than the source: a file is served as the type its name says, so a
 * `photo.png` saved as `photo.jpg` has to actually be a JPEG afterwards.
 */
export const editableFormats = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  gif: 'gif'
} as const

export type EditableFormat = (typeof editableFormats)[keyof typeof editableFormats]

/** The formats that honour a quality setting. PNG and GIF are lossless, and ignore one. */
const lossyFormats = new Set<EditableFormat>(['jpeg', 'webp'])

/** The most pixels an edit may hold at once: 400 MB as RGBA, since it is held raw while it runs. */
const MAX_EDIT_PIXELS = 100_000_000

/** The longest side an edit may produce. WebP's own limit, which is the tightest of the four formats. */
const MAX_EDIT_SIDE = 16383

/** A rectangle of an image, in its pixels. */
export type ImageRegion = {
  left: number
  top: number
  width: number
  height: number
}

/**
 * One step of an image edit. Each applies to the image as the steps before it left it.
 *
 * A `background` is any colour string Sharp accepts; the editor sends `#rrggbbaa`.
 */
export type ImageOperation =
  | { op: 'rotate'; angle: number; background?: string }
  | { op: 'flip' }
  | { op: 'flop' }
  | ({ op: 'crop' } & ImageRegion)
  | { op: 'resize'; width: number; height: number }
  | { op: 'extend'; top: number; right: number; bottom: number; left: number; background: string }
  | ({
      op: 'redact'
      style: 'fill' | 'pixelate' | 'blur'
      /** The fill, for `fill`. */
      color?: string
      /** The block size for `pixelate`, the blur's sigma for `blur`. */
      size?: number
    } & ImageRegion)

/**
 * The colour settings applied after every operation, in this order. Each matches the CSS filter
 * function of the same name, which is what the editor previews them with.
 */
export type ImageAdjust = {
  brightness: number
  contrast: number
  saturation: number
  grayscale: boolean
  sharpen: boolean
}

/** Settings that change nothing. */
export const NEUTRAL_ADJUST: ImageAdjust = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  grayscale: false,
  sharpen: false
}

/** What an image is edited with, and how it is encoded afterwards. */
export type ImageEdit = {
  operations: ImageOperation[]
  adjust: ImageAdjust
  format: EditableFormat
  /** 1 to 100. Only consulted for a lossy format. */
  quality: number
}

/** An edited image, with the size it came out at. */
export type EditedImage = {
  data: Buffer
  width: number
  height: number
}

/** The image being edited, between steps: raw RGBA, always four channels. */
type RawImage = {
  data: Buffer
  width: number
  height: number
}

const TRANSPARENT = '#00000000'

/**
 * Whether images can be edited on this server, which is whether the Sharp extension is installed and
 * this process has not already failed to load it.
 */
export async function isImageEditingAvailable(): Promise<boolean> {
  const definition = WIKI.models.extensions.getDefinition('sharp')
  return Boolean(
    definition &&
    !WIKI.models.extensions.hasLoadFailed(definition) &&
    (await WIKI.models.extensions.isInstalled(definition))
  )
}

/**
 * Load Sharp for something a person asked for, where a missing Sharp is an error to show them rather
 * than a reason to quietly keep the original bytes.
 *
 * @throws `imageEditSharpMissing` (503)
 */
async function loadSharpForEdit(): Promise<any> {
  const definition = WIKI.models.extensions.getDefinition('sharp')
  if (!definition || !(await WIKI.models.extensions.isInstalled(definition))) {
    throw new CustomError(
      'imageEditSharpMissing',
      'Editing an image needs the Sharp extension, which is not installed on this server. An administrator can install it under Administration → Extensions.',
      503
    )
  }
  const specifier = 'sharp'
  try {
    const { default: sharp } = await import(specifier)
    return sharp
  } catch (err: any) {
    WIKI.models.extensions.noteLoadFailure(specifier)
    WIKI.logger.warn(`Could not load Sharp to edit an image: ${err.message}`)
    throw new CustomError(
      'imageEditSharpMissing',
      'Editing an image needs the Sharp extension, which could not be loaded on this server. An administrator can reinstall it under Administration → Extensions, then restart the server.',
      503
    )
  }
}

/**
 * How many frames an image has: more than one for an animated GIF or WebP, one for anything else.
 * Read from the header alone, for the editor to warn that only the first one is edited.
 *
 * @throws `imageEditSharpMissing` (503) or `imageEditUnreadable` (422)
 */
export async function countImageFrames(data: Buffer): Promise<number> {
  const sharp = await loadSharpForEdit()
  try {
    const { pages } = await sharp(data).metadata()
    return pages || 1
  } catch (err: any) {
    WIKI.logger.debug(`Could not read an image to count its frames: ${err.message}`)
    throw new CustomError('imageEditUnreadable', 'This image could not be read.', 422)
  }
}

/** A pipeline over the raw image. */
function fromRaw(sharp: any, image: RawImage): any {
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
}

/** Run a pipeline to raw pixels, which is what every step hands to the next. */
async function toRaw(pipeline: any): Promise<RawImage> {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/**
 * The size a rotation leaves an image at.
 *
 * Sharp grows the canvas to hold the rotated picture, and rounds each side to the nearest pixel — the
 * editor predicts the same, so that a crop it works out after a rotation fits.
 */
function rotatedSize(
  width: number,
  height: number,
  angle: number
): { width: number; height: number } {
  const quarterTurns = ((angle % 360) + 360) % 360
  if (quarterTurns % 90 === 0) {
    return quarterTurns % 180 === 0 ? { width, height } : { width: height, height: width }
  }
  const rad = (angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    width: Math.round(width * cos + height * sin),
    height: Math.round(width * sin + height * cos)
  }
}

/**
 * Refuse an operation that cannot apply to an image of this size, before any pixel is touched.
 *
 * @param index Where the operation is in the list, which is what the message names
 * @returns The size the operation leaves the image at
 * @throws `imageEditInvalid` or `imageResizeEnlarge` (400), or `imageEditTooLarge` (422)
 */
function checkOperation(
  op: ImageOperation,
  index: number,
  current: { width: number; height: number }
): { width: number; height: number } {
  const invalid = (message: string) =>
    new CustomError('imageEditInvalid', `Edit ${index + 1} (${op.op}): ${message}`)
  let next = current
  switch (op.op) {
    case 'crop':
    case 'redact':
      if (op.left + op.width > current.width || op.top + op.height > current.height) {
        throw invalid(
          `the region has to lie inside the image, which is ${current.width} × ${current.height} at this point.`
        )
      }
      if (op.op === 'crop') {
        next = { width: op.width, height: op.height }
      }
      break
    case 'resize':
      if (op.width > current.width || op.height > current.height) {
        throw new CustomError(
          'imageResizeEnlarge',
          `An image can only be made smaller: this one is ${current.width} × ${current.height}.`
        )
      }
      next = { width: op.width, height: op.height }
      break
    case 'rotate':
      next = rotatedSize(current.width, current.height, op.angle)
      break
    case 'extend':
      next = {
        width: current.width + op.left + op.right,
        height: current.height + op.top + op.bottom
      }
      break
  }
  if (
    next.width > MAX_EDIT_SIDE ||
    next.height > MAX_EDIT_SIDE ||
    next.width * next.height > MAX_EDIT_PIXELS
  ) {
    throw new CustomError(
      'imageEditTooLarge',
      `Edit ${index + 1} (${op.op}) would make the image too large to edit.`,
      422
    )
  }
  return next
}

/** Apply one operation. */
async function applyOperation(sharp: any, image: RawImage, op: ImageOperation): Promise<RawImage> {
  switch (op.op) {
    case 'rotate':
      return toRaw(
        fromRaw(sharp, image).rotate(op.angle, { background: op.background ?? TRANSPARENT })
      )
    case 'flip':
      return toRaw(fromRaw(sharp, image).flip())
    case 'flop':
      return toRaw(fromRaw(sharp, image).flop())
    case 'crop':
      return toRaw(
        fromRaw(sharp, image).extract({
          left: op.left,
          top: op.top,
          width: op.width,
          height: op.height
        })
      )
    case 'resize':
      return toRaw(fromRaw(sharp, image).resize(op.width, op.height, { fit: 'fill' }))
    case 'extend':
      return toRaw(
        fromRaw(sharp, image).extend({
          top: op.top,
          right: op.right,
          bottom: op.bottom,
          left: op.left,
          background: op.background
        })
      )
    case 'redact': {
      const region = { left: op.left, top: op.top, width: op.width, height: op.height }
      let patch: RawImage
      if (op.style === 'fill') {
        patch = await toRaw(
          sharp({
            create: {
              width: op.width,
              height: op.height,
              channels: 4,
              background: op.color ?? '#000000'
            }
          })
        )
      } else {
        const cut = await toRaw(fromRaw(sharp, image).extract(region))
        if (op.style === 'pixelate') {
          // -> Shrunk to one pixel per block, then blown back up without smoothing
          const size = op.size ?? 16
          const blocks = await toRaw(
            fromRaw(sharp, cut).resize(Math.ceil(op.width / size), Math.ceil(op.height / size), {
              fit: 'fill'
            })
          )
          patch = await toRaw(
            fromRaw(sharp, blocks).resize(op.width, op.height, { fit: 'fill', kernel: 'nearest' })
          )
        } else {
          patch = await toRaw(fromRaw(sharp, cut).blur(op.size ?? 20))
        }
      }
      // -> The region is punched out before the patch goes in, since a half-transparent patch laid
      //    over the original would let what it is hiding show through. Not the `source` blend, which
      //    would do this in one step but clears everything OUTSIDE the patch as well.
      return toRaw(
        fromRaw(sharp, image).composite([
          {
            input: {
              create: { width: op.width, height: op.height, channels: 4, background: '#000000' }
            },
            left: op.left,
            top: op.top,
            blend: 'dest-out'
          },
          {
            input: patch.data,
            raw: { width: patch.width, height: patch.height, channels: 4 },
            left: op.left,
            top: op.top
          }
        ])
      )
    }
  }
}

/**
 * The CSS `saturate()` matrix, from the Filter Effects spec. `grayscale(1)` is its own, nearly
 * identical, matrix there, and is kept apart so that each matches the function the editor previews it
 * with.
 */
function saturateMatrix(s: number): number[][] {
  return [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]
  ]
}

const GRAYSCALE_MATRIX = [
  [0.2126, 0.7152, 0.0722],
  [0.2126, 0.7152, 0.0722],
  [0.2126, 0.7152, 0.0722]
]

/**
 * Apply the colour settings.
 *
 * One pass per setting rather than one pipeline: a browser clamps between filter functions, and two
 * `linear()` calls in one Sharp pipeline would be one, the second replacing the first. `linear` and
 * `recomb` leave the alpha channel alone.
 */
async function applyAdjust(sharp: any, image: RawImage, adjust: ImageAdjust): Promise<RawImage> {
  if (adjust.brightness !== 1) {
    image = await toRaw(fromRaw(sharp, image).linear(adjust.brightness, 0))
  }
  if (adjust.contrast !== 1) {
    image = await toRaw(
      fromRaw(sharp, image).linear(adjust.contrast, 127.5 * (1 - adjust.contrast))
    )
  }
  if (adjust.saturation !== 1) {
    image = await toRaw(fromRaw(sharp, image).recomb(saturateMatrix(adjust.saturation)))
  }
  if (adjust.grayscale) {
    image = await toRaw(fromRaw(sharp, image).recomb(GRAYSCALE_MATRIX))
  }
  if (adjust.sharpen) {
    image = await toRaw(fromRaw(sharp, image).sharpen())
  }
  return image
}

/**
 * Edit an image, using the Sharp extension.
 *
 * Something a person asked for, so there is no quiet fallback to the original bytes: every way it can
 * fail is thrown as an error the caller can show them.
 *
 * **Only the first frame of an animation is ever read**, and the result is a still. Editing every
 * frame means holding every frame, and a GIF of a few thousand large frames is easily made and cheap
 * to upload; the editor warns before anyone gets here. Read with `animated: true` Sharp would hand over
 * the whole strip of frames anyway, and get half of these operations wrong on it — a quarter turn is
 * refused, `flip` reverses the frames, `composite` draws on the first only.
 *
 * Each operation is its own pass over raw pixels, since Sharp does not apply one pipeline in the order
 * its methods are called, and the image is only encoded at the end.
 *
 * Positions and sizes are in the image as a viewer sees it — after EXIF orientation, which is applied
 * as it is decoded. Decoding also converts an embedded colour profile to sRGB, which is what the
 * result is written in.
 *
 * @throws `imageEditSharpMissing` (503), `imageEditUnreadable` (422), `imageEditTooLarge` (422),
 *         `imageEditInvalid` (400) or `imageResizeEnlarge` (400)
 */
export async function editImage(
  data: Buffer,
  { operations, adjust, format, quality }: ImageEdit
): Promise<EditedImage> {
  const sharp = await loadSharpForEdit()

  // -> Without `animated`, the size is the first frame's, and so is everything decoded below
  let meta: any
  try {
    meta = await sharp(data).metadata()
  } catch (err: any) {
    WIKI.logger.debug(`Could not read an image to edit: ${err.message}`)
    throw new CustomError('imageEditUnreadable', 'This image could not be read.', 422)
  }
  // -> An EXIF orientation of 5 or above turns the picture a quarter turn as it is decoded
  const size =
    meta.orientation && meta.orientation >= 5
      ? { width: meta.height, height: meta.width }
      : { width: meta.width, height: meta.height }
  if (!size.width || !size.height) {
    throw new CustomError('imageEditUnreadable', 'This image could not be read.', 422)
  }
  if (size.width * size.height > MAX_EDIT_PIXELS) {
    throw new CustomError('imageEditTooLarge', 'This image is too large to edit.', 422)
  }

  // -> Every operation is checked against the size the ones before it leave, before any pixel moves:
  //    a list that fails at its tenth step should not cost nine steps' work to find out
  let checked = size
  for (const [index, op] of operations.entries()) {
    checked = checkOperation(op, index, checked)
  }

  try {
    let image = await toRaw(sharp(data, { autoOrient: true }))
    for (const op of operations) {
      image = await applyOperation(sharp, image, op)
    }
    image = await applyAdjust(sharp, image, adjust)

    let pipeline = fromRaw(sharp, image)
    if (format === 'jpeg') {
      // -> JPEG has no alpha channel, and dropping one leaves whatever was transparent black
      pipeline = pipeline.flatten({ background: '#ffffff' })
    } else if ((await pipeline.clone().stats()).isOpaque) {
      // -> Held with an alpha channel throughout; one that ended up fully opaque is not written with
      //    it, so an opaque PNG does not come out a third larger for nothing
      pipeline = pipeline.removeAlpha()
    }
    return {
      data: await pipeline.toFormat(format, lossyFormats.has(format) ? { quality } : {}).toBuffer(),
      width: image.width,
      height: image.height
    }
  } catch (err: any) {
    WIKI.logger.warn(`Could not edit an image: ${err.message}`)
    throw new CustomError('imageEditUnreadable', 'This image could not be edited.', 422)
  }
}
