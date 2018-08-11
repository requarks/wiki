/* global WIKI */

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
  client: WIKI.redis
})
const bruteforce = new ExpressBrute(EBstore, {
  freeRetries: 5,
  minWait: 60 * 1000,
  maxWait: 5 * 60 * 1000,
  refreshTimeoutOnRequest: false,
  failCallback (req, res, next, nextValidRequestDate) {
    req.flash('alert', {
      class: 'error',
      title: WIKI.lang.t('auth:errors.toomanyattempts'),
      message: WIKI.lang.t('auth:errors.toomanyattemptsmsg', { time: moment(nextValidRequestDate).fromNow() }),
      iconClass: 'fa-times'
    })
    res.redirect('/login')
  }
})

/**
 * Login form
 */
router.get('/login', function (req, res, next) {
  res.render('login')
})

router.post('/login', bruteforce.prevent, function (req, res, next) {
  new Promise((resolve, reject) => {
    // [1] LOCAL AUTHENTICATION
    WIKI.auth.passport.authenticate('local', function (err, user, info) {
      if (err) { return reject(err) }
      if (!user) { return reject(new Error('INVALID_LOGIN')) }
      resolve(user)
    })(req, res, next)
  }).catch({ message: 'INVALID_LOGIN' }, err => {
    if (_.has(WIKI.config.auth.strategy, 'ldap')) {
      // [2] LDAP AUTHENTICATION
      return new Promise((resolve, reject) => {
        WIKI.auth.passport.authenticate('ldapauth', function (err, user, info) {
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
        title: WIKI.lang.t('auth:errors.invalidlogin'),
        message: WIKI.lang.t('auth:errors.invalidloginmsg')
      })
      return res.redirect('/login')
    } else {
      req.flash('alert', {
        title: WIKI.lang.t('auth:errors.loginerror'),
        message: err.message
      })
      return res.redirect('/login')
    }
  })
})

/**
 * Social Login
 */

router.get('/login/ms', WIKI.auth.passport.authenticate('windowslive', { scope: ['wl.signin', 'wl.basic', 'wl.emails'] }))
router.get('/login/google', WIKI.auth.passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/login/facebook', WIKI.auth.passport.authenticate('facebook', { scope: ['public_profile', 'email'] }))
router.get('/login/github', WIKI.auth.passport.authenticate('github', { scope: ['user:email'] }))
router.get('/login/slack', WIKI.auth.passport.authenticate('slack', { scope: ['identity.basic', 'identity.email'] }))
router.get('/login/azure', WIKI.auth.passport.authenticate('azure_ad_oauth2'))

router.get('/login/ms/callback', WIKI.auth.passport.authenticate('windowslive', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/google/callback', WIKI.auth.passport.authenticate('google', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/facebook/callback', WIKI.auth.passport.authenticate('facebook', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/github/callback', WIKI.auth.passport.authenticate('github', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/slack/callback', WIKI.auth.passport.authenticate('slack', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/azure/callback', WIKI.auth.passport.authenticate('azure_ad_oauth2', { failureRedirect: '/login', successRedirect: '/' }))

/**
 * Logout
 */
router.get('/logout', function (req, res) {
  req.logout()
  res.redirect('/')
})

module.exports = router
