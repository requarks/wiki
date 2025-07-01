
const userService = require('../graph/services/userService')
const userSiteInactivityService = require('../graph/services/userSiteInactivityService')

/* global WIKI */

async function getInactiveForThreeMonthsOrMore() {
  // Calculate the date 90 days ago
  const threeMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString()

  // Query all entries where inactiveSince is older than 3 months
  const inactiveEntries = await WIKI.models.userSiteInactivity.query()
    .where('inactiveSince', '<', threeMonthsAgo)

  return inactiveEntries
}

// Helper to get or create the anonymous user
async function getOrCreateAnonymousUser() {
  let anonymousUser = await WIKI.models.users.query().findOne({ email: 'anonymous@user.com' })
  if (!anonymousUser) {
    anonymousUser = await WIKI.models.users.query().insert({
      provider: 'local',
      email: 'anonymous@user.com',
      name: 'AnonymousUser',
      password: '',
      locale: 'en',
      defaultEditor: 'markdown',
      tfaIsActive: false,
      isSystem: true,
      isActive: true,
      isVerified: true
    })
  }
  return anonymousUser
}

async function anonymizeInactiveUser(entry, anonymousUser) {
  // Check if user was reactivated
  const userIsActiveAgain = await userSiteInactivityService.removedUserSiteInactivityIfReactivated(entry.userId)
  if (userIsActiveAgain) {
    console.log(`User ${entry.userId} was reactivated, skipping anonymization for site ${entry.siteId}`)
    return
  }

  // Anonymize mentions and comments
  const mentionedPages = await WIKI.models.userMentions.getMentionedPages(entry.userId)
  const mentionedComments = await WIKI.models.userMentions.getMentionedComments(entry.userId)
  const userComments = await WIKI.models.comments.query().where('authorId', entry.userId)

  await userService.renderMentionedPages(mentionedPages)
  const user = await WIKI.models.users.query().findById(entry.userId)
  await userService.anonymizeComments(user, mentionedComments, userComments)

  // Anonymize page creator and author
  await WIKI.models.pages.query()
    .where('creatorId', entry.userId)
    .patch({ creatorId: anonymousUser.id })

  await WIKI.models.pages.query()
    .where('authorId', entry.userId)
    .patch({ authorId: anonymousUser.id })

  // Anonymize comments
  await WIKI.models.comments.query()
    .where('authorId', entry.userId)
    .patch({ authorId: anonymousUser.id })

  // Anonymize page history
  await WIKI.models.pageHistory.query()
    .where('authorId', entry.userId)
    .patch({ authorId: anonymousUser.id })

  // Remove inactivity entry
  await WIKI.models.userSiteInactivity.query()
    .delete()
    .where({
      userId: entry.userId,
      siteId: entry.siteId
    })
}

module.exports = async () => {
  const entries = await getInactiveForThreeMonthsOrMore()

  const anonymousUser = await getOrCreateAnonymousUser()

  for (const entry of entries) {
    try {
      await anonymizeInactiveUser(entry, anonymousUser)
    } catch (err) {
      console.error(`Failed to anonymize user ${entry.userId} for site ${entry.siteId}:`, err)
    }
  }
}
