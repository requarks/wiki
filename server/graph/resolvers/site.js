const graphHelper = require('../../helpers/graph')
const _ = require('lodash')
const CleanCSS = require('clean-css')
const path = require('path')
const fs = require('fs-extra')
const { v4: uuid } = require('uuid')

module.exports = {
  Query: {
    async sites () {
      const sites = await WIKI.db.sites.query().orderBy('hostname')
      return sites.map(s => ({
        ...s.config,
        id: s.id,
        hostname: s.hostname,
        isEnabled: s.isEnabled,
        pageExtensions: s.config.pageExtensions.join(', ')
      }))
    },
    async siteById (obj, args) {
      const site = await WIKI.db.sites.query().findById(args.id)
      return site ? {
        ...site.config,
        id: site.id,
        hostname: site.hostname,
        isEnabled: site.isEnabled,
        pageExtensions: site.config.pageExtensions.join(', ')
      } : null
    },
    async siteByHostname (obj, args) {
      let site = await WIKI.db.sites.query().where({
        hostname: args.hostname
      }).first()
      if (!site && !args.exact) {
        site = await WIKI.db.sites.query().where({
          hostname: '*'
        }).first()
      }
      return site ? {
        ...site.config,
        id: site.id,
        hostname: site.hostname,
        isEnabled: site.isEnabled,
        pageExtensions: site.config.pageExtensions.join(', ')
      } : null
    }
  },
  Mutation: {
    /**
     * CREATE SITE
     */
    async createSite (obj, args) {
      try {
        // -> Validate inputs
        if (!args.hostname || args.hostname.length < 1 || !/^(\\*)|([a-z0-9\-.:]+)$/.test(args.hostname)) {
          throw new WIKI.Error.Custom('SiteCreateInvalidHostname', 'Invalid Site Hostname')
        }
        if (!args.title || args.title.length < 1 || !/^[^<>"]+$/.test(args.title)) {
          throw new WIKI.Error.Custom('SiteCreateInvalidTitle', 'Invalid Site Title')
        }
        // -> Check for duplicate catch-all
        if (args.hostname === '*') {
          const site = await WIKI.db.sites.query().where({
            hostname: args.hostname
          }).first()
          if (site) {
            throw new WIKI.Error.Custom('SiteCreateDuplicateCatchAll', 'A site with a catch-all hostname already exists! Cannot have 2 catch-all hostnames.')
          }
        }
        // -> Create site
        const newSite = await WIKI.db.sites.createSite(args.hostname, {
          title: args.title
        })
        return {
          operation: graphHelper.generateSuccess('Site created successfully'),
          site: newSite
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPDATE SITE
     */
    async updateSite (obj, args) {
      try {
        // -> Load site
        const site = await WIKI.db.sites.query().findById(args.id)
        if (!site) {
          throw new WIKI.Error.Custom('SiteInvalidId', 'Invalid Site ID')
        }
        // -> Check for bad input
        if (_.has(args.patch, 'hostname') && _.trim(args.patch.hostname).length < 1) {
          throw new WIKI.Error.Custom('SiteInvalidHostname', 'Hostname is invalid.')
        }
        // -> Check for duplicate catch-all
        if (args.patch.hostname === '*' && site.hostname !== '*') {
          const dupSite = await WIKI.db.sites.query().where({ hostname: '*' }).first()
          if (dupSite) {
            throw new WIKI.Error.Custom('SiteUpdateDuplicateCatchAll', `Site ${dupSite.config.title} with a catch-all hostname already exists! Cannot have 2 catch-all hostnames.`)
          }
        }
        // -> Format Code
        if (args.patch?.theme?.injectCSS) {
          args.patch.theme.injectCSS = new CleanCSS({ inline: false }).minify(args.patch.theme.injectCSS).styles
        }
        // -> Format Page Extensions
        if (args.patch?.pageExtensions) {
          args.patch.pageExtensions = args.patch.pageExtensions.split(',').map(ext => ext.trim().toLowerCase()).filter(ext => ext.length > 0)
        }
        // -> Update site
        await WIKI.db.sites.updateSite(args.id, {
          hostname: args.patch.hostname ?? site.hostname,
          isEnabled: args.patch.isEnabled ?? site.isEnabled,
          config: _.defaultsDeep(_.omit(args.patch, ['hostname', 'isEnabled']), site.config)
        })

        return {
          operation: graphHelper.generateSuccess('Site updated successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    },
    /**
     * DELETE SITE
     */
    async deleteSite (obj, args) {
      try {
        // -> Ensure site isn't last one
        const sitesCount = await WIKI.db.sites.query().count('id').first()
        if (sitesCount?.count && _.toNumber(sitesCount?.count) <= 1) {
          throw new WIKI.Error.Custom('SiteDeleteLastSite', 'Cannot delete the last site. At least 1 site must exists at all times.')
        }
        // -> Delete site
        await WIKI.db.sites.deleteSite(args.id)
        return {
          operation: graphHelper.generateSuccess('Site deleted successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPLOAD LOGO
     */
    async uploadSiteLogo (obj, args, context) {
      try {
        const { filename, mimetype, createReadStream } = await args.image
        WIKI.logger.info(`Processing site logo ${filename} of type ${mimetype}...`)
        if (!WIKI.extensions.ext.sharp.isInstalled) {
          throw new Error('This feature requires the Sharp extension but it is not installed.')
        }
        if (!['.svg', '.png', '.jpg', 'webp', '.gif'].some(s => filename.endsWith(s))) {
          throw new Error('Invalid File Extension. Must be svg, png, jpg, webp or gif.')
        }
        const destFormat = mimetype.startsWith('image/svg') ? 'svg' : 'png'
        const destFolder = path.resolve(
          process.cwd(),
          WIKI.config.dataPath,
          `assets`
        )
        const destPath = path.join(destFolder, `logo-${args.id}.${destFormat}`)
        await fs.ensureDir(destFolder)
        // -> Resize
        await WIKI.extensions.ext.sharp.resize({
          format: destFormat,
          inputStream: createReadStream(),
          outputPath: destPath,
          height: 72
        })
        // -> Save logo meta to DB
        const site = await WIKI.db.sites.query().findById(args.id)
        if (!site.config.assets.logo) {
          site.config.assets.logo = uuid()
        }
        site.config.assets.logoExt = destFormat
        await WIKI.db.sites.query().findById(args.id).patch({ config: site.config })
        await WIKI.db.sites.reloadCache()
        // -> Save image data to DB
        const imgBuffer = await fs.readFile(destPath)
        await WIKI.db.knex('assets').insert({
          id: site.config.assets.logo,
          filename: `_logo.${destFormat}`,
          hash: '_logo',
          ext: `.${destFormat}`,
          isSystem: true,
          kind: 'image',
          mime: (destFormat === 'svg') ? 'image/svg' : 'image/png',
          fileSize: Math.ceil(imgBuffer.byteLength / 1024),
          data: imgBuffer,
          authorId: context.req.user.id,
          siteId: site.id
        }).onConflict('id').merge()
        WIKI.logger.info('New site logo processed successfully.')
        return {
          operation: graphHelper.generateSuccess('Site logo uploaded successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPLOAD FAVICON
     */
    async uploadSiteFavicon (obj, args, context) {
      try {
        const { filename, mimetype, createReadStream } = await args.image
        WIKI.logger.info(`Processing site favicon ${filename} of type ${mimetype}...`)
        if (!WIKI.extensions.ext.sharp.isInstalled) {
          throw new Error('This feature requires the Sharp extension but it is not installed.')
        }
        if (!['.svg', '.png', '.jpg', '.webp', '.gif'].some(s => filename.endsWith(s))) {
          throw new Error('Invalid File Extension. Must be svg, png, jpg, webp or gif.')
        }
        const destFormat = mimetype.startsWith('image/svg') ? 'svg' : 'png'
        const destFolder = path.resolve(
          process.cwd(),
          WIKI.config.dataPath,
          `assets`
        )
        const destPath = path.join(destFolder, `favicon-${args.id}.${destFormat}`)
        await fs.ensureDir(destFolder)
        // -> Resize
        await WIKI.extensions.ext.sharp.resize({
          format: destFormat,
          inputStream: createReadStream(),
          outputPath: destPath,
          width: 64,
          height: 64
        })
        // -> Save favicon meta to DB
        const site = await WIKI.db.sites.query().findById(args.id)
        if (!site.config.assets.favicon) {
          site.config.assets.favicon = uuid()
        }
        site.config.assets.faviconExt = destFormat
        await WIKI.db.sites.query().findById(args.id).patch({ config: site.config })
        await WIKI.db.sites.reloadCache()
        // -> Save image data to DB
        const imgBuffer = await fs.readFile(destPath)
        await WIKI.db.knex('assets').insert({
          id: site.config.assets.favicon,
          filename: `_favicon.${destFormat}`,
          hash: '_favicon',
          ext: `.${destFormat}`,
          isSystem: true,
          kind: 'image',
          mime: (destFormat === 'svg') ? 'image/svg' : 'image/png',
          fileSize: Math.ceil(imgBuffer.byteLength / 1024),
          data: imgBuffer,
          authorId: context.req.user.id,
          siteId: site.id
        }).onConflict('id').merge()
        WIKI.logger.info('New site favicon processed successfully.')
        return {
          operation: graphHelper.generateSuccess('Site favicon uploaded successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPLOAD LOGIN BG
     */
    async uploadSiteLoginBg (obj, args, context) {
      try {
        const { filename, mimetype, createReadStream } = await args.image
        WIKI.logger.info(`Processing site login bg ${filename} of type ${mimetype}...`)
        if (!WIKI.extensions.ext.sharp.isInstalled) {
          throw new Error('This feature requires the Sharp extension but it is not installed.')
        }
        if (!['.png', '.jpg', '.webp'].some(s => filename.endsWith(s))) {
          throw new Error('Invalid File Extension. Must be png, jpg or webp.')
        }
        const destFolder = path.resolve(
          process.cwd(),
          WIKI.config.dataPath,
          `assets`
        )
        const destPath = path.join(destFolder, `loginbg-${args.id}.jpg`)
        await fs.ensureDir(destFolder)
        // -> Resize
        await WIKI.extensions.ext.sharp.resize({
          format: 'jpg',
          inputStream: createReadStream(),
          outputPath: destPath,
          width: 1920
        })
        // -> Save login bg meta to DB
        const site = await WIKI.db.sites.query().findById(args.id)
        if (!site.config.assets.loginBg) {
          site.config.assets.loginBg = uuid()
          await WIKI.db.sites.query().findById(args.id).patch({ config: site.config })
          await WIKI.db.sites.reloadCache()
        }
        // -> Save image data to DB
        const imgBuffer = await fs.readFile(destPath)
        await WIKI.db.knex('assets').insert({
          id: site.config.assets.loginBg,
          filename: '_loginbg.jpg',
          hash: '_loginbg',
          ext: '.jpg',
          isSystem: true,
          kind: 'image',
          mime: 'image/jpg',
          fileSize: Math.ceil(imgBuffer.byteLength / 1024),
          data: imgBuffer,
          authorId: context.req.user.id,
          siteId: site.id
        }).onConflict('id').merge()
        WIKI.logger.info('New site login bg processed successfully.')
        return {
          operation: graphHelper.generateSuccess('Site login bg uploaded successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    }
  }
}
