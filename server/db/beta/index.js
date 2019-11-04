const _ = require('lodash')
const path = require('path')
const fs = require('fs-extra')
const semver = require('semver')

/* global WIKI */

module.exports = {
  async migrate (knex) {
    const migrationsTableExists = await knex.schema.hasTable('migrations')
    if (!migrationsTableExists) {
      return
    }

    const dbCompat = {
      charset: (WIKI.config.db.type === `mysql` || WIKI.config.db.type === `mariadb`)
    }

    const migrations = await knex('migrations')
    if (_.some(migrations, m => m.name.indexOf('2.0.0-beta') >= 0)) {
      // -> Pre-beta.241 locale field length fix
      const localeColnInfo = await knex('pages').columnInfo('localeCode')
      if (WIKI.config.db.type !== 'sqlite' && localeColnInfo.maxLength === 2) {
        // -> Load locales
        const locales = await knex('locales')
        await knex.schema
          // -> Remove constraints
          .table('users', table => {
            table.dropForeign('localeCode')
          })
          .table('pages', table => {
            table.dropForeign('localeCode')
          })
          .table('pageHistory', table => {
            table.dropForeign('localeCode')
          })
          .table('pageTree', table => {
            table.dropForeign('localeCode')
          })
          // -> Recreate locales table
          .dropTable('locales')
          .createTable('locales', table => {
            if (dbCompat.charset) { table.charset('utf8mb4') }
            table.string('code', 5).notNullable().primary()
            table.json('strings')
            table.boolean('isRTL').notNullable().defaultTo(false)
            table.string('name').notNullable()
            table.string('nativeName').notNullable()
            table.integer('availability').notNullable().defaultTo(0)
            table.string('createdAt').notNullable()
            table.string('updatedAt').notNullable()
          })
        await knex('locales').insert(locales)
        // -> Alter columns length
        await knex.schema
          .table('users', table => {
            table.string('localeCode', 5).notNullable().defaultTo('en').alter()
          })
          .table('pages', table => {
            table.string('localeCode', 5).alter()
          })
          .table('pageHistory', table => {
            table.string('localeCode', 5).alter()
          })
          .table('pageTree', table => {
            table.string('localeCode', 5).alter()
          })
          // -> Restore restraints
          .table('users', table => {
            table.foreign('localeCode').references('code').inTable('locales')
          })
          .table('pages', table => {
            table.foreign('localeCode').references('code').inTable('locales')
          })
          .table('pageHistory', table => {
            table.foreign('localeCode').references('code').inTable('locales')
          })
          .table('pageTree', table => {
            table.foreign('localeCode').references('code').inTable('locales')
          })
      }

      // -> Advance to latest beta/rc migration state
      const baseMigrationPath = path.join(WIKI.SERVERPATH, (WIKI.config.db.type !== 'sqlite') ? 'db/beta/migrations' : 'db/beta/migrations-sqlite')
      await knex.migrate.latest({
        tableName: 'migrations',
        migrationSource: {
          async getMigrations() {
            const migrationFiles = await fs.readdir(baseMigrationPath)
            return migrationFiles.sort(semver.compare).map(m => ({
              file: m,
              directory: baseMigrationPath
            }))
          },
          getMigrationName(migration) {
            return migration.file
          },
          getMigration(migration) {
            return require(path.join(baseMigrationPath, migration.file))
          }
        }
      })

      // -> Cleanup migration table
      await knex('migrations').truncate()

      // -> Advance to stable 2.0 migration state
      await knex('migrations').insert({
        name: '2.0.0.js',
        batch: 1,
        migration_time: knex.fn.now()
      })
    }
  }
}
