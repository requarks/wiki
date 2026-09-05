import type { FastifyInstance, FastifyRequest } from 'fastify'

import { decodeTreePath, normalizeFolderPath } from '../helpers/common.ts'
import { INLINE_EXTS } from '../models/assets.ts'

const assetIdParam = {
  type: 'object',
  properties: {
    siteId: {
      type: 'string',
      format: 'uuid'
    },
    assetId: {
      type: 'string',
      format: 'uuid'
    }
  },
  required: ['siteId', 'assetId']
}

/**
 * Assets API Routes
 */
/**
 * Whether the caller holds an asset permission on an asset, judged on where it sits.
 *
 * Assets live in the same tree as pages and are addressed by the same rules — a rule over a branch
 * covers the files in it as well as the pages, which is why the asset permissions are offered
 * alongside the page ones in the group editor.
 *
 * Where it sits includes the LOCALE it is in, and the parameter is required for that reason: a rule
 * may be limited to particular locales, and `ruleMatchesPage` treats a reference with no locale as
 * one no locale restriction applies to — so an omitted locale silently widens every such rule. Every
 * asset the API hands around carries one, and the two places that build a destination by hand say
 * which locale they mean.
 */
function mayOnAsset(
  req: FastifyRequest,
  permission: string,
  asset: { folderPath?: string | null; fileName: string; locale: string }
): boolean {
  const folder = asset.folderPath ?? ''
  return WIKI.models.groups.checkAccess(WIKI.models.groups.actorForRequest(req), permission, {
    path: folder ? `${folder}/${asset.fileName}` : asset.fileName,
    locale: asset.locale
  })
}

