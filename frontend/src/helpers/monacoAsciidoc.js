import * as monaco from 'monaco-editor'

/**
 * AsciiDoc, as a language Monaco knows how to colour.
 *
 * Monaco ships basic-language definitions for some sixty syntaxes and AsciiDoc is not among them, so
 * without this the editor would open on plain undifferentiated text — which is the one thing a source
 * editor is for. There is no AsciiDoc language service to speak of either; this is a Monarch
 * tokenizer and a language configuration, and nothing more.
 *
 * Registered once for the page rather than per editor, the same footing Monaco's own languages are on:
 * a language is global to the module, and registering a second time would stack another tokenizer
 * behind the same id.
 *
 * The token names are Monaco's own vocabulary rather than anything AsciiDoc-specific, which is what
 * lets the wiki's editor theme colour this the same way it colours markdown — `keyword` for the
 * things that give a line its meaning, `string` for what a reader's eye should follow, `comment` for
 * what is not content.
 */

/** The id the editor opens a model with. Monaco's conventional spelling for this syntax. */
export const ASCIIDOC_LANGUAGE_ID = 'asciidoc'

let registered = false

/**
 * The verbatim delimiters, each of which suspends AsciiDoc entirely until its own closing line.
 *
 * Four or more of the character, which is AsciiDoc's rule, and the closing line has to be the same
 * character — so each gets a state of its own rather than one shared "verbatim" state that any of
 * them could close. Without that, a `----` listing holding a row of dots would end early.
 */
const VERBATIM = [
  { open: /^-{4,}\s*$/, close: /^-{4,}\s*$/, state: 'listing' },
  { open: /^\.{4,}\s*$/, close: /^\.{4,}\s*$/, state: 'literal' },
  { open: /^\+{4,}\s*$/, close: /^\+{4,}\s*$/, state: 'passthrough' },
  { open: /^\/{4,}\s*$/, close: /^\/{4,}\s*$/, state: 'comment' }
]

/** The tokenizer state each verbatim block puts the editor into, built from the table above. */
const verbatimStates = Object.fromEntries(
  VERBATIM.map(({ close, state }) => [
    state,
    [
      [close, { token: 'keyword', next: '@pop' }],
      [/.*$/, state === 'comment' ? 'comment' : 'string']
    ]
  ])
)

