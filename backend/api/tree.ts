import type { FastifyInstance } from 'fastify'
import { TREE_ORDER_BY, type TreeItemType, type TreeOrderBy } from '../models/tree.ts'
import { decodeTreePath } from '../helpers/common.ts'

interface TreeQuery {
  parentId?: string
  parentPath?: string
  locale?: string
  types?: string
  tags?: string
  limit?: number
  offset?: number
  orderBy?: TreeOrderBy
  orderByDirection?: 'asc' | 'desc'
  depth?: number
  includeAncestors?: boolean
  includeRootFolders?: boolean
}

interface FolderBody {
  parentId?: string | null
  parentPath?: string | null
  pathName: string
  title: string
  locale?: string
}

/**
 * The locale content belongs to when the request does not say.
 *
 * A site always has a primary locale, and an instance that never turned locales on has exactly that
 * one — so this is the answer for most requests rather than a fallback.
 */
function defaultLocale(siteId: string): string {
  return WIKI.sites[siteId]?.config?.locales?.primary ?? 'en'
}

/** Comma-separated query lists, which is how the browser sends a multi-valued filter here. */
function splitList(value?: string): string[] | null {
  const items = value
    ?.split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return items && items.length > 0 ? items : null
}

const siteIdParam = {
  type: 'object',
  properties: {
    siteId: {
      type: 'string',
      format: 'uuid'
    }
  },
  required: ['siteId']
}

const folderIdParam = {
  type: 'object',
  properties: {
    siteId: {
      type: 'string',
      format: 'uuid'
    },
    folderId: {
      type: 'string',
      format: 'uuid'
    }
  },
  required: ['siteId', 'folderId']
}

/**
 * Tree API Routes
 *
 * The tree is what the file manager and the navigation browse: one listing that interleaves folders,
 * pages and assets. Folders are the only kind created here — a page or an asset gets its tree entry
 * from whatever created it.
 */
