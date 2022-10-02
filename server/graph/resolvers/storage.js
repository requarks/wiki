const _ = require('lodash')
const graphHelper = require('../../helpers/graph')
const { v4: uuid } = require('uuid')

module.exports = {
  Query: {
    async storageTargets (obj, args, context, info) {
      const dbTargets = await WIKI.db.storage.getTargets({ siteId: args.siteId })
      // targets = _.sortBy(targets.map(tgt => {
      //   const targetInfo = _.find(WIKI.data.storage, ['module', tgt.key]) || {}
      //   return {
      //     ...targetInfo,
      //     ...tgt,
      //     hasSchedule: (targetInfo.schedule !== false),
      //     syncInterval: targetInfo.syncInterval || targetInfo.schedule || 'P0D',
      //     syncIntervalDefault: targetInfo.schedule,
      //     config: _.sortBy(_.transform(tgt.config, (res, value, key) => {
      //       const configData = _.get(targetInfo.props, key, false)
      //       if (configData) {
      //         res.push({
      //           key,
      //           value: JSON.stringify({
      //             ...configData,
      //             value: (configData.sensitive && value.length > 0) ? '********' : value
      //           })
      //         })
      //       }
      //     }, []), 'key')
      //   }
      // }), ['title', 'key'])
      return _.sortBy(WIKI.storage.defs.map(md => {
        const dbTarget = dbTargets.find(tg => tg.module === md.key)
        return {
          id: dbTarget?.id ?? uuid(),
          isEnabled: dbTarget?.isEnabled ?? false,
          module: md.key,
          title: md.title,
          description: md.description,
          icon: md.icon,
          banner: md.banner,
          vendor: md.vendor,
          website: md.website,
          contentTypes: {
            activeTypes: dbTarget?.contentTypes?.activeTypes ?? md.contentTypes.defaultTypesEnabled,
            largeThreshold: dbTarget?.contentTypes?.largeThreshold ?? md.contentTypes.defaultLargeThreshold
          },
          assetDelivery: {
            isStreamingSupported: md?.assetDelivery?.isStreamingSupported ?? false,
            isDirectAccessSupported: md?.assetDelivery?.isDirectAccessSupported ?? false,
            streaming: dbTarget?.assetDelivery?.streaming ?? md?.assetDelivery?.defaultStreamingEnabled ?? false,
            directAccess: dbTarget?.assetDelivery?.directAccess ?? md?.assetDelivery?.defaultDirectAccessEnabled ?? false
          },
          versioning: {
            isSupported: md?.versioning?.isSupported ?? false,
            isForceEnabled: md?.versioning?.isForceEnabled ?? false,
            enabled: dbTarget?.versioning?.enabled ?? md?.versioning?.defaultEnabled ?? false
          },
          sync: {},
          status: {},
          setup: {
            handler: md?.setup?.handler,
            state: dbTarget?.state?.setup ?? 'notconfigured',
            values: md.setup?.handler ?
              _.transform(md.setup.defaultValues,
                (r, v, k) => {
                  r[k] = dbTarget?.config?.[k] ?? v
                }, {}) :
              {}
          },
          config: _.transform(md.props, (r, v, k) => {
            const cfValue = dbTarget?.config?.[k] ?? v.default
            r[k] = {
              ...v,
              value: v.sensitive && cfValue ? '********' : cfValue,
              ...v.enum && {
                enum: v.enum.map(o => {
                  if (o.indexOf('|') > 0) {
                    const oParsed = o.split('|')
                    return {
                      value: oParsed[0],
                      label: oParsed[1]
                    }
                  } else {
                    return {
                      value: o,
                      label: o
                    }
                  }
                })
              }
            }
          }, {}),
          actions: md.actions
        }
      }), ['title'])
    }
  },
  Mutation: {
    async updateStorageTargets (obj, args, context) {
      WIKI.logger.debug(`Updating storage targets for site ${args.siteId}...`)
      try {
        const dbTargets = await WIKI.db.storage.getTargets({ siteId: args.siteId })
        for (const tgt of args.targets) {
          const md = _.find(WIKI.storage.defs, ['key', tgt.module])
          if (!md) {
            throw new Error('Invalid module key for non-existent storage target.')
          }

          const dbTarget = _.find(dbTargets, ['id', tgt.id])

          // -> Build update config object
          const updatedConfig = dbTarget?.config ?? {}
          if (tgt.config) {
            for (const [key, prop] of Object.entries(md.props)) {
              if (prop.readOnly) { continue }
              if (!Object.prototype.hasOwnProperty.call(tgt.config, key)) { continue }
              if (prop.sensitive && tgt.config[key] === '********') { continue }
              updatedConfig[key] = tgt.config[key]
            }
          }

          // -> Target doesn't exist yet in the DB, let's create it
          if (!dbTarget) {
            WIKI.logger.debug(`No existing DB configuration for module ${tgt.module}. Creating a new one...`)
            await WIKI.db.storage.query().insert({
              id: tgt.id,
              module: tgt.module,
              siteId: args.siteId,
              isEnabled: tgt.isEnabled ?? false,
              contentTypes: {
                activeTypes: tgt.contentTypes ?? md.contentTypes.defaultTypesEnabled ?? [],
                largeThreshold: tgt.largeThreshold ?? md.contentTypes.defaultLargeThreshold ?? '5MB'
              },
              assetDelivery: {
                streaming: tgt.assetDeliveryFileStreaming ?? md?.assetDelivery?.defaultStreamingEnabled ?? false,
                directAccess: tgt.assetDeliveryDirectAccess ?? md?.assetDelivery?.defaultDirectAccessEnabled ?? false
              },
              versioning: {
                enabled: tgt.useVersioning ?? md?.versioning?.defaultEnabled ?? false
              },
              state: {
                current: 'ok'
              },
              config: updatedConfig
            })
          } else {
            WIKI.logger.debug(`Updating DB configuration for module ${tgt.module}...`)
            await WIKI.db.storage.query().patch({
              isEnabled: tgt.isEnabled ?? dbTarget.isEnabled ?? false,
              contentTypes: {
                activeTypes: tgt.contentTypes ?? dbTarget?.contentTypes?.activeTypes ?? [],
                largeThreshold: tgt.largeThreshold ?? dbTarget?.contentTypes?.largeThreshold ?? '5MB'
              },
              assetDelivery: {
                streaming: tgt.assetDeliveryFileStreaming ?? dbTarget?.assetDelivery?.streaming ?? false,
                directAccess: tgt.assetDeliveryDirectAccess ?? dbTarget?.assetDelivery?.directAccess ?? false
              },
              versioning: {
                enabled: tgt.useVersioning ?? dbTarget?.versioning?.enabled ?? false
              },
              config: updatedConfig
            }).where('id', tgt.id)
          }
        }
        // await WIKI.db.storage.initTargets()
        return {
          status: graphHelper.generateSuccess('Storage targets updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async setupStorageTarget (obj, args, context) {
      try {
        const tgt = await WIKI.db.storage.query().findById(args.targetId)
        if (!tgt) {
          throw new Error('Not storage target matching this ID')
        }
        const md = _.find(WIKI.storage.defs, ['key', tgt.module])
        if (!md) {
          throw new Error('No matching storage module installed.')
        }
        if (!await WIKI.db.storage.ensureModule(md.key)) {
          throw new Error('Failed to load storage module. Check logs for details.')
        }
        const result = await WIKI.storage.modules[md.key].setup(args.targetId, args.state)

        return {
          status: graphHelper.generateSuccess('Storage target setup step succeeded'),
          state: result
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async destroyStorageTargetSetup (obj, args, context) {
      try {
        const tgt = await WIKI.db.storage.query().findById(args.targetId)
        if (!tgt) {
          throw new Error('Not storage target matching this ID')
        }
        const md = _.find(WIKI.storage.defs, ['key', tgt.module])
        if (!md) {
          throw new Error('No matching storage module installed.')
        }
        if (!await WIKI.db.storage.ensureModule(md.key)) {
          throw new Error('Failed to load storage module. Check logs for details.')
        }
        await WIKI.storage.modules[md.key].setupDestroy(args.targetId)

        return {
          status: graphHelper.generateSuccess('Storage target setup configuration destroyed succesfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async executeStorageAction (obj, args, context) {
      try {
        await WIKI.db.storage.executeAction(args.targetKey, args.handler)
        return {
          status: graphHelper.generateSuccess('Action completed.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