export function registerAsciidocLanguage() {
  if (registered) {
    return
  }
  registered = true

  monaco.languages.register({ id: ASCIIDOC_LANGUAGE_ID, extensions: ['.adoc', '.asciidoc'] })

  monaco.languages.setLanguageConfiguration(ASCIIDOC_LANGUAGE_ID, {
    comments: { lineComment: '//', blockComment: ['////', '////'] },
    brackets: [
      ['[', ']'],
      ['{', '}']
    ],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: '`', close: '`' }
    ],
    /*
      The formatting marks are part of a word, so that toggling bold or italic with nothing selected
      takes the marks off again instead of wrapping them a second time — the same reason the markdown
      editor widens Monaco's default pattern. AsciiDoc's marks are `*`, `_`, `` ` ``, `#`, `^` and `~`.
    */
    wordPattern:
      /([*_`#^~]{1,2})?[\p{Alphabetic}\p{Number}\p{Nonspacing_Mark}]+(_+[\p{Alphabetic}\p{Number}\p{Nonspacing_Mark}]+)*\1/gu
  })

  monaco.languages.setMonarchTokensProvider(ASCIIDOC_LANGUAGE_ID, {
    defaultToken: '',
    tokenizer: {
      root: [
        // -> Verbatim blocks first: nothing inside one is AsciiDoc
        ...VERBATIM.map(({ open, state }) => [open, { token: 'keyword', next: `@${state}` }]),

        // -> A line comment, and the `//` that opens one
        [/^\/\/.*$/, 'comment'],

        /*
          A section heading. Six levels, though a page's own title is held in a column of its own, so
          content here starts at `==` — see `LOCKED_ATTRIBUTES` in `renderers/asciidoc.js`.
        */
        [/^={1,6}\s+.*$/, 'keyword'],

        // -> A document attribute entry: `:name: value`, `:name!:` to unset
        [/^:[\w!-]+:.*$/, 'variable'],

        /*
          A block attribute line -- `[source,yaml]`, `[block-tabs, label="One"]`, `[NOTE]`. What names
          a block, gives it its props, or turns a paragraph into an admonition, so it is the line that
          carries the most meaning per character on the page.
        */
        [/^\[.*\]\s*$/, 'type'],

        // -> A block title: a lone `.` opening a line, then the caption
        [/^\.[^.\s].*$/, 'string.escape'],

        // -> The delimiters that hold content rather than suspend it, plus a table's
        [/^(={4,}|\*{4,}|_{4,}|--|\|={3,})\s*$/, 'keyword'],

        // -> An admonition written as a paragraph prefix
        [/^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\s/, 'type'],

        // -> List markers, ordered and unordered, at any depth; and a description list's `::`
        [/^\s*[*.]{1,5}\s+/, 'keyword'],
        [/^\s*-\s+/, 'keyword'],
        [/^\s*\[[ x*]\]\s+/, 'keyword'],
        [/^.*?(?=::\s|::$)::/, 'keyword'],
        // -> The `+` that attaches a paragraph to the list item above it
        [/^\+\s*$/, 'keyword'],

        // -> A table cell separator at the start of a line
        [/^\|/, 'keyword'],

        { include: '@inline' }
      ],

      /*
        What can appear anywhere in a line. Ordered so that the longest and most distinctive marks are
        tried first -- a macro before an attribute reference, constrained formatting before a bare
        character that happens to be a formatting mark.
      */
      inline: [
        // -> An inline passthrough, which suspends everything inside it
        [/\+{3}[^+]*\+{3}/, 'string'],
        [/`\+[^+]*\+`/, 'string'],

        // -> Monospace, which wins over the emphasis marks so that `*` inside code stays code
        [/`[^`\n]+`/, 'string'],

        /*
          A macro: `image:photo.png[…]`, `icon:mdi:home[]`, `kbd:[Ctrl+S]`, `link:/a[b]`,
          `footnote:[…]`. The target may hold a colon, which is what lets an Iconify reference go in
          as itself, so it is matched up to the bracket rather than up to the next colon.
        */
        [/\b[a-z][\w-]*:[^[\s]*\[[^\]]*\]/, 'type'],

        // -> A cross-reference, and an inline anchor
        [/<<[^>]*>>/, 'type'],
        [/\[\[[^\]]*\]\]/, 'type'],

        // -> An attribute reference
        [/\{[\w-]+\}/, 'variable'],

        // -> A bare URL, which AsciiDoc always turns into a link
        [/\b(https?|ftp|mailto):\/?\/?[^\s[\]]+/, 'type'],

        // -> A callout marker inside a line of code that is not in a verbatim block
        [/<\d+>/, 'number'],

        /*
          The formatting marks. Doubled first (`**bold**` is unconstrained and may sit mid-word), then
          single. A single mark is required to abut a non-space on the inside, which is AsciiDoc's own
          rule and what keeps an ordinary asterisk or underscore in prose from opening a run that
          never closes.
        */
        [/\*\*[^\n]+?\*\*/, 'strong'],
        [/\*[^\s*][^\n]*?\*/, 'strong'],
        [/__[^\n]+?__/, 'emphasis'],
        [/_[^\s_][^\n]*?_/, 'emphasis'],
        [/##[^\n]+?##/, 'regexp'],
        [/#[^\s#][^\n]*?#/, 'regexp'],
        [/\^[^\s^][^\n]*?\^/, 'number'],
        [/~[^\s~][^\n]*?~/, 'number'],

        // -> An escaped mark, which is literal text and must not open anything
        [/\\./, '']
      ],

      ...verbatimStates
    }
  })
}
