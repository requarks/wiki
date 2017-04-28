'use strict'

/**
 * Flash middleware
 *
 * @param      {Express Request}   req     Express Request object
 * @param      {Express Response}  res     Express Response object
 * @param      {Function}          next    Next callback function
 * @return     {any}               void
 */
module.exports = (req, res, next) => {
  res.locals.appflash = req.flash('alert')

  next()
}
