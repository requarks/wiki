const _ = require('lodash')

/* global WIKI */

/**
 * SEO Middleware
 *
 * @param      {Express Request}   req     Express request object
 * @param      {Express Response}  res     Express response object
 * @param      {Function}          next    next callback function
 * @return     {any}               void
 */
module.exports = function (req, res, next) {
  if (req.path.length > 1 && _.endsWith(req.path, '/')) {
    let query = req.url.slice(req.path.length) || ''
    res.redirect(301, req.path.slice(0, -1) + query)
  } else {
    _.set(res.locals, 'pageMeta.url', `${WIKI.config.host}${req.path}`)
    return next()
  }
}
