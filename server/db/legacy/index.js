const _ = require('lodash')

/* global WIKI */

module.exports = {
  async migrate (knex) {
    const migrationsTableExists = await knex.schema.hasTable('migrations')
    if (!migrationsTableExists) {
      return
    }

    const migrations = await knex('migrations')
    if (_.some(migrations, m => m.name.indexOf('2.0.0') === 0)) {
      WIKI.logger.info('Found legacy 2.x installation of Wiki.js...')
      if (_.some(migrations, m => m.name.indexOf('2.5.128') === 0)) {
        // TODO: 2.x MIGRATIONS for 3.0
        WIKI.logger.error('Upgrading from 2.x is not yet supported. A future release will allow for upgrade from 2.x. Exiting...')
        process.exit(1)

        // -> Cleanup migration table
        await knex('migrations').truncate()

        // -> Advance to stable 3.0 migration state
        await knex('migrations').insert({
          name: '3.0.0.js',
          batch: 1,
          migration_time: knex.fn.now()
        })
      } else {
        console.error('CANNOT UPGRADE FROM OLDER UNSUPPORTED VERSION. UPGRADE TO THE LATEST 2.X VERSION FIRST! Exiting...')
        process.exit(1)
      }
    }
  }
}
