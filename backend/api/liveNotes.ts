import { audit } from '../helpers/audit.ts'
import { CustomError } from '../helpers/common.ts'
import { requestUserId } from '../helpers/requester.ts'
import { KEY_PATTERN, LIVE_NOTE_ACCESS, MAX_KEY_LENGTH } from '../models/liveNotes.ts'
import { userRequired } from './pages.ts'

import type { FastifyReply, FastifyInstance, FastifyRequest } from 'fastify'
import type {
  LiveNoteAccess,
  LiveNoteSummary,
  NotePermissions,
  NoteRequester,
  NoteRights
} from '../models/liveNotes.ts'

/** Who is using live notes, and what they may do with them on the site. See {@link noteCaller}. */
interface NoteCaller extends NoteRequester {
  may: NotePermissions
}

/** The note an image upload was let through for, settled before its body was read. */
const imageTargets = new WeakMap<FastifyRequest, { note: LiveNoteSummary; userId: string }>()

/** The requester as `liveNotes.rightsFor` asks about it. */
function requesterOf(req: FastifyRequest): NoteRequester {
  return { userId: requestUserId(req), actor: WIKI.models.groups.actorForRequest(req) }
}

/**
 * Who may use live notes here, or a refusal.
 *
 * A site that has them switched on, and `read:notes` -- a page rule whose pattern is ignored, asked in
 * the site's primary locale (`liveNotes.permissionsFor`). A guest gets no further than reading, which
 * each route that writes asks of `may.write`. Past that, holding a note's key and the note's own
 * access setting are what decide (`rightsFor`).
 *
 * A system API key acts as nobody and is refused, as it always was: reading a note is following
 * people's writing as it happens, which is not something to hand to automation acting for a group. A
 * personal access token never gets this far, since none of these routes declares a scope.
 *
 * A guest who may not read notes is answered 401, since signing in may well change that; an account
 * that may not is answered 403 `notesForbidden`.
 */
function noteCaller(req: FastifyRequest, reply: FastifyReply, siteId: string): NoteCaller | null {
  if (!WIKI.sites[siteId]) {
    reply.notFound('Site does not exist.')
    return null
  }
  const requester = requesterOf(req)
  if (req.apiKey && !requester.userId) {
    reply.unauthorized(userRequired(req, 'Using live notes'))
    return null
  }
  if (!WIKI.models.liveNotes.isEnabled(siteId)) {
    reply.forbidden('Live notes are disabled on this site.')
    return null
  }
  const may = WIKI.models.liveNotes.permissionsFor(requester, siteId)
  if (!may.read) {
    if (!requester.userId) {
      reply.unauthorized('Reading live notes on this site requires a signed-in user.')
      return null
    }
    throw new CustomError('notesForbidden', 'You may not use live notes on this site.', 403)
  }
  return { ...requester, may }
}

/**
 * The caller as somebody who may create notes: signed in, with `write:notes`. A guest is told to sign
 * in, and an account without the permission is answered 403 `noteWriteForbidden`.
 */
function noteWriter(
  req: FastifyRequest,
  reply: FastifyReply,
  siteId: string
): (NoteCaller & { userId: string }) | null {
  const caller = noteCaller(req, reply, siteId)
  if (!caller) {
    return null
  }
  if (!caller.userId) {
    reply.unauthorized(userRequired(req, 'Creating a live note'))
    return null
  }
  if (!caller.may.write) {
    throw new CustomError('noteWriteForbidden', 'You may not create live notes on this site.', 403)
  }
  return caller as NoteCaller & { userId: string }
}

/**
 * The note a key names on this site and what this caller may do with it, or a refusal: 404 for a key
 * with the wrong shape as much as an unknown one, and 403 `notePrivate` for a private note that is not
 * theirs -- a code of its own, so the note view can say that rather than that notes are switched off.
 */
async function noteFor(
  req: FastifyRequest,
  reply: FastifyReply,
  caller: NoteCaller
): Promise<{ note: LiveNoteSummary; rights: NoteRights } | null> {
  const { siteId, key } = req.params as { siteId: string; key: string }
  const note = await WIKI.models.liveNotes.getByKey(siteId, key)
  if (!note) {
    reply.notFound('This note does not exist.')
    return null
  }
  const rights = WIKI.models.liveNotes.rightsFor(note, caller)
  if (!rights.read) {
    throw new CustomError('notePrivate', 'This note is private.', 403)
  }
  return { note, rights }
}

