const Model = require('objection').Model
const _ = require('lodash')

/* global WIKI */

/**
 * Tags model
 */
module.exports = class Tag extends Model {
  static get tableName() { return 'tags' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['tag'],

      properties: {
        id: {type: 'integer'},
        tag: {type: 'string'},
        title: {type: 'string'},

        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      pages: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./pages'),
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
    let existingTags = await WIKI.models.tags.query().column('id', 'tag')

    // Format tags

    tags = _.uniq(tags.map(t => t.toLowerCase()))

    // Create missing tags

    const newTags = _.filter(tags, t => !_.some(existingTags, ['tag', t])).map(t => ({
      tag: t,
      title: t
    }))
    if (newTags.length > 0) {
      if (WIKI.config.db.type === 'postgres') {
        const createdTags = await WIKI.models.tags.query().insert(newTags)
        existingTags = _.concat(existingTags, createdTags)
      } else {
        for (const newTag of newTags) {
          const createdTag = await WIKI.models.tags.query().insert(newTag)
          existingTags.push(createdTag)
        }
      }
    }

    // Fetch current page tags

    const targetTags = _.filter(existingTags, t => _.includes(tags, t.tag))
    const currentTags = await page.$relatedQuery('tags')

    // Tags to relate

    const tagsToRelate = _.differenceBy(targetTags, currentTags, 'id')
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

    const tagsToUnrelate = _.differenceBy(currentTags, targetTags, 'id')
    if (tagsToUnrelate.length > 0) {
      await page.$relatedQuery('tags').unrelate().whereIn('tags.id', _.map(tagsToUnrelate, 'id'))
    }

    page.tags = targetTags
  }
}
