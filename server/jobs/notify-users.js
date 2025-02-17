const _ = require('lodash')

/* global WIKI */

module.exports = async ({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event }) => {
  WIKI.logger.info(`Notifying users for page ID ${pageId}...`)

  try {
    const users = await WIKI.models.users.query().whereIn('id', userIds).withGraphFetched('groups').modifyGraph('groups', builder => {
      builder.select('groups.id', 'permissions', 'groups.rules')
    })
    const activeUsers = users.filter(user => user.isActive)

    const recipients = []

    for (const activeUser of activeUsers) {
      const hasReadAccess = WIKI.auth.checkAccess(activeUser, ['read:pages'], {
        path: pagePath,
        siteId: siteId
      })

      if (hasReadAccess) {
        recipients.push(activeUser.email)
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
        subject: `[Page Notification] Page ${eventText.charAt(0).toUpperCase() + eventText.slice(1)}: ${pageTitle}`,
        text: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        data: {
          preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
          pageUrl: `${WIKI.config.host}/${sitePath}`,
          pageTitle: pageTitle,
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
