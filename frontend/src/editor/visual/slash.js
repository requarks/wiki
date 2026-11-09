import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

import { wrapIn } from 'prosemirror-commands'

import { toggleAlert, toggleList } from './commands'
import { schema } from './schema'

/**
 * The slash menu: `/` typed on an empty line offers what that line could become.
 *
 * Only on a top-level paragraph or heading with nothing in it -- the line an author is about to start,
 * or one whose words were just deleted to start it again as something else -- not one inside a list, a
 * quote, a table or a block, where what the line may turn into is the container's business and a `/`
 * is far more likely to be the first character of a path being written down.
 *
 * Ctrl+Space opens it too, with nothing typed: on such an empty line as the whole menu, and anywhere
 * else in text as the entries that go in at the caret without replacing the line -- a link, an inline
 * content block -- whose query is then what is typed after the caret. See `openFromShortcut`.
 *
 * The plugin is the whole of the behaviour -- when the menu is open, what it lists, which entry is
 * highlighted, what the keys do and what picking one does. The menu itself is drawn by
 * `EditorVisual.vue`, because it wants icons and those are components; it is told what to draw through
 * `onUpdate` and answers through `chooseSlashItem` and `highlightSlashItem`.
 */

const key = new PluginKey('slashMenu')

/** The heading drawn over each group of entries, by group. */
const SLASH_GROUPS = {
  formatting: 'editor.visual.slash.formatting',
  lists: 'editor.visual.slash.lists',
  admonitions: 'editor.visual.alert.title',
  elements: 'editor.visual.slash.elements',
  blocks: 'editor.visual.slash.contentBlocks'
}

/**
 * What the menu offers, in order. The icons are literals so `scripts/generate-icons.mjs` sees them,
 * and `keywords` are matched as well as the label -- in English, whatever the interface is in, since
 * `h2` and `todo` are what people type whichever language their wiki is written in.
 *
 * Grouped under a heading each, in the order the groups first appear -- see `SLASH_GROUPS`.
 *
 * Each says what the line becomes -- `level` for a heading, a paragraph otherwise -- and, for a list,
 * a quote or an admonition, the command that then wraps that paragraph. Set rather than toggled, so
 * picking Header 3 on a line that already is one leaves it one.
 *
 * An admonition's icon and `iconClass` are the toolbar's for the same kind -- `ALERT_ICONS` and the
 * `visual-alert-choice` colours in `EditorVisual.vue` -- so the two menus draw one kind one way.
 */
