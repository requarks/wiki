import type { FastifyInstance, FastifyRequest } from 'fastify'
import { TREE_ORDER_BY, type TreeItemType, type TreeOrderBy, type TreeRow } from '../models/tree.ts'
import { decodeTreePath, normalizeFolderPath } from '../helpers/common.ts'
import { actorFrom } from './pages.ts'

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
/**
 * The entries of a tree listing this caller may see, and the folders leading to them.
 *
 * Filtered here rather than in the query for the same reason as everywhere else: a page rule can be a
 * regular expression or a set of tags, so which rule decides an entry is only knowable per entry.
 *
 * A folder is judged on its own path, so a DENY over a branch hides the branch itself rather than
 * leaving an empty folder to walk into. The consequence worth knowing is the other way round: a
 * folder stays listed when the rules deny everything inside it but say nothing about the folder, and
 * a reader opening it finds it empty. Hiding those would mean resolving every descendant of every
 * folder on every listing, which is not worth what it costs.
 */
function visibleTreeItems<T extends { type?: string; folderPath?: string; fileName?: string }>(
  req: FastifyRequest,
  items: T[]
): T[] {
  const actor = WIKI.models.groups.actorForRequest(req)
  return items.filter((item) => {
    const path = item.folderPath ? `${item.folderPath}/${item.fileName}` : (item.fileName ?? '')
    const permission = item.type === 'asset' ? 'read:assets' : 'read:pages'
    return WIKI.models.groups.checkAccess(actor, permission, {
      path,
      tags: (item as any).tags ?? []
    })
  })
}

/** A folder's own slash-separated path, which is what a rule over that branch addresses. */
/**
 * A folder as the `Folder` schema describes one.
 *
 * Five routes answer with a folder and each of them has to unpack the same two things out of the
 * row -- the ltree path as a readable one, and the parts of `meta` that are a folder's own rather
 * than the model's bookkeeping. Kept in one place so that adding a third cannot reach four routes
 * and miss the fifth.
 */
function toFolderResponse(folder: TreeRow) {
  return {
    ...folder,
    folderPath: decodeTreePath(folder.folderPath ?? '') ?? '',
    childrenCount: folder.meta?.children ?? 0,
    // -> Absent rather than zero on a folder nobody has coloured; see `setFolderColor`
    ...(folder.meta?.hue ? { hue: folder.meta.hue } : {})
  }
}

function folderPathOf(folder: { folderPath?: string | null; fileName: string }): string {
  const parent = decodeTreePath(folder.folderPath ?? '') ?? ''
  return parent ? `${parent}/${folder.fileName}` : folder.fileName
}

/**
 * Whether the caller holds a page permission over a folder, judged on the folder's own path.
 *
 * A folder is not a page and has no permissions of its own, so what governs it is what governs the
 * branch it opens: a rule denying `read:pages` under `geography` hides the folder as well as the
 * pages in it, and only somebody who may reorganise pages there may rename or remove it.
 */
function mayOnFolder(
  req: FastifyRequest,
  permission: string,
  path: string,
  locale: string
): boolean {
  return WIKI.models.groups.checkAccess(WIKI.models.groups.actorForRequest(req), permission, {
    path,
    locale
  })
}

