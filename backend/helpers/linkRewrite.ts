/**
 * Rewriting a link in a page's SOURCE, for a page whose target moved.
 *
 * The render half is `rewriteRenderLinks` in `helpers/pageLinks.ts`, which has a parsed tree to work
 * on. This half does not: there is no markdown or asciidoc parser on this side (a page's HTML is
 * produced in the editor's browser), so a link is found by the syntax around it instead. What that
 * buys is an edit that touches exactly the characters of the href and nothing else — no reformatted
 * paragraph, no normalized list — which is what an author opening the page afterwards expects to see
 * in its history.
 *
 * The href is looked for exactly as the `pageLinks` row recorded it, which is exactly as the render
 * carried it. For both syntaxes that is the destination as written in the source, so the two agree;
 * where they do not (an entity-encoded query, say) the link is simply not found, and the caller
 * leaves that page alone rather than rewriting its render out from under its source.
 *
 * Code is left alone — a fenced block and an inline code span in markdown, a listing, literal or
 * comment block in asciidoc — since a link there is an example of a link and not one.
 */

/** What a page's content is, as far as finding a link in it goes. */
export type SourceSyntax = 'markdown' | 'adoc'

export interface SourceRewrite {
  /** The source with every link that was found rewritten. */
  content: string
  /** The old hrefs that were found at least once, and so rewritten. */
  replaced: Set<string>
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whether an href is a full URL, which is the only kind that can stand in prose on its own. */
function isAbsoluteUrl(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

/**
 * Every place `href` can stand as a link destination, as a pattern whose first group is whatever
 * comes before it — kept, and written back unchanged.
 */
function patternsFor(href: string, syntax: SourceSyntax): RegExp[] {
  const h = escapeRegExp(href)
  // -> Raw HTML is allowed in both, and an author reaching for it writes an ordinary anchor
  const patterns = [new RegExp(`(\\bhref\\s*=\\s*["'])${h}(?=["'])`, 'g')]

  if (syntax === 'markdown') {
    patterns.push(
      // -> `[text](href)`, `[text](<href>)`, `[text](href "title")` -- and the image form, which
      //    shares it
      new RegExp(`(\\]\\(\\s*<?)${h}(?=>?(?:\\)|\\s))`, 'g'),
      // -> A reference definition, `[label]: href`, at the start of its line
      new RegExp(`(^[ \\t]{0,3}\\[[^\\]\\n]+\\]:[ \\t]*<?)${h}(?=>?(?:[ \\t]|$))`, 'gm')
    )
    if (isAbsoluteUrl(href)) {
      patterns.push(
        // -> `<https://…>`. Only for a full URL: `</b>` is a closing tag, not a link to `/b`
        new RegExp(`(<)${h}(?=>)`, 'g'),
        // -> A bare URL, which the renderer's linkify turns into a link
        new RegExp(`(^|[\\s(])${h}(?=[\\s).,;:!?]|$)`, 'gm')
      )
    }
  } else {
    patterns.push(
      // -> `link:href[text]`, and the passthrough form a target with odd characters needs
      new RegExp(`(\\blink:)${h}(?=\\[)`, 'g'),
      new RegExp(`(\\blink:\\+\\+)${h}(?=\\+\\+\\[)`, 'g')
    )
    if (isAbsoluteUrl(href)) {
      // -> `https://…[text]`, or a bare URL, which asciidoctor links on its own
      patterns.push(new RegExp(`(^|[\\s(<])${h}(?=\\[|[\\s>).,;:!?]|$)`, 'gm'))
    }
  }
  return patterns
}

/** Whether a markdown line opens or closes a fence, and with what. */
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/

/** Delimiters of the asciidoc blocks whose content is not markup. */
const ADOC_VERBATIM = /^(-{4,}|\.{4,}|\/{4,})[ \t]*$/

/**
 * Split a source into the stretches a link may be rewritten in and the ones it may not.
 *
 * Line by line for the blocks, and within a markdown line for inline code spans — a backtick run
 * closes only on a run of the same length, which is the rule markdown itself uses.
 */
function segments(source: string, syntax: SourceSyntax): { text: string; code: boolean }[] {
  const out: { text: string; code: boolean }[] = []
  const push = (text: string, code: boolean) => {
    const last = out.at(-1)
    if (last && last.code === code) {
      last.text += text
    } else if (text) {
      out.push({ text, code })
    }
  }

  let fence: string | null = null
  for (const line of source.split(/(?<=\n)/)) {
    const bare = line.replace(/\r?\n$/, '')
    if (syntax === 'markdown') {
      const marker = FENCE.exec(bare)?.[1]
      if (fence) {
        push(line, true)
        if (
          marker &&
          marker[0] === fence[0] &&
          marker.length >= fence.length &&
          !bare.trim().slice(marker.length).trim()
        ) {
          fence = null
        }
        continue
      }
      if (marker) {
        fence = marker
        push(line, true)
        continue
      }
      // -> Inline code spans within an ordinary line
      let rest = line
      for (;;) {
        const open = /`+/.exec(rest)
        if (!open) {
          push(rest, false)
          break
        }
        const close = rest.indexOf(open[0], open.index + open[0].length)
        if (close < 0) {
          push(rest, false)
          break
        }
        push(rest.slice(0, open.index), false)
        push(rest.slice(open.index, close + open[0].length), true)
        rest = rest.slice(close + open[0].length)
      }
    } else {
      const marker = ADOC_VERBATIM.exec(bare)?.[1]
      if (fence) {
        push(line, true)
        if (marker === fence) {
          fence = null
        }
        continue
      }
      if (marker) {
        fence = marker
        push(line, true)
        continue
      }
      push(line, false)
    }
  }
  return out
}

/**
 * Rewrite every link destination in `source` that is one of `replacements`' keys.
 *
 * All of them in one pass over the segments, so that an href rewritten to something that is itself
 * another key — a page moved onto the old path of another — is not rewritten twice.
 */
export function rewriteSourceLinks(
  source: string,
  syntax: SourceSyntax,
  replacements: ReadonlyMap<string, string>
): SourceRewrite {
  const replaced = new Set<string>()
  if (!source || replacements.size < 1) {
    return { content: source, replaced }
  }

  // -> Longest first, so `/guides/setup` is tried before `/guides` wherever both could match
  const hrefs = [...replacements.keys()].sort((a, b) => b.length - a.length)
  const compiled = hrefs.map((href) => ({ href, patterns: patternsFor(href, syntax) }))

  const content = segments(source, syntax)
    .map((segment) => {
      if (segment.code) {
        return segment.text
      }
      // -> Placeholders first, then the real values, so one replacement cannot feed the next
      const placed: string[] = []
      let text = segment.text
      for (const { href, patterns } of compiled) {
        for (const pattern of patterns) {
          text = text.replace(pattern, (_match, before: string) => {
            replaced.add(href)
            placed.push(replacements.get(href)!)
            return `${before}\uE000${placed.length - 1}\uE000`
          })
        }
      }
      return text.replace(/\uE000(\d+)\uE000/g, (_match, index: string) => placed[Number(index)])
    })
    .join('')

  return { content, replaced }
}
