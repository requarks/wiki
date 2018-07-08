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
  }
}
