'use strict'

/**
 * Comment schema
 */
module.exports = (sequelize, DataTypes) => {
  let commentSchema = sequelize.define('comment', {
    content: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    timestamps: true,
    version: true
  })

  return commentSchema
}
