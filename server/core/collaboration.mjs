import { Hocuspocus } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { WebSocketServer } from 'ws'

export default {
  server: null,
  wss: null,

  async init(httpServer) {
    this.server = new Hocuspocus({
      port: null,
      quiet: true,

      async onAuthenticate({ token }) {
        if (!token || token === 'anonymous') {
          throw new Error('Not authenticated')
        }
        return { user: { name: 'User' } }
      },

      extensions: [
        new Database({
          async fetch({ documentName }) {
            WIKI.logger.debug(`Collab: fetch doc ${documentName}`)
            return null
          },
          async store({ documentName, state }) {
            WIKI.logger.debug(`Collab: store doc ${documentName}`)
          }
        })
      ]
    })

    // Create a WebSocket server without its own HTTP server
    this.wss = new WebSocketServer({ noServer: true })

    // Handle upgrade on the main HTTP server
    if (httpServer) {
      httpServer.on('upgrade', (request, socket, head) => {
        if (request.url && request.url.startsWith('/_collab')) {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            WIKI.logger.info(`Collab: WebSocket client connected for ${request.url}`)
            this.server.handleConnection(ws, request)
          })
        }
      })
    }

    WIKI.logger.info('Collaboration Server initialized: [ OK ]')
  }
}
