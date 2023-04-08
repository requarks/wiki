import util from 'node:util'
import crypto from 'node:crypto'
import passportJWT from 'passport-jwt'

const randomBytes = util.promisify(crypto.randomBytes)

export function sanitizeCommitUser (user) {
  // let wlist = new RegExp('[^a-zA-Z0-9-_.\',& ' + appdata.regex.cjk + appdata.regex.arabic + ']', 'g')
  // return {
  //   name: _.chain(user.name).replace(wlist, '').trim().value(),
  //   email: appconfig.git.showUserEmail ? user.email : appconfig.git.serverEmail
  // }
}

/**
 * Generate a random token
 *
 * @param {any} length
 * @returns
 */
export async function generateToken (length) {
  return (await randomBytes(length)).toString('hex')
}

export const extractJWT = passportJWT.ExtractJwt.fromExtractors([
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
