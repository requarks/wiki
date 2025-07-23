const _ = require('lodash')
const userService = require('../graph/services/userService')

/* global WIKI */

module.exports = async ({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText }) => {
  WIKI.logger.info(`Notifying users for page ID ${pageId}...`)

  try {
    const users = await WIKI.models.users.query().whereIn('id', userIds).withGraphFetched('groups').modifyGraph('groups', builder => {
      builder.select('groups.id', 'permissions', 'groups.rules')
    })
    const activeUsers = users.filter(user => user.isActive)

    const recipients = []

    // Get allowed domains from configuration
    const allowedDomains = WIKI.config.mail.allowedDomains ? WIKI.config.mail.allowedDomains.split(',').map(domain => domain.trim()) : []

    for (const activeUser of activeUsers) {
      const hasReadAccess = WIKI.auth.checkAccess(activeUser, ['read:pages'], {
        path: pagePath,
        siteId: siteId
      })

      if (hasReadAccess) {
        const userDomain = activeUser.email.split('@')[1]
        if (allowedDomains.length === 0 || allowedDomains.includes(userDomain)) {
          recipients.push(activeUser.email)
        }
      }
    }

    const eventText = event.replace('_PAGE', '').toLowerCase() + 'd'
    const isDeletion = event === 'DELETE_PAGE'

    const batches = _.chunk(recipients, 10)
    for (const batch of batches) {
      await WIKI.mail.send({
        template: 'page-notify',
        to: '',
        bcc: batch,
        subject: `[CapWiki] ${subjectText}: ${pageTitle}`,
        data: {
          preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
          pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
          pageTitle: pageTitle,
          mailLogoSrc: userService.getMailLogoSource(),
          userEmail: userEmail,
          event: event,
          eventText: eventText,
          isDeletion: isDeletion
        }
      })
    }

    WIKI.logger.info(`Successfully notified users for page ID ${pageId}`)
  } catch (err) {
    WIKI.logger.warn(err)
  }
}
