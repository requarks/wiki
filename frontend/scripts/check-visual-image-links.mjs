/*
  Regression checks for image links in the Visual editor's Yjs-13 representation.
  Run: node scripts/check-visual-image-links.mjs (Node 26, frontend dependencies installed).
  Uses the real parser, editor plugins, collaboration binding and clipboard in JSDOM; no server.
*/
import assert from 'node:assert/strict'
import { after, test } from 'node:test'

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

// Set up the browser globals before loading ProseMirror's view or collaboration binding.
const { JSDOM } = await import('jsdom')
const { window } = new JSDOM('<!doctype html><html><body></body></html>')
for (const name of [
  'window',
  'document',
  'Node',
  'HTMLElement',
  'HTMLImageElement',
  'MutationObserver'
]) {
  globalThis[name] = name === 'window' ? window : window[name]
}
globalThis.innerHeight = 1000
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
// JSDOM has no layout engine; these are only needed when an editor action scrolls its selection.
window.Range.prototype.getClientRects = () => []
window.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0 })
after(() => window.close())

const { MarkdownRenderer } = await import('../src/renderers/markdown.js')
const { createParser } = await import('../src/editor/visual/parse.js')
const { serialize } = await import('../src/editor/visual/serialize.js')
const { schema } = await import('../src/editor/visual/schema.js')
const { imageLinkStorage, storeImageLinks, imageLinkClipboardSerializer } =
  await import('../src/editor/visual/imageLinks.js')
const { findLink, applyLink, removeLink } = await import('../src/editor/visual/links.js')
const { applyImageEdit } = await import('../src/editor/visual/images.js')
const { buildSeed, collabFragment, seedIfEmpty } = await import('../src/editor/visual/collab.js')
const { WebsocketProvider } = await import('y-websocket')
const { VISUAL_EDITOR_SCHEMA } = await import('../../backend/helpers/visualEditorProtocol.ts')
const { EditorState, NodeSelection, TextSelection, AllSelection } =
  await import('prosemirror-state')
const { history, undo, redo } = await import('prosemirror-history')
const { EditorView } = await import('prosemirror-view')
const { DOMParser, DOMSerializer } = await import('prosemirror-model')
const {
  ySyncPlugin,
  yUndoPlugin,
  yUndoPluginKey,
  undo: yUndo,
  redo: yRedo
} = await import('y-prosemirror')
const { prosemirrorToYXmlFragment, yXmlFragmentToProseMirrorRootNode } =
  await import('y-prosemirror')
const Y = await import('yjs')

const config = { allowHTML: true, wikiLinks: true, lineBreaks: true, multimdTable: true }
const renderer = new MarkdownRenderer(config)
const parser = createParser(renderer, config)

function images(doc) {
  const found = []
  doc.descendants((node, pos) => {
    if (node.type === schema.nodes.image) found.push({ node, pos })
  })
  return found
}

function viewFor(doc) {
  const view = {
    state: EditorState.create({ doc, plugins: [imageLinkStorage(), history()] }),
    dispatch: (tr) => {
      view.state = view.state.apply(tr)
    },
    focus() {}
  }
  return view
}

function read(doc) {
  return yXmlFragmentToProseMirrorRootNode(collabFragment(doc), schema)
}

function seed(doc) {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, buildSeed(doc))
  return ydoc
}

const sources = {
  'a direct image link': '[![alt](pic.png)](/target)',
  'independent image and link attributes':
    '[![alt](pic.png "Picture" =100x200){.framed}](https://example.com "Destination"){target="_blank" .cta}',
  'one link around text and an image': '[before ![alt](pic.png) after](/target){#single .cta}',
  'separate adjacent image links': '[![one](one.png)](/one)[![two](two.png)](/two)',
  'two images in one link': '[![one](one.png)![two](two.png)](/both)',
  'an image in a table': '| Picture |\n| --- |\n| [![alt](pic.png)](/target) |',
  'a wikilink around an image': '[[Target|![alt](pic.png)]]'
}

