import {
  baseKeymap,
  chainCommands,
  exitCode,
  lift,
  setBlockType,
  toggleMark,
  wrapIn
} from 'prosemirror-commands'
import { redo, undo } from 'prosemirror-history'
import {
  InputRule,
  inputRules,
  smartQuotes,
  textblockTypeInputRule,
  wrappingInputRule
} from 'prosemirror-inputrules'
import { undoInputRule } from 'prosemirror-inputrules'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import { TextSelection } from 'prosemirror-state'
import { goToNextCell } from 'prosemirror-tables'

import { collabRedo, collabUndo } from './collab'
import { schema } from './schema'

/**
 * What the keyboard and the toolbar do.
 *
 * Two audiences at once, and the tension between them is the whole design. Somebody who reached for
 * the Visual editor because they do not write markdown needs the toolbar to be the whole story;
 * somebody who does write markdown will type `## ` and `- ` out of habit and be disappointed when
 * nothing happens. So the input rules are the markdown they would have typed, and they produce the
 * same document the toolbar produces.
 */

/** `**bold**`, and the rest of the paired inline markup, applied as the closing marker is typed. */
function markInputRule(pattern, markType, getAttrs) {
  return new InputRule(pattern, (state, match, start, end) => {
    const attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs
    const text = match[1]
    if (!text) {
      return null
    }
    const tr = state.tr
    /*
      The whole match goes, markers included, and the mark is applied to what was between them —
      rather than leaving the markers in the text, which is what a source editor would do and is
      exactly the thing this editor exists not to show anybody.
    */
    tr.replaceWith(start, end, schema.text(text, [markType.create(attrs)]))
    // -> Stored marks cleared, so the next character typed is outside the mark that was just closed
    tr.removeStoredMark(markType)
    return tr
  })
}

