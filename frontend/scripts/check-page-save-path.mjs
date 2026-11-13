/*
  Regression checks for Save As destinations. Run: node --test scripts/check-page-save-path.mjs

  Compile and mount the real dialog with Vue's renderer, including its asynchronous mounted hook
  and title watcher. Only the API, dialog shell, translations and site store are replaced. No server,
  database or browser is required. The setup methods are exposed in the test copy only.
*/
import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { test, after } from 'node:test'
import { pathToFileURL } from 'node:url'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const componentUrl = new URL('../src/components/TreeBrowserDialog.vue', import.meta.url)
// -> An optional source file makes it possible to run the same checks against an unpatched revision.
const source = await readFile(process.env.WIKI_SAVE_PATH_SOURCE || componentUrl, 'utf8')
const exposedSource = source.replace(
  '</script>',
  `
defineExpose({ state, currentFolderPath, save, switchLocale, onPathFocus, selectItem,
  selectFolder: typeof selectFolder === 'function' ? selectFolder : id => { state.currentFolderId = id }
})
</script>`
)
const { descriptor } = parse(exposedSource)
const template = compileTemplate({
  source: descriptor.template.content,
  filename: componentUrl.pathname,
  id: 'save-path-test'
})
assert.deepEqual(template.errors, [], 'dialog template compiles')
let compiled = compileScript(descriptor, { id: 'save-path-test' }).content
const replacements = {
  'vue-i18n': 'const useI18n = () => ({ t: key => key })',
  '@/composables/dialog':
    'const { dialog, dialogComponentEmits, useDialogComponent } = globalThis.__savePathTest',
  '@/composables/notify': 'const { notify } = globalThis.__savePathTest',
  '../helpers/fileTypes':
    "const fileTypes = { folder: { icon: 'folder' }, page: { icon: 'page' } }",
  '@/helpers/folderColors': "const folderIconStyle = () => ''",
  '@/components/FolderCreateDialog.vue': 'const FolderCreateDialog = {}',
  '@/components/LocaleSelectorMenu.vue': 'const LocaleSelectorMenu = {}',
  '@/components/TreeNav.vue': 'const Tree = {}',
  '@/stores/site': 'const useSiteStore = () => globalThis.__savePathTest.site',
  '@/helpers/apiError': 'const apiErrorMessage = error => error.message'
}
compiled = compiled.replace(
  /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
  (declaration, specifier) => {
    if (specifier === '@/helpers/pagePaths') {
      return declaration.replace(
        specifier,
        new URL('../src/helpers/pagePaths.js', import.meta.url).href
      )
    }
    return replacements[specifier] ?? declaration
  }
)
const temporary = await mkdtemp(new URL('../node_modules/.save-path-test-', import.meta.url))
after(() => rm(temporary, { recursive: true, force: true }))
const compiledUrl = pathToFileURL(`${temporary}/dialog.mjs`)
await writeFile(compiledUrl, compiled)

const renderer = createRenderer({
  createComment: () => ({}),
  insert() {},
  remove() {},
  parentNode: () => null,
  nextSibling: () => null
})
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await nextTick()
    await Promise.resolve()
  }
}
const rootFolder = {
  id: 'repos',
  type: 'folder',
  folderPath: '',
  fileName: 'repos',
  title: 'Repos'
}
const projectFolder = {
  id: 'project',
  type: 'folder',
  folderPath: 'repos',
  fileName: 'project',
  title: 'Project'
}

async function mount(props = {}, items = []) {
  const saved = []
  const notifications = []
  const requests = []
  globalThis.__savePathTest = {
    site: { id: 'test', locales: { primary: 'en', active: ['en', 'fr'] } },
    dialog: () => {
      throw new Error('Unexpected folder creation')
    },
    dialogComponentEmits: [],
    useDialogComponent: () => ({
      dialogVisible: ref(true),
      onDialogOK: (value) => saved.push(value)
    }),
    notify: (value) => notifications.push(value)
  }
  globalThis.API_CLIENT = {
    get: (url, options) => {
      requests.push({ url, ...options })
      return { json: async () => items }
    }
  }
  const { default: Dialog } = await import(compiledUrl.href + `?mount=${Math.random()}`)
  Dialog.render = () => null
  const instance = ref(null)
  const app = renderer.createApp({ render: () => h(Dialog, { ...props, ref: instance }) })
  app.mount({})
  await settle()
  return { vm: instance.value, saved, notifications, requests, unmount: () => app.unmount() }
}

test('explicit nested destination survives missing folders and title changes', async () => {
  const m = await mount({
    itemFileName: 'repos/project/overview',
    preservePath: true,
    itemTitle: 'Initial title'
  })
  try {
    assert.equal(m.vm.currentFolderPath, '/repos/project/')
    assert.equal(m.vm.state.path, 'overview', 'mounted title watcher preserves supplied basename')
    m.vm.state.title = 'Different title'
    await settle()
    await m.vm.save()
    assert.deepEqual(m.saved, [
      { title: 'Different title', locale: 'en', path: 'repos/project/overview' }
    ])
    assert.equal(m.requests[0].searchParams.parentPath, 'repos/project')
  } finally {
    m.unmount()
  }
})

