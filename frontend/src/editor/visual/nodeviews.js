import { TextSelection } from 'prosemirror-state'

import { fileSrc, twemojiHtml } from '@/renderers/markdown'

import { schema } from './schema'

/**
 * How the nodes that are more than text draw themselves in the Visual editor.
 *
 * The guiding idea: a block should look here the way it will look on the page, because that is the
 * whole promise of editing visually. Blocks are already custom elements served from `/_blocks/`, and
 * the preview pane of the Markdown editor already mounts them — so this mounts the very same element
 * with the very same rendered body, and the author sees the real thing rather than a placeholder
 * standing in for it.
 *
 * What a node view must not do is let ProseMirror and the component fight over the same DOM. A Lit
 * element rewrites its own subtree whenever it likes, which ProseMirror reads as the document being
 * edited from underneath it — hence `ignoreMutation` on everything that is not `contentDOM`, and
 * `stopEvent` over the parts an author is meant to interact with rather than type into.
 */

/** A block's parameters, as a short line for its header — enough to tell two of them apart. */
function summarize(attrs) {
  const entries = Object.entries(attrs ?? {}).filter(([, value]) => value !== '' && value != null)
  if (entries.length === 0) {
    return ''
  }
  return entries.map(([name, value]) => `${name}: ${value}`).join('  ·  ')
}

/** One button in a node's header bar. */
function headerButton(label, title, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'visual-node-action'
  button.textContent = label
  button.title = title
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return button
}

/**
 * The bar above a block, naming it and offering what can be done to it.
 *
 * Outside the document: it is chrome, not content, so it carries `contenteditable=false` and swallows
 * its own mouse events rather than moving the selection into a node that has no text to put it in.
 */
function blockHeader({ name, attrs, actions }) {
  const header = document.createElement('div')
  header.className = 'visual-node-header'
  header.contentEditable = 'false'

  const title = document.createElement('span')
  title.className = 'visual-node-name'
  title.textContent = name
  header.append(title)

  const summary = summarize(attrs)
  if (summary) {
    const detail = document.createElement('span')
    detail.className = 'visual-node-summary'
    detail.textContent = summary
    header.append(detail)
  }

  const group = document.createElement('span')
  group.className = 'visual-node-actions'
  for (const action of actions) {
    group.append(headerButton(action.label, action.title, action.run))
  }
  header.append(group)
  return header
}

/**
 * A block component with no editable content of its own — a map, a diagram, a formula.
 *
 * Drawn as the real element, with its body rendered by the site's own markdown pipeline, because a
 * block that carries a fenced source reads that source out of a `<pre>` among its children and would
 * show nothing at all if handed the raw text.
 */
