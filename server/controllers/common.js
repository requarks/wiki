const express = require('express')
const router = express.Router()

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
router.get('/', (req, res, next) => {
  res.render('welcome')
})

/**
 * View document
 */
router.get('/*', (req, res, next) => {
  res.render('page')
})

module.exports = router
