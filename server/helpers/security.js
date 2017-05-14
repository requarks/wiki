'use strict'

/* global appdata, appconfig */

const _ = require('lodash')

module.exports = {
  sanitizeCommitUser (user) {
    let wlist = new RegExp('[^a-zA-Z0-9-_.\',& ' + appdata.regex.cjk + appdata.regex.arabic + ']', 'g')
    return {
      name: _.chain(user.name).replace(wlist, '').trim().value(),
      email: appconfig.git.showUserEmail ? user.email : appconfig.git.serverEmail
    }
  }
}
