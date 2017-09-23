/* global wiki */

const Promise = require('bluebird')
const express = require('express')
const router = express.Router()
const ExpressBrute = require('express-brute')
const ExpressBruteRedisStore = require('express-brute-redis')
const moment = require('moment')
const _ = require('lodash')

/**
 * Setup Express-Brute
 */
const EBstore = new ExpressBruteRedisStore({
  client: wiki.redis
})
const bruteforce = new ExpressBrute(EBstore, {
  freeRetries: 5,
  minWait: 60 * 1000,
  maxWait: 5 * 60 * 1000,
  refreshTimeoutOnRequest: false,
  failCallback (req, res, next, nextValidRequestDate) {
    req.flash('alert', {
      class: 'error',
      title: wiki.lang.t('auth:errors.toomanyattempts'),
      message: wiki.lang.t('auth:errors.toomanyattemptsmsg', { time: moment(nextValidRequestDate).fromNow() }),
      iconClass: 'fa-times'
    })
    res.redirect('/login')
  }
})

/**
 * Login form
 */
router.get('/login', function (req, res, next) {
  res.render('auth/login', {
    authStrategies: _.reject(wiki.auth.strategies, { key: 'local' }),
    hasMultipleStrategies: Object.keys(wiki.config.auth.strategies).length > 1
  })
})

router.post('/login', bruteforce.prevent, function (req, res, next) {
  new Promise((resolve, reject) => {
    // [1] LOCAL AUTHENTICATION
    wiki.auth.passport.authenticate('local', function (err, user, info) {
      if (err) { return reject(err) }
      if (!user) { return reject(new Error('INVALID_LOGIN')) }
      resolve(user)
    })(req, res, next)
  }).catch({ message: 'INVALID_LOGIN' }, err => {
    if (_.has(wiki.config.auth.strategy, 'ldap')) {
      // [2] LDAP AUTHENTICATION
      return new Promise((resolve, reject) => {
        wiki.auth.passport.authenticate('ldapauth', function (err, user, info) {
          if (err) { return reject(err) }
          if (info && info.message) { return reject(new Error(info.message)) }
          if (!user) { return reject(new Error('INVALID_LOGIN')) }
          resolve(user)
        })(req, res, next)
      })
    } else {
      throw err
    }
  }).then((user) => {
    // LOGIN SUCCESS
    return req.logIn(user, function (err) {
      if (err) { return next(err) }
      req.brute.reset(function () {
        return res.redirect('/')
      })
    }) || true
  }).catch(err => {
    // LOGIN FAIL
    if (err.message === 'INVALID_LOGIN') {
      req.flash('alert', {
        title: wiki.lang.t('auth:errors.invalidlogin'),
        message: wiki.lang.t('auth:errors.invalidloginmsg')
      })
      return res.redirect('/login')
    } else {
      req.flash('alert', {
        title: wiki.lang.t('auth:errors.loginerror'),
        message: err.message
      })
      return res.redirect('/login')
    }
  })
})

/**
 * Social Login
 */

router.get('/login/ms', wiki.auth.passport.authenticate('windowslive', { scope: ['wl.signin', 'wl.basic', 'wl.emails'] }))
router.get('/login/google', wiki.auth.passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/login/facebook', wiki.auth.passport.authenticate('facebook', { scope: ['public_profile', 'email'] }))
router.get('/login/github', wiki.auth.passport.authenticate('github', { scope: ['user:email'] }))
router.get('/login/slack', wiki.auth.passport.authenticate('slack', { scope: ['identity.basic', 'identity.email'] }))
router.get('/login/azure', wiki.auth.passport.authenticate('azure_ad_oauth2'))

router.get('/login/ms/callback', wiki.auth.passport.authenticate('windowslive', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/google/callback', wiki.auth.passport.authenticate('google', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/facebook/callback', wiki.auth.passport.authenticate('facebook', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/github/callback', wiki.auth.passport.authenticate('github', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/slack/callback', wiki.auth.passport.authenticate('slack', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/azure/callback', wiki.auth.passport.authenticate('azure_ad_oauth2', { failureRedirect: '/login', successRedirect: '/' }))

/**
 * Logout
 */
router.get('/logout', function (req, res) {
  req.logout()
  res.redirect('/')
})

module.exports = router
