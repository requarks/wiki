const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async hooks () {
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
          throw WIKI.ERROR(new Error('Invalid Hook Name'), 'HookCreateInvalidName')
        }
        if (!args.events || args.events.length < 1) {
          throw WIKI.ERROR(new Error('Invalid Hook Events'), 'HookCreateInvalidEvents')
        }
        if (!args.url || args.url.length < 8 || !args.url.startsWith('http')) {
          throw WIKI.ERROR(new Error('Invalid Hook URL'), 'HookCreateInvalidURL')
        }
        // -> Create hook
        const newHook = await WIKI.models.hooks.createHook(args)
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
          throw WIKI.ERROR(new Error('Invalid Hook ID'), 'HookInvalidId')
        }
        // -> Check for bad input
        if (_.has(args.patch, 'name') && args.patch.name.length < 1) {
          throw WIKI.ERROR(new Error('Invalid Hook Name'), 'HookCreateInvalidName')
        }
        if (_.has(args.patch, 'events') && args.patch.events.length < 1) {
          throw WIKI.ERROR(new Error('Invalid Hook Events'), 'HookCreateInvalidEvents')
        }
        if (_.has(args.patch, 'url') && (_.trim(args.patch.url).length < 8 || !args.patch.url.startsWith('http'))) {
          throw WIKI.ERROR(new Error('URL is invalid.'), 'HookInvalidURL')
        }
        // -> Update hook
        await WIKI.models.hooks.query().findById(args.id).patch(args.patch)

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
        return {
          operation: graphHelper.generateSuccess('Hook deleted successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
