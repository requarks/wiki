import { validate as uuidValidate } from 'uuid'

import { mayOnPage } from '../api/pages.ts'

import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'

/**
 * _collab Routes
 *
 * The websocket behind live collaborative editing. One socket per editor, one room per page — see
 * `core/collab.ts` for what a room is and how rooms find each other across instances.
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

      await WIKI.collab.join(socket, { id: pageId, siteId }, session)
    }
  )
}

export default routes
