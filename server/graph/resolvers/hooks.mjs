import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import _ from 'lodash-es'

export default {
  Query: {
    async hooks () {
      return WIKI.db.hooks.query().orderBy('name')
    },
    async hookById (obj, args) {
      return WIKI.db.hooks.query().findById(args.id)
    }
  },
  Mutation: {
    /**
     * CREATE HOOK
     */
    async createHook (obj, args) {
      try {
        // -> Validate inputs
        if (!args.name || args.name.length < 1) {
          throw new WIKI.Error.Custom('HookCreateInvalidName', 'Invalid Hook Name')
        }
        if (!args.events || args.events.length < 1) {
          throw new WIKI.Error.Custom('HookCreateInvalidEvents', 'Invalid Hook Events')
        }
        if (!args.url || args.url.length < 8 || !args.url.startsWith('http')) {
          throw new WIKI.Error.Custom('HookCreateInvalidURL', 'Invalid Hook URL')
        }
        // -> Create hook
        const newHook = await WIKI.db.hooks.createHook(args)
        WIKI.logger.debug(`New Hook ${newHook.id} created successfully.`)

        return {
          operation: generateSuccess('Hook created successfully'),
          hook: newHook
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * UPDATE HOOK
     */
    async updateHook (obj, args) {
      try {
        // -> Load hook
        const hook = await WIKI.db.hooks.query().findById(args.id)
        if (!hook) {
          throw new WIKI.Error.Custom('HookInvalidId', 'Invalid Hook ID')
        }
        // -> Check for bad input
        if (_.has(args.patch, 'name') && args.patch.name.length < 1) {
          throw new WIKI.Error.Custom('HookCreateInvalidName', 'Invalid Hook Name')
        }
        if (_.has(args.patch, 'events') && args.patch.events.length < 1) {
          throw new WIKI.Error.Custom('HookCreateInvalidEvents', 'Invalid Hook Events')
        }
        if (_.has(args.patch, 'url') && (_.trim(args.patch.url).length < 8 || !args.patch.url.startsWith('http'))) {
          throw new WIKI.Error.Custom('HookInvalidURL', 'URL is invalid.')
        }
        // -> Update hook
        await WIKI.db.hooks.query().findById(args.id).patch(args.patch)
        WIKI.logger.debug(`Hook ${args.id} updated successfully.`)

        return {
          operation: generateSuccess('Hook updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * DELETE HOOK
     */
    async deleteHook (obj, args) {
      try {
        await WIKI.db.hooks.deleteHook(args.id)
        WIKI.logger.debug(`Hook ${args.id} deleted successfully.`)
        return {
          operation: generateSuccess('Hook deleted successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
