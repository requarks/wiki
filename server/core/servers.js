const fs = require('fs-extra')
const http = require('http')
const https = require('https')
const { ApolloServer } = require('@apollo/server')
const { expressMiddleware } = require('@as-integrations/express4')
const { WebSocketServer } = require('ws')
const { useServer } = require('graphql-ws/lib/use/ws')
const Promise = require('bluebird')
const _ = require('lodash')
const jwt = require('jsonwebtoken')
const cookie = require('cookie')

/* global WIKI */

module.exports = {
  servers: {
    graph: null,
    http: null,
    https: null
  },
  subscriptionServers: [],
  graphSchema: null,
  connections: new Map(),
  le: null,
  /**
   * Start HTTP Server
   */
  async startHTTP () {
    WIKI.logger.info(`HTTP Server on port: [ ${WIKI.config.port} ]`)
    this.servers.http = http.createServer(WIKI.app)
    this.startSubscriptions(this.servers.http)

    this.servers.http.listen(WIKI.config.port, WIKI.config.bindIP)
    this.servers.http.on('error', (error) => {
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

    this.servers.http.on('listening', () => {
      WIKI.logger.info('HTTP Server: [ RUNNING ]')
    })

    this.servers.http.on('connection', conn => {
      let connKey = `http:${conn.remoteAddress}:${conn.remotePort}`
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
    this.servers.https = https.createServer(tlsOpts, WIKI.app)
    this.startSubscriptions(this.servers.https)

    this.servers.https.listen(WIKI.config.ssl.port, WIKI.config.bindIP)
    this.servers.https.on('error', (error) => {
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

    this.servers.https.on('listening', () => {
      WIKI.logger.info('HTTPS Server: [ RUNNING ]')
    })

    this.servers.https.on('connection', conn => {
      let connKey = `https:${conn.remoteAddress}:${conn.remotePort}`
      this.connections.set(connKey, conn)
      conn.on('close', () => {
        this.connections.delete(connKey)
      })
    })
  },
  /**
   * Start GraphQL Server
   */
  async startGraphQL () {
    const { schema } = require('../graph')
    this.graphSchema = schema
    this.servers.graph = new ApolloServer({
      schema,
      allowBatchedHttpRequests: true,
      csrfPrevention: true,
      introspection: true
    })
    await this.servers.graph.start()
    WIKI.app.use('/graphql', expressMiddleware(this.servers.graph, {
      context: async ({ req, res }) => ({ req, res })
    }))
  },
  /**
   * Attach GraphQL Subscriptions handler (graphql-ws) to a server
   */
  startSubscriptions (server) {
    const wss = new WebSocketServer({
      server,
      path: '/graphql-subscriptions'
    })
    useServer({
      schema: this.graphSchema,
      onConnect: (ctx) => {
        let token = _.get(ctx.connectionParams, 'token', null)

        if (!token) {
          const cookieHeader = _.get(ctx.extra, 'request.headers.cookie', '')
          if (cookieHeader) {
            const cookies = cookie.parse(cookieHeader)
            token = cookies.jwt || null
          }
        }

        if (!token) {
          return false
        }

        try {
          const user = jwt.verify(token, WIKI.config.certs.public, {
            audience: WIKI.config.auth.audience,
            issuer: 'urn:wiki.js',
            algorithms: ['RS256']
          })

          if (!_.includes(user.permissions, 'manage:system')) {
            return false
          }

          ctx.extra.user = user
          return true
        } catch (err) {
          return false
        }
      },
      context: (ctx) => ({ user: ctx.extra.user })
    }, wss)
    this.subscriptionServers.push(wss)
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
    for (const wss of this.subscriptionServers) {
      wss.close()
    }
    this.subscriptionServers = []
    if (this.servers.http) {
      await Promise.fromCallback(cb => { this.servers.http.close(cb) })
      this.servers.http = null
    }
    if (this.servers.https) {
      await Promise.fromCallback(cb => { this.servers.https.close(cb) })
      this.servers.https = null
    }
    if (this.servers.graph) {
      await this.servers.graph.stop()
    }
    this.servers.graph = null
  },
  /**
   * Restart Server
   */
  async restartServer (srv = 'https') {
    this.closeConnections(srv)
    switch (srv) {
      case 'http':
        if (this.servers.http) {
          await Promise.fromCallback(cb => { this.servers.http.close(cb) })
          this.servers.http = null
        }
        this.startHTTP()
        break
      case 'https':
        if (this.servers.https) {
          await Promise.fromCallback(cb => { this.servers.https.close(cb) })
          this.servers.https = null
        }
        this.startHTTPS()
        break
      default:
        throw new Error('Cannot restart server: Invalid designation')
    }
  }
}
