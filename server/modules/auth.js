'use strict'

/* global wiki */

const fs = require('fs')

module.exports = function (passport) {
  // Serialization user methods

  passport.serializeUser(function (user, done) {
    done(null, user._id)
  })

  passport.deserializeUser(function (id, done) {
    wiki.db.User.findById(id).then((user) => {
      if (user) {
        done(null, user)
      } else {
        done(new Error(wiki.lang.t('auth:errors:usernotfound')), null)
      }
      return true
    }).catch((err) => {
      done(err, null)
    })
  })

  // Create users for first-time

  return wiki.db.User.findOne({ provider: 'local', email: 'guest@example.com' }).then((c) => {
    if (c < 1) {
      // Create guest account

      return wiki.db.User.create({
        provider: 'local',
        email: 'guest@example.com',
        name: 'Guest',
        password: '',
        role: 'guest'
      }).then(() => {
        wiki.logger.info('[AUTH] Guest account created successfully!')
        return true
      }).catch((err) => {
        wiki.logger.error('[AUTH] An error occured while creating guest account:')
        wiki.logger.error(err)
        return err
      })
    }
  })

  // .then(() => {
  //   if (process.env.WIKI_JS_HEROKU) {
  //     return wiki.db.User.findOne({ provider: 'local', email: process.env.WIKI_ADMIN_EMAIL }).then((c) => {
  //       if (c < 1) {
  //         // Create root admin account (HEROKU ONLY)

  //         return wiki.db.User.create({
  //           provider: 'local',
  //           email: process.env.WIKI_ADMIN_EMAIL,
  //           name: 'Administrator',
  //           password: '$2a$04$MAHRw785Xe/Jd5kcKzr3D.VRZDeomFZu2lius4gGpZZ9cJw7B7Mna', // admin123 (default)
  //           role: 'admin'
  //         }).then(() => {
  //           wiki.logger.info('[AUTH] Root admin account created successfully!')
  //           return true
  //         }).catch((err) => {
  //           wiki.logger.error('[AUTH] An error occured while creating root admin account:')
  //           wiki.logger.error(err)
  //           return err
  //         })
  //       } else { return true }
  //     })
  //   } else { return true }
  // })
}
