import { audit } from '../helpers/audit.ts'
import type { FastifyInstance } from 'fastify'
import type { MailAuthType } from '../models/mail.ts'

/**
 * Placeholder sent to the client in place of a stored secret. Sending it back unchanged leaves the
 * stored value alone; an empty value is never masked, so clearing the field removes the secret.
 */
const SECRET_MASK = '********'

/** The settings that are credentials, which the client is only ever told are set. */
const SECRET_KEYS = ['pass', 'msClientSecret', 'googlePrivateKey', 'dkimPrivateKey'] as const

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
  'authType',
  'user',
  'pass',
  'msTenantId',
  'msClientId',
  'msClientSecret',
  'googleServiceAccount',
  'googlePrivateKey',
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
      const conf = { ...WIKI.config.mail }
      for (const key of SECRET_KEYS) {
        conf[key] = conf[key]?.length > 0 ? SECRET_MASK : ''
      }
      return conf
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
      authType?: MailAuthType
      user?: string
      pass?: string
      msTenantId?: string
      msClientId?: string
      msClientSecret?: string
      googleServiceAccount?: string
      googlePrivateKey?: string
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

      // -> The client only ever receives masked secrets, so an unchanged one must not be stored
      for (const key of SECRET_KEYS) {
        if (patch[key] === SECRET_MASK) {
          delete patch[key]
        }
      }

      const previousConfig = WIKI.config.mail
      WIKI.config.mail = { ...previousConfig, ...patch }

      if (!(await WIKI.configSvc.saveToDb(['mail']))) {
        WIKI.config.mail = previousConfig
        return reply.internalServerError('Failed to save mail configuration.')
      }

      // -> Which settings were touched, never their values: `patch` carries the SMTP password, the
      //    OAuth2 credentials and the DKIM private key
      await audit(req, 'admin', 'updateMailConfig', { changedFields: Object.keys(patch) })

      return {
        ok: true,
        message: 'Mail configuration updated successfully.'
      }
    }
  )

  /**
   * SEND A TEST EMAIL
   *
   * The one thing that says whether the settings above actually work, since nothing probes the SMTP
   * server on its own — a wiki finds out its mail is misconfigured when somebody cannot reset their
   * password otherwise. Sent through the same transport every other mail goes through, so a failure
   * here is the failure they would have hit.
   */
  app.post<{ Body: { recipient: string; locale?: string } }>(
    '/test',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Send a test email',
        description:
          'Uses the stored configuration as it currently stands, so save any changes first. The reply waits for the SMTP server to accept the message, and carries its complaint verbatim when it does not.',
        tags: ['Mail'],
        body: {
          type: 'object',
          required: ['recipient'],
          properties: {
            recipient: {
              type: 'string',
              format: 'email',
              maxLength: 255
            },
            locale: {
              type: 'string',
              description:
                'Which language to write the test in, which is how the localized templates are checked. Defaults to the site’s own language, as a mail nobody has a preference on does.',
              maxLength: 255
            }
          }
        },
        response: {
          200: {
            description: 'The test email was accepted by the mail server',
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
      if (!WIKI.models.mail.isConfigured) {
        return reply.badRequest(
          'Mail is not configured: an SMTP host and a sender address are required.'
        )
      }
      // -> Whichever site this admin area is being used on: all it decides is the name in the mail
      const siteId =
        (await WIKI.models.sites.getSiteByHostname({ hostname: req.hostname }))?.id ?? ''
      const baseUrl = WIKI.models.mail.baseUrl({ siteId, protocol: req.protocol })
      try {
        await WIKI.models.mail.send({
          site: WIKI.models.mail.siteFor(siteId, baseUrl),
          to: req.body.recipient,
          template: 'test',
          locale: req.body.locale,
          data: { baseUrl }
        })
        await audit(req, 'admin', 'sendTestEmail', {
          recipient: req.body.recipient,
          siteId,
          locale: req.body.locale
        })

        return {
          ok: true,
          message: 'Test email sent successfully.'
        }
      } catch (err: any) {
        WIKI.logger.warn(`Test email to <${req.body.recipient}> failed: ${err.message}`)
        // -> The mail server's own words: a rejected sender, a refused relay and a bad password all
        //    read differently, and the administrator is the person who can act on the difference
        return reply.badRequest(err.message)
      }
    }
  )
}

export default routes
