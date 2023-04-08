import { Model } from 'objection'
import { has, reduce, set } from 'lodash-es'

/**
 * Settings model
 */
export class Setting extends Model {
  static get tableName() { return 'settings' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key'],

      properties: {
        key: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['value']
  }

  static async getConfig() {
    const settings = await WIKI.db.settings.query()
    if (settings.length > 0) {
      return reduce(settings, (res, val, key) => {
        set(res, val.key, (has(val.value, 'v')) ? val.value.v : val.value)
        return res
      }, {})
    } else {
      return false
    }
  }
}
