/**
 * Migration 2.5.144 - Release Info + Release Notes
 * Adds tables:
 *  - release_info(version_number PK, release_date, display)
 *  - release_notes(id PK, version_number FK -> release_info.version_number, notes_en, notes_de)
 * Seeds both tables with initial sample data provided for MAR-1190.
 */

exports.up = async function (knex) {
  await knex.transaction(async (trx) => {
    // Create release_info table
    const hasReleaseInfo = await trx.schema.hasTable('release_info')
    if (!hasReleaseInfo) {
      await trx.schema.createTable('release_info', (table) => {
        table.string('version_number', 20).primary() // e.g. v1.5.0
        table.date('release_date').notNullable()
        table.boolean('display').notNullable().defaultTo(true)
      })
    }

    // Create release_notes table
    const hasReleaseNotes = await trx.schema.hasTable('release_notes')
    if (!hasReleaseNotes) {
      await trx.schema.createTable('release_notes', (table) => {
        table.increments('id').primary()
        table.string('version_number', 20).notNullable()
        table.text('notes_en').notNullable()
        table.text('notes_de').notNullable()
        table.foreign('version_number').references('release_info.version_number').onDelete('CASCADE')
        table.index(['version_number'], 'release_notes_version_idx')
      })
    }

    // Seed data only if tables were empty (avoid duplicate inserts on re-run)
    const releaseInfoCount = await trx('release_info').count({ c: '*' }).first()
    if (!releaseInfoCount || Number(releaseInfoCount.c || releaseInfoCount['count'] || 0) === 0) {
      await trx('release_info').insert([
        { version_number: 'v1.8.0', release_date: '2025-10-15', display: true },
        { version_number: 'v1.7.0', release_date: '2025-09-18', display: true },
        { version_number: 'v1.6.0', release_date: '2024-08-21', display: true }
      ])
    }

    const releaseNotesCount = await trx('release_notes').count({ c: '*' }).first()
    if (!releaseNotesCount || Number(releaseNotesCount.c || releaseNotesCount['count'] || 0) === 0) {
      await trx('release_notes').insert([
        // v1.8.0
        { version_number: 'v1.8.0', notes_en: 'Fixed missing attachment issue in migrated pages', notes_de: 'n/a' },
        // v1.7.0
        { version_number: 'v1.7.0', notes_en: 'New feature: send welcome email to newly added users via script', notes_de: 'n/a' },
        // v1.6.0
        { version_number: 'v1.6.0', notes_en: 'Anonymization Former mentioned employees in page history', notes_de: 'n/a' },
        { version_number: 'v1.6.0', notes_en: 'Added link in CapWiki to access CapWiki public repository in GitHub', notes_de: 'n/a' },
        { version_number: 'v1.6.0', notes_en: 'Performance optimization for create/edit page operations', notes_de: 'n/a' },
        { version_number: 'v1.6.0', notes_en: 'Enhanced feature: Users can now edit/delete their own comments only', notes_de: 'n/a' },
        { version_number: 'v1.6.0', notes_en: 'New feature: send welcome email to newly added users via UI', notes_de: 'n/a' }
      ])
    }
  })
}

exports.down = async function (knex) {
  await knex.transaction(async (trx) => {
    // Drop in dependency order (child first)
    const hasReleaseNotes = await trx.schema.hasTable('release_notes')
    if (hasReleaseNotes) {
      await trx.schema.dropTable('release_notes')
    }
    const hasReleaseInfo = await trx.schema.hasTable('release_info')
    if (hasReleaseInfo) {
      await trx.schema.dropTable('release_info')
    }
  })
}
