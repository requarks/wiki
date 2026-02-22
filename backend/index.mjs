// ===========================================
// Wiki.js Server
// Licensed under AGPLv3
// ===========================================

import { existsSync } from 'node:fs'
import path from 'node:path'
import { DateTime } from 'luxon'
import semver from 'semver'
import { customAlphabet } from 'nanoid'
import { padEnd } from 'lodash-es'

import fastify from 'fastify'
import fastifyCompress from '@fastify/compress'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyFavicon from 'fastify-favicon'
import fastifyFormBody from '@fastify/formbody'
import fastifyHelmet from '@fastify/helmet'
import { Authenticator } from '@fastify/passport'
import fastifySensible from '@fastify/sensible'
import fastifySession from '@fastify/session'
import fastifyStatic from '@fastify/static'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifyView from '@fastify/view'
import gracefulServer from '@gquittet/graceful-server'
import ajvFormats from 'ajv-formats'
import pug from 'pug'

import configSvc from './core/config.mjs'
import dbManager from './core/db.mjs'
import logger from './core/logger.mjs'

const nanoid = customAlphabet('1234567890abcdef', 10)

if (!semver.satisfies(process.version, '>=24')) {
  console.error('ERROR: Node.js 24.x or later required!')
  process.exit(1)
}

if (existsSync('./package.json')) {
  console.error('ERROR: Must run server from the parent directory!')
  process.exit(1)
}

const WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  INSTANCE_ID: nanoid(10),
  SERVERPATH: path.join(process.cwd(), 'backend'),
  configSvc,
  sites: {},
  sitesMappings: {},
  startedAt: DateTime.utc(),
  storage: {
    defs: [],
    modules: []
  }
}
global.WIKI = WIKI

if (WIKI.IS_DEBUG) {
  process.on('warning', (warning) => {
    console.log(warning.stack)
  })
}

await WIKI.configSvc.init()

// ----------------------------------------
// Init Logger
// ----------------------------------------

WIKI.logger = logger.init()

// ----------------------------------------
// Init Server
// ----------------------------------------

WIKI.logger.info('=======================================')
WIKI.logger.info(`= Wiki.js ${padEnd(WIKI.version + ' ', 29, '=')}`)
WIKI.logger.info('=======================================')
WIKI.logger.info('Initializing...')
WIKI.logger.info(`Running node.js ${process.version} [ OK ]`)

// ----------------------------------------
// Pre-Boot Sequence
// ----------------------------------------

async function preBoot () {
  WIKI.dbManager = (await import('./core/db.mjs')).default
  WIKI.db = await dbManager.init()
  WIKI.models = (await import('./models/index.mjs')).default

  try {
    if (await WIKI.configSvc.loadFromDb()) {
      WIKI.logger.info('Settings merged with DB successfully [ OK ]')
    } else {
      WIKI.logger.warn('No settings found in DB. Initializing with defaults...')
      await WIKI.configSvc.initDbValues()

      if (!(await WIKI.configSvc.loadFromDb())) {
        throw new Error('Settings table is empty! Could not initialize [ ERROR ]')
      }
    }
  } catch (err) {
    WIKI.logger.error('Database Initialization Error: ' + err.message)
    if (WIKI.IS_DEBUG) {
      WIKI.logger.error(err)
    }
    process.exit(1)
  }
}

// ----------------------------------------
// Post-Boot Sequence
// ----------------------------------------

async function postBoot () {
  await WIKI.models.sites.reloadCache()
}

// ----------------------------------------
// Init HTTP Server
// ----------------------------------------

