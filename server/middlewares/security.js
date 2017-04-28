'use strict'

/* global app */

/**
 * Security Middleware
 *
 * @param      {Express Request}   req     Express request object
 * @param      {Express Response}  res     Express response object
 * @param      {Function}          next    next callback function
 * @return     {any}               void
 */
module.exports = function (req, res, next) {
  // -> Disable X-Powered-By
  app.disable('x-powered-by')

  // -> Disable Frame Embedding
  res.set('X-Frame-Options', 'deny')

  // -> Re-enable XSS Fitler if disabled
  res.set('X-XSS-Protection', '1; mode=block')

  // -> Disable MIME-sniffing
  res.set('X-Content-Type-Options', 'nosniff')

  // -> Disable IE Compatibility Mode
  res.set('X-UA-Compatible', 'IE=edge')

  return next()
}
