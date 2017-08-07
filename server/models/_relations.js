'use strict'

/**
 * Associate DB Model relations
 */
module.exports = db => {
  db.User.belongsToMany(db.Group, { through: 'userGroups' })
  db.Group.belongsToMany(db.User, { through: 'userGroups' })
  db.Group.hasMany(db.Right, { as: 'groupRights' })
  db.Document.hasMany(db.Tag, { as: 'documentTags' })
  db.File.belongsTo(db.Folder)
  db.Comment.belongsTo(db.Document)
  db.Comment.belongsTo(db.User, { as: 'author' })
}
