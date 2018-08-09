const express = require('express')
const router = express.Router()

/**
 * Create/Edit document
 */
router.get(['/e', '/e/*'], (req, res, next) => {
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
  res.render('main/page')
})

module.exports = router
