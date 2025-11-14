const { sanitizer } = require('../../../helpers/sanitizer')

module.exports = {
  async init(input, config) {
    return sanitizer(input, config)
  }
}
