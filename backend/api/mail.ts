import type { FastifyInstance } from 'fastify'

/**
 * Placeholder sent to the client in place of the stored SMTP password. Sending it back unchanged
 * leaves the stored password alone.
 */
const PASSWORD_MASK = '********'

/**
 * Mail settings, stored as the `mail` key of the settings table.
 */
const MAIL_CONFIG_KEYS = [
  'senderName',
  'senderEmail',
  'defaultBaseURL',
  'host',
  'port',
  'name',
  'secure',
  'verifySSL',
  'user',
  'pass',
  'useDKIM',
  'dkimDomainName',
  'dkimKeySelector',
  'dkimPrivateKey'
] as const

/**
 * Mail API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * GET MAIL CONFIG
   */
  app.get(
    '/config',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Get mail configuration',
        tags: ['Mail'],
        response: {
          200: {
            description: 'Mail configuration',
            type: 'object',
            $ref: 'MailConfig#'
          }
        }
      }
    },
    async () => {
      return {
        ...WIKI.config.mail,
        pass: WIKI.config.mail?.pass?.length > 0 ? PASSWORD_MASK : ''
      }
    }
  )

  /**
   * UPDATE MAIL CONFIG
   */
  app.put<{
    Body: {
      senderName?: string
      senderEmail?: string
      defaultBaseURL?: string
      host?: string
      port?: number
      name?: string
      secure?: boolean
      verifySSL?: boolean
      user?: string
      pass?: string
      useDKIM?: boolean
      dkimDomainName?: string
      dkimKeySelector?: string
      dkimPrivateKey?: string
    }
  }>(
    '/config',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Update mail configuration',
        tags: ['Mail'],
        body: {
          $ref: 'MailConfig#'
        },
        response: {
          200: {
            description: 'Mail configuration updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const patch: Record<string, any> = {}
      for (const key of MAIL_CONFIG_KEYS) {
        if (req.body[key] !== undefined) {
          patch[key] = req.body[key]
        }
      }

      // -> Base URLs are used to build links in emails, always without a trailing slash
      if (typeof patch.defaultBaseURL === 'string') {
        patch.defaultBaseURL = patch.defaultBaseURL.replace(/\/+$/, '')
      }

      // -> The client only ever receives a masked password, so an unchanged one must not be stored
      if (patch.pass === PASSWORD_MASK) {
        delete patch.pass
      }

      const previousConfig = WIKI.config.mail
      WIKI.config.mail = { ...previousConfig, ...patch }

      if (!(await WIKI.configSvc.saveToDb(['mail']))) {
        WIKI.config.mail = previousConfig
        return reply.internalServerError('Failed to save mail configuration.')
      }

      return {
        ok: true,
        message: 'Mail configuration updated successfully.'
      }
    }
  )
}

export default routes