export function buildInputRules() {
  const rules = [
    ...smartQuotes,

    // -> `1. `, `- `, `* `, `+ `
    wrappingInputRule(
      /^(\d+)([.)])\s$/,
      schema.nodes.ordered_list,
      (match) => ({ order: Number(match[1]), markup: match[2] }),
      (match, node) => node.childCount + node.attrs.order === Number(match[1])
    ),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list, (match) => ({
      markup: match[1]
    })),

    // -> `> `
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),

    // -> `# ` through `###### `
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
      level: match[1].length
    })),

    // -> ``` or ~~~, with whatever info string was typed after it
    textblockTypeInputRule(/^(?:```|~~~)([^\s`]*)\s$/, schema.nodes.code_block, (match) => ({
      params: match[1] ?? ''
    })),

    markInputRule(/(?:\*\*)([^*]+)(?:\*\*)$/, schema.marks.strong),
    markInputRule(/(?:^|[^*])\*([^*]+)\*$/, schema.marks.em),
    markInputRule(/(?:~~)([^~]+)(?:~~)$/, schema.marks.strike),
    markInputRule(/(?:==)([^=]+)(?:==)$/, schema.marks.mark),
    markInputRule(/(?:`)([^`]+)(?:`)$/, schema.marks.code),

    /*
      `---` on a line of its own. Written as a rule rather than left to the parser because there is no
      parser here: what an author types goes straight into the document.
    */
    new InputRule(/^(?:---|\*\*\*|___)$/, (state, match, start, end) =>
      state.tr.replaceWith(start, end, schema.nodes.horizontal_rule.create({ markup: match[0] }))
    ),

    /*
      `[!NOTE] ` at the start of a blockquote, which is how the alert is written in markdown — so an
      author who knows the syntax gets the alert rather than a quote that says `[!NOTE]`.
    */
    new InputRule(/^\[!(note|tip|important|warning|caution)\]\s$/i, (state, match, start, end) => {
      const { $from } = state.selection
      const tr = state.tr.delete(start, end)
      const range = tr.selection.$from.blockRange()
      if (!range) {
        return null
      }
      const kind = match[1].toLowerCase()
      if ($from.node(-1).type === schema.nodes.blockquote) {
        // -> Already inside a quote: the quote IS the alert, so it changes type in place
        tr.setNodeMarkup($from.before(-1), schema.nodes.alert, { kind, title: null })
        return tr
      }
      tr.wrap(range, [{ type: schema.nodes.alert, attrs: { kind, title: null } }])
      return tr
    })
  ]
  return inputRules({ rules })
}

/** Put the caret in a sensible place after a node has been inserted at `pos`. */
function selectInside(tr, pos) {
  const node = tr.doc.nodeAt(pos)
  if (!node) {
    return tr
  }
  if (node.isAtom || !node.isTextblock) {
    const inner = tr.doc.resolve(pos + 1)
    return tr.setSelection(TextSelection.near(inner))
  }
  return tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
}

/** Toggle a textblock between a heading of some level and a plain paragraph. */
export function toggleHeading(level) {
  return (state, dispatch) => {
    const { $from } = state.selection
    const isSame = $from.parent.type === schema.nodes.heading && $from.parent.attrs.level === level
    const type = isSame ? schema.nodes.paragraph : schema.nodes.heading
    const attrs = isSame
      ? { mdAttrs: $from.parent.attrs.mdAttrs }
      : { level, mdAttrs: $from.parent.attrs.mdAttrs }
    return setBlockType(type, attrs)(state, dispatch)
  }
}

/**
 * Turn the list the caret is in into a task list, or back.
 *
 * A task is an attribute of each item rather than a kind of list, because that is what it is in the
 * source — so this walks the items of the list rather than changing the list's type.
 */
export function toggleTaskList(state, dispatch) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type !== schema.nodes.bullet_list) {
      continue
    }
    if (dispatch) {
      const start = $from.before(depth)
      const tr = state.tr
      const makeTasks = node.firstChild?.attrs.checked === null
      let offset = start + 1
      node.forEach((item) => {
        tr.setNodeMarkup(offset, undefined, { ...item.attrs, checked: makeTasks ? false : null })
        offset += item.nodeSize
      })
      dispatch(tr)
    }
    return true
  }
  return false
}

/** Tick or untick the task item the caret is in. */
export function toggleTaskChecked(state, dispatch) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type !== schema.nodes.list_item || node.attrs.checked === null) {
      continue
    }
    if (dispatch) {
      dispatch(
        state.tr.setNodeMarkup($from.before(depth), undefined, {
          ...node.attrs,
          checked: !node.attrs.checked
        })
      )
    }
    return true
  }
  return false
}

/** Wrap the selection in an alert of the given kind, or unwrap one it is already in. */
export function toggleAlert(kind) {
  return (state, dispatch) => {
    const { $from } = state.selection
    for (let depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type === schema.nodes.alert) {
        if ($from.node(depth).attrs.kind !== kind) {
          if (dispatch) {
            dispatch(
              state.tr.setNodeMarkup($from.before(depth), undefined, {
                ...$from.node(depth).attrs,
                kind
              })
            )
          }
          return true
        }
        return lift(state, dispatch)
      }
    }
    return wrapIn(schema.nodes.alert, { kind, title: null })(state, dispatch)
  }
}

/** Insert a node at the caret, replacing whatever is selected. */
export function insertNode(type, attrs = {}, content = null) {
  return (state, dispatch) => {
    const node = type.createAndFill(attrs, content)
    if (!node) {
      return false
    }
    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(node)
      const pos = tr.selection.$from.pos - node.nodeSize
      dispatch(selectInside(tr, pos).scrollIntoView())
    }
    return true
  }
}

/**
 * An empty definition list — one term and its definition — with the caret in the term.
 *
 * Built as nodes rather than parsed from markdown, unlike most of what the toolbar inserts: an empty
 * definition list is not something markdown can express, since `: ` on a line with nothing above it
 * is a paragraph that starts with a colon.
 *
 * `insertNode` is deliberately not used, and that is the reason this exists. It inserts through
 * `replaceSelectionWith`, which for this node leaves the caret in the paragraph the button was
 * pressed in — so the first word an author typed went above the list instead of into it, which is
 * most of what made the list feel broken. Here the position is worked out first and the caret put
 * where the typing is meant to start.
 */
export function insertDefinitionList() {
  return (state, dispatch) => {
    const list = schema.nodes.definition_list.createAndFill(null, [
      schema.nodes.definition_term.createAndFill(),
      schema.nodes.definition_description.createAndFill()
    ])
    if (!list) {
      return false
    }
    if (dispatch) {
      const { $from } = state.selection
      /*
        Where a block construct goes, by the same rule `insertMarkdown` follows: in place of the
        textblock the caret is in when that block is empty -- inserting a list into the empty
        paragraph at the end of a page should not strand that paragraph above it -- and after that
        block otherwise. A selection with no textblock around it at all (a node selected whole) puts
        the list at its own position.
      */
      const replacing =
        $from.depth > 0 && $from.parent.isTextblock && $from.parent.content.size === 0
      let at = $from.pos
      if ($from.depth > 0) {
        at = replacing ? $from.before() : $from.after()
      }
      const tr = state.tr
      if (replacing) {
        tr.replaceWith(at, $from.after(), list)
      } else {
        tr.insert(at, list)
      }
      // -> Two positions in: past the list's own opening token, then past the term's
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/** A table of `rows` × `cols`, its first row a header. */
export function insertTable(rows = 3, cols = 3) {
  return (state, dispatch) => {
    const cell = (type) => type.createAndFill()
    const body = []
    for (let r = 0; r < rows; r++) {
      const cells = []
      for (let c = 0; c < cols; c++) {
        cells.push(cell(r === 0 ? schema.nodes.table_header : schema.nodes.table_cell))
      }
      body.push(schema.nodes.table_row.createAndFill(null, cells))
    }
    return insertNode(schema.nodes.table, null, body)(state, dispatch)
  }
}

/**
 * Whether a row of a definition list has never been typed into.
 *
 * A different question of each kind: a term holds inline content, while a definition holds blocks, so
 * an untouched definition is a paragraph with nothing in it rather than nothing at all.
 */
function rowIsEmpty(row) {
  return row.type === schema.nodes.definition_term
    ? row.content.size === 0
    : row.childCount === 1 && row.firstChild.content.size === 0
}

/**
 * Enter inside a definition list: term, definition, term, definition — and out at the end.
 *
 * The gesture that makes a definition list writable at all. A `dl` is two alternating node types with
 * no visible difference between them until they hold text, so the default `splitBlock` — which makes
 * another node of the SAME type — left an author typing a second term where they meant to type its
 * definition, with no indication that anything was wrong.
 *
 * So Enter alternates:
 *
 *   - in a term, the definition below it — the caret into the empty one already there, which is the
 *     shape the toolbar's own button produces, or a new one where there is none;
 *   - in a definition, the next term, on the same rule;
 *   - in an EMPTY row that is the last in the list, out of the list entirely, as pressing Enter twice
 *     leaves any other list.
 *
 * An empty row in the MIDDLE is left to the first two rules rather than splitting the list in half:
 * markdown has no way to write two definition lists in a row without something between them anyway.
 *
 * A definition that runs to more than one paragraph is not reachable this way, which is deliberate:
 * a definition list is one line per definition almost everywhere it is used, and Shift-Enter still
 * puts a line break in a long one.
 */
export function splitDefinitionItem(state, dispatch) {
  const { $from, empty } = state.selection
  if (!empty) {
    return false
  }

  let depth = $from.depth
  while (
    depth > 0 &&
    $from.node(depth).type !== schema.nodes.definition_term &&
    $from.node(depth).type !== schema.nodes.definition_description
  ) {
    depth -= 1
  }
  if (depth === 0 || $from.node(depth - 1).type !== schema.nodes.definition_list) {
    return false
  }

  const row = $from.node(depth)
  const list = $from.node(depth - 1)
  const index = $from.index(depth - 1)
  const isLast = index === list.childCount - 1
  const wanted =
    row.type === schema.nodes.definition_term
      ? schema.nodes.definition_description
      : schema.nodes.definition_term
  const next = isLast ? null : list.child(index + 1)

  if (!dispatch) {
    return true
  }

  const tr = state.tr
  const at = $from.after(depth)
  if (next && next.type === wanted && rowIsEmpty(next)) {
    // -> Into the row that is already there, rather than another empty one beside it
    tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)))
  } else if (isLast && rowIsEmpty(row)) {
    /*
      Out of the list. The whole list goes when the empty row was all of it -- a `dl` with no rows is
      not a document the schema allows, and it is not something markdown can write either.
    */
    const from = list.childCount === 1 ? $from.before(depth - 1) : $from.before(depth)
    tr.replaceWith(from, $from.after(depth - 1), schema.nodes.paragraph.createAndFill())
    tr.setSelection(TextSelection.near(tr.doc.resolve(from + 1)))
  } else {
    tr.insert(at, wanted.createAndFill())
    tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)))
  }
  dispatch(tr.scrollIntoView())
  return true
}

/** Whether a mark is on the selection, or would be on what is typed next. */
export function markActive(state, type) {
  const { from, $from, to, empty } = state.selection
  return empty
    ? Boolean(type.isInSet(state.storedMarks || $from.marks()))
    : state.doc.rangeHasMark(from, to, type)
}

/** Whether the caret sits anywhere inside a node of this type. */
export function nodeActive(state, type, attrs = null) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth)
    if (node.type !== type) {
      continue
    }
    if (!attrs) {
      return true
    }
    return Object.entries(attrs).every(([name, value]) => node.attrs[name] === value)
  }
  return false
}

/**
 * Everything bound to a key.
 *
 * Mod is Cmd on a Mac and Ctrl everywhere else. The set is deliberately close to what the Markdown
 * editor binds, so that somebody moving between the two does not have to relearn anything.
 */
export function buildKeymap({ collab = false } = {}) {
  /*
    Undo comes from Yjs while collaborating. `prosemirror-history` undoes whatever changed last, which
    in a shared document is very often the sentence somebody else is in the middle of typing; Yjs
    tracks what THIS client did and takes back only that.
  */
  const stepBack = collab ? collabUndo : undo
  const stepForward = collab ? collabRedo : redo

  const keys = {
    'Mod-z': stepBack,
    'Shift-Mod-z': stepForward,
    'Mod-y': stepForward,
    Backspace: undoInputRule,

    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-u': toggleMark(schema.marks.underline),
    'Mod-Shift-x': toggleMark(schema.marks.strike),
    'Mod-Shift-h': toggleMark(schema.marks.mark),
    'Mod-e': toggleMark(schema.marks.code),

    'Mod-Shift-8': wrapInList(schema.nodes.bullet_list),
    'Mod-Shift-9': wrapInList(schema.nodes.ordered_list),
    'Mod-Shift-.': wrapIn(schema.nodes.blockquote),
    'Mod-Shift-Enter': toggleTaskChecked,

    // -> Definition lists first: their rows alternate, which neither of the other two knows about
    Enter: chainCommands(
      splitDefinitionItem,
      splitListItem(schema.nodes.list_item),
      baseKeymap.Enter
    ),
    Tab: chainCommands(goToNextCell(1), sinkListItem(schema.nodes.list_item)),
    'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(schema.nodes.list_item)),

    /*
      A hard break, which in markdown is the backslash form. Shift-Enter is what every editor binds it
      to, and `exitCode` first so that the same key gets out of a code block rather than putting a
      newline in one.
    */
    'Shift-Enter': chainCommands(exitCode, (state, dispatch) => {
      if (dispatch) {
        dispatch(
          state.tr
            .replaceSelectionWith(schema.nodes.hard_break.create({ markup: 'hard' }))
            .scrollIntoView()
        )
      }
      return true
    }),

    // -> Out of a code block or a block that ends the document, where there is otherwise no way back
    'Mod-Enter': exitCode
  }

  for (let level = 1; level <= 6; level++) {
    keys[`Mod-Shift-${level}`] = toggleHeading(level)
  }

  return { ...baseKeymap, ...keys }
}