class BlockComponentView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.context = context

    this.dom = document.createElement('div')
    this.dom.className = 'visual-block'
    this.dom.append(
      blockHeader({
        name: node.attrs.name,
        attrs: node.attrs.blockAttrs,
        actions: this.actions()
      })
    )

    this.preview = document.createElement('div')
    this.preview.className = 'visual-block-preview page-contents'
    this.preview.contentEditable = 'false'
    this.dom.append(this.preview)

    this.render()
  }

  actions() {
    const actions = []
    // -> Only where there is something to fill in: a block declaring no props opens an empty form
    if (this.context.hasProps(this.node.attrs.name)) {
      actions.push({
        label: this.context.t('editor.visual.block.parameters'),
        title: this.context.t('editor.visual.block.parametersHint'),
        run: () => this.context.editBlockParams(this.node, this.getPos())
      })
    }
    if (this.context.hasContentEditor(this.node.attrs.name)) {
      actions.push({
        label: this.context.t('editor.visual.block.content'),
        title: this.context.t('editor.visual.block.contentHint'),
        run: () => this.context.editBlockContent(this.node, this.getPos())
      })
    }
    actions.push({
      label: this.context.t('editor.visual.block.remove'),
      title: this.context.t('editor.visual.block.removeHint'),
      run: () => this.context.removeNode(this.getPos())
    })
    return actions
  }

  render() {
    const tag = `block-${this.node.attrs.name}`
    const element = document.createElement(tag)
    for (const [name, value] of Object.entries(this.node.attrs.blockAttrs ?? {})) {
      // -> An attribute name a block declares is not necessarily a valid one to set; a block with a
      //    malformed parameter should draw as a block with a missing parameter, not take the page down
      try {
        element.setAttribute(name, String(value))
      } catch {
        /* ignored */
      }
    }
    if (this.node.attrs.body) {
      element.innerHTML = this.context.renderMarkdown(this.node.attrs.body)
    }
    this.preview.replaceChildren(element)

    if (this.context.isDisabled(tag)) {
      this.dom.dataset.blockDisabled = ''
      const notice = document.createElement('p')
      notice.className = 'block-disabled-notice'
      notice.textContent = this.context.t('editor.blockNotEnabled')
      this.preview.prepend(notice)
    } else {
      delete this.dom.dataset.blockDisabled
      this.context.ensureBlockLoaded(tag)
    }
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    const changed =
      node.attrs.name !== this.node.attrs.name ||
      node.attrs.body !== this.node.attrs.body ||
      JSON.stringify(node.attrs.blockAttrs) !== JSON.stringify(this.node.attrs.blockAttrs)
    this.node = node
    if (changed) {
      this.dom.replaceChildren(
        blockHeader({
          name: node.attrs.name,
          attrs: node.attrs.blockAttrs,
          actions: this.actions()
        }),
        this.preview
      )
      this.render()
    }
    return true
  }

  /** The component owns everything below `preview`; none of it is the document changing. */
  ignoreMutation() {
    return true
  }

  /** A click inside a block is aimed at the block, not at a caret position behind it. */
  stopEvent(event) {
    return (
      this.preview.contains(event.target) ||
      this.dom.querySelector('.visual-node-header')?.contains(event.target)
    )
  }

  selectNode() {
    this.dom.classList.add('is-selected')
  }

  deselectNode() {
    this.dom.classList.remove('is-selected')
  }
}

/**
 * The actions a container block offers, which is a parameters form where it declares props.
 *
 * Shared by the generic container and the tab panels, so that "this block has nothing to configure"
 * is answered the same way everywhere.
 */
function containerActions(view) {
  const actions = []
  if (view.context.hasProps(view.node.attrs.name)) {
    actions.push({
      label: view.context.t('editor.visual.block.parameters'),
      title: view.context.t('editor.visual.block.parametersHint'),
      run: () => view.context.editBlockParams(view.node, view.getPos())
    })
  }
  actions.push({
    label: view.context.t('editor.visual.block.remove'),
    title: view.context.t('editor.visual.block.removeKeepHint'),
    run: () => view.context.liftNode(view.getPos())
  })
  return actions
}

/**
 * A block component whose body is page content — a spoiler, a set of steps.
 *
 * Drawn as a labelled frame rather than as the real element, and deliberately: what is inside is the
 * article's own markdown and has to stay a ProseMirror-managed part of the document.
 *
 * A tabset is the exception and has a view of its own below, because a stack of labelled frames is not
 * what a tabset is.
 */
class BlockContainerView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.getPos = getPos
    this.context = context

    this.dom = document.createElement('div')
    this.dom.className = 'visual-block-container'
    this.dom.dataset.block = node.attrs.name

    this.header = blockHeader({
      name: node.attrs.name,
      attrs: node.attrs.blockAttrs,
      actions: containerActions(this)
    })
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'visual-block-body'
    this.dom.append(this.header, this.contentDOM)
  }

  update(node) {
    if (node.type !== this.node.type || node.attrs.name !== this.node.attrs.name) {
      return false
    }
    const changed =
      JSON.stringify(node.attrs.blockAttrs) !== JSON.stringify(this.node.attrs.blockAttrs)
    this.node = node
    if (changed) {
      const header = blockHeader({
        name: node.attrs.name,
        attrs: node.attrs.blockAttrs,
        actions: containerActions(this)
      })
      this.header.replaceWith(header)
      this.header = header
    }
    return true
  }

  /** Only the header, which is chrome; the body is `contentDOM` and ProseMirror owns it. */
  ignoreMutation(mutation) {
    return this.header.contains(mutation.target)
  }

  stopEvent(event) {
    return this.header.contains(event.target)
  }
}

