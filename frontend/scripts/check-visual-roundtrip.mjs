/*
  Checks that the Visual editor can open a page and write it back without changing it.

  This is the guarantee the whole editor rests on. It edits a ProseMirror document and stores markdown,
  so every save goes source → document → source; if that round trip is not faithful, opening a page and
  pressing Save damages it, and nothing else in the app would notice. The failure is silent, delayed,
  and lands on content somebody wrote.

  What is compared is the RENDER, not the text. The source is expected to come back spelled differently
  — that is what converting a page to this editor does on purpose, once, as its own history version — so
  comparing strings would fail on every case for the wrong reason. Two sources that render identically
  say the same thing, which is the property that actually matters.

  The corpus is `src/helpers/sampleContent.js`, the pages a wiki seeds itself with, plus the constructs
  below. The sample pages are the more valuable half: they are written as documentation rather than as
  tests, so they exercise the pipeline the way a real page does.

  Usage: node scripts/check-visual-roundtrip.mjs [--verbose]
  Exits non-zero on the first construct that does not survive.
*/
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const SRC = new URL('../src/', import.meta.url)

/*
  The resolutions Vite does and Node does not, so that the app's own modules can be imported here
  unchanged: the `@` alias, extensionless relative imports, and the shim for the `markdown-it/lib/*`
  subpath `markdown-it-mdc` still asks for and markdown-it 15 no longer exports. All three mirror
  `vite.config.js`, which is where they are configured for the app itself.
*/
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'markdown-it/lib/token.mjs') {
      return next(new URL('renderers/modules/markdown-it-token.js', SRC).href, context)
    }

    /*
      Anything that addresses this app's own source: the `@` alias, or a relative import from a file
      already inside it. Scoped that tightly because `registerHooks` is synchronous and so also sits in
      front of CommonJS `require`, where handing back a `file:` URL for a package's own internal
      `./patterns.js` is not something the CJS loader accepts.
    */
    const target = specifier.startsWith('@/')
      ? new URL(specifier.slice(2), SRC)
      : specifier.startsWith('.') && context.parentURL?.startsWith(SRC.href)
        ? new URL(specifier, context.parentURL)
        : null
    if (!target) {
      return next(specifier, context)
    }
    if (existsSync(fileURLToPath(target))) {
      return next(target.href, context)
    }
    // -> Extensionless, which the frontend writes throughout and Node does not resolve
    for (const ext of ['.js', '.mjs', '/index.js']) {
      const candidate = new URL(target.href + ext)
      if (existsSync(fileURLToPath(candidate))) {
        return next(candidate.href, context)
      }
    }
    return next(target.href, context)
  }
})

const { MarkdownRenderer } = await import('../src/renderers/markdown.js')
const { createParser } = await import('../src/editor/visual/parse.js')
const { serialize } = await import('../src/editor/visual/serialize.js')
const { SAMPLE_PAGES } = await import('../src/helpers/sampleContent.js')

const VERBOSE = process.argv.includes('--verbose')

/**
 * The site configurations to check under.
 *
 * Not a formality: the config decides what a token MEANS, so it decides what the parser has to build.
 * `underline` is the one that bites — with it on, `_x_` is an underline rather than an emphasis, and
 * an editor that normalised it to `*x*` would be changing the page rather than reformatting it.
 */
const CONFIGS = {
  default: {
    allowHTML: true,
    linkify: true,
    lineBreaks: true,
    multimdTable: true,
    wikiLinks: true
  },
  underline: {
    allowHTML: true,
    linkify: true,
    lineBreaks: true,
    multimdTable: true,
    underline: true,
    wikiLinks: true
  },
  plain: {
    allowHTML: true,
    linkify: false,
    lineBreaks: false,
    multimdTable: false,
    typographer: true
  }
}

