import { validate as uuidValidate } from 'uuid'

import { mayOnPage } from '../api/pages.ts'

import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'

/**
 * _collab Routes
 *
 * The websocket behind live collaborative editing. One socket per editor, one room per page or live
 * note — see `core/collab.ts` for what a room is and how rooms find each other across instances.
 *
 * Unlike its neighbours under `controllers/`, nothing here is public. A room carries a page's unsaved
 * text and everyone's cursor, so joining one takes a session that may edit that page — the same
 * `write:pages` the save itself takes, checked against the page rather than against the group's
 * permission list. Whoever may only *suggest* edits does not qualify, which is what keeps a suggestion
 * the private draft it is meant to be.
 *
 * The handshake is the only place authorization happens: a socket is checked once, when it opens, and
 * a permission taken away mid-session takes effect the next time the editor is opened.
 */
async function routes(app: FastifyInstance) {
  app.get<{ Params: { siteId: string; pageId: string } }>(
    '/:siteId/:pageId',
    { websocket: true, schema: { hide: true } },
    async (
      socket: WebSocket,
      req: FastifyRequest<{ Params: { siteId: string; pageId: string } }>
    ) => {
      const { siteId, pageId } = req.params

      /*
        Before the first `await`, and that is the point: the client starts talking as soon as the
        socket is open, which is well before the checks below have finished asking the database
        anything. See `capture` in `core/collab.ts`.
      */
      const session = WIKI.collab.capture(socket)

      /*
        Refusals close the socket rather than answering with anything: the client is y-websocket, which
        speaks the sync protocol and nothing else, and it treats a close as the signal to back off.
        The codes are in the private 4000 range, where the browser hands them to the page — which is
        how the editor tells "you may not edit this" apart from "the connection dropped" and knows not
        to reconnect. See `composables/collab.js`.
      */
      if (!uuidValidate(siteId) || !uuidValidate(pageId)) {
        return socket.close(4400, 'Invalid site or page id')
      }
      if (!req.session?.authenticated) {
        return socket.close(4401, 'Authentication is required')
      }
      if (!WIKI.sites[siteId]?.config?.features?.collaborativeEditing) {
        return socket.close(4403, 'Collaborative editing is disabled on this site')
      }

      const page = await WIKI.models.pages.getPage({ siteId, id: pageId })
      if (!page) {
        return socket.close(4404, 'This page does not exist')
      }
      if (!mayOnPage(req, 'write:pages', page)) {
        return socket.close(4403, 'You are not allowed to edit this page')
      }

      await WIKI.collab.join(socket, { kind: 'page', id: pageId, siteId }, session, {
        userId: req.session.user!.id
      })
    }
  )

  /*
    A live note's room, addressed by the note's key. There is no page to ask about: `read:notes` and
    `write:notes`, the key, and the note's own access setting are the whole of its access control (see
    `rightsFor` in `models/liveNotes.ts`).

    The one room a guest may join, where the guests group holds `read:notes` -- as a reader, which is
    following the note as it is written. Nothing a reader sends of the document is kept.
  */
  app.get<{ Params: { siteId: string; noteKey: string } }>(
    '/:siteId/notes/:noteKey',
    { websocket: true, schema: { hide: true } },
    async (
      socket: WebSocket,
      req: FastifyRequest<{ Params: { siteId: string; noteKey: string } }>
    ) => {
      const { siteId, noteKey } = req.params

      // -> Before the first `await`, for the reason given on the page route above
      const session = WIKI.collab.capture(socket)

      if (!uuidValidate(siteId) || !WIKI.models.liveNotes.isValidKey(noteKey)) {
        return socket.close(4400, 'Invalid site id or note key')
      }
      if (!WIKI.models.liveNotes.isEnabled(siteId)) {
        return socket.close(4403, 'Live notes are disabled on this site')
      }
      const userId = req.session?.authenticated && req.session.user?.id ? req.session.user.id : null
      const requester = { userId, actor: WIKI.models.groups.actorForRequest(req) }
      if (!WIKI.models.liveNotes.permissionsFor(requester, siteId).read) {
        return userId
          ? socket.close(4403, 'You may not use live notes on this site')
          : socket.close(4401, 'Authentication is required')
      }

      const note = await WIKI.models.liveNotes.getByKey(siteId, noteKey)
      if (!note) {
        return socket.close(4404, 'This note does not exist')
      }
      const rights = WIKI.models.liveNotes.rightsFor(note, requester)
      if (!rights.read) {
        return socket.close(4403, 'This note is private')
      }

      // -> Whoever may not write joins as a reader -- of a locked note, without `write:notes`, or as
      //    a guest: the room drops what they send
      await WIKI.collab.join(socket, { kind: 'note', id: note.id, siteId }, session, {
        userId,
        readOnly: !rights.write,
        manager: rights.manage
      })
    }
  )
}

export default routes
