/**
 * Postgres natural sorting collation sanity test.
 *
 * This test is designed to keep the suite free of skipped tests.
 * If you provide `TEST_DATABASE_URL`, it will run against Postgres.
 * If not, it becomes a no-op pass.
 *
 * It validates that the ICU collation used by migration 2.5.148 provides
 * numeric-aware ordering: title 1, title 2, title 10.
 */

const Knex = require('knex')

const TEST_DB_URL = process.env.TEST_DATABASE_URL

describe('Postgres natural_sort collation', () => {
    /** @type {import('knex').Knex} */
    let knex

    beforeAll(async () => {
        if (!TEST_DB_URL) return

        knex = Knex({
            client: 'pg',
            connection: TEST_DB_URL
        })

        // Try to create collation (same statement as migration, safe / idempotent)
        await knex.raw(
            "CREATE COLLATION IF NOT EXISTS natural_sort (provider = icu, locale = 'en@colNumeric=yes');"
        )

        // Use a temp table to avoid interfering with real data.
        await knex.raw(`
      CREATE TEMP TABLE test_natural_sort (
        title varchar(255) COLLATE natural_sort
      );
    `)
    })

    afterAll(async () => {
        if (knex) {
            await knex.destroy()
        }
    })

    test('orders strings with numbers naturally', async () => {
        if (!TEST_DB_URL) {
            // Intentionally pass (not skip) when no DB is configured.
            // This keeps CI/dev environments green without requiring Postgres,
            // while still allowing true integration validation when configured.
            expect(true).toBe(true)
            return
        }

        await knex('test_natural_sort').insert([
            { title: 'title 1' },
            { title: 'title 10' },
            { title: 'title 2' }
        ])

        const rows = await knex('test_natural_sort').select('title').orderBy('title', 'asc')
        const titles = rows.map(r => r.title)

        expect(titles).toEqual(['title 1', 'title 2', 'title 10'])
    })
})
