const util = require('node:util')
const crypto = require('node:crypto')
const randomBytes = util.promisify(crypto.randomBytes)
const passportJWT = require('passport-jwt')

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
    return (await randomBytes(length)).toString('hex')
  },

  extractJWT: passportJWT.ExtractJwt.fromExtractors([
    passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
    (req) => {
      let token = null
      if (req && req.cookies) {
        token = req.cookies['jwt']
      }
      // Force uploads to use Auth headers
      if (req.path.toLowerCase() === '/u') {
        return null
      }
      return token
    }
  ])
}
