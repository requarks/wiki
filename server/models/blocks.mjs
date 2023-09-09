import { Model } from 'objection'

/**
 * Block model
 */
export class Block extends Model {
  static get tableName () { return 'blocks' }

  static get jsonAttributes () {
    return ['config']
  }

  static async addBlock (data) {
    return WIKI.db.blocks.query().insertAndFetch({
      block: data.block,
      name: data.name,
      description: data.description,
      icon: data.icon,
      isEnabled: true,
      isCustom: true,
      config: {}
    })
  }

  static async deleteBlock (id) {
    return WIKI.db.blocks.query().deleteById(id)
  }
}
