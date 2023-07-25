import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import { isNil } from 'lodash-es'

export default {
  Query: {
    async navigationById (obj, args, context, info) {
      return WIKI.db.navigation.getNav({ id: args.id, cache: true, userGroups: context.req.user?.groups })
    }
  },
  Mutation: {
    async updateNavigation (obj, args, context) {
      try {
        let updateInherited = false
        let updateInheritedNavId = null
        let updateNavId = null
        let ancestorNavId = null

        const treeEntry = await WIKI.db.knex('tree').where('id', args.pageId).first()
        if (!treeEntry) {
          throw new Error('Invalid ID')
        }
        const currentNavId = treeEntry.folderPath === '' && treeEntry.fileName === 'home' ? treeEntry.siteId : treeEntry.id
        const treeEntryPath = treeEntry.folderPath ? `${treeEntry.folderPath}.${treeEntry.fileName}` : treeEntry.fileName

        // -> Create / Update Nav Menu Items
        if (!isNil(args.items)) {
          await WIKI.db.knex('navigation').insert({
            id: currentNavId,
            items: JSON.stringify(args.items),
            siteId: treeEntry.siteId
          }).onConflict('id').merge({
            items: JSON.stringify(args.items)
          })
        }

        // -> Find ancestor nav ID
        const ancNavResult = await WIKI.db.knex.raw(`
          SELECT "navigationId", "navigationMode", nlevel("folderPath" || "fileName") AS levels
          FROM tree
          WHERE ("folderPath" || "fileName") @> :currentPath
            AND "navigationMode" IN ('override', 'hide')
          ORDER BY levels DESC
          LIMIT 1
        `, {
          currentPath: treeEntry.folderPath
        })
        if (ancNavResult.rowCount > 0) {
          ancestorNavId = ancNavResult.rows[0]?.navigationId
        } else {
          ancestorNavId = treeEntry.siteId
        }

        // -> Update mode
        switch (args.mode) {
          case 'inherit': {
            updateNavId = ancestorNavId
            if (['override', 'hide'].includes(treeEntry.navigationMode)) {
              updateInherited = true
              updateInheritedNavId = ancestorNavId
            }
            break
          }
          case 'override': {
            updateNavId = treeEntry.id
            updateInherited = true
            updateInheritedNavId = treeEntry.id
            break
          }
          case 'overrideExact': {
            updateNavId = treeEntry.id
            if (['override', 'hide'].includes(treeEntry.navigationMode)) {
              updateInherited = true
              updateInheritedNavId = ancestorNavId
            }
            break
          }
          case 'hide': {
            updateInherited = true
            updateNavId = null
            break
          }
          case 'hideExact': {
            updateNavId = null
            if (['override', 'hide'].includes(treeEntry.navigationMode)) {
              updateInherited = true
              updateInheritedNavId = ancestorNavId
            }
            break
          }
        }

        // -> Set for current path
        await WIKI.db.knex('tree').where('id', treeEntry.id).update({ navigationMode: args.mode, navigationId: updateNavId })

        // -> Update nodes that inherit from current
        if (updateInherited) {
          await WIKI.db.knex.raw(`
            UPDATE tree tt
            SET "navigationId" = :navId
            WHERE type IN ('page', 'folder')
              AND "folderPath" <@ :overridePath
              AND "navigationMode" = 'inherit'
              AND NOT EXISTS (
                SELECT 1
                FROM tree tc
                WHERE type IN ('page', 'folder')
                  AND tc."folderPath" <@ :overridePath
                  AND tc."folderPath" @> tt."folderPath"
                  AND tc."navigationMode" IN ('override', 'hide')
              )
          `, {
            navId: updateInheritedNavId,
            overridePath: treeEntryPath
          })
        }

        // for (const tree of args.tree) {
        //   await WIKI.cache.set(`nav:sidebar:${tree.locale}`, tree.items, 300)
        // }

        return {
          operation: generateSuccess('Navigation updated successfully'),
          navigationMode: args.mode,
          navigationId: updateNavId
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
