const fs = require('fs-extra')
const http = require('http')
const https = require('https')
const { ApolloServer } = require('apollo-server-express')
const Promise = require('bluebird')
const _ = require('lodash')
const io = require('socket.io')
const { ApolloServerPluginLandingPageGraphQLPlayground, ApolloServerPluginLandingPageProductionDefault } = require('apollo-server-core')
const { graphqlUploadExpress } = require('graphql-upload')

module.exports = {
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
        tlsOpts.key = WIKI.config.ssl.inline ? WIKI.config.ssl.key : fs.readFileSync(WIKI.config.ssl.key)
        tlsOpts.cert = WIKI.config.ssl.inline ? WIKI.config.ssl.cert : fs.readFileSync(WIKI.config.ssl.cert)
      } else {
        tlsOpts.pfx = WIKI.config.ssl.inline ? WIKI.config.ssl.pfx : fs.readFileSync(WIKI.config.ssl.pfx)
      }
      if (!_.isEmpty(WIKI.config.ssl.passphrase)) {
        tlsOpts.passphrase = WIKI.config.ssl.passphrase
      }
      if (!_.isEmpty(WIKI.config.ssl.dhparam)) {
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
    const graphqlSchema = require('../graph')
    this.graph = new ApolloServer({
      schema: graphqlSchema,
      csrfPrevention: true,
      cache: 'bounded',
      context: ({ req, res }) => ({ req, res }),
      plugins: [
        process.env.NODE_ENV === 'development' ? ApolloServerPluginLandingPageGraphQLPlayground({
          footer: false
        }) : ApolloServerPluginLandingPageProductionDefault({
          footer: false
        })
        // ApolloServerPluginDrainHttpServer({ httpServer: this.http })
        // ...(this.https && ApolloServerPluginDrainHttpServer({ httpServer: this.https }))
      ]
    })
    await this.graph.start()
    WIKI.app.use(graphqlUploadExpress())
    this.graph.applyMiddleware({ app: WIKI.app, cors: false, path: '/_graphql' })
  },
  /**
   * Start Socket.io WebSocket Server
   */
  async initWebSocket() {
    if (this.https) {
      this.ws = new io.Server(this.https, {
        path: '/_ws/',
        serveClient: false
      })
      WIKI.logger.info(`WebSocket Server attached to HTTPS Server [ OK ]`)
    } else {
      this.ws = new io.Server(this.http, {
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
      await Promise.fromCallback(cb => { this.http.close(cb) })
      this.http = null
    }
    if (this.https) {
      await Promise.fromCallback(cb => { this.https.close(cb) })
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
          await Promise.fromCallback(cb => { this.http.close(cb) })
          this.http = null
        }
        this.initHTTP()
        this.startHTTP()
        break
      case 'https':
        if (this.https) {
          await Promise.fromCallback(cb => { this.https.close(cb) })
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
