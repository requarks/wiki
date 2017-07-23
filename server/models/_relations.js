'use strict'

/**
 * Associate DB Model relations
 */
module.exports = db => {
  db.User.belongsToMany(db.Group, { through: 'UserGroups' })
  db.Group.hasMany(db.Right, { as: 'GroupRights' })
  db.File.belongsTo(db.Folder)
}