export const SLASH_ITEMS = [
  {
    key: 'paragraph',
    group: 'formatting',
    icon: 'mdi:format-paragraph',
    label: ['editor.markup.paragraph'],
    hint: 'editor.visual.slash.paragraphHint',
    keywords: ['text', 'paragraph', 'plain']
  },
  {
    key: 'h1',
    group: 'formatting',
    icon: 'mdi:format-header-1',
    label: ['editor.markup.headerLevel', { level: 1 }],
    hint: 'editor.visual.slash.h1Hint',
    keywords: ['h1', 'heading', 'header', 'title'],
    level: 1
  },
  {
    key: 'h2',
    group: 'formatting',
    icon: 'mdi:format-header-2',
    label: ['editor.markup.headerLevel', { level: 2 }],
    hint: 'editor.visual.slash.h2Hint',
    keywords: ['h2', 'heading', 'header', 'subtitle'],
    level: 2
  },
  {
    key: 'h3',
    group: 'formatting',
    icon: 'mdi:format-header-3',
    label: ['editor.markup.headerLevel', { level: 3 }],
    hint: 'editor.visual.slash.h3Hint',
    keywords: ['h3', 'heading', 'header'],
    level: 3
  },
  {
    key: 'bullet',
    group: 'lists',
    icon: 'mdi:format-list-bulleted',
    label: ['editor.markup.unorderedList'],
    hint: 'editor.visual.slash.unorderedListHint',
    keywords: ['ul', 'bullet', 'list', 'unordered'],
    wrap: toggleList('bullet')
  },
  {
    key: 'ordered',
    group: 'lists',
    icon: 'mdi:format-list-numbered',
    label: ['editor.markup.orderedList'],
    hint: 'editor.visual.slash.orderedListHint',
    keywords: ['ol', 'numbered', 'list', 'ordered'],
    wrap: toggleList('ordered')
  },
  {
    key: 'task',
    group: 'lists',
    icon: 'mdi:format-list-checks',
    label: ['editor.markup.taskList'],
    hint: 'editor.visual.slash.taskListHint',
    keywords: ['todo', 'task', 'checkbox', 'checklist', 'list'],
    wrap: toggleList('task')
  },
  {
    key: 'blockquote',
    group: 'admonitions',
    icon: 'mdi:format-quote-close',
    label: ['editor.markup.blockquote'],
    hint: 'editor.visual.slash.blockquoteHint',
    keywords: ['quote', 'blockquote', 'citation'],
    wrap: wrapIn(schema.nodes.blockquote)
  },
  {
    key: 'note',
    group: 'admonitions',
    icon: 'mdi:information',
    iconClass: 'visual-alert-choice--note',
    label: ['editor.visual.alert.note'],
    hint: 'editor.visual.slash.noteHint',
    keywords: ['note', 'info', 'admonition', 'callout', 'alert'],
    wrap: toggleAlert('note')
  },
  {
    key: 'tip',
    group: 'admonitions',
    icon: 'mdi:check-circle',
    iconClass: 'visual-alert-choice--tip',
    label: ['editor.visual.alert.tip'],
    hint: 'editor.visual.slash.tipHint',
    keywords: ['tip', 'hint', 'success', 'admonition', 'callout', 'alert'],
    wrap: toggleAlert('tip')
  },
  {
    key: 'important',
    group: 'admonitions',
    icon: 'mdi:message-alert',
    iconClass: 'visual-alert-choice--important',
    label: ['editor.visual.alert.important'],
    hint: 'editor.visual.slash.importantHint',
    keywords: ['important', 'admonition', 'callout', 'alert'],
    wrap: toggleAlert('important')
  },
  {
    key: 'warning',
    group: 'admonitions',
    icon: 'mdi:alert',
    iconClass: 'visual-alert-choice--warning',
    label: ['editor.visual.alert.warning'],
    hint: 'editor.visual.slash.warningHint',
    keywords: ['warning', 'admonition', 'callout', 'alert'],
    wrap: toggleAlert('warning')
  },
  {
    key: 'caution',
    group: 'admonitions',
    icon: 'mdi:close-box',
    iconClass: 'visual-alert-choice--caution',
    label: ['editor.visual.alert.caution'],
    hint: 'editor.visual.slash.cautionHint',
    keywords: ['caution', 'danger', 'critical', 'error', 'admonition', 'callout', 'alert'],
    wrap: toggleAlert('caution')
  }
]

/**
 * The text typed since the menu opened, or null once it should close.
 *
 * On a line (`inline` false) the query is the whole line after the prefix, and holds only while the
 * caret is still on the line the menu was opened on and that line still holds nothing but the prefix
 * and what follows it. Inline, it is what lies between where the menu opened and the caret, in the
 * same textblock.
 *
 * @param {{ from: number, prefix: string, inline: boolean }} menu Where the menu opened and what was
 *        typed to open it: `/`, or nothing for the keyboard shortcut.
 */
function queryAt(state, { from, prefix, inline }) {
  const { selection } = state
  if (!selection.empty) {
    return null
  }
  const { $from } = selection
  if ($from.pos < from + prefix.length) {
    return null
  }
  if (inline) {
    if (!state.doc.resolve(from).sameParent($from)) {
      return null
    }
    const text = state.doc.textBetween(from, $from.pos, null, '\ufffc')
    // -> Anything that is not text -- an emoji, an image, an inline block -- ends it
    return text.includes('\ufffc') ? null : text
  }
  const line = $from.parent
  if (!isMenuLine($from) || $from.start() !== from) {
    return null
  }
  const text = line.textContent
  // -> Anything that is not text -- a hard break, an emoji, an image -- ends it as surely as a new line
  if (!text.startsWith(prefix) || line.content.size !== text.length) {
    return null
  }
  return text.slice(prefix.length)
}

