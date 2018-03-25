/**
 * Settings schema
 */
module.exports = (sequelize, DataTypes) => {
  let settingSchema = sequelize.define('setting', {
    key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    config: {
      type: DataTypes.JSON,
      allowNull: false
    }
  }, {
    timestamps: true,
    version: true,
    indexes: [
      {
        unique: true,
        fields: ['key']
      }
    ]
  })

  return settingSchema
}
