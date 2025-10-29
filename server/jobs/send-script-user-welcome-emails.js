/* global WIKI */
const userService = require('../graph/services/userService')

module.exports = async function sendScriptUserWelcomeEmails() {
  // Early exit if mail subsystem clearly not initialized (transport null)
  WIKI.logger.info('Starting sendScriptUserWelcomeEmails JOB...')
  const mailReady = (WIKI.mail && WIKI.mail.transport)
  if (!mailReady) {
    WIKI.logger.warn('Mail subsystem not initialized. Skipping welcome emails batch entirely.')
    return
  }

  const users = await WIKI.models.users.query()
    .where({ welcomeMailWasSent: false, createdByScript: true })

  for (const user of users) {
    try {
      const sent = await userService.sendWelcomeEmail(user)
      if (sent) {
        await WIKI.models.users.query()
          .patch({ welcomeMailWasSent: true })
          .where({ id: user.id })
        WIKI.logger.info(`Welcome email sent to ${user.email}`)
      } else {
        WIKI.logger.warn(`Welcome email NOT sent to ${user.email} (mail subsystem not initialized). Will retry on next run.`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to send welcome email to ${user.email}: ${err.message}`)
    }
  }
}
