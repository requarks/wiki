const ACME = require('acme')
const Keypairs = require('@root/keypairs')
const _ = require('lodash')
const moment = require('moment')
const CSR = require('@root/csr')
const PEM = require('@root/pem')
// eslint-disable-next-line node/no-deprecated-api
const punycode = require('punycode')

/* global WIKI */

module.exports = {
  apiDirectory: WIKI.dev ? 'https://acme-staging-v02.api.letsencrypt.org/directory' : 'https://acme-v02.api.letsencrypt.org/directory',
  acme: null,
  async init () {
    if (!_.get(WIKI.config, 'letsencrypt.payload', false)) {
      await this.requestCertificate()
    } else if (WIKI.config.letsencrypt.domain !== WIKI.config.ssl.domain) {
      WIKI.logger.info(`(LETSENCRYPT) Domain has changed. Requesting new certificates...`)
      await this.requestCertificate()
    } else if (moment(WIKI.config.letsencrypt.payload.expires).isSameOrBefore(moment().add(5, 'days'))) {
      WIKI.logger.info(`(LETSENCRYPT) Certificate is about to or has expired, requesting a new one...`)
      await this.requestCertificate()
    } else {
      WIKI.logger.info(`(LETSENCRYPT) Using existing certificate for ${WIKI.config.ssl.domain}, expires on ${WIKI.config.letsencrypt.payload.expires}: [ OK ]`)
    }
    WIKI.config.ssl.format = 'pem'
    WIKI.config.ssl.inline = true
    WIKI.config.ssl.key = WIKI.config.letsencrypt.serverKey
    WIKI.config.ssl.cert = WIKI.config.letsencrypt.payload.cert + '\n' + WIKI.config.letsencrypt.payload.chain
    WIKI.config.ssl.passphrase = null
    WIKI.config.ssl.dhparam = null
  },
  async requestCertificate () {
    try {
      WIKI.logger.info(`(LETSENCRYPT) Initializing Let's Encrypt client...`)
      this.acme = ACME.create({
        maintainerEmail: WIKI.config.maintainerEmail,
        packageAgent: `wikijs/${WIKI.version}`,
        notify: (ev, msg) => {
          if (_.includes(['warning', 'error'], ev)) {
            WIKI.logger.warn(`${ev}: ${msg}`)
          } else {
            WIKI.logger.debug(`${ev}: ${JSON.stringify(msg)}`)
          }
        }
      })

      await this.acme.init(this.apiDirectory)

      // -> Create ACME Subscriber account

      if (!_.get(WIKI.config, 'letsencrypt.account', false)) {
        WIKI.logger.info(`(LETSENCRYPT) Setting up account for the first time...`)
        const accountKeypair = await Keypairs.generate({ kty: 'EC', format: 'jwk' })
        const account = await this.acme.accounts.create({
          subscriberEmail: WIKI.config.ssl.subscriberEmail,
          agreeToTerms: true,
          accountKey: accountKeypair.private
        })
        WIKI.config.letsencrypt = {
          accountKeypair: accountKeypair,
          account: account,
          domain: WIKI.config.ssl.domain
        }
        await WIKI.configSvc.saveToDb(['letsencrypt'])
        WIKI.logger.info(`(LETSENCRYPT) Account was setup successfully [ OK ]`)
      }

      // -> Create Server Keypair

      if (!WIKI.config.letsencrypt.serverKey) {
        WIKI.logger.info(`(LETSENCRYPT) Generating server keypairs...`)
        const serverKeypair = await Keypairs.generate({ kty: 'RSA', format: 'jwk' })
        WIKI.config.letsencrypt.serverKey = await Keypairs.export({ jwk: serverKeypair.private })
        WIKI.logger.info(`(LETSENCRYPT) Server keypairs generated successfully [ OK ]`)
      }

      // -> Create CSR

      WIKI.logger.info(`(LETSENCRYPT) Generating certificate signing request (CSR)...`)
      const domains = [ punycode.toASCII(WIKI.config.ssl.domain) ]
      const serverKey = await Keypairs.import({ pem: WIKI.config.letsencrypt.serverKey })
      const csrDer = await CSR.csr({ jwk: serverKey, domains, encoding: 'der' })
      const csr = PEM.packBlock({ type: 'CERTIFICATE REQUEST', bytes: csrDer })
      WIKI.logger.info(`(LETSENCRYPT) CSR generated successfully [ OK ]`)

      // -> Verify Domain + Get Certificate

      WIKI.logger.info(`(LETSENCRYPT) Requesting certificate from Let's Encrypt...`)
      const certResp = await this.acme.certificates.create({
        account: WIKI.config.letsencrypt.account,
        accountKey: WIKI.config.letsencrypt.accountKeypair.private,
        csr,
        domains,
        challenges: {
          'http-01': {
            init () {},
            set (data) {
              WIKI.logger.info(`(LETSENCRYPT) Setting HTTP challenge for ${data.challenge.hostname}: [ READY ]`)
              WIKI.config.letsencrypt.challenge = data.challenge
              WIKI.logger.info(`(LETSENCRYPT) Waiting for challenge to complete...`)
              return null // <- this is needed, cannot be undefined
            },
            get (data) {
              return WIKI.config.letsencrypt.challenge
            },
            async remove (data) {
              WIKI.logger.info(`(LETSENCRYPT) Removing HTTP challenge: [ OK ]`)
              WIKI.config.letsencrypt.challenge = null
              return null // <- this is needed, cannot be undefined
            }
          }
        }
      })
      WIKI.logger.info(`(LETSENCRYPT) New certificate received successfully: [ COMPLETED ]`)
      WIKI.config.letsencrypt.payload = certResp
      WIKI.config.letsencrypt.domain = WIKI.config.ssl.domain
      await WIKI.configSvc.saveToDb(['letsencrypt'])
    } catch (err) {
      WIKI.logger.warn(`(LETSENCRYPT) ${err}`)
      throw err
    }
  }
}
