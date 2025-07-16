
const userService = require('../graph/services/userService')
const {
  getUser,
  getSitePageIds,
  getMentionedPagesOfSite,
  getMentionedCommentsOfSite,
  getUserCommentsOfSite,
  userWasReactivated,
  anonymizeAssets,
  anonymizePageHistory,
  anonymizePages,
  removeInactivityEntry,
  removeUserMentions,
  getInactiveForThresholdOrMore,
  retrieveOrCreateAnonymousUser } = require('../helpers/anonymizeInactiveUsersHelpers')

/* global WIKI */

async function anonymizeInactiveUser(userSiteInactivity, anonymousUser) {
  // Check if user was reactivated
  if (await userWasReactivated(userSiteInactivity.userId)) return

  // Gather all relevant data
  const user = await getUser(userSiteInactivity.userId)
  const sitePageIds = await getSitePageIds(userSiteInactivity.siteId)
  const mentionedPagesOfSite = await getMentionedPagesOfSite(userSiteInactivity.userId, sitePageIds)
  const mentionedCommentsOfSite = await getMentionedCommentsOfSite(userSiteInactivity.userId, sitePageIds)
  const commentsOfSite = await getUserCommentsOfSite(userSiteInactivity.userId, sitePageIds)

  // Render mentioned pages and re-init DB connection
  await userService.renderMentionedPagesWithoutScheduler(mentionedPagesOfSite)
  WIKI.models = require('../core/db').init()

  // Anonymize assets, comments, page history, and pages
  await anonymizeAssets(userSiteInactivity, anonymousUser)
  await userService.anonymizeComments(user, mentionedCommentsOfSite, commentsOfSite, anonymousUser)
  await anonymizePageHistory(userSiteInactivity, anonymousUser, user)
  await anonymizePages(userSiteInactivity, anonymousUser)

  // Remove inactivity entry and user mentions
  await removeInactivityEntry(userSiteInactivity)
  await removeUserMentions(mentionedPagesOfSite, userSiteInactivity.userId)
  await WIKI.models.knex.destroy()
}

module.exports = async () => {
  WIKI.models = require('../core/db').init()
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
