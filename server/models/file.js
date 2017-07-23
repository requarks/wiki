'use strict'

/**
 * File schema
 */
module.exports = (sequelize, DataTypes) => {
  let fileSchema = sequelize.define('file', {
    category: {
      type: DataTypes.ENUM('binary', 'image'),
      allowNull: false,
      defaultValue: 'binary'
    },
    mime: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'application/octet-stream'
    },
    extra: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    basename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filesize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: true,
        min: 0
      }
    }
  }, {
    timestamps: true,
    version: true
  })

  return fileSchema
}
