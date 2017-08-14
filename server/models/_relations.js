'use strict'

/**
 * Associate DB Model relations
 */
module.exports = db => {
  db.User.belongsToMany(db.Group, { through: 'userGroups' })
  db.Group.belongsToMany(db.User, { through: 'userGroups' })
  db.Group.hasMany(db.Right)
  db.Document.belongsToMany(db.Tag, { through: 'documentTags' })
  db.Tag.belongsToMany(db.Document, { through: 'documentTags' })
  db.File.belongsTo(db.Folder)
  db.Folder.hasMany(db.File)
  db.Comment.belongsTo(db.Document)
  db.Comment.belongsTo(db.User, { as: 'author' })
}
