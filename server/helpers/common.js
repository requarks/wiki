const _ = require('lodash')

module.exports = {
  /**
   * Get default value of type
   *
   * @param {any} type primitive type name
   * @returns Default value
   */
  getTypeDefaultValue (type) {
    switch (type.toLowerCase()) {
      case 'string':
        return ''
      case 'number':
        return 0
      case 'boolean':
        return false
    }
  },
  parseModuleProps (props) {
    return _.transform(props, (result, value, key) => {
      let defaultValue = ''
      if (_.isPlainObject(value)) {
        defaultValue = !_.isNil(value.default) ? value.default : this.getTypeDefaultValue(value.type)
      } else {
        defaultValue = this.getTypeDefaultValue(value)
      }
      _.set(result, key, {
        default: defaultValue,
        type: (value.type || value).toLowerCase(),
        title: value.title || _.startCase(key),
        hint: value.hint || false,
        enum: value.enum || false,
        multiline: value.multiline || false,
        order: value.order || 100
      })
      return result
    }, {})
  }
}
