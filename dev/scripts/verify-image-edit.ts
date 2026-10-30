/**
 * Verify the image editor's server side (`editImage` in backend/helpers/images.ts) against a plain
 * reference implementation, pixel by pixel. See dev/specs/image-editor.md.
 *
 *   node dev/scripts/verify-image-edit.ts
 *
 * Needs Sharp installed in backend/. Stands in for the parts of the `WIKI` global the helper reads, so
 * no database or running instance is involved.
 */

import { createRequire } from 'node:module'

import { editImage, NEUTRAL_ADJUST } from '../../backend/helpers/images.ts'
import type { ImageOperation } from '../../backend/helpers/images.ts'

const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const sharp = require('sharp')

;(globalThis as any).WIKI = {
  models: {
    extensions: {
      getDefinition: () => ({ key: 'sharp', detect: { type: 'module', value: 'sharp' } }),
      isInstalled: async () => true,
      hasLoadFailed: () => false,
      noteLoadFailure: () => {}
    }
  },
  logger: { debug: () => {}, warn: console.warn }
}

type Raster = { width: number; height: number; px: number[][] }

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) {
    failures++
  }
}

/** A picture where every pixel is a different colour, so any misplaced one shows. */
function uniqueRaster(width: number, height: number): Raster {
  const px: number[][] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      px.push([x * 30 + 10, y * 40 + 10, (x + y * width) * 7, 255])
    }
  }
  return { width, height, px }
}

async function toPng(r: Raster): Promise<Buffer> {
  return sharp(Buffer.from(r.px.flat()), {
    raw: { width: r.width, height: r.height, channels: 4 }
  })
    .png()
    .toBuffer()
}

async function fromImage(data: Buffer, page = 0): Promise<Raster> {
  const { data: raw, info } = await sharp(data, { page })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const px: number[][] = []
  for (let i = 0; i < raw.length; i += 4) {
    px.push([raw[i], raw[i + 1], raw[i + 2], raw[i + 3]])
  }
  return { width: info.width, height: info.height, px }
}

/** The reference: each operation written out by hand on a pixel array. */
function reference(r: Raster, op: ImageOperation): Raster {
  const at = (x: number, y: number) => r.px[y * r.width + x]
  const build = (width: number, height: number, f: (x: number, y: number) => number[]) => {
    const px: number[][] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        px.push(f(x, y))
      }
    }
    return { width, height, px }
  }
  switch (op.op) {
    case 'rotate':
      if (op.angle === 90) {
        return build(r.height, r.width, (x, y) => at(y, r.height - 1 - x))
      }
      if (op.angle === -90) {
        return build(r.height, r.width, (x, y) => at(r.width - 1 - y, x))
      }
      if (op.angle === 180) {
        return build(r.width, r.height, (x, y) => at(r.width - 1 - x, r.height - 1 - y))
      }
      throw new Error('the reference only rotates by quarter turns')
    case 'flip':
      return build(r.width, r.height, (x, y) => at(x, r.height - 1 - y))
    case 'flop':
      return build(r.width, r.height, (x, y) => at(r.width - 1 - x, y))
    case 'crop':
      return build(op.width, op.height, (x, y) => at(x + op.left, y + op.top))
    case 'extend': {
      const bg = hex(op.background)
      return build(r.width + op.left + op.right, r.height + op.top + op.bottom, (x, y) => {
        const sx = x - op.left
        const sy = y - op.top
        return sx >= 0 && sy >= 0 && sx < r.width && sy < r.height ? at(sx, sy) : bg
      })
    }
    case 'redact': {
      if (op.style !== 'fill') {
        throw new Error('the reference only redacts with a fill')
      }
      const fill = hex(op.color ?? '#000000')
      return build(r.width, r.height, (x, y) =>
        x >= op.left && y >= op.top && x < op.left + op.width && y < op.top + op.height
          ? fill
          : at(x, y)
      )
    }
    default:
      throw new Error(`no reference for ${op.op}`)
  }
}

function hex(color: string): number[] {
  const v = color.slice(1)
  return [0, 2, 4, 6].map((i) => (i < v.length ? Number.parseInt(v.slice(i, i + 2), 16) : 255))
}

function firstDifference(a: Raster, b: Raster): string {
  if (a.width !== b.width || a.height !== b.height) {
    return `size ${a.width}×${a.height}, expected ${b.width}×${b.height}`
  }
  const i = a.px.findIndex((p, n) => p.some((c, k) => c !== b.px[n][k]))
  return i < 0
    ? ''
    : `pixel (${i % a.width}, ${Math.floor(i / a.width)}) is ${a.px[i]}, expected ${b.px[i]}`
}

// -> Order matters in every one of these: a pipeline that reordered them would fail
const sequences: Array<[string, ImageOperation[]]> = [
  [
    'rotate → crop → mirror',
    [
      { op: 'rotate', angle: 90 },
      { op: 'crop', left: 1, top: 2, width: 3, height: 4 },
      { op: 'flop' }
    ]
  ],
  [
    'crop → rotate → flip',
    [
      { op: 'crop', left: 1, top: 0, width: 5, height: 3 },
      { op: 'rotate', angle: -90 },
      { op: 'flip' }
    ]
  ],
  [
    'flip → rotate 180 → extend → redact',
    [
      { op: 'flip' },
      { op: 'rotate', angle: 180 },
      { op: 'extend', top: 1, right: 2, bottom: 0, left: 3, background: '#ff00ff' },
      { op: 'redact', left: 2, top: 1, width: 3, height: 2, style: 'fill', color: '#123456' }
    ]
  ]
]