async function routes(app: FastifyInstance) {
  /**
   * BROWSE THE TREE
   */
  app.get<{ Params: { siteId: string }; Querystring: TreeQuery }>(
    '/sites/:siteId/tree',
    {
      config: {
        permissions: ['read:pages', 'read:assets', 'manage:pages', 'manage:assets']
      },
      schema: {
        summary: 'Browse the tree',
        description:
          'Lists the contents of one folder. `parentId` and `parentPath` both address the folder to list, the ID winning when both are given; neither means the site root. `includeAncestors` and `includeRootFolders` add the folders above the one being listed, so that a client opening a deep folder can draw the whole branch from a single request — those entries come back with `isAncestor` set.',
        tags: ['Tree'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            parentId: {
              type: 'string',
              format: 'uuid'
            },
            parentPath: {
              type: 'string',
              maxLength: 2048,
              description: 'Slash-separated path of the folder to list.'
            },
            locale: {
              type: 'string',
              maxLength: 10,
              description: 'Only entries in this locale. Every locale when absent.'
            },
            types: {
              type: 'string',
              pattern: '^(folder|page|asset)(,(folder|page|asset))*$',
              description: 'Comma-separated list of kinds to include, e.g. `folder,page`.'
            },
            tags: {
              type: 'string',
              description: 'Comma-separated list of tags an entry must carry all of.'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 1000,
              default: 1000
            },
            offset: {
              type: 'integer',
              minimum: 0,
              default: 0
            },
            orderBy: {
              type: 'string',
              enum: TREE_ORDER_BY,
              default: 'title'
            },
            orderByDirection: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'asc'
            },
            depth: {
              type: 'integer',
              minimum: 0,
              maximum: 10,
              default: 0,
              description: 'How many levels below the folder to include. 0 is the folder itself.'
            },
            includeAncestors: {
              type: 'boolean',
              default: false
            },
            includeRootFolders: {
              type: 'boolean',
              default: false
            }
          }
        },
        response: {
          200: {
            description: 'Tree entries, shallowest first',
            type: 'array',
            items: { $ref: 'TreeItem#' }
          }
        }
      }
    },
    async (req) => {
      const q = req.query
      return WIKI.models.tree.getTree({
        siteId: req.params.siteId,
        parentId: q.parentId,
        parentPath: q.parentPath,
        locale: q.locale,
        types: splitList(q.types) as TreeItemType[] | null,
        tags: splitList(q.tags),
        limit: q.limit,
        offset: q.offset,
        orderBy: q.orderBy,
        orderByDirection: q.orderByDirection,
        depth: q.depth,
        includeAncestors: q.includeAncestors,
        includeRootFolders: q.includeRootFolders
      })
    }
  )

  /**
   * BROWSE THE TREE AS A READER
   */
  app.get<{ Params: { siteId: string }; Querystring: { path?: string; locale?: string } }>(
    '/sites/:siteId/tree/browse',
    {
      schema: {
        summary: 'Browse the tree as a reader',
        description:
          "Lists one folder for the sidebar's browse menu: the pages a reader may open and the folders holding some, with assets, hidden pages and dead-end folders left out.\n\nA page and a folder can share a path — `/foo/bar` alongside the folder of pages under it — and such a pair comes back as a single entry with both `isPage` and `isFolder` set, since a reader sees one name with two ways in.\n\nReadable without a session, because a wiki is browsed by people who are not logged in — an anonymous request sees only published pages with no password on them, which is exactly what the page view itself would serve them. Requires the site's `browse` feature to be on.",
        tags: ['Tree'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              maxLength: 2048,
              description: 'Slash-separated path of the folder to list. The site root when absent.'
            },
            locale: {
              type: 'string',
              maxLength: 10,
              description: "The site's primary locale when absent."
            }
          }
        },
        response: {
          200: {
            description: 'One level of the tree',
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The folder that was listed. Empty at the site root.'
              },
              title: {
                type: 'string',
                description: "The folder's title. Empty at the site root, which is not a folder."
              },
              truncated: {
                type: 'boolean',
                description: 'Whether the folder holds more entries than were returned.'
              },
              items: {
                type: 'array',
                items: { $ref: 'BrowseItem#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = WIKI.sites[req.params.siteId]
      if (!site) {
        return reply.notFound('This site does not exist.')
      }
      // -> The same setting that hides the sidebar's Browse button, enforced where it counts: with
      //    browsing off, the tree is not something to hand out one folder at a time either
      if (!site.config?.features?.browse) {
        return reply.forbidden('Browsing is disabled on this site.')
      }
      const level = await WIKI.models.tree.browse({
        siteId: req.params.siteId,
        path: req.query.path,
        locale: req.query.locale ?? defaultLocale(req.params.siteId),
        publicOnly: !req.session?.authenticated
      })
      if (!level) {
        return reply.notFound('This folder does not exist.')
      }
      return level
    }
  )

  /**
   * GET FOLDER
   */
  app.get<{ Params: { siteId: string; folderId: string } }>(
    '/sites/:siteId/tree/folders/:folderId',
    {
      config: {
        permissions: ['read:pages', 'read:assets', 'manage:pages', 'manage:assets']
      },
      schema: {
        summary: 'Get a single folder',
        tags: ['Tree'],
        params: folderIdParam,
        response: {
          200: { $ref: 'Folder#' }
        }
      }
    },
    async (req, reply) => {
      const folder = await WIKI.models.tree.getFolderById(req.params.folderId)
      if (!folder || folder.siteId !== req.params.siteId) {
        return reply.notFound('This folder does not exist.')
      }
      return {
        ...folder,
        folderPath: decodeTreePath(folder.folderPath ?? '') ?? '',
        childrenCount: folder.meta?.children ?? 0
      }
    }
  )

  /**
   * CREATE FOLDER
   */
  app.post<{ Params: { siteId: string }; Body: FolderBody }>(
    '/sites/:siteId/tree/folders',
    {
      config: {
        permissions: ['write:pages', 'write:assets', 'manage:pages', 'manage:assets']
      },
      schema: {
        summary: 'Create a folder',
        description:
          'Any folder missing between the site root and the new one is created along with it, so a path can be filled in from the middle out.',
        tags: ['Tree'],
        params: siteIdParam,
        body: {
          allOf: [
            { $ref: 'FolderInput#' },
            { required: ['pathName', 'title'] },
            {
              type: 'object',
              properties: {
                parentId: {
                  type: ['string', 'null'],
                  format: 'uuid',
                  description: 'The folder to create it in. Wins over `parentPath`.'
                },
                parentPath: {
                  type: ['string', 'null'],
                  maxLength: 2048,
                  description: 'Slash-separated path of the folder to create it in.'
                },
                locale: {
                  type: 'string',
                  maxLength: 10,
                  description: "The site's primary locale when absent."
                }
              }
            }
          ]
        },
        response: {
          200: {
            description: 'Folder created successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              folder: { $ref: 'Folder#' }
            }
          }
        }
      }
    },
    async (req) => {
      const folder = await WIKI.models.tree.createFolder({
        siteId: req.params.siteId,
        locale: req.body.locale ?? defaultLocale(req.params.siteId),
        parentId: req.body.parentId,
        parentPath: req.body.parentPath,
        pathName: req.body.pathName,
        title: req.body.title
      })
      return {
        ok: true,
        message: 'Folder created successfully.',
        folder: {
          ...folder,
          folderPath: decodeTreePath(folder.folderPath ?? '') ?? '',
          childrenCount: folder.meta?.children ?? 0
        }
      }
    }
  )

  /**
   * RENAME FOLDER
   */
  app.patch<{ Params: { siteId: string; folderId: string }; Body: FolderBody }>(
    '/sites/:siteId/tree/folders/:folderId',
    {
      config: {
        permissions: ['manage:pages', 'manage:assets']
      },
      schema: {
        summary: 'Rename a folder',
        description:
          'Everything under the folder moves with it. Sending the current path name back changes only the title, and leaves every descendant untouched.',
        tags: ['Tree'],
        params: folderIdParam,
        body: {
          allOf: [{ $ref: 'FolderInput#' }, { required: ['pathName', 'title'] }]
        },
        response: {
          200: {
            description: 'Folder renamed successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              folder: { $ref: 'Folder#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const existing = await WIKI.models.tree.getFolderById(req.params.folderId)
      if (!existing || existing.siteId !== req.params.siteId) {
        return reply.notFound('This folder does not exist.')
      }
      const folder = await WIKI.models.tree.renameFolder({
        folderId: req.params.folderId,
        pathName: req.body.pathName,
        title: req.body.title
      })
      return {
        ok: true,
        message: 'Folder renamed successfully.',
        folder: {
          ...folder,
          folderPath: decodeTreePath(folder.folderPath ?? '') ?? '',
          childrenCount: folder.meta?.children ?? 0
        }
      }
    }
  )

  /**
   * DELETE FOLDER
   */
  app.delete<{ Params: { siteId: string; folderId: string } }>(
    '/sites/:siteId/tree/folders/:folderId',
    {
      config: {
        permissions: ['manage:pages', 'manage:assets']
      },
      schema: {
        summary: 'Delete a folder',
        description:
          'Everything under the folder goes with it, assets included. Pages are not implemented yet, so their tree entries are removed but nothing else is.',
        tags: ['Tree'],
        params: folderIdParam,
        response: {
          204: {
            description: 'Folder deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const existing = await WIKI.models.tree.getFolderById(req.params.folderId)
      if (!existing || existing.siteId !== req.params.siteId) {
        return reply.notFound('This folder does not exist.')
      }
      const removed = await WIKI.models.tree.deleteFolder(req.params.folderId)
      await WIKI.models.assets.deleteOrphaned(removed.assets)
      return reply.code(204).send()
    }
  )
}

export default routes
