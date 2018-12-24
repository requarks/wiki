const express = require('express')
const router = express.Router()
const pageHelper = require('../helpers/page')
const _ = require('lodash')

/* global WIKI */

/**
 * Create/Edit document
 */
router.get(['/e', '/e/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path)
  let page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })
  if (page) {
    _.set(res.locals, 'pageMeta.title', `Edit ${page.title}`)
    _.set(res.locals, 'pageMeta.description', page.description)
    page.mode = 'update'
    page.isPublished = (page.isPublished === true || page.isPublished === 1) ? 'true' : 'false'
    page.content = Buffer.from(page.content).toString('base64')
  } else {
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
    res.render('page', { page, sidebar })
  } else if (pageArgs.path === 'home') {
    res.render('welcome')
  } else {
    res.status(404).render('new', { pagePath: req.path })
  }
})

module.exports = router
