'use strict'

/* global wiki */

const _ = require('lodash')

module.exports = {
  init(passport) {
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

    // Load authentication strategies

    wiki.config.authStrategies = {
      list: _.pickBy(wiki.config.auth, strategy => strategy.enabled),
      socialEnabled: (_.chain(wiki.config.auth).omit('local').filter(['enabled', true]).value().length > 0)
    }

    _.forOwn(wiki.config.authStrategies.list, (strategyConfig, strategyName) => {
      strategyConfig.callbackURL = `${wiki.config.site.host}/login/${strategyName}/callback`
      require(`../authentication/${strategyName}`)(passport, strategyConfig)
      wiki.logger.info(`Authentication Provider ${_.upperFirst(strategyName)}: OK`)
    })

    // Create Guest account for first-time

    return wiki.db.User.findOne({
      where: {
        provider: 'local',
        email: 'guest@example.com'
      }
    }).then((c) => {
      if (c < 1) {
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
}
