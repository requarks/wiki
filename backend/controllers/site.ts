import { validate as uuidValidate } from 'uuid'
import { replyWithFile } from '../helpers/common.ts'
import { svgMimeType } from '../helpers/images.ts'
import crypto from 'node:crypto'
import path from 'node:path'
import type { SiteAssetKind } from '../models/sites.ts'
import type { FastifyInstance } from 'fastify'

/**
 * What is served for each of a site's images while nobody has uploaded one. The keys are the names
 * the images are addressed by, which are the asset kinds themselves.
 */
const SITE_ASSET_FALLBACKS: Record<SiteAssetKind, string> = {
  logo: 'assets/_assets/logo-wikijs.svg',
  favicon: 'assets/_assets/logo-wikijs.svg',
  loginBg: 'assets/_assets/bg/login.jpg'
}

/**
 * An uploaded site image changes whenever an administrator replaces it, and the URL never carries a
 * version — so it is always revalidated, and the ETag turns that into an empty 304 rather than a
 * re-download.
 */
const SITE_ASSET_CACHE = 'public, no-cache'

/**
 * An SVG is a document, not an image file: opened directly rather than through an `<img>`, a browser
 * will run whatever scripts are in it, in this origin. Uploading one takes `manage:sites`, which
 * already allows injecting markup into every page of the site — but that is a reason to keep the
 * blast radius of a stolen admin session small, not to ignore it. Nothing legitimate in a logo needs
 * more than the markup itself, so the response allows nothing else.
 */
const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

/**
 * _site Routes
 */
async function routes(app: FastifyInstance) {
  app.get<{ Params: { siteId: string; resource: string } }>(
    '/:siteId/:resource',
    async (req, reply) => {
      let site: any
      if (req.params.siteId === 'current' && req.hostname) {
        site = await WIKI.models.sites.getSiteByHostname({ hostname: req.hostname })
      } else if (uuidValidate(req.params.siteId)) {
        site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      } else {
        site = await WIKI.models.sites.getSiteByHostname({ hostname: req.params.siteId })
      }
      if (!site) {
        return reply.notFound('Site not found')
      }

      const kind = req.params.resource as SiteAssetKind
      const fallback = SITE_ASSET_FALLBACKS[kind]
      if (!fallback) {
        return reply.badRequest('Invalid Site Resource')
      }

      // -> The flag lives in the cached site config, so a site that has uploaded nothing — which is
      //    every site until an administrator says otherwise — never touches the database here
      const asset = site.config.assets?.[kind]
        ? await WIKI.models.sites.getAsset(site.id, kind)
        : null
      if (!asset) {
        return replyWithFile(reply, path.join(WIKI.ROOTPATH, fallback))
      }

      const etag = `"${crypto.createHash('sha1').update(asset.data).digest('hex')}"`
      reply.header('ETag', etag)
      reply.header('Cache-Control', SITE_ASSET_CACHE)
      // -> The bytes were uploaded, so the browser must take the type at its word rather than looking
      //    for something more interesting in them
      reply.header('X-Content-Type-Options', 'nosniff')
      if (asset.mime === svgMimeType) {
        reply.header('Content-Security-Policy', SVG_CSP)
      }
      if (req.headers['if-none-match'] === etag) {
        return reply.code(304).send()
      }

      return reply.type(asset.mime).send(asset.data)
    }
  )
}

export default routes
