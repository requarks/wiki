/*
  Exercise the real REST and WebSocket route handlers without starting a Wiki or touching a database.
  Models, authentication and room storage are replaced with explicit test doubles. Schema compilation
  is not under test here; Fastify still dispatches the actual production routes and reply helpers.
*/
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import websocket from '@fastify/websocket'
import { once } from 'node:events'
import {
  VISUAL_EDITOR_SCHEMA,
  VISUAL_EDITOR_SCHEMA_HEADER,
  VISUAL_EDITOR_RELOAD_MESSAGE
} from '../helpers/visualEditorProtocol.ts'

const siteId = '11111111-1111-4111-8111-111111111111'
const pageId = '22222222-2222-4222-8222-222222222222'
const user = { id: '33333333-3333-4333-8333-333333333333', name: 'Test user' }
let editor = 'visual'
let writes = 0
let joins = 0
const page = () => ({
  id: pageId,
  siteId,
  editor,
  path: 'test',
  locale: 'en',
  title: 'Test',
  tags: [],
  authorName: 'Test user',
  updatedAt: { toTemporalInstant: () => ({ toString: () => '2026-11-05T00:00:00.000Z' }) }
})
globalThis.WIKI = {
  config: {},
  logger: { debug() {}, warn() {}, info() {} },
  sites: {
    [siteId]: {
      config: {
        features: { collaborativeEditing: true },
        editors: { visual: { isActive: true }, markdown: { isActive: true } }
      }
    }
  },
  models: {
    groups: {
      actorForRequest: (req) => ({ allowed: req.headers['x-test-denied'] !== 'yes' }),
      checkAccess: (actor) => actor.allowed
    },
    pages: {
      getPage: async () => page(),
      updatePage: async () => {
        writes++
        return { page: page(), versionId: 'test' }
      },
      createPage: async () => {
        writes++
        return { page: page(), versionId: 'test' }
      },
      convertPage: async () => {
        writes++
        return { page: page(), versionId: 'test' }
      }
    },
    auditLog: { record: async () => {} }
  },
  collab: {
    // Capture is harmless before authorization; only join may hand frames to a room.
    capture: () => ({ pending: [], room: null }),
    join: async (socket) => {
      joins++
      socket.on('message', () => socket.send('joined'))
    },
    pageSaved() {}
  }
}
const { default: pageRoutes } = await import('../api/pages.ts')
const { default: collabRoutes } = await import('../controllers/collab.ts')
const app = Fastify()
await app.register(sensible)
await app.register(websocket)
app.setValidatorCompiler(() => () => true)
app.setSerializerCompiler(() => (value) => JSON.stringify(value))
app.decorateRequest('session', null)
app.decorateRequest('apiKey', null)
app.addHook('onRequest', async (req) => {
  req.session = { authenticated: req.headers['x-test-guest'] !== 'yes', user }
  if (req.headers['x-test-personal-token'] === 'yes')
    req.apiKey = { id: 'test', kind: 'personal', user }
})
await app.register(pageRoutes)
await app.register(collabRoutes, { prefix: '/_collab' })
await app.ready()
after(async () => {
  // injectWS uses in-memory sockets; close both endpoints before Fastify waits for the server.
  for (const socket of app.websocketServer.clients) socket.terminate()
  await app.close()
})

async function save(body, headers = {}, method = 'PATCH') {
  const before = writes
  const response = await app.inject({
    method,
    url: `/sites/${siteId}/pages${method === 'PATCH' ? `/${pageId}` : ''}`,
    headers,
    payload: body
  })
  return { response, changed: writes - before }
}
async function join(query = '', headers = {}) {
  const before = joins
  const socket = await app.injectWS(`/_collab/${siteId}/${pageId}${query}`, { headers })
  const pending = Promise.race([
    once(socket, 'close').then(([code, reason]) => ({ code, reason: reason.toString() })),
    once(socket, 'message').then(([data]) => ({ message: data.toString() }))
  ])
  if (socket.readyState === socket.OPEN) socket.send('test handshake')
  const outcome = await pending
  socket.terminate()
  return { ...outcome, joined: joins - before }
}