/**
 * Ctrl+Space, on every platform: on a Mac `Cmd+Space` is Spotlight's, and `Ctrl+Space` is what code
 * editors there use for the same "what can go here" menu.
 */
function isMenuShortcut(event) {
  return (
    event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    (event.code === 'Space' || event.key === ' ')
  )
}

/**
 * Whether the caret can take the inline entries: an empty selection in a textblock that holds text and
 * links, and not code, where neither a link nor a block is anything but characters.
 */
function takesInline(state) {
  const { selection } = state
  const { $from } = selection
  return (
    selection.empty &&
    $from.parent.inlineContent &&
    !$from.parent.type.spec.code &&
    $from.parent.type.allowsMarkType(schema.marks.link) &&
    !schema.marks.code.isInSet($from.marks())
  )
}

/** The lines the menu belongs to: a paragraph or a heading, at the top level of the page. */
function isMenuLine($pos) {
  const type = $pos.parent.type
  return $pos.depth === 1 && (type === schema.nodes.paragraph || type === schema.nodes.heading)
}

/** An empty line of that kind, which is where a `/` opens the menu and the placeholder says so. */
function isEmptyMenuLine($pos) {
  return isMenuLine($pos) && $pos.parent.content.size === 0
}

/** Whether a `/` typed at this caret opens the menu. */
function opensAt(state, from, to) {
  return from === to && isEmptyMenuLine(state.selection.$from)
}

/**
 * The menu.
 *
 * @param {object} handlers
 * @param {(menu: ?{ items, index, top, bottom, left }) => void} handlers.onUpdate Told what to draw,
 *        or null to draw nothing. Each item carries its `group` and that group's heading, which is
 *        drawn over the first item of each group left after filtering. `top`, `bottom` and `left` are the line's, against the element
 *        ProseMirror was mounted into.
 * @param {(key: string, params?: object) => string} handlers.t
 * @param {() => Array<object>} handlers.getItems The host's own entries, after these: each a
 *        `{ key, group, icon, title, description, keywords, run }`, already translated, whose `run()`
 *        does whatever picking it means -- open a dialog, insert a block -- once the line is cleared.
 *        Asked again whenever the list is filtered, so it can follow what the site has switched on.
 *        An entry with `inline: true` goes in at the caret without disturbing the line, which makes it
 *        one of the entries offered mid-line.
 */
