/**
 * Document schema
 */
module.exports = (sequelize, DataTypes) => {
  let documentSchema = sequelize.define('setting', {
    path: {
      type: DataTypes.STRING,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [2, 255]
      }
    },
    subtitle: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ''
    },
    parentPath: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ''
    },
    parentTitle: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ''
    },
    isDirectory: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isEntry: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isDraft: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    searchContent: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ''
    }
  }, {
    timestamps: true,
    version: true,
    indexes: [
      {
        unique: true,
        fields: ['path']
      }
    ]
  })

  return documentSchema
}