/**
 * One panel of a tabset: its content and nothing else.
 *
 * No header of its own, because the tabset draws the strip and a panel is only ever seen through it —
 * a frame per panel would be a second, competing set of furniture around the same thing. Which panel
 * is showing is the tabset's business too: it puts `is-active` on exactly one of these.
 */
class TabPanelView {
  constructor(node) {
    this.node = node
    this.dom = document.createElement('div')
    this.dom.className = 'visual-tab-panel'
    this.contentDOM = document.createElement('div')
    this.dom.append(this.contentDOM)
  }

  update(node) {
    if (node.type !== this.node.type || node.attrs.name !== this.node.attrs.name) {
      return false
    }
    this.node = node
    return true
  }

  /*
    The tabset shows and hides these by putting a class on them, which is a mutation of an attribute
    on a node ProseMirror manages. Left unignored, it reads as the document having been edited from
    underneath the editor.
  */
  ignoreMutation(mutation) {
    return mutation.type === 'attributes'
  }
}

/**
 * A tabset, drawn as tabs.
 *
 * The previous view stacked every panel one under the other in its own labelled frame, which is not
 * what a tabset is: it gave no way to add one, no way to rename one, and no way to see the thing being
 * written the way a reader will see it. This draws the strip — one button per panel, the active one
 * showing its content and the rest hidden, and a `+` at the end.
 *
 * The panels stay ProseMirror content throughout. Only which of them is SHOWING is this view's own
 * state, held here rather than in the document, because it is a question about the editor and not
 * about the page: nothing in the markdown says which tab was open while somebody was writing.
 */
