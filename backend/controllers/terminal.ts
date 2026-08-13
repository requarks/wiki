import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'

/**
 * _terminal Routes
 *
 * The websocket behind the admin area's terminal view, which streams this instance's log lines to a
 * browser as they are written. Read-only: nothing a client sends is looked at, and the socket carries
 * exactly what `core/logger.ts` hands to `console.log`, formatted string and all — including the ANSI
 * colours, which xterm renders.
 *
 * Only this instance's own main thread is on that stream. Worker threads build their own logger
 * (`worker.ts`), and other instances write to their own consoles, so a clustered deployment shows the
 * terminal of whichever instance the socket happened to land on.
 *
 * Log lines quote paths, e-mail addresses and query failures, so the handshake takes `manage:system`
 * — the same permission as the rest of the system views, and never granted to a group by accident.
 */

/**
 * How much unsent traffic a client may accumulate before its stream starts skipping lines.
 *
 * A browser that has stopped reading — a backgrounded tab on a slow link, most likely — would
 * otherwise have the server hold every line since it stalled. Dropping is right here: the terminal is
 * a live view of what is happening now, not a transcript that has to be complete.
 */
const MAX_BUFFERED = 1048576 // 1mb

async function routes(app: FastifyInstance) {
  app.get(
    '/logs',
    { websocket: true, schema: { hide: true } },
    (socket: WebSocket, req: FastifyRequest) => {
      /*
        Refusals close the socket with a code in the private 4000 range, where the browser hands both
        code and reason to the page — which is how the terminal can print why it was turned away and
        know not to offer a reconnect. See `pages/AdminTerminal.vue`.
      */
      if (!req.session?.authenticated) {
        return socket.close(4401, 'Authentication is required')
      }
      if (!req.session.permissions?.includes('manage:system')) {
        return socket.close(4403, 'You are not allowed to read the server logs')
      }

      const send = (line: string) => {
        if (socket.readyState !== socket.OPEN || socket.bufferedAmount > MAX_BUFFERED) {
          return
        }
        socket.send(line)
      }

      // -> A terminal that opens onto an idle server would otherwise sit empty and look broken
      for (const line of WIKI.logger.backlog()) {
        send(line)
      }

      WIKI.logger.ws.on('log', send)
      socket.on('close', () => {
        WIKI.logger.ws.off('log', send)
      })
    }
  )
}

export default routes
