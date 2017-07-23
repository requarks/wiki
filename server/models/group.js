'use strict'

/**
 * Group schema
 */
module.exports = (sequelize, DataTypes) => {
  let groupSchema = sequelize.define('group', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    timestamps: true,
    version: true
  })

  return groupSchema
}