export function slashMenu({ onUpdate, t, getItems }) {
  // -> The host's entries come with their words already in place; these are written as string keys
  const label = (item) => item.title ?? t(...item.label)
  const hint = (item) => item.description ?? t(item.hint)

  /**
   * The entries a query leaves, matched on the start of any word of the label or of a keyword -- with
   * the ones the query names exactly first, so `/hr` is the horizontal line even though another entry
   * listed ahead of it could have a word starting with those letters. Otherwise in their own order.
   *
   * Mid-line (`inline`), only the entries that go in at the caret: every other one replaces the line.
   */
  function itemsFor(query, inline) {
    const everything = [...SLASH_ITEMS, ...getItems()]
    const all = inline ? everything.filter((item) => item.inline) : everything
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) {
      return all
    }
    const words = (item) => [label(item).toLocaleLowerCase(), ...item.keywords]
    const matching = all.filter((item) =>
      words(item).some((word) => word.startsWith(needle) || word.includes(` ${needle}`))
    )
    const exact = (item) => words(item).includes(needle)
    const ranked = [...matching.filter(exact), ...matching.filter((item) => !exact(item))]
    // -> Each group kept together, so its heading is drawn once: the groups in the order they now
    //    first appear, which puts the exact match's group, and the match, at the top
    const groups = [...new Set(ranked.map((item) => item.group))]
    return groups.flatMap((group) => ranked.filter((item) => item.group === group))
  }

  /** The state of a menu that has just opened, with nothing typed into it yet. */
  function opened(from, prefix, inline) {
    return { from, prefix, inline, query: '', items: itemsFor('', inline), index: 0 }
  }

  /**
   * Ctrl+Space: the whole menu on an empty line, where a `/` would have opened it, and the inline
   * entries anywhere else that can take them. Nothing is typed, so the query starts at the caret.
   *
   * @returns {boolean} Whether it opened; when it did not, the key is left to the browser.
   */
  function openFromShortcut(view) {
    const { state } = view
    if (!view.editable || !state.selection.empty) {
      return false
    }
    const { $from } = state.selection
    const inline = !isEmptyMenuLine($from)
    if (inline && !takesInline(state)) {
      return false
    }
    const menu = opened($from.pos, '', inline)
    if (menu.items.length < 1) {
      return false
    }
    view.dispatch(state.tr.setMeta(key, menu))
    return true
  }

  return new Plugin({
    key,

    /*
      `{ from, prefix, inline, query, items, index }` while the menu is open, null while it is not.
      Opened only by the transaction `handleTextInput` makes for a typed `/` (`prefix` '/') and by the
      shortcut (`prefix` ''), so moving the caret onto a line that happens to start with one, a paste
      and a collaborator's typing never open it. Closed by Escape, by a query nothing matches, and by
      anything that makes `queryAt` give up -- and, mid-line, by the caret moving on its own, since
      picking an entry there deletes what lies between where the menu opened and the caret, and that
      must never be words the author did not type into it.

      `from` is mapped to stay put when text is typed right at it: with no `/` in front, the first
      letter of the query goes in exactly there.
    */
    state: {
      init: () => null,
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(key)
        if (meta !== undefined) {
          return meta
        }
        if (!prev) {
          return null
        }
        if (prev.inline && !tr.docChanged && tr.selectionSet) {
          return null
        }
        const from = tr.mapping.map(prev.from, -1)
        const query = queryAt(newState, { ...prev, from })
        if (query === null) {
          return null
        }
        if (query === prev.query) {
          return from === prev.from ? prev : { ...prev, from }
        }
        const items = itemsFor(query, prev.inline)
        return items.length > 0 ? { ...prev, from, query, items, index: 0 } : null
      }
    },

    props: {
      /*
        "Type '/' for quick menu" on the empty line the caret is in, wherever a `/` would open the menu
        -- a node decoration carrying the words, which the stylesheet draws in front of the caret only
        while the editor is focused and editable. Nothing is written into the document, so nothing is
        serialized, shared with collaborators or undone.
      */
      decorations(state) {
        const { selection } = state
        // -> Not under a menu the shortcut opened on it, which is the answer to what the words suggest
        if (!selection.empty || !isEmptyMenuLine(selection.$from) || key.getState(state)) {
          return null
        }
        const { $from } = selection
        return DecorationSet.create(state.doc, [
          Decoration.node($from.before(), $from.after(), {
            class: 'visual-slash-placeholder',
            'data-placeholder': t('editor.visual.slash.placeholder')
          })
        ])
      },

      handleTextInput(view, from, to, text) {
        if (text !== '/' || key.getState(view.state) || !opensAt(view.state, from, to)) {
          return false
        }
        const tr = view.state.tr.insertText(text, from, to)
        view.dispatch(tr.setMeta(key, opened(from, '/', false)))
        return true
      },

      /*
        Ahead of the editor's keymap, which is why this plugin is first in the list: Enter would
        otherwise split the line and the arrows move the caret before the menu ever saw them.
      */
      handleKeyDown(view, event) {
        if (view.composing) {
          return false
        }
        const menu = key.getState(view.state)
        if (isMenuShortcut(event)) {
          // -> Swallowed while the menu is open, so that it does not reopen over itself
          return Boolean(menu) || openFromShortcut(view)
        }
        if (!menu) {
          return false
        }
        switch (event.key) {
          case 'ArrowDown':
          case 'ArrowUp': {
            const step = event.key === 'ArrowDown' ? 1 : -1
            highlightSlashItem(view, (menu.index + step + menu.items.length) % menu.items.length)
            return true
          }
          case 'Enter':
          case 'Tab':
            chooseSlashItem(view, menu.index)
            return true
          case 'Escape':
            view.dispatch(view.state.tr.setMeta(key, null))
            return true
        }
        return false
      },

      handleDOMEvents: {
        // -> The menu stops the mousedown that would blur the editor, so a blur is the author leaving
        blur(view) {
          if (key.getState(view.state)) {
            view.dispatch(view.state.tr.setMeta(key, null))
          }
          return false
        }
      }
    },

    view(editorView) {
      const surface = editorView.dom.parentNode
      const update = (view, prevState) => {
        const menu = key.getState(view.state)
        // -> Unchanged, or open over a document that changed, which may have moved the line
        if (
          prevState &&
          menu === key.getState(prevState) &&
          (!menu || view.state.doc === prevState.doc)
        ) {
          return
        }
        if (!menu) {
          onUpdate(null)
          return
        }
        const coords = view.coordsAtPos(menu.from)
        const box = surface.getBoundingClientRect()
        onUpdate({
          items: menu.items.map((item) => ({
            key: item.key,
            group: item.group,
            groupLabel: t(SLASH_GROUPS[item.group]),
            icon: item.icon,
            iconClass: item.iconClass ?? '',
            label: label(item),
            hint: hint(item)
          })),
          index: menu.index,
          top: coords.top - box.top,
          bottom: coords.bottom - box.top,
          left: Math.max(0, coords.left - box.left)
        })
      }
      update(editorView, null)
      return {
        update,
        destroy: () => onUpdate(null)
      }
    }
  })
}