class TabsetView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.context = context
    this.active = 0

    this.dom = document.createElement('div')
    this.dom.className = 'visual-tabs'

    this.strip = document.createElement('div')
    this.strip.className = 'visual-tabs-strip'
    this.strip.contentEditable = 'false'

    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'visual-tabs-panels'

    this.dom.append(this.strip, this.contentDOM)
    this.render()
  }

  /** What each panel calls itself, falling back to something rather than an empty button. */
  labelOf(child, index) {
    const label = child.attrs.blockAttrs?.label
    return label && String(label).trim()
      ? String(label)
      : this.context.t('editor.visual.tabs.untitled', { index: index + 1 })
  }

  render() {
    const buttons = []
    this.node.forEach((child, _offset, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `visual-tabs-tab${index === this.active ? ' is-active' : ''}`
      /*
        The tab's own icon, where it has one -- `block-tabs` draws it to the left of the label on the
        page, so a strip without it is a strip that does not show what the field does.
      */
      const icon = child.attrs.blockAttrs?.icon
      if (icon) {
        const glyph = document.createElement('iconify-icon')
        glyph.setAttribute('icon', String(icon))
        button.append(glyph)
      }
      button.append(document.createTextNode(this.labelOf(child, index)))
      button.title = this.context.t('editor.visual.tabs.switchHint')
      button.addEventListener('mousedown', (event) => event.preventDefault())
      button.addEventListener('click', () => this.activate(index))
      // -> Renaming is the thing anybody does most, so it is on the tab rather than behind a menu
      button.addEventListener('dblclick', () => this.editTab(index))
      buttons.push(button)
    })

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'visual-tabs-add'
    add.textContent = '+'
    add.title = this.context.t('editor.visual.tabs.add')
    add.addEventListener('mousedown', (event) => event.preventDefault())
    add.addEventListener('click', () => this.addTab())
    buttons.push(add)

    /*
      What can be done to the panel that is showing. On the strip rather than on each tab, so the row
      of tabs stays a row of tabs however many there are.
    */
    const tools = document.createElement('span')
    tools.className = 'visual-tabs-tools'
    if (this.node.childCount > 0) {
      tools.append(
        headerButton(
          this.context.t('editor.visual.tabs.settings'),
          this.context.t('editor.visual.tabs.settingsHint'),
          () => this.editTab(this.active)
        ),
        headerButton(
          this.context.t('editor.visual.tabs.removeTab'),
          this.context.t('editor.visual.tabs.removeTabHint'),
          () => this.removeTab(this.active)
        )
      )
    }
    tools.append(
      headerButton(
        this.context.t('editor.visual.block.remove'),
        this.context.t('editor.visual.tabs.removeSetHint'),
        () => this.context.liftNode(this.getPos())
      )
    )
    buttons.push(tools)

    this.strip.replaceChildren(...buttons)
    this.applyActive()
  }

  /**
   * Show exactly one panel.
   *
   * On a microtask, and that is not a flourish: ProseMirror calls a node view's `update` BEFORE it
   * reconciles that node's children, and the constructor runs before there are any children at all.
   * Reaching into `contentDOM` at either moment finds the panels of the PREVIOUS document, or none —
   * which showed as a tabset with every panel hidden until something else happened to redraw it.
   * Deferring puts this after the whole synchronous pass, when the panels are the node's own.
   */
  applyActive() {
    queueMicrotask(() => {
      for (const [index, panel] of [...this.contentDOM.children].entries()) {
        panel.classList.toggle('is-active', index === this.active)
      }
    })
  }

  /**
   * Switch to a panel, and put the caret in it.
   *
   * Moving the selection is what makes the tabs feel like tabs rather than a filter over the content:
   * somebody who clicked a tab means to write in it.
   */
  activate(index) {
    this.active = index
    this.render()
    const pos = this.getPos()
    if (pos === undefined) {
      return
    }
    let inner = pos + 1
    this.node.forEach((child, offset, at) => {
      if (at === index) {
        inner = pos + 1 + offset + 1
      }
    })
    const tr = this.view.state.tr
    tr.setSelection(TextSelection.near(tr.doc.resolve(inner)))
    this.view.dispatch(tr)
    this.view.focus()
  }

  /** A new empty panel at the end, which becomes the one showing. */
  addTab() {
    const pos = this.getPos()
    if (pos === undefined) {
      return
    }
    const tab = schema.nodes.block_container.createAndFill({
      name: 'tab',
      blockAttrs: { label: this.context.t('editor.visual.tabs.newTab') }
    })
    if (!tab) {
      return
    }
    // -> Just inside the closing fence, which is where the last panel ends
    const end = pos + this.node.nodeSize - 1
    this.active = this.node.childCount
    const tr = this.view.state.tr.insert(end, tab)
    /*
      And the caret into the panel that was just made. Without this it stays wherever it was -- in
      whichever tab was open before -- so the first thing typed after pressing `+` went into the old
      panel while the new one sat empty and showing.
    */
    tr.setSelection(TextSelection.near(tr.doc.resolve(end + 2)))
    this.view.dispatch(tr.scrollIntoView())
    this.view.focus()
  }

  removeTab(index) {
    const pos = this.getPos()
    if (pos === undefined || this.node.childCount === 0) {
      return
    }
    let from = null
    let to = null
    this.node.forEach((child, offset, at) => {
      if (at === index) {
        from = pos + 1 + offset
        to = from + child.nodeSize
      }
    })
    if (from === null) {
      return
    }
    this.active = Math.max(0, index - 1)
    this.view.dispatch(this.view.state.tr.delete(from, to))
    this.view.focus()
  }

  /** The panel's own parameters — its label, its icon and whether it is listed in the contents. */
  editTab(index) {
    const pos = this.getPos()
    if (pos === undefined) {
      return
    }
    let child = null
    let childPos = null
    this.node.forEach((entry, offset, at) => {
      if (at === index) {
        child = entry
        childPos = pos + 1 + offset
      }
    })
    if (!child) {
      return
    }
    this.active = index
    this.context.editBlockParams(child, childPos)
  }

  update(node) {
    if (node.type !== this.node.type || node.attrs.name !== this.node.attrs.name) {
      return false
    }
    this.node = node
    // -> A panel may have gone; never point past the end
    this.active = Math.min(this.active, Math.max(0, node.childCount - 1))
    this.render()
    return true
  }

  /** The strip is chrome, and so is the class the panels are shown and hidden with. */
  ignoreMutation(mutation) {
    return this.strip.contains(mutation.target) || mutation.type === 'attributes'
  }

  stopEvent(event) {
    return this.strip.contains(event.target)
  }
}