for (const [name, source] of Object.entries(sources)) {
  test(`${name} survives parsing, Yjs seeding, binary reload and Markdown`, () => {
    const original = parser.parse(source)
    const pictures = images(original)
    assert.ok(pictures.length > 0)
    for (const { node } of pictures) {
      assert.ok(node.attrs.imageLink?.href)
      assert.equal(schema.marks.link.isInSet(node.marks), undefined)
    }
    const room = seed(original)
    const reloaded = new Y.Doc()
    try {
      Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(room))
      const actual = read(reloaded)
      assert.deepEqual(actual.toJSON(), original.toJSON())
      const markdown = serialize(actual)
      assert.deepEqual(parser.parse(markdown).toJSON(), original.toJSON())
      assert.equal(renderer.render(markdown), renderer.render(source))
      assert.equal(serialize(parser.parse(markdown)), markdown, 'a second save is stable')
    } finally {
      room.destroy()
      reloaded.destroy()
    }
  })
}

test('a plain image and ordinary text links keep their Markdown', () => {
  const source = '![alt](pic.png) and [text](/target)'
  const doc = parser.parse(source)
  assert.equal(images(doc)[0].node.attrs.imageLink, null)
  assert.equal(serialize(doc).trim(), source)
})

test('seeding also handles a link mark supplied directly by an editor command', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.node('image', { src: 'pic.png' }, null, [
        schema.marks.link.create({ href: '/target' })
      ])
    ])
  ])
  assert.deepEqual(buildSeed(doc), buildSeed(doc), 'the same source makes the same seed')
  const room = seed(doc)
  try {
    assert.deepEqual(read(room).toJSON(), storeImageLinks(doc).toJSON())
    assert.equal(images(read(room))[0].node.attrs.imageLink.href, '/target')
  } finally {
    room.destroy()
  }
})

test('the toolbar addMark action links an image without losing its selection', () => {
  const view = viewFor(parser.parse('![alt](pic.png)'))
  const { pos } = images(view.state.doc)[0]
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
  view.dispatch(view.state.tr.addMark(pos, pos + 1, schema.marks.link.create({ href: '/new' })))
  const image = images(view.state.doc)[0].node
  assert.equal(image.attrs.imageLink.href, '/new')
  assert.equal(schema.marks.link.isInSet(image.marks), undefined)
  assert.ok(view.state.selection instanceof NodeSelection)
  assert.equal(findLink(view.state).href, '/new')
})

test('editing and removing a mixed link keep its text and image', () => {
  const view = viewFor(parser.parse(sources['one link around text and an image']))
  const { pos } = images(view.state.doc)[0]
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
  const range = findLink(view.state)
  assert.equal(range.hasImage, true)
  applyLink(view, range, {
    text: 'must not replace the picture',
    href: '/changed',
    title: 'New',
    newTab: true
  })
  assert.equal(view.state.doc.textContent, 'before  after')
  assert.equal(images(view.state.doc).length, 1)
  const linked = images(view.state.doc)[0].node.attrs.imageLink
  assert.equal(linked.href, '/changed')
  assert.equal(linked.title, 'New')
  assert.equal(linked.mdAttrs.target, '_blank')
  assert.equal(linked.mdAttrs.id, 'single')
  const current = findLink(view.state)
  removeLink(view, current)
  assert.equal(images(view.state.doc)[0].node.attrs.imageLink, null)
  assert.equal(view.state.doc.textContent, 'before  after')
  assert.equal(findLink(view.state), null)
})

test('ordinary text links can still replace their text', () => {
  const view = viewFor(parser.parse('[old](/old)'))
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)))
  applyLink(view, findLink(view.state), { text: 'new', href: '/new', title: '', newTab: false })
  assert.equal(serialize(view.state.doc).trim(), '[new](/new)')
})

test('resizing and replacing an image preserve its link', () => {
  const view = viewFor(parser.parse(sources['a direct image link']))
  const { pos } = images(view.state.doc)[0]
  applyImageEdit(view, pos, {
    src: 'replacement.png',
    alt: 'new',
    width: '200',
    height: '',
    alignment: '',
    styles: []
  })
  const image = images(view.state.doc)[0].node
  assert.equal(image.attrs.imageLink.href, '/target')
  assert.equal(image.attrs.src, 'replacement.png')
  assert.equal(image.attrs.width, '200')
})

