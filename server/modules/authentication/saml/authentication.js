const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// SAML Account
// ------------------------------------

const SAMLStrategy = require('passport-saml').Strategy

module.exports = {
  init (passport, conf) {
    const samlConfig = {
      callbackUrl: conf.callbackURL,
      entryPoint: conf.entryPoint,
      issuer: conf.issuer,
      cert: (conf.cert || '').split('|'),
      signatureAlgorithm: conf.signatureAlgorithm,
      digestAlgorithm: conf.digestAlgorithm,
      identifierFormat: conf.identifierFormat,
      wantAssertionsSigned: conf.wantAssertionsSigned,
      acceptedClockSkewMs: _.toSafeInteger(conf.acceptedClockSkewMs),
      disableRequestedAuthnContext: conf.disableRequestedAuthnContext,
      authnContext: (conf.authnContext || '').split('|'),
      racComparison: conf.racComparison,
      forceAuthn: conf.forceAuthn,
      passive: conf.passive,
      providerName: conf.providerName,
      skipRequestCompression: conf.skipRequestCompression,
      authnRequestBinding: conf.authnRequestBinding,
      passReqToCallback: true
    }
    if (!_.isEmpty(conf.audience)) {
      samlConfig.audience = conf.audience
    }
    if (!_.isEmpty(conf.privateKey)) {
      samlConfig.privateKey = conf.privateKey
    }
    if (!_.isEmpty(conf.decryptionPvk)) {
      samlConfig.decryptionPvk = conf.decryptionPvk
    }
    passport.use(conf.key,
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