/** A fenced code block, with its info string shown and editable as a field of its own. */
class CodeBlockView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.context = context

    this.dom = document.createElement('div')
    this.dom.className = 'visual-code'

    this.header = document.createElement('div')
    this.header.className = 'visual-node-header'
    this.header.contentEditable = 'false'

    this.params = document.createElement('input')
    this.params.className = 'visual-code-params'
    this.params.value = node.attrs.params ?? ''
    this.params.placeholder = 'language'
    this.params.spellcheck = false
    /*
      The whole info string, not just the language: `title`, `linesStart` and `linesHighlight` are
      written here too and the renderer reads them off this line. One field for the lot means a fence
      the editor has no form for is still editable rather than frozen.
    */
    this.params.addEventListener('change', () => this.applyParams())
    this.params.addEventListener('blur', () => this.applyParams())
    this.header.append(this.params)

    if (node.attrs.indented) {
      const note = document.createElement('span')
      note.className = 'visual-node-summary'
      note.textContent = 'indented'
      this.header.append(note)
    }

    const pre = document.createElement('pre')
    this.contentDOM = document.createElement('code')
    pre.append(this.contentDOM)
    this.dom.append(this.header, pre)
  }

  applyParams() {
    const value = this.params.value.trim()
    if (value === (this.node.attrs.params ?? '')) {
      return
    }
    const pos = this.getPos()
    if (pos === undefined) {
      return
    }
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        params: value,
        // -> Naming a language is asking for a fence; an indented block cannot carry one
        indented: value ? false : this.node.attrs.indented
      })
    )
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    if (document.activeElement !== this.params) {
      this.params.value = node.attrs.params ?? ''
    }
    return true
  }

  ignoreMutation(mutation) {
    return this.header.contains(mutation.target)
  }

  stopEvent(event) {
    return this.header.contains(event.target)
  }
}

/**
 * An image, drawn from where it will actually load.
 *
 * A page's source points at a picture the way a file beside it would — `photo.png` — and the renderer
 * resolves that to `/_files/…` at render time. The same resolution is used here, so the editor shows
 * the picture rather than a broken icon, while the source keeps the path that was written.
 */
class ImageView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.context = context
    this.dom = document.createElement('img')
    this.apply(node)
  }

  apply(node) {
    this.dom.src = fileSrc(node.attrs.src, this.context.pagePath())
    this.dom.alt = node.attrs.alt ?? ''
    this.dom.title = node.attrs.title ?? ''
    if (node.attrs.width) {
      this.dom.setAttribute('width', node.attrs.width)
    } else {
      this.dom.removeAttribute('width')
    }
    if (node.attrs.height) {
      this.dom.setAttribute('height', node.attrs.height)
    } else {
      this.dom.removeAttribute('height')
    }
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    this.apply(node)
    return true
  }

  selectNode() {
    this.dom.classList.add('is-selected')
  }

  deselectNode() {
    this.dom.classList.remove('is-selected')
  }
}

/**
 * An Iconify reference, drawn as the icon it names.
 *
 * `iconify-icon` resolves against this instance's own `/_icons`, exactly as `WIcon` does — so an icon
 * an author picked shows here without the editor needing to know anything about icon sets.
 */
class IconView {
  constructor(node) {
    this.node = node
    this.dom = document.createElement('iconify-icon')
    this.dom.setAttribute('icon', node.attrs.reference)
    this.dom.className = 'visual-icon'
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    this.dom.setAttribute('icon', node.attrs.reference)
    return true
  }

  ignoreMutation() {
    return true
  }
}

/**
 * A field in a node's header that writes straight back into the document.
 *
 * The pattern behind the alert's title, the abbreviation's two halves and the code fence's info
 * string. All of them are single-line strings that belong to the node rather than to its content, and
 * a node attribute is not something a caret can be put in — so they are real inputs, outside the
 * document, that dispatch a `setNodeMarkup` when they settle.
 */
function attrField({ value, placeholder, className, onCommit }) {
  const input = document.createElement('input')
  input.className = className
  input.value = value ?? ''
  input.placeholder = placeholder
  input.spellcheck = false
  input.addEventListener('change', () => onCommit(input.value))
  input.addEventListener('blur', () => onCommit(input.value))
  /*
    Enter commits rather than reaching the document, where it would split whatever textblock the
    selection happens to be in — the caret is in this field, but ProseMirror does not know that.
  */
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      input.blur()
    }
  })
  return input
}