test('local undo and redo include the image link conversion', () => {
  const view = viewFor(parser.parse('![alt](pic.png)'))
  view.dispatch(view.state.tr.addMark(1, 2, schema.marks.link.create({ href: '/target' })))
  assert.equal(images(view.state.doc)[0].node.attrs.imageLink.href, '/target')
  assert.ok(undo(view.state, view.dispatch))
  assert.equal(images(view.state.doc)[0].node.attrs.imageLink, null)
  assert.ok(redo(view.state, view.dispatch))
  assert.equal(images(view.state.doc)[0].node.attrs.imageLink.href, '/target')
})

test('concurrent image resizing and link editing merge under Yjs 13', () => {
  const a = seed(parser.parse(sources['a direct image link']))
  const b = new Y.Doc()
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  try {
    const va = viewFor(read(a))
    const vb = viewFor(read(b))
    va.dispatch(
      va.state.tr.setNodeAttribute(1, 'imageLink', {
        ...images(va.state.doc)[0].node.attrs.imageLink,
        href: '/changed'
      })
    )
    vb.dispatch(vb.state.tr.setNodeAttribute(1, 'width', '250'))
    prosemirrorToYXmlFragment(va.state.doc, collabFragment(a))
    prosemirrorToYXmlFragment(vb.state.doc, collabFragment(b))
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    assert.deepEqual(read(a).toJSON(), read(b).toJSON())
    const image = images(read(a))[0].node
    assert.equal(image.attrs.imageLink.href, '/changed')
    assert.equal(image.attrs.width, '250')
  } finally {
    a.destroy()
    b.destroy()
  }
})

test('selecting an unlinked image does not edit an adjacent text link', () => {
  const view = viewFor(parser.parse('[text](/target)![alt](pic.png)'))
  const { pos } = images(view.state.doc)[0]
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
  assert.equal(findLink(view.state), null)
})

function makeView(doc) {
  const view = new EditorView(document.createElement('div'), {
    state: EditorState.create({
      schema,
      plugins: [imageLinkStorage(), ySyncPlugin(collabFragment(doc)), yUndoPlugin()]
    }),
    clipboardSerializer: imageLinkClipboardSerializer(schema),
    dispatchTransaction(tr) {
      if (!this.isDestroyed) this.updateState(this.state.apply(tr))
    }
  })
  return view
}

function same(a, b) {
  assert.deepEqual(a.state.doc.toJSON(), b.state.doc.toJSON())
}

test('real ySyncPlugin preserves link addition, replacement, removal, undo/redo and binary reload', () => {
  const a = new Y.Doc()
  const b = new Y.Doc()
  Y.applyUpdate(a, buildSeed(parser.parse('![alt](pic.png)')))
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  a.on('update', (u) => Y.applyUpdate(b, u))
  b.on('update', (u) => Y.applyUpdate(a, u))
  const va = makeView(a)
  const vb = makeView(b)
  try {
    va.dispatch(va.state.tr.setSelection(NodeSelection.create(va.state.doc, 1)))
    const um = yUndoPluginKey.getState(va.state).undoManager
    um.stopCapturing()
    va.dispatch(va.state.tr.addMark(1, 2, schema.marks.link.create({ href: '/first' })))
    same(va, vb)
    assert.equal(vb.state.doc.nodeAt(1).attrs.imageLink.href, '/first')
    assert.ok(va.state.selection instanceof NodeSelection)
    assert.ok(yUndo(va.state))
    same(va, vb)
    assert.equal(vb.state.doc.nodeAt(1).attrs.imageLink, null)
    assert.ok(yRedo(va.state))
    same(va, vb)
    assert.equal(vb.state.doc.nodeAt(1).attrs.imageLink.href, '/first')
    va.dispatch(va.state.tr.setSelection(NodeSelection.create(va.state.doc, 1)))
    applyLink(va, findLink(va.state), { text: '', href: '/second', title: 'Tip', newTab: true })
    same(va, vb)
    assert.equal(vb.state.doc.nodeAt(1).attrs.imageLink.mdAttrs.target, '_blank')
    const reloaded = new Y.Doc()
    try {
      Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(a))
      const fresh = makeView(reloaded)
      assert.equal(
        serialize(fresh.state.doc).trim(),
        '[![alt](pic.png)](/second "Tip"){target="_blank"}'
      )
      fresh.destroy()
    } finally {
      reloaded.destroy()
    }
    va.dispatch(va.state.tr.setSelection(NodeSelection.create(va.state.doc, 1)))
    removeLink(va, findLink(va.state))
    same(va, vb)
    assert.equal(serialize(vb.state.doc).trim(), '![alt](pic.png)')
  } finally {
    va.destroy()
    vb.destroy()
    a.destroy()
    b.destroy()
  }
})

