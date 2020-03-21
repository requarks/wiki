const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async pages() { return {} }
  },
  Mutation: {
    async pages() { return {} }
  },
  PageQuery: {
    /**
     * PAGE HISTORY
     */
    async history(obj, args, context, info) {
      const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(args.id)
      if (WIKI.auth.checkAccess(context.req.user, ['read:history'], {
        path: page.path,
        locale: page.localeCode
      })) {
        return WIKI.models.pageHistory.getHistory({
          pageId: args.id,
          offsetPage: args.offsetPage || 0,
          offsetSize: args.offsetSize || 100
        })
      } else {
        throw new WIKI.Error.PageHistoryForbidden()
      }
    },
    /**
     * PAGE VERSION
     */
    async version(obj, args, context, info) {
      const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(args.pageId)
      if (WIKI.auth.checkAccess(context.req.user, ['read:history'], {
        path: page.path,
        locale: page.localeCode
      })) {
        return WIKI.models.pageHistory.getVersion({
          pageId: args.pageId,
          versionId: args.versionId
        })
      } else {
        throw new WIKI.Error.PageHistoryForbidden()
      }
    },
    /**
     * SEARCH PAGES
     */
    async search (obj, args, context) {
      if (WIKI.data.searchEngine) {
        const resp = await WIKI.data.searchEngine.query(args.query, args)
        return {
          ...resp,
          results: _.filter(resp.results, r => {
            return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
              path: r.path,
              locale: r.locale
            })
          })
        }
      } else {
        return {
          results: [],
          suggestions: [],
          totalHits: 0
        }
      }
    },
    /**
     * LIST PAGES
     */
    async list (obj, args, context, info) {
      let results = await WIKI.models.pages.query().column([
        'pages.id',
        'path',
        { locale: 'localeCode' },
        'title',
        'description',
        'isPublished',
        'isPrivate',
        'privateNS',
        'contentType',
        'createdAt',
        'updatedAt'
      ])
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => {
          builder.select('tag')
        })
        .modify(queryBuilder => {
          if (args.limit) {
            queryBuilder.limit(args.limit)
          }
          if (args.locale) {
            queryBuilder.where('localeCode', args.locale)
          }
          if (args.tags && args.tags.length > 0) {
            queryBuilder.whereIn('tags.tag', args.tags)
          }
          const orderDir = args.orderByDirection === 'DESC' ? 'desc' : 'asc'
          switch (args.orderBy) {
            case 'CREATED':
              queryBuilder.orderBy('createdAt', orderDir)
              break
            case 'PATH':
              queryBuilder.orderBy('path', orderDir)
              break
            case 'TITLE':
              queryBuilder.orderBy('title', orderDir)
              break
            case 'UPDATED':
              queryBuilder.orderBy('updatedAt', orderDir)
              break
            default:
              queryBuilder.orderBy('pages.id', orderDir)
              break
          }
        })
      results = _.filter(results, r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).map(r => ({
        ...r,
        tags: _.map(r.tags, 'tag')
      }))
      if (args.tags && args.tags.length > 0) {
        results = _.filter(results, r => _.every(args.tags, t => _.includes(r.tags, t)))
      }
      return results
    },
    /**
     * FETCH SINGLE PAGE
     */
    async single (obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['manage:pages', 'delete:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return {
            ...page,
            locale: page.localeCode,
            editor: page.editorKey
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },
    /**
     * FETCH TAGS
     */
    async tags (obj, args, context, info) {
      return WIKI.models.tags.query().orderBy('tag', 'asc')
    },
    /**
     * SEARCH TAGS
     */
    async searchTags (obj, args, context, info) {
      const results = await WIKI.models.tags.query()
        .column('tag')
        .where(builder => {
          builder.andWhere(builderSub => {
            if (WIKI.config.db.type === 'postgres') {
              builderSub.where('tag', 'ILIKE', `%${args.query}%`)
            } else {
              builderSub.where('tag', 'LIKE', `%${args.query}%`)
            }
          })
        })
        .limit(5)
      return results.map(r => r.tag)
    },
    /**
     * FETCH PAGE TREE
     */
    async tree (obj, args, context, info) {
      let results = []
      let conds = {
        localeCode: args.locale
      }
      if (args.parent) {
        conds.parent = (args.parent < 1) ? null : args.parent
      } else if (args.path) {
        // conds.parent = (args.parent < 1) ? null : args.parent
      }
      switch (args.mode) {
        case 'FOLDERS':
          conds.isFolder = true
          results = await WIKI.models.knex('pageTree').where(conds)
          break
        case 'PAGES':
          await WIKI.models.knex('pageTree').where(conds).andWhereNotNull('pageId')
          break
        default:
          results = await WIKI.models.knex('pageTree').where(conds)
          break
      }
      return results.filter(r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.localeCode
        })
      }).map(r => ({
        ...r,
        parent: r.parent || 0,
        locale: r.localeCode
      }))
    },
    /**
     * FETCH PAGE LINKS
     */
    async links (obj, args, context, info) {
      let results = []

      results = await WIKI.models.knex('pages')
        .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.localeCode' })
        .fullOuterJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
        .where({
          'pages.localeCode': args.locale
        })

      return _.reduce(results, (result, val) => {
        // -> Check if user has access to source and linked page
        if (
          !WIKI.auth.checkAccess(context.req.user, ['read:pages'], { path: val.path, locale: args.locale }) ||
          !WIKI.auth.checkAccess(context.req.user, ['read:pages'], { path: val.link, locale: val.locale })
        ) {
          return result
        }

        const existingEntry = _.findIndex(result, ['id', val.id])
        if (existingEntry >= 0) {
          if (val.link) {
            result[existingEntry].links.push(`${val.locale}/${val.link}`)
          }
        } else {
          result.push({
            id: val.id,
            title: val.title,
            path: `${args.locale}/${val.path}`,
            links: val.link ? [`${val.locale}/${val.link}`] : []
          })
        }
        return result
      }, [])
    },
    /**
     * CHECK FOR EDITING CONFLICT
     */
    async checkConflicts (obj, args, context, info) {
      let page = await WIKI.models.pages.query().select('path', 'localeCode', 'updatedAt').findById(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return page.updatedAt > args.checkoutDate
        } else {
          throw new WIKI.Error.PageUpdateForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },
    /**
     * FETCH LATEST VERSION FOR CONFLICT COMPARISON
     */
    async conflictLatest (obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return {
            ...page,
            tags: page.tags.map(t => t.tag),
            locale: page.localeCode
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    }
  },
  PageMutation: {
    /**
     * CREATE PAGE
     */
    async create(obj, args, context) {
      try {
        const page = await WIKI.models.pages.createPage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page created successfully.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPDATE PAGE
     */
    async update(obj, args, context) {
      try {
        const page = await WIKI.models.pages.updatePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been updated.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * MOVE PAGE
     */
    async move(obj, args, context) {
      try {
        await WIKI.models.pages.movePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been moved.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * DELETE PAGE
     */
    async delete(obj, args, context) {
      try {
        await WIKI.models.pages.deletePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been deleted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * DELETE TAG
     */
    async deleteTag (obj, args, context) {
      try {
        const tagToDel = await WIKI.models.tags.query().findById(args.id)
        if (tagToDel) {
          await tagToDel.$relatedQuery('pages').unrelate()
          await WIKI.models.tags.query().deleteById(args.id)
        } else {
          throw new Error('This tag does not exist.')
        }
        return {
          responseResult: graphHelper.generateSuccess('Tag has been deleted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPDATE TAG
     */
    async updateTag (obj, args, context) {
      try {
        const affectedRows = await WIKI.models.tags.query()
          .findById(args.id)
          .patch({
            tag: args.tag,
            title: args.title
          })
        if (affectedRows < 1) {
          throw new Error('This tag does not exist.')
        }
        return {
          responseResult: graphHelper.generateSuccess('Tag has been updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * FLUSH PAGE CACHE
     */
    async flushCache(obj, args, context) {
      try {
        await WIKI.models.pages.flushCache()
        return {
          responseResult: graphHelper.generateSuccess('Pages Cache has been flushed successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * MIGRATE ALL PAGES FROM SOURCE LOCALE TO TARGET LOCALE
     */
    async migrateToLocale(obj, args, context) {
      try {
        const count = await WIKI.models.pages.migrateToLocale(args)
        return {
          responseResult: graphHelper.generateSuccess('Migrated content to target locale successfully.'),
          count
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * REBUILD TREE
     */
    async rebuildTree(obj, args, context) {
      try {
        await WIKI.models.pages.rebuildTree()
        return {
          responseResult: graphHelper.generateSuccess('Page tree rebuilt successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * RENDER PAGE
     */
    async render (obj, args, context) {
      try {
        const page = await WIKI.models.pages.query().findById(args.id)
        if (!page) {
          throw new WIKI.Error.PageNotFound()
        }
        await WIKI.models.pages.renderPage(page)
        return {
          responseResult: graphHelper.generateSuccess('Page rendered successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * RESTORE PAGE VERSION
     */
    async restore (obj, args, context) {
      try {
        const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(args.pageId)
        if (!page) {
          throw new WIKI.Error.PageNotFound()
        }

        if (!WIKI.auth.checkAccess(context.req.user, ['write:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          throw new WIKI.Error.PageRestoreForbidden()
        }

        const targetVersion = await WIKI.models.pageHistory.getVersion({ pageId: args.pageId, versionId: args.versionId })
        if (!targetVersion) {
          throw new WIKI.Error.PageNotFound()
        }

        await WIKI.models.pages.updatePage({
          ...targetVersion,
          id: targetVersion.pageId,
          user: context.req.user,
          action: 'restored'
        })

        return {
          responseResult: graphHelper.generateSuccess('Page version restored successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  Page: {
    // comments(pg) {
    //   return pg.$relatedQuery('comments')
    // }
  }
}