/** Write one attribute of the node at `pos`, leaving the rest alone. */
function commitAttr(view, getPos, node, name, value) {
  const pos = getPos()
  if (pos === undefined) {
    return
  }
  const current = view.state.doc.nodeAt(pos)
  if (!current || current.attrs[name] === value) {
    return
  }
  view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, [name]: value }))
}

/**
 * A GitHub-style alert, with its title editable in place.
 *
 * The title is one line of the marker rather than part of the body — `> [!NOTE] Mind the gap` — so it
 * cannot be a child node, and an author still has to be able to change it without opening anything.
 */
class AlertView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.context = context

    this.dom = document.createElement('blockquote')
    this.dom.className = `visual-alert ${context.alertClass(node.attrs.kind)}`
    this.dom.dataset.alert = node.attrs.kind

    this.header = document.createElement('div')
    this.header.className = 'visual-alert-header'
    this.header.contentEditable = 'false'

    this.kind = document.createElement('span')
    this.kind.className = 'visual-alert-kind'
    this.kind.textContent = node.attrs.kind
    this.title = attrField({
      value: node.attrs.title,
      placeholder: context.alertLabel(node.attrs.kind),
      className: 'visual-alert-title',
      onCommit: (value) => commitAttr(view, getPos, this.node, 'title', value.trim() || null)
    })
    this.header.append(this.kind, this.title)

    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'visual-alert-body'
    this.dom.append(this.header, this.contentDOM)
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    this.dom.className = `visual-alert ${this.context.alertClass(node.attrs.kind)}`
    this.dom.dataset.alert = node.attrs.kind
    this.kind.textContent = node.attrs.kind
    this.title.placeholder = this.context.alertLabel(node.attrs.kind)
    if (document.activeElement !== this.title) {
      this.title.value = node.attrs.title ?? ''
    }
    return true
  }

  ignoreMutation(mutation) {
    return this.header.contains(mutation.target)
  }

  stopEvent(event) {
    return this.header.contains(event.target)
  }
}

/**
 * An abbreviation definition, as the two fields it is.
 *
 * An atom, because `*[HTML]: Hyper Text Markup Language` is a declaration rather than prose — nothing
 * in it is part of the page's text, and the renderer consumes the line entirely. The editor is the
 * only place it is ever visible to the author who wrote it, which is why it is shown at all.
 */
class AbbreviationView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'visual-abbreviation'
    this.dom.contentEditable = 'false'

    const marker = document.createElement('span')
    marker.className = 'visual-node-name'
    marker.textContent = context.t('editor.visual.abbreviation')

    this.label = attrField({
      value: node.attrs.label,
      placeholder: context.t('editor.markup.abbreviationTerm'),
      className: 'visual-abbreviation-label',
      onCommit: (value) => commitAttr(view, getPos, this.node, 'label', value.trim())
    })
    this.title = attrField({
      value: node.attrs.title,
      placeholder: context.t('editor.markup.abbreviationDefinition'),
      className: 'visual-abbreviation-title',
      onCommit: (value) => commitAttr(view, getPos, this.node, 'title', value.trim())
    })
    this.dom.append(marker, this.label, this.title)
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    if (document.activeElement !== this.label) {
      this.label.value = node.attrs.label ?? ''
    }
    if (document.activeElement !== this.title) {
      this.title.value = node.attrs.title ?? ''
    }
    return true
  }

  ignoreMutation() {
    return true
  }

  stopEvent() {
    return true
  }
}

/**
 * A definition list, with a bar of its own and every row saying which half of the pair it is.
 *
 * The one construct in this editor with nothing to look at. A `dl` is terms and definitions
 * alternating, both of them empty when the list is made, and the page styles alone say nothing: an
 * author who pressed the toolbar button got a blank patch, could not tell which of the two invisible
 * rows the caret was in, and had no way to add a third. So the rows are labelled in a gutter (see
 * `DefinitionRowView`), an empty one shows what belongs in it, and the bar offers the two things
 * there are to do to a list that already exists.
 *
 * The bar is chrome, so the `dl` the rows live in is a child of it rather than the node's own DOM.
 */
