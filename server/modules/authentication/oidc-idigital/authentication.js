module.exports = {
  async init (passport, conf) {
    const integration = await import('@fiea-al/idigital-node-integration');

    const client = await integration.IDigital.create({
      scopes: ['openid', 'profile', 'email'],
      postLogoutRedirectUri: conf.postLogoutRedirectUrl,
      applicationHost: conf.applicationHost,
      redirectUri: conf.callbackURL,
      clientId: conf.clientId,
      issuer: conf.issuer
    });

    passport.use(conf.key,
      new integration.IDigitalStrategy(client, async (request, tokenSet, userInfo, done) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: request.params.strategy,
            profile: {
              id: userInfo.sub,
              email: userInfo.email,
              displayName: userInfo.displayName
            }
          });

          done(null, user)
        } catch (err) {
          done(err, null)
        }
      })
    );
  },
  logout (conf) {
    return conf.postLogoutRedirectUrl || '/';
  }
}
