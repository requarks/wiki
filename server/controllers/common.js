const express = require('express')
const router = express.Router()

/**
 * View document
 */
router.get('/*', (req, res, next) => {
  res.render('main/welcome')
})

module.exports = router
