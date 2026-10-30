import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { isEqual } from 'es-toolkit/predicate'
import { validate as uuidValidate } from 'uuid'

import { audit } from '../helpers/audit.ts'
import { requestUserId } from '../helpers/requester.ts'
import { attachmentDisposition, decodeTreePath, normalizeFolderPath } from '../helpers/common.ts'
import { isImageEditingAvailable, NEUTRAL_ADJUST } from '../helpers/images.ts'
import type { ImageAdjust, ImageOperation } from '../helpers/images.ts'
import { INLINE_EXTS } from '../models/assets.ts'
import type { Asset } from '../models/assets.ts'
import { userRequired } from './pages.ts'

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
 *
 * The SITE comes off the request instead, since every route in this file addresses one in its path
 * and an asset row does not have to be asked which site it is in to answer that.
 */
function mayOnAsset(
  req: FastifyRequest<{ Params: { siteId: string } }>,
  permission: string,
  asset: { folderPath?: string | null; fileName: string; locale: string }
): boolean {
  const folder = asset.folderPath ?? ''
  return WIKI.models.groups.checkAccess(WIKI.models.groups.actorForRequest(req), permission, {
    siteId: req.params.siteId,
    path: folder ? `${folder}/${asset.fileName}` : asset.fileName,
    locale: asset.locale
  })
}

/** A region of an image, as the edit route's operations take one. */
const regionProperties = {
  left: { type: 'integer', minimum: 0, maximum: 65535 },
  top: { type: 'integer', minimum: 0, maximum: 65535 },
  width: { type: 'integer', minimum: 1, maximum: 65535 },
  height: { type: 'integer', minimum: 1, maximum: 65535 }
}
const regionRequired = ['left', 'top', 'width', 'height']

/** One side of an `extend`. */
const borderWidth = { type: 'integer', minimum: 0, maximum: 4096 }

/**
 * The part of the edit and resize routes that is the same: who may, from where to where, and the edit
 * itself. Each route audits on its own, since the two are different actions in the log.
 *
 * @returns The original and the asset written, or null once a refusal has been sent on `reply`
 */
async function applyImageEdit(
  req: FastifyRequest<{ Params: { siteId: string; assetId: string } }>,
  reply: FastifyReply,
  edit: {
    operations: ImageOperation[]
    adjust: ImageAdjust
    mode: 'replace' | 'saveAs'
    fileName?: string
    quality: number
    unchangedSince: Date | null
    /** What the caller is doing, for the message refusing a request that acts as nobody. */
    what: string
  }
): Promise<{ source: Asset; asset: Asset } | null> {
  // -> Whatever is written records who wrote it, and an API key is not a who
  const authorId = requestUserId(req)
  if (!authorId) {
    reply.unauthorized(userRequired(req, edit.what))
    return null
  }
  const isSaveAs = edit.mode === 'saveAs'
  if (isSaveAs && !edit.fileName) {
    reply.badRequest('A file name is required to save the image as a new file.')
    return null
  }
  const source = await WIKI.models.assets.getAsset(req.params.siteId, req.params.assetId)
  if (!source || !mayOnAsset(req, 'read:assets', source)) {
    reply.notFound('This asset does not exist.')
    return null
  }
  // -> Where the result lands: the file itself, or a new name beside it
  const destination = {
    folderPath: source.folderPath,
    fileName: isSaveAs ? edit.fileName! : source.fileName,
    locale: source.locale
  }
  if (!mayOnAsset(req, 'write:assets', destination)) {
    reply.forbidden('You are not allowed to write a file here.')
    return null
  }
  const asset = await WIKI.models.assets.editImage({
    siteId: req.params.siteId,
    id: req.params.assetId,
    operations: edit.operations,
    adjust: edit.adjust,
    quality: edit.quality,
    saveAs: isSaveAs ? edit.fileName : null,
    unchangedSince: edit.unchangedSince,
    authorId
  })
  if (!asset) {
    reply.notFound('This asset does not exist.')
    return null
  }
  return { source, asset }
}

