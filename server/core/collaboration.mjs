import { Server as HocuspocusServer } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import * as Y from 'yjs'

export default {
  server: null,

  async init(httpServer) {
    this.server = HocuspocusServer.configure({
      quiet: true,

      async onAuthenticate({ token }) {
        // Allow all authenticated users (token is passed from frontend)
        if (!token || token === 'anonymous') {
          throw new Error('Not authenticated')
        }
        return { user: { name: 'User' } }
      },

      extensions: [
        new Database({
          async fetch({ documentName }) {
            try {
              WIKI.logger.debug(`Collab: fetching document ${documentName}`)
              return null // Let Hocuspocus create fresh doc, editor loads content from store
            } catch (err) {
              WIKI.logger.warn(`Collab fetch error: ${err.message}`)
              return null
            }
          },
          async store({ documentName, state }) {
            try {
              WIKI.logger.debug(`Collab: storing state for ${documentName}`)
            } catch (err) {
              WIKI.logger.warn(`Collab store error: ${err.message}`)
            }
          }
        })
      ]
    })

    // Attach to HTTP server for WebSocket upgrade
    if (httpServer) {
      httpServer.on('upgrade', (request, socket, head) => {
        if (request.url && request.url.startsWith('/_collab')) {
          this.server.handleUpgrade(request, socket, head)
        }
      })
    }

    WIKI.logger.info('Collaboration Server initialized: [ OK ]')
  }
}
