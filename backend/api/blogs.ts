import type { FastifyInstance } from 'fastify'
import { mayOnPage } from './pages.ts'
import { normalizePagePath } from '../helpers/common.ts'

const siteIdParam = {
  type: 'object',
  properties: {
    siteId: {
      type: 'string',
      format: 'uuid'
    }
  },
  required: ['siteId']
}

/** The locale a request that named none is answered in. */
function defaultLocale(siteId: string): string {
  return WIKI.sites[siteId]?.config?.locales?.primary ?? 'en'
}

/**
 * Blogs API
 *
 * One route, because a blog listing is one question: which posts to draw, where the reader is in the
 * blog, and what the sidebar should offer to narrow it by. Those three come out of a single read (see
 * `MAX_POSTS` in `models/blogs.ts`), and splitting them across two requests would only make it
 * possible for a tag cloud to disagree with the listing beside it.
 *
 * No route-level permissions: a blog is read by whoever may read its front page, which is a PAGE
 * rule and not a group-wide one — `config.permissions` reads only the group-wide list, so declaring
 * anything here would refuse the anonymous reader a public blog exists for. The front page is
 * checked in the handler and each post is checked again in the model.
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST A BLOG'S POSTS
   */
  app.get<{
    Params: { siteId: string }
    Querystring: {
      path: string
      locale?: string
      tag?: string
      year?: number
      month?: number
      page?: number
    }
  }>(
    '/sites/:siteId/blogs/posts',
    {
      schema: {
        summary: "List a blog's posts",
        description:
          "One page of a blog's listing, with the tag and archive facets beside it.\n\n`path` is the blog's own path — the page written with the `blog` editor — and the posts are the pages under it, as deep as that blog is configured to collect them. A page with no body of its own is never a post (a redirection is a doorway, and a nested blog is its own blog), and neither is anything under a nested blog: that blog lists its own posts, so no post is ever listed twice.\n\nReadable without a session, because the blog's front page is: an anonymous request sees only published posts, the same set the page view would serve it. Every post is additionally held to `read:pages` at its own path, and the facets are counted over what survives that — a tag cloud that counted pages the reader may not open would be telling them those pages exist.\n\nThe facets describe the whole blog rather than the filtered set, so that picking a tag never removes the control that would undo it.",
        tags: ['Pages'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              maxLength: 2048,
              description: "The blog's own path, without a leading slash."
            },
            locale: {
              type: 'string',
              maxLength: 10,
              description: "The site's primary locale when absent."
            },
            tag: {
              type: 'string',
              maxLength: 255,
              description: 'Only posts carrying this tag.'
            },
            year: {
              type: 'integer',
              minimum: 1,
              maximum: 9999,
              description: 'Only posts published in this year.'
            },
            month: {
              type: 'integer',
              minimum: 1,
              maximum: 12,
              description: 'Only posts published in this month of `year`. Ignored without it.'
            },
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description:
                'Which page of the listing to answer with. Clamped to the last one that exists.'
            }
          },
          required: ['path']
        },
        response: {
          200: {
            description: 'The posts, and what the sidebar should offer',
            type: 'object',
            properties: {
              posts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    path: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    icon: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    publishedAt: {
                      type: 'string',
                      format: 'date-time',
                      description:
                        "The post's publication date: its scheduled start, or when it was created."
                    },
                    updatedAt: { type: 'string', format: 'date-time' },
                    authorId: { type: 'string', format: 'uuid' },
                    authorName: { type: 'string' }
                  }
                }
              },
              total: {
                type: 'integer',
                description: 'How many posts match, ignoring which page was asked for.'
              },
              page: { type: 'integer' },
              pageCount: { type: 'integer' },
              facets: {
                type: 'object',
                properties: {
                  tags: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        tag: { type: 'string' },
                        count: { type: 'integer' }
                      }
                    }
                  },
                  archive: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        year: { type: 'integer' },
                        month: { type: 'integer' },
                        count: { type: 'integer' }
                      }
                    }
                  }
                }
              },
              truncated: {
                type: 'boolean',
                description:
                  'Whether the blog holds more posts than one request will read, and the listing is therefore a prefix of it.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!WIKI.sites[req.params.siteId]) {
        return reply.notFound('This site does not exist.')
      }
      const locale = req.query.locale ?? defaultLocale(req.params.siteId)
      const path = normalizePagePath(req.query.path)
      const blog = await WIKI.models.blogs.blogAt(req.params.siteId, locale, path)
      if (!blog) {
        return reply.notFound('There is no blog at this path.')
      }
      /*
        The front page's own rules decide whether there is a listing to hand out at all. Refused as
        not-found rather than forbidden, which is the same answer the page itself gives: whether a
        blog exists at a path the reader may not read is not something to tell them.
      */
      if (!mayOnPage(req, 'read:pages', { siteId: req.params.siteId, path, locale, tags: [] })) {
        return reply.notFound('There is no blog at this path.')
      }
      return WIKI.models.blogs.listing({
        siteId: req.params.siteId,
        blog,
        actor: WIKI.models.groups.actorForRequest(req),
        publicOnly: !req.session?.authenticated,
        filter: {
          tag: req.query.tag,
          year: req.query.year,
          month: req.query.month,
          page: req.query.page
        }
      })
    }
  )
}

export default routes
