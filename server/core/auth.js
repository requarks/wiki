const passport = require('passport')
const fs = require('fs-extra')
const _ = require('lodash')
const path = require('path')
const NodeCache = require('node-cache')

const userCache = new NodeCache({
  stdTTL: 10,
  checkperiod: 600,
  deleteOnExpire: true
})

/* global WIKI */

module.exports = {
  strategies: {},
  init() {
    this.passport = passport

    // Serialization user methods

    passport.serializeUser(function (user, done) {
      done(null, user.id)
    })

    passport.deserializeUser(function (id, done) {
      const usr = userCache.get(id)
      if (usr) {
        done(null, usr)
      } else {
        WIKI.models.users.query().findById(id).then((user) => {
          if (user) {
            userCache.set(id, user)
            done(null, user)
          } else {
            done(new Error(WIKI.lang.t('auth:errors:usernotfound')), null)
          }
          return true
        }).catch((err) => {
          done(err, null)
        })
      }
    })

    return this
  },
  async activateStrategies() {
    try {
      // Unload any active strategies
      WIKI.auth.strategies = {}
      const currentStrategies = _.keys(passport._strategies)
      _.pull(currentStrategies, 'session')
      _.forEach(currentStrategies, stg => { passport.unuse(stg) })

      // Load enabled strategies
      const enabledStrategies = await WIKI.models.authentication.getStrategies()
      for (let idx in enabledStrategies) {
        const stg = enabledStrategies[idx]
        if (!stg.isEnabled) { continue }

        const strategy = require(`../modules/authentication/${stg.key}/authentication.js`)

        stg.config.callbackURL = `${WIKI.config.host}/login/${stg.key}/callback` // TODO: config.host
        strategy.init(passport, stg.config)

        fs.readFile(path.join(WIKI.ROOTPATH, `assets/svg/auth-icon-${strategy.key}.svg`), 'utf8').then(iconData => {
          strategy.icon = iconData
        }).catch(err => {
          if (err.code === 'ENOENT') {
            strategy.icon = '[missing icon]'
          } else {
            WIKI.logger.warn(err)
          }
        })
        WIKI.auth.strategies[stg.key] = strategy
        WIKI.logger.info(`Authentication Strategy ${stg.title}: [ OK ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Authentication Strategy: [ FAILED ]`)
      WIKI.logger.error(err)
    }
  }
}
