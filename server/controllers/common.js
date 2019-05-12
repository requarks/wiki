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
 * Create/Edit document
 */
router.get(['/e', '/e/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path)

  if (pageHelper.isReservedPath(pageArgs.path)) {
    return next(new Error('Cannot create this page because it starts with a system reserved path.'))
  }

  let page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })
  if (page) {
    if (!WIKI.auth.checkAccess(req.user, ['manage:pages'], pageArgs)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.render('unauthorized', { action: 'edit' })
    }

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
  res.render('editor', { page })
})

/**
 * Administration
 */
router.get(['/a', '/a/*'], (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Admin')
  res.render('admin')
})

/**
 * Profile
 */
router.get(['/p', '/p/*'], (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'User Profile')
  res.render('profile')
})

/**
 * History
 */
router.get(['/h', '/h/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path)

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
 * Source
 */
router.get(['/s', '/s/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path)

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
 * View document
 */
router.get('/*', async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path)

  if (!WIKI.auth.checkAccess(req.user, ['read:pages'], pageArgs)) {
    _.set(res.locals, 'pageMeta.title', 'Unauthorized')
    return res.render('unauthorized', { action: 'view' })
  }

  const page = await WIKI.models.pages.getPage({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })
  if (page) {
    _.set(res.locals, 'pageMeta.title', page.title)
    _.set(res.locals, 'pageMeta.description', page.description)
    const sidebar = await WIKI.models.navigation.getTree({ cache: true })
    const injectCode = {
      css: WIKI.config.theming.injectCSS,
      head: WIKI.config.theming.injectHead,
      body: WIKI.config.theming.injectBody
    }
    res.render('page', { page, sidebar, injectCode })
  } else if (pageArgs.path === 'home') {
    _.set(res.locals, 'pageMeta.title', 'Welcome')
    res.render('welcome')
  } else {
    _.set(res.locals, 'pageMeta.title', 'Page Not Found')
    if (WIKI.auth.checkAccess(req.user, ['write:pages'], pageArgs)) {
      res.status(404).render('new', { pagePath: req.path })
    } else {
      res.render('notfound', { action: 'view' })
    }
  }
})

module.exports = router