const personSchema = {
  type: ['object', 'null'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' }
  }
}

const noteSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    key: { type: 'string' },
    title: { type: 'string' },
    access: {
      type: 'string',
      enum: [...LIVE_NOTE_ACCESS],
      description:
        'What everybody but the note’s owners may do: `editable` (read and write), `locked` (read), `private` (nothing).'
    },
    canManage: {
      type: 'boolean',
      description:
        'Whether the caller may change the note’s access and delete it: its creator while they hold `write:notes`, or `manage:system`.'
    },
    canWrite: { type: 'boolean', description: 'Whether the caller may write in the note.' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When somebody last typed into the note.'
    },
    creator: {
      ...personSchema,
      description: 'Who created the note. Null once that account is deleted.'
    },
    lastEditor: {
      ...personSchema,
      description:
        'Who typed into the note last. Null for a note nobody has typed into yet, or once that account is deleted.'
    }
  }
}

const noteKeySchema = {
  type: 'string',
  minLength: 1,
  maxLength: MAX_KEY_LENGTH,
  pattern: KEY_PATTERN.source
}

const noteParams = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    key: noteKeySchema
  },
  required: ['siteId', 'key']
}

/**
 * Live Notes API Routes
 *
 * Creating a note, reading what it was, and its owners' say over it. Writing into one is not a route at
 * all: it happens over the collaboration socket, `/_collab/:siteId/notes/:key`, whose room stores the
 * note as it changes — see `core/collab.ts`.
 *
 * No route-level permissions: `read:notes` and `write:notes` are page rules whose pattern is ignored,
 * asked in the site's primary locale (`liveNotes.permissionsFor`), and past them it is the note's key
 * and whatever its access allows. A guest granted `read:notes` may read a note and its revisions, and
 * nothing else.
 */
