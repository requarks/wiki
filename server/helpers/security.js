const Promise = require('bluebird')
const crypto = require('crypto')

module.exports = {
  sanitizeCommitUser (user) {
    // let wlist = new RegExp('[^a-zA-Z0-9-_.\',& ' + appdata.regex.cjk + appdata.regex.arabic + ']', 'g')
    // return {
    //   name: _.chain(user.name).replace(wlist, '').trim().value(),
    //   email: appconfig.git.showUserEmail ? user.email : appconfig.git.serverEmail
    // }
  },
  /**
   * Generate a random token
   *
   * @param {any} length
   * @returns
   */
  async generateToken (length) {
    return Promise.fromCallback(clb => {
      crypto.randomBytes(length, clb)
    }).then(buf => {
      return buf.toString('hex')
    })
  }
}
