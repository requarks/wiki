const _ = require('lodash')

/* global WIKI */

const DEFAULT_ADMINISTRATORS_GROUP = 1
const DEFAULT_GUESTS_GROUP = 2

const getManagedSiteIdsFromGroups = (groups) => {
  let siteIds = []

  for (const groupId of groups) {
    const group = _.get(WIKI.auth.groups, groupId, [])
    if (!group.permissions?.includes('manage:sites')) {
      continue
    }
    if (group.rules) {
      for (const rule of group.rules) {
        if (
          rule.deny === false &&
          rule.sites?.length > 0 &&
          rule.roles.includes('manage:sites')
        ) {
          siteIds = siteIds.concat(rule.sites)
        }
      }
    }
  }

  return _.uniq(siteIds)
}

const getSiteIdsFromGroup = (groupId) => {
  let siteIds = []

  const group = _.get(WIKI.auth.groups, groupId, [])
  if (group.rules) {
    for (const rule of group.rules) {
      if (
        rule.deny === false && rule.sites?.length > 0
      ) {
        siteIds = siteIds.concat(rule.sites)
      }
    }
  }

  return _.uniq(siteIds)
}

const canManageGroup = (user, groupId) => {
  if (WIKI.auth.isSuperAdmin(user)) return true
  if (groupId === DEFAULT_ADMINISTRATORS_GROUP || groupId === DEFAULT_GUESTS_GROUP) return false
  const managedSiteIds = getManagedSiteIdsFromGroups(user.groups)
  const groupSiteIds = getSiteIdsFromGroup(groupId)

  if (managedSiteIds.length > 0 && groupSiteIds.length > 0) {
    return _.difference(groupSiteIds, managedSiteIds).length === 0
  }

  return false
}

const canManageSites = (g) => {
  if (_.intersection(g.permissions, ['manage:sites']).length < 1) {
    return false
  }

  for (const rule of g.rules) {
    if (_.intersection(rule.roles, ['manage:sites']).length > 0) {
      return true
    }
  }

  return false
}

module.exports = {
  getManagedSiteIdsFromGroups,
  canManageGroup,
  canManageSites,
  DEFAULT_ADMINISTRATORS_GROUP,
  DEFAULT_GUESTS_GROUP
}
