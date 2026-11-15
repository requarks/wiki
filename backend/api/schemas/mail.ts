import type { FastifyInstance } from 'fastify'
import { MAIL_AUTH_TYPES } from '../../models/mail.ts'

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
      authType: {
        type: 'string',
        enum: [...MAIL_AUTH_TYPES],
        description:
          'How to sign in to the SMTP server: `basic` with `user` and `pass` (or neither, for a relay that trusts the address), `microsoft` as a Microsoft 365 app registration (`msTenantId`, `msClientId`, `msClientSecret`), or `google` as a Google Workspace service account with domain-wide delegation (`googleServiceAccount`, `googlePrivateKey`).'
      },
      user: {
        type: 'string',
        description:
          'The SMTP username with `basic`. With `microsoft` or `google`, the mailbox to sign in as, defaulting to `senderEmail` when empty.',
        maxLength: 255
      },
      pass: {
        type: 'string',
        description:
          'Returned masked as `********` when a password is stored. Send the masked value back unchanged to keep the stored password.',
        maxLength: 255
      },
      msTenantId: {
        type: 'string',
        description: 'Microsoft 365: the Entra ID tenant, as its ID or a verified domain.',
        maxLength: 255
      },
      msClientId: {
        type: 'string',
        description: 'Microsoft 365: the app registration’s Application (client) ID.',
        maxLength: 255
      },
      msClientSecret: {
        type: 'string',
        description:
          'Microsoft 365: a client secret of the app registration. Returned masked as `********` when one is stored; send the mask back unchanged to keep it.',
        maxLength: 1024
      },
      googleServiceAccount: {
        type: 'string',
        description: 'Google Workspace: the service account’s email address (`client_email`).',
        maxLength: 255
      },
      googlePrivateKey: {
        type: 'string',
        description:
          'Google Workspace: the service account’s private key in PEM format (`private_key`). Returned masked as `********` when one is stored; send the mask back unchanged to keep it.',
        maxLength: 8192
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
        type: 'string',
        description:
          'The DKIM signing key in PEM format. Returned masked as `********` when one is stored; send the mask back unchanged to keep it.'
      }
    }
  })
}