async function routes(app: FastifyInstance) {
  // -> An upload is the raw file rather than a multipart form: one file per request, with the name and
  //    the destination in the query string. The catch-all only claims content types nothing else
  //    parses, so the JSON routes below are unaffected.
  //
  //    The limit is read once, here, because a route's body limit is fixed when it is registered —
  //    changing it in the admin area takes effect on the next restart, as the rest of the security
  //    settings do.
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: WIKI.config.security?.uploadMaxFileSize ?? 10485760 },
    (req, body, done) => {
      done(null, body)
    }
  )

  /**
   * UPLOAD ASSET
   */
  app.post<{
    Params: { siteId: string }
    Querystring: { fileName: string; folderId?: string; folderPath?: string; locale?: string }
  }>(
    '/sites/:siteId/assets',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in. Checked below.
      */
      schema: {
        summary: 'Upload an asset',
        description: `The body is the file itself, not a multipart form — send the bytes with their \`Content-Type\`. At most ${Math.round((WIKI.config.security?.uploadMaxFileSize ?? 10485760) / 1024 / 1024)} MB. The file name is sanitized, so the stored name in the response may differ from the one sent; the type served back later comes from that name's extension rather than from the request. Images get a thumbnail when the Sharp extension is installed.\n\nA file already at that name in that folder is settled by the site's upload conflict behavior: \`overwrite\` (the default) replaces it in place and answers with its existing ID, \`reject\` answers 409, and \`new\` stores the arrival as the next free \`name-1.ext\`. So the name and ID in the response are what to link to — never the ones that were sent. A page or a folder holding the name is answered 409 whichever behavior is set.`,
        tags: ['Assets'],
        consumes: ['*/*'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId']
        },
        querystring: {
          type: 'object',
          properties: {
            fileName: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            },
            folderId: {
              type: 'string',
              format: 'uuid',
              description: 'The folder to upload into. Wins over `folderPath`.'
            },
            folderPath: {
              type: 'string',
              maxLength: 2048,
              description:
                'Slash-separated path of the folder to upload into, created if it does not exist. The site root when both this and `folderId` are absent.'
            },
            locale: {
              type: 'string',
              maxLength: 10,
              description: "The site's primary locale when absent."
            }
          },
          required: ['fileName']
        },
        response: {
          200: {
            description: 'Asset uploaded successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              asset: { $ref: 'Asset#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      // -> An asset records who uploaded it, and an API key is not a who
      const authorId = req.session?.authenticated ? req.session.user?.id : null
      if (!authorId) {
        return reply.unauthorized('Uploading an asset requires a logged in user.')
      }
      const data = req.body
      if (!Buffer.isBuffer(data) || data.length < 1) {
        return reply.badRequest('No file was sent.')
      }

      /*
        Where this is going, as a path, which is what a rule addresses. An ID has to be looked up to
        get one; a path is already one, and is normalized here rather than trusted -- the model would
        happily create a folder called `..`.
      */
      const folder = req.query.folderId
        ? await WIKI.models.tree.getFolderById(req.query.folderId)
        : null
      const folderPath = req.query.folderId ? null : normalizeFolderPath(req.query.folderPath)
      const parentPath = folder ? (decodeTreePath(folder.folderPath ?? '') ?? '') : ''
      const destination = folder
        ? [parentPath, folder.fileName].filter(Boolean).join('/')
        : (folderPath ?? '')
      // -> Settled once, since the rule check and the write have to be asking about the same locale
      const locale =
        req.query.locale ?? WIKI.sites[req.params.siteId]?.config?.locales?.primary ?? 'en'
      if (
        !mayOnAsset(req, 'write:assets', {
          folderPath: destination,
          fileName: req.query.fileName,
          locale
        })
      ) {
        return reply.forbidden('You are not allowed to upload a file here.')
      }
      const asset = await WIKI.models.assets.upload({
        siteId: req.params.siteId,
        locale,
        folderId: req.query.folderId,
        folderPath,
        fileName: req.query.fileName,
        mimeType: req.headers['content-type'],
        data,
        authorId
      })

      return {
        ok: true,
        message: 'Asset uploaded successfully.',
        asset
      }
    }
  )

  /**
   * GET ASSET
   */
  app.get<{ Params: { siteId: string; assetId: string } }>(
    '/sites/:siteId/assets/:assetId',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in. Checked below.
      */
      schema: {
        summary: 'Get a single asset',
        description: 'Metadata only. `/content` serves the file itself.',
        tags: ['Assets'],
        params: assetIdParam,
        response: {
          200: { $ref: 'Asset#' }
        }
      }
    },
    async (req, reply) => {
      const asset = await WIKI.models.assets.getAsset(req.params.siteId, req.params.assetId)
      // -> Not readable is answered as not there, so the endpoint cannot be used to probe for files
      if (!asset || !mayOnAsset(req, 'read:assets', asset)) {
        return reply.notFound('This asset does not exist.')
      }
      return asset
    }
  )

  /**
   * DOWNLOAD ASSET
   */
  app.get<{ Params: { siteId: string; assetId: string } }>(
    '/sites/:siteId/assets/:assetId/content',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in. Checked below.
      */
      schema: {
        summary: 'Download an asset',
        description:
          'The file itself. Anything a browser should not render inline is sent as an attachment, and the type is always the one derived from the stored file name.',
        tags: ['Assets'],
        params: assetIdParam,
        response: {
          200: {
            description: 'The file',
            content: {
              '*/*': {
                schema: {
                  type: 'string',
                  format: 'binary'
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const asset = await WIKI.models.assets.getAsset(req.params.siteId, req.params.assetId)
      if (!asset || !mayOnAsset(req, 'read:assets', asset)) {
        return reply.notFound('This asset does not exist.')
      }
      const download = Boolean(
        WIKI.config.security?.forceAssetDownload || !INLINE_EXTS.has(asset.fileExt)
      )

      // -> The same redirect `/_files/` makes, for the same reason: where the site has nominated a
      //    store to serve a content type directly, the bytes have no business coming through here
      const directUrl = await WIKI.models.storage.directAccessUrlFor(
        { ...asset, siteId: req.params.siteId },
        { contentType: asset.mimeType, ...(download ? { downloadAs: asset.fileName } : {}) }
      )
      if (directUrl) {
        return reply.redirect(directUrl.url, 302)
      }

      // -> Through the same local disk cache `/_files/` serves from, since this is the download
      //    button in the file manager rather than an administrative route: anyone who may read a
      //    file may press it
      const content = await WIKI.models.assets.readContent(asset)
      if (!content) {
        return reply.notFound('This asset has no content.')
      }

      if (download) {
        reply.header(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(asset.fileName)}"`
        )
      }
      // -> The bytes came from a user, so the browser must take the type at its word rather than
      //    looking for something more interesting in them
      reply.header('X-Content-Type-Options', 'nosniff')
      // -> Set by hand because the body may be a stream, which Fastify would otherwise send chunked
      reply.header('Content-Length', content.size)
      return reply.type(asset.mimeType).send(content.body)
    }
  )

  /**
   * RENAME / MOVE ASSET
   */
  app.patch<{
    Params: { siteId: string; assetId: string }
    Body: { fileName?: string; folderPath?: string; locale?: string }
  }>(
    '/sites/:siteId/assets/:assetId',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in. Checked below.
      */
      schema: {
        summary: 'Rename an asset or move it to another folder',
        description:
          'Any of the three may be sent on its own, and they are the same operation to a storage target: a file is addressed by its locale, its folder and its name together, so the copy on every target follows. The extension is part of the name, and changing it changes the type the file is served as.\n\nMoving needs `manage:assets` at the destination as well as at the source, since page rules are granted per path and per locale.',
        tags: ['Assets'],
        params: assetIdParam,
        body: {
          type: 'object',
          properties: {
            fileName: {
              type: 'string',
              minLength: 3,
              maxLength: 255,
              description:
                'Sanitized, so the stored name may differ from the one sent. Keeps its current name when absent.'
            },
            folderPath: {
              type: 'string',
              maxLength: 255,
              description:
                'The folder to move it to, from the site root, empty for the root itself. Created if it does not exist. Stays where it is when absent.'
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
            description: 'Asset renamed or moved successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              asset: { $ref: 'Asset#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const existing = await WIKI.models.assets.getAsset(req.params.siteId, req.params.assetId)
      if (!existing) {
        return reply.notFound('This asset does not exist.')
      }
      if (!mayOnAsset(req, 'manage:assets', existing)) {
        return reply.forbidden('You are not allowed to rename or move this file.')
      }
      /*
        And at the destination, when that is somewhere else: rules are granted per path AND per
        locale, so a move is a write to a place the mover may have no say over -- which without this
        is a way to put a file where they could not have uploaded one.
      */
      const destination = {
        folderPath:
          req.body.folderPath === undefined
            ? existing.folderPath
            : normalizeFolderPath(req.body.folderPath),
        fileName: req.body.fileName ?? existing.fileName,
        locale: req.body.locale || existing.locale
      }
      const isRelocated =
        destination.folderPath !== existing.folderPath || destination.locale !== existing.locale
      if (isRelocated && !mayOnAsset(req, 'manage:assets', destination)) {
        return reply.forbidden('You are not allowed to move this file there.')
      }
      const asset = await WIKI.models.assets.moveAsset(
        req.params.siteId,
        req.params.assetId,
        req.body,
        req.session.user?.id
      )
      if (!asset) {
        return reply.notFound('This asset does not exist.')
      }
      return {
        ok: true,
        message: isRelocated ? 'Asset moved successfully.' : 'Asset renamed successfully.',
        asset
      }
    }
  )

  /**
   * DELETE ASSET
   */
  app.delete<{ Params: { siteId: string; assetId: string } }>(
    '/sites/:siteId/assets/:assetId',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in. Checked below.
      */
      schema: {
        summary: 'Delete an asset',
        tags: ['Assets'],
        params: assetIdParam,
        response: {
          204: {
            description: 'Asset deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const doomed = await WIKI.models.assets.getAsset(req.params.siteId, req.params.assetId)
      if (!doomed) {
        return reply.notFound('This asset does not exist.')
      }
      if (!mayOnAsset(req, 'manage:assets', doomed)) {
        return reply.forbidden('You are not allowed to delete this file.')
      }
      if (
        !(await WIKI.models.assets.deleteAsset(
          req.params.siteId,
          req.params.assetId,
          req.session.user?.id
        ))
      ) {
        return reply.notFound('This asset does not exist.')
      }
      return reply.code(204).send()
    }
  )
}

export default routes
