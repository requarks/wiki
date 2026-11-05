/**
 * `@joplin/turndown-plugin-gfm` ships no types of its own.
 *
 * The Joplin fork rather than the original `turndown-plugin-gfm`, which has not been touched in
 * years: same rules, kept up with Turndown and with the table shapes a real WYSIWYG page produces —
 * merged cells, a table with no header row, nested markup inside a cell.
 *
 * Every rule `gfm` bundles is used, because a page converted from 2.x needs all of them — tables
 * above all, since plain Turndown has no rule for one and would flatten it to loose text. They are
 * applied one by one rather than through `gfm` so that `tables` can be wrapped
 * (`withTableRowSnapshots` in `helpers/htmlToMarkdown.ts`).
 */
declare module '@joplin/turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  export const gfm: TurndownService.Plugin
  export const tables: TurndownService.Plugin
  export const strikethrough: TurndownService.Plugin
  export const taskListItems: TurndownService.Plugin
  export const highlightedCodeBlock: TurndownService.Plugin
}
