import { merge } from 'lodash-es'
import fs from 'node:fs/promises'
import path from 'node:path'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { defaultKeyGenerator, rateLimitDirective } from 'graphql-rate-limit-directive'
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs'

import DateScalar from './scalars/date.mjs'
import JSONScalar from './scalars/json.mjs'
import UUIDScalar from './scalars/uuid.mjs'

export async function initSchema () {
  // Rate Limiter

  const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
    keyGenerator: (directiveArgs, source, args, context, info) => `${context.req.ip}:${defaultKeyGenerator(directiveArgs, source, args, context, info)}`
  })

  // Schemas

  WIKI.logger.info(`Loading GraphQL Schema...`)
  const typeDefs = [
    rateLimitDirectiveTypeDefs
  ]
  const schemaList = await fs.readdir(path.join(WIKI.SERVERPATH, 'graph/schemas'))
  for (const schemaFile of schemaList) {
    typeDefs.push(await fs.readFile(path.join(WIKI.SERVERPATH, `graph/schemas/${schemaFile}`), 'utf8'))
  }

  // Resolvers

  WIKI.logger.info(`Loading GraphQL Resolvers...`)
  let resolvers = {
    Date: DateScalar,
    JSON: JSONScalar,
    UUID: UUIDScalar,
    Upload: GraphQLUpload
  }

  const resolverList = await fs.readdir(path.join(WIKI.SERVERPATH, 'graph/resolvers'))
  for (const resolverFile of resolverList) {
    const resolver = (await import(path.join(WIKI.SERVERPATH, 'graph/resolvers', resolverFile))).default
    merge(resolvers, resolver)
  }

  // Make executable schema

  WIKI.logger.info(`Compiling GraphQL Schema...`)
  let schema = makeExecutableSchema({
    typeDefs,
    resolvers
  })

  // Apply schema transforms

  schema = rateLimitDirectiveTransformer(schema)

  WIKI.logger.info(`GraphQL Schema: [ OK ]`)

  return schema
}
