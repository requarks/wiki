const { rateLimitDirective } = require('graphql-rate-limit-directive')

module.exports = rateLimitDirective({
  keyGenerator: (directiveArgs, source, args, context, info) => `${context.req.ip}:${info.parentType}.${info.fieldName}`
})
