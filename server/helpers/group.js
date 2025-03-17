const _ = require('lodash')

/* global WIKI */

const managedGroupsToSiteIds = (groups) => {
  let siteIds = []

  for (const groupId of groups) {
    const group = _.get(WIKI.auth.groups, groupId, [])
    if (group.permissions && !group.permissions.includes('manage:sites')) {
      continue
    }
    if (group.rules) {
      for (const rule of group.rules) {
        if (
          rule.deny === false &&
          rule.sites &&
          rule.sites.length > 0 &&
          rule.roles.includes('manage:sites')
        ) {
          siteIds = siteIds.concat(rule.sites)
        }
      }
    }
  }

  siteIds = _.uniq(siteIds)
  return siteIds
}

const extractSiteIdsFromGroupRules = (groups) => {
  let siteIds = []

  for (const groupId of groups) {
    const group = _.get(WIKI.auth.groups, groupId, [])
    if (group.rules) {
      for (const rule of group.rules) {
        if (
          rule.deny === false &&
          rule.sites &&
          rule.sites.length > 0
        ) {
          siteIds = siteIds.concat(rule.sites)
        }
      }
    }
  }

  siteIds = _.uniq(siteIds)
  return siteIds
}

const canManageGroup = (user, groupId) => {
  if (WIKI.auth.isSuperAdmin(user)) return true
  if (groupId === 1 || groupId === 2) return false
  const managedGroupSites = managedGroupsToSiteIds(user.groups)
  const groupSites = extractSiteIdsFromGroupRules([groupId])

  if (managedGroupSites.length > 0 && groupSites.length > 0) {
    if (_.difference(groupSites, managedGroupSites).length === 0) {
      return true
    }
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
  managedGroupsToSiteIds,
  canManageGroup,
  canManageSites
}
