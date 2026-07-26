import type { FastifyInstance } from 'fastify'
import { FLAGS } from '../../models/flags.ts'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * SYSTEM FLAGS - Used both ways: as the response, and as a partial update body
   *
   * Built from the model's own list, so a new flag is exposed and documented by declaring it there.
   */
  app.addSchema({
    $id: 'SystemFlags',
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(FLAGS).map(([key, description]) => [key, { type: 'boolean', description }])
    )
  })
}
