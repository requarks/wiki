const _ = require('lodash')

module.exports = {
  /**
   * Get default value of type
   *
   * @param {any} Type Primitive Type
   * @returns Default value
   */
  getTypeDefaultValue (Type) {
    if (_.isArray(Type)) {
      return _.head(Type)
    } else {
      return new Type()
    }
  }
}
