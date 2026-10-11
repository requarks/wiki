import hljs from 'highlight.js'

/**
 * The languages a fenced code block can be given, as the editors offer them -- the toolbar's code
 * block menu and the markdown editor's suggestions after a typed fence.
 *
 * The list is whatever highlight.js has registered, asked at runtime rather than kept as a copy, so it
 * cannot drift from what the renderer will actually highlight. Each entry carries the id that goes on
 * the fence and the name hljs calls it.
 */

/**
 * The five worth having at the top. Labelled here rather than taking hljs's own names, which for these
 * read as `Plain text`, `HTML, XML` and `Bash` — precise, and not what someone scanning a shortlist is
 * looking for.
 *
 * Two of the ids are not what the list below would show either:
 *   - `sh` and `md` are aliases rather than registered ids, so they are absent from that list; hljs
 *     resolves them to Bash and Markdown, which is what highlights the block.
 *   - Plain text has no id at all. A bare fence is how markdown says "no language", and it is what the
 *     renderer already treats as unhighlighted — so there is nothing to put after the backticks. The
 *     menu shows a dash where the others show their id.
 */
export const COMMON_LANGUAGES = [
  { id: '', label: 'Plain Text' },
  { id: 'json', label: 'JSON' },
  { id: 'md', label: 'Markdown' },
  { id: 'sh', label: 'Bash Shell' },
  { id: 'xml', label: 'XML' }
]

/** Every registered language, by display name. Built once: the set cannot change at runtime. */
export const ALL_LANGUAGES = hljs
  .listLanguages()
  .map((id) => {
    const definition = hljs.getLanguage(id)
    return {
      id,
      label: definition?.name ?? id,
      // -> Searched but never shown: `sh` and `zsh` are how someone looks for Bash
      aliases: definition?.aliases ?? []
    }
  })
  .sort((a, b) => a.label.localeCompare(b.label))
