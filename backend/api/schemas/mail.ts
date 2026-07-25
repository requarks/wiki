import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * MAIL CONFIG
   */
  app.addSchema({
    $id: 'MailConfig',
    type: 'object',
    properties: {
      senderName: {
        type: 'string',
        maxLength: 255
      },
      senderEmail: {
        type: 'string',
        maxLength: 255
      },
      defaultBaseURL: {
        type: 'string',
        maxLength: 255
      },
      host: {
        type: 'string',
        maxLength: 255
      },
      port: {
        type: 'integer',
        minimum: 1,
        maximum: 65535
      },
      name: {
        type: 'string',
        maxLength: 255
      },
      secure: {
        type: 'boolean'
      },
      verifySSL: {
        type: 'boolean'
      },
      user: {
        type: 'string',
        maxLength: 255
      },
      pass: {
        type: 'string',
        description:
          'Returned masked as `********` when a password is stored. Send the masked value back unchanged to keep the stored password.',
        maxLength: 255
      },
      useDKIM: {
        type: 'boolean'
      },
      dkimDomainName: {
        type: 'string',
        maxLength: 255
      },
      dkimKeySelector: {
        type: 'string',
        maxLength: 255
      },
      dkimPrivateKey: {
        type: 'string'
      }
    }
  })
}
