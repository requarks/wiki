// ===========================================
// Wiki.js Server
// Licensed under AGPLv3
// ===========================================

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
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
import fastifyWebsocket from '@fastify/websocket'
import gracefulServer from '@gquittet/graceful-server'
import ajvFormats from 'ajv-formats'
import Emittery from 'emittery'
import NodeCache from 'node-cache'

import { metricsHook } from './controllers/metrics.ts'
import collab from './core/collab.ts'
import configSvc from './core/config.ts'
import dbManager from './core/db.ts'
import logger from './core/logger.ts'
import scheduler from './core/scheduler.ts'
import { renderAppShell } from './helpers/appShell.ts'
import {
  isPageUrl,
  RESERVED_ROOT_FILES,
  splitLocalePath,
  stripPageExtension
} from './helpers/common.ts'
import { corsOrigin, parseCspDirectives } from './helpers/security.ts'

const nanoid = customAlphabet('1234567890abcdef', 10)

/**
 * First path segments the SERVER itself answers — every prefix registered in `initHTTPServer`.
 *
 * Spelled out rather than tested with `isPageUrl`, because a leading underscore does not mean the
 * server: the frontend router owns `/_admin`, `/_profile`, `/_inbox`, `/_search`, `/_create`, `/_edit`,
 * `/_version` and `/_error` too, and those have to reach the app shell like any page path. The distinction the
 * shell needs is "does something here serve this", which is this list, and it has to be kept in step
 * with the registrations below.
 *
 * `_user` is registered below but absent here: it is shared with the frontend router, and `isServerUrl`
 * is what splits it.
 */
const SERVER_ROUTE_SEGMENTS = new Set([
  '_api',
  '_assets',
  '_blocks',
  '_collab',
  '_files',
  '_icons',
  '_render',
  '_site',
  '_terminal',
  '_thumb'
])

/**
 * Whether the server answers this URL, as opposed to the app shell being handed over for the frontend
 * router to resolve.
 *
 * `_user` is the one segment the two SHARE, so it cannot be settled by its first segment alone: the
 * server serves avatars at `/_user/<id>/avatar`, while the frontend owns the public profile page at
 * `/_user/<id>`. Only the avatar is the server's, and everything else under there is the app's — so a
 * mistyped avatar URL hands back a profile page that says the user does not exist, which is the same
 * answer by a different route.
 *
 * `frontend/vite.config.js` draws the same line from the other side: its dev proxy forwards only the
 * avatar path to this server, and the two have to agree.
 */
