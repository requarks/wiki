import { whoAmI } from './users.ts'
import type { FastifyInstance } from 'fastify'

/**
 * Bootstrap API Route
 *
 * The things the app has to know before it can draw anything: which site it is on, which system flags
 * are set, how the instance authenticates, and who is asking. Each has an endpoint of its own — the
 * admin area reads the flags, the login flow asks who is logged in once that has changed — but a full
 * load needs all of them at once, and asking one at a time is that many round trips before the first
 * pixel.
 *
 * None of them touches the database: the site configurations, the flags, the authentication settings
 * and the locale list are in memory, and the session carries the user. So what this saves is the
 * round trips, which is the whole cost.
 */
async function routes(app: FastifyInstance) {
  app.get<{ Querystring: { hostname?: string } }>(
    '/',
    {
      config: {
        publicAccess: true
      },
      schema: {
        summary: 'Everything the app needs to start',
        description:
          'The site for the hostname, the system flags, the instance-wide authentication settings and the current session — the same answers `sites/{hostname}`, `system/flags`, `authentication/config` and `users/whoami` give, in one request.\n\nThe authentication settings are here rather than read from their own endpoint because that one is behind `manage:system`, while what they decide — whether a passkey may be signed in with, whether a profile may be edited — has to be known to whoever is looking, logged in or not.\n\nCarries the session, so it is never cached.',
        tags: ['System'],
        querystring: {
          type: 'object',
          properties: {
            hostname: {
              type: 'string',
              maxLength: 255,
              description: "The host the browser is on. The request's own hostname when absent."
            }
          }
        },
        response: {
          200: {
            description: 'Site, flags, authentication settings and session',
            type: 'object',
            properties: {
              site: { $ref: 'Site#' },
              flags: { $ref: 'SystemFlags#' },
              auth: { $ref: 'AuthConfig#' },
              user: {
                type: 'object',
                description:
                  'As `users/whoami` answers it: `authenticated: false` alone for a guest, otherwise the account and its group-wide permissions.',
                additionalProperties: true
              },
              locales: {
                type: 'array',
                description:
                  'Every installed locale, named and coded as this wiki refers to it. None of it can be worked out from a code alone: the short forms depend on which other locales exist, and an administrator can override either. Sent here because the locale selector needs it to label itself on the first paint.',
                items: { $ref: 'Locale#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      // -> The session decides part of the answer, so no shared cache may hold on to it
      reply.preventCache()
      const site = await WIKI.models.sites.getSiteByHostname({
        hostname: req.query.hostname ?? req.hostname
      })
      if (!site) {
        return reply.notFound('There is no wiki site at this hostname.')
      }
      return {
        site: {
          ...site.config,
          id: site.id,
          hostname: site.hostname,
          isEnabled: site.isEnabled,
          // -> Never the stored `comments` block, which holds an Akismet key: what a browser is told
          //    is the selected provider and the markup to mount, and nothing else
          comments: WIKI.models.comments.publicConfigFor(site.id)
        },
        flags: WIKI.models.flags.getFlags(),
        auth: WIKI.models.authentication.getConfig(),
        user: whoAmI(req),
        locales: await WIKI.models.locales.getInstalledLocales()
      }
    }
  )
}

export default routes
