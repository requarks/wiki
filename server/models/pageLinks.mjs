import { Model } from 'objection'

import { Page } from './pages.mjs'

/**
 * Users model
 */
export class PageLink extends Model {
  static get tableName() { return 'pageLinks' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['path', 'localeCode'],

      properties: {
        id: {type: 'integer'},
        path: {type: 'string'},
        localeCode: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: Page,
        join: {
          from: 'pageLinks.pageId',
          to: 'pages.id'
        }
      }
    }
  }
}
