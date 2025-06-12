/* global WIKI */

async function handleUserSiteInactivityAfterUnassign(grp, usr) {
  const groupSites = getSiteIdsFromGroups(grp)
  const userGroups = await WIKI.models.groups.query()
    .join('userGroups', 'groups.id', 'userGroups.groupId')
    .where('userGroups.userId', usr.id)
  const accessibleSiteIds = getSiteIdsFromGroups(userGroups)
  await insertUserSiteInactivityForSites(usr.id, groupSites, accessibleSiteIds)
}

function getSiteIdsFromGroups(groups) {
  const siteIds = new Set();
  (Array.isArray(groups) ? groups : [groups]).forEach(group => {
    group?.rules?.forEach(rule => {
      if (rule.deny === false && Array.isArray(rule.sites)) {
        rule.sites.forEach(siteId => siteIds.add(siteId))
      }
    })
  })
  return siteIds
}

async function insertUserSiteInactivityForSites(userId, sitesToUnassign, sitesUserHasAccessTo) {
  for (const siteId of sitesToUnassign) {
    if (!sitesUserHasAccessTo.has(siteId)) {
      await WIKI.models.userSiteInactivity.query().insert({
        userId: userId,
        siteId: siteId
      })
    }
  }
}

module.exports = {
  handleUserSiteInactivityAfterUnassign
}
