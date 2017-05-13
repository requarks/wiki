'use strict'

/* global appdata, rights */

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
    if (req.app.locals.appconfig.public !== true) {
      return res.redirect('/login')
    } else {
      req.user = rights.guest
      res.locals.isGuest = true
    }
  } else {
    res.locals.isGuest = false
  }

  // Check permissions

  res.locals.rights = rights.check(req)

  if (!res.locals.rights.read) {
    return res.render('error-forbidden')
  }

  // Expose user data

  res.locals.user = req.user

  return next()
}
