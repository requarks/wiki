import _ from 'lodash-es'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import { parsePath }from '../../helpers/page.mjs'
import tsquery from 'pg-tsquery'

const tsq = tsquery()
const tagsInQueryRgx = /#[a-z0-9-\u3400-\u4DBF\u4E00-\u9FFF]+(?=(?:[^"]*(?:")[^"]*(?:"))*[^"]*$)/g

export default {
  Query: {
    /**
     * PAGE HISTORY
     */
    async pageHistoryById (obj, args, context, info) {
      const page = await WIKI.db.pages.query().select('path', 'locale').findById(args.id)
      if (WIKI.auth.checkAccess(context.req.user, ['read:history'], {
        path: page.path,
        locale: page.locale
      })) {
        return WIKI.db.pageHistory.getHistory({
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
    async pageVersionById (obj, args, context, info) {
      const page = await WIKI.db.pages.query().select('path', 'locale').findById(args.pageId)
      if (WIKI.auth.checkAccess(context.req.user, ['read:history'], {
        path: page.path,
        locale: page.locale
      })) {
        return WIKI.db.pageHistory.getVersion({
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
    async searchPages (obj, args, context) {
      const q = args.query.trim()
      const hasQuery = q.length > 0

      // -> Validate parameters
      if (!args.siteId) {
        throw new Error('Missing Site ID')
      }
      if (args.offset && args.offset < 0) {
        throw new Error('Invalid offset value.')
      }
      if (args.limit && (args.limit < 1 || args.limit > 100)) {
        throw new Error('Limit must be between 1 and 100.')
      }

      try {
        const dictName = 'english' // TODO: Use provided locale or fallback on site locale

        // -> Select Columns
        const searchCols = [
          'id',
          'path',
          'locale',
          'title',
          'description',
          'icon',
          'tags',
          'updatedAt',
          WIKI.db.knex.raw('count(*) OVER() AS total')
        ]

        // -> Set relevancy
        if (hasQuery) {
          searchCols.push(WIKI.db.knex.raw('ts_rank_cd(ts, query) AS relevancy'))
        } else {
          args.orderBy = args.orderBy === 'relevancy' ? 'title' : args.orderBy
        }

        // -> Add Highlighting if enabled
        if (WIKI.config.search.termHighlighting && hasQuery) {
          searchCols.push(WIKI.db.knex.raw(`ts_headline(?, "searchContent", query, 'MaxWords=5, MinWords=3, MaxFragments=5') AS highlight`, [dictName]))
        }

        const results = await WIKI.db.knex
          .select(searchCols)
          .fromRaw(hasQuery ? 'pages, to_tsquery(?, ?) query' : 'pages', hasQuery ? [dictName, tsq(q)] : [])
          .where('siteId', args.siteId)
          .where('isSearchableComputed', true)
          .where(builder => {
            if (args.path) {
              builder.where('path', 'ILIKE', `${args.path}%`)
            }
            if (args.locale?.length > 0) {
              builder.whereIn('locale', args.locale)
            }
            if (args.editor) {
              builder.where('editor', args.editor)
            }
            if (args.publishState) {
              builder.where('publishState', args.publishState)
            }
            if (args.tags) {
              builder.where('tags', '@>', args.tags)
            }
            if (hasQuery) {
              builder.whereRaw('query @@ ts')
            }
          })
          .orderBy(args.orderBy || 'relevancy', args.orderByDirection || 'desc')
          .offset(args.offset || 0)
          .limit(args.limit || 25)

        // -> Remove highlights without matches
        if (WIKI.config.search.termHighlighting && hasQuery) {
          for (const r of results) {
            if (r.highlight?.indexOf('<b>') < 0) {
              r.highlight = null
            }
          }
        }

        return {
          results,
          totalHits: results?.length > 0 ? results[0].total : 0
        }
      } catch (err) {
        WIKI.logger.warn(`Search Query Error: ${err.message}`)
        throw err
      }
    },
    /**
     * LIST PAGES
     */
    async pages (obj, args, context, info) {
      let results = await WIKI.db.pages.query().column([
        'pages.id',
        'path',
        'locale',
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
            queryBuilder.where('locale', args.locale)
          }
          if (args.creatorId && args.authorId && args.creatorId > 0 && args.authorId > 0) {
            queryBuilder.where(function () {
              this.where('creatorId', args.creatorId).orWhere('authorId', args.authorId)
            })
          } else {
            if (args.creatorId && args.creatorId > 0) {
              queryBuilder.where('creatorId', args.creatorId)
            }
            if (args.authorId && args.authorId > 0) {
              queryBuilder.where('authorId', args.authorId)
            }
          }
          if (args.tags && args.tags.length > 0) {
            queryBuilder.whereIn('tags.tag', args.tags.map(t => _.trim(t).toLowerCase()))
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
     * FETCH SINGLE PAGE BY ID
     */
    async pageById (obj, args, context, info) {
      const page = await WIKI.db.pages.getPageFromDb(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: page.path,
          locale: page.locale
        })) {
          return {
            ...page,
            ...page.config,
            scriptCss: page.scripts?.css,
            scriptJsLoad: page.scripts?.jsLoad,
            scriptJsUnload: page.scripts?.jsUnload
          }
        } else {
          throw new Error('ERR_FORBIDDEN')
        }
      } else {
        throw new Error('ERR_PAGE_NOT_FOUND')
      }
    },
    /**
     * FETCH SINGLE PAGE BY PATH
     */
    async pageByPath (obj, args, context, info) {
      // console.info(info)
      const pageArgs = parsePath(args.path)
      const page = await WIKI.db.pages.getPageFromDb({
        ...pageArgs,
        siteId: args.siteId
      })
      if (page) {
        return {
          ...page,
          ...page.config,
          scriptCss: page.scripts?.css,
          scriptJsLoad: page.scripts?.jsLoad,
          scriptJsUnload: page.scripts?.jsUnload
        }
      } else {
        throw new Error('ERR_PAGE_NOT_FOUND')
      }
    },

    /**
     * FETCH PATH FROM ALIAS
     */
    async pathFromAlias (obj, args, context, info) {
      const alias = args.alias?.trim()
      if (!alias) {
        throw new Error('ERR_ALIAS_MISSING')
      }
      if (!WIKI.sites[args.siteId]) {
        throw new Error('ERR_INVALID_SITE_ID')
      }
      const page = await WIKI.db.pages.query().findOne({
        alias: args.alias,
        siteId: args.siteId
      }).select('id', 'path', 'locale')
      if (!page) {
        throw new Error('ERR_ALIAS_NOT_FOUND')
      }
      return {
        id: page.id,
        path: WIKI.sites[args.siteId].config.localeNamespacing ? `${page.locale}/${page.path}` : page.path
      }
    },

    /**
     * FETCH TAGS
     */
    async tags (obj, args, context, info) {
      if (!args.siteId) { throw new Error('Missing Site ID')}
      const tags = await WIKI.db.knex('tags').where('siteId', args.siteId).orderBy('tag')
      // TODO: check permissions
      return tags
    },
    /**
     * FETCH PAGE TREE
     */
    async pageTree (obj, args, context, info) {
      let curPage = null

      if (!args.locale) { args.locale = WIKI.config.lang.code }

      if (args.path && !args.parent) {
        curPage = await WIKI.db.knex('pageTree').first('parent', 'ancestors').where({
          path: args.path,
          locale: args.locale
        })
        if (curPage) {
          args.parent = curPage.parent || 0
        } else {
          return []
        }
      }

      const results = await WIKI.db.knex('pageTree').where(builder => {
        builder.where('locale', args.locale)
        switch (args.mode) {
          case 'FOLDERS':
            builder.andWhere('isFolder', true)
            break
          case 'PAGES':
            builder.andWhereNotNull('pageId')
            break
        }
        if (!args.parent || args.parent < 1) {
          builder.whereNull('parent')
        } else {
          builder.where('parent', args.parent)
          if (args.includeAncestors && curPage && curPage.ancestors.length > 0) {
            builder.orWhereIn('id', _.isString(curPage.ancestors) ? JSON.parse(curPage.ancestors) : curPage.ancestors)
          }
        }
      }).orderBy([{ column: 'isFolder', order: 'desc' }, 'title'])
      return results.filter(r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).map(r => ({
        ...r,
        parent: r.parent || 0,
        locale: r.locale
      }))
    },
    /**
     * FETCH PAGE LINKS
     */
    async pageLinks (obj, args, context, info) {
      let results

      if (WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb' || WIKI.config.db.type === 'sqlite') {
        results = await WIKI.db.knex('pages')
          .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.locale' })
          .leftJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
          .where({
            'pages.locale': args.locale
          })
          .unionAll(
            WIKI.db.knex('pageLinks')
              .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.locale' })
              .leftJoin('pages', 'pageLinks.pageId', 'pages.id')
              .where({
                'pages.locale': args.locale
              })
          )
      } else {
        results = await WIKI.db.knex('pages')
          .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.locale' })
          .fullOuterJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
          .where({
            'pages.locale': args.locale
          })
      }

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
      let page = await WIKI.db.pages.query().select('path', 'locale', 'updatedAt').findById(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages'], {
          path: page.path,
          locale: page.locale
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
    async checkConflictsLatest (obj, args, context, info) {
      let page = await WIKI.db.pages.getPageFromDb(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages'], {
          path: page.path,
          locale: page.locale
        })) {
          return {
            ...page,
            tags: page.tags.map(t => t.tag),
            locale: page.locale
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    }
  },
  Mutation: {
    /**
     * CREATE PAGE
     */
    async createPage(obj, args, context) {
      try {
        const page = await WIKI.db.pages.createPage({
          ...args,
          user: context.req.user
        })
        return {
          operation: generateSuccess('Page created successfully.'),
          page
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * UPDATE PAGE
     */
    async updatePage(obj, args, context) {
      try {
        const page = await WIKI.db.pages.updatePage({
          ...args,
          user: context.req.user
        })
        return {
          operation: generateSuccess('Page has been updated.'),
          page
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * CONVERT PAGE
     */
    async convertPage(obj, args, context) {
      try {
        await WIKI.db.pages.convertPage({
          ...args,
          user: context.req.user
        })
        return {
          operation: generateSuccess('Page has been converted.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * RENAME PAGE
     */
    async renamePage(obj, args, context) {
      try {
        await WIKI.db.pages.movePage({
          ...args,
          user: context.req.user
        })
        return {
          operation: generateSuccess('Page has been moved.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * DELETE PAGE
     */
    async deletePage(obj, args, context) {
      try {
        await WIKI.db.pages.deletePage({
          ...args,
          user: context.req.user
        })
        return {
          operation: generateSuccess('Page has been deleted.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * DELETE TAG
     */
    async deleteTag (obj, args, context) {
      try {
        const tagToDel = await WIKI.db.tags.query().findById(args.id)
        if (tagToDel) {
          await tagToDel.$relatedQuery('pages').unrelate()
          await WIKI.db.tags.query().deleteById(args.id)
        } else {
          throw new Error('This tag does not exist.')
        }
        return {
          operation: generateSuccess('Tag has been deleted.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * UPDATE TAG
     */
    async updateTag (obj, args, context) {
      try {
        const affectedRows = await WIKI.db.tags.query()
          .findById(args.id)
          .patch({
            tag: _.trim(args.tag).toLowerCase(),
            title: _.trim(args.title)
          })
        if (affectedRows < 1) {
          throw new Error('This tag does not exist.')
        }
        return {
          operation: generateSuccess('Tag has been updated successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * FLUSH PAGE CACHE
     */
    async flushCache(obj, args, context) {
      try {
        await WIKI.db.pages.flushCache()
        WIKI.events.outbound.emit('flushCache')
        return {
          operation: generateSuccess('Pages Cache has been flushed successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * MIGRATE ALL PAGES FROM SOURCE LOCALE TO TARGET LOCALE
     */
    async migrateToLocale(obj, args, context) {
      try {
        const count = await WIKI.db.pages.migrateToLocale(args)
        return {
          operation: generateSuccess('Migrated content to target locale successfully.'),
          count
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * REBUILD TREE
     */
    async rebuildPageTree(obj, args, context) {
      try {
        await WIKI.db.pages.rebuildTree()
        return {
          operation: generateSuccess('Page tree rebuilt successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * RERENDER PAGE
     */
    async rerenderPage (obj, args, context) {
      try {
        const page = await WIKI.db.pages.query().findById(args.id)
        if (!page) {
          throw new WIKI.Error.PageNotFound()
        }
        await WIKI.db.pages.renderPage(page)
        return {
          operation: generateSuccess('Page rerendered successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * RESTORE PAGE VERSION
     */
    async restorePage (obj, args, context) {
      try {
        const page = await WIKI.db.pages.query().select('path', 'locale').findById(args.pageId)
        if (!page) {
          throw new WIKI.Error.PageNotFound()
        }

        if (!WIKI.auth.checkAccess(context.req.user, ['write:pages'], {
          path: page.path,
          locale: page.locale
        })) {
          throw new WIKI.Error.PageRestoreForbidden()
        }

        const targetVersion = await WIKI.db.pageHistory.getVersion({ pageId: args.pageId, versionId: args.versionId })
        if (!targetVersion) {
          throw new WIKI.Error.PageNotFound()
        }

        await WIKI.db.pages.updatePage({
          ...targetVersion,
          id: targetVersion.pageId,
          user: context.req.user,
          action: 'restored'
        })

        return {
          operation: generateSuccess('Page version restored successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Purge history
     */
    async purgePagesHistory (obj, args, context) {
      try {
        await WIKI.db.pageHistory.purge(args.olderThan)
        return {
          operation: generateSuccess('Page history purged successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  },
  Page: {
    icon (obj) {
      return obj.icon || 'las la-file-alt'
    },
    password (obj) {
      return obj.password ? '********' : ''
    },
    // async tags (obj) {
    //   return WIKI.db.pages.relatedQuery('tags').for(obj.id)
    // },
    tocDepth (obj) {
      return {
        min: obj.extra?.tocDepth?.min ?? 1,
        max: obj.extra?.tocDepth?.max ?? 2
      }
    }
    // comments(pg) {
    //   return pg.$relatedQuery('comments')
    // }
  }
}
