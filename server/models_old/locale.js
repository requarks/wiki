/**
 * Locale schema
 */
module.exports = (sequelize, DataTypes) => {
  let localeSchema = sequelize.define('locale', {
    code: {
      type: DataTypes.STRING,
      allowNull: false
    },
    strings: {
      type: DataTypes.JSON,
      allowNull: true
    },
    isRTL: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nativeName: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    timestamps: true,
    version: true,
    indexes: [
      {
        unique: true,
        fields: ['code']
      }
    ]
  })

  return localeSchema
}
