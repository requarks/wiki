const _ = require('lodash')
const axios = require('axios')
const bugsnag = require('bugsnag')
const path = require('path')
const uuid = require('uuid/v4')

/* global wiki */

module.exports = {
  cid: '',
  enabled: false,
  init() {
    this.cid = uuid()
    bugsnag.register(wiki.data.telemetry.BUGSNAG_ID, {
      appVersion: wiki.version,
      autoNotify: false,
      hostname: this.cid,
      notifyReleaseStages: ['production'],
      packageJSON: path.join(wiki.ROOTPATH, 'package.json'),
      projectRoot: wiki.ROOTPATH,
      useSSL: true
    })
    bugsnag.onBeforeNotify((notification, originalError) => {
      if (!this.enabled) { return false }
    })

    if (_.get(wiki.config, 'logging.telemetry', false) === true) {
      this.enabled = true
    }

    return this
  },
  sendError(err) {
    bugsnag.notify(err, { userId: this.cid })
  },
  sendEvent(eventCategory, eventAction, eventLabel) {
    if (!this.enabled) { return false }
    axios({
      method: 'post',
      url: wiki.data.telemetry.GA_REMOTE,
      headers: {
        'Content-type': 'application/x-www-form-urlencoded'
      },
      params: {
        v: 1, // API version
        tid: wiki.data.telemetry.GA_ID, // Tracking ID
        aip: 1, // Anonymize IP
        ds: 'server', // Data source
        cid: this.cid, // Client ID
        t: 'event', // Hit Type
        ec: eventCategory, // Event Category
        ea: eventAction, // Event Action
        el: eventLabel // Event Label
      }
    }).then(resp => {
      if (resp.status !== 200) {
        wiki.logger.warn('Unable to send analytics telemetry request.')
      }
    }, err => {
      wiki.logger.warn('Unable to send analytics telemetry request.')
    })
  }
}
