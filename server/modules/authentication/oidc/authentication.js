const _ = require('lodash')

// ------------------------------------
// OpenID Connect Account
// ------------------------------------

const OpenIDConnectStrategy = require('passport-openidconnect').Strategy

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new OpenIDConnectStrategy({
        authorizationURL: conf.authorizationURL,
        tokenURL: conf.tokenURL,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        issuer: conf.issuer,
        userInfoURL: conf.userInfoURL,
        callbackURL: conf.callbackURL,
        passReqToCallback: true,
        skipUserProfile: false,
        store: new (class {
          store(req, ctx, appState, meta, cb) { cb(null, ctx.state || 'state') }
          verify(req, providedState, cb) { cb(null, true) }
        })()
      }, async (req, iss, uiProfile, idProfile, context, idToken, accessToken, refreshToken, params, cb) => {
        const profile = uiProfile || idProfile || {}
        try {
          // passport-openidconnect may not populate profile properly
          // Fetch user info manually using the access token
          const https = require('https')
          const url = require('url')

          const fetchUserInfo = (infoUrl, token) => new Promise((resolve, reject) => {
            const parsed = url.parse(infoUrl)
            const opts = { hostname: parsed.hostname, path: parsed.path, port: parsed.port || 443, headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' } }
            https.get(opts, (res) => {
              let data = ''
              res.on('data', chunk => data += chunk)
              res.on('end', () => { try { resolve(JSON.parse(data)) } catch(e) { reject(e) } })
            }).on('error', reject)
          })

          // Try userinfo endpoint first, then GitLab API
          let userInfo = {}
          try {
            userInfo = await fetchUserInfo(conf.userInfoURL, accessToken)
          } catch(e) {
            WIKI.logger.warn('OIDC userinfo fetch failed: ' + e.message)
          }

          // Fallback to GitLab API if no email
          if (!userInfo.email && conf.baseUrl) {
            try {
              userInfo = await fetchUserInfo(conf.baseUrl + '/api/v4/user', accessToken)
            } catch(e) {
              WIKI.logger.warn('GitLab API user fetch failed: ' + e.message)
            }
          }

          const email = userInfo.email || _.get(profile, '_json.email') || _.get(profile, 'email')
          const displayName = userInfo.name || userInfo.username || _.get(profile, 'displayName') || ''

          WIKI.logger.info('OIDC user: ' + JSON.stringify({ email, name: displayName, username: userInfo.username }))

          const user = await WIKI.db.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              id: userInfo.id || profile.id || sub,
              email: email,
              displayName: displayName
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  },
  logout (conf) {
    if (!conf.logoutURL) {
      return '/'
    } else {
      return conf.logoutURL
    }
  }
}
