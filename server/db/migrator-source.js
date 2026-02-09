const path = require('path')
const fs = require('fs-extra')
const semver = require('semver')

const baseMigrationPath = path.join(WIKI.SERVERPATH, (WIKI.config.db.type !== 'sqlite') ? 'db/migrations' : 'db/migrations-sqlite')

/* global WIKI */

module.exports = {
  /**
   * Gets the migration names
   * @returns Promise<string[]>
   */
  async getMigrations() {
    const migrationFiles = await fs.readdir(baseMigrationPath)

    // Only include valid semver-like migration filenames.
    // Migrations are stored as "X.Y.Z.js"; helper files like "_helpers.js" live
    // alongside them and must be excluded, otherwise semver parsing throws.
    const migrations = migrationFiles
      .filter(f => f.toLowerCase().endsWith('.js'))
      .map(f => f.replace(/\.js$/i, ''))
      .filter(name => Boolean(semver.valid(name)))
      .sort(semver.compare)
      .map(name => ({
        file: name,
        directory: baseMigrationPath
      }))

    return migrations
  },

  getMigrationName(migration) {
    return migration.file.indexOf('.js') >= 0 ? migration.file : `${migration.file}.js`
  },

  getMigration(migration) {
    return require(path.join(baseMigrationPath, migration.file))
  }
}
