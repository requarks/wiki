/* global WIKI */

module.exports = {
  Query: {
    async releaseInfos (obj, { displayOnly = true }) {
      let query = WIKI.models.releaseInfo.query().withGraphFetched('notes')
      if (displayOnly) {
        query.where('display', true)
      }
      return (await query.orderBy('release_date', 'desc')).map(r => mapReleaseInfo(r))
    },
    async releaseNotes (obj, { versionNumber }) {
      const notes = await WIKI.models.releaseNotes.query().where({ version_number: versionNumber }).orderBy('id')
      return notes.map(n => mapReleaseNote(n))
    },
    async latestReleaseInfo () {
      const release = await WIKI.models.releaseInfo.query().withGraphFetched('notes').orderBy('release_date', 'desc').first()
      return release ? mapReleaseInfo(release) : null
    },
 
  }
}

function mapReleaseInfo (row) {
  if (!row) return null
  return {
    versionNumber: row.version_number,
    releaseDate: row.release_date,
    display: !!row.display,
    notes: (row.notes || []).map(mapReleaseNote)
  }
}

function mapReleaseNote (row) {
  return {
    id: row.id,
    versionNumber: row.version_number,
    notesEn: row.notes_en,
    notesDe: row.notes_de
  }
}
