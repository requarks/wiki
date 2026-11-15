/**
 * Verify that `sanitizeFileName` (backend/models/assets.ts) is idempotent.
 *
 *   node dev/scripts/verify-file-names.ts
 *
 * The asset routes check the page rules against the sanitized name and the models sanitize it again
 * on the way to storage, so a second pass that changed anything would store a name the rules were
 * never asked about. No database or running instance is involved.
 */

import { MAX_PATH_SEGMENT_BYTES } from '../../backend/helpers/common.ts'
import { sanitizeFileName } from '../../backend/models/assets.ts'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) {
    failures++
  }
}

function idempotent(input: string): { ok: boolean; once: string; twice: string } {
  const once = sanitizeFileName(input)
  const twice = sanitizeFileName(once)
  return { ok: once === twice, once, twice }
}

// -> What each input is stored as. The first four are the bypass: each used to sanitize to
//    `brand..png` and then, on the model's pass, to `brand.png`
const expected: [string, string][] = [
  ['brand. .png', 'brand.png'],
  ['brand.-.png', 'brand.png'],
  ['brand._.png', 'brand.png'],
  ['logo.-.png', 'logo.png'],
  ['a-.-.png', 'a.png'],
  ['my.file.name.png', 'my.file.name.png'],
  ['v1.2.3.tar.gz', 'v1.2.3.tar.gz'],
  ['résumé.pdf', 'résumé.pdf'],
  ['My Photo_2024.JPG', 'my-photo-2024.jpg'],
  ['../../etc/passwd', 'passwd'],
  ['..\\..\\boot.ini', 'boot.ini'],
  ['.hidden', 'hidden'],
  ['-option.txt', 'option.txt'],
  ['photo-.png', 'photo.png']
]
for (const [input, stored] of expected) {
  const result = idempotent(input)
  check(
    `${JSON.stringify(input)} → ${stored}`,
    result.ok && result.once === stored,
    `${result.once} then ${result.twice}`
  )
}

// -> The truncation cutting the stem just after a dot, which one pass alone leaves as `…a..png`
{
  const input = `${'a'.repeat(235)}.bcdefgh.png`
  const result = idempotent(input)
  check(
    'truncation that lands after a dot',
    result.ok &&
      !result.once.includes('..') &&
      Buffer.byteLength(result.once) <= MAX_PATH_SEGMENT_BYTES,
    `…${result.once.slice(-12)} then …${result.twice.slice(-12)}`
  )
}

// -> And anything at all: names built from the characters every rule turns on, at lengths either
//    side of the limit
{
  const alphabet = ['a', 'é', '😀', '.', '-', '_', ' ', '/', '\\', '?', 'A', '1', '́']
  let seed = 1
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  let failed: string | null = null
  for (let i = 0; i < 50000 && !failed; i++) {
    const length = 1 + Math.floor(random() * (i % 10 === 0 ? 300 : 20))
    let input = ''
    for (let j = 0; j < length; j++) {
      input += alphabet[Math.floor(random() * alphabet.length)]
    }
    const result = idempotent(input)
    const bad =
      !result.ok ||
      result.once.includes('..') ||
      /^[.-]|-$/.test(result.once) ||
      Buffer.byteLength(result.once) > MAX_PATH_SEGMENT_BYTES
    if (bad) {
      failed = `${JSON.stringify(input)} → ${JSON.stringify(result.once)} → ${JSON.stringify(result.twice)}`
    }
  }
  check('50,000 random names are fixed points after one call', !failed, failed ?? '')
}

if (failures) {
  console.log(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll checks passed')