/**
 * Where an upload is going and who is sending it, settled by the upload route's `preParsing` hook and
 * read back by its handler, so that the write goes exactly where the permission check looked.
 */
interface UploadTarget {
  authorId: string
  folderPath: string | null
  destination: string
  locale: string
}
const uploadTargets = new WeakMap<FastifyRequest, UploadTarget>()

async function routes(app: FastifyInstance) {
  // -> An upload is the raw file rather than a multipart form: one file per request, with the name and
  //    the destination in the query string. The catch-all only claims content types nothing else
  //    parses, so the JSON routes below are unaffected.
  //
  //    The limit is read once, here, because a route's body limit is fixed when it is registered —
  //    changing it in the admin area takes effect on the next restart, which is why that field is
  //    one of the ones the security view marks as needing one.
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
      config: {
        scope: 'assets'
      },
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in.

        Checked here, before the body is parsed rather than in the handler: parsing buffers the whole
        file into memory, so a check that waited for it would let anybody — signed in or not — make
        the server hold `uploadMaxFileSize` per request only to be refused. Which also means the query
        string has not been through the schema yet, so whatever the check reads is checked here too.
      */
      preParsing: async (req, reply, payload) => {
        // -> An asset records who uploaded it, and an API key is not a who
        const authorId = requestUserId(req)
        if (!authorId) {
          throw app.httpErrors.unauthorized(userRequired(req, 'Uploading an asset'))
        }
        const { fileName, folderId, folderPath: requestedPath, locale: requestedLocale } = req.query
        if (
          typeof fileName !== 'string' ||
          !fileName ||
          (folderId !== undefined && (typeof folderId !== 'string' || !uuidValidate(folderId))) ||
          (requestedPath !== undefined && typeof requestedPath !== 'string') ||
          (requestedLocale !== undefined && typeof requestedLocale !== 'string')
        ) {
          throw app.httpErrors.badRequest('Invalid upload destination.')
        }

        /*
          Where this is going, as a path, which is what a rule addresses. An ID has to be looked up to
          get one; a path is already one, and is normalized here rather than trusted -- the model
          would happily create a folder called `..`.
        */
        const folder = folderId ? await WIKI.models.tree.getFolderById(folderId) : null
        const folderPath = folderId ? null : normalizeFolderPath(requestedPath)
        const parentPath = folder ? decodeTreePath(folder.folderPath) : ''
        const destination = folder
          ? [parentPath, folder.fileName].filter(Boolean).join('/')
          : (folderPath ?? '')
        // -> Settled once, since the rule check and the write have to be asking about the same locale
        const locale =
          requestedLocale ?? WIKI.sites[req.params.siteId]?.config?.locales?.primary ?? 'en'
        if (
          !mayOnAsset(req, 'write:assets', {
            folderPath: destination,
            fileName,
            locale
          })
        ) {
          throw app.httpErrors.forbidden('You are not allowed to upload a file here.')
        }
        // -> Asked again by the model, which every upload passes through; here it costs no body
        WIKI.models.feedback.refuseNonIdea(req.params.siteId, folder?.locale ?? locale, {
          kind: 'asset',
          parentPath: destination
        })
        uploadTargets.set(req, { authorId, folderPath, destination, locale })
        return payload
      },
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
      const data = req.body
      if (!Buffer.isBuffer(data) || data.length < 1) {
        return reply.badRequest('No file was sent.')
      }
      const { authorId, folderPath, destination, locale } = uploadTargets.get(req)!
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

      // -> The stored name, not the one that was sent: an upload conflict may have renamed the file
      //    or replaced one that was already there, and the entry has to say what actually happened
      await audit(req, 'asset', 'uploadAsset', {
        assetId: asset.id,
        siteId: req.params.siteId,
        locale,
        folderPath: destination,
        fileName: asset.fileName,
        fileSize: asset.fileSize
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
      config: {
        scope: 'assets'
      },
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
      config: {
        scope: 'assets'
      },
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
        reply.header('Content-Disposition', attachmentDisposition(asset.fileName))
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
      config: {
        scope: 'assets'
      },
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
        requestUserId(req) ?? undefined
      )
      if (!asset) {
        return reply.notFound('This asset does not exist.')
      }

      await audit(req, 'asset', 'updateAsset', {
        assetId: asset.id,
        siteId: req.params.siteId,
        locale: destination.locale,
        folderPath: destination.folderPath,
        fileName: destination.fileName,
        previousLocale: existing.locale,
        previousFolderPath: existing.folderPath,
        previousFileName: existing.fileName,
        isRelocated
      })

      return {
        ok: true,
        message: isRelocated ? 'Asset moved successfully.' : 'Asset renamed successfully.',
        asset
      }
    }
  )

  /**
   * IMAGE EDITING INFO
   */
  app.get<{ Params: { siteId: string; assetId: string } }>(
    '/sites/:siteId/assets/:assetId/editing',
    {
      config: {
        scope: 'assets'
      },
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in. Checked below.
      */
      schema: {
        summary: 'Check whether an image can be edited',
        description: `What the image editor asks when it opens, so that nobody edits for five minutes to be refused on save.\n\n\`imageEditing\` is false when the Sharp extension is missing, and \`frames\` is then null; otherwise \`frames\` is more than one for an animation, of which only the first frame can be edited. \`mayReplace\` is whether the caller holds \`write:assets\` on the file itself, \`maySaveAs\` whether they hold it on the name a copy is offered under by default (\`<name>-edited.<ext>\` beside it) — the name actually chosen is checked again on save. \`updatedAt\` is what to send back as \`unchangedSince\`.\n\nNeeds \`read:assets\` on the file.`,
        tags: ['Assets'],
        params: assetIdParam,
        response: {
          200: {
            type: 'object',
            properties: {
              imageEditing: { type: 'boolean' },
              frames: { type: ['integer', 'null'] },
              mayReplace: { type: 'boolean' },
              maySaveAs: { type: 'boolean' },
              updatedAt: { type: 'string', format: 'date-time' }
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
      const imageEditing = await isImageEditingAvailable()
      const stemEnd = asset.fileName.lastIndexOf('.')
      const copyName =
        stemEnd > 0
          ? `${asset.fileName.slice(0, stemEnd)}-edited${asset.fileName.slice(stemEnd)}`
          : `${asset.fileName}-edited`
      return {
        imageEditing,
        frames: imageEditing ? await WIKI.models.assets.countFrames(asset.id) : null,
        mayReplace: mayOnAsset(req, 'write:assets', asset),
        maySaveAs: mayOnAsset(req, 'write:assets', { ...asset, fileName: copyName }),
        updatedAt: asset.updatedAt
      }
    }
  )

  /**
   * EDIT IMAGE
   */
  app.post<{
    Params: { siteId: string; assetId: string }
    Body: {
      operations: ImageOperation[]
      adjust: ImageAdjust
      mode: 'replace' | 'saveAs'
      fileName?: string
      quality: number
      unchangedSince?: string
    }
  }>(
    '/sites/:siteId/assets/:assetId/edit',
    {
      config: {
        scope: 'assets'
      },
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in. Checked below.
      */
      schema: {
        summary: 'Edit an image',
        description: `Applies \`operations\` to a PNG, JPEG, WebP or GIF image in order, each to the image as the ones before it left it, then the colour settings in \`adjust\`. Positions and sizes are in pixels of the image as a viewer sees it, after its EXIF orientation. Only the first frame of an animated GIF or WebP is read, and the result is a still image whatever it is saved as. SVG is refused.\n\n- \`rotate\` turns by \`angle\` degrees clockwise. Any angle but a multiple of 90 grows the canvas to hold the rotated picture, each side rounded to the nearest pixel, and fills the corners with \`background\` (transparent by default).\n- \`flip\` turns it upside down, \`flop\` mirrors it.\n- \`crop\` keeps a region; \`redact\` hides one, with a solid \`color\`, pixel blocks \`size\` wide, or a blur of sigma \`size\`. Either region has to lie inside the image.\n- \`resize\` scales to exactly \`width\` × \`height\`, and may not enlarge.\n- \`extend\` adds a border of \`background\`.\n\n\`replace\` writes the result over the file, which keeps its ID and its name, so every page showing it shows the new one. \`saveAs\` stores it as a new file named \`fileName\` in the same folder and locale, settled by the site's upload conflict behavior like any other upload, and encoded as whatever format that name's extension says.\n\n\`unchangedSince\` is the file's \`updatedAt\` when the caller read it: the edit is refused with 409 if the file has been written since, since its positions were worked out on another version.\n\nNeeds \`write:assets\` where the result is written, and \`read:assets\` on the original. Needs the Sharp extension, and answers 503 without it.`,
        tags: ['Assets'],
        params: assetIdParam,
        body: {
          type: 'object',
          required: ['operations', 'mode'],
          properties: {
            operations: {
              type: 'array',
              maxItems: 100,
              items: {
                oneOf: [
                  {
                    type: 'object',
                    required: ['op', 'angle'],
                    properties: {
                      op: { const: 'rotate' },
                      angle: { type: 'number', minimum: -360, maximum: 360 },
                      background: { type: 'string', format: 'hexcolor' }
                    }
                  },
                  {
                    type: 'object',
                    required: ['op'],
                    properties: { op: { enum: ['flip', 'flop'] } }
                  },
                  {
                    type: 'object',
                    required: ['op', ...regionRequired],
                    properties: { op: { const: 'crop' }, ...regionProperties }
                  },
                  {
                    type: 'object',
                    required: ['op', 'width', 'height'],
                    properties: {
                      op: { const: 'resize' },
                      width: regionProperties.width,
                      height: regionProperties.height
                    }
                  },
                  {
                    type: 'object',
                    required: ['op', 'top', 'right', 'bottom', 'left', 'background'],
                    properties: {
                      op: { const: 'extend' },
                      top: borderWidth,
                      right: borderWidth,
                      bottom: borderWidth,
                      left: borderWidth,
                      background: { type: 'string', format: 'hexcolor' }
                    }
                  },
                  {
                    type: 'object',
                    required: ['op', 'style', ...regionRequired],
                    properties: {
                      op: { const: 'redact' },
                      ...regionProperties,
                      style: { enum: ['fill', 'pixelate', 'blur'] },
                      color: { type: 'string', format: 'hexcolor' },
                      size: { type: 'integer', minimum: 1, maximum: 100 }
                    }
                  }
                ]
              }
            },
            adjust: {
              type: 'object',
              description:
                'Each matches the CSS filter function of the same name. 1 changes nothing.',
              properties: {
                brightness: { type: 'number', minimum: 0, maximum: 2, default: 1 },
                contrast: { type: 'number', minimum: 0, maximum: 2, default: 1 },
                saturation: { type: 'number', minimum: 0, maximum: 2, default: 1 },
                grayscale: { type: 'boolean', default: false },
                sharpen: { type: 'boolean', default: false }
              },
              default: {}
            },
            mode: {
              type: 'string',
              enum: ['replace', 'saveAs']
            },
            fileName: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description:
                'Required for `saveAs`, including the extension. Sanitized, so the stored name may differ from the one sent.'
            },
            quality: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 85,
              description: 'Only applies to JPEG and WebP. PNG and GIF are lossless and ignore it.'
            },
            unchangedSince: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        response: {
          200: {
            description: 'Image edited successfully',
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
      const { operations, adjust } = req.body
      if (operations.length === 0 && isEqual({ ...NEUTRAL_ADJUST, ...adjust }, NEUTRAL_ADJUST)) {
        return reply.badRequest('There are no changes to save.')
      }
      const result = await applyImageEdit(req, reply, {
        operations,
        adjust,
        mode: req.body.mode,
        fileName: req.body.fileName,
        quality: req.body.quality,
        unchangedSince: req.body.unchangedSince ? new Date(req.body.unchangedSince) : null,
        what: 'Editing an image'
      })
      if (!result) {
        return reply
      }
      const { source, asset } = result

      await audit(req, 'asset', 'editAsset', {
        assetId: asset.id,
        sourceAssetId: source.id,
        siteId: req.params.siteId,
        locale: source.locale,
        folderPath: source.folderPath,
        fileName: asset.fileName,
        mode: req.body.mode,
        operations,
        adjust,
        width: asset.width,
        height: asset.height,
        previousWidth: source.width,
        previousHeight: source.height
      })

      return {
        ok: true,
        message: 'Image edited successfully.',
        asset
      }
    }
  )

  /**
   * RESIZE IMAGE
   */
  app.post<{
    Params: { siteId: string; assetId: string }
    Body: {
      width: number
      height: number
      quality?: number
      mode: 'replace' | 'saveAs'
      fileName?: string
    }
  }>(
    '/sites/:siteId/assets/:assetId/resize',
    {
      config: {
        scope: 'assets'
      },
      /*
        No route-level `permissions`: that hook reads the group-wide list, and asset permissions come
        from a group's RULES, which address the folder the file is in. Checked below.
      */
      schema: {
        summary: 'Resize an image',
        description: `Resizes a PNG, JPEG, WebP or GIF image to exactly \`width\` × \`height\` — sending a pair that does not keep the original ratio stretches it. Neither may exceed the original: an image can be made smaller, not larger. Only the first frame of an animated GIF or WebP is read, and the result is a still image whatever it is saved as. SVG is refused, having no pixel size to change.\n\n\`replace\` writes the result over the file, which keeps its ID and its name, so every page showing it shows the new one. \`saveAs\` stores it as a new file named \`fileName\` in the same folder and locale, settled by the site's upload conflict behavior like any other upload, and encoded as whatever format that name's extension says.\n\nThe same as \`/edit\` with a single \`resize\` operation.\n\nNeeds \`write:assets\` where the result is written, and \`read:assets\` on the original. Needs the Sharp extension, and answers 503 without it.`,
        tags: ['Assets'],
        params: assetIdParam,
        body: {
          type: 'object',
          required: ['width', 'height', 'mode'],
          properties: {
            width: {
              type: 'integer',
              minimum: 1,
              maximum: 65535
            },
            height: {
              type: 'integer',
              minimum: 1,
              maximum: 65535
            },
            quality: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 80,
              description: 'Only applies to JPEG and WebP. PNG and GIF are lossless and ignore it.'
            },
            mode: {
              type: 'string',
              enum: ['replace', 'saveAs']
            },
            fileName: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description:
                'Required for `saveAs`, including the extension. Sanitized, so the stored name may differ from the one sent.'
            }
          }
        },
        response: {
          200: {
            description: 'Image resized successfully',
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
      const result = await applyImageEdit(req, reply, {
        operations: [{ op: 'resize', width: req.body.width, height: req.body.height }],
        adjust: NEUTRAL_ADJUST,
        mode: req.body.mode,
        fileName: req.body.fileName,
        quality: req.body.quality ?? 80,
        unchangedSince: null,
        what: 'Resizing an image'
      })
      if (!result) {
        return reply
      }
      const { source, asset } = result

      await audit(req, 'asset', 'resizeAsset', {
        assetId: asset.id,
        sourceAssetId: source.id,
        siteId: req.params.siteId,
        locale: source.locale,
        folderPath: source.folderPath,
        fileName: asset.fileName,
        mode: req.body.mode,
        width: req.body.width,
        height: req.body.height,
        previousWidth: source.width,
        previousHeight: source.height
      })

      return {
        ok: true,
        message: 'Image resized successfully.',
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
      config: {
        scope: 'assets'
      },
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
          requestUserId(req) ?? undefined
        ))
      ) {
        return reply.notFound('This asset does not exist.')
      }

      await audit(req, 'asset', 'deleteAsset', {
        assetId: req.params.assetId,
        siteId: req.params.siteId,
        locale: doomed.locale,
        folderPath: doomed.folderPath,
        fileName: doomed.fileName
      })

      return reply.code(204).send()
    }
  )
}

export default routes
