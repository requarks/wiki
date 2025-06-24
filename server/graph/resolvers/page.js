const _ = require('lodash')
const graphHelper = require('../../helpers/graph')
const notifyUsers = require('../../jobs/notify-users')

/* global WIKI */

module.exports = {
  Query: {
    /**
     * PAGE HISTORY
     */
    async history(obj, args, context, info) {
      const page = await WIKI.models.pages
        .query()
        .select('path', 'localeCode', 'siteId')
        .findById(args.id)
      if (
        WIKI.auth.checkAccess(context.req.user, ['read:history'], {
          path: page.path,
          locale: page.localeCode,
          siteId: page.siteId
        })
      ) {
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
      const page = await WIKI.models.pages
        .query()
        .select('path', 'localeCode', 'siteId')
        .findById(args.pageId)
      if (
        WIKI.auth.checkAccess(context.req.user, ['read:history'], {
          path: page.path,
          locale: page.localeCode,
          siteId: page.siteId
        })
      ) {
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
    async searchPages(obj, args, context) {
      if (WIKI.data.searchEngine) {
        const resp = await WIKI.data.searchEngine.query(args.query, args)
        return {
          ...resp,
          results: _.filter(resp.results, (r) => {
            return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
              path: r.path,
              locale: r.locale,
              tags: r.tags, // Tags are needed since access permissions can be limited by page tags too
              siteId: args.siteId
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
    async listPages(obj, args, context, info) {
      let results = await WIKI.models.pages
        .query()
        .column([
          'pages.id',
          'pages.path',
          { locale: 'localeCode' },
          'pages.title',
          'pages.description',
          'pages.isPublished',
          'pages.isPrivate',
          'pages.privateNS',
          'pages.contentType',
          'pages.createdAt',
          'pages.updatedAt',
          'pages.siteId',
          'sites.name as siteName',
          'sites.path as sitePath'
        ])
        .leftJoin('sites', 'pages.siteId', 'sites.id')
        .withGraphJoined('tags')
        .modifyGraph('tags', (builder) => {
          builder.select('tag')
        })
        .modify((queryBuilder) => {
          if (args.limit) {
            queryBuilder.limit(args.limit)
          }
          if (args.locale) {
            queryBuilder.where('localeCode', args.locale)
          }
          if (args.siteId) {
            queryBuilder.where('siteId', args.siteId)
          }

          if (
            args.creatorId &&
            args.authorId &&
            args.creatorId > 0 &&
            args.authorId > 0
          ) {
            queryBuilder.where(function () {
              this.where('creatorId', args.creatorId).orWhere(
                'authorId',
                args.authorId
              )
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
            queryBuilder.whereIn(
              'tags.tag',
              args.tags.map((t) => _.trim(t).toLowerCase())
            )
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
      results = _.filter(results, (r) => {
        if (args.isAdmin === true) {
          return WIKI.auth.checkAccess(context.req.user, ['manage:sites'], {
            path: r.path,
            locale: r.locale,
            siteId: r.siteId
          })
        }
        return WIKI.auth.checkAccess(
          context.req.user,
          ['read:pages', 'manage:sites'],
          {
            path: r.path,
            locale: r.locale,
            siteId: r.siteId
          }
        )
      }).map((r) => ({
        ...r,
        tags: _.map(r.tags, 'tag')
      }))
      if (args.tags && args.tags.length > 0) {
        results = _.filter(results, (r) =>
          _.every(args.tags, (t) => _.includes(r.tags, t))
        )
      }
      return results
    },
    /**
     * FETCH SINGLE PAGE
     */
    async pageById(obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        if (
          WIKI.auth.checkAccess(
            context.req.user,
            ['manage:pages', 'delete:pages'],
            {
              path: page.path,
              locale: page.localeCode,
              siteId: page.siteId
            }
          )
        ) {
          return {
            ...page,
            locale: page.localeCode,
            editor: page.editorKey,
            scriptJs: page.extra.js,
            scriptCss: page.extra.css
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },
    async pageByPath(obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb({
        path: args.path,
        locale: args.locale,
        siteId: args.siteId
      })
      if (page) {
        if (
          WIKI.auth.checkAccess(
            context.req.user,
            ['manage:pages', 'delete:pages'],
            {
              path: page.path,
              locale: page.localeCode,
              siteId: page.siteId
            }
          )
        ) {
          return {
            ...page,
            locale: page.localeCode,
            editor: page.editorKey,
            scriptJs: page.extra.js,
            scriptCss: page.extra.css
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
    async tags(obj, args, context, info) {
      const pages = await WIKI.models.pages
        .query()
        .column(['path', { locale: 'localeCode' }])
        .modify((queryBuilder) => {
          if (args.siteId) {
            queryBuilder.where('tags.siteId', '=', args.siteId)
          }
        })
        .withGraphJoined('tags')
      const allTags = _.filter(pages, (r) => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale,
          siteId: args.siteId
        })
      }).flatMap((r) => r.tags)
      return _.orderBy(_.uniqBy(allTags, 'id'), ['tag'], ['asc'])
    },
    /**
     * SEARCH TAGS
     */
    async searchTags(obj, args, context, info) {
      const query = _.trim(args.query)
      const pages = await WIKI.models.pages
        .query()
        .column([
          {
            path: 'pages.path',
            locale: 'localeCode'
          }
        ])
        .withGraphJoined('tags')
        .modifyGraph('tags', (builder) => {
          builder.select('tag')
        })
        .modify((queryBuilder) => {
          queryBuilder.andWhere((builderSub) => {
            if (WIKI.config.db.type === 'postgres') {
              builderSub.where('tags.tag', 'ILIKE', `%${query}%`)
            } else {
              builderSub.where('tags.tag', 'LIKE', `%${query}%`)
            }
            builderSub.where('pages.siteId', '=', `${args.siteId}`)
          })
        })
      const allTags = _.filter(pages, (r) => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale,
          siteId: args.siteId
        })
      })
        .flatMap((r) => r.tags)
        .map((t) => t.tag)
      return _.uniq(allTags).slice(0, 5)
    },
    /**
     * FETCH PAGE TREE
     */
    async tree(obj, args, context, info) {
      let curPage = null

      if (!args.locale) {
        args.locale = WIKI.config.lang.code
      }

      if (args.path && !args.parent) {
        curPage = await WIKI.models
          .knex('pageTree')
          .first('parent', 'ancestors')
          .where({
            path: args.path,
            localeCode: args.locale,
            siteId: args.siteId
          })
        if (curPage) {
          args.parent = curPage.parent || 0
        } else {
          return []
        }
      }

      const results = await WIKI.models
        .knex('pageTree')
        .where((builder) => {
          builder.where('localeCode', args.locale)
          builder.where('siteId', args.siteId)
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
            if (
              args.includeAncestors &&
              curPage &&
              curPage.ancestors.length > 0
            ) {
              builder.orWhereIn(
                'id',
                _.isString(curPage.ancestors) ?
                  JSON.parse(curPage.ancestors) :
                  curPage.ancestors
              )
            }
          }
        })
        .orderBy([{ column: 'isFolder', order: 'desc' }, 'title'])
      return results
        .filter((r) => {
          return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
            path: r.path,
            locale: r.localeCode,
            siteId: r.siteId
          })
        })
        .map((r) => ({
          ...r,
          parent: r.parent || 0,
          locale: r.localeCode
        }))
    },
    /**
     * FETCH PAGE LINKS
     */
    async links(obj, args, context, info) {
      let results

      if (
        WIKI.config.db.type === 'mysql' ||
        WIKI.config.db.type === 'mariadb' ||
        WIKI.config.db.type === 'sqlite'
      ) {
        results = await WIKI.models
          .knex('pages')
          .column(
            { id: 'pages.id' },
            { path: 'pages.path' },
            'title',
            { link: 'pageLinks.path' },
            { locale: 'pageLinks.localeCode' }
          )
          .leftJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
          .where({
            'pages.localeCode': args.locale
          })
          .unionAll(
            WIKI.models
              .knex('pageLinks')
              .column(
                { id: 'pages.id' },
                { path: 'pages.path' },
                'title',
                { link: 'pageLinks.path' },
                { locale: 'pageLinks.localeCode' }
              )
              .leftJoin('pages', 'pageLinks.pageId', 'pages.id')
              .where({
                'pages.localeCode': args.locale
              })
          )
      } else {
        results = await WIKI.models
          .knex('pages')
          .column(
            { id: 'pages.id' },
            { path: 'pages.path' },
            'title',
            'siteId',
            { link: 'pageLinks.path' },
            { locale: 'pageLinks.localeCode' }
          )
          .fullOuterJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
          .where({
            'pages.localeCode': args.locale
          })
      }

      return _.reduce(
        results,
        (result, val) => {
          // -> Check if user has access to source and linked page
          if (
            !WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
              path: val.path,
              locale: args.locale,
              siteId: val.siteId
            }) ||
            !WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
              path: val.link,
              locale: val.locale,
              siteId: val.siteId
            })
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
        },
        []
      )
    },
    /**
     * CHECK FOR EDITING CONFLICT
     */
    async checkConflicts(obj, args, context, info) {
      let page = await WIKI.models.pages
        .query()
        .select('path', 'localeCode', 'updatedAt', 'siteId')
        .findById(args.id)
      if (page) {
        if (
          WIKI.auth.checkAccess(
            context.req.user,
            ['write:pages', 'manage:pages'],
            {
              path: page.path,
              locale: page.localeCode,
              siteId: page.siteId
            }
          )
        ) {
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
    async conflictLatest(obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        if (
          WIKI.auth.checkAccess(
            context.req.user,
            ['write:pages', 'manage:pages'],
            {
              path: page.path,
              locale: page.localeCode,
              siteId: page.siteId
            }
          )
        ) {
          return {
            ...page,
            tags: page.tags.map((t) => t.tag),
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
  Mutation: {
    async pages() {
      return {}
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

        // Add the creator as a follower
        await WIKI.models.followers.query().insert({
          siteId: page.siteId,
          pageId: page.id,
          userId: context.req.user.id
        })

        if (args.notifyFollowers) {
          // Notify followers
          const followers = await WIKI.models.followers
            .query()
            .where({ siteId: page.siteId, pageId: null })
          const followerIds = [
            ...new Set(followers.map((follower) => follower.userId))
          ]
          notifyUsers({
            siteId: page.siteId,
            pageId: page.id,
            pageTitle: page.title,
            pagePath: page.path,
            sitePath: page.sitePath,
            userEmail: context.req.user.email,
            userIds: followerIds,
            event: 'CREATE_PAGE',
            subjectText: 'Created Page'
          })
        }

        if (args.mentions?.length > 0) {
          // Notify mentioned users
          const mentionEmails = args.mentions
          const usersToMention = await WIKI.models.users
            .query()
            .whereIn('email', mentionEmails)
          const mentionIds = [
            ...new Set(usersToMention.map((user) => user.id))
          ]
          notifyUsers({
            siteId: page.siteId,
            pageId: page.id,
            pageTitle: page.title,
            pagePath: page.path,
            sitePath: page.sitePath,
            userEmail: context.req.user.email,
            userIds: mentionIds,
            event: 'MENTION_PAGE',
            subjectText: 'Mentioned in Page'
          })
        }

        return {
          responseResult: graphHelper.generateSuccess(
            'Page created successfully.'
          ),
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

        if (args.notifyFollowers) {
          // Notify followers
          const followers = await WIKI.models.followers
            .query()
            .where({ siteId: page.siteId, pageId: page.id })
            .orWhere({ siteId: page.siteId, pageId: null })
          const followerIds = [
            ...new Set(followers.map((follower) => follower.userId))
          ]
          notifyUsers({
            siteId: page.siteId,
            pageId: page.id,
            pageTitle: page.title,
            pagePath: page.path,
            sitePath: page.sitePath,
            userEmail: context.req.user.email,
            userIds: followerIds,
            event: 'UPDATE_PAGE',
            subjectText: 'Updated Page'
          })
        }

        if (args.mentions?.length > 0) {
          // Notify mentioned users
          const mentionEmails = args.mentions
          const usersToMention = await WIKI.models.users
            .query()
            .whereIn('email', mentionEmails)
          const mentionIds = [
            ...new Set(usersToMention.map((user) => user.id))
          ]
          notifyUsers({
            siteId: page.siteId,
            pageId: page.id,
            pageTitle: page.title,
            pagePath: page.path,
            sitePath: page.sitePath,
            userEmail: context.req.user.email,
            userIds: mentionIds,
            event: 'MENTION_PAGE',
            subjectText: 'Mentioned in Page'
          })
        }

        return {
          responseResult: graphHelper.generateSuccess('Page has been updated.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * CONVERT PAGE
     */
    async convert(obj, args, context) {
      try {
        await WIKI.models.pages.convertPage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess(
            'Page has been converted.'
          )
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
        const page = await WIKI.models.pages.query().findById(args.id)
        const followers = await WIKI.models.followers
          .query()
          .where({ siteId: page.siteId, pageId: page.id })
          .orWhere({ siteId: page.siteId, pageId: null })

        await WIKI.models.pages.deletePage({
          ...args,
          user: context.req.user
        })

        if (args.notifyFollowers) {
          // Notify followers
          const followerIds = [
            ...new Set(followers.map((follower) => follower.userId))
          ]
          notifyUsers({
            siteId: page.siteId,
            pageId: page.id,
            pageTitle: page.title,
            pagePath: page.path,
            sitePath: page.sitePath,
            userEmail: context.req.user.email,
            userIds: followerIds,
            event: 'DELETE_PAGE',
            subjectText: 'Deleted Page'
          })
        }

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
    async deleteTag(obj, args, context) {
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
    async updateTag(obj, args, context) {
      try {
        const affectedRows = await WIKI.models.tags
          .query()
          .findById(args.id)
          .patch({
            tag: _.trim(args.tag).toLowerCase(),
            title: _.trim(args.title)
          })
        if (affectedRows < 1) {
          throw new Error('This tag does not exist.')
        }
        return {
          responseResult: graphHelper.generateSuccess(
            'Tag has been updated successfully.'
          )
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
        WIKI.events.outbound.emit('flushCache')
        return {
          responseResult: graphHelper.generateSuccess(
            'Pages Cache has been flushed successfully.'
          )
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
          responseResult: graphHelper.generateSuccess(
            'Migrated content to target locale successfully.'
          ),
          count
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * REBUILD TREE
     */
    async rebuildTree() {
      try {
        await WIKI.models.pages.rebuildTree()
        return {
          responseResult: graphHelper.generateSuccess(
            'Page tree rebuilt successfully.'
          )
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * RENDER PAGE
     */
    async render(obj, args, context) {
      try {
        const page = await WIKI.models.pages.query().findById(args.id)
        if (!page) {
          throw new WIKI.Error.PageNotFound()
        }
        await WIKI.models.pages.renderPage(page)
        return {
          responseResult: graphHelper.generateSuccess(
            'Page rendered successfully.'
          )
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * RESTORE PAGE VERSION
     */
    async restore(obj, args, context) {
      try {
        const page = await WIKI.models.pages
          .query()
          .select('path', 'localeCode', 'siteId')
          .findById(args.pageId)
        if (!page) {
          throw new WIKI.Error.PageNotFound()
        }

        if (
          !WIKI.auth.checkAccess(context.req.user, ['write:pages'], {
            path: page.path,
            locale: page.localeCode,
            siteId: page.siteId
          })
        ) {
          throw new WIKI.Error.PageRestoreForbidden()
        }

        const targetVersion = await WIKI.models.pageHistory.getVersion({
          pageId: args.pageId,
          versionId: args.versionId
        })
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
          responseResult: graphHelper.generateSuccess(
            'Page version restored successfully.'
          )
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Purge history
     */
    async purgeHistory(obj, args, context) {
      try {
        await WIKI.models.pageHistory.purge(args.olderThan)
        return {
          responseResult: graphHelper.generateSuccess(
            'Page history purged successfully.'
          )
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  Page: {
    async tags(obj) {
      return WIKI.models.pages.relatedQuery('tags').for(obj.id)
    }
    // comments(pg) {
    //   return pg.$relatedQuery('comments')
    // }
  }
}
