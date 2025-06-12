/* global WIKI */

const THREE_MONTHS_MS = 1000 * 60 * 60 * 24 * 90

async function handleUserSiteInactivityAfterUnassign(grp, usr) {
  const groupSites = collectAccessibleSiteIds(grp)
  const userGroups = await WIKI.models.groups.query()
    .join('userGroups', 'groups.id', 'userGroups.groupId')
    .where('userGroups.userId', usr.id)
  const accessibleSiteIds = collectAccessibleSiteIds(userGroups)
  await insertUserSiteInactivityForSites(usr.id, groupSites, accessibleSiteIds)
}

function collectAccessibleSiteIds(groups) {
  const accessibleSiteIds = new Set()
  const groupArray = Array.isArray(groups) ? groups : [groups]
  for (const group of groupArray) {
    if (group?.rules) {
      addAccessibleSitesFromRules(group.rules, accessibleSiteIds)
    }
  }
  return accessibleSiteIds
}

function addAccessibleSitesFromRules(rules, accessibleSiteIds) {
  rules
    .filter(rule => rule.deny === false && rule.sites)
    .flatMap(rule => rule.sites)
    .filter(Boolean)
    .forEach(siteId => accessibleSiteIds.add(siteId))
}

async function insertUserSiteInactivityForSites(userId, groupSites, accessibleSiteIds) {
  for (const siteId of groupSites) {
    if (!accessibleSiteIds.has(siteId)) {
      await WIKI.models.userSiteInactivity.query().insert({
        userId: userId,
        siteId: siteId
      })
    }
  }
}

async function removeUserSiteInactivityIfReactivated(userId, grp) {
  const groupSites = collectAccessibleSiteIds(grp)
  const userGroups = await WIKI.models.groups.query()
    .join('userGroups', 'groups.id', 'userGroups.groupId')
    .where('userGroups.userId', userId)
  const accessibleSiteIds = collectAccessibleSiteIds(userGroups)

  let result = 'no_action'
  for (const siteId of groupSites) {
    if (accessibleSiteIds.has(siteId)) {
      await WIKI.models.userSiteInactivity.query()
        .delete()
        .where({ userId, siteId })
    } else {
      const inactivity = await WIKI.models.userSiteInactivity.query()
        .findOne({ userId, siteId })
      if (inactivity?.inactiveSince) {
        const inactiveSince = new Date(inactivity.inactiveSince)
        if (Date.now() - inactiveSince.getTime() > THREE_MONTHS_MS) {
          // call anonymization logic
          result = 'anonymized'
        }
      }
    }
  }
  return result
}

module.exports = {
  handleUserSiteInactivityAfterUnassign,
  removeUserSiteInactivityIfReactivated
}
