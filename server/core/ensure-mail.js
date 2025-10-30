/* global WIKI */
/**
 * Central mail ensure helper. Ensures WIKI.mail is initialized with a working transport.
 * Returns true if transport + send function are available, false otherwise.
 * Optional options: { force: boolean, log: boolean }
 */
module.exports.ensureMail = function ensureMail(opts = {}) {
  const { force = false, log = false } = opts
  const diag = process.env.LOG_MAIL_DIAGNOSTICS === '1'
  try {
    const needsInit = force || !WIKI.mail || !WIKI.mail.transport || typeof WIKI.mail.send !== 'function'
    if (needsInit) {
      if (log || diag) { WIKI.logger?.info?.('[mail][ensure] (re)init requested (force=' + force + ')') }
      WIKI.mail = require('./mail').init()
    }
    const ready = !!(WIKI.mail && WIKI.mail.transport && typeof WIKI.mail.send === 'function')
    if (diag) {
      WIKI.logger?.info?.('[mail][ensure] ready=' + ready + ' host=' + (WIKI.config.mail?.host || ''))
    }
    if (!ready && (log || diag)) {
      const reasons = []
      if (!WIKI.mail) reasons.push('no WIKI.mail')
      else {
        if (!WIKI.mail.transport) reasons.push('no transport')
        if (typeof WIKI.mail.send !== 'function') reasons.push('no send fn')
      }
      if (!WIKI.config.mail?.host) reasons.push('missing host')
      WIKI.logger?.warn?.('[mail][ensure] not ready: ' + reasons.join(', '))
    }
    return ready
  } catch (err) {
    WIKI.logger?.warn?.(`[mail][ensure] failed: ${err.message}`)
    return false
  }
}
