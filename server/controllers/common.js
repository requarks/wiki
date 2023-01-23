const express = require('express')
const router = express.Router()
const pageHelper = require('../helpers/page')
const _ = require('lodash')
const CleanCSS = require('clean-css')
const moment = require('moment')
const path = require('path')
const siteAssetsPath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'assets')

/**
 * Robots.txt
 */
router.get('/robots.txt', (req, res, next) => {
  res.type('text/plain')
  if (_.includes(WIKI.config.seo.robots, 'noindex')) {
    res.send('User-agent: *\nDisallow: /')
  } else {
    res.status(200).end()
  }
})

/**
 * Health Endpoint
 */
router.get('/healthz', (req, res, next) => {
  if (WIKI.db.knex.client.pool.numFree() < 1 && WIKI.db.knex.client.pool.numUsed() < 1) {
    res.status(503).json({ ok: false }).end()
  } else {
    res.status(200).json({ ok: true }).end()
  }
})

/**
 * Site Asset
 */
router.get('/_site/:siteId?/:resource', async (req, res, next) => {
  const site = req.params.siteId ? WIKI.sites[req.params.siteId] : await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
  if (!site) {
    return res.status(404).send('Site Not Found')
  }
  switch (req.params.resource) {
    case 'logo': {
      if (site.config.assets.logo) {
        // TODO: Fetch from db if not in disk cache
        res.sendFile(path.join(siteAssetsPath, `logo-${site.id}.${site.config.assets.logoExt}`))
      } else {
        res.sendFile(path.join(WIKI.ROOTPATH, 'assets/_assets/logo-wikijs.svg'))
      }
      break
    }
    case 'favicon': {
      if (site.config.assets.favicon) {
        // TODO: Fetch from db if not in disk cache
        res.sendFile(path.join(siteAssetsPath, `favicon-${site.id}.${site.config.assets.faviconExt}`))
      } else {
        res.sendFile(path.join(WIKI.ROOTPATH, 'assets/_assets/logo-wikijs.svg'))
      }
      break
    }
    case 'loginbg': {
      if (site.config.assets.loginBg) {
        // TODO: Fetch from db if not in disk cache
        res.sendFile(path.join(siteAssetsPath, `loginbg-${site.id}.jpg`))
      } else {
        res.sendFile(path.join(WIKI.ROOTPATH, 'assets/_assets/bg/login.jpg'))
      }
      break
    }
    default: {
      return res.status(404).send('Invalid Site Resource')
    }
  }
})

/**
 * Asset Thumbnails / Download
 */
router.get('/_thumb/:id.webp', async (req, res, next) => {
  const thumb = await WIKI.db.assets.getThumbnail({
    id: req.params.id
  })

  if (thumb) {
    // TODO: Check permissions

    switch (thumb.previewState) {
      case 'pending': {
        res.redirect('/_assets/illustrations/fileman-pending.svg')
        break
      }
      case 'ready': {
        res.set('Content-Type', 'image/webp')
        res.send(thumb.preview)
        break
      }
      case 'failed': {
        res.redirect('/_assets/illustrations/fileman-failed.svg')
        break
      }
      default: {
        return res.status(500).send('Invalid Thumbnail Preview State')
      }
    }
  } else {
    return res.sendStatus(404)
  }
})

/**
 * New v3 vue app
 */
router.get([
  '/_admin',
  '/_admin/*',
  '/_profile',
  '/_profile/*',
  '/_error',
  '/_error/*',
  '/_welcome'
], (req, res, next) => {
  res.sendFile(path.join(WIKI.ROOTPATH, 'assets/index.html'))
})
// router.get(['/_admin', '/_admin/*'], (req, res, next) => {
//   if (!WIKI.auth.checkAccess(req.user, [
//     'manage:system',
//     'write:users',
//     'manage:users',
//     'write:groups',
//     'manage:groups',
//     'manage:navigation',
//     'manage:theme',
//     'manage:api'
//   ])) {
//     _.set(res.locals, 'pageMeta.title', 'Unauthorized')
//     return res.status(403).render('unauthorized', { action: 'view' })
//   }

//   _.set(res.locals, 'pageMeta.title', 'Admin')
//   res.render('admin')

// })

/**
 * Download Page / Version
 */
router.get(['/d', '/d/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })

  const versionId = (req.query.v) ? _.toSafeInteger(req.query.v) : 0

  const page = await WIKI.db.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })

  pageArgs.tags = _.get(page, 'tags', [])

  if (versionId > 0) {
    if (!WIKI.auth.checkAccess(req.user, ['read:history'], pageArgs)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'downloadVersion' })
    }
  } else {
    if (!WIKI.auth.checkAccess(req.user, ['read:source'], pageArgs)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'download' })
    }
  }

  if (page) {
    const fileName = _.last(page.path.split('/')) + '.' + pageHelper.getFileExtension(page.contentType)
    res.attachment(fileName)
    if (versionId > 0) {
      const pageVersion = await WIKI.db.pageHistory.getVersion({ pageId: page.id, versionId })
      res.send(pageHelper.injectPageMetadata(pageVersion))
    } else {
      res.send(pageHelper.injectPageMetadata(page))
    }
  } else {
    res.status(404).end()
  }
})

