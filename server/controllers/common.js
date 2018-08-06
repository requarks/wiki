const express = require('express')
const router = express.Router()
const path = require('path')

/* global WIKI */

/**
 * Create/Edit document
 */
router.get('/e/*', (req, res, next) => {
  res.render('main/editor')
})

/**
 * Administration
 */
router.get(['/a', '/a/*'], (req, res, next) => {
  res.render('main/admin')
})

/**
 * Profile
 */
router.get(['/p', '/p/*'], (req, res, next) => {
  res.render('main/profile')
})

/**
 * View document
 */
router.get('/', (req, res, next) => {
  res.render('main/welcome')
})

/**
 * View document
 */
router.get('/*', (req, res, next) => {
  res.render(path.join(WIKI.ROOTPATH, 'themes/default/views/page'), {
    basedir: path.join(WIKI.SERVERPATH, 'views')
  })
})

module.exports = router
