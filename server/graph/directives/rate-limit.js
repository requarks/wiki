const { createRateLimitDirective } = require('graphql-rate-limit-directive')

module.exports = createRateLimitDirective({
  keyGenerator: (directiveArgs, source, args, context, info) => `${context.req.ip}:${info.parentType}.${info.fieldName}`
})