/**
 * Create/Edit document
 */
router.get(['/_edit', '/_edit/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })
  const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })

  if (!site) {
    throw new Error('INVALID_SITE')
  }

  if (pageArgs.path === '') {
    return res.redirect(`/_edit/home`)
  }

  // if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
  //   return res.redirect(`/_edit/${pageArgs.locale}/${pageArgs.path}`)
  // }

  // req.i18n.changeLanguage(pageArgs.locale)

  // -> Set Editor Lang
  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)
  // _.set(res, 'locals.siteConfig.rtl', req.i18n.dir() === 'rtl')

  // -> Check for reserved path
  if (pageHelper.isReservedPath(pageArgs.path)) {
    return next(new Error('Cannot create this page because it starts with a system reserved path.'))
  }

  // -> Get page data from DB
  let page = await WIKI.db.pages.getPageFromDb({
    siteId: site.id,
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id
  })

  pageArgs.tags = _.get(page, 'tags', [])

  // -> Effective Permissions
  const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)

  const injectCode = {
    css: '', // WIKI.config.theming.injectCSS,
    head: '', // WIKI.config.theming.injectHead,
    body: '' // WIKI.config.theming.injectBody
  }

  if (page) {
    // -> EDIT MODE
    if (!(effectivePermissions.pages.write || effectivePermissions.pages.manage)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'edit' })
    }

    // -> Get page tags
    await page.$relatedQuery('tags')
    page.tags = _.map(page.tags, 'tag')

    // Handle missing extra field
    page.extra = page.extra || { css: '', js: '' }

    // -> Beautify Script CSS
    if (!_.isEmpty(page.extra.css)) {
      page.extra.css = new CleanCSS({ format: 'beautify' }).minify(page.extra.css).styles
    }

    _.set(res.locals, 'pageMeta.title', `Edit ${page.title}`)
    _.set(res.locals, 'pageMeta.description', page.description)
    page.mode = 'update'
    page.isPublished = (page.isPublished === true || page.isPublished === 1) ? 'true' : 'false'
    page.content = Buffer.from(page.content).toString('base64')
  } else {
    // -> CREATE MODE
    if (!effectivePermissions.pages.write) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'create' })
    }

    _.set(res.locals, 'pageMeta.title', `New Page`)
    page = {
      path: pageArgs.path,
      localeCode: pageArgs.locale,
      editorKey: null,
      mode: 'create',
      content: null,
      title: null,
      description: null,
      updatedAt: new Date().toISOString(),
      extra: {
        css: '',
        js: ''
      }
    }
  }

  res.render('editor', { page, injectCode, effectivePermissions })
})

/**
 * History
 */
router.get(['/h', '/h/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })

  if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    return res.redirect(`/h/${pageArgs.locale}/${pageArgs.path}`)
  }

  req.i18n.changeLanguage(pageArgs.locale)

  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)
  _.set(res, 'locals.siteConfig.rtl', req.i18n.dir() === 'rtl')

  const page = await WIKI.db.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })

  if (!page) {
    _.set(res.locals, 'pageMeta.title', 'Page Not Found')
    return res.status(404).render('notfound', { action: 'history' })
  }

  pageArgs.tags = _.get(page, 'tags', [])

  const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)

  if (!effectivePermissions.history.read) {
    _.set(res.locals, 'pageMeta.title', 'Unauthorized')
    return res.render('unauthorized', { action: 'history' })
  }

  if (page) {
    _.set(res.locals, 'pageMeta.title', page.title)
    _.set(res.locals, 'pageMeta.description', page.description)

    res.render('history', { page, effectivePermissions })
  } else {
    res.redirect(`/${pageArgs.path}`)
  }
})

/**
 * Page ID redirection
 */
router.get(['/i', '/i/:id'], async (req, res, next) => {
  const pageId = _.toSafeInteger(req.params.id)
  if (pageId <= 0) {
    return res.redirect('/')
  }

  const page = await WIKI.db.pages.query().column(['path', 'localeCode', 'isPrivate', 'privateNS']).findById(pageId)
  if (!page) {
    _.set(res.locals, 'pageMeta.title', 'Page Not Found')
    return res.status(404).render('notfound', { action: 'view' })
  }

  if (!WIKI.auth.checkAccess(req.user, ['read:pages'], {
    locale: page.localeCode,
    path: page.path,
    private: page.isPrivate,
    privateNS: page.privateNS,
    explicitLocale: false,
    tags: page.tags
  })) {
    _.set(res.locals, 'pageMeta.title', 'Unauthorized')
    return res.render('unauthorized', { action: 'view' })
  }

  if (WIKI.config.lang.namespacing) {
    return res.redirect(`/${page.localeCode}/${page.path}`)
  } else {
    return res.redirect(`/${page.path}`)
  }
})

/**
 * Source
 */