/** Highlight an entry, for the arrow keys and the mouse. */
export function highlightSlashItem(view, index) {
  const menu = key.getState(view.state)
  if (menu && index !== menu.index && index >= 0 && index < menu.items.length) {
    view.dispatch(view.state.tr.setMeta(key, { ...menu, index }))
  }
}

/**
 * Pick an entry: the `/` and the query go, and the line becomes what was picked.
 *
 * The line is made a paragraph before anything is wrapped round it, since a list item, a quote and an
 * admonition may each hold a heading, and an emptied Header 2 picked as one would otherwise stay a
 * heading inside it -- and before a host's entry inserts anything, for the same reason. Any `{#id}` or
 * class the line carried stays with it, as it does when the toolbar changes a heading's level.
 *
 * The wrap is a second transaction, because those commands are written against a state and would have
 * to be taught to continue someone else's transaction. Both land in the same undo step regardless --
 * the history groups changes this close together and this adjacent. A host's `run` comes last and
 * after the focus is back in the document, so a dialog it opens is not then robbed of it.
 */
export function chooseSlashItem(view, index) {
  const menu = key.getState(view.state)
  const item = menu?.items[index]
  if (!item) {
    return
  }
  // -> Mid-line, only the query goes, and the entry is put where it was
  if (menu.inline) {
    const to = Math.max(menu.from, view.state.selection.from)
    view.dispatch(view.state.tr.delete(menu.from, to).setMeta(key, null))
    view.focus()
    item.run?.()
    return
  }
  const $line = view.state.doc.resolve(menu.from)
  const { mdAttrs } = $line.parent.attrs
  const [type, attrs] = item.level
    ? [schema.nodes.heading, { level: item.level, mdAttrs }]
    : [schema.nodes.paragraph, { mdAttrs }]
  const tr = view.state.tr.delete(menu.from, $line.end())
  view.dispatch(tr.setBlockType(menu.from, menu.from, type, attrs).setMeta(key, null))
  item.wrap?.(view.state, view.dispatch)
  view.focus()
  item.run?.()
}
