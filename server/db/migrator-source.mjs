import path from 'node:path'
import fse from 'fs-extra'
import semver from 'semver'

export default {
  /**
   * Gets the migration names
   * @returns Promise<string[]>
   */
  async getMigrations() {
    const baseMigrationPath = path.join(WIKI.SERVERPATH, 'db/migrations')
    const migrationFiles = await fse.readdir(baseMigrationPath)
    return migrationFiles.map(m => m.replace('.mjs', '')).sort(semver.compare).map(m => ({
      file: m,
      directory: baseMigrationPath
    }))
  },

  getMigrationName(migration) {
    return migration.file.indexOf('.mjs') >= 0 ? migration.file : `${migration.file}.mjs`
  },

  async getMigration(migration) {
    return import(path.join(WIKI.SERVERPATH, 'db/migrations', `${migration.file}.mjs`))
  }
}
