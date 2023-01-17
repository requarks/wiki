const fs = require('fs-extra')

module.exports = {
  async activated () { },
  async deactivated () { },
  async init () { },
  async created (page) { },
  async updated (page) { },
  async deleted (page) { },
  async renamed (page) { },
  async assetUploaded ({ asset, tempFilePath, createReadStream }) {
    await WIKI.db.knex('assets').where({
      id: asset.id
    }).update({
      data: await fs.readFile(tempFilePath)
    })
    return {
      available: true
    }
  },
  async assetDeleted (asset) { },
  async assetRenamed (asset) { },
  async getLocalLocation () { },
  async exportAll () { }
}
