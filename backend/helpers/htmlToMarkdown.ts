import TurndownService from 'turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'

/**
 * HTML → markdown: for a page 2.x wrote in an editor 3.x does not have (`models/import.ts`), and for
 * an agent reading a page whose source it may not see (`mcp/content.ts`), which gets the stored
 * render back as what a reader sees, in the form a model reads best.
 *
 * Turndown with the GitHub-flavoured rules (the Joplin fork, which is maintained where the original is
 * not), and the plugin is not optional: a WYSIWYG page is mostly tables, and plain Turndown has no
 * rule for one — it would flatten a table to a run of loose text and nobody would notice until they
 * opened the page.
 *
 * Built once. The service holds only its rules, so the same instance converts every page rather than
 * being rebuilt per call.
 */
let turndown: TurndownService | null = null
export function htmlToMarkdown(html: string): string {
  turndown ??= new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*'
  }).use(gfm)
  return turndown.turndown(html)
}
