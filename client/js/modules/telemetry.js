import uuid from 'uuid/v4'

/* global CONSTANTS, wiki */

export default {
  cid: '',
  init() {
    this.cid = uuid()
  },
  sendEvent() {
    wiki.$http.post(CONSTANTS.TELEMETRY.GA_REMOTE, {
      v: 1, // API version
      tid: CONSTANTS.TELEMETRY.GA_ID, // Tracking ID
      aip: 1, // Anonymize IP
      ds: 'server', // Data source
      t: 'event', // Hit Type
      ec: 'setup', // Event Category
      ea: 'start', // Event Action
      el: 'success', // Event Label
      ev: 1 // Event Value
    }).then(resp => {

    }, err => {
      console.error(err)
    })
  }
}