async function routes(app: FastifyInstance) {
  // -> An image arrives as the raw file, as an asset upload does, and whatever type it claims: what
  //    it is gets read off its bytes. JSON keeps its own parser, so the other routes are unaffected.
  //    The limit is fixed at registration, as it is for the asset upload.
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: WIKI.config.security?.uploadMaxFileSize ?? 10485760 },
    (req, body, done) => {
      done(null, body)
    }
  )

  /**
   * LIVE NOTES ACCESS
   */
  // -> `_access` because `access` is a key somebody could pick, and would then name this rather than
  //    their note. No key has an underscore in it (`KEY_PATTERN`).
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/notes/_access',
    {
      schema: {
        summary: 'What the caller may do with live notes',
        description:
          'Whether the site has live notes, and whether the caller may read them and create and write in them. This is what decides whether the interface offers live notes at all, and is asked once per site and session.\n\n`read:notes` and `write:notes` are page permissions whose rule’s path is ignored, asked in the site’s primary locale. `write:notes` implies `read:notes`, and is never a guest’s.',
        tags: ['Live Notes'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId']
        },
        response: {
          200: {
            description: 'Live notes access of the caller',
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                description:
                  'The site’s `features.liveNotes` switch, together with `features.collaborativeEditing`.'
              },
              canRead: {
                type: 'boolean',
                description: 'Whether the caller may open a note from its link: `read:notes`.'
              },
              canWrite: {
                type: 'boolean',
                description: 'Whether the caller may create notes and write in them: `write:notes`.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!WIKI.sites[req.params.siteId]) {
        return reply.notFound('Site does not exist.')
      }
      const requester = requesterOf(req)
      const enabled = WIKI.models.liveNotes.isEnabled(req.params.siteId)
      // -> A system API key is refused every other route here, so it may do nothing
      const may =
        enabled && !(req.apiKey && !requester.userId)
          ? WIKI.models.liveNotes.permissionsFor(requester, req.params.siteId)
          : { read: false, write: false }
      return { enabled, canRead: may.read, canWrite: may.write }
    }
  )

  /**
   * LIST MY NOTES
   */
  app.get<{
    Params: { siteId: string }
    Querystring: { page?: number; limit?: number; filter?: string }
  }>(
    '/sites/:siteId/notes',
    {
      schema: {
        summary: 'List my live notes',
        description:
          'The live notes the caller created on this site, newest first. Only ever the caller’s own: a note’s key is its credential, and nobody else’s is listed anywhere.\n\nNeeds a signed-in account holding `read:notes`, not `write:notes`: a creator who has since lost the right to write can still find their notes, and read them.',
        tags: ['Live Notes'],
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
              maxLength: 255,
              description: 'Matched against the title, case-insensitively.'
            },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              notes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: noteSchema.properties.id,
                    key: noteSchema.properties.key,
                    title: noteSchema.properties.title,
                    access: noteSchema.properties.access,
                    createdAt: noteSchema.properties.createdAt,
                    updatedAt: noteSchema.properties.updatedAt
                  }
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const caller = noteCaller(req, reply, req.params.siteId)
      if (!caller) {
        return reply
      }
      // -> A guest created nothing
      if (!caller.userId) {
        return reply.unauthorized(userRequired(req, 'Listing your live notes'))
      }
      const page = req.query.page ?? 1
      const limit = req.query.limit ?? 20
      const { total, notes } = await WIKI.models.liveNotes.listByCreator({
        siteId: req.params.siteId,
        creatorId: caller.userId,
        filter: req.query.filter?.trim() ?? '',
        page,
        limit
      })
      return {
        page,
        limit,
        total,
        notes: notes.map((note) => ({
          id: note.id,
          key: note.key,
          title: note.title,
          access: note.access,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString()
        }))
      }
    }
  )

  /**
   * CREATE A NOTE
   */
  app.post<{ Params: { siteId: string }; Body: { key?: string } | undefined }>(
    '/sites/:siteId/notes',
    {
      schema: {
        summary: 'Create a live note',
        description:
          'Creates an empty live note and answers with its key, which is what its URL, `/n/<key>`, is made of. A new note is `editable`: anybody who holds the key and `write:notes` can write in it, and anybody holding `read:notes` can read it — a guest included, where the guests group is granted it — so the key is 24 characters drawn from a cryptographic source and never listed anywhere. Its creator can lock it or make it private afterwards.\n\nA `key` in the body creates the note under that key instead — 1 to 64 letters, digits and hyphens, case-sensitive — which is what visiting `/n/<key>` for a note that does not exist yet does. A key a note on the site already has answers 409 `noteExists`. A picked key is only as hard to guess as whoever picked it made it.\n\nA note nobody writes anything in is deleted a day after it was created.\n\nNeeds a signed-in account holding `write:notes` (a page rule whose path is ignored, asked in the site’s primary locale; 403 `noteWriteForbidden` without it), and the site’s `features.liveNotes` switch, which in turn needs `features.collaborativeEditing`.',
        tags: ['Live Notes'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId']
        },
        body: {
          type: ['object', 'null'],
          properties: {
            key: {
              ...noteKeySchema,
              description: 'The key to create the note under. Left out, one is generated.'
            }
          }
        },
        response: {
          200: {
            description: 'The note was created',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              note: noteSchema
            }
          }
        }
      }
    },
    async (req, reply) => {
      const caller = noteWriter(req, reply, req.params.siteId)
      if (!caller) {
        return reply
      }
      const note = await WIKI.models.liveNotes.create({
        siteId: req.params.siteId,
        creatorId: caller.userId,
        key: req.body?.key
      })

      // -> The id and never the key: the key is the note's credential, and the audit log is read by
      //    people the note was not shared with
      await audit(req, 'page', 'createLiveNote', {
        noteId: note.id,
        siteId: req.params.siteId
      })

      const rights = WIKI.models.liveNotes.rightsFor(note, caller)
      return { ok: true, note: await WIKI.models.liveNotes.describe(note, rights) }
    }
  )

  /**
   * GET A NOTE
   */
  app.get<{ Params: { siteId: string; key: string } }>(
    '/sites/:siteId/notes/:key',
    {
      schema: {
        summary: 'Get a live note',
        description:
          'What the note at `/n/<key>` is: its id, its title — the first heading of its content — who created it and when, who last typed into it and when, its access, and what the caller may do with it. Its content is not here; an editor gets that from the collaboration room it joins.\n\nNeeds `read:notes`, which a guest may be granted: a caller without it is answered 401 when signed out and 403 `notesForbidden` when signed in. A private note answers 403 `notePrivate` to everybody but its owners.',
        tags: ['Live Notes'],
        params: noteParams,
        response: {
          200: noteSchema
        }
      }
    },
    async (req, reply) => {
      const caller = noteCaller(req, reply, req.params.siteId)
      if (!caller) {
        return reply
      }
      const found = await noteFor(req, reply, caller)
      return found ? WIKI.models.liveNotes.describe(found.note, found.rights) : reply
    }
  )

  /**
   * LIST A NOTE'S REVISIONS
   */
  app.get<{ Params: { siteId: string; key: string } }>(
    '/sites/:siteId/notes/:key/revisions',
    {
      schema: {
        summary: 'List the revisions of a live note',
        description:
          'The note as it stood over time, newest first: one revision per few minutes of writing, and one whenever the last participant leaves. Each names who wrote into the note since the revision before it, and how long the content was; the content itself is fetched one revision at a time.',
        tags: ['Live Notes'],
        params: noteParams,
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                length: { type: 'integer' },
                createdAt: { type: 'string', format: 'date-time' },
                authors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      name: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const caller = noteCaller(req, reply, req.params.siteId)
      if (!caller) {
        return reply
      }
      const found = await noteFor(req, reply, caller)
      return found ? WIKI.models.liveNotes.listRevisions(found.note.id) : reply
    }
  )

  /**
   * GET ONE REVISION
   */
  app.get<{ Params: { siteId: string; key: string; revisionId: string } }>(
    '/sites/:siteId/notes/:key/revisions/:revisionId',
    {
      schema: {
        summary: 'Get a revision of a live note',
        description: 'The markdown source of the note as it stood at one revision.',
        tags: ['Live Notes'],
        params: {
          type: 'object',
          properties: {
            ...noteParams.properties,
            revisionId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'key', 'revisionId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              content: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const caller = noteCaller(req, reply, req.params.siteId)
      if (!caller) {
        return reply
      }
      const found = await noteFor(req, reply, caller)
      if (!found) {
        return reply
      }
      const revision = await WIKI.models.liveNotes.getRevision(found.note.id, req.params.revisionId)
      return revision ?? reply.notFound('This revision does not exist.')
    }
  )

  /**
   * ADD AN IMAGE TO A NOTE
   */
  app.post<{ Params: { siteId: string; key: string } }>(
    '/sites/:siteId/notes/:key/images',
    {
      /*
        Everything the handler would refuse on is decided here, before the body is read: parsing it
        buffers the whole file, and a refusal that waited for that would let anybody holding a locked
        note's key make the server hold `uploadMaxFileSize` per request just to be told no. The params
        have not been through the schema yet, which `getByKey` copes with -- a key of the wrong shape
        is simply no note.
      */
      preParsing: async (req, reply, payload) => {
        const { siteId } = req.params
        if (typeof siteId !== 'string' || !WIKI.sites[siteId]) {
          throw app.httpErrors.notFound('Site does not exist.')
        }
        const requester = requesterOf(req)
        const userId = requester.userId
        if (!userId) {
          throw app.httpErrors.unauthorized(userRequired(req, 'Adding an image to a live note'))
        }
        if (!WIKI.models.liveNotes.isEnabled(siteId)) {
          throw app.httpErrors.forbidden('Live notes are disabled on this site.')
        }
        if (!WIKI.models.liveNotes.permissionsFor(requester, siteId).read) {
          throw new CustomError('notesForbidden', 'You may not use live notes on this site.', 403)
        }
        const note = await WIKI.models.liveNotes.getByKey(siteId, String(req.params.key ?? ''))
        if (!note) {
          throw app.httpErrors.notFound('This note does not exist.')
        }
        const rights = WIKI.models.liveNotes.rightsFor(note, requester)
        if (!rights.read) {
          throw new CustomError('notePrivate', 'This note is private.', 403)
        }
        if (!rights.write) {
          throw note.access === 'editable'
            ? new CustomError(
                'noteWriteForbidden',
                'You may not write in live notes on this site.',
                403
              )
            : app.httpErrors.forbidden('This note is locked.')
        }
        imageTargets.set(req, { note, userId })
        return payload
      },
      schema: {
        summary: 'Add an image to a live note',
        description: `The body is the image itself, not a multipart form. At most ${Math.round((WIKI.config.security?.uploadMaxFileSize ?? 10485760) / 1024 / 1024)} MB. PNG, JPEG, GIF, WebP or SVG, decided by the bytes rather than the \`Content-Type\` — anything else is refused. An SVG is sanitized first when the security settings say to scan SVG uploads.\n\nThe image is stored under a random name in a folder of the site that no listing shows, and wherever else the site stores images, and answers with the URL to put in the note: \`/_files/n/<uuid>.<ext>\`, which anybody who may read the site’s live notes can load. It is deleted with the note.\n\nNeeds write access to the note, and so \`write:notes\`. Never a guest’s.`,
        tags: ['Live Notes'],
        consumes: ['*/*'],
        params: noteParams,
        response: {
          200: {
            description: 'The image was added',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              url: {
                type: 'string',
                description: 'Where the image is served from, as a path from the site root.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const data = req.body
      if (!Buffer.isBuffer(data) || data.length < 1) {
        return reply.badRequest('No image was sent.')
      }
      const { note, userId } = imageTargets.get(req)!
      const { url } = await WIKI.models.liveNotes.addImage({ note, data, authorId: userId })

      // -> The ids and never the URL: an image's name is what lets somebody load it, as the key is
      //    what lets somebody into the note
      await audit(req, 'page', 'addLiveNoteImage', {
        noteId: note.id,
        siteId: req.params.siteId,
        fileSize: data.length
      })

      return { ok: true, url }
    }
  )

  /**
   * DELETE A NOTE
   */
  app.delete<{ Params: { siteId: string; key: string } }>(
    '/sites/:siteId/notes/:key',
    {
      schema: {
        summary: 'Delete a live note',
        description:
          'Deletes the note at `/n/<key>`, every revision of it and every image added to it. Anybody still editing it is disconnected, on every instance, and told the note is gone.\n\nOnly the account that created the note may delete it, while it holds `write:notes`, or one holding `manage:system`. Holding the key lets somebody write in a note; it does not let them delete it.',
        tags: ['Live Notes'],
        params: noteParams,
        response: {
          200: {
            description: 'The note was deleted',
            type: 'object',
            properties: {
              ok: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const caller = noteCaller(req, reply, req.params.siteId)
      if (!caller) {
        return reply
      }
      const found = await noteFor(req, reply, caller)
      if (!found) {
        return reply
      }
      const { note, rights } = found
      if (!rights.manage) {
        return reply.forbidden('Only the creator of a note may delete it.')
      }
      await WIKI.models.liveNotes.delete(note, caller.userId ?? undefined)
      WIKI.collab.noteDeleted(note.id)

      // -> The id and never the key, as on creation
      await audit(req, 'page', 'deleteLiveNote', {
        noteId: note.id,
        siteId: req.params.siteId
      })

      return { ok: true }
    }
  )

  /**
   * CHANGE A NOTE'S ACCESS
   */
  app.put<{ Params: { siteId: string; key: string }; Body: { access: LiveNoteAccess } }>(
    '/sites/:siteId/notes/:key/access',
    {
      schema: {
        summary: 'Change who may read and write a live note',
        description:
          'What everybody but the note’s owners may do with it: `editable` (read and write — the default), `locked` (read only) or `private` (nothing; the note answers 403 `notePrivate`). Its owners — whoever created it, while they hold `write:notes`, and `manage:system` — may always do everything; `read:notes` and `write:notes` still bound what everybody else may do.\n\nEverybody else in the note when it changes is disconnected, on every instance, and rejoins as whatever they now are. The owners’ own sessions are untouched.\n\nOnly an owner may change it.',
        tags: ['Live Notes'],
        params: noteParams,
        body: {
          type: 'object',
          required: ['access'],
          properties: {
            access: { type: 'string', enum: [...LIVE_NOTE_ACCESS] }
          }
        },
        response: {
          200: {
            description: 'The access was changed',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              access: { type: 'string', enum: [...LIVE_NOTE_ACCESS] }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const caller = noteCaller(req, reply, req.params.siteId)
      if (!caller) {
        return reply
      }
      const found = await noteFor(req, reply, caller)
      if (!found) {
        return reply
      }
      const { note, rights } = found
      if (!rights.manage) {
        return reply.forbidden('Only the creator of a note may change who can use it.')
      }
      if (req.body.access !== note.access) {
        await WIKI.models.liveNotes.setAccess(note.id, req.body.access)
        WIKI.collab.noteAccessChanged(note.id)

        // -> The setting itself is what gets asked about later, and none of it is a secret
        await audit(req, 'page', 'changeLiveNoteAccess', {
          noteId: note.id,
          siteId: req.params.siteId,
          access: req.body.access
        })
      }

      return { ok: true, access: req.body.access }
    }
  )
}

export default routes
