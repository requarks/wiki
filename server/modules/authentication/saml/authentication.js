const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// SAML Account
// ------------------------------------

const SAMLStrategy = require('passport-saml').Strategy

module.exports = {
  init (passport, conf) {
    let samlConfig = {
      callbackUrl: conf.callbackURL,
      entryPoint: conf.entryPoint,
      issuer: conf.issuer,
      signatureAlgorithm: conf.signatureAlgorithm,
      identifierFormat: conf.identifierFormat,
      acceptedClockSkewMs: _.toSafeInteger(conf.acceptedClockSkewMs),
      disableRequestedAuthnContext: conf.disableRequestedAuthnContext,
      authnContext: conf.authnContext,
      forceAuthn: conf.forceAuthn,
      providerName: conf.providerName,
      skipRequestCompression: conf.skipRequestCompression,
      authnRequestBinding: conf.authnRequestBinding,
      passReqToCallback: true
    }
    if (!_.isEmpty(conf.audience)) {
      samlConfig.audience = conf.audience
    }
    if (!_.isEmpty(conf.cert)) {
      samlConfig.cert = _.split(conf.cert, '|')
    }
    if (!_.isEmpty(conf.privateCert)) {
      samlConfig.privateCert = conf.privateCert
    }
    if (!_.isEmpty(conf.decryptionPvk)) {
      samlConfig.decryptionPvk = conf.decryptionPvk
    }
    passport.use('saml',
      new SAMLStrategy(samlConfig, async (req, profile, cb) => {
        try {
          const userId = _.get(profile, [conf.mappingUID], null) || _.get(profile, 'nameID', null)
          if (!userId) {
            throw new Error('Invalid or Missing Unique ID field!')
          }

          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              id: userId,
              email: _.get(profile, conf.mappingEmail, ''),
              displayName: _.get(profile, conf.mappingDisplayName, '???'),
              picture: _.get(profile, conf.mappingPicture, '')
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  }
}