router.get(['/s', '/s/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })
  const versionId = (req.query.v) ? _.toSafeInteger(req.query.v) : 0

  const page = await WIKI.db.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })

  pageArgs.tags = _.get(page, 'tags', [])

  if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    return res.redirect(`/s/${pageArgs.locale}/${pageArgs.path}`)
  }

  // -> Effective Permissions
  const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)

  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)
  _.set(res, 'locals.siteConfig.rtl', req.i18n.dir() === 'rtl')

  if (versionId > 0) {
    if (!effectivePermissions.history.read) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'sourceVersion' })
    }
  } else {
    if (!effectivePermissions.source.read) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'source' })
    }
  }

  if (page) {
    if (versionId > 0) {
      const pageVersion = await WIKI.db.pageHistory.getVersion({ pageId: page.id, versionId })
      _.set(res.locals, 'pageMeta.title', pageVersion.title)
      _.set(res.locals, 'pageMeta.description', pageVersion.description)
      res.render('source', {
        page: {
          ...page,
          ...pageVersion
        },
        effectivePermissions
      })
    } else {
      _.set(res.locals, 'pageMeta.title', page.title)
      _.set(res.locals, 'pageMeta.description', page.description)

      res.render('source', { page, effectivePermissions })
    }
  } else {
    res.redirect(`/${pageArgs.path}`)
  }
})

/**
 * Tags
 */
router.get(['/t', '/t/*'], (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Tags')
  res.render('tags')
})

/**
 * User Avatar
 */
router.get('/_user/:uid/avatar', async (req, res, next) => {
  if (!WIKI.auth.checkAccess(req.user, ['read:pages'])) {
    return res.sendStatus(403)
  }
  const av = await WIKI.db.users.getUserAvatarData(req.params.uid)
  if (av) {
    res.set('Content-Type', 'image/jpeg')
    return res.send(av)
  }

  return res.sendStatus(404)
})

/**
 * View document / asset
 */
router.get('/*', async (req, res, next) => {
  const stripExt = _.some(WIKI.data.pageExtensions, ext => _.endsWith(req.path, `.${ext}`))
  const pageArgs = pageHelper.parsePath(req.path, { stripExt })
  const isPage = (stripExt || pageArgs.path.indexOf('.') === -1)
  const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })

  if (!site) {
    throw new Error('INVALID_SITE')
  }

  if (isPage) {
    // if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    //   return res.redirect(`/${pageArgs.locale}/${pageArgs.path}`)
    // }

    // req.i18n.changeLanguage(pageArgs.locale)

    try {
      // -> Get Page from cache
      const page = await WIKI.db.pages.getPage({
        siteId: site.id,
        path: pageArgs.path,
        locale: pageArgs.locale,
        userId: req.user.id
      })
      pageArgs.tags = _.get(page, 'tags', [])

      // -> Effective Permissions
      const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)

      // -> Check User Access
      if (!effectivePermissions.pages.read) {
        if (req.user.id === WIKI.auth.guest.id) {
          res.cookie('loginRedirect', req.path, {
            maxAge: 15 * 60 * 1000
          })
        }
        if (pageArgs.path === 'home' && req.user.id === WIKI.auth.guest.id) {
          return res.redirect('/login')
        }
        return res.redirect(`/_error/unauthorized?from=${req.path}`)
      }

      _.set(res, 'locals.siteConfig.lang', pageArgs.locale)
      // _.set(res, 'locals.siteConfig.rtl', req.i18n.dir() === 'rtl')

      if (page) {
        _.set(res.locals, 'pageMeta.title', page.title)
        _.set(res.locals, 'pageMeta.description', page.description)

        // -> Check Publishing State
        let pageIsPublished = page.isPublished
        if (pageIsPublished && !_.isEmpty(page.publishStartDate)) {
          pageIsPublished = moment(page.publishStartDate).isSameOrBefore()
        }
        if (pageIsPublished && !_.isEmpty(page.publishEndDate)) {
          pageIsPublished = moment(page.publishEndDate).isSameOrAfter()
        }
        if (!pageIsPublished && !effectivePermissions.pages.write) {
          _.set(res.locals, 'pageMeta.title', 'Unauthorized')
          return res.status(403).render('unauthorized', {
            action: 'view'
          })
        }

        // -> Render view
        res.sendFile(path.join(WIKI.ROOTPATH, 'assets/index.html'))
      } else if (pageArgs.path === 'home') {
        res.redirect('/_welcome')
      } else {
        _.set(res.locals, 'pageMeta.title', 'Page Not Found')
        if (effectivePermissions.pages.write) {
          res.status(404).render('new', { path: pageArgs.path, locale: pageArgs.locale })
        } else {
          res.status(404).render('notfound', { action: 'view' })
        }
      }
    } catch (err) {
      next(err)
    }
  } else {
    if (!WIKI.auth.checkAccess(req.user, ['read:assets'], pageArgs)) {
      return res.sendStatus(403)
    }

    await WIKI.db.assets.getAsset(pageArgs.path, res)
  }
})

module.exports = router
