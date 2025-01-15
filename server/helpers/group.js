const _ = require('lodash')

/* global WIKI */

const rulesToSites = (rules) => {
  let siteIds = []

  for (const rule of rules) {
    if (
      rule.deny === false &&
      rule.sites &&
      rule.sites.length > 0 &&
      rule.roles.includes('manage:sites')
    ) {
      siteIds = siteIds.concat(rule.sites)
    }
  }

  siteIds = _.uniq(siteIds)
  return siteIds
}

const groupsToSites = (groups) => {
  let siteIds = []

  for (const groupId of groups) {
    const group = _.get(WIKI.auth.groups, groupId, [])
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

const rulesToSitesNonAdmin = (rules) => {
  let siteIds = []

  for (const rule of rules) {
    if (
      rule.deny === false &&
      rule.sites &&
      rule.sites.length > 0
    ) {
      siteIds = siteIds.concat(rule.sites)
    }
  }

  siteIds = _.uniq(siteIds)
  return siteIds
}

const rulesToSitesAdmin = (rules) => {
  let siteIds = []

  for (const rule of rules) {
    if (
      rule.deny === false &&
      rule.sites &&
      rule.sites.length > 0 &&
      rule.roles.includes('manage:sites')
    ) {
      siteIds = siteIds.concat(rule.sites)
    }
  }

  siteIds = _.uniq(siteIds)
  return siteIds
}

const isGroupParticipant = (user, groupIds) => {
  return _.intersection(user.groups, groupIds).length > 0
}

const canManageGroup = (user, groupId) => {
  if (WIKI.auth.isSuperAdmin(user)) return true
  if (groupId === 1 || groupId === 2) return false
  const userSites = groupsToSites(user.groups)
  const group = _.get(WIKI.auth.groups, groupId, [])
  const groupSites = rulesToSitesAdmin(group.rules)

  if (_.isEqual(userSites, groupSites)) {
    return true
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
  rulesToSites,
  groupsToSites,
  rulesToSitesNonAdmin,
  rulesToSitesAdmin,
  isGroupParticipant,
  canManageGroup,
  canManageSites
}