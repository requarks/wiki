const express = require('express')
const router = express.Router()

/**
 * Create/Edit document
 */
router.get('/e/*', (req, res, next) => {
  res.render('main/editor')
})

/**
 * View document
 */
router.get('/*', (req, res, next) => {
  res.render('main/welcome')
})

module.exports = router
