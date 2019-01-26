const path = require('path')
const fs = require('fs-extra')
const semver = require('semver')

/* global WIKI */

module.exports = {
  /**
   * Gets the migration names
   * @returns Promise<string[]>
   */
  async getMigrations() {
    const absoluteDir = path.join(WIKI.SERVERPATH, 'db/migrations')
    const migrationFiles = await fs.readdirAsync(absoluteDir)
    return migrationFiles.sort(semver.compare).map(m => ({
      file: m,
      directory: absoluteDir
    }))
  },

  getMigrationName(migration) {
    return migration.file;
  },

  getMigration(migration) {
    return require(path.join(WIKI.SERVERPATH, 'db/migrations', migration.file));
  }
}