test('clipboard HTML carries real anchors, separate image/link titles and attributes', () => {
  const source =
    '[![alt](pic.png "Picture" =100x200){.framed}](/target "Destination"){target="_blank" .cta}'
  const original = parser.parse(source)
  const container = document.createElement('div')
  container.append(DOMSerializer.fromSchema(schema).serializeFragment(original.content))
  assert.equal(container.querySelector('a').getAttribute('href'), '/target')
  assert.equal(container.querySelector('a').getAttribute('target'), '_blank')
  assert.equal(container.querySelector('img').getAttribute('title'), 'Picture')
  assert.equal(container.querySelector('a').getAttribute('title'), 'Destination')
  assert.equal(container.querySelector('img').hasAttribute('imagelink'), false)
  const parsed = DOMParser.fromSchema(schema).parse(container)
  let state = EditorState.create({ schema, plugins: [imageLinkStorage()] })
  state = state.apply(state.tr.replaceWith(0, state.doc.content.size, parsed.content))
  // Clipboard HTML may reorder attribute names; the document's contents must stay the same.
  assert.deepEqual(state.doc.toJSON(), original.toJSON())
})

test('already linked source opens in a real collaborative view without losing mixed link boundaries', () => {
  const source = '[before ![alt](pic.png) after](/target "Tip"){#one target="_blank"}'
  const room = new Y.Doc()
  Y.applyUpdate(room, buildSeed(parser.parse(source)))
  const view = makeView(room)
  try {
    assert.equal(serialize(view.state.doc).trim(), source)
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 8)))
    assert.equal(findLink(view.state).hasImage, true)
    applyLink(view, findLink(view.state), {
      text: '',
      href: '/changed',
      title: 'Changed',
      newTab: true
    })
    assert.equal(
      serialize(view.state.doc).trim(),
      '[before ![alt](pic.png) after](/changed "Changed"){#one target="_blank"}'
    )
  } finally {
    view.destroy()
    room.destroy()
  }
})

test('clipboard keeps one anchor and one id around a mixed text/image link', () => {
  const source = '[before ![alt](pic.png) after](/target "Tip"){#one target="_blank"}'
  const original = parser.parse(source)
  const container = document.createElement('div')
  container.append(imageLinkClipboardSerializer(schema).serializeFragment(original.content))
  assert.equal(container.querySelectorAll('a').length, 1)
  assert.equal(container.querySelectorAll('#one').length, 1)
  assert.equal(container.querySelector('a').getAttribute('target'), '_blank')
  const parsed = DOMParser.fromSchema(schema).parse(container)
  let state = EditorState.create({ schema, plugins: [imageLinkStorage()] })
  state = state.apply(state.tr.replaceWith(0, state.doc.content.size, parsed.content))
  assert.equal(serialize(state.doc), serialize(original))
})