for (const [name, body] of [
  ['content', { content: 'old visual content' }],
  ['empty content', { content: '' }],
  ['render only', { render: '<p>old render</p>' }],
  ['a misleading editor field', { editor: 'markdown', content: 'old content' }]
]) {
  test(`an old browser cannot save visual ${name}`, async () => {
    editor = 'visual'
    const { response, changed } = await save(body)
    assert.equal(response.statusCode, 409)
    assert.equal(changed, 0)
    assert.equal(response.json().message, VISUAL_EDITOR_RELOAD_MESSAGE)
  })
}
test('a stale visual create is refused before storage', async () => {
  const { response, changed } = await save(
    { editor: 'visual', content: 'old content', path: 'test', title: 'Test' },
    {},
    'POST'
  )
  assert.equal(response.statusCode, 409)
  assert.equal(changed, 0)
})
test('the supported browser schema can save and create visual content', async () => {
  editor = 'visual'
  const headers = { [VISUAL_EDITOR_SCHEMA_HEADER]: VISUAL_EDITOR_SCHEMA }
  for (const method of ['PATCH', 'POST']) {
    const { response, changed } = await save(
      { editor: 'visual', content: 'new content', path: 'test', title: 'Test' },
      headers,
      method
    )
    assert.equal(response.statusCode, 200, response.body)
    assert.equal(changed, 1)
  }
})
test('wrong and future save markers are refused', async () => {
  for (const value of [
    'old-schema',
    'image-links-2',
    `${VISUAL_EDITOR_SCHEMA}, ${VISUAL_EDITOR_SCHEMA}`
  ]) {
    const { response, changed } = await save(
      { content: 'old content' },
      { [VISUAL_EDITOR_SCHEMA_HEADER]: value }
    )
    assert.equal(response.statusCode, 409)
    assert.equal(changed, 0)
  }
})
test('metadata-only updates do not require a visual schema marker', async () => {
  const { response, changed } = await save({ title: 'New title' })
  assert.equal(response.statusCode, 200, response.body)
  assert.equal(changed, 1)
})
test('personal-token API source updates preserve their existing contract', async () => {
  const { response, changed } = await save(
    { content: 'intentional API source' },
    { 'x-test-personal-token': 'yes' }
  )
  assert.equal(response.statusCode, 200, response.body)
  assert.equal(changed, 1)
})
test('non-visual browser saves do not require the visual marker', async () => {
  editor = 'markdown'
  const { response, changed } = await save({ content: 'markdown source' })
  assert.equal(response.statusCode, 200, response.body)
  assert.equal(changed, 1)
  editor = 'visual'
})
test('authentication and page rights still precede compatibility checks', async () => {
  for (const [headers, expected] of [
    [{ 'x-test-guest': 'yes' }, 401],
    [{ 'x-test-denied': 'yes' }, 403]
  ]) {
    const { response, changed } = await save({ content: 'source' }, headers)
    assert.equal(response.statusCode, expected)
    assert.equal(changed, 0)
  }
})
test('old or mismatched WebSocket clients never enter a visual room', async () => {
  editor = 'visual'
  for (const query of [
    '',
    '?visualSchema=old-schema',
    '?visualSchema=image-links-2',
    `?visualSchema=${VISUAL_EDITOR_SCHEMA}&visualSchema=other`
  ]) {
    const result = await join(query)
    assert.equal(result.code, 4406)
    assert.equal(result.joined, 0)
    assert.match(result.reason, /reload/)
  }
})
test('the supported WebSocket client enters the visual room', async () => {
  const result = await join(`?visualSchema=${VISUAL_EDITOR_SCHEMA}`)
  assert.equal(result.message, 'joined')
  assert.equal(result.joined, 1)
})
test('the version marker does not grant WebSocket permissions', async () => {
  const result = await join(`?visualSchema=${VISUAL_EDITOR_SCHEMA}`, { 'x-test-denied': 'yes' })
  assert.equal(result.code, 4403)
  assert.equal(result.joined, 0)
})
test('other page editors retain the existing WebSocket handshake', async () => {
  editor = 'markdown'
  const result = await join()
  assert.equal(result.message, 'joined')
  assert.equal(result.joined, 1)
  editor = 'visual'
})

test('rewriting visual source through editor conversion also requires a supported browser', async () => {
  for (const [from, to] of [
    ['visual', 'markdown'],
    ['markdown', 'visual']
  ]) {
    editor = from
    const before = writes
    const response = await app.inject({
      method: 'PUT',
      url: `/sites/${siteId}/pages/${pageId}/editor`,
      payload: { editor: to, content: 'stale visual source' }
    })
    assert.equal(response.statusCode, 409)
    assert.equal(writes, before)
  }
  editor = 'visual'
})

test('supported conversions and conversions without source keep their existing behavior', async () => {
  for (const options of [
    { payload: { editor: 'markdown' } },
    {
      payload: { editor: 'markdown', content: 'current source' },
      headers: { [VISUAL_EDITOR_SCHEMA_HEADER]: VISUAL_EDITOR_SCHEMA }
    }
  ]) {
    const before = writes
    const response = await app.inject({
      method: 'PUT',
      url: `/sites/${siteId}/pages/${pageId}/editor`,
      ...options
    })
    assert.equal(response.statusCode, 200, response.body)
    assert.equal(writes, before + 1)
  }
})
