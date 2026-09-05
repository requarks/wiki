import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * ASSET - An uploaded file, without its contents
   */
  app.addSchema({
    $id: 'Asset',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      fileName: {
        type: 'string'
      },
      fileExt: {
        type: 'string',
        description: 'Lowercase, without the dot.'
      },
      kind: {
        type: 'string',
        enum: ['document', 'image', 'other']
      },
      mimeType: {
        type: 'string'
      },
      fileSize: {
        type: 'integer',
        description: 'In bytes.'
      },
      folderPath: {
        type: 'string',
        description: 'Slash-separated, without a leading or trailing slash. Empty at the site root.'
      },
      title: {
        type: 'string'
      },
      hasPreview: {
        type: 'boolean',
        description: 'Whether a thumbnail was generated, and `/_thumb/<id>.webp` will serve one.'
      },
      width: {
        type: 'integer',
        description:
          'Images only — in pixels, as displayed. Absent when the dimensions could not be read, which is the case for anything uploaded while the Sharp extension was missing.'
      },
      height: {
        type: 'integer',
        description: 'Images only — in pixels, as displayed.'
      },
      createdAt: {
        type: 'string',
        format: 'date-time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time'
      }
    }
  })
}
