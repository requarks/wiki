/**
 * Tags schema
 */
module.exports = (sequelize, DataTypes) => {
  let tagSchema = sequelize.define('tag', {
    key: {
      type: DataTypes.STRING,
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

  return tagSchema
}
