/*
  Generates `src/assets/icons.generated.js` — the icon data the UI's own chrome draws with.

  Why inline the data rather than fetch it:

  - The webfonts it replaces cost ~577 kB of binary plus a 66 kB (gzipped) class table, to draw 227
    icons out of the ~8,800 those fonts contain.
  - Fetching the same icons from `/_icons` at runtime would be small, but it would make the admin UI
    depend on the icon service: resolution is gated on the set being enabled, `DELETE /icons/sets/:prefix`
    removes every stored icon for a set, and `offline` mode skips the upstream API entirely. An
    administrator disabling the `mdi` set would blank the interface they were using to do it.

  Inlining sidesteps all of that: the chrome's icons are build output, and nothing at runtime can take
  them away. Icons the USER picks still resolve through `/_icons` as before — see `WIcon`.

  The output is committed. Builds are then reproducible and need no network, and the diff shows
  exactly which icons changed. `check-icons.mjs` fails if it drifts out of step with the source.

  Usage: node scripts/generate-icons.mjs [--check]
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const SRC = path.join(ROOT, 'src')
const OUT = path.join(SRC, 'assets/icons.generated.js')

/**
 * Icon sets we bundle from. A prefix not listed here is left to resolve at runtime — which for an icon
 * written into this repo's own source means it does not render at all unless an administrator happens to
 * have added that set, so a new set has to be listed HERE and installed as `@iconify-json/<prefix>`.
 *
 * The skip is silent on purpose: `prefix:name` also describes every permission string in the frontend
 * (`write:pages`, `manage:system`), and those must not be mistaken for icons.
 */
const SETS = ['mdi', 'la']

/**
 * A quoted string that is EXACTLY an Iconify reference. Requiring the whole literal to match is what
 * keeps arbitrary `prefix:name`-shaped strings (i18n keys, CSS values) out of the bundle.
 */
const REF = /(["'`])([a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-.][a-z0-9]+)*)\1/g

/**
 * Files whose icon references are CONTENT rather than chrome, and so do not belong in this bundle.
 *
 * `sampleContent.js` is a set of pages the admin area writes into a wiki; the names in it end up in
 * the `icon` column of a page, exactly as if an author had picked them, and resolve through `/_icons`
 * like every other icon an author picks. Inlining them would put twenty-odd icons that only a
 * development instance ever draws into the bundle every reader downloads.
 */
const NOT_CHROME = new Set(['sampleContent.js'])

function* sourceFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* sourceFiles(full)
    } else if (
      /\.(vue|js)$/.test(entry.name) &&
      !entry.name.endsWith('.generated.js') &&
      !NOT_CHROME.has(entry.name)
    ) {
      yield full
    }
  }
}

/** Every statically written reference to one of the bundled sets. */
export function collectRefs() {
  const found = new Map()
  for (const file of sourceFiles(SRC)) {
    const src = fs.readFileSync(file, 'utf8')
    for (const m of src.matchAll(REF)) {
      const ref = m[2]
      if (!SETS.includes(ref.split(':')[0])) {
        continue
      }
      if (!found.has(ref)) {
        found.set(ref, [])
      }
      found.get(ref).push(path.relative(ROOT, file))
    }
  }
  return found
}

/**
 * Resolve a name against a set, following aliases.
 *
 * An alias may carry its own transform (`hFlip`, `rotate`, …) on top of the icon it points at. Those
 * are applied by the renderer, so they have to travel with the body rather than being dropped.
 */
function resolveIcon(set, name, seen = new Set()) {
  if (seen.has(name)) {
    return null
  }
  seen.add(name)
  if (set.icons[name]) {
    return { ...set.icons[name] }
  }
  const alias = set.aliases?.[name]
  if (!alias) {
    return null
  }
  const target = resolveIcon(set, alias.parent, seen)
  if (!target) {
    return null
  }
  const { parent, ...transforms } = alias
  return { ...target, ...transforms }
}

export function build() {
  const refs = collectRefs()
  const sets = Object.fromEntries(
    SETS.map((p) => [
      p,
      JSON.parse(
        fs.readFileSync(path.join(ROOT, `node_modules/@iconify-json/${p}/icons.json`), 'utf8')
      )
    ])
  )

  const icons = {}
  const missing = []
  for (const ref of [...refs.keys()].sort()) {
    const [prefix, name] = ref.split(':')
    const set = sets[prefix]
    const icon = resolveIcon(set, name)
    if (!icon) {
      missing.push({ ref, where: refs.get(ref) })
      continue
    }
    icons[ref] = {
      body: icon.body,
      // -> Default to the set's own grid; an icon may override it
      width: icon.width ?? set.width ?? 16,
      height: icon.height ?? set.height ?? 16,
      ...(icon.rotate ? { rotate: icon.rotate } : {}),
      ...(icon.hFlip ? { hFlip: true } : {}),
      ...(icon.vFlip ? { vFlip: true } : {})
    }
  }
  return { icons, missing, refs }
}

function serialize(icons) {
  const entries = Object.entries(icons)
    .map(([ref, data]) => `  ${JSON.stringify(ref)}: ${JSON.stringify(data)}`)
    .join(',\n')
  return `/*
  GENERATED by scripts/generate-icons.mjs — do not edit.

  Icon data for every Iconify reference written literally in the source, inlined so the interface
  never waits on (or depends on) the icon service. Regenerate with \`npm run icons\` after adding or
  removing an icon; \`check-icons.mjs\` fails the build if this drifts.

  ${Object.keys(icons).length} icons.
*/
export const BUNDLED_ICONS = {
${entries}
}
`
}

const { icons, missing } = build()

if (missing.length) {
  console.error(`\n${missing.length} reference(s) not found in the installed icon sets:`)
  for (const m of missing) {
    console.error(`  ${m.ref}  (${[...new Set(m.where)].join(', ')})`)
  }
  process.exit(1)
}

const output = serialize(icons)

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (current !== output) {
    console.error('icons.generated.js is out of date — run `npm run icons`')
    process.exit(1)
  }
  console.log(`OK  ${Object.keys(icons).length} icons, bundle up to date`)
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, output)
  const bytes = Buffer.byteLength(output)
  console.log(
    `wrote ${Object.keys(icons).length} icons to src/assets/icons.generated.js (${bytes.toLocaleString()} B)`
  )
}
