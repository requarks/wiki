
const userService = require('../graph/services/userService')
const userSiteInactivityService = require('../graph/services/userSiteInactivityService')
const { inactivityThresholdISOString } = require('../helpers/dateHelpers')

/* global WIKI */

async function getInactiveForThresholdOrMore() {
  const thresholdDate = inactivityThresholdISOString()
  const inactiveEntries = await WIKI.models.userSiteInactivity.query()
    .where('inactiveSince', '<', thresholdDate)
  return inactiveEntries
}

// Helper to get or create the anonymous user
async function retrieveOrCreateAnonymousUser() {
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
      isVerified: true,
      isLocked: true
    })
  }
  return anonymousUser
}

async function anonymizeInactiveUser(userSiteInactivity, anonymousUser) {
  // Check if user was reactivated
  const userIsActiveAgain = await userSiteInactivityService.removedUserSiteInactivityIfReactivated(userSiteInactivity.userId)
  if (userIsActiveAgain) {
    console.log(`User ${userSiteInactivity.userId} was reactivated, skipping anonymization for site ${userSiteInactivity.siteId}`)
    return
  }

  // Anonymize mentions and comments
  const user = await WIKI.models.users.query().findById(userSiteInactivity.userId)
  const mentionedPages = await WIKI.models.userMentions.getMentionedPages(userSiteInactivity.userId)
  const mentionedComments = await WIKI.models.userMentions.getMentionedComments(userSiteInactivity.userId)

  const sitePages = await WIKI.models.pages.query()
    .where({ siteId: userSiteInactivity.siteId })
    .select('id')
  const sitePageIds = sitePages.map(page => page.id)

  const mentionedPagesOfSite = mentionedPages.filter(mp => sitePageIds.includes(mp.pageId))
  const mentionedCommentsOfSite = mentionedComments.filter(mc => sitePageIds.includes(mc.pageId))

  const userComments = await WIKI.models.comments.query()
    .where({ authorId: userSiteInactivity.userId })
  const commentsOfSite = userComments.filter(comment => sitePageIds.includes(comment.pageId))

  await userService.renderMentionedPages(mentionedPagesOfSite)

  await WIKI.models.assets.query()
    .where({ 'authorId': userSiteInactivity.userId, 'siteId': userSiteInactivity.siteId })
    .patch({ authorId: anonymousUser.id })
  await userService.anonymizeComments(user, mentionedCommentsOfSite, commentsOfSite)
  await WIKI.models.pageHistory.query().delete()
    .where({ 'authorId': userSiteInactivity.userId, 'siteId': userSiteInactivity.siteId })
  await WIKI.models.pages.query()
    .where({ 'authorId': userSiteInactivity.userId, 'siteId': userSiteInactivity.siteId })
    .patch({ authorId: anonymousUser.id })
  await WIKI.models.pages.query()
    .where({ 'creatorId': userSiteInactivity.userId, 'siteId': userSiteInactivity.siteId })
    .patch({ creatorId: anonymousUser.id })

  // Remove inactivity entry
  await WIKI.models.userSiteInactivity.query()
    .delete()
    .where({
      userId: userSiteInactivity.userId,
      siteId: userSiteInactivity.siteId
    })
  await WIKI.models.knex.destroy()
}

module.exports = async () => {
  WIKI.models = require('../core/db').init()
  WIKI.scheduler = require('../core/scheduler').init()
  WIKI.data.commentProviders = require('../models/commentProviders').initProvider()
  await WIKI.configSvc.loadFromDb()
  await WIKI.configSvc.applyFlags()
  const userSiteInactivityResults = await getInactiveForThresholdOrMore()

  const anonymousUser = await retrieveOrCreateAnonymousUser()

  for (const userSiteInactivity of userSiteInactivityResults) {
    try {
      await anonymizeInactiveUser(userSiteInactivity, anonymousUser)
    } catch (err) {
      console.error(`Failed to anonymize user ${userSiteInactivity.userId} for site ${userSiteInactivity.siteId}:`, err)
    }
  }
}
