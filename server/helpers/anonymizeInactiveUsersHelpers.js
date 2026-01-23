const userSiteInactivityService = require('../graph/services/userSiteInactivityService')
const { inactivityThresholdISOString } = require('../helpers/dateHelpers')
const userService = require('../graph/services/userService')

/* global WIKI */

async function userWasReactivated(userId) {
  const userIsActiveAgain = await userSiteInactivityService.removedUserSiteInactivityIfReactivated(userId)
  if (userIsActiveAgain) {
    console.log(`User ${userId} was reactivated, skipping anonymization`)
    return true
  }
  return false
}

async function getUser(userId) {
  return WIKI.models.users.query().findById(userId)
}

async function getSitePageIds(siteId) {
  const sitePages = await WIKI.models.pages.query().where({ siteId }).select('id')
  return sitePages.map(page => page.id)
}

async function getMentionedPagesOfSite(userId, sitePageIds) {
  const mentionedPages = await WIKI.models.userMentions.getMentionedPages(userId)
  return mentionedPages.filter(mp => sitePageIds.includes(mp.pageId))
}

async function getMentionedCommentsOfSite(userId, sitePageIds) {
  const mentionedComments = await WIKI.models.userMentions.getMentionedComments(userId)
  return mentionedComments.filter(mc => sitePageIds.includes(mc.pageId))
}

async function getUserCommentsOfSite(userId, sitePageIds) {
  const userComments = await WIKI.models.comments.query().where({ authorId: userId })
  return userComments.filter(comment => sitePageIds.includes(comment.pageId))
}

async function anonymizeAssets(userSiteInactivity, anonymousUser) {
  await WIKI.models.assets.query()
    .where({ authorId: userSiteInactivity.userId, siteId: userSiteInactivity.siteId })
    .patch({ authorId: anonymousUser.id })
}

async function anonymizePageHistory(userSiteInactivity, anonymousUser, user) {
  await WIKI.models.pageHistory.query()
    .where({ authorId: userSiteInactivity.userId, siteId: userSiteInactivity.siteId })
    .patch({ authorId: anonymousUser.id })

  // Also anonymize mentions in page history content
  const sitePageIds = await getSitePageIds(userSiteInactivity.siteId)
  await WIKI.models.pageHistory.anonymizeMentionsByPageIds(
    sitePageIds,
    (content, contentType) => userService.anonymizeUserMentions(content, contentType, user.email),
    user.email
  )
}

async function anonymizePages(userSiteInactivity, anonymousUser, user) {
  // Get all pages where user was author or creator before updating
  const affectedPages = await WIKI.models.pages.query()
    .where(builder => {
      builder.where({ authorId: userSiteInactivity.userId, siteId: userSiteInactivity.siteId })
        .orWhere({ creatorId: userSiteInactivity.userId, siteId: userSiteInactivity.siteId })
    })
    .select('hash')

  // Update database records
  await WIKI.models.pages.query()
    .where({ authorId: userSiteInactivity.userId, siteId: userSiteInactivity.siteId })
    .patch({ authorId: anonymousUser.id })
  await WIKI.models.pages.query()
    .where({ creatorId: userSiteInactivity.userId, siteId: userSiteInactivity.siteId })
    .patch({ creatorId: anonymousUser.id })

  // Anonymize mentions in current page content
  const sitePageIds = await getSitePageIds(userSiteInactivity.siteId)
  await WIKI.models.pages.anonymizeMentionsByPageIds(
    sitePageIds,
    (content, contentType) => userService.anonymizeUserMentions(content, contentType, user.email),
    user.email
  )

  // Invalidate cache for all affected pages to ensure updated user info is reflected
  for (const page of affectedPages) {
    await WIKI.models.pages.deletePageFromCache(page.hash)
    if (WIKI.events && WIKI.events.outbound) {
      WIKI.events.outbound.emit('deletePageFromCache', page.hash)
    }
  }
  // Log completion for privacy compliance
  WIKI.logger.info(`[PRIVACY] Anonymized ${affectedPages.length} pages for user ${userSiteInactivity.userId} on site ${userSiteInactivity.siteId}`)
}

async function removeInactivityEntry(userSiteInactivity) {
  await WIKI.models.userSiteInactivity.query()
    .delete()
    .where({
      userId: userSiteInactivity.userId,
      siteId: userSiteInactivity.siteId
    })
}

async function removeUserMentions(mentionedPagesOfSite, userId) {
  for (const mentionedPage of mentionedPagesOfSite) {
    await WIKI.models.userMentions.query()
      .delete()
      .where({
        userId,
        pageId: mentionedPage.pageId
      })
  }
}

async function getInactiveForThresholdOrMore() {
  const thresholdDate = inactivityThresholdISOString()
  const inactiveEntries = await WIKI.models.userSiteInactivity.query()
    .where('inactiveSince', '<', thresholdDate)
  return inactiveEntries
}

// Helper to get or create the anonymous user
async function retrieveOrCreateAnonymousUser() {
  let anonymousUser = await WIKI.models.users.query().findOne({ email: 'deleted@deleted.deleted' })
  if (!anonymousUser) {
    anonymousUser = await WIKI.models.users.query().insert({
      provider: 'local',
      email: 'deleted@deleted.deleted',
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

module.exports = {
  userWasReactivated,
  getUser,
  getSitePageIds,
  getMentionedPagesOfSite,
  getMentionedCommentsOfSite,
  getUserCommentsOfSite,
  anonymizeAssets,
  anonymizePageHistory,
  anonymizePages,
  removeInactivityEntry,
  removeUserMentions,
  getInactiveForThresholdOrMore,
  retrieveOrCreateAnonymousUser
}
