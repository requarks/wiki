/* global WIKI */

// ------------------------------------
// OAuth2 Account
// ------------------------------------

const jwtParser = require('jsonwebtoken');
const OAuth2Strategy = require('passport-oauth2').Strategy

module.exports = {
  init (passport, conf) {
	var client = new OAuth2Strategy({
        authorizationURL: conf.authorizationURL,
        tokenURL: conf.tokenURL,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, (accessToken, refreshToken, profile, cb) => {
        WIKI.models.users.processProfile({ profile, providerKey: 'oauth2' }).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      });
	client.userProfile = (accessToken, done) => {
			done(null, jwtParser.decode(accessToken));
		};
    passport.use('oauth2', client);
  }
}
