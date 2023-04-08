import { Model } from 'objection'
import fs from 'node:fs/promises'
import path from 'node:path'
import { defaultTo, find, forOwn, isBoolean, replace, sortBy } from 'lodash-es'
import yaml from 'js-yaml'
import { parseModuleProps } from '../helpers/common.mjs'

/**
 * CommentProvider model
 */
export class CommentProvider extends Model {
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
    return WIKI.db.commentProviders.query().findOne({ key })
  }

  static async getProviders(isEnabled) {
    const providers = await WIKI.db.commentProviders.query().where(isBoolean(isEnabled) ? { isEnabled } : {})
    return sortBy(providers, ['module'])
  }

  static async refreshProvidersFromDisk() {
    try {
      // -> Fetch definitions from disk
      const commentsDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/comments'))
      WIKI.data.commentProviders = []
      for (const dir of commentsDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/comments', dir, 'definition.yml'), 'utf8')
        const defParsed = yaml.load(def)
        defParsed.key = dir
        defParsed.props = parseModuleProps(defParsed.props)
        WIKI.data.commentProviders.push(defParsed)
        WIKI.logger.debug(`Loaded comments provider module definition ${dir}: [ OK ]`)
      }

      WIKI.logger.info(`Loaded ${WIKI.data.commentProviders.length} comments providers module definitions: [ OK ]`)
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load comments providers: [ FAILED ]`)
      WIKI.logger.error(err)
    }
  }

  static async initProvider() {
    const commentProvider = await WIKI.db.commentProviders.query().findOne('isEnabled', true)
    if (commentProvider) {
      WIKI.data.commentProvider = {
        ...find(WIKI.data.commentProviders, ['key', commentProvider.module]),
        head: '',
        bodyStart: '',
        bodyEnd: '',
        main: '<comments></comments>'
      }

      if (WIKI.data.commentProvider.codeTemplate) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/comments', commentProvider.key, 'code.yml'), 'utf8')
        let code = yaml.safeLoad(def)
        code.head = defaultTo(code.head, '')
        code.body = defaultTo(code.body, '')
        code.main = defaultTo(code.main, '')

        forOwn(commentProvider.config, (value, key) => {
          code.head = replace(code.head, new RegExp(`{{${key}}}`, 'g'), value)
          code.body = replace(code.body, new RegExp(`{{${key}}}`, 'g'), value)
          code.main = replace(code.main, new RegExp(`{{${key}}}`, 'g'), value)
        })

        WIKI.data.commentProvider.head = code.head
        WIKI.data.commentProvider.body = code.body
        WIKI.data.commentProvider.main = code.main
      } else {
        WIKI.data.commentProvider = {
          ...WIKI.data.commentProvider,
          ...(await import(`../modules/comments/${commentProvider.key}/comment.mjs`)),
          config: commentProvider.config
        }
        await WIKI.data.commentProvider.init()
      }
      WIKI.data.commentProvider.config = commentProvider.config
    }
  }
}
