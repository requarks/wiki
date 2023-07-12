import { Model } from 'objection'
import { difference, some, uniq } from 'lodash-es'

const allowedCharsRgx = /^[a-z0-9-\u3400-\u4DBF\u4E00-\u9FFF]+$/

/**
 * Tags model
 */
export class Tag extends Model {
  static get tableName() { return 'tags' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['tag'],

      properties: {
        id: {type: 'string'},
        tag: {type: 'string'},

        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  static async processNewTags (tags, siteId) {
    // Validate tags

    const normalizedTags = uniq(tags.map(t => t.trim().toLowerCase().replaceAll('#', '')).filter(t => t))

    for (const tag of normalizedTags) {
      if (!allowedCharsRgx.test(tag)) {
        throw new Error(`Tag #${tag} has invalid characters. Must consists of letters (no diacritics), numbers, CJK logograms and dashes only.`)
      }
    }

    // Fetch existing tags

    const existingTags = await WIKI.db.knex('tags').column('tag').where('siteId', siteId).pluck('tag')

    // Create missing tags

    const newTags = difference(normalizedTags, existingTags).map(t => ({ tag: t, usageCount: 1, siteId }))
    if (newTags.length > 0) {
      await WIKI.db.tags.query().insert(newTags)
    }

    return normalizedTags
  }
}
