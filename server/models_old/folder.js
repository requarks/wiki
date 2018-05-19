/**
 * Folder schema
 */
module.exports = (sequelize, DataTypes) => {
  let folderSchema = sequelize.define('folder', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    timestamps: true,
    version: true,
    indexes: [
      {
        unique: true,
        fields: ['name']
      }
    ]
  })

  return folderSchema
}
