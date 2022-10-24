const Strategy = require('./strategy');
const _ = require('lodash');

module.exports = {
  async init (passport, conf) {
    passport.use(conf.key,
      new Strategy({
        authorizationURL: conf.authorizationURL,
        callbackURL: conf.callbackURL,
        clientID: conf.clientId,
        tokenURL: conf.tokenURL,
        passReqToCallback: true,
        scope: 'profile email',
        response_type: 'code',
        issuer: conf.issuer
      }, async (req, iss, sub, profile, cb) => {
        try {
          const email = sub.emails.pop();
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              id: sub.id,
              email: email.value,
              displayName: sub.displayName
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
    return conf.logoutURL ? !conf.logoutURL : '/';
  }
}
