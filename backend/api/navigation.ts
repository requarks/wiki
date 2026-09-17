import { audit } from '../helpers/audit.ts'
import { mayOnPage } from './pages.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { NAVIGATION_MODES, type NavigationItem, type NavigationMode } from '../models/navigation.ts'

/**
 * Whether this requester may manage the navigation of the page at `pageId`.
 *
 * `manage:navigation` is a PAGE RULE, so it is a question about a path and is asked of the page the
 * caller is standing on. What it buys there is the MODE — whether this page inherits, overrides or
 * hides its sidebar — which is a property of the page and affects nothing above it.
 *
 * @returns The page as the rules see it, or null when there is no such page or no permission
 */
async function mayManageNavAt(
  req: FastifyRequest,
  siteId: string,
  pageId: string
): Promise<boolean> {
  const page = await WIKI.models.pages.getPage({ siteId, id: pageId })
  if (!page) {
    return false
  }
  return mayOnPage(req, 'manage:navigation', page)
}

/**
 * Whether this requester may edit the ITEMS of the menu the page at `pageId` shows.
 *
 * Two permissions, not one, and the second is the point of the whole arrangement: the items belong
 * to whichever entry OWNS the menu, which for a page that inherits is an ancestor — so editing them
 * from here changes what every page under that ancestor shows. Somebody who runs `/guides` may
 * therefore set `/guides/foo` to override or hide, but may not reach up and rewrite the menu
 * `/guides` hands down unless their rules reach `/guides` too.
 *
 * Which entry that is depends on the mode the request is SETTING, not on the one stored: a page
 * being pointed at `override` is about to own its menu, so the question is about its own path. Only
 * `inherit` reaches upwards. `menuOwnerRef` is what resolves the two cases; null from it means the
 * sidebar above is hidden, so there is no menu and nothing to edit.
 */
async function mayEditNavItems(
  req: FastifyRequest,
  siteId: string,
  pageId: string,
  mode: NavigationMode
): Promise<boolean> {
  if (!(await mayManageNavAt(req, siteId, pageId))) {
    return false
  }
  const owner = await WIKI.models.navigation.menuOwnerRef(siteId, pageId, mode)
  if (!owner) {
    return false
  }
  return mayOnPage(req, 'manage:navigation', { ...owner, siteId })
}

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
      /*
        Reading a menu WHOLE -- including the items limited to groups the requester is not in -- is
        the editor's request rather than a reader's, so it asks the same question editing the items
        does: `manage:navigation` on the entry the menu belongs to.
      */
      if (unfiltered) {
        const owner = await WIKI.models.navigation.refForNavId(req.params.siteId, req.params.navId)
        if (!owner || !mayOnPage(req, 'manage:navigation', { ...owner, siteId: req.params.siteId })) {
          return reply.forbidden(
            'Reading a menu in full requires the manage:navigation permission on the page it belongs to.'
          )
        }
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
      /*
        No route-level `permissions`: `manage:navigation` is a page rule now, and that hook reads the
        group-wide list only. Checked against this page below instead.
      */
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
              },
              canEditItems: {
                type: 'boolean',
                description:
                  'Whether this requester may edit the items of that menu, as opposed to only setting this page\'s navigation mode. False when `manage:navigation` does not also reach the entry the menu belongs to — the items are shown to every page under that entry, so changing them is a change there rather than here.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!(await mayManageNavAt(req, req.params.siteId, req.params.pageId))) {
        return reply.forbidden('You are not allowed to manage the navigation of this page.')
      }
      /*
        `canEditItems` comes back with the id because the editor has to know which of its two halves
        to offer: whoever may set the mode here but not reach the ancestor that owns the menu gets the
        mode controls and a read-only list. Answered by the server rather than worked out in the
        browser, since only the server can evaluate a rule against the ancestor's path.
      */
      return {
        navigationId: await WIKI.models.navigation.inheritedNavId(
          req.params.siteId,
          req.params.pageId
        ),
        canEditItems: await mayEditNavItems(req, req.params.siteId, req.params.pageId, 'inherit')
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
      /*
        No route-level `permissions`: see the note on the route above. The two halves of this request
        are checked separately below, because they are two different permissions to hold.
      */
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
    async (req, reply) => {
      if (!(await mayManageNavAt(req, req.params.siteId, req.params.pageId))) {
        return reply.forbidden('You are not allowed to manage the navigation of this page.')
      }
      /*
        Sending `items` is editing the menu where it LIVES, which for a page that inherits is an
        ancestor's. Refused separately from the mode so that the common case -- a section editor
        pointing one of their own pages at a different mode -- is not held up by a permission they do
        not need for it.
      */
      if (
        req.body.items !== undefined &&
        !(await mayEditNavItems(req, req.params.siteId, req.params.pageId, req.body.mode))
      ) {
        return reply.forbidden(
          'You are not allowed to edit the items of the menu this page shows, as it belongs to a page you do not manage the navigation of. You can still change how this page resolves its navigation.'
        )
      }
      const result = await WIKI.models.navigation.updateNavigation({
        siteId: req.params.siteId,
        pageId: req.params.pageId,
        mode: req.body.mode,
        items: req.body.items
      })
      // -> The mode and how many items, not the tree itself: a sidebar is hundreds of entries and
      //    the point of the record is that somebody changed the navigation of this page
      await audit(req, 'admin', 'updatePageNavigation', {
        siteId: req.params.siteId,
        pageId: req.params.pageId,
        mode: result.navigationMode,
        navigationId: result.navigationId,
        itemCount: req.body.items?.length ?? 0
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
