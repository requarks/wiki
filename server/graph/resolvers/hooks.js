const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async hooks () {
      WIKI.logger.warn('Seriously man')
      return WIKI.models.hooks.query().orderBy('name')
    },
    async hookById (obj, args) {
      return WIKI.models.hooks.query().findById(args.id)
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
        const newHook = await WIKI.models.hooks.createHook(args)
        WIKI.logger.debug(`New Hook ${newHook.id} created successfully.`)

        return {
          operation: graphHelper.generateSuccess('Hook created successfully'),
          hook: newHook
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPDATE HOOK
     */
    async updateHook (obj, args) {
      try {
        // -> Load hook
        const hook = await WIKI.models.hooks.query().findById(args.id)
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
        await WIKI.models.hooks.query().findById(args.id).patch(args.patch)
        WIKI.logger.debug(`Hook ${args.id} updated successfully.`)

        return {
          operation: graphHelper.generateSuccess('Hook updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * DELETE HOOK
     */
    async deleteHook (obj, args) {
      try {
        await WIKI.models.hooks.deleteHook(args.id)
        WIKI.logger.debug(`Hook ${args.id} deleted successfully.`)
        return {
          operation: graphHelper.generateSuccess('Hook deleted successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
