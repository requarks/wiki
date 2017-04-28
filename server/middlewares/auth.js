'use strict'

/* global appdata, rights */

const moment = require('moment-timezone')

/**
 * Authentication middleware
 *
 * @param      {Express Request}   req     Express Request object
 * @param      {Express Response}  res     Express Response object
 * @param      {Function}          next    Next callback function
 * @return     {any}               void
 */
module.exports = (req, res, next) => {
  // Is user authenticated ?

  if (!req.isAuthenticated()) {
    if (!appdata.capabilities.guest || req.app.locals.appconfig.public !== true) {
      return res.redirect('/login')
    } else {
      req.user = rights.guest
      res.locals.isGuest = true
    }
  } else if (appdata.capabilities.guest) {
    res.locals.isGuest = false
  }

  // Check permissions

  if (appdata.capabilities.rights) {
    res.locals.rights = rights.check(req)

    if (!res.locals.rights.read) {
      return res.render('error-forbidden')
    }
  }

  // Set i18n locale

  req.i18n.changeLanguage(req.user.lang)
  res.locals.userMoment = moment
  res.locals.userMoment.locale(req.user.lang)

  // Expose user data

  res.locals.user = req.user

  return next()
}
