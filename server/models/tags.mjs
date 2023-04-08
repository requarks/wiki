import { Model } from 'objection'
import { concat, differenceBy, some, uniq } from 'lodash-es'

import { Page } from './pages.mjs'

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
        id: {type: 'integer'},
        tag: {type: 'string'},

        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      pages: {
        relation: Model.ManyToManyRelation,
        modelClass: Page,
        join: {
          from: 'tags.id',
          through: {
            from: 'pageTags.tagId',
            to: 'pageTags.pageId'
          },
          to: 'pages.id'
        }
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

  static async associateTags ({ tags, page }) {
    let existingTags = await WIKI.db.tags.query().column('id', 'tag')

    // Format tags

    tags = uniq(tags.map(t => t.trim().toLowerCase()))

    // Create missing tags

    const newTags = tags.filter(t => !some(existingTags, ['tag', t])).map(t => ({ tag: t }))
    if (newTags.length > 0) {
      if (WIKI.config.db.type === 'postgres') {
        const createdTags = await WIKI.db.tags.query().insert(newTags)
        existingTags = concat(existingTags, createdTags)
      } else {
        for (const newTag of newTags) {
          const createdTag = await WIKI.db.tags.query().insert(newTag)
          existingTags.push(createdTag)
        }
      }
    }

    // Fetch current page tags

    const targetTags = existingTags.filter(t => _.includes(tags, t.tag))
    const currentTags = await page.$relatedQuery('tags')

    // Tags to relate

    const tagsToRelate = differenceBy(targetTags, currentTags, 'id')
    if (tagsToRelate.length > 0) {
      if (WIKI.config.db.type === 'postgres') {
        await page.$relatedQuery('tags').relate(tagsToRelate)
      } else {
        for (const tag of tagsToRelate) {
          await page.$relatedQuery('tags').relate(tag)
        }
      }
    }

    // Tags to unrelate

    const tagsToUnrelate = differenceBy(currentTags, targetTags, 'id')
    if (tagsToUnrelate.length > 0) {
      await page.$relatedQuery('tags').unrelate().whereIn('tags.id', tagsToUnrelate.map(t => t.id))
    }

    page.tags = targetTags
  }
}
