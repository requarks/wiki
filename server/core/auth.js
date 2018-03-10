/* global WIKI */

const _ = require('lodash')
const passport = require('passport')
const fs = require('fs-extra')
const path = require('path')
const autoload = require('auto-load')

module.exports = {
  strategies: {},
  init() {
    this.passport = passport

    // Serialization user methods

    passport.serializeUser(function (user, done) {
      done(null, user.id)
    })

    passport.deserializeUser(function (id, done) {
      WIKI.db.User.findById(id).then((user) => {
        if (user) {
          done(null, user)
        } else {
          done(new Error(WIKI.lang.t('auth:errors:usernotfound')), null)
        }
        return true
      }).catch((err) => {
        done(err, null)
      })
    })

    // Load authentication strategies

    const modules = _.values(autoload(path.join(WIKI.SERVERPATH, 'modules/authentication')))
    console.info(WIKI.config.auth)
    _.forEach(modules, (strategy) => {
      const strategyConfig = _.get(WIKI.config.auth.strategies, strategy.key, {})
      strategyConfig.callbackURL = `${WIKI.config.site.host}${WIKI.config.site.path}login/${strategy.key}/callback`
      if (strategyConfig.isEnabled) {
        console.info(strategy.title)
        try {
          strategy.init(passport, strategyConfig)
        } catch (err) {
          WIKI.logger.error(`Authentication Provider ${strategy.title}: [ FAILED ]`)
          WIKI.logger.error(err)
        }
      }
      fs.readFile(path.join(WIKI.ROOTPATH, `assets/svg/auth-icon-${strategy.key}.svg`), 'utf8').then(iconData => {
        strategy.icon = iconData
      }).catch(err => {
        if (err.code === 'ENOENT') {
          strategy.icon = '[missing icon]'
        } else {
          WIKI.logger.warn(err)
        }
      })
      this.strategies[strategy.key] = strategy
      WIKI.logger.info(`Authentication Provider ${strategy.title}: [ OK ]`)
    })

    // Create Guest account for first-time

    WIKI.db.User.findOne({
      where: {
        provider: 'local',
        email: 'guest@example.com'
      }
    }).then((c) => {
      if (c < 1) {
        return WIKI.db.User.create({
          provider: 'local',
          email: 'guest@example.com',
          name: 'Guest',
          password: '',
          role: 'guest'
        }).then(() => {
          WIKI.logger.info('[AUTH] Guest account created successfully!')
          return true
        }).catch((err) => {
          WIKI.logger.error('[AUTH] An error occured while creating guest account:')
          WIKI.logger.error(err)
          return err
        })
      }
    })

    // .then(() => {
    //   if (process.env.WIKI_JS_HEROKU) {
    //     return WIKI.db.User.findOne({ provider: 'local', email: process.env.WIKI_ADMIN_EMAIL }).then((c) => {
    //       if (c < 1) {
    //         // Create root admin account (HEROKU ONLY)

    //         return WIKI.db.User.create({
    //           provider: 'local',
    //           email: process.env.WIKI_ADMIN_EMAIL,
    //           name: 'Administrator',
    //           password: '$2a$04$MAHRw785Xe/Jd5kcKzr3D.VRZDeomFZu2lius4gGpZZ9cJw7B7Mna', // admin123 (default)
    //           role: 'admin'
    //         }).then(() => {
    //           WIKI.logger.info('[AUTH] Root admin account created successfully!')
    //           return true
    //         }).catch((err) => {
    //           WIKI.logger.error('[AUTH] An error occured while creating root admin account:')
    //           WIKI.logger.error(err)
    //           return err
    //         })
    //       } else { return true }
    //     })
    //   } else { return true }
    // })

    return this
  }
}
