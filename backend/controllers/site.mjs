import { validate as uuidValidate } from 'uuid'
import { replyWithFile } from '../helpers/common.mjs'
import path from 'node:path'

/**
 * _site Routes
 */
async function routes (app, options) {
  const siteAssetsPath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'assets')

  app.get('/:siteId/:resource', async (req, reply) => {
    let site
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
    switch (req.params.resource) {
      case 'logo': {
        if (site.config.assets.logo) {
          // TODO: Fetch from db if not in disk cache
          return replyWithFile(reply, path.join(siteAssetsPath, `logo-${site.id}.${site.config.assets.logoExt}`))
        } else {
          return replyWithFile(reply, path.join(WIKI.ROOTPATH, 'assets/_assets/logo-wikijs.svg'))
        }
      }
      case 'favicon': {
        if (site.config.assets.favicon) {
          // TODO: Fetch from db if not in disk cache
          return replyWithFile(reply, path.join(siteAssetsPath, `favicon-${site.id}.${site.config.assets.faviconExt}`))
        } else {
          return replyWithFile(reply, path.join(WIKI.ROOTPATH, 'assets/_assets/logo-wikijs.svg'))
        }
      }
      case 'loginbg': {
        if (site.config.assets.loginBg) {
          // TODO: Fetch from db if not in disk cache
          return replyWithFile(reply, path.join(siteAssetsPath, `loginbg-${site.id}.jpg`))
        } else {
          return replyWithFile(reply, path.join(WIKI.ROOTPATH, 'assets/_assets/bg/login.jpg'))
        }
      }
      default: {
        return reply.badRequest('Invalid Site Resource')
      }
    }
  })
}

export default routes