/** One construct each, so a failure names the thing that broke rather than a whole page. */
const CONSTRUCTS = {
  'inline marks': 'Plain **bold**, *italic*, `code`, ~~strike~~, ==mark==, ~sub~ and ^sup^.',
  'strong around code': '**`name`** in bold',
  headings: '# One\n\n## Two {#custom .cls}',
  'setext heading': 'Title\n=====',
  links: 'A [link](https://example.com "Title") here.',
  /*
    A link's `{…}` suffix, and `target` above all: it is how both editors write "open in a new tab",
    and it went missing on every round trip until the link mark learned to carry it. Nothing here
    caught that, because there was no case for it -- which is the argument for adding one whenever a
    construct turns out to be droppable.
  */
  'link opening a new tab': 'A [new tab](https://example.com){target="_blank"} here.',
  'link with id and class': 'A [classed](https://example.com){#x .cls} here.',
  // -> A citation written as a link, which crashed the renderer before MDC's span stopped claiming
  //    the brackets inside it
  'link whose text is bracketed': 'See [[1]](https://example.com) here.',
  'link with a span in its text': 'A [text with [a span]{.x} in it](https://example.com) here.',
  'link with a title and a target': 'A [both](https://example.com "Tip"){target="_blank"} here.',
  'image with size': '![alt](pic.png =100x200)',
  // -> Both halves of the suffix are optional, and a height on its own went missing on the way back
  'image with a width only': '![alt](pic.png =100x)',
  'image with a height only': '![alt](pic.png =x200)',
  'image sized in percent': '![alt](pic.png =50%x)',
  'bullet list': '- one\n- two\n  - nested',
  'bullet list with stars': '* one\n* two',
  'ordered list': '1. one\n2. two',
  'ordered list with parens': '1) one\n2) two',
  'loose list': '- one\n\n- two',
  'task list': '- [x] done\n- [ ] todo',
  'task starting with a link': '- [ ] [a link](/somewhere) to do',
  blockquote: '> quoted\n>\n> second',
  alert: '> [!WARNING] Mind the gap\n> Body of the alert.',
  'alert without a title': '> [!NOTE]\n> Body of the note.',
  fence: '```js\nconst x = 1\n```',
  'fence with attributes': '```js title="Demo" linesStart="3"\nconst x = 1\n```',
  'indented code': '    const x = 1\n    const y = 2',
  'horizontal rule': 'above\n\n---\n\nbelow',
  table: '| A | B |\n|:--|--:|\n| 1 | 2 |',
  'table with escaped pipes': '| A | B |\n| --- | --- |\n| `a\\|b` | c |',
  'html block': '<div class="raw">HTML block</div>',
  'html inline': 'Press <kbd>Ctrl</kbd> now.',
  'emoji and icon': 'Emoji :smile: and icon :mdi:home: here.',
  footnote: 'Ref[^a] here.\n\n[^a]: The note body.',
  abbreviation: '*[HTML]: Hyper Text Markup Language\n\nHTML rocks',
  'definition list': 'Term\n: Definition one\n: Definition two',
  'inline span': 'A [span]{.cls #x} end.',
  'block with no body': '::block-map{lat="1" lng="2"}\n::',
  'block with a fenced body':
    '::block-diagram{caption="A"}\n```mermaid\nflowchart LR\n  A --> B\n```\n::',
  'block with page content': '::block-spoiler{label="Peek"}\nHidden prose here.\n::',
  tabset:
    ':::block-tabs\n::block-tab{label="One"}\nFirst panel.\n::\n\n::block-tab{label="Two"}\nSecond panel.\n::\n:::',
  'deeply nested blocks':
    '::::block-tabs\n:::block-tab{label="A"}\n::block-map{lat="1"}\n::\n:::\n::::',
  'soft break': 'line one\nline two',
  'hard break': 'line one\\\nline two',
  'block attributes': 'Some text\n{.is-warning}',
  'escaped characters': 'A \\* not emphasis \\_ and \\[not a link\\]',
  'code containing backticks': '``a ` b``'
}

