const express = require('express')
const router = express.Router()
const pageHelper = require('../helpers/page')

/* global WIKI */

/**
 * Create/Edit document
 */
router.get(['/e', '/e/*'], (req, res, next) => {
  res.render('editor')
})

/**
 * Administration
 */
router.get(['/a', '/a/*'], (req, res, next) => {
  res.render('admin')
})

/**
 * Profile
 */
router.get(['/p', '/p/*'], (req, res, next) => {
  res.render('profile')
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
    private: false
  })
  if (page) {
    res.render('page', { page })
  } else if (pageArgs.path === 'home') {
    res.render('welcome')
  } else {
    res.render('new')
  }
})

module.exports = router
