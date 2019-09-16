const _ = require('lodash')
const request = require('request-promise')
const bugsnag = require('@bugsnag/node')
const uuid = require('uuid/v4')
const qs = require('querystring')
const os = require('os')

/* global WIKI */

module.exports = {
  client: null,
  enabled: false,
  init() {
    this.client = bugsnag({
      apiKey: WIKI.data.telemetry.BUGSNAG_ID,
      appType: 'server',
      appVersion: WIKI.version,
      autoNotify: false,
      collectUserIp: false,
      hostname: _.get(WIKI.config, 'telemetry.clientId', uuid()),
      notifyReleaseStages: ['production'],
      releaseStage: WIKI.IS_DEBUG ? 'development' : 'production',
      projectRoot: WIKI.ROOTPATH,
      logger: null,
      beforeSend: (report) => {
        if (!WIKI.telemetry.enabled) { return false }
      }
    })
    WIKI.telemetry = this

    if (_.get(WIKI.config, 'telemetry.isEnabled', false) === true && WIKI.config.offline !== true) {
      this.enabled = true
      this.sendOSInfo()
    }
  },
  sendOSInfo() {
    this.sendBatchEvents([
      {
        eventCategory: 'node-version',
        eventAction: process.version
      },
      {
        eventCategory: 'os-platform',
        eventAction: os.platform()
      },
      {
        eventCategory: 'cpu-cores',
        eventAction: os.cpus().length
      },
      {
        eventCategory: 'db-type',
        eventAction: WIKI.config.db.type
      }
    ])
  },
  sendError(err) {
    this.client.notify(err)
  },
  sendEvent(eventCategory, eventAction, eventLabel) {
    this.sendBatchEvents([{
      eventCategory,
      eventAction,
      eventLabel
    }])
  },
  sendBatchEvents(events) {
    if (!this.enabled || WIKI.IS_DEBUG) { return false }
    request({
      method: 'POST',
      url: WIKI.data.telemetry.GA_REMOTE,
      headers: {
        'Content-type': 'text/plain'
      },
      body: events.map(ev => {
        return qs.stringify({
          v: 1, // API version
          tid: WIKI.data.telemetry.GA_ID, // Tracking ID
          aip: 1, // Anonymize IP
          ds: 'server', // Data source
          cid: WIKI.telemetry.cid, // Client ID
          t: 'event', // Hit Type
          ec: ev.eventCategory, // Event Category
          ea: ev.eventAction, // Event Action
          el: ev.eventLabel // Event Label
        })
      }).join('\n')
    }).then(resp => {
      if (resp.status !== 200) {
        WIKI.logger.warn('Unable to send analytics telemetry request.')
      }
    }, err => {
      WIKI.logger.warn('Unable to send analytics telemetry request.')
    })
  },
  generateClientId() {
    _.set(WIKI.config, 'telemetry.clientId', uuid())
    return WIKI.config.telemetry.clientId
  }
}
