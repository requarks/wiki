const express = require('express')
const router = express.Router()
const pageHelper = require('../helpers/page')
const _ = require('lodash')

/* global WIKI */

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
  if (WIKI.models.knex.client.pool.numFree() < 1 && WIKI.models.knex.client.pool.numUsed() < 1) {
    res.status(503).json({ ok: false }).end()
  } else {
    res.status(200).json({ ok: true }).end()
  }
})

/**
 * Administration
 */
router.get(['/a', '/a/*'], (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Admin')
  res.render('admin')
})

/**
 * Create/Edit document
 */
router.get(['/e', '/e/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })

  if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    return res.redirect(`/e/${pageArgs.locale}/${pageArgs.path}`)
  }

  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)

  if (pageHelper.isReservedPath(pageArgs.path)) {
    return next(new Error('Cannot create this page because it starts with a system reserved path.'))
  }

  let page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })

  const injectCode = {
    css: WIKI.config.theming.injectCSS,
    head: WIKI.config.theming.injectHead,
    body: WIKI.config.theming.injectBody
  }

  if (page) {
    if (!WIKI.auth.checkAccess(req.user, ['write:pages', 'manage:pages'], pageArgs)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'edit' })
    }

    await page.$relatedQuery('tags')
    page.tags = _.map(page.tags, 'tag')

    _.set(res.locals, 'pageMeta.title', `Edit ${page.title}`)
    _.set(res.locals, 'pageMeta.description', page.description)
    page.mode = 'update'
    page.isPublished = (page.isPublished === true || page.isPublished === 1) ? 'true' : 'false'
    page.content = Buffer.from(page.content).toString('base64')
  } else {
    if (!WIKI.auth.checkAccess(req.user, ['write:pages'], pageArgs)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'create' })
    }

    _.set(res.locals, 'pageMeta.title', `New Page`)
    page = {
      path: pageArgs.path,
      localeCode: pageArgs.locale,
      editorKey: null,
      mode: 'create',
      content: null
    }
  }
  res.render('editor', { page, injectCode })
})

/**
 * History
 */
router.get(['/h', '/h/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })

  if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    return res.redirect(`/h/${pageArgs.locale}/${pageArgs.path}`)
  }

  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)

  if (!WIKI.auth.checkAccess(req.user, ['read:pages'], pageArgs)) {
    _.set(res.locals, 'pageMeta.title', 'Unauthorized')
    return res.render('unauthorized', { action: 'history' })
  }

  const page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })
  if (page) {
    _.set(res.locals, 'pageMeta.title', page.title)
    _.set(res.locals, 'pageMeta.description', page.description)
    res.render('history', { page })
  } else {
    res.redirect(`/${pageArgs.path}`)
  }
})

/**
 * Profile
 */
router.get(['/p', '/p/*'], (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'User Profile')
  res.render('profile')
})

/**
 * Source
 */
router.get(['/s', '/s/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })

  if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    return res.redirect(`/s/${pageArgs.locale}/${pageArgs.path}`)
  }

  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)

  if (!WIKI.auth.checkAccess(req.user, ['read:pages'], pageArgs)) {
    return res.render('unauthorized', { action: 'source' })
  }

  const page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })
  if (page) {
    _.set(res.locals, 'pageMeta.title', page.title)
    _.set(res.locals, 'pageMeta.description', page.description)
    res.render('source', { page })
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
 * View document / asset
 */
router.get('/*', async (req, res, next) => {
  const stripExt = _.some(WIKI.data.pageExtensions, ext => _.endsWith(req.path, `.${ext}`))
  const pageArgs = pageHelper.parsePath(req.path, { stripExt })
  const isPage = (stripExt || pageArgs.path.indexOf('.') === -1)

  if (isPage) {
    if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
      return res.redirect(`/${pageArgs.locale}/${pageArgs.path}`)
    }

    req.i18n.changeLanguage(pageArgs.locale)

    if (!WIKI.auth.checkAccess(req.user, ['read:pages'], pageArgs)) {
      if (pageArgs.path === 'home') {
        return res.redirect('/login')
      }
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'view' })
    }

    try {
      const page = await WIKI.models.pages.getPage({
        path: pageArgs.path,
        locale: pageArgs.locale,
        userId: req.user.id,
        isPrivate: false
      })

      _.set(res, 'locals.siteConfig.lang', pageArgs.locale)

      if (page) {
        _.set(res.locals, 'pageMeta.title', page.title)
        _.set(res.locals, 'pageMeta.description', page.description)
        const sidebar = await WIKI.models.navigation.getTree({ cache: true })
        const injectCode = {
          css: WIKI.config.theming.injectCSS,
          head: WIKI.config.theming.injectHead,
          body: WIKI.config.theming.injectBody
        }

        if (req.query.legacy || req.get('user-agent').indexOf('Trident') >= 0) {
          if (_.isString(page.toc)) {
            page.toc = JSON.parse(page.toc)
          }
          res.render('legacy/page', { page, sidebar, injectCode, isAuthenticated: req.user && req.user.id !== 2 })
        } else {
          res.render('page', { page, sidebar, injectCode })
        }
      } else if (pageArgs.path === 'home') {
        _.set(res.locals, 'pageMeta.title', 'Welcome')
        res.render('welcome', { locale: pageArgs.locale })
      } else {
        _.set(res.locals, 'pageMeta.title', 'Page Not Found')
        if (WIKI.auth.checkAccess(req.user, ['write:pages'], pageArgs)) {
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

    await WIKI.models.assets.getAsset(pageArgs.path, res)
  }
})

module.exports = router
