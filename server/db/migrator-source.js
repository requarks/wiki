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
