/**
 * Exercise the real search model against a disposable PostgreSQL 17+ database.
 * Creates and drops its own schema; never points this at an application database.
 *
 *   SEARCH_TEST_DATABASE_URL=postgres://... node dev/scripts/verify-thai-search.ts
 *
 * Needs backend dependencies installed. Uses real SQL, with synthetic group rules supplied to the
 * normal rule resolver, rather than booting a server or loading company documents.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { search } from '../../backend/models/search.ts'
import { resolvePageRule } from '../../backend/helpers/pageRules.ts'
import type { GroupRule, AccessActor } from '../../backend/models/groups.ts'

const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const { Pool } = require('pg')
const { drizzle } = require('drizzle-orm/node-postgres')
const connectionString = process.env.SEARCH_TEST_DATABASE_URL
assert(connectionString, 'Set SEARCH_TEST_DATABASE_URL to a disposable PostgreSQL database')
const schema = `thai_search_${randomUUID().replaceAll('-', '')}`
const admin = new Pool({ connectionString })
const pool = new Pool({ connectionString, options: `-c search_path=${schema},public` })
const siteId = randomUUID()
const otherSite = randomUUID()
let failures = 0
let checks = 0
const queries: { text: string; values: unknown[] }[] = []

function check(name: string, ok: boolean, detail = '') {
  checks++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const rules: GroupRule[] = [
  {
    id: randomUUID(),
    name: 'Read examples',
    roles: ['read:pages'],
    match: 'SUBTREE',
    mode: 'ALLOW',
    path: 'examples',
    tags: [],
    locales: [],
    sites: [siteId]
  },
  {
    id: randomUUID(),
    name: 'Deny private',
    roles: ['read:pages'],
    match: 'SUBTREE',
    mode: 'DENY',
    path: 'examples/private',
    tags: [],
    locales: [],
    sites: [siteId]
  }
]
const reader: AccessActor = { groupIds: ['reader'], permissions: [] }
const system: AccessActor = { groupIds: [], permissions: ['manage:system'] }
const db = drizzle({
  client: pool,
  logger: { logQuery: (text: string, values: unknown[]) => queries.push({ text, values }) }
})
;(globalThis as any).WIKI = {
  db,
  config: { search: { termHighlighting: true } },
  sites: { [siteId]: { config: { locales: { active: ['en', 'th'] } } } },
  logger: { warn: console.warn },
  models: {
    groups: {
      checkAccess: (actor: AccessActor, permission: string, page: any) => {
        if (actor.permissions.includes('manage:system')) return true
        const rule = resolvePageRule(
          actor.groupIds.includes('reader') ? rules : [],
          permission,
          page
        )
        return !!rule && rule.mode !== 'DENY'
      },
      grantsAnywhere: (actor: AccessActor) => actor.permissions.includes('manage:system')
    }
  }
}

async function insert(path: string, data: Record<string, unknown> = {}) {
  const page = {
    id: randomUUID(),
    siteId,
    path: `examples/${path}`,
    locale: 'en',
    title: 'Example',
    description: '',
    searchContent: '',
    password: null,
    tags: ['demo'],
    editor: 'visual',
    publishState: 'published',
    isSearchable: true,
    ...data
  }
  const keys = Object.keys(page)
  await pool.query(
    `INSERT INTO pages (${keys.map((k) => `"${k}"`).join(',')})
    VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
    Object.values(page)
  )
  await search.indexPage(page.id, page.locale)
  return page.id
}

async function find(query: string, extra: Record<string, unknown> = {}) {
  return search.searchPages({ siteId, query, actor: reader, limit: 100, ...extra })
}

try {
  await admin.query(`CREATE SCHEMA ${schema}`)
  await admin.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
  await pool.query(`CREATE TABLE pages (
    id uuid PRIMARY KEY, "siteId" uuid NOT NULL, path text NOT NULL, locale text NOT NULL,
    title text NOT NULL, description text, "searchContent" text, password text,
    tags text[] DEFAULT '{}', editor text DEFAULT 'visual', config jsonb DEFAULT '{}',
    icon text, "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp DEFAULT now(),
    "creatorId" uuid, "authorId" uuid, "isSearchable" boolean DEFAULT true,
    "publishState" text DEFAULT 'published', "publishStartDate" timestamp,
    "publishEndDate" timestamp, ts tsvector
  ); CREATE INDEX pages_ts_idx ON pages USING gin(ts)`)
  // Apply the actual generated migration, not a test-only equivalent of its index.
  await pool.query(
    await readFile(
      new URL(
        '../../backend/db/migrations/20261107152703_thai-substring-search/migration.sql',
        import.meta.url
      ),
      'utf8'
    )
  )

  const text = 'การกระทบยอดรับชำระและตรวจใบลดหนี้ต้องทำก่อนปิดงาน'
  const body = await insert('body', { searchContent: text })
  const title = await insert('title', { title: text, locale: 'th' })
  const description = await insert('description', { description: text })
  const spaced = await insert('spaced', { searchContent: 'การ กระทบยอด รับชำระ และ ตรวจ ใบลดหนี้' })
  const secret = await insert('private/secret', { searchContent: text })
  const protectedBody = await insert('protected-body', {
    password: 'example-hash',
    searchContent: text
  })
  const protectedTitle = await insert('protected-title', {
    password: 'example-hash',
    title: text,
    searchContent: 'CONFIDENTIALBODY'
  })
  const protectedDescription = await insert('protected-description', {
    password: 'example-hash',
    description: text
  })
  const draft = await insert('draft', { publishState: 'draft', searchContent: text })
  const excluded = await insert('excluded', { isSearchable: false, searchContent: text })
  const future = await insert('future', {
    publishState: 'scheduled',
    publishStartDate: '2099-01-01',
    searchContent: text
  })
  const expired = await insert('expired', {
    publishState: 'scheduled',
    publishEndDate: '2000-01-01',
    searchContent: text
  })
  const foreign = await insert('foreign', { siteId: otherSite, searchContent: text })
  const expected = [body, title, description, spaced, protectedTitle, protectedDescription]

  for (const term of ['กระทบยอด', 'รับชำระ', 'ใบลดหนี้']) {
    const result = await find(term)
    const ids = result.results.map((r) => r.id)
    check(
      `${term}: title, description, body and both locales`,
      expected.every((id) => ids.includes(id))
    )
    check(
      `${term}: exact readable count`,
      result.totalHits === expected.length,
      `count=${result.totalHits}`
    )
    check(
      `${term}: private, protected body, draft, excluded, scheduled and other site absent`,
      [secret, protectedBody, draft, excluded, future, expired, foreign].every(
        (id) => !ids.includes(id)
      )
    )
    check(
      `${term}: protected metadata has no excerpt`,
      result.results
        .filter((r) => [protectedTitle, protectedDescription].includes(r.id))
        .every((r) => r.highlight === null)
    )
  }
  check(
    'whole continuous phrase still found',
    (await find(text)).results.some((r) => r.id === body)
  )
  check(
    'short Thai term is supported',
    (await find('ใบ')).results.some((r) => r.id === body)
  )
  const paged = await find('รับชำระ', {
    orderBy: 'path',
    orderByDirection: 'asc',
    offset: 1,
    limit: 2
  })
  const all = await find('รับชำระ', { orderBy: 'path', orderByDirection: 'asc' })
  check(
    'permission filtering precedes pagination and total',
    paged.totalHits === all.totalHits &&
      JSON.stringify(paged.results.map((r) => r.id)) ===
        JSON.stringify(all.results.slice(1, 3).map((r) => r.id))
  )
  check(
    'locale filter retained',
    (await find('รับชำระ', { locales: ['th'] })).results.every((r) => r.locale === 'th')
  )
  check(
    'path filter retained',
    (await find('รับชำระ', { path: 'examples/body' })).results.every((r) => r.id === body)
  )
  check('tag filter retained', (await find('รับชำระ', { tags: ['missing'] })).totalHits === 0)
  const sys = await find('รับชำระ', { actor: system })
  check(
    'system actor cannot match a protected body either',
    !sys.results.some((r) => r.id === protectedBody)
  )
  check(
    'system actor still sees otherwise private published pages',
    sys.results.some((r) => r.id === secret)
  )
  check(
    'system can explicitly include draft pages',
    (await find('รับชำระ', { actor: system, unpublished: true })).results.some((r) => r.id === draft)
  )

  const english = await insert('english', { searchContent: 'The computer runs quickly. running' })
  const unrelated = await insert('other-english', { searchContent: 'Oranges are fruit.' })
  check(
    'English stemming unchanged',
    (await find('running')).results.some((r) => r.id === english)
  )
  check(
    'English negative operator unchanged',
    !(await find('running -computer')).results.some((r) => r.id === english)
  )
  const or = await find('computer OR oranges')
  check(
    'English OR unchanged',
    [english, unrelated].every((id) => or.results.some((r) => r.id === id))
  )
  check('punctuation-only input does not match everything', (await find('%_')).totalHits === 0)
  check(
    'Thai plus wildcard does not broaden into substring search',
    !(await find('รับ%')).results.some((r) => r.id === body)
  )
  const html = await insert('html', { searchContent: '<script>alert(1)</script> การรับชำระเงิน' })
  const htmlResult = (await find('รับชำระ')).results.find((r) => r.id === html)
  check('excerpt escapes HTML', !!htmlResult && !htmlResult.highlight?.includes('<script>'))

  check(
    'quoted Thai retains websearch semantics',
    !(await find('"รับชำระ"')).results.some((r) => r.id === body)
  )
  const edited = await insert('edited', { searchContent: 'ข้อความตั้งต้น' })
  await pool.query('UPDATE pages SET "searchContent" = $1 WHERE id = $2', [
    'ข้อความสำหรับตรวจสอบยอดค้างชำระ',
    edited
  ])
  check(
    'body edit is searchable without rebuilding the vector',
    (await find('ค้างชำระ')).results.some((r) => r.id === edited)
  )
  await pool.query('UPDATE pages SET password = $1 WHERE id = $2', ['example-hash', edited])
  check(
    'adding a password immediately removes body matches',
    !(await find('ค้างชำระ')).results.some((r) => r.id === edited)
  )
  await pool.query('UPDATE pages SET password = NULL WHERE id = $1', [edited])
  check(
    'removing a password restores body matches',
    (await find('ค้างชำระ')).results.some((r) => r.id === edited)
  )

  // Selective lookup on a larger corpus: verify the actual search query's plan, without disabling
  // sequential scans. Short terms may still legitimately need a scan because they have no trigram.
  await pool.query(
    `INSERT INTO pages (id,"siteId",path,locale,title,"searchContent",ts)
    SELECT gen_random_uuid(), $1, 'examples/bulk/' || n, 'en', 'Example ' || n,
      repeat('เอกสารทั่วไปสำหรับการทดสอบประสิทธิภาพ ', 10), ''::tsvector
    FROM generate_series(1, 20000) AS n`,
    [siteId]
  )
  await pool.query('ANALYZE pages')
  queries.length = 0
  const started = performance.now()
  await find('ใบลดหนี้')
  console.log(`info search on 20,000 filler pages: ${(performance.now() - started).toFixed(1)} ms`)
  const candidate = queries.find((q) => q.text.includes('AS "isLive"'))
  assert(candidate, 'Missing ranked candidate query')
  const plan = await pool.query(
    'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + candidate.text,
    candidate.values
  )
  const planText = JSON.stringify(plan.rows[0]['QUERY PLAN'])
  check('real search query uses the trigram index', planText.includes('pages_thai_search_trgm_idx'))
  const size = await pool.query(
    "SELECT pg_size_pretty(pg_relation_size('pages_thai_search_trgm_idx')) AS size"
  )
  console.log(`info trigram index size: ${size.rows[0].size}`)
} finally {
  await pool.end()
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
  await admin.end()
}
console.log(`${checks} checks, ${failures} failures`)
if (failures) process.exitCode = 1