test('the editor clipboard copy and paste path retains a mixed image link', () => {
  const source =
    '[before ![alt](pic.png "Picture") after](/target "Destination"){#one target="_blank"}'
  const roomA = seed(parser.parse(source))
  const roomB = seed(parser.parse(''))
  const a = makeView(roomA)
  const b = makeView(roomB)
  try {
    a.dispatch(a.state.tr.setSelection(new AllSelection(a.state.doc)))
    const copied = a.serializeForClipboard(a.state.selection.content())
    assert.equal(copied.dom.querySelectorAll('a').length, 1)
    assert.equal(copied.dom.querySelector('a').getAttribute('target'), '_blank')
    // JSDOM has no ClipboardEvent constructor; pasteHTML accepts an explicit event.
    assert.ok(b.pasteHTML(copied.dom.innerHTML, new window.Event('paste')))
    assert.equal(serialize(b.state.doc), serialize(a.state.doc))
    assert.equal(images(b.state.doc)[0].node.attrs.imageLink.href, '/target')
  } finally {
    a.destroy()
    b.destroy()
    roomA.destroy()
    roomB.destroy()
  }
})

test('image and link metadata do not become arbitrary HTML attributes', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.nodes.image.create({
        src: 'pic.png',
        mdAttrs: { class: 'framed', onerror: 'unexpected()' },
        imageLink: { href: '/target', mdAttrs: { target: '_blank', onclick: 'unexpected()' } }
      })
    ])
  ])
  for (const serializer of [
    DOMSerializer.fromSchema(schema),
    imageLinkClipboardSerializer(schema)
  ]) {
    const container = document.createElement('div')
    container.append(serializer.serializeFragment(doc.content))
    assert.equal(container.querySelector('img').hasAttribute('onerror'), false)
    assert.equal(container.querySelector('a').hasAttribute('onclick'), false)
    assert.equal(container.querySelector('img').getAttribute('class'), 'framed')
    assert.equal(container.querySelector('a').getAttribute('target'), '_blank')
  }
})

test('disabling direct tab sync prevents stale image data arriving before server authorization', () => {
  class PendingSocket {
    constructor() {
      this.readyState = 0
    }
    close() {
      this.readyState = 3
    }
    send() {}
  }
  const intact = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.nodes.image.create({ src: 'pic.png', alt: 'alt' }, null, [
        schema.marks.link.create({ href: '/target' })
      ])
    ])
  ])
  for (const disableBc of [false, true]) {
    const oldDoc = new Y.Doc()
    oldDoc.clientID = 1
    // The old seed writer loses the mark. No manual update transfer between the peers follows.
    prosemirrorToYXmlFragment(intact, collabFragment(oldDoc))
    const room = `image-link-before-auth-${disableBc}`
    const options = { WebSocketPolyfill: PendingSocket }
    const oldProvider = new WebsocketProvider('ws://review.invalid/_collab', room, oldDoc, options)
    const freshDoc = new Y.Doc()
    const freshProvider = new WebsocketProvider('ws://review.invalid/_collab', room, freshDoc, {
      ...options,
      params: { visualSchema: VISUAL_EDITOR_SCHEMA },
      disableBc
    })
    oldProvider.on('connection-close', (event) => {
      if (event?.code >= 4000) {
        oldProvider.shouldConnect = false
        oldProvider.disconnect()
      }
    })
    try {
      assert.equal(
        oldProvider.bcChannel,
        freshProvider.bcChannel,
        'query params do not version the tab channel'
      )
      assert.equal(collabFragment(freshDoc).length, disableBc ? 0 : 1)
      oldProvider.ws.onclose({ code: 4406 })
      assert.equal(oldProvider.bcconnected, false)
      // A late server refusal only disconnects; it cannot undo a CRDT update already received.
      assert.equal(collabFragment(freshDoc).length, disableBc ? 0 : 1)
      assert.equal(seedIfEmpty(freshDoc, intact), disableBc)
      assert.equal(
        serialize(read(freshDoc)).trim(),
        disableBc ? '[![alt](pic.png)](/target)' : '![alt](pic.png)'
      )
    } finally {
      oldProvider.destroy()
      freshProvider.destroy()
      oldDoc.destroy()
      freshDoc.destroy()
    }
  }
})
