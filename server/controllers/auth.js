/* global WIKI */

const express = require('express')
const router = express.Router()

/**
 * Login form
 */
router.get('/login', function (req, res, next) {
  res.render('login')
})

/**
 * Logout
 */
router.get('/logout', function (req, res) {
  req.logout()
  res.redirect('/')
})

/**
 * Register form
 */
router.get('/register', async (req, res, next) => {
  const localStrg = await WIKI.models.authentication.getStrategy('local')
  if (localStrg.selfRegistration) {
    res.render('register')
  } else {
    next(new WIKI.Error.AuthRegistrationDisabled())
  }
})

/**
 * JWT Public Endpoints
 */
router.get('/.well-known/jwk.json', function (req, res, next) {
  res.json(WIKI.config.certs.jwk)
})
router.get('/.well-known/jwk.pem', function (req, res, next) {
  res.send(WIKI.config.certs.public)
})

module.exports = router
