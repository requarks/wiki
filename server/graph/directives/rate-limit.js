const { defaultKeyGenerator, rateLimitDirective } = require('graphql-rate-limit-directive')

const {
  rateLimitDirectiveTypeDefs,
  rateLimitDirectiveTransformer
} = rateLimitDirective({
  keyGenerator: (directiveArgs, source, args, context, info) =>
    `${context.req.ip}:${defaultKeyGenerator(directiveArgs, source, args, context, info)}`
});

module.exports = {
  rateLimitDirectiveTypeDefs,
  rateLimitDirectiveTransformer
};
