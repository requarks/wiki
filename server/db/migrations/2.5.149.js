/**
 * Migration 2.5.149 - User Settings for Release Info Tracking
 *
 * Creates:
 *  - user_settings table (user_id PK FK -> users.id, is_release_info_seen BOOLEAN default false)
 * 
 * IMPORTANT! : You need to run: UPDATE user_settings
SET is_release_info_seen = false

* - After this migration to reset the flag for all users, otherwise existing users will not see the release info notification until they log in and trigger the auto-create logic.
 */

const { isPostgres } = require('./_helpers')

exports.up = async function (knex) {
  // Postgres only: this migration uses Postgres-specific ON CONFLICT syntax.
  if (!isPostgres(knex)) {
    return
  }

  await knex.transaction(async (trx) => {
    // Create user_settings table
    const hasUserSettings = await trx.schema.hasTable('user_settings')
    if (!hasUserSettings) {
      await trx.schema.createTable('user_settings', (table) => {
        table.integer('user_id').primary()
        table.boolean('is_release_info_seen').notNullable().defaultTo(false)
        
        // Foreign key with cascade delete
        table.foreign('user_id')
          .references('id')
          .inTable('users')
          .onDelete('CASCADE')
      })

      // Populate user_settings for all existing users (only if table was just created)
      // Use INSERT ... SELECT to avoid issues with large user counts
      await trx.raw(`
        INSERT INTO user_settings (user_id, is_release_info_seen)
        SELECT id, false
        FROM users
        ON CONFLICT (user_id) DO NOTHING
      `)
    }

  })
}

exports.down = async function (knex) {
  if (!isPostgres(knex)) {
    return
  }

  await knex.transaction(async (trx) => {
    // Drop table
    const hasUserSettings = await trx.schema.hasTable('user_settings')
    if (hasUserSettings) {
      await trx.schema.dropTable('user_settings')
    }
  })
}