/**
 * Only under a config that turns `wikiLinks` on. With it off, `[[x]]` is two of MDC's inline spans one
 * inside the other, which is a different construct and not what these are here to check.
 */
const WIKILINK_CONSTRUCTS = {
  wikilink: 'See [[Getting Started]] and [[Guides/Setup Guide|the setup guide]].',
  'wikilink to a section': 'See [[Page Name#Some Heading]] and [[#Local Section]].',
  'wikilink with formatted text': 'See [[Some Page|**bold** and *italic*]] here.',
  'wikilink with escapes': 'See [[Star\\* Page]] here.',
  'wikilink opening a new tab': 'See [[Some Page]]{target="_blank"} here.'
}

/**
 * A render reduced to what it says.
 *
 * The preview's line markers go — they are scaffolding the server strips before storing anything — and
 * whitespace between tags is collapsed, since the serialiser may put a construct on a different line
 * without changing a word of the page.
 */
function meaningOf(html) {
  return html
    .replace(/\s*data-line="\d+"/g, '')
    .replace(/\bclass="line"/g, '')
    .replace(/\bline\b ?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function check(name, source, config) {
  // -> A fresh renderer per render: footnote ids accumulate in the environment, so one instance
  //    rendering twice reports the second set differently for reasons that are not the page's
  const render = (text) => new MarkdownRenderer(config).render(text, { pagePath: 'demo/page' })
  const parser = createParser(new MarkdownRenderer(config), config)

  let rewritten
  try {
    rewritten = serialize(parser.parse(source, 'demo/page'))
  } catch (err) {
    return { ok: false, why: `threw while round-tripping: ${err.message}` }
  }
  /*
    And a second save must change nothing at all. The render comparison above cannot see a source that
    only drifts in its whitespace -- it collapses whitespace on purpose -- and that is exactly the
    failure that grows: a task item gained one more space after its checkbox on every save.
  */
  let again
  try {
    again = serialize(parser.parse(rewritten, 'demo/page'))
  } catch (err) {
    return { ok: false, why: `threw on a second round trip: ${err.message}`, rewritten }
  }
  if (again !== rewritten) {
    return {
      ok: false,
      why: 'changes again on a second round trip',
      rewritten,
      before: rewritten,
      after: again
    }
  }

  const before = meaningOf(render(source))
  const after = meaningOf(render(rewritten))
  if (before === after) {
    return { ok: true, rewritten }
  }
  let at = 0
  while (at < before.length && at < after.length && before[at] === after[at]) {
    at++
  }
  const from = Math.max(0, at - 60)
  return {
    ok: false,
    why: 'renders differently afterwards',
    rewritten,
    before: before.slice(from, at + 120),
    after: after.slice(from, at + 120)
  }
}

let failures = 0
let checked = 0

for (const [configName, config] of Object.entries(CONFIGS)) {
  const cases = Object.entries(CONSTRUCTS)
  if (config.wikiLinks) {
    cases.push(...Object.entries(WIKILINK_CONSTRUCTS))
  }
  for (const page of SAMPLE_PAGES) {
    if (page.content?.trim()) {
      cases.push([`sample page: ${page.title ?? page.path}`, page.content])
    }
  }
  for (const [name, source] of cases) {
    checked++
    const result = check(name, source, config)
    if (result.ok) {
      if (VERBOSE) {
        console.log(`  ok   [${configName}] ${name}`)
      }
      continue
    }
    failures++
    console.error(`\nFAIL [${configName}] ${name} — ${result.why}`)
    console.error(`--- source ---\n${source}`)
    console.error(`--- written back ---\n${result.rewritten ?? '(nothing)'}`)
    if (result.before !== undefined) {
      console.error(`--- renders as ---\n${result.before}`)
      console.error(`--- would render as ---\n${result.after}`)
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} of ${checked} did not survive the round trip.`)
  process.exit(1)
}
console.log(`Visual editor round trip: ${checked} checks passed.`)
