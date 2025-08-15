const Model = require('objection').Model
const validate = require('validate.js')
const _ = require('lodash')

/* global WIKI */

/**
 * Comments model
 */
module.exports = class Comment extends Model {
  static get tableName() {
    return 'comments'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [],

      properties: {
        id: { type: 'integer' },
        content: { type: 'string' },
        render: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        ip: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  }

  static get relationMappings() {
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'comments.authorId',
          to: 'users.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'comments.pageId',
          to: 'pages.id'
        }
      },
      userMentions: {
        relation: Model.HasManyRelation,
        modelClass: require('./userMentions'),
        join: {
          from: 'comments.id',
          to: 'userMentions.commentId'
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

  static async _loadAndAuthorizePage(
    pageId,
    user,
    requiredPermissions,
    errorType
  ) {
    const page = await WIKI.models.pages.getPageFromDb(pageId)
    if (!page) throw new WIKI.Error.PageNotFound()

    const hasAccess = WIKI.auth.checkAccess(user, requiredPermissions, {
      path: page.path,
      locale: page.localeCode,
      tags: page.tags,
      siteId: page.siteId
    })

    if (!hasAccess) throw new WIKI.Error[errorType]()

    return page
  }

  static _validateCommentOwnership(comment, user) {
    if (!WIKI.auth.isSuperAdmin(user) && comment.authorId !== user.id) {
      throw new WIKI.Error.CommentManageForbidden()
    }
  }

  /**
   * Post New Comment
   */
  static async postNewComment({
    pageId,
    replyTo,
    content,
    guestName,
    guestEmail,
    user,
    ip
  }) {
    if (user.id === 2) {
      const validation = validate(
        {
          email: _.toLower(guestEmail),
          name: guestName
        },
        {
          email: { email: true, length: { maximum: 255 } },
          name: {
            presence: { allowEmpty: false },
            length: { minimum: 2, maximum: 255 }
          }
        },
        { format: 'flat' }
      )

      if (validation?.length) throw new WIKI.Error.InputInvalid(validation[0])
    }
    content = _.trim(content)
    if (content.length < 2) throw new WIKI.Error.CommentContentMissing()

    const page = await this._loadAndAuthorizePage(
      pageId,
      user,
      ['write:comments'],
      'CommentPostForbidden'
    )

    return WIKI.data.commentProvider.create({
      page,
      replyTo,
      content,
      user: {
        ...user,
        ...(user.id === 2 ? { name: guestName, email: guestEmail } : {}),
        ip
      }
    })
  }

  /**
   * Update an Existing Comment
   */
  static async updateComment({ id, content, user, ip }) {
    const comment = await WIKI.data.commentProvider.getCommentById(id)
    if (!comment?.pageId) throw new WIKI.Error.CommentNotFound()

    this._validateCommentOwnership(comment, user)

    const page = await this._loadAndAuthorizePage(
      comment.pageId,
      user,
      ['manage:own_comments'],
      'CommentManageForbidden'
    )

    return WIKI.data.commentProvider.update({
      id,
      content,
      page,
      user: { ...user, ip }
    })
  }

  /**
   * Delete an Existing Comment
   */
  static async deleteComment({ id, user, ip }) {
    const comment = await WIKI.data.commentProvider.getCommentById(id)
    if (!comment?.pageId) throw new WIKI.Error.CommentNotFound()

    this._validateCommentOwnership(comment, user)

    const page = await this._loadAndAuthorizePage(
      comment.pageId,
      user,
      ['manage:own_comments'],
      'CommentManageForbidden'
    )

    return WIKI.data.commentProvider.remove({
      id,
      page,
      user: { ...user, ip }
    })
  }
}
