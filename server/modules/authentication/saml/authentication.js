const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// SAML Account
// ------------------------------------

const SAMLStrategy = require('passport-saml').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('saml',
      new SAMLStrategy({
        callbackURL: conf.callbackURL,
        entryPoint: conf.entryPoint,
        issuer: conf.issuer,
        audience: conf.audience,
        cert: _.split(conf.cert, '|'),
        privateCert: conf.privateCert,
        decryptionPvk: conf.decryptionPvk,
        signatureAlgorithm: conf.signatureAlgorithm,
        identifierFormat: conf.identifierFormat,
        acceptedClockSkewMs: _.toSafeInteger(conf.acceptedClockSkewMs),
        disableRequestedAuthnContext: conf.disableRequestedAuthnContext,
        authnContext: conf.authnContext,
        forceAuthn: conf.forceAuthn,
        providerName: conf.providerName,
        skipRequestCompression: conf.skipRequestCompression,
        authnRequestBinding: conf.authnRequestBinding
      }, (profile, cb) => {
        WIKI.models.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      })
    )
  }
}
