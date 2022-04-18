/* global WIKI */

const express = require('express')
const ExpressBrute = require('express-brute')
const BruteKnex = require('../helpers/brute-knex')
const router = express.Router()
const moment = require('moment')
const _ = require('lodash')

const bruteforce = new ExpressBrute(new BruteKnex({
  createTable: true,
  knex: WIKI.models.knex
}), {
  freeRetries: 5,
  minWait: 5 * 60 * 1000, // 5 minutes
  maxWait: 60 * 60 * 1000, // 1 hour
  failCallback: (req, res, next) => {
    res.status(401).send('Too many failed attempts. Try again later.')
  }
})

/**
 * Login form
 */
router.get('/login', async (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Login')

  if (req.query.legacy || (req.get('user-agent') && req.get('user-agent').indexOf('Trident') >= 0)) {
    const { formStrategies, socialStrategies } = await WIKI.models.authentication.getStrategiesForLegacyClient()
    res.render('legacy/login', {
      err: false,
      formStrategies,
      socialStrategies
    })
  } else {
    // -> Bypass Login
    if (WIKI.config.auth.autoLogin && !req.query.all) {
      const stg = await WIKI.models.authentication.query().orderBy('order').first()
      const stgInfo = _.find(WIKI.data.authentication, ['key', stg.strategyKey])
      if (!stgInfo.useForm) {
        return res.redirect(`/login/${stg.key}`)
      }
    }
    // -> Show Login
    const bgUrl = !_.isEmpty(WIKI.config.auth.loginBgUrl) ? WIKI.config.auth.loginBgUrl : '/_assets/img/splash/1.jpg'
    res.render('login', { bgUrl, hideLocal: WIKI.config.auth.hideLocal })
  }
})

/**
 * Social Strategies Login
 */
router.get('/login/:strategy', async (req, res, next) => {
  try {
    await WIKI.models.users.login({
      strategy: req.params.strategy
    }, { req, res })
  } catch (err) {
    next(err)
  }
})

/**
 * Social Strategies Callback
 */
router.all('/login/:strategy/callback', async (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'POST') { return next() }

  try {
    const authResult = await WIKI.models.users.login({
      strategy: req.params.strategy
    }, { req, res })
    res.cookie('jwt', authResult.jwt, { expires: moment().add(1, 'y').toDate() })

    const loginRedirect = req.cookies['loginRedirect']
    if (loginRedirect === '/' && authResult.redirect) {
      res.clearCookie('loginRedirect')
      res.redirect(authResult.redirect)
    } else if (loginRedirect) {
      res.clearCookie('loginRedirect')
      res.redirect(loginRedirect)
    } else if (authResult.redirect) {
      res.redirect(authResult.redirect)
    } else {
      res.redirect('/')
    }
  } catch (err) {
    next(err)
  }
})

/**
 * LEGACY - Login form handling
 */
router.post('/login', bruteforce.prevent, async (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Login')

  if (req.query.legacy || req.get('user-agent').indexOf('Trident') >= 0) {
    try {
      const authResult = await WIKI.models.users.login({
        strategy: req.body.strategy,
        username: req.body.user,
        password: req.body.pass
      }, { req, res })
      req.brute.reset()
      res.cookie('jwt', authResult.jwt, { expires: moment().add(1, 'y').toDate() })
      res.redirect('/')
    } catch (err) {
      const { formStrategies, socialStrategies } = await WIKI.models.authentication.getStrategiesForLegacyClient()
      res.render('legacy/login', {
        err,
        formStrategies,
        socialStrategies
      })
    }
  } else {
    res.redirect('/login')
  }
})

/**
 * Logout
 */
router.get('/logout', async (req, res) => {
  await WIKI.auth.invalidateToken({ token: req.cookies['jwt'], reason: 'logout' })
  const redirURL = await WIKI.models.users.logout({ req, res })
  req.logout()
  res.clearCookie('jwt')
  res.redirect(redirURL)
})

/**
 * Register form
 */
router.get('/register', async (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Register')
  const localStrg = await WIKI.models.authentication.getStrategy('local')
  if (localStrg.selfRegistration) {
    res.render('register')
  } else {
    next(new WIKI.Error.AuthRegistrationDisabled())
  }
})

/**
 * Verify
 */
router.get('/verify/:token', bruteforce.prevent, async (req, res, next) => {
  try {
    const usr = await WIKI.models.userKeys.validateToken({ kind: 'verify', token: req.params.token })
    await WIKI.models.users.query().patch({ isVerified: true }).where('id', usr.id)
    req.brute.reset()
    if (WIKI.config.auth.enforce2FA) {
      res.redirect('/login')
    } else {
      const result = await WIKI.models.users.refreshToken(usr)
      res.cookie('jwt', result.token, { expires: moment().add(1, 'years').toDate() })
      res.redirect('/')
    }
  } catch (err) {
    next(err)
  }
})

/**
 * Reset Password
 */
router.get('/login-reset/:token', bruteforce.prevent, async (req, res, next) => {
  try {
    const usr = await WIKI.models.userKeys.validateToken({ kind: 'resetPwd', token: req.params.token })
    if (!usr) {
      throw new Error('Invalid Token')
    }
    req.brute.reset()

    const changePwdContinuationToken = await WIKI.models.userKeys.generateToken({
      userId: usr.id,
      kind: 'changePwd'
    })
    const bgUrl = !_.isEmpty(WIKI.config.auth.loginBgUrl) ? WIKI.config.auth.loginBgUrl : '/_assets/img/splash/1.jpg'
    res.render('login', { bgUrl, hideLocal: WIKI.config.auth.hideLocal, changePwdContinuationToken })
  } catch (err) {
    next(err)
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