async function initHTTPServer () {
  // ----------------------------------------
  // Load core modules
  // ----------------------------------------

  // WIKI.auth = auth.init()
  // WIKI.mail = mail.init()
  // WIKI.system = system.init()

  // ----------------------------------------
  // Initialize Fastify App
  // ----------------------------------------

  const app = fastify({
    ajv: {
      plugins: [
        [ajvFormats, {}]
      ]
    },
    bodyLimit: WIKI.config.bodyParserLimit || 5242880, // 5mb
    logger: {
      level: 'error'
    },
    trustProxy: WIKI.config.security.securityTrustProxy ?? false,
    routerOptions: {
      ignoreTrailingSlash: true
    }
  })
  WIKI.app = app
  WIKI.server = gracefulServer(app.server, {
    livenessEndpoint: '/_live',
    readinessEndpoint: '/_ready',
    kubernetes: Boolean(process.env.KUBERNETES_SERVICE_HOST)
  })

  app.register(fastifySensible)
  app.register(fastifyCompress, { global: true })

  // ----------------------------------------
  // Handle graceful server shutdown
  // ----------------------------------------

  WIKI.server.on(gracefulServer.SHUTTING_DOWN, () => {
    WIKI.logger.info('Shutting down HTTP Server... [ STOPPING ]')
  })

  WIKI.server.on(gracefulServer.SHUTDOWN, (err) => {
    WIKI.logger.info(`HTTP Server has exited: [ STOPPED ] (${err.message})`)
  })

  // ----------------------------------------
  // Security
  // ----------------------------------------

  app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // TODO: Make it configurable
    strictTransportSecurity: WIKI.config.security.securityHSTS
      ? {
          maxAge: WIKI.config.security.securityHSTSDuration,
          includeSubDomains: true
        }
      : false
  })

  app.register(fastifyCors, {
    origin: '*', // TODO: Make it configurable
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS']
  })

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.register(fastifyFavicon, {
    path: path.join(WIKI.ROOTPATH, 'assets'),
    name: 'favicon.ico'
  })
  app.register(fastifyStatic, {
    prefix: '/_assets/',
    root: path.join(WIKI.ROOTPATH, 'assets/_assets'),
    index: false,
    maxAge: '7d',
    decorateReply: false
  })

  // ----------------------------------------
  // Blocks
  // ----------------------------------------

  app.register(fastifyStatic, {
    prefix: '/_blocks/',
    root: path.join(WIKI.ROOTPATH, 'blocks/compiled'),
    index: false,
    maxAge: '7d'
  })

  // ----------------------------------------
  // Passport Authentication
  // ----------------------------------------

  app.register(fastifyCookie, {
    secret: WIKI.config.auth.secret,
    hook: 'onRequest'
  })
  app.register(fastifySession, {
    secret: WIKI.config.auth.secret,
    saveUninitialized: false,
    store: {
      get (sessionId, clb) {

      },
      set (sessionId, clb) {

      },
      destroy (sessionId, clb) {

      }
    }
  })
  const fastifyPassport = new Authenticator()
  app.register(fastifyPassport.initialize())
  app.register(fastifyPassport.secureSession())

  // app.use(WIKI.auth.passport.initialize())
  // app.use(WIKI.auth.authenticate)

  // ----------------------------------------
  // API Routes
  // ----------------------------------------

  app.register(fastifySwagger, {
    hideUntagged: true,
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Wiki.js API',
        version: WIKI.config.version
      },
      components: {
        securitySchemes: {
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [
        { apiKeyAuth: [] },
        { bearerAuth: [] }
      ]
    }
  })
  app.register(fastifySwaggerUi, {
    routePrefix: '/_swagger'
  })

  // ----------------------------------------
  // Permissions
  // ----------------------------------------

  app.addHook('preHandler', (req, reply, done) => {
    if (req.routeOptions.config?.permissions?.length > 0) {
      // Unauthenticated / No Permissions
      if (!req.user?.isAuthenticated || !(req.user.permissions?.length > 0)) {
        return reply.unauthorized()
      }
      // Is Root Admin?
      if (!req.user.permissions.includes('manage:system')) {
        // Check for at least 1 permission
        const isAllowed = req.routeOptions.config.permissions.some(perms => {
          // Check for all permissions
          if (Array.isArray(perms)) {
            return perms.every(perm => req.user.permissions?.some(p => p === perm))
          } else {
            return req.user.permissions?.some(p => p === perms)
          }
        })
        // Forbidden
        if (!isAllowed) {
          return reply.forbidden()
        }
      }
    }
    done()
  })

  // ----------------------------------------
  // SEO
  // ----------------------------------------

  app.addHook('onRequest', (req, reply, done) => {
    const [urlPath, urlQuery] = req.raw.url.split('?')
    if (urlPath.length > 1 && urlPath.endsWith('/')) {
      const newPath = urlPath.slice(0, -1)
      reply.redirect(urlQuery ? `${newPath}?${urlQuery}` : newPath, 301)
      return
    }
    done()
  })

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.register(fastifyView, {
    engine: {
      pug
    }
  })
  app.register(fastifyFormBody, {
    bodyLimit: 1048576 // 1mb
  })

  // ----------------------------------------
  // View accessible data
  // ----------------------------------------

  // app.locals.analyticsCode = {}
  // app.locals.basedir = WIKI.ROOTPATH
  // app.locals.config = WIKI.config
  // app.locals.pageMeta = {
  //   title: '',
  //   description: WIKI.config.description,
  //   image: '',
  //   url: '/'
  // }
  // app.locals.devMode = WIKI.devMode

  // ----------------------------------------
  // Routing
  // ----------------------------------------

  // app.addHook('onRequest', async (req, reply, done) => {
  //   const currentSite = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
  //   if (!currentSite) {
  //     return reply.code(404).send('Site Not Found')
  //   }

  //   req.locals.siteConfig = {
  //     id: currentSite.id,
  //     title: currentSite.config.title,
  //     darkMode: currentSite.config.theme.dark,
  //     lang: currentSite.config.locales.primary,
  //     rtl: false, // TODO: handle RTL
  //     company: currentSite.config.company,
  //     contentLicense: currentSite.config.contentLicense
  //   }
  //   req.locals.theming = {

  //   }
  //   req.locals.langs = await WIKI.db.locales.getNavLocales({ cache: true })
  //   req.locals.analyticsCode = await WIKI.db.analytics.getCode({ cache: true })
  //   done()
  // })

  app.register(import('./api/index.mjs'), { prefix: '/_api' })

  // ----------------------------------------
  // Error handling
  // ----------------------------------------

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof fastify.errorCodes.FST_ERR_BAD_STATUS_CODE) {
      WIKI.logger.warn(error)
      reply.status(500).send({ ok: false })
    } else {
      reply.send(error)
    }
  })

  // ----------------------------------------
  // Bind HTTP Server
  // ----------------------------------------

  try {
    WIKI.logger.info(`Starting HTTP Server on port ${WIKI.config.port} [ STARTING ]`)
    await app.listen({ port: WIKI.config.port, host: WIKI.config.bindIP })
    WIKI.logger.info('HTTP Server: [ RUNNING ]')
    WIKI.server.setReady()
  } catch (err) {
    WIKI.logger.error(err)
    process.exit(1)
  }
}

// ----------------------------------------
// Register exit handler
// ----------------------------------------

// process.on('SIGINT', () => {
//   WIKI.kernel.shutdown()
// })
// process.on('message', (msg) => {
//   if (msg === 'shutdown') {
//     WIKI.kernel.shutdown()
//   }
// })

// ----------------------------------------
// Initialization Sequence
// ----------------------------------------

await preBoot()
await initHTTPServer()
await postBoot()
