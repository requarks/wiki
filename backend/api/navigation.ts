import { audit } from '../helpers/audit.ts'
import { normalizePagePath } from '../helpers/common.ts'
import { mayOnPage, unpublishedFor } from './pages.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  NAVIGATION_MODES,
  type NavigationItem,
  type NavigationMode,
  type NavigationOwner
} from '../models/navigation.ts'

/**
 * Whether this requester may manage the navigation of the page or folder at `pageId`.
 *
 * `manage:navigation` is a PAGE RULE, so it is a question about a path and is asked of the entry the
 * caller is standing on — a page, or a folder at a path with no page, which has a sidebar of its own.
 * What it buys there is the MODE — whether this entry inherits, overrides or hides its sidebar — which
 * is a property of the entry and affects nothing above it.
 */
async function mayManageNavAt(
  req: FastifyRequest,
  siteId: string,
  pageId: string
): Promise<boolean> {
  const entry = await WIKI.models.navigation.entryRef(siteId, pageId)
  if (!entry) {
    return false
  }
  return mayOnPage(req, 'manage:navigation', { ...entry, siteId })
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

/**
 * Whether this requester holds `manage:sites`, which is what the admin area's Navigation screen asks
 * for: there, a menu is edited as one of the site's settings rather than from a page it belongs to.
 */
function mayManageSites(req: FastifyRequest): boolean {
  const permissions = req.apiKey
    ? req.apiKey.permissions
    : req.session?.authenticated
      ? (req.session.permissions ?? [])
      : []
  return permissions.includes('manage:sites') || permissions.includes('manage:system')
}

/**
 * Whether this requester may point a `menu` item at a menu: `manage:navigation` on the entry owning
 * it, the same question as editing that menu's items. `manage:sites` covers every menu of the site, as
 * it does on the admin area's Navigation screen.
 *
 * A locale's root menu is owned by nothing in the tree, and the rules are asked about it at the home
 * page's path, as `menuOwnerRef` reports it.
 */
function mayPickMenuTarget(req: FastifyRequest, siteId: string, target: NavigationOwner): boolean {
  if (mayManageSites(req)) {
    return true
  }
  return mayOnPage(req, 'manage:navigation', {
    siteId,
    path: target.isRoot ? 'home' : (target.path ?? ''),
    locale: target.locale ?? undefined,
    tags: target.tags
  })
}

const navigationItem = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['link', 'header', 'separator', 'menu'] },
    label: { type: 'string' },
    icon: { type: 'string' },
    target: { type: 'string' },
    targetNavId: {
      type: 'string',
      format: 'uuid',
      description:
        'A `menu` item only: the menu it opens in the sidebar, which must be of the same site and locale. `menu` items are top level only.'
    },
    showLink: {
      type: 'boolean',
      description:
        "A `menu` item only: whether it also links to the page at the target menu's location — the page owning it, the page sharing its folder's path, or the home page for a locale's root menu. No effect where there is no such page."
    },
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
   * LIST NAVIGATION MENUS
   */
  app.get<{
    Params: { siteId: string }
    Querystring: { filter?: string; page?: number; limit?: number }
  }>(
    '/sites/:siteId/navigation',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'List the navigation menus of a site',
        description:
          "Every menu the site holds: one per locale, which every page in it falls back to, plus one per tree entry that overrides its sidebar. Each comes with the path of the entry owning it — empty for a locale's root menu — and how many items it has, children included.",
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId']
        },
        querystring: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description:
                'Matched against the path of the entry owning the menu, case-insensitively.',
              maxLength: 255
            },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        },
        response: {
          200: {
            description: 'A page of navigation menus',
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              menus: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    locale: {
                      type: ['string', 'null'],
                      description: 'Null only for a menu whose owning entry no longer exists.'
                    },
                    path: {
                      type: ['string', 'null'],
                      description:
                        "Where the owning entry sits. Empty for a locale's root menu, null when the owning entry no longer exists."
                    },
                    isRoot: {
                      type: 'boolean',
                      description: "Whether this is a locale's root menu, which cannot be deleted."
                    },
                    itemCount: { type: 'integer' },
                    pageCount: {
                      type: 'integer',
                      description:
                        'How many pages show this menu, the one owning it and those inheriting it alike.'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (req) => {
      const page = req.query.page ?? 1
      const limit = req.query.limit ?? 20
      const { total, menus } = await WIKI.models.navigation.listNavs({
        siteId: req.params.siteId,
        filter: req.query.filter ?? '',
        page,
        limit
      })
      return { page, limit, total, menus }
    }
  )

  /**
   * DELETE NAVIGATION MENU
   */
  app.delete<{ Params: { siteId: string; navId: string } }>(
    '/sites/:siteId/navigation/:navId',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Delete a navigation menu',
        description:
          "Deletes a menu belonging to a tree entry. An entry still overriding with it is set back to inherit first, so that it and every page below it that showed the menu fall back to the nearest ancestor's. A locale's root menu cannot be deleted.",
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            navId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'navId']
        },
        response: {
          200: {
            description: 'Navigation menu deleted successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req) => {
      const deleted = await WIKI.models.navigation.deleteNav(req.params.siteId, req.params.navId)
      await audit(req, 'admin', 'deleteNavigation', {
        siteId: req.params.siteId,
        navigationId: req.params.navId,
        locale: deleted.locale,
        path: deleted.path
      })
      return { ok: true, message: 'Navigation menu deleted successfully.' }
    }
  )

  /**
   * GET NAVIGATION
   */
  app.get<{ Params: { siteId: string; navId: string }; Querystring: { full?: boolean } }>(
    '/sites/:siteId/navigation/:navId',
    {
      config: {
        scope: 'navigation'
      },
      schema: {
        summary: 'Get a navigation menu',
        description:
          "The items of one menu, addressed by the id a page's `navigationId` points at.\n\nReadable without a session, because the sidebar is drawn for anonymous readers too. Items limited to a group are dropped for anyone outside it, at both levels of the menu — so what comes back is what the requester may see, not the whole menu. `full` asks for the whole of it instead, and needs `manage:navigation` on the page the menu belongs to, or `manage:sites`.",
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
                children: { type: 'array', items: navigationItem },
                targetPath: {
                  type: ['string', 'null'],
                  description:
                    "With `full`, on a `menu` item: where the entry owning the menu it opens sits — empty for a locale's root menu, null when the target is gone."
                },
                targetMissing: {
                  type: 'boolean',
                  description:
                    'With `full`, on a `menu` item: whether the menu it opens is gone. Without `full` such items are left out.'
                },
                targetHasPage: {
                  type: 'boolean',
                  description:
                    "With `full`, on a `menu` item: whether there is a page at the target menu's location for `showLink` to link to."
                },
                targetPage: {
                  type: 'string',
                  description:
                    "Without `full`, on a `showLink` menu item: the path of the page it links to, when this reader may open it. `home` for a locale's home page. Absent otherwise, and the item then only opens the menu."
                }
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
        does: `manage:navigation` on the entry the menu belongs to. Or `manage:sites`, which is what the
        admin area's Navigation screen edits every menu of the site with.
      */
      if (unfiltered && !mayManageSites(req)) {
        const owner = await WIKI.models.navigation.refForNavId(req.params.siteId, req.params.navId)
        if (
          !owner ||
          !mayOnPage(req, 'manage:navigation', { ...owner, siteId: req.params.siteId })
        ) {
          return reply.forbidden(
            'Reading a menu in full requires the manage:navigation permission on the page it belongs to.'
          )
        }
      }
      // -> A page that is not live is linked to only for whoever may see it so, as everywhere else
      const unpublished = unpublishedFor(req)
      return WIKI.models.navigation.getNav(req.params.siteId, req.params.navId, {
        userGroups: req.apiKey
          ? req.apiKey.groupIds
          : req.session?.authenticated
            ? (req.session.groups ?? [])
            : [],
        unfiltered,
        mayOpenPage: (page) =>
          mayOnPage(req, 'read:pages', page) &&
          (page.isLive || (unpublished !== false && unpublished(page)))
      })
    }
  )

  /**
   * GET WHERE "GO UP" LEADS FROM A MENU
   */
  app.get<{ Params: { siteId: string; navId: string } }>(
    '/sites/:siteId/navigation/:navId/parent',
    {
      config: {
        scope: 'navigation'
      },
      /*
        No route-level permissions: readable by whoever can read the menu, which is anybody. The path
        it answers with is a page rule's question, asked below.
      */
      schema: {
        summary: 'Get the parent of a navigation menu',
        description:
          "Where the sidebar's \"Go up\" link leads from a menu: the page or folder above the one owning it — the locale's root, as an empty path, for a menu owned at the top level. Above the owner rather than above the page being read, since every folder between the two shows the same menu. Null for a locale's root menu, which has nothing above it, for a menu whose owner is gone, and where the requester may not read what is above it.",
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            navId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'navId']
        },
        response: {
          200: {
            description: 'The parent, or null',
            type: 'object',
            properties: {
              parent: {
                type: ['object', 'null'],
                properties: {
                  locale: { type: 'string' },
                  path: {
                    type: 'string',
                    description: "Slash path of the parent. Empty for the locale's root."
                  }
                }
              }
            }
          }
        }
      }
    },
    async (req) => {
      const parent = await WIKI.models.navigation.menuParent(req.params.siteId, req.params.navId)
      // -> The root of a locale always answers, as the site root does; anything else is a link only
      //    for whoever may read what is there
      if (parent?.path && !mayOnPage(req, 'read:pages', { siteId: req.params.siteId, ...parent })) {
        return { parent: null }
      }
      return { parent }
    }
  )

  /**
   * GET THE NAVIGATION AT A PATH WITH NO PAGE
   */
  app.get<{ Params: { siteId: string }; Querystring: { path: string; locale: string } }>(
    '/sites/:siteId/navigation/path',
    {
      config: {
        scope: 'navigation'
      },
      /*
        No route-level permissions: what is at a path is a page rule's question, asked below. A menu is
        readable by anybody, so the menu a path inherits is not what is being protected -- the folder
        is.
      */
      schema: {
        summary: 'Get the navigation at a path with no page',
        description:
          "What the missing-page screen draws its sidebar from and sets the navigation mode of: the folder at the path with how it resolves its menu, or — with no folder there, or none the requester may read — the menu a page written there would inherit, with `folderId` null.\n\nThe locale must be one of the site's active locales.",
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId']
        },
        querystring: {
          type: 'object',
          properties: {
            path: { type: 'string', maxLength: 2048, description: 'Slash-separated path.' },
            locale: { type: 'string', maxLength: 255 }
          },
          required: ['path', 'locale']
        },
        response: {
          200: {
            description: 'The navigation at that path',
            type: 'object',
            properties: {
              folderId: {
                type: ['string', 'null'],
                description:
                  'The folder at the path, whose navigation mode Edit Nav sets. Null when there is none.'
              },
              navigationMode: { type: 'string', enum: NAVIGATION_MODES },
              navigationId: {
                type: ['string', 'null'],
                description: 'The menu the sidebar shows there. Null when it is hidden.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = WIKI.sites[req.params.siteId]
      if (!site) {
        return reply.notFound('This site does not exist.')
      }
      // -> Resolving an inherited menu creates the locale's own on demand, which an unvalidated value
      //    from anybody must not get to do
      if (!(site.config?.locales?.active ?? []).includes(req.query.locale)) {
        return reply.badRequest('This locale is not active on this site.')
      }
      const path = normalizePagePath(req.query.path)
      // -> A folder nobody may read here is no folder to this requester: the answer is what a page at
      //    the path would inherit, as it is where there is nothing at all
      return WIKI.models.navigation.navigationAtPath(req.params.siteId, req.query.locale, path, {
        includeFolder: mayOnPage(req, 'read:pages', {
          siteId: req.params.siteId,
          path,
          locale: req.query.locale
        })
      })
    }
  )

  /**
   * LIST THE MENUS A MENU ITEM MAY OPEN
   */
  app.get<{ Params: { siteId: string }; Querystring: { locale: string } }>(
    '/sites/:siteId/navigation/targets',
    {
      config: {
        scope: 'navigation'
      },
      /*
        No route-level permissions: what may be picked is a page rule, `manage:navigation` on each
        menu's owner, so the list is filtered here instead -- and is empty for whoever holds it nowhere.
      */
      schema: {
        summary: 'List the menus a menu item may open',
        description:
          "The menus of a locale that the requester may point a `menu` item at: those whose owning page they hold `manage:navigation` on, or every one of them with `manage:sites`. A locale's root menu is asked about at the home page's path. What the navigation editor's menu picker lists.",
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId']
        },
        querystring: {
          type: 'object',
          properties: {
            locale: {
              type: 'string',
              description: 'The locale of the menu being edited, which a target has to share.',
              maxLength: 255
            }
          },
          required: ['locale']
        },
        response: {
          200: {
            description: 'The menus that may be picked, root menu first and then by path',
            type: 'object',
            properties: {
              menus: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    path: {
                      type: 'string',
                      description: "Where the owning entry sits. Empty for the locale's root menu."
                    },
                    isRoot: { type: 'boolean' },
                    hasPage: {
                      type: 'boolean',
                      description:
                        "Whether there is a page at the menu's location for a `showLink` item to link to."
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (req) => {
      const targets = await WIKI.models.navigation.listNavTargets(
        req.params.siteId,
        req.query.locale
      )
      return {
        menus: targets
          .filter((target) => mayPickMenuTarget(req, req.params.siteId, target))
          .map(({ id, path, isRoot, pageId }) => ({ id, path, isRoot, hasPage: Boolean(pageId) }))
      }
    }
  )

  /**
   * UPDATE NAVIGATION MENU ITEMS
   */
  app.put<{ Params: { siteId: string; navId: string }; Body: { items: NavigationItem[] } }>(
    '/sites/:siteId/navigation/:navId',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Replace the items of a navigation menu',
        description:
          "Stores `items` as the whole of an existing menu, addressed by its own id — what the admin area's Navigation screen saves through. Unlike `navigation/pages/{pageId}`, no page's mode changes and nothing is repointed: it is the same menu, with different items.",
        tags: ['Navigation'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            navId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'navId']
        },
        body: {
          type: 'object',
          required: ['items'],
          properties: {
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
            description: 'Navigation menu updated successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req) => {
      await WIKI.models.navigation.setNavItems(req.params.siteId, req.params.navId, req.body.items)
      await audit(req, 'admin', 'updateNavigation', {
        siteId: req.params.siteId,
        navigationId: req.params.navId,
        itemCount: req.body.items.length
      })
      return { ok: true, message: 'Navigation menu updated successfully.' }
    }
  )

  /**
   * GET THE MENU A PAGE INHERITS
   */
  app.get<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/navigation/pages/:pageId/inherited',
    {
      config: {
        scope: 'navigation'
      },
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
                  "Whether this requester may edit the items of that menu, as opposed to only setting this page's navigation mode. False when `manage:navigation` does not also reach the entry the menu belongs to — the items are shown to every page under that entry, so changing them is a change there rather than here."
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
      config: {
        scope: 'navigation'
      },
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
        items: req.body.items,
        mayPick: (target) => mayPickMenuTarget(req, req.params.siteId, target)
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
