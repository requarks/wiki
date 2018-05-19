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
      WIKI.db.users.query().findById(id).then((user) => {
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
    _.forEach(modules, (strategy) => {
      const strategyConfig = _.get(WIKI.config.auth.strategies, strategy.key, { isEnabled: false })
      strategyConfig.callbackURL = `${WIKI.config.site.host}${WIKI.config.site.path}login/${strategy.key}/callback`
      strategy.config = strategyConfig
      if (strategyConfig.isEnabled) {
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

    return this
  }
}
