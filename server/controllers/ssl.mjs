import express from 'express'
import { get } from 'lodash-es'
import qs from 'querystring'

export default function () {
  const router = express.Router()

  /**
   * Let's Encrypt Challenge
   */
  router.get('/.well-known/acme-challenge/:token', (req, res, next) => {
    res.type('text/plain')
    if (get(WIKI.config, 'letsencrypt.challenge', false)) {
      if (WIKI.config.letsencrypt.challenge.token === req.params.token) {
        res.send(WIKI.config.letsencrypt.challenge.keyAuthorization)
        WIKI.logger.info(`(LETSENCRYPT) Received valid challenge request. [ ACCEPTED ]`)
      } else {
        res.status(406).send('Invalid Challenge Token!')
        WIKI.logger.warn(`(LETSENCRYPT) Received invalid challenge request. [ REJECTED ]`)
      }
    } else {
      res.status(418).end()
    }
  })

  /**
   * Redirect to HTTPS if HTTP Redirection is enabled
   */
  // router.all('/*', (req, res, next) => {
  //   if (WIKI.config.server.sslRedir && !req.secure && WIKI.servers.servers.https) {
  //     let query = (!_.isEmpty(req.query)) ? `?${qs.stringify(req.query)}` : ``
  //     return res.redirect(`https://${req.hostname}${req.originalUrl}${query}`)
  //   } else {
  //     next()
  //   }
  // })

  return router
}