const source = uniqueRaster(7, 5)
for (const [name, operations] of sequences) {
  const expected = operations.reduce(reference, source)
  const edited = await editImage(await toPng(source), {
    operations,
    adjust: NEUTRAL_ADJUST,
    format: 'png',
    quality: 100
  })
  const actual = await fromImage(edited.data)
  const diff = firstDifference(actual, expected)
  check(name, !diff, diff)
  check(
    `${name}: reported size`,
    edited.width === expected.width && edited.height === expected.height
  )
}

// -> Pixelate and blur have no exact reference, but must leave everything outside the region alone
for (const style of ['pixelate', 'blur'] as const) {
  const region = { left: 2, top: 1, width: 4, height: 3 }
  const edited = await editImage(await toPng(source), {
    operations: [{ op: 'redact', style, size: 2, ...region }],
    adjust: NEUTRAL_ADJUST,
    format: 'png',
    quality: 100
  })
  const actual = await fromImage(edited.data)
  const inside = (n: number) => {
    const x = n % source.width
    const y = Math.floor(n / source.width)
    return (
      x >= region.left &&
      y >= region.top &&
      x < region.left + region.width &&
      y < region.top + region.height
    )
  }
  const outsideKept = actual.px.every((p, n) => inside(n) || String(p) === String(source.px[n]))
  const insideChanged = actual.px.some((p, n) => inside(n) && String(p) !== String(source.px[n]))
  check(`${style}: only the region changes`, outsideKept && insideChanged)
}

// -> An animation: only its first frame is read, and a still comes out even when saved as GIF
{
  const colours = ['#ff0000', '#00ff00', '#0000ff']
  const frames = await Promise.all(
    colours.map((background) =>
      sharp({ create: { width: 8, height: 4, channels: 4, background } })
        .png()
        .toBuffer()
    )
  )
  const gif = await sharp(frames, { join: { animated: true } })
    .gif({ delay: [100, 200, 300], loop: 2 })
    .toBuffer()
  const edited = await editImage(gif, {
    operations: [
      { op: 'rotate', angle: 90 },
      { op: 'flip' },
      { op: 'redact', left: 0, top: 0, width: 2, height: 2, style: 'fill', color: '#ffffff' }
    ],
    adjust: NEUTRAL_ADJUST,
    format: 'gif',
    quality: 100
  })
  const meta = await sharp(edited.data, { animated: true }).metadata()
  check('animation: one frame comes out', (meta.pages ?? 1) === 1, `${meta.pages ?? 1} frames`)
  check(
    'animation: the first frame, rotated',
    meta.width === 4 && meta.height === 8,
    `${meta.width}×${meta.height}`
  )
  const frame = await fromImage(edited.data)
  const centre = frame.px[4 * 4 + 2].slice(0, 3)
  const corner = frame.px[0].slice(0, 3)
  check(
    'animation: the first frame, redacted',
    String(centre) === '255,0,0' && String(corner) === '255,255,255',
    `centre ${centre}, corner ${corner}`
  )
}

// -> A rotation by any other angle: the size the editor predicts is the size Sharp makes
for (const [w, h, angle] of [
  [40, 20, 15],
  [641, 480, -2.5],
  [100, 37, 44.9]
]) {
  const png = await sharp({ create: { width: w, height: h, channels: 4, background: '#f00' } })
    .png()
    .toBuffer()
  const edited = await editImage(png, {
    operations: [{ op: 'rotate', angle }],
    adjust: NEUTRAL_ADJUST,
    format: 'png',
    quality: 100
  })
  const rad = (angle * Math.PI) / 180
  const ew = Math.round(w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad)))
  const eh = Math.round(w * Math.abs(Math.sin(rad)) + h * Math.abs(Math.cos(rad)))
  check(
    `rotate ${w}×${h} by ${angle}°`,
    edited.width === ew && edited.height === eh,
    `${edited.width}×${edited.height}, predicted ${ew}×${eh}`
  )
}

// -> Refusals, before any pixel is touched
for (const [name, operations, code] of [
  [
    'crop outside the image',
    [
      { op: 'rotate', angle: 90 },
      { op: 'crop', left: 0, top: 0, width: 7, height: 5 }
    ],
    'imageEditInvalid'
  ],
  ['resize larger', [{ op: 'resize', width: 8, height: 5 }], 'imageResizeEnlarge'],
  [
    'extend past the size limit',
    [{ op: 'extend', top: 0, right: 16380, bottom: 0, left: 0, background: '#000' }],
    'imageEditTooLarge'
  ]
] as Array<[string, ImageOperation[], string]>) {
  try {
    await editImage(await toPng(source), {
      operations,
      adjust: NEUTRAL_ADJUST,
      format: 'png',
      quality: 100
    })
    check(`refuses ${name}`, false, 'was not refused')
  } catch (err: any) {
    check(`refuses ${name}`, err.name === code, `${err.name}: ${err.message}`)
  }
}

// -> An opaque result is written without an alpha channel; a transparent one keeps it
{
  const opaque = await editImage(await toPng(source), {
    operations: [{ op: 'flop' }],
    adjust: NEUTRAL_ADJUST,
    format: 'png',
    quality: 100
  })
  const padded = await editImage(await toPng(source), {
    operations: [{ op: 'extend', top: 1, right: 1, bottom: 1, left: 1, background: '#00000000' }],
    adjust: NEUTRAL_ADJUST,
    format: 'png',
    quality: 100
  })
  check('opaque PNG has no alpha', (await sharp(opaque.data).metadata()).channels === 3)
  check('transparent PNG keeps alpha', (await sharp(padded.data).metadata()).channels === 4)
}

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exitCode = failures ? 1 : 0