class DefinitionListView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.context = context

    this.dom = document.createElement('div')
    this.dom.className = 'visual-deflist'

    this.header = blockHeader({
      name: context.t('editor.visual.deflist.title'),
      attrs: null,
      actions: [
        {
          label: context.t('editor.visual.deflist.addTerm'),
          title: context.t('editor.visual.deflist.addTermHint'),
          run: () => this.addRow(schema.nodes.definition_term)
        },
        {
          label: context.t('editor.visual.deflist.addDefinition'),
          title: context.t('editor.visual.deflist.addDefinitionHint'),
          run: () => this.addRow(schema.nodes.definition_description)
        },
        {
          label: context.t('editor.visual.block.remove'),
          title: context.t('editor.visual.deflist.removeHint'),
          run: () => this.context.removeNode(this.getPos())
        }
      ]
    })

    this.contentDOM = document.createElement('dl')
    this.contentDOM.className = 'visual-deflist-rows'
    this.dom.append(this.header, this.contentDOM)
  }

  /**
   * A new row, and the caret in it.
   *
   * After the row the author is in rather than at the end of the list: a list long enough to need
   * another term in the middle of it is exactly the list where being sent to the bottom is wrong. The
   * end is the fallback, for a press with the selection somewhere else entirely.
   */
  addRow(type) {
    const pos = this.getPos()
    if (pos === undefined) {
      return
    }
    const row = type.createAndFill()
    if (!row) {
      return
    }
    let at = pos + this.node.nodeSize - 1
    const { from } = this.view.state.selection
    this.node.forEach((child, offset) => {
      const start = pos + 1 + offset
      if (from >= start && from <= start + child.nodeSize) {
        at = start + child.nodeSize
      }
    })
    const tr = this.view.state.tr.insert(at, row)
    tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)))
    this.view.dispatch(tr.scrollIntoView())
    this.view.focus()
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    return true
  }

  ignoreMutation(mutation) {
    return this.header.contains(mutation.target)
  }

  stopEvent(event) {
    return this.header.contains(event.target)
  }
}

/**
 * One row of a definition list — the `dt` or the `dd` itself, told what it is.
 *
 * The element is its own content: there is nowhere to put a label INSIDE a node whose children are
 * the document's own text without ProseMirror reading it as something an author typed. So the label
 * and the placeholder are data attributes that `_visual-editor.scss` draws as pseudo-elements, and
 * the only thing this view does is keep them, and the empty flag, in step with the node.
 */
class DefinitionRowView {
  constructor(node, { tag, label, placeholder, isEmpty }) {
    this.node = node
    this.isEmpty = isEmpty

    this.dom = document.createElement(tag)
    // -> Its own content: the row is a textblock, and a wrapper would put a node between the `dl` and
    //    the rows that the page's own stylesheet does not have
    this.contentDOM = this.dom
    this.dom.dataset.label = label
    this.dom.dataset.placeholder = placeholder
    this.apply(node)
  }

  apply(node) {
    this.dom.classList.toggle('is-empty', this.isEmpty(node))
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    this.apply(node)
    return true
  }

  /** The class and the two data attributes are this view's own; the text inside them is not. */
  ignoreMutation(mutation) {
    return mutation.type === 'attributes'
  }
}

/** A footnote's body, labelled with the reference that points at it. */
class FootnoteDefinitionView {
  constructor(node) {
    this.node = node
    this.dom = document.createElement('div')
    this.dom.className = 'visual-footnote'

    this.label = document.createElement('span')
    this.label.className = 'visual-footnote-label'
    this.label.contentEditable = 'false'
    this.label.textContent = `[^${node.attrs.label}]`

    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'visual-footnote-body'
    this.dom.append(this.label, this.contentDOM)
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    this.label.textContent = `[^${node.attrs.label}]`
    return true
  }

  ignoreMutation(mutation) {
    return this.label.contains(mutation.target)
  }
}

