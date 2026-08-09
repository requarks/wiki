// ===========================================
// Wiki.js Server
// Licensed under AGPLv3
// ===========================================

import { existsSync } from 'node:fs'
import path from 'node:path'
import semver from 'semver'
import { customAlphabet } from 'nanoid'
import { uniq } from 'es-toolkit/array'

import fastify from 'fastify'
import fastifyCompress from '@fastify/compress'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyFavicon from 'fastify-favicon'
import fastifyFormBody from '@fastify/formbody'
import fastifyHelmet from '@fastify/helmet'
import fastifySensible from '@fastify/sensible'
import fastifySession from '@fastify/session'
import fastifyStatic from '@fastify/static'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifyView from '@fastify/view'
import fastifyWebsocket from '@fastify/websocket'
import gracefulServer from '@gquittet/graceful-server'
import ajvFormats from 'ajv-formats'
import pug from 'pug'
import Emittery from 'emittery'
import NodeCache from 'node-cache'

import collab from './core/collab.ts'
import configSvc from './core/config.ts'
import dbManager from './core/db.ts'
import logger from './core/logger.ts'
import scheduler from './core/scheduler.ts'
import { stripPageExtension } from './helpers/common.ts'
import { corsOrigin, parseCspDirectives } from './helpers/security.ts'

const nanoid = customAlphabet('1234567890abcdef', 10)

/**
 * Files a browser or a crawler asks for at the root by convention, rather than because the wiki has a
 * page there. Kept out of the page URL rules below — `txt` is a page extension on a default site, and
 * answering `/robots.txt` with a redirect to `/robots` would be answering the wrong question.
 */
const RESERVED_ROOT_FILES = new Set(['favicon.ico', 'robots.txt', 'sitemap.xml'])

/**
 * Whether a URL addresses the page tree rather than the server itself.
 *
 * Everything the server mounts sits under a leading-underscore segment — `/_api`, `/_assets`,
 * `/_files`, and the rest registered in `initHTTPServer` — which is what makes the distinction a
 * prefix test rather than a list to keep in step with the routes.
 */
function isPageUrl(urlPath: string): boolean {
  const firstSegment = urlPath.split('/')[1] ?? ''
  return !firstSegment.startsWith('_') && !RESERVED_ROOT_FILES.has(firstSegment.toLowerCase())
}

if (!semver.satisfies(process.version, '>=26')) {
  console.error('ERROR: Node.js 26.x or later required!')
  process.exit(1)
}

if (existsSync('./package.json')) {
  console.error('ERROR: Must run server from the parent directory!')
  process.exit(1)
}

// The global is assembled progressively: the literal below holds what is known at startup, and
// preBoot()/initHTTPServer() fill in db, models, cache, scheduler, events, app and server.
const WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  INSTANCE_ID: nanoid(10),
  SERVERPATH: path.join(process.cwd(), 'backend'),
  auth: {
    groups: {},
    strategies: {}
  },
  collab,
  configSvc,
  sites: {},
  sitesMappings: {},
  startedAt: Temporal.Now.instant()
} as unknown as WikiGlobal
global.WIKI = WIKI

