const { graphqlUploadExpress } = require('graphql-upload')

/**
 * GraphQL File Upload Middleware
 */
module.exports = graphqlUploadExpress({ maxFileSize: 5000000, maxFiles: 20 })