/**
 * Markdown this editor has no node for, shown as the source it is and editable as text.
 *
 * The visible face of the escape hatch. Raw HTML lands here, and so would anything a future plugin
 * adds to the pipeline before the schema learns about it — an author sees exactly what is stored and
 * can change it, rather than a block that says the editor gave up.
 */
class RawBlockView {
  constructor(node, view, getPos, context) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'visual-raw'
    this.dom.contentEditable = 'false'

    const header = document.createElement('div')
    header.className = 'visual-node-header'
    const name = document.createElement('span')
    name.className = 'visual-node-name'
    name.textContent = context.t('editor.visual.rawMarkup')
    header.append(name)

    this.area = document.createElement('textarea')
    this.area.className = 'visual-raw-source'
    this.area.value = node.attrs.source ?? ''
    this.area.rows = Math.min(12, (node.attrs.source ?? '').split('\n').length + 1)
    this.area.spellcheck = false
    const commit = () => commitAttr(view, getPos, this.node, 'source', this.area.value)
    this.area.addEventListener('change', commit)
    this.area.addEventListener('blur', commit)

    this.dom.append(header, this.area)
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    if (document.activeElement !== this.area) {
      this.area.value = node.attrs.source ?? ''
    }
    return true
  }

  ignoreMutation() {
    return true
  }

  stopEvent() {
    return true
  }
}

/**
 * An emoji, drawn as the twemoji image the page will show rather than as a character.
 *
 * The character depends on what font the author's machine has, and on a machine with no emoji font it
 * is a blank box — which is precisely the kind of difference between the editor and the page that
 * editing visually is supposed to remove.
 */
class EmojiView {
  constructor(node) {
    this.node = node
    this.dom = document.createElement('span')
    this.dom.className = 'visual-emoji'
    this.apply(node)
  }

  apply(node) {
    /*
      The renderer's own markup, which is one `<img>`. Safe to assign: it is built by twemoji from a
      character this parser produced, and the only thing interpolated into it is a codepoint.
    */
    this.dom.innerHTML = node.attrs.char
      ? twemojiHtml(node.attrs.char)
      : `:${node.attrs.shortcode}:`
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    this.apply(node)
    return true
  }

  ignoreMutation() {
    return true
  }
}

/**
 * @param {object} context Everything the views need from the editor around them — see
 *        `EditorVisual.vue`, which is the only thing that builds one.
 */
export function createNodeViews(context) {
  return {
    block_component: (node, view, getPos) => new BlockComponentView(node, view, getPos, context),
    /*
      A tabset is drawn as tabs and a tab panel as bare content; everything else that holds page
      content gets the generic labelled frame.
    */
    block_container: (node, view, getPos) => {
      if (node.attrs.name === 'tabs') {
        return new TabsetView(node, view, getPos, context)
      }
      if (node.attrs.name === 'tab') {
        return new TabPanelView(node)
      }
      return new BlockContainerView(node, view, getPos, context)
    },
    code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos, context),
    alert: (node, view, getPos) => new AlertView(node, view, getPos, context),
    definition_list: (node, view, getPos) => new DefinitionListView(node, view, getPos, context),
    definition_term: (node) =>
      new DefinitionRowView(node, {
        tag: 'dt',
        label: context.t('editor.visual.deflist.term'),
        placeholder: context.t('editor.visual.deflist.termPlaceholder'),
        isEmpty: (row) => row.content.size === 0
      }),
    definition_description: (node) =>
      new DefinitionRowView(node, {
        tag: 'dd',
        label: context.t('editor.visual.deflist.definition'),
        placeholder: context.t('editor.visual.deflist.definitionPlaceholder'),
        // -> A definition holds blocks, so an untouched one is a paragraph with nothing in it
        isEmpty: (row) => row.childCount === 1 && row.firstChild.content.size === 0
      }),
    abbreviation: (node, view, getPos) => new AbbreviationView(node, view, getPos, context),
    footnote_definition: (node) => new FootnoteDefinitionView(node),
    raw_block: (node, view, getPos) => new RawBlockView(node, view, getPos, context),
    image: (node, view, getPos) => new ImageView(node, view, getPos, context),
    icon: (node) => new IconView(node),
    emoji: (node) => new EmojiView(node)
  }
}