if (WIKI.IS_DEBUG) {
  process.on('warning', (warning: Error) => {
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
WIKI.logger.info(`= Wiki.js ${(WIKI.version + ' ').padEnd(29, '=')}`)
WIKI.logger.info('=======================================')
WIKI.logger.info('Initializing...')
WIKI.logger.info(`Running node.js ${process.version} [ OK ]`)

// ----------------------------------------
// Pre-Boot Sequence
// ----------------------------------------

async function preBoot() {
  WIKI.dbManager = (await import('./core/db.ts')).default
  WIKI.db = await dbManager.init()
  WIKI.models = (await import('./models/index.ts')).default

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
  } catch (err: any) {
    WIKI.logger.error('Database Initialization Error: ' + err.message)
    if (WIKI.IS_DEBUG) {
      WIKI.logger.error(err)
    }
    process.exit(1)
  }

  WIKI.cache = new NodeCache({ checkperiod: 0 })
  WIKI.scheduler = await scheduler.init()
  WIKI.events = {
    inbound: new Emittery(),
    outbound: new Emittery()
  }
}

// ----------------------------------------
// Post-Boot Sequence
// ----------------------------------------

async function postBoot() {
  await WIKI.models.locales.refreshFromDisk()

  await WIKI.models.authentication.refreshStrategiesFromDisk()

  await WIKI.models.authentication.activateStrategies()
  await WIKI.models.locales.reloadCache()
  await WIKI.models.sites.reloadCache()
  // -> Page access is decided from these on every request, so they are in memory from the start
  await WIKI.models.groups.reloadCache()
  // -> Likewise: every page view asks whether the page takes suggestions and who reviews it
  await WIKI.models.approvals.reloadCache()

  // -> Must follow the sites cache: every site gets a row per installed block
  await WIKI.models.blocks.refreshFromDisk()
  await WIKI.models.blocks.syncAllSites()

  // -> Same: every site gets a row per installed storage module
  await WIKI.models.storage.refreshFromDisk()
  await WIKI.models.storage.syncAllSites()

  // -> Optional third-party tooling: report what is available, since features silently degrade
  //    without it
  await WIKI.models.extensions.refreshFromDisk()
  await WIKI.models.extensions.logState()

  // -> The icon cache is derived from the db and starts empty on a fresh instance
  await WIKI.models.icons.ensureCacheDir()

  await WIKI.dbManager.subscribeToNotifications()
  // -> Its own postgres listener, on its own channel: collaboration traffic is far heavier than the
  //    event bus's and has nothing to do with it. Must follow the sites cache, which the websocket
  //    handshake reads the per-site feature toggle from.
  await WIKI.collab.init()
  await WIKI.scheduler.start()

  // -> A page queued for rendering when this instance went down is still queued, and nothing looks at
  //    that table until somebody asks for another render. Costs one query when there is nothing to do.
  await WIKI.scheduler.addJob({ task: 'renderPages', maxRetries: 0 })
}

// ----------------------------------------
// Init HTTP Server
// ----------------------------------------

async function initHTTPServer() {
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
      // -> `ajv-formats` is CJS: the default import resolves to `module.exports`, so the callable
      //    plugin is reached via `.default` (verified identical at runtime: `f === f.default`).
      //    The tuple assertion is load-bearing twice over: it stops the element from widening
      //    (which makes fastify's overload resolution fall through to the HTTP/2 signature), and
      //    it bridges an upstream variance mismatch — @fastify/ajv-compiler declares plugin
      //    options as `unknown`, while ajv-formats declares its own narrower options type, and the
      //    two are contravariantly incompatible. (`ajv` itself is only a nested dependency here, so
      //    its `Plugin` type is not importable to state this more precisely.)
      plugins: [[ajvFormats.default, {}] as any],
      onCreate: (ajv: any) => {
        // -> Accepts the shorthand, alpha and full forms a color picker can produce:
        //    #RGB, #RGBA, #RRGGBB and #RRGGBBAA
        ajv.addFormat('hexcolor', (data: unknown) => {
          return (
            typeof data === 'string' &&
            /^#(?:[a-fA-F0-9]{3,4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/.test(data)
          )
        })
      }
    },
    bodyLimit: WIKI.config.bodyParserLimit || 5242880, // 5mb
    logger: {
      level: 'error'
    },
    // -> `securityTrustProxy` was the 2.x name: the setting is `trustProxy`, so this read never
    //    matched and the option was permanently off no matter what the admin area showed
    trustProxy: WIKI.config.security.trustProxy ?? false,
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
  /*
    Websocket upgrades, for live collaborative editing (`controllers/collab.ts`). Registered on the
    root instance because the upgrade handler is installed on the HTTP server itself, and before the
    routes below because a route declaring `websocket: true` needs it already there.

    `maxPayload` bounds a single frame: these carry keystrokes and cursor positions, and the largest
    legitimate one is a client handing over a document it edited while offline.
  */
  app.register(fastifyWebsocket, { options: { maxPayload: 5242880 } })

  // ----------------------------------------
  // Handle graceful server shutdown
  // ----------------------------------------

  WIKI.server.on(gracefulServer.SHUTTING_DOWN, () => {
    WIKI.logger.info('Shutting down HTTP Server... [ STOPPING ]')
    WIKI.dbManager.unsubscribeFromNotifications()
    // -> Closes every editing socket with a going-away code, so the editors reconnect to whichever
    //    instance takes over rather than sitting on a dead connection
    WIKI.collab.shutdown()
  })

  WIKI.server.on(gracefulServer.SHUTDOWN, (err: Error) => {
    WIKI.logger.info(`HTTP Server has exited: [ STOPPED ] (${err.message})`)
    if (err.message !== 'SIGINT') {
      WIKI.logger.warn(err)
    }
  })

  // ----------------------------------------
  // Security
  // ----------------------------------------

  // -> Every setting below comes from the admin area's security view. They are read once, here, so a
  //    change takes effect on the next restart — the view says as much.
  const security = WIKI.config.security

  app.register(fastifyHelmet, {
    contentSecurityPolicy:
      security.enforceCsp && security.cspDirectives
        ? { directives: parseCspDirectives(security.cspDirectives), useDefaults: false }
        : false,
    strictTransportSecurity:
      security.enforceHsts && security.hstsDuration > 0
        ? {
            maxAge: security.hstsDuration,
            includeSubDomains: true
          }
        : false,
    // -> Helmet's own default is `sameorigin`, which is also what this setting turned off means
    xFrameOptions: { action: security.disallowIframe ? 'deny' : 'sameorigin' },
    referrerPolicy: security.enforceSameOriginReferrerPolicy
      ? { policy: 'same-origin' }
      : { policy: 'no-referrer' }
  })

  app.register(fastifyCors, {
    origin: corsOrigin(security),
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS']
  })

  if (security.disallowFloc) {
    // -> Helmet dropped its FLoC helper once the proposal was withdrawn, but opting out still costs
    //    one header and the setting exists
    app.addHook('onSend', (req, reply, payload, done) => {
      reply.header('Permissions-Policy', 'interest-cohort=()')
      done(null, payload)
    })
  }

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
  // Sessions
  // ----------------------------------------

  app.register(fastifyCookie, {
    secret: WIKI.config.auth.secret,
    hook: 'onRequest'
  })
  app.register(fastifySession, {
    secret: WIKI.config.auth.secret,
    cookieName: 'wikiSession',
    cookie: {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: 'auto'
    },
    saveUninitialized: false,
    store: {
      async get(sessionId: string, clb: (err: any, result?: any) => void) {
        try {
          clb(null, await WIKI.models.sessions.get(sessionId))
        } catch (err: any) {
          clb(err, null)
        }
      },
      async set(sessionId: string, sessionData: any, clb: (err: any, result?: any) => void) {
        try {
          clb(null, await WIKI.models.sessions.set(sessionId, sessionData))
        } catch (err: any) {
          clb(err, null)
        }
      },
      async destroy(sessionId: string, clb: (err: any, result?: any) => void) {
        try {
          clb(null, await WIKI.models.sessions.destroy(sessionId))
        } catch (err: any) {
          clb(err, null)
        }
      }
    }
  })

  // ----------------------------------------
  // API Routes
  // ----------------------------------------

  app.register(fastifySwagger, {
    hideUntagged: true,
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Wiki.js API',
        version: WIKI.version
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
      security: [{ apiKeyAuth: [] }, { bearerAuth: [] }]
    },
    transform: ({ schema, url, route }: any) => {
      // Add permissions to the route schema description
      const permissions = route?.config?.permissions ?? []
      const transformedSchema = { ...schema }
      const currentDescription = transformedSchema.description || ''

      if (permissions?.length > 0) {
        const nestedPermissions: string[] = []
        for (const perm of permissions) {
          if (Array.isArray(perm)) {
            nestedPermissions.push(`\`${perm.join(' + ')}\``)
          } else {
            nestedPermissions.push(`\`${perm}\``)
          }
        }
        nestedPermissions.push('`manage:system`')
        transformedSchema.description =
          `${currentDescription}\n\n**Required Permissions:** ${uniq(nestedPermissions).join(' or ')}`.trim()
        transformedSchema['x-permissions'] = permissions
      } else if (route?.config?.publicAccess) {
        transformedSchema.description =
          `${currentDescription}\n\n**This API is public.** No special permissions required.`.trim()
      } else {
        /*
          No fixed permission is not the same as public, and saying so was wrong for most of these.
          A route without one is usually a route whose answer depends on the caller: the page rules of
          their groups, their own account, or the queue they happen to be a reviewer for. What it
          serves is scoped, not unrestricted.
        */
        transformedSchema.description =
          `${currentDescription}\n\n**No fixed permission.** What this returns, and what it acts on, is limited to what the caller is entitled to — their session, their groups' page rules, or their own account. A request that is entitled to nothing gets an empty answer or a refusal rather than an error about permissions.`.trim()
      }

      return { schema: transformedSchema, url }
    }
  })
  app.register(fastifySwaggerUi, {
    routePrefix: '/_api',
    // -> Left empty so the plugin inlines neither its own logo nor one of ours; the stylesheet below
    //    is what puts the site's logo in the topbar
    logo: {} as any,
    theme: {
      css: [
        {
          filename: 'wiki.css',
          /*
            The site's own logo in the topbar, as a background on the link swagger draws its wordmark
            in.

            A stylesheet rather than the plugin's `logo` option, which takes a buffer and base64-inlines
            it into the page when the server boots. This documentation is served for whichever site the
            request arrived at, and an administrator can change that site's logo at any time — a URL
            resolves both of those per request, and a buffer chosen at boot resolves neither.

            `contain` in a box wider than it is tall, so a square mark and a wordmark both sit sensibly
            without the logo being distorted to fit.
          */
          content: `
            .swagger-ui .topbar-wrapper a.link > * {
              display: none;
            }
            .swagger-ui .topbar-wrapper a.link {
              display: block;
              width: 160px;
              height: 40px;
              background: url('/_site/current/logo') left center / contain no-repeat;
            }
          `
        }
      ]
    }
  })

  // ----------------------------------------
  // API Key Authentication
  // ----------------------------------------

  app.decorateRequest('apiKey', null)

  app.addHook('onRequest', async (req, reply) => {
    // -> Bearer tokens authenticate API calls only; everything else is cookie-authenticated. Note
    //    that the session is deliberately left untouched: writing to it would have @fastify/session
    //    persist a session row for every scraped request.
    if (!req.url.startsWith('/_api/')) {
      return
    }
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return
    }
    const token = header.slice('Bearer '.length).trim()
    if (!token) {
      return
    }
    try {
      req.apiKey = await WIKI.models.apiKeys.verify(token)
    } catch (err: any) {
      // -> Say why: the caller holds the credential and can act on "revoked" or "expired"
      WIKI.logger.debug(`Rejected an API key: ${err.message}`)
      return reply.unauthorized(err.message)
    }
  })

  // ----------------------------------------
  // Permissions
  // ----------------------------------------

  app.addHook('preHandler', (req, reply, done) => {
    const routePermissions = req.routeOptions.config?.permissions
    if (routePermissions && routePermissions.length > 0) {
      // -> A verified API key stands in for a session, carrying the permissions of the groups it was
      //    issued for
      const permissions = req.apiKey
        ? req.apiKey.permissions
        : req.session?.authenticated
          ? req.session.permissions
          : null
      // Unauthenticated / No Permissions
      if (!permissions || permissions.length < 1) {
        return reply.unauthorized()
      }
      // Is Root Admin?
      if (!permissions.includes('manage:system')) {
        // Check for at least 1 permission
        const isAllowed = routePermissions.some((perms) => {
          // Check for all permissions
          if (Array.isArray(perms)) {
            return perms.every((perm) => permissions.some((p) => p === perm))
          } else {
            return permissions.some((p) => p === perms)
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
    const [urlPath, urlQuery] = req.raw.url!.split('?')
    const withQuery = (newPath: string) => (urlQuery ? `${newPath}?${urlQuery}` : newPath)

    const trimmed = urlPath!.length > 1 && urlPath!.endsWith('/') ? urlPath!.slice(0, -1) : urlPath!

    if (isPageUrl(trimmed)) {
      // -> Straight off the site caches rather than through the model: this runs on every request, and
      //    both lookups are the ones `getSiteByHostname` would do, minus its optional reload
      const siteId = WIKI.sitesMappings[req.hostname] || WIKI.sitesMappings['*']
      const withoutExtension = stripPageExtension(
        trimmed,
        WIKI.sites[siteId]?.config?.pageExtensions
      )
      if (withoutExtension) {
        // -> Answers a trailing slash as well, rather than sending the client back for a second
        //    round trip to be told about the extension.
        //
        //    Not a 301: which extensions resolve this way is a setting, and a browser that cached a
        //    permanent redirect would go on applying it after an administrator had changed it
        reply.redirect(withQuery(withoutExtension), 302)
        return
      }
    }

    if (trimmed !== urlPath) {
      reply.redirect(withQuery(trimmed), 301)
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

  app.register(import('./api/index.ts'), { prefix: '/_api' })
  app.register(import('./controllers/collab.ts'), { prefix: '/_collab' })
  app.register(import('./controllers/files.ts'), { prefix: '/_files' })
  app.register(import('./controllers/site.ts'), { prefix: '/_site' })
  app.register(import('./controllers/icons.ts'), { prefix: '/_icons' })
  app.register(import('./controllers/render.ts'), { prefix: '/_render' })
  app.register(import('./controllers/thumb.ts'), { prefix: '/_thumb' })
  app.register(import('./controllers/user.ts'), { prefix: '/_user' })

  // ----------------------------------------
  // Error handling
  // ----------------------------------------

  app.setErrorHandler((error: any, req, reply) => {
    if (req.url.includes('/_api/')) {
      if (error.statusCode) {
        reply.code(error.statusCode).type('application/json').send({
          ok: false,
          error: error.name,
          statusCode: error.statusCode,
          message: error.message
        })
      } else {
        WIKI.logger.warn(error)
        reply.code(500).type('application/json').send({
          ok: false,
          error: 'Internal Server Error',
          statusCode: 500,
          message: 'Internal Server error'
        })
      }
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
  } catch (err: any) {
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
