/* global WIKI */

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
  req.app.disable('x-powered-by')

  // -> Disable Frame Embedding
  if (WIKI.config.security.securityIframe) {
    res.set('X-Frame-Options', 'deny')
  }

  // -> Re-enable XSS Fitler if disabled
  res.set('X-XSS-Protection', '1; mode=block')

  // -> Disable MIME-sniffing
  res.set('X-Content-Type-Options', 'nosniff')

  // -> Disable IE Compatibility Mode
  res.set('X-UA-Compatible', 'IE=edge')

  // -> Disables referrer header when navigating to a different origin
  if (WIKI.config.security.securityReferrerPolicy) {
    res.set('Referrer-Policy', 'same-origin')
  }

  // -> Enforce HSTS
  if (WIKI.config.security.securityHSTS) {
    res.set('Strict-Transport-Security', `max-age=${WIKI.config.security.securityHSTSDuration}; includeSubDomains`)
  }

  // -> Prevent Open Redirect from user provided URL
  if (WIKI.config.security.securityOpenRedirect) {
    // Strips out all repeating / character in the provided URL
    req.url = req.url.replace(/(\/)(?=\/*\1)/g, '')
  }

  return next()
}
