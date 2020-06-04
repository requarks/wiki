const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * CommentProvider model
 */
module.exports = class CommentProvider extends Model {
  static get tableName() { return 'commentProviders' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getProvider(key) {
    return WIKI.models.commentProviders.query().findOne({ key })
  }

  static async getProviders(isEnabled) {
    const providers = await WIKI.models.commentProviders.query().where(_.isBoolean(isEnabled) ? { isEnabled } : {})
    return _.sortBy(providers, ['key'])
  }

  static async refreshProvidersFromDisk() {
    let trx
    try {
      const dbProviders = await WIKI.models.commentProviders.query()

      // -> Fetch definitions from disk
      const commentDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/comments'))
      let diskProviders = []
      for (let dir of commentDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/comments', dir, 'definition.yml'), 'utf8')
        diskProviders.push(yaml.safeLoad(def))
      }
      WIKI.data.commentProviders = diskProviders.map(provider => ({
        ...provider,
        props: commonHelper.parseModuleProps(provider.props)
      }))

      let newProviders = []
      for (let provider of WIKI.data.commentProviders) {
        if (!_.some(dbProviders, ['key', provider.key])) {
          newProviders.push({
            key: provider.key,
            isEnabled: provider.key === 'default',
            config: _.transform(provider.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {})
          })
        } else {
          const providerConfig = _.get(_.find(dbProviders, ['key', provider.key]), 'config', {})
          await WIKI.models.commentProviders.query().patch({
            config: _.transform(provider.props, (result, value, key) => {
              if (!_.has(result, key)) {
                _.set(result, key, value.default)
              }
              return result
            }, providerConfig)
          }).where('key', provider.key)
        }
      }
      if (newProviders.length > 0) {
        trx = await WIKI.models.Objection.transaction.start(WIKI.models.knex)
        for (let provider of newProviders) {
          await WIKI.models.commentProviders.query(trx).insert(provider)
        }
        await trx.commit()
        WIKI.logger.info(`Loaded ${newProviders.length} new comment providers: [ OK ]`)
      } else {
        WIKI.logger.info(`No new comment providers found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new comment providers: [ FAILED ]`)
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  }

  static async initProvider() {
    const commentProvider = await WIKI.models.commentProviders.query().findOne('isEnabled', true)
    if (commentProvider) {
      WIKI.data.commentProvider = {
        ..._.find(WIKI.data.commentProviders, ['key', commentProvider.key]),
        head: '',
        bodyStart: '',
        bodyEnd: '',
        main: '<comments></comments>'
      }

      if (WIKI.data.commentProvider.codeTemplate) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/comments', commentProvider.key, 'code.yml'), 'utf8')
        let code = yaml.safeLoad(def)
        code.head = _.defaultTo(code.head, '')
        code.body = _.defaultTo(code.body, '')
        code.main = _.defaultTo(code.main, '')

        _.forOwn(commentProvider.config, (value, key) => {
          code.head = _.replace(code.head, new RegExp(`{{${key}}}`, 'g'), value)
          code.body = _.replace(code.body, new RegExp(`{{${key}}}`, 'g'), value)
          code.main = _.replace(code.main, new RegExp(`{{${key}}}`, 'g'), value)
        })

        WIKI.data.commentProvider.head = code.head
        WIKI.data.commentProvider.body = code.body
        WIKI.data.commentProvider.main = code.main
      } else {
        WIKI.data.commentProvider = {
          ...WIKI.data.commentProvider,
          ...require(`../modules/comments/${commentProvider.key}/comment`),
          config: commentProvider.config
        }
        await WIKI.data.commentProvider.init()
      }
      WIKI.data.commentProvider.config = commentProvider.config
    }
  }
}
