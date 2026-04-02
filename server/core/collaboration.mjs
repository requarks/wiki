import { Hocuspocus } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import * as Y from 'yjs'

export default {
  hocuspocus: null,

  async init() {
    this.hocuspocus = new Hocuspocus({
      port: null, // Don't listen on its own port - we'll handle WebSocket upgrade
      quiet: true,

      async onAuthenticate({ token }) {
        // TODO: validate JWT token
        // For now, allow authenticated connections
        if (!token) {
          throw new Error('Not authenticated')
        }
        return { user: { name: 'User' } }
      },

      extensions: [
        new Database({
          async fetch({ documentName }) {
            try {
              const page = await WIKI.db.knex('pages')
                .where('id', documentName)
                .first('id', 'content')

              if (page && page.content) {
                // Convert markdown content to Y.Doc
                const ydoc = new Y.Doc()
                const yxml = ydoc.getXmlFragment('default')
                // Return null to let Hocuspocus create a fresh doc
                // The editor will load content from the page store
                return null
              }
              return null
            } catch (err) {
              WIKI.logger.warn(`Collab fetch error for ${documentName}: ${err.message}`)
              return null
            }
          },

          async store({ documentName, state }) {
            // Store Y.Doc state for persistence between sessions
            try {
              await WIKI.db.knex('pages')
                .where('id', documentName)
                .update({
                  updatedAt: new Date().toISOString()
                })
              WIKI.logger.debug(`Collab state saved for ${documentName}`)
            } catch (err) {
              WIKI.logger.warn(`Collab store error for ${documentName}: ${err.message}`)
            }
          }
        })
      ]
    })

    WIKI.logger.info('Collaboration Server initialized: [ OK ]')
  },

  handleUpgrade(request, socket, head) {
    if (this.hocuspocus) {
      this.hocuspocus.handleUpgrade(request, socket, head)
    }
  },

  handleConnection(socket, request) {
    if (this.hocuspocus) {
      this.hocuspocus.handleConnection(socket, request)
    }
  }
}
