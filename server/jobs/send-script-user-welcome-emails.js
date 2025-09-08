/* global WIKI */
const userService = require('../graph/services/userService')

module.exports = async function sendScriptUserWelcomeEmails() {
  const users = await WIKI.models.users.query()
    .where({ welcomeMailWasSent: false, createdByScript: true })

  for (const user of users) {
    try {
      await userService.sendWelcomeEmail(user)
      await WIKI.models.users.query()
        .patch({ welcomeMailWasSent: true })
        .where({ id: user.id })
      WIKI.logger.info(`Welcome email sent to ${user.email}`)
    } catch (err) {
      WIKI.logger.error(`Failed to send welcome email to ${user.email}: ${err.message}`)
    }
  }
}