async function routes(app: FastifyInstance) {
  /**
   * BROWSE THE TREE
   */
  app.get<{ Params: { siteId: string }; Querystring: TreeQuery }>(
    '/sites/:siteId/tree',
    {
      /*
        No route-level `permissions`: page permissions come from a group's RULES, and every entry is
        filtered against them below — a caller allowed nowhere gets an empty listing rather than a
        refusal, which is the same thing the tree would look like if the pages were not there.
      */
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
      const items = await WIKI.models.tree.getTree({
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
      return visibleTreeItems(req, items)
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
      /*
        A browse row carries a whole path rather than a folder/name pair, and stands for a page, a
        folder, or both at once. Judged on that path either way: for the page it IS the page, and for
        a folder it is the branch, which is what a rule over the branch is talking about.
      */
      const actor = WIKI.models.groups.actorForRequest(req)
      return {
        ...level,
        items: level.items.filter((item) =>
          WIKI.models.groups.checkAccess(actor, 'read:pages', { path: item.path })
        )
      }
    }
  )

  /**
   * LIST PAGES AS A READER
   */
  app.get<{
    Params: { siteId: string }
    Querystring: {
      path?: string
      locale?: string
      tags?: string
      limit?: number
      orderBy?: TreeOrderBy
      orderByDirection?: 'asc' | 'desc'
      depth?: number
    }
  }>(
    '/sites/:siteId/tree/pages',
    {
      schema: {
        summary: 'List pages as a reader',
        description:
          "Lists the pages under a path, ordered and limited, for an index block drawn inside a page. Folders are not part of the answer — this is a list of pages, at `depth` folders below the path when asked for.\n\nReadable without a session, because the page holding the block is: an anonymous request sees only published pages, the same set the page view would serve it. Unlike `/tree/browse` it is not gated on the site's `browse` feature, which governs the sidebar's browse menu rather than what a page may render.",
        tags: ['Tree'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              maxLength: 2048,
              description: 'Slash-separated path to list. The site root when absent.'
            },
            locale: {
              type: 'string',
              maxLength: 10,
              description: "The site's primary locale when absent."
            },
            tags: {
              type: 'string',
              description: 'Comma-separated list of tags a page must carry all of.'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 1000,
              default: 10
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
              description: 'How many folders below the path to include. 0 is the path itself.'
            }
          }
        },
        response: {
          200: {
            description: 'The pages found',
            type: 'array',
            items: { $ref: 'ListedPage#' }
          }
        }
      }
    },
    async (req, reply) => {
      if (!WIKI.sites[req.params.siteId]) {
        return reply.notFound('This site does not exist.')
      }
      const pages = await WIKI.models.tree.listPages({
        siteId: req.params.siteId,
        path: req.query.path,
        locale: req.query.locale ?? defaultLocale(req.params.siteId),
        tags: splitList(req.query.tags),
        limit: req.query.limit,
        orderBy: req.query.orderBy,
        orderByDirection: req.query.orderByDirection,
        depth: req.query.depth,
        publicOnly: !req.session?.authenticated
      })
      // -> An index block is drawn inside a page, but it lists other pages: each one still has to be
      //    the reader's to see
      const actor = WIKI.models.groups.actorForRequest(req)
      return pages.filter((page) =>
        WIKI.models.groups.checkAccess(actor, 'read:pages', {
          path: page.path,
          locale: req.query.locale ?? defaultLocale(req.params.siteId)
        })
      )
    }
  )

  /**
   * GET FOLDER
   */
  app.get<{ Params: { siteId: string; folderId: string } }>(
    '/sites/:siteId/tree/folders/:folderId',
    {
      // -> Checked against the folder's own path below, not against the group-wide list
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
      const folderPath = folderPathOf(folder)
      // -> Not visible is the same as not there, so it answers as the id had matched nothing
      if (!mayOnFolder(req, 'read:pages', folderPath, folder.locale)) {
        return reply.notFound('This folder does not exist.')
      }
      return toFolderResponse(folder)
    }
  )

  /**
   * CREATE FOLDER
   */
  app.post<{ Params: { siteId: string }; Body: FolderBody }>(
    '/sites/:siteId/tree/folders',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions come
        from a group's RULES. Checked against the folder's own path below.
      */
      schema: {
        summary: 'Create a folder',
        description:
          'Any folder missing between the site root and the new one is created along with it, so a path can be filled in from the middle out.',
        tags: ['Tree'],
        params: siteIdParam,
        body: {
          allOf: [
            { $ref: 'FolderInput#' },
            { type: 'object', required: ['pathName', 'title'] },
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
    async (req, reply) => {
      /*
        Against where the folder is going. `parentPath` is the slash-separated path when given; with
        `parentId` the parent has to be looked up, and a missing one is left to the model to report.
      */
      let parentPath = req.body.parentPath ?? ''
      if (req.body.parentId) {
        const parent = await WIKI.models.tree.getFolderById(req.body.parentId)
        parentPath = parent ? folderPathOf(parent) : parentPath
      }
      const target = [parentPath, req.body.pathName].filter(Boolean).join('/')
      const locale = req.body.locale ?? defaultLocale(req.params.siteId)
      if (!mayOnFolder(req, 'manage:pages', target, locale)) {
        return reply.forbidden('You are not allowed to create a folder here.')
      }
      const folder = await WIKI.models.tree.createFolder({
        siteId: req.params.siteId,
        locale,
        parentId: req.body.parentId,
        parentPath: req.body.parentPath,
        pathName: req.body.pathName,
        title: req.body.title
      })
      return {
        ok: true,
        message: 'Folder created successfully.',
        folder: toFolderResponse(folder)
      }
    }
  )

  /**
   * RENAME FOLDER
   */
  app.patch<{ Params: { siteId: string; folderId: string }; Body: FolderBody }>(
    '/sites/:siteId/tree/folders/:folderId',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions come
        from a group's RULES. Checked against the folder's own path below.
      */
      schema: {
        summary: 'Rename a folder',
        description:
          'Everything under the folder moves with it. Sending the current path name back changes only the title, and leaves every descendant untouched.',
        tags: ['Tree'],
        params: folderIdParam,
        body: {
          allOf: [{ $ref: 'FolderInput#' }, { type: 'object', required: ['pathName', 'title'] }]
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
      if (!mayOnFolder(req, 'manage:pages', folderPathOf(existing), existing.locale)) {
        return reply.forbidden('You are not allowed to rename this folder.')
      }
      const folder = await WIKI.models.tree.renameFolder({
        folderId: req.params.folderId,
        pathName: req.body.pathName,
        title: req.body.title,
        actorId: req.session.user?.id
      })
      return {
        ok: true,
        message: 'Folder renamed successfully.',
        folder: toFolderResponse(folder)
      }
    }
  )

  /**
   * MOVE FOLDER
   */
  app.put<{
    Params: { siteId: string; folderId: string }
    Body: { folderPath: string; locale?: string }
  }>(
    '/sites/:siteId/tree/folders/:folderId/path',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions come
        from a group's RULES. Checked against the folder's own path below.
      */
      schema: {
        summary: 'Move a folder to another parent',
        description:
          'Everything under the folder moves with it — pages, files, and the folders in between — and every storage target holding a copy follows. Any folder the destination needs is created.\n\nMoving needs `manage:pages` at the destination as well as at the source, since page rules are granted per path and per locale. A folder cannot be moved into its own subtree.',
        tags: ['Tree'],
        params: folderIdParam,
        body: {
          type: 'object',
          required: ['folderPath'],
          properties: {
            folderPath: {
              type: 'string',
              maxLength: 255,
              description:
                'The folder to move it into, from the site root, empty for the root itself. Created if it does not exist.'
            },
            locale: {
              type: 'string',
              maxLength: 255,
              description: 'The locale to move it to. Stays in its own when absent.'
            }
          }
        },
        response: {
          200: {
            description: 'Folder moved successfully',
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
      if (!mayOnFolder(req, 'manage:pages', folderPathOf(existing), existing.locale)) {
        return reply.forbidden('You are not allowed to move this folder.')
      }
      /*
        And where it is going, which is a whole branch arriving somewhere the mover may have no say
        over: rules are granted per path AND per locale, so without this a folder full of pages is a
        way to write into a place they could not have created one.
      */
      const destination = normalizeFolderPath(req.body.folderPath)
      const destinationLocale = req.body.locale || existing.locale
      if (
        !mayOnFolder(
          req,
          'manage:pages',
          [destination, existing.fileName].filter(Boolean).join('/'),
          destinationLocale
        )
      ) {
        return reply.forbidden('You are not allowed to move this folder there.')
      }
      const folder = await WIKI.models.tree.moveFolder({
        folderId: req.params.folderId,
        folderPath: destination,
        locale: destinationLocale,
        actorId: req.session.user?.id
      })
      return {
        ok: true,
        message: 'Folder moved successfully.',
        folder: toFolderResponse(folder)
      }
    }
  )

  /**
   * DUPLICATE FOLDER
   */
  app.post<{
    Params: { siteId: string; folderId: string }
    Body: { folderPath: string; pathName: string; title: string; locale?: string }
  }>(
    '/sites/:siteId/tree/folders/:folderId/duplicate',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions come
        from a group's RULES. Checked against the folder's own path below.
      */
      schema: {
        summary: 'Duplicate a folder',
        description:
          'Copies the folder and everything under it — the folders in between, the pages and the files, each as a new entry of its own with its own copy on every storage target. Aliases, translation sets and sidebar overrides are not carried across; folder colours are.\n\nCopying needs `manage:pages` at the destination as well as at the source, since page rules are granted per path and per locale. A folder cannot be copied into its own subtree, and the name must be free where it is going.',
        tags: ['Tree'],
        params: folderIdParam,
        body: {
          allOf: [
            { $ref: 'FolderInput#' },
            { type: 'object', required: ['pathName', 'title'] },
            {
              type: 'object',
              properties: {
                folderPath: {
                  type: 'string',
                  maxLength: 2048,
                  description:
                    'Slash-separated path of the folder to copy into, empty for the site root. Created if it does not exist.'
                },
                locale: {
                  type: 'string',
                  maxLength: 10,
                  description: "The source folder's own locale when absent."
                }
              }
            }
          ]
        },
        response: {
          200: {
            description: 'Folder duplicated successfully',
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
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized('Duplicating a folder requires a logged in user.')
      }
      const existing = await WIKI.models.tree.getFolderById(req.params.folderId)
      if (!existing || existing.siteId !== req.params.siteId) {
        return reply.notFound('This folder does not exist.')
      }
      if (!mayOnFolder(req, 'manage:pages', folderPathOf(existing), existing.locale)) {
        return reply.forbidden('You are not allowed to duplicate this folder.')
      }
      // -> And where the copy is going, which is a whole branch of new pages arriving somewhere the
      //    copier may have no say over
      const destination = normalizeFolderPath(req.body.folderPath)
      const destinationLocale = req.body.locale || existing.locale
      if (
        !mayOnFolder(
          req,
          'manage:pages',
          [destination, req.body.pathName].filter(Boolean).join('/'),
          destinationLocale
        )
      ) {
        return reply.forbidden('You are not allowed to duplicate this folder there.')
      }
      const folder = await WIKI.models.tree.duplicateFolder({
        folderId: req.params.folderId,
        folderPath: destination,
        pathName: req.body.pathName,
        title: req.body.title,
        locale: destinationLocale,
        actor
      })
      return {
        ok: true,
        message: 'Folder duplicated successfully.',
        folder: toFolderResponse(folder)
      }
    }
  )

  /**
   * SET FOLDER COLOR
   */
  app.put<{
    Params: { siteId: string; folderId: string }
    Body: { hue: number }
  }>(
    '/sites/:siteId/tree/folders/:folderId/color',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions come
        from a group's RULES. Checked against the folder's own path below.
      */
      schema: {
        summary: "Set a folder's colour",
        description:
          'A hue rotation in degrees applied to the folder icon, rather than a colour: the icon is one image that the interface turns around the colour wheel. Zero is the colour every folder starts out, and clears the setting.',
        tags: ['Tree'],
        params: folderIdParam,
        body: {
          type: 'object',
          required: ['hue'],
          properties: {
            hue: {
              type: 'integer',
              minimum: 0,
              maximum: 359,
              description: 'Degrees around the colour wheel. Zero puts the folder back to yellow.'
            }
          }
        },
        response: {
          200: {
            description: 'Folder colour set successfully',
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
      if (!mayOnFolder(req, 'manage:pages', folderPathOf(existing), existing.locale)) {
        return reply.forbidden('You are not allowed to change this folder.')
      }
      const folder = await WIKI.models.tree.setFolderColor({
        folderId: req.params.folderId,
        hue: req.body.hue
      })
      return {
        ok: true,
        message: 'Folder colour set successfully.',
        folder: toFolderResponse(folder)
      }
    }
  )

  /**
   * DELETE FOLDER
   */
  app.delete<{ Params: { siteId: string; folderId: string } }>(
    '/sites/:siteId/tree/folders/:folderId',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions come
        from a group's RULES. Checked against the folder's own path below.
      */
      schema: {
        summary: 'Delete a folder',
        description:
          'Everything under the folder goes with it, pages and assets included. Each deleted page is recorded in its history first, so the branch can be recovered from there.',
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
      // -> As deleting a single page does: every page going with the folder is recorded against
      //    whoever deleted it, so there has to be somebody to record
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized('Deleting a folder requires a logged in user.')
      }
      const existing = await WIKI.models.tree.getFolderById(req.params.folderId)
      if (!existing || existing.siteId !== req.params.siteId) {
        return reply.notFound('This folder does not exist.')
      }
      if (!mayOnFolder(req, 'manage:pages', folderPathOf(existing), existing.locale)) {
        return reply.forbidden('You are not allowed to delete this folder.')
      }
      const removed = await WIKI.models.tree.deleteFolder(req.params.folderId)
      // -> The tree entries are gone; these are the rows behind them, which is where a page and an
      //    asset actually live
      await WIKI.models.pages.deleteOrphaned(req.params.siteId, removed.pages, actor)
      await WIKI.models.assets.deleteOrphaned(req.params.siteId, removed.assets, actor.id)
      return reply.code(204).send()
    }
  )
}

export default routes
