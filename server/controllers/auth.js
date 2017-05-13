'use strict'

/* global db, lang */

const Promise = require('bluebird')
const express = require('express')
const router = express.Router()
const passport = require('passport')
const ExpressBrute = require('express-brute')
const ExpressBruteMongooseStore = require('express-brute-mongoose')
const moment = require('moment')

/**
 * Setup Express-Brute
 */
const EBstore = new ExpressBruteMongooseStore(db.Bruteforce)
const bruteforce = new ExpressBrute(EBstore, {
  freeRetries: 5,
  minWait: 60 * 1000,
  maxWait: 5 * 60 * 1000,
  refreshTimeoutOnRequest: false,
  failCallback (req, res, next, nextValidRequestDate) {
    req.flash('alert', {
      class: 'error',
      title: lang.t('auth:errors.toomanyattempts'),
      message: lang.t('auth:errors.toomanyattemptsmsg', { time: moment(nextValidRequestDate).fromNow() }),
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
    usr: res.locals.usr
  })
})

router.post('/login', bruteforce.prevent, function (req, res, next) {
  new Promise((resolve, reject) => {
    // [1] LOCAL AUTHENTICATION
    passport.authenticate('local', function (err, user, info) {
      if (err) { return reject(err) }
      if (!user) { return reject(new Error('INVALID_LOGIN')) }
      resolve(user)
    })(req, res, next)
  }).catch({ message: 'INVALID_LOGIN' }, err => {
    if (appconfig.auth.ldap && appconfig.auth.ldap.enabled) {
      // [2] LDAP AUTHENTICATION
      return new Promise((resolve, reject) => {
        passport.authenticate('ldapauth', function (err, user, info) {
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
        title: lang.t('auth:errors.invalidlogin'),
        message: lang.t('auth:errors.invalidloginmsg')
      })
      return res.redirect('/login')
    } else {
      req.flash('alert', {
        title: lang.t('auth:errors.loginerror'),
        message: err.message
      })
      return res.redirect('/login')
    }
  })
})

/**
 * Social Login
 */

router.get('/login/ms', passport.authenticate('windowslive', { scope: ['wl.signin', 'wl.basic', 'wl.emails'] }))
router.get('/login/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/login/facebook', passport.authenticate('facebook', { scope: ['public_profile', 'email'] }))
router.get('/login/github', passport.authenticate('github', { scope: ['user:email'] }))
router.get('/login/slack', passport.authenticate('slack', { scope: ['identity.basic', 'identity.email'] }))
router.get('/login/azure', passport.authenticate('azure_ad_oauth2'))

router.get('/login/ms/callback', passport.authenticate('windowslive', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/google/callback', passport.authenticate('google', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/github/callback', passport.authenticate('github', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/slack/callback', passport.authenticate('slack', { failureRedirect: '/login', successRedirect: '/' }))
router.get('/login/azure/callback', passport.authenticate('azure_ad_oauth2', { failureRedirect: '/login', successRedirect: '/' }))

/**
 * Logout
 */
router.get('/logout', function (req, res) {
  req.logout()
  res.redirect('/')
})

module.exports = router
