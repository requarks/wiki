const _ = require('lodash')
const { GraphQLError } = require('graphql')

module.exports = {
  generateSuccess(msg) {
    return {
      succeeded: true,
      errorCode: 0,
      slug: 'ok',
      message: _.defaultTo(msg, 'Operation succeeded.')
    }
  },
  generateError(err, complete = true) {
    const error = {
      succeeded: false,
      errorCode: _.isFinite(err.code) ? err.code : 1,
      slug: err.name,
      message: err.message || 'An unexpected error occured.'
    }
    return complete ? { responseResult: error } : error
  },
  error(message, code, status) {
    return new GraphQLError(message, {
      extensions: {
        code,
        http: { status }
      }
    })
  },
  forbidden(message) {
    return this.error(message, 'FORBIDDEN', 403)
  },
  badRequest(message) {
    return this.error(message, 'BAD_REQUEST', 400)
  }
}
