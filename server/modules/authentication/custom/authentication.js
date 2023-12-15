/* global WIKI */

// ------------------------------------
// SREngine
// ------------------------------------

const CustomStrategy = require('passport-custom').Strategy
const axios = require('axios')

module.exports = {
  init(passport, conf) {
    passport.use(conf.key,
      new CustomStrategy(
        async function (req, done) {
          try {
            const { email, password, token } = req.body
            const stg = await WIKI.models.authentication.getStrategy(conf.key)
            const response = await axios.post(stg.config.authURL, {
              'username': email ?? '',
              'password': password ?? '',
              'token': token ?? ''
            }, {
              headers: {
                'Content-Type': 'application/json'
              },
              validateStatus: function (status) {
                return status < 505 // Resolve only if the status code is less than 500
              }
            })
            if (response.status === 200 && response.data && response.data.name && response.data.email) {
              const user = await WIKI.models.users.processProfile({
                providerKey: req.params.strategy,
                profile: {
                  id: response.data.id,
                  name: response.data.name,
                  email: response.data.email,
                  providerKey: req.params.strategy,
                  isSystem: false,
                  isVerified: true,
                  isActive: true
                }
              })
              return done(null, user)
            } else {
              if (response.status === 401) {
                return done(new WIKI.Error.AuthLoginFailed(), null)
              } else {
                return done(null, false) // Authentication failed
              }
            }
          } catch (error) {
            return done(error, null) // An error occurred
          }
        }
      )
    )
  }
}