test('existing parent folder and explicit root filename are preserved', async () => {
  for (const [path, items, expectedFolder] of [
    ['repos/project/overview', [rootFolder, projectFolder], '/repos/project/'],
    ['overview', [], '/']
  ]) {
    const m = await mount({ itemFileName: path, preservePath: true }, items)
    try {
      assert.equal(m.vm.currentFolderPath, expectedFolder)
      m.vm.state.title = 'A title'
      await settle()
      await m.vm.save()
      assert.equal(m.saved[0].path, path)
    } finally {
      m.unmount()
    }
  }
})

test('ordinary new pages still derive a name from their title', async () => {
  const m = await mount({ itemFileName: 'repos/new-page' }, [rootFolder])
  try {
    m.vm.state.title = 'My New Guide'
    await settle()
    await m.vm.save()
    assert.equal(m.saved[0].path, 'repos/my-new-guide')
    m.vm.onPathFocus()
    m.vm.state.path = 'chosen-name'
    m.vm.state.title = 'Another title'
    await settle()
    assert.equal(m.vm.state.path, 'chosen-name')
    m.vm.state.path = ''
    m.vm.state.title = 'Use title again'
    await settle()
    assert.equal(m.vm.state.path, 'use-title-again')
  } finally {
    m.unmount()
  }
})

test('choosing root or another folder replaces a missing destination', async () => {
  for (const [id, expected] of [
    [null, 'overview'],
    ['repos', 'repos/overview']
  ]) {
    const m = await mount({ itemFileName: 'missing/project/overview', preservePath: true }, [
      rootFolder
    ])
    try {
      m.vm.selectFolder(id)
      m.vm.state.title = 'Overview'
      await settle()
      await m.vm.save()
      assert.equal(m.saved[0].path, expected)
    } finally {
      m.unmount()
    }
  }
})

test('changing locale clears the pending folder destination', async () => {
  const m = await mount({ itemFileName: 'missing/project/overview', preservePath: true })
  try {
    await m.vm.switchLocale('fr')
    m.vm.state.title = 'Overview'
    await settle()
    await m.vm.save()
    assert.deepEqual(m.saved[0], { title: 'Overview', locale: 'fr', path: 'overview' })
  } finally {
    m.unmount()
  }
})

test('missing folder paths use new-page normalization and reject invalid segments', async () => {
  for (const [path, expected] of [
    ['Repos/My_Project/overview', 'repos/my-project/overview'],
    ['日本語/ガイド/overview', '日本語/ガイド/overview'],
    ['repos/bad.name/overview', null],
    ['---/overview', null],
    ['repos//project/overview', null]
  ]) {
    const m = await mount({ itemFileName: path, itemTitle: 'Overview', preservePath: true })
    try {
      await m.vm.save()
      if (expected) {
        assert.equal(m.saved[0].path, expected)
      } else {
        assert.equal(m.saved.length, 0)
        assert.equal(m.notifications.at(-1).message, 'pageSaveDialog.pathInvalid')
      }
    } finally {
      m.unmount()
    }
  }
})

test('pageCreate distinguishes an explicit target from a generated new-page placeholder', async () => {
  let storeSource = await readFile(new URL('../src/stores/page.js', import.meta.url), 'utf8')
  storeSource = storeSource
    .replace(
      "import { useSiteStore } from './site'",
      'const useSiteStore = () => globalThis.__savePathTest.site'
    )
    .replace(
      "import { useEditorStore } from './editor'",
      'const useEditorStore = () => globalThis.__savePathTest.editor'
    )
    .replace(
      "import { useUserStore } from './user'",
      'const useUserStore = () => ({ fetchPagePermissions: async () => {} })'
    )
  const storeUrl = pathToFileURL(`${temporary}/page.mjs`)
  await writeFile(storeUrl, storeSource)
  const { usePageStore } = await import(storeUrl.href)
  setActivePinia(createPinia())
  const editor = {
    configIsLoaded: true,
    isActive: false,
    settleChanges() {},
    $patch(value) {
      Object.assign(this, value)
    }
  }
  globalThis.__savePathTest = { site: { defaults: { tocDepth: {} } }, editor }
  const page = usePageStore()
  page.router = { currentRoute: { value: { path: '/_create/markdown' } } }
  await page.pageCreate({ editor: 'markdown', path: 'repos/project/new-page' })
  assert.equal(editor.preservePagePath, true, 'even new-page is explicit when requested by URL')
  await page.pageCreate({ editor: 'markdown', basePath: 'repos/project' })
  assert.equal(page.path, 'repos/project/new-page')
  assert.equal(editor.preservePagePath, false, 'same spelling, generated rather than requested')
  await page.pageCreate({ editor: 'markdown', path: 'overview' })
  assert.equal(editor.preservePagePath, true)
})

test('rename keeps a legacy basename and duplicate still follows the title', async () => {
  for (const [mode, filename, expected] of [
    ['renamePage', 'legacy_name', 'legacy_name'],
    ['restorePage', 'legacy_name', 'legacy_name'],
    ['duplicatePage', 'original', 'a-copy']
  ]) {
    const m = await mount({ mode, itemFileName: `repos/${filename}`, itemTitle: 'A copy' }, [
      rootFolder
    ])
    try {
      await m.vm.save()
      assert.equal(m.saved[0].path, `repos/${expected}`)
    } finally {
      m.unmount()
    }
  }
})
