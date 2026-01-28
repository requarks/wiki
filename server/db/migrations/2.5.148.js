/**
 * Migration 2.5.148 - Natural sorting for page tree titles + Confluence content id
 *
 * - Creates an ICU collation `natural_sort` (en, numeric collation) if missing.
 * - Applies the collation to `pageTree.title` so ORDER BY title becomes natural.
 * - Adds `pageTree.conf_contentid` for migrated Confluence spaces.
 */

const { isPostgres } = require('./_helpers')

exports.up = async function (knex) {
  // Postgres only: this migration uses Postgres ICU collations and Postgres-specific ALTER COLUMN syntax.
  // CapWiki is intended to run on Postgres; if other DB engines are ever used for tests/tools,
  // we no-op to avoid breaking migrations.
  if (!isPostgres(knex)) {
    return
  }

  // 1) Create collation for natural sorting
  await knex.raw(`
    CREATE COLLATION IF NOT EXISTS natural_sort (provider = icu, locale = 'en@colNumeric=yes');
  `)

  // 2) Apply collation to pageTree.title
  // NOTE: We intentionally keep the type the same (varchar(255)) and only change collation.
  await knex.raw(`
    ALTER TABLE public."pageTree"
    ALTER COLUMN title TYPE character varying(255) COLLATE natural_sort;
  `)

  // 3) Add conf_contentid column
  const hasColumn = await knex.schema.hasColumn('pageTree', 'conf_contentid')
  if (!hasColumn) {
    await knex.schema.alterTable('pageTree', table => {
      table.integer('conf_contentid').nullable()
    })
  }
}

exports.down = async function (knex) {
  if (!isPostgres(knex)) {
    return
  }

  // 1) Remove conf_contentid column
  const hasColumn = await knex.schema.hasColumn('pageTree', 'conf_contentid')
  if (hasColumn) {
    await knex.schema.alterTable('pageTree', table => {
      table.dropColumn('conf_contentid')
    })
  }

  // 2) Revert title collation back to default
  // We can't reliably re-apply a previous explicit collation without knowing it;
  // setting it to the database default is done by omitting COLLATE.
  await knex.raw(`
    ALTER TABLE public."pageTree"
    ALTER COLUMN title TYPE character varying(255);
  `)

  // 3) We intentionally do NOT drop the collation.
  // Dropping a collation requires it to be unused across the database.
}
