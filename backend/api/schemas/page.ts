import { pageHistoryActions } from '../../models/pageHistory.ts'
import type { FastifyInstance } from 'fastify'

/**
 * A date that may not be set.
 *
 * An empty string counts as unset alongside null, because that is how the editor holds a date nobody
 * has filled in — rejecting it would fail every save of a page that is not scheduled.
 */
const optionalDateTime = {
  anyOf: [
    { type: 'string', format: 'date-time' },
    { type: 'string', maxLength: 0 },
    { type: 'null' }
  ],
  description: 'Empty or null when there is no date.'
}

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * PAGE INPUT - The writable fields, used for both create and update
   */
  app.addSchema({
    $id: 'PageInput',
    type: 'object',
    properties: {
      path: {
        type: 'string',
        maxLength: 255,
        pattern: '^/?[a-zA-Z0-9-_/]*$',
        description: 'Where the page lives, without a leading slash. Lowercased when stored.'
      },
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 255
      },
      description: {
        type: 'string',
        maxLength: 255
      },
      icon: {
        type: 'string',
        maxLength: 255
      },
      alias: {
        type: 'string',
        maxLength: 255,
        pattern: '^[a-zA-Z0-9-_]*$'
      },
      locale: {
        type: 'string',
        maxLength: 10,
        description: "The site's primary locale when absent."
      },
      editor: {
        type: 'string',
        maxLength: 255,
        description:
          'Which editor authored the content, e.g. `markdown`. `redirect` is a page with no body at all: it sends its reader elsewhere, is never searchable, and its content is the JSON below rather than a document.'
      },
      content: {
        type: 'string',
        description:
          'The source, in whatever the editor writes. For a `redirect` page, `{ "kind": "page" | "url", "target": string, "showInterstitial": boolean }` — a page target is a rooted path within this wiki, a URL target a complete http(s) address.'
      },
      render: {
        type: 'string',
        description:
          "The HTML the editor produced. Sanitized against the author's permissions before it is stored, and the table of contents and search text are derived from the result — so what comes back may differ from what was sent."
      },
      publishState: {
        type: 'string',
        enum: ['draft', 'published', 'scheduled']
      },
      publishStartDate: optionalDateTime,
      publishEndDate: optionalDateTime,
      isBrowsable: {
        type: 'boolean'
      },
      isSearchable: {
        type: 'boolean'
      },
      password: {
        type: 'string',
        maxLength: 255
      },
      relations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true
        }
      },
      localeRelations: {
        type: 'array',
        description:
          "This page's counterparts in other locales — the same page in another language, which is what the locale selector sends a reader to.\n\nThe list states the WHOLE set rather than adding to it: a locale left out has no counterpart, and a page that was in the set and is not listed leaves it. Leave the field out to keep the set as it is.\n\nNaming a page that already belongs to a set joins that set, bringing its other members along. It is refused with a 409 when that set already holds a page for a locale this list speaks for — including this page's own locale, which is the case of a page that is already another page's translation.",
        items: {
          type: 'object',
          required: ['locale', 'path'],
          properties: {
            locale: {
              type: 'string',
              maxLength: 10,
              description: 'The locale this counterpart is written in.'
            },
            path: {
              type: 'string',
              maxLength: 255,
              description: 'Path of the page in that locale, without a leading slash.'
            }
          }
        }
      },
      tags: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      allowComments: { type: 'boolean' },
      allowContributions: { type: 'boolean' },
      allowRatings: { type: 'boolean' },
      showSidebar: { type: 'boolean' },
      showTags: { type: 'boolean' },
      showToc: { type: 'boolean' },
      tocDepth: {
        type: 'object',
        properties: {
          min: { type: 'integer', minimum: 1, maximum: 6 },
          max: { type: 'integer', minimum: 1, maximum: 6 }
        }
      },
      scriptJsLoad: {
        type: 'string',
        description: 'Requires the `write:scripts` permission. Ignored without it.'
      },
      scriptJsUnload: {
        type: 'string',
        description: 'Requires the `write:scripts` permission. Ignored without it.'
      },
      scriptCss: {
        type: 'string',
        description: 'Requires the `write:styles` permission. Ignored without it.'
      },
      reasonForChange: {
        type: 'string',
        maxLength: 255,
        description:
          "Why this save is being made, as the editor's reason-for-change prompt collected it. Not stored on the page: it is recorded on the history version this save produces."
      }
    }
  })

  /**
   * PAGE - A page as it is served back
   */
  app.addSchema({
    $id: 'Page',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      path: { type: 'string' },
      hash: {
        type: 'string',
        description: 'Hash of the path, which is how a page is addressed by URL.'
      },
      alias: { type: ['string', 'null'] },
      title: { type: 'string' },
      description: { type: ['string', 'null'] },
      icon: { type: ['string', 'null'] },
      locale: { type: 'string' },
      editor: { type: 'string' },
      contentType: { type: 'string' },
      publishState: { type: 'string', enum: ['draft', 'published', 'scheduled'] },
      publishStartDate: { type: ['string', 'null'], format: 'date-time' },
      publishEndDate: { type: ['string', 'null'], format: 'date-time' },
      isBrowsable: { type: 'boolean' },
      isSearchable: { type: 'boolean' },
      password: {
        type: ['string', 'null'],
        description:
          'Only present for a requester who may edit the page — whoever can take the password off it. Absent otherwise, protected page or not.'
      },
      isLocked: {
        type: 'boolean',
        description:
          'The page is password protected and this requester has not entered it, so `content`, `render` and `toc` were withheld. Unlock it with `POST …/unlock`.'
      },
      relations: {
        type: 'array',
        items: { type: 'object', additionalProperties: true }
      },
      localeRelations: {
        type: 'array',
        description:
          'The same page in other locales, one entry per locale, as far as this requester may see them — a draft translation is not offered to a reader who could not open it. Empty for a page with no counterparts.',
        items: { $ref: 'PageLocaleRelation#' }
      },
      tags: { type: 'array', items: { type: 'string' } },
      toc: {
        type: 'array',
        description:
          'Nested headings, derived from the stored render. Each carries its own `level` — the heading tag it came from — as well as its place in the tree, since which headings a contents list shows is a question about the tag rather than about the nesting.',
        items: { type: 'object', additionalProperties: true }
      },
      render: { type: 'string' },
      content: {
        type: 'string',
        description:
          'Only present when the request asked for it — except on a redirection, whose content is where it sends its reader rather than a body, and comes back either way.'
      },
      allowComments: { type: 'boolean' },
      allowContributions: { type: 'boolean' },
      allowRatings: { type: 'boolean' },
      showSidebar: { type: 'boolean' },
      showTags: { type: 'boolean' },
      showToc: { type: 'boolean' },
      tocDepth: {
        type: 'object',
        properties: {
          min: { type: 'integer' },
          max: { type: 'integer' }
        }
      },
      scriptJsLoad: { type: 'string' },
      scriptJsUnload: { type: 'string' },
      scriptCss: { type: 'string' },
      navigationId: { type: ['string', 'null'] },
      navigationMode: { type: 'string' },
      authorId: { type: 'string', format: 'uuid' },
      authorName: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      viewer: {
        type: 'object',
        description:
          'Where the requester stands on this page: what they may do to it, whether they may suggest an edit, and whether they review it. Present when a page is fetched on its own — the page view draws its controls from this, rather than asking three further endpoints about a page it already has. Absent from a page returned by a save.',
        properties: {
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description:
              'The page permissions held AT THIS PATH, as this reader’s groups’ rules decide. The same answer `pages/userPermissions` gives for the path.'
          },
          canSuggestEdits: {
            type: 'boolean',
            description:
              'An enabled approval rule covers this page and names a group the requester is in, and the page allows contributions.'
          },
          hasOpenSuggestion: {
            type: 'boolean',
            description:
              'The requester already has a suggestion waiting on this page, which they would carry on with rather than start again. Always false for a guest, whose suggestions are attributed to nobody.'
          },
          canReview: {
            type: 'boolean',
            description: 'The requester reviews this page. Always false without an account.'
          },
          isWatching: {
            type: 'boolean',
            description:
              'The requester has asked to be told about changes to this page. Always false without an account, since a watch belongs to one.'
          },
          pendingSubmissions: {
            type: 'array',
            items: { $ref: 'PageEditSubmission#' },
            description: 'What is waiting on this page, oldest first. Empty unless `canReview`.'
          }
        }
      }
    }
  })

  /**
   * WATCHED PAGE - A page somebody asked to be told about, as their inbox lists it
   */
  app.addSchema({
    $id: 'WatchedPage',
    type: 'object',
    properties: {
      pageId: { type: 'string', format: 'uuid' },
      path: { type: 'string' },
      locale: { type: 'string' },
      title: { type: 'string' },
      description: { type: ['string', 'null'] },
      icon: { type: ['string', 'null'] },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the page last changed, which is what watching it is about.'
      },
      watchedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the caller started watching it.'
      }
    }
  })

  /**
   * PAGE LOCALE RELATION - One page of a translation set: this page, in another language
   */
  app.addSchema({
    $id: 'PageLocaleRelation',
    type: 'object',
    properties: {
      locale: {
        type: 'string',
        description: 'The locale this counterpart is written in.'
      },
      path: {
        type: 'string',
        description:
          "Slash-separated path of the page in that locale, without a leading slash and without the locale's URL prefix."
      },
      title: {
        type: 'string',
        description: 'Its title, for a surface that lists the set rather than navigating to it.'
      }
    }
  })

  /**
   * INCLUDED PAGE - Another page's render, as an include block draws it inside the page being read
   */
  app.addSchema({
    $id: 'IncludedPage',
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Slash-separated path of the page that was included.'
      },
      locale: {
        type: 'string'
      },
      title: {
        type: 'string'
      },
      isLocked: {
        type: 'boolean',
        description:
          'The page is password protected and this reader has not entered it, so `render` is empty. An include does not offer the unlock prompt: the reader unlocks the page by opening it.'
      },
      render: {
        type: 'string',
        description: 'The stored HTML, already sanitised when the page was saved.'
      }
    }
  })

  /**
   * PAGE HISTORY ENTRY - One version of a page, as the history timeline lists it
   */
  app.addSchema({
    $id: 'PageHistoryEntry',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      action: {
        type: 'string',
        enum: [...pageHistoryActions],
        description: 'What happened to the page. `moved` is a change of path or title.'
      },
      changedFields: {
        type: 'array',
        description:
          'Which page fields the change touched, named as the page stores them. Empty for a creation or a deletion, where the whole page is the change.',
        items: {
          type: 'string'
        }
      },
      reason: {
        type: 'string',
        description:
          "Why the change was made, in the author's words. Empty when the site does not ask for a reason — see the `reasonForChange` site feature — or asked and was not answered."
      },
      versionDate: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      },
      path: {
        type: 'string',
        description: 'Where the page was at the time, which is not necessarily where it is now.'
      },
      title: {
        type: 'string'
      },
      author: {
        type: 'object',
        description: 'Who made the change. Null id and empty name once that account is deleted.',
        properties: {
          id: {
            type: ['string', 'null'],
            format: 'uuid'
          },
          name: {
            type: 'string'
          },
          email: {
            type: 'string'
          }
        }
      }
    }
  })

  /**
   * PAGE HISTORY VERSION - The same, with the source it held: one side of a diff
   */
  app.addSchema({
    $id: 'PageHistoryVersion',
    type: 'object',
    allOf: [
      { $ref: 'PageHistoryEntry#' },
      {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The page source as of this version.'
          },
          meta: {
            type: 'object',
            additionalProperties: true,
            description:
              'The rest of the page as it stood: description, icon, tags, publish state and dates, relations, scripts, config, editor and content type.'
          }
        }
      }
    ]
  })
}
