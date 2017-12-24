/* global wiki */

/**
 * Authentication middleware
 */
module.exports = (req, res, next) => {
  // Is user authenticated ?

  if (!req.isAuthenticated()) {
    if (wiki.config.auth.public !== true) {
      return res.redirect('/login')
    } else {
      // req.user = rights.guest
      res.locals.isGuest = true
    }
  } else {
    res.locals.isGuest = false
  }

  // Check permissions

  // res.locals.rights = rights.check(req)

  // if (!res.locals.rights.read) {
  //   return res.render('error-forbidden')
  // }

  // Expose user data

  res.locals.user = req.user

  return next()
}
