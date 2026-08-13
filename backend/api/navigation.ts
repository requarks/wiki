import type { FastifyInstance, FastifyRequest } from 'fastify'
import { NAVIGATION_MODES, type NavigationItem, type NavigationMode } from '../models/navigation.ts'

const navigationItem = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['link', 'header', 'separator'] },
    label: { type: 'string' },
    icon: { type: 'string' },
    target: { type: 'string' },
    openInNewWindow: { type: 'boolean' },
    expandByDefault: {
      type: 'boolean',
      description:
        'Whether a link holding children is shown expanded on load. Meaningless on any other item.'
    },
    visibilityGroups: {
      type: 'array',
      items: { type: 'string' },
      description: 'Groups the item is limited to. Visible to everyone when empty.'
    }
  }
}

/** Whether the requester may see and edit a menu whole, rather than only the parts meant for them. */
function canManageNavigation(req: FastifyRequest): boolean {
  // -> Same identity resolution as the route permission hook, so a key that may save a menu may also
  //    read it whole
  const permissions = req.apiKey
    ? req.apiKey.permissions
    : req.session?.authenticated
      ? (req.session.permissions ?? [])
      : []
  return permissions.includes('manage:navigation') || permissions.includes('manage:system')
}

/**
 * Navigation API Routes
 *
 * A menu belongs to a tree entry that overrides it, or to the site itself for the one every page falls
 * back to — both addressed by the same id, which is why there is a single route to read one.
 */
async function routes(app: FastifyInstance) {
  /**
   * GET NAVIGATION
   */
  app.get<{ Params: { siteId: string; navId: string }; Querystring: { full?: boolean } }>(
    '/sites/:siteId/navigation/:navId',
    {
      schema: {
        summary: 'Get a navigation menu',
        description:
          "The items of one menu, addressed by the id a page's `navigationId` points at.\n\nReadable without a session, because the sidebar is drawn for anonymous readers too. Items limited to a group are dropped for anyone outside it, at both levels of the menu — so what comes back is what the requester may see, not the whole menu. `full` asks for the whole of it instead, and needs `manage:navigation`.",
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            navId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'navId']
        },
        querystring: {
          type: 'object',
          properties: {
            full: {
              type: 'boolean',
              default: false,
              description: 'Include items limited to groups the requester is not in.'
            }
          }
        },
        response: {
          200: {
            description: 'The menu items, in the order they are shown',
            type: 'array',
            items: {
              ...navigationItem,
              properties: {
                ...navigationItem.properties,
                children: { type: 'array', items: navigationItem }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const unfiltered = Boolean(req.query.full)
      if (unfiltered && !canManageNavigation(req)) {
        return reply.forbidden('Reading a menu in full requires the manage:navigation permission.')
      }
      return WIKI.models.navigation.getNav(req.params.navId, {
        userGroups: req.session?.authenticated ? (req.session.groups ?? []) : [],
        unfiltered
      })
    }
  )

  /**
   * GET THE MENU A PAGE INHERITS
   */
  app.get<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/navigation/pages/:pageId/inherited',
    {
      config: {
        permissions: ['manage:navigation']
      },
      schema: {
        summary: 'Get the menu a page inherits',
        description:
          "The id of the menu this page falls back to while it inherits: the nearest ancestor that overrides one, or the site-wide menu when no ancestor does.\n\nWhat the navigation editor asks so that a page which inherits can edit the sidebar it shows without being opened on the ancestor that owns it. Null when the nearest ancestor hides the sidebar, which leaves nothing to inherit — and nothing to edit. Not the same question as the page's own `navigationId`, which is what the CURRENT mode resolved to.",
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            pageId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'pageId']
        },
        response: {
          200: {
            description: 'The inherited menu',
            type: 'object',
            properties: {
              navigationId: {
                type: ['string', 'null'],
                description:
                  'The menu this page inherits. Null when the sidebar above it is hidden.'
              }
            }
          }
        }
      }
    },
    async (req) => {
      return {
        navigationId: await WIKI.models.navigation.inheritedNavId(
          req.params.siteId,
          req.params.pageId
        )
      }
    }
  )

  /**
   * UPDATE NAVIGATION
   */
  app.put<{
    Params: { siteId: string; pageId: string }
    Body: { mode: NavigationMode; items?: NavigationItem[] }
  }>(
    '/sites/:siteId/navigation/pages/:pageId',
    {
      config: {
        permissions: ['manage:navigation']
      },
      schema: {
        summary: 'Set how a page resolves its navigation',
        description:
          'Records the mode on the tree entry and repoints every descendant that still inherits, stopping at any that overrides or hides in between.\n\nSending `items` stores them as the menu the mode resolves to, and leaving them out changes only the mode. With `inherit` that menu belongs to an ancestor — the same one `navigation/pages/{pageId}/inherited` names — so editing a menu from a page that inherits it edits it where it lives, for every page using it; for the home page that is the site-wide menu, which is what every other page inherits by default. Refused when the mode is `inherit` and the sidebar above the page is hidden, since then there is no menu to store items in.',
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            pageId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'pageId']
        },
        body: {
          type: 'object',
          required: ['mode'],
          properties: {
            mode: {
              type: 'string',
              enum: NAVIGATION_MODES
            },
            items: {
              type: 'array',
              items: {
                ...navigationItem,
                properties: {
                  ...navigationItem.properties,
                  children: { type: 'array', items: navigationItem }
                }
              }
            }
          }
        },
        response: {
          200: {
            description: 'Navigation updated successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              navigationMode: { type: 'string' },
              navigationId: {
                type: ['string', 'null'],
                description: 'The menu this page now resolves to. Null when the sidebar is hidden.'
              }
            }
          }
        }
      }
    },
    async (req) => {
      const result = await WIKI.models.navigation.updateNavigation({
        siteId: req.params.siteId,
        pageId: req.params.pageId,
        mode: req.body.mode,
        items: req.body.items
      })
      return {
        ok: true,
        message: 'Navigation updated successfully.',
        ...result
      }
    }
  )
}

export default routes
