/**
 * Right schema
 */
module.exports = (sequelize, DataTypes) => {
  let rightSchema = sequelize.define('right', {
    path: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('read', 'write', 'manage'),
      allowNull: false,
      defaultValue: 'read'
    },
    exact: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    allow: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    timestamps: true,
    version: true,
    indexes: [
      {
        fields: ['path']
      }
    ]
  })

  return rightSchema
}
