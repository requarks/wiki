import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { blockPickerType, blockPickValues } from './blockFilePicker.js'

test('only the requested block fields offer their matching picker', () => {
  for (const [block, field, type] of [
    ['include', 'path', 'page'],
    ['index', 'path', 'folder'],
    ['infobox', 'image', 'asset'],
    ['media-player', 'src', 'asset'],
    ['pdf', 'src', 'asset'],
    ['asciinema', 'src', 'asset']
  ]) {
    assert.equal(blockPickerType(block, field), type)
  }
  assert.equal(blockPickerType('include', 'locale'), undefined)
  assert.equal(blockPickerType('drawio', 'server'), undefined)
})

test('page picks carry their locale unless it is locked', () => {
  const page = { folderPath: 'guides', fileName: 'start', locale: 'fr' }
  assert.deepEqual(blockPickValues('page', 'path', page, {}), {
    path: 'guides/start',
    locale: 'fr'
  })
  assert.deepEqual(blockPickValues('page', 'path', page, { localeLocked: true }), {
    path: 'guides/start'
  })
})

test('folder picks preserve the root and asset picks address the chosen locale', () => {
  assert.deepEqual(blockPickValues('folder', 'path', { folderPath: '' }, {}), { path: '' })
  const item = { id: 'asset-id', folderPath: 'media', fileName: 'file.pdf', locale: 'en' }
  const options = { siteId: 'site-id', primaryLocale: 'en' }
  assert.deepEqual(blockPickValues('asset', 'src', item, options), {
    src: '/_files/media/file.pdf'
  })
  assert.deepEqual(blockPickValues('asset', 'src', { ...item, locale: 'fr' }, options), {
    src: '/_api/sites/site-id/assets/asset-id/content'
  })
})