function isServerUrl(urlPath: string): boolean {
  const segments = urlPath.split('/')
  if (segments[1] === '_user') {
    return segments[3] === 'avatar'
  }
  return SERVER_ROUTE_SEGMENTS.has(segments[1] ?? '')
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

  // -> No per-site rows to create: what a site has turned on lives in its own config blob, which the
  //    sites cache above already holds
  await WIKI.models.analytics.refreshFromDisk()

  // -> Optional third-party tooling: report what is available, since features silently degrade
  //    without it
  await WIKI.models.extensions.refreshFromDisk()
  await WIKI.models.extensions.logState()

  // -> The icon cache is derived from the db and starts empty on a fresh instance
  await WIKI.models.icons.ensureCacheDir()

  // -> The system's cron entries are defined in code, so they are brought in line here rather than
  //    only seeded on a fresh database — must precede the scheduler start that queues from them
  await WIKI.models.jobs.reconcileSchedule()

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
    /*
      A function rather than the boolean itself, so that the setting is answered per request instead
      of being baked in here: the value fastify is handed at construction can never change, and this
      is the one security setting whose effect an administrator checks immediately — an audit entry
      or a rate limit recorded against the proxy rather than the visitor. Turning it on and being
      told to restart before it means anything is how a wrong address gets read as a bug.

      Fastify only asks whether a given hop is trusted, and it asks per hop per request, so
      returning false for all of them is exactly the `false` behaviour: `proxy-addr` truncates the
      chain at the socket, and `req.ip` / `req.host` / `req.protocol` come from the connection and
      the Host header as they would with the option off. The truthiness of the function is what
      matters at construction time, not the setting.

      Read through the `WIKI` global on every call, and that is load-bearing rather than incidental:
      an HA instance that did not serve the save learns about it from the `reloadConfig` event, whose
      handler REPLACES `WIKI.config` with a merged copy rather than mutating it. Hoisting this to a
      captured `WIKI.config.security` would keep working on the instance the administrator happened to
      hit and silently freeze on every other one. Verified across two instances sharing a database.

      Note that `true` trusts the whole chain and therefore takes the LEFTMOST `X-Forwarded-For`
      entry, which a client can put anything it likes into. That is the meaning of the setting as it
      stands; a deployment where clients can reach the wiki without passing the proxy needs a hop
      count or a CIDR list, which this setting cannot express yet.
    */
    trustProxy: () => WIKI.config.security?.trustProxy === true,
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
    Websocket upgrades, for live collaborative editing (`controllers/collab.ts`) and the admin
    terminal's log stream (`controllers/terminal.ts`). Registered on the root instance because the
    upgrade handler is installed on the HTTP server itself, and before the routes below because a
    route declaring `websocket: true` needs it already there.

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

  // -> Every setting below comes from the admin area's security view, and every one of them is read
  //    once, here, so a change takes effect on the next restart. Not every setting in that view is:
  //    `trustProxy` above and `forceAssetDownload` and the rate limit elsewhere are read per request,
  //    which is why the view marks the restart on the individual options rather than on the page.
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
    maxAge: '1h'
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
    /*
      Swagger UI's own sorters, applied in the browser: tags down the page, and the operations inside
      each tag by path. Neither is on by default — the order is otherwise the order the routes were
      registered in, which is meaningful to `api/index.ts` and arbitrary to anyone reading the docs.

      `operationsSorter: 'alpha'` sorts on the path, not the summary, so the several methods of one
      path stay together and keep their registration order relative to each other.
    */
    uiConfig: {
      tagsSorter: 'alpha',
      operationsSorter: 'alpha'
    },
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
    /*
      Bearer tokens authenticate API calls and the metrics endpoint; everything else is
      cookie-authenticated. The metrics path is here rather than verifying a key of its own, so that
      there is one place a bearer token is checked — it is served by a hook below, at a path that is
      a setting, so it cannot declare itself part of the API by its prefix.

      Note that the session is deliberately left untouched: writing to it would have
      @fastify/session persist a session row for every scraped request.
    */
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return
    }
    if (!req.url.startsWith('/_api/') && !WIKI.models.metrics.matches(req.url.split('?')[0]!)) {
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
  // Metrics
  // ----------------------------------------

  /*
    Before the SEO hook on purpose: the metrics path is a plain page-looking path, so the redirects
    below would send a scrape to the site's locale prefix or strip a page extension off it. And after
    the session and API key hooks, whose work it reads to decide whether a scrape from outside the
    addresses anonymous access was opened to is entitled to an answer.
  */
  app.addHook('onRequest', metricsHook)

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

      /*
        A site that brackets its URLs by locale sends a path arriving without one to its primary
        locale, so that every page has a single address. The prefix is the locale's SHORT code — `/fr`
        for `fr-FR` — which is the same segment its content is filed under on a storage target.

        302 for the same reason as the extension above: it is a setting, and a browser holding a
        permanent redirect would go on applying it after an administrator had turned it off.
      */
      const siteLocales = WIKI.sites[siteId]?.config?.locales
      if (siteLocales?.forcePrefix) {
        const prefixes = WIKI.models.locales.urlPrefixesFor(siteLocales.active)
        if (!splitLocalePath(trimmed, prefixes)) {
          const primary = WIKI.models.locales.shortCodeFor(siteLocales.primary)
          reply.redirect(withQuery(`/${primary}${trimmed === '/' ? '' : trimmed}`), 302)
          return
        }
      }
    }

    if (trimmed !== urlPath) {
      reply.redirect(withQuery(trimmed), 301)
      return
    }

    done()
  })

  app.register(fastifyFormBody, {
    bodyLimit: 1048576 // 1mb
  })

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
  app.register(import('./controllers/terminal.ts'), { prefix: '/_terminal' })
  app.register(import('./controllers/thumb.ts'), { prefix: '/_thumb' })
  app.register(import('./controllers/user.ts'), { prefix: '/_user' })

  // -> At the root and with no prefix of their own: `robots.txt` and `sitemap.xml` are names a crawler
  //    asks for by convention, the same way `favicon.ico` is, and `RESERVED_ROOT_FILES` is what keeps
  //    the SEO hook above from mistaking either for a page path
  app.register(import('./controllers/rootFiles.ts'))

  // ----------------------------------------
  // App Shell
  // ----------------------------------------

  const appShellPath = path.join(WIKI.ROOTPATH, 'assets/index.html')

  /*
    The compiled SPA, for every path no route above claimed.

    It has to be the fallback rather than a route of its own: a wiki page lives at any path a user cares
    to give it, and the frontend's router -- not this server -- is what resolves one. Which is also why
    the only paths held back are the segments the server itself mounts, so a mistyped `/_api/...` still
    answers as the API rather than handing back a page of HTML, and the root files a crawler asks for by
    convention, which are absent here rather than being the app.

    `no-store`: the bundles this pulls in are hashed and immutable under `/_assets`, but the document
    naming them must never be held, or a rebuilt frontend would keep booting the previous one. Read per
    request for the same reason -- `npm run build` while the server is up should be enough.
  */
  app.setNotFoundHandler(async (req, reply) => {
    const urlPath = req.raw.url!.split('?')[0]!
    const firstSegment = urlPath.split('/')[1] ?? ''
    const isSystemPath = isServerUrl(urlPath)
    const isReservedRootFile = RESERVED_ROOT_FILES.has(firstSegment.toLowerCase())
    // -> HEAD as well as GET: it has to answer what GET would, or a monitor pointed at the wiki reads a
    //    404 for a page the browser beside it loads. Node drops the body for HEAD on its own.
    const isReadRequest = req.method === 'GET' || req.method === 'HEAD'
    if (!isReadRequest || isSystemPath || isReservedRootFile) {
      return reply.notFound()
    }
    let shell: string
    try {
      shell = await readFile(appShellPath, 'utf8')
    } catch (err: any) {
      // -> Nothing to serve means the frontend was never built, which is a setup step rather than a
      //    fault of this request: say which one, since a bare 500 sends people looking in the server
      WIKI.logger.error(`Cannot serve the app shell from ${appShellPath}: ${err.message}`)
      return reply
        .code(503)
        .type('text/plain; charset=utf-8')
        .send('The frontend has not been built yet. Run `npm run build` in frontend/.\n')
    }

    /*
      Every HTML document this wiki serves leaves through here — a page and an app route alike — so this
      is the one place the site's indexing settings can be attached to all of them, and the one place a
      document can be made to say something about the page at its URL before the app has run.
      `renderAppShell` is that: what it does, what it costs and who it does it for are all set out in
      `helpers/appShell.ts`.

      The site is read straight off the caches for the same reason the SEO hook above reads it that way:
      both lookups are what `getSiteByHostname` would do, minus its optional reload.

      A failure there is logged and the plain shell goes out instead. Enriching a document is for the
      benefit of clients that will not run it, and a database that cannot answer for one is no reason to
      stop serving the app to a reader whose browser would have rendered the page anyway.
    */
    const siteId = WIKI.sitesMappings[req.hostname] || WIKI.sitesMappings['*']
    let doc = { html: shell, status: 200, robots: null as string | null }
    try {
      doc = await renderAppShell(req, siteId, shell)
    } catch (err: any) {
      WIKI.logger.warn(
        `Cannot describe ${urlPath} for a client that will not render it: ${err.message}`
      )
    }
    if (doc.robots) {
      reply.header('X-Robots-Tag', doc.robots)
    }
    return reply
      .code(doc.status)
      .header('Cache-Control', 'no-store')
      .type('text/html; charset=utf-8')
      .send(doc.html)
  })

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
