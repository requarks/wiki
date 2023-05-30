import fs from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { isEmpty } from 'lodash-es'
import { Server as IoServer } from 'socket.io'
import { ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageProductionDefault } from '@apollo/server/plugin/landingPage/default'
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs'

import { initSchema } from '../graph/index.mjs'

export default {
  graph: null,
  http: null,
  https: null,
  ws: null,
  connections: new Map(),
  le: null,
  /**
   * Initialize HTTP Server
   */
  async initHTTP () {
    WIKI.logger.info(`HTTP Server on port: [ ${WIKI.config.port} ]`)
    this.http = http.createServer(WIKI.app)

    this.http.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error
      }

      switch (error.code) {
        case 'EACCES':
          WIKI.logger.error('Listening on port ' + WIKI.config.port + ' requires elevated privileges!')
          return process.exit(1)
        case 'EADDRINUSE':
          WIKI.logger.error('Port ' + WIKI.config.port + ' is already in use!')
          return process.exit(1)
        default:
          throw error
      }
    })

    this.http.on('listening', () => {
      WIKI.logger.info('HTTP Server: [ RUNNING ]')
    })

    this.http.on('connection', conn => {
      let connKey = `http:${conn.remoteAddress}:${conn.remotePort}`
      this.connections.set(connKey, conn)
      conn.on('close', () => {
        this.connections.delete(connKey)
      })
    })
  },
  /**
   * Start HTTP Server
   */
  async startHTTP () {
    this.http.listen(WIKI.config.port, WIKI.config.bindIP)
  },
  /**
   * Initialize HTTPS Server
   */
  async initHTTPS () {
    if (WIKI.config.ssl.provider === 'letsencrypt') {
      this.le = require('./letsencrypt')
      await this.le.init()
    }

    WIKI.logger.info(`HTTPS Server on port: [ ${WIKI.config.ssl.port} ]`)
    const tlsOpts = {}
    try {
      if (WIKI.config.ssl.format === 'pem') {
        tlsOpts.key = WIKI.config.ssl.inline ? WIKI.config.ssl.key : await fs.readFile(WIKI.config.ssl.key, 'utf-8')
        tlsOpts.cert = WIKI.config.ssl.inline ? WIKI.config.ssl.cert : await fs.readFile(WIKI.config.ssl.cert, 'utf-8')
      } else {
        tlsOpts.pfx = WIKI.config.ssl.inline ? WIKI.config.ssl.pfx : await fs.readFile(WIKI.config.ssl.pfx, 'utf-8')
      }
      if (!isEmpty(WIKI.config.ssl.passphrase)) {
        tlsOpts.passphrase = WIKI.config.ssl.passphrase
      }
      if (!isEmpty(WIKI.config.ssl.dhparam)) {
        tlsOpts.dhparam = WIKI.config.ssl.dhparam
      }
    } catch (err) {
      WIKI.logger.error('Failed to setup HTTPS server parameters:')
      WIKI.logger.error(err)
      return process.exit(1)
    }
    this.https = https.createServer(tlsOpts, WIKI.app)

    this.https.listen(WIKI.config.ssl.port, WIKI.config.bindIP)
    this.https.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error
      }

      switch (error.code) {
        case 'EACCES':
          WIKI.logger.error('Listening on port ' + WIKI.config.ssl.port + ' requires elevated privileges!')
          return process.exit(1)
        case 'EADDRINUSE':
          WIKI.logger.error('Port ' + WIKI.config.ssl.port + ' is already in use!')
          return process.exit(1)
        default:
          throw error
      }
    })

    this.https.on('listening', () => {
      WIKI.logger.info('HTTPS Server: [ RUNNING ]')
    })

    this.https.on('connection', conn => {
      let connKey = `https:${conn.remoteAddress}:${conn.remotePort}`
      this.connections.set(connKey, conn)
      conn.on('close', () => {
        this.connections.delete(connKey)
      })
    })
  },
  /**
   * Start HTTPS Server
   */
  async startHTTPS () {
    this.https.listen(WIKI.config.ssl.port, WIKI.config.bindIP)
  },
  /**
   * Start GraphQL Server
   */
  async startGraphQL () {
    const graphqlSchema = await initSchema()
    this.graph = new ApolloServer({
      schema: graphqlSchema,
      allowBatchedHttpRequests: true,
      csrfPrevention: true,
      cache: 'bounded',
      plugins: [
        process.env.NODE_ENV === 'production' ? ApolloServerPluginLandingPageProductionDefault({
          footer: false
        }) : ApolloServerPluginLandingPageLocalDefault({
          footer: false,
          embed: {
            endpointIsEditable: false,
            runTelemetry: false
          }
        })
        // ApolloServerPluginDrainHttpServer({ httpServer: this.http })
        // ...(this.https && ApolloServerPluginDrainHttpServer({ httpServer: this.https }))
      ]
    })
    await this.graph.start()
    WIKI.app.use(graphqlUploadExpress({
      maxFileSize: WIKI.config.security.uploadMaxFileSize,
      maxFiles: WIKI.config.security.uploadMaxFiles
    }))
    WIKI.app.use('/_graphql', expressMiddleware(this.graph, {
      context: ({ req, res }) => ({ req, res })
    }))
  },
  /**
   * Start Socket.io WebSocket Server
   */
  async initWebSocket() {
    if (this.https) {
      this.ws = new IoServer(this.https, {
        path: '/_ws/',
        serveClient: false
      })
      WIKI.logger.info(`WebSocket Server attached to HTTPS Server [ OK ]`)
    } else {
      this.ws = new IoServer(this.http, {
        path: '/_ws/',
        serveClient: false,
        cors: true // TODO: dev only, replace with app settings once stable
      })
      WIKI.logger.info(`WebSocket Server attached to HTTP Server [ OK ]`)
    }
  },
  /**
   * Close all active connections
   */
  closeConnections (mode = 'all') {
    for (const [key, conn] of this.connections) {
      if (mode !== `all` && key.indexOf(`${mode}:`) !== 0) {
        continue
      }
      conn.destroy()
      this.connections.delete(key)
    }
    if (mode === 'all') {
      this.connections.clear()
    }
  },
  /**
   * Stop all servers
   */
  async stopServers () {
    this.closeConnections()
    if (this.http) {
      await new Promise(resolve => this.http.close(resolve))
      this.http = null
    }
    if (this.https) {
      await new Promise(resolve => this.https.close(resolve))
      this.https = null
    }
    this.graph = null
  },
  /**
   * Restart Server
   */
  async restartServer (srv = 'https') {
    this.closeConnections(srv)
    switch (srv) {
      case 'http':
        if (this.http) {
          await new Promise(resolve => this.http.close(resolve))
          this.http = null
        }
        this.initHTTP()
        this.startHTTP()
        break
      case 'https':
        if (this.https) {
          await new Promise(resolve => this.https.close(resolve))
          this.https = null
        }
        this.initHTTPS()
        this.startHTTPS()
        break
      default:
        throw new Error('Cannot restart server: Invalid designation')
    }
  }
}
