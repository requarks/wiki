import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { DateTime } from 'luxon'
import { pem2jwk } from 'pem-jwk'

export async function up (knex) {
  WIKI.logger.info('Running 3.0.0 database migration...')

  // =====================================
  // PG EXTENSIONS
  // =====================================
  await knex.raw('CREATE EXTENSION IF NOT EXISTS ltree;')
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm;')

  await knex.schema
    // =====================================
    // MODEL TABLES
    // =====================================
    // ACTIVITY LOGS -----------------------
    .createTable('activityLogs', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.timestamp('ts').notNullable().defaultTo(knex.fn.now())
      table.string('action').notNullable()
      table.jsonb('meta').notNullable()
    })
    // ANALYTICS ---------------------------
    .createTable('analytics', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('module').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.jsonb('config').notNullable()
    })
    // API KEYS ----------------------------
    .createTable('apiKeys', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('name').notNullable()
      table.text('key').notNullable()
      table.timestamp('expiration').notNullable().defaultTo(knex.fn.now())
      table.boolean('isRevoked').notNullable().defaultTo(false)
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // ASSETS ------------------------------
    .createTable('assets', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('fileName').notNullable()
      table.string('fileExt').notNullable()
      table.boolean('isSystem').notNullable().defaultTo(false)
      table.enum('kind', ['document', 'image', 'other']).notNullable().defaultTo('other')
      table.string('mimeType').notNullable().defaultTo('application/octet-stream')
      table.integer('fileSize').unsigned().comment('In bytes')
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
      table.binary('data')
      table.binary('preview')
      table.enum('previewState', ['none', 'pending', 'ready', 'failed']).notNullable().defaultTo('none')
      table.jsonb('storageInfo')
    })
    // AUTHENTICATION ----------------------
    .createTable('authentication', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('module').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.string('displayName').notNullable().defaultTo('')
      table.jsonb('config').notNullable().defaultTo('{}')
      table.boolean('registration').notNullable().defaultTo(false)
      table.string('allowedEmailRegex').notNullable().defaultTo('')
      table.specificType('autoEnrollGroups', 'uuid[]')
    })
    .createTable('blocks', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('block').notNullable()
      table.string('name').notNullable()
      table.string('description').notNullable()
      table.string('icon')
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.boolean('isCustom').notNullable().defaultTo(false)
      table.json('config').notNullable()
    })
    // COMMENT PROVIDERS -------------------
    .createTable('commentProviders', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('module').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.json('config').notNullable()
    })
    // COMMENTS ----------------------------
    .createTable('comments', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('replyTo')
      table.text('content').notNullable()
      table.text('render').notNullable().defaultTo('')
      table.string('name').notNullable().defaultTo('')
      table.string('email').notNullable().defaultTo('')
      table.string('ip').notNullable().defaultTo('')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // GROUPS ------------------------------
    .createTable('groups', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('name').notNullable()
      table.jsonb('permissions').notNullable()
      table.jsonb('rules').notNullable()
      table.string('redirectOnLogin').notNullable().defaultTo('')
      table.string('redirectOnFirstLogin').notNullable().defaultTo('')
      table.string('redirectOnLogout').notNullable().defaultTo('')
      table.boolean('isSystem').notNullable().defaultTo(false)
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // HOOKS -------------------------------
    .createTable('hooks', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('name').notNullable()
      table.jsonb('events').notNullable().defaultTo('[]')
      table.string('url').notNullable()
      table.boolean('includeMetadata').notNullable().defaultTo(false)
      table.boolean('includeContent').notNullable().defaultTo(false)
      table.boolean('acceptUntrusted').notNullable().defaultTo(false)
      table.string('authHeader')
      table.enum('state', ['pending', 'error', 'success']).notNullable().defaultTo('pending')
      table.string('lastErrorMessage')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // JOB HISTORY -------------------------
    .createTable('jobHistory', table => {
      table.uuid('id').notNullable().primary()
      table.string('task').notNullable()
      table.enum('state', ['active', 'completed', 'failed', 'interrupted']).notNullable()
      table.boolean('useWorker').notNullable().defaultTo(false)
      table.boolean('wasScheduled').notNullable().defaultTo(false)
      table.jsonb('payload')
      table.integer('attempt').notNullable().defaultTo(1)
      table.integer('maxRetries').notNullable().defaultTo(0)
      table.text('lastErrorMessage')
      table.string('executedBy')
      table.timestamp('createdAt').notNullable()
      table.timestamp('startedAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('completedAt')
    })
    // JOB SCHEDULE ------------------------
    .createTable('jobSchedule', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('task').notNullable()
      table.string('cron').notNullable()
      table.string('type').notNullable().defaultTo('system')
      table.jsonb('payload')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // JOB SCHEDULE ------------------------
    .createTable('jobLock', table => {
      table.string('key').notNullable().primary()
      table.string('lastCheckedBy')
      table.timestamp('lastCheckedAt').notNullable().defaultTo(knex.fn.now())
    })
    // JOBS --------------------------------
    .createTable('jobs', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('task').notNullable()
      table.boolean('useWorker').notNullable().defaultTo(false)
      table.jsonb('payload')
      table.integer('retries').notNullable().defaultTo(0)
      table.integer('maxRetries').notNullable().defaultTo(0)
      table.timestamp('waitUntil')
      table.boolean('isScheduled').notNullable().defaultTo(false)
      table.string('createdBy')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // LOCALES -----------------------------
    .createTable('locales', table => {
      table.string('code', 10).notNullable().primary()
      table.string('name').notNullable()
      table.string('nativeName').notNullable()
      table.string('language', 2).notNullable().index()
      table.string('region', 2)
      table.string('script', 4)
      table.boolean('isRTL').notNullable().defaultTo(false)
      table.jsonb('strings')
      table.integer('completeness').notNullable().defaultTo(0)
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // NAVIGATION ----------------------------
    .createTable('navigation', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.jsonb('items').notNullable().defaultTo('[]')
    })
    // PAGE HISTORY ------------------------
    .createTable('pageHistory', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('pageId').notNullable().index()
      table.string('action').defaultTo('updated')
      table.string('reason')
      table.jsonb('affectedFields').notNullable().defaultTo('[]')
      table.string('locale', 10).notNullable().defaultTo('en')
      table.string('path').notNullable()
      table.string('hash').notNullable()
      table.string('alias')
      table.string('title').notNullable()
      table.string('description')
      table.string('icon')
      table.enu('publishState', ['draft', 'published', 'scheduled']).notNullable().defaultTo('draft')
      table.timestamp('publishStartDate')
      table.timestamp('publishEndDate')
      table.jsonb('config').notNullable().defaultTo('{}')
      table.jsonb('relations').notNullable().defaultTo('[]')
      table.text('content')
      table.text('render')
      table.jsonb('toc')
      table.string('editor').notNullable()
      table.string('contentType').notNullable()
      table.jsonb('scripts').notNullable().defaultTo('{}')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('versionDate').notNullable().defaultTo(knex.fn.now())
    })
    // PAGE LINKS --------------------------
    .createTable('pageLinks', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('locale', 10).notNullable()
    })
    // PAGES -------------------------------
    .createTable('pages', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('locale', 10).notNullable()
      table.string('path').notNullable()
      table.string('hash').notNullable()
      table.string('alias')
      table.string('title').notNullable()
      table.string('description')
      table.string('icon')
      table.enu('publishState', ['draft', 'published', 'scheduled']).notNullable().defaultTo('draft')
      table.timestamp('publishStartDate')
      table.timestamp('publishEndDate')
      table.jsonb('config').notNullable().defaultTo('{}')
      table.jsonb('relations').notNullable().defaultTo('[]')
      table.text('content')
      table.text('render')
      table.text('searchContent')
      table.specificType('ts', 'tsvector').index('pages_ts_idx', { indexType: 'GIN' })
      table.specificType('tags', 'text[]').index('pages_tags_idx', { indexType: 'GIN' })
      table.jsonb('toc')
      table.string('editor').notNullable()
      table.string('contentType').notNullable()
      table.boolean('isBrowsable').notNullable().defaultTo(true)
      table.boolean('isSearchable').notNullable().defaultTo(true)
      table.specificType('isSearchableComputed', `boolean GENERATED ALWAYS AS ("publishState" != 'draft' AND "isSearchable") STORED`).index()
      table.string('password')
      table.integer('ratingScore').notNullable().defaultTo(0)
      table.integer('ratingCount').notNullable().defaultTo(0)
      table.jsonb('scripts').notNullable().defaultTo('{}')
      table.jsonb('historyData').notNullable().defaultTo('{}')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // RENDERERS ---------------------------
    .createTable('renderers', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('module').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.jsonb('config').notNullable().defaultTo('{}')
    })
    // SETTINGS ----------------------------
    .createTable('settings', table => {
      table.string('key').notNullable().primary()
      table.jsonb('value')
    })
    // SITES -------------------------------
    .createTable('sites', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('hostname').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.jsonb('config').notNullable()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
    })
    // STORAGE -----------------------------
    .createTable('storage', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('module').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.jsonb('contentTypes')
      table.jsonb('assetDelivery')
      table.jsonb('versioning')
      table.jsonb('schedule')
      table.jsonb('config')
      table.jsonb('state')
    })
    // TAGS --------------------------------
    .createTable('tags', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('tag').notNullable()
      table.integer('usageCount').notNullable().defaultTo(0)
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // TREE --------------------------------
    .createTable('tree', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.specificType('folderPath', 'ltree').index().index('tree_folderpath_gist_idx', { indexType: 'GIST' })
      table.string('fileName').notNullable().index()
      table.string('hash').notNullable().index()
      table.enu('type', ['folder', 'page', 'asset']).notNullable().index()
      table.string('locale', 10).notNullable().defaultTo('en').index()
      table.string('title').notNullable()
      table.enum('navigationMode', ['inherit', 'override', 'overrideExact', 'hide', 'hideExact']).notNullable().defaultTo('inherit').index()
      table.uuid('navigationId').index()
      table.specificType('tags', 'text[]').index('tree_tags_idx', { indexType: 'GIN' })
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // USER AVATARS ------------------------
    .createTable('userAvatars', table => {
      table.uuid('id').notNullable().primary()
      table.binary('data').notNullable()
    })
    // USER EDITOR SETTINGS ----------------
    .createTable('userEditorSettings', table => {
      table.uuid('id').notNullable()
      table.string('editor').notNullable()
      table.jsonb('config').notNullable().defaultTo('{}')
      table.primary(['id', 'editor'])
    })
    // USER KEYS ---------------------------
    .createTable('userKeys', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('kind').notNullable()
      table.string('token').notNullable()
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.timestamp('validUntil').notNullable()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
    })
    // USERS -------------------------------
    .createTable('users', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('email').notNullable()
      table.string('name').notNullable()
      table.jsonb('auth').notNullable().defaultTo('{}')
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.jsonb('passkeys').notNullable().defaultTo('{}')
      table.jsonb('prefs').notNullable().defaultTo('{}')
      table.boolean('hasAvatar').notNullable().defaultTo(false)
      table.boolean('isSystem').notNullable().defaultTo(false)
      table.boolean('isActive').notNullable().defaultTo(false)
      table.boolean('isVerified').notNullable().defaultTo(false)
      table.timestamp('lastLoginAt').index()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // =====================================
    // RELATION TABLES
    // =====================================
    // USER GROUPS -------------------------
    .createTable('userGroups', table => {
      table.increments('id').primary()
      table.uuid('userId').references('id').inTable('users').onDelete('CASCADE')
      table.uuid('groupId').references('id').inTable('groups').onDelete('CASCADE')
    })
    // =====================================
    // REFERENCES
    // =====================================
    .table('activityLogs', table => {
      table.uuid('userId').notNullable().references('id').inTable('users')
    })
    .table('analytics', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
    })
    .table('assets', table => {
      table.uuid('authorId').notNullable().references('id').inTable('users')
      table.uuid('siteId').notNullable().references('id').inTable('sites').index()
    })
    .table('blocks', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
    })
    .table('commentProviders', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
    })
    .table('comments', table => {
      table.uuid('pageId').notNullable().references('id').inTable('pages').index()
      table.uuid('authorId').notNullable().references('id').inTable('users').index()
    })
    .table('navigation', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites').index()
    })
    .table('pageHistory', table => {
      table.uuid('authorId').notNullable().references('id').inTable('users')
      table.uuid('siteId').notNullable().references('id').inTable('sites').index()
    })
    .table('pageLinks', table => {
      table.uuid('pageId').notNullable().references('id').inTable('pages').onDelete('CASCADE')
      table.index(['path', 'locale'])
    })
    .table('pages', table => {
      table.uuid('authorId').notNullable().references('id').inTable('users').index()
      table.uuid('creatorId').notNullable().references('id').inTable('users').index()
      table.uuid('ownerId').notNullable().references('id').inTable('users').index()
      table.uuid('siteId').notNullable().references('id').inTable('sites').index()
    })
    .table('storage', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
    })
    .table('tags', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
      table.unique(['siteId', 'tag'])
    })
    .table('tree', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
    })
    .table('userKeys', table => {
      table.uuid('userId').notNullable().references('id').inTable('users')
    })
    // =====================================
    // TS WORD SUGGESTION TABLE
    // =====================================
    .createTable('autocomplete', table => {
      table.text('word')
    })
    .raw(`CREATE INDEX "autocomplete_idx" ON "autocomplete" USING GIN (word gin_trgm_ops)`)

  // =====================================
  // DEFAULT DATA
  // =====================================

  // -> GENERATE IDS

  const groupAdminId = uuid()
  const groupUserId = WIKI.data.systemIds.usersGroupId
  const groupGuestId = WIKI.data.systemIds.guestsGroupId
  const siteId = uuid()
  const authModuleId = WIKI.data.systemIds.localAuthId
  const userAdminId = uuid()
  const userGuestId = uuid()

  // -> SYSTEM CONFIG

  WIKI.logger.info('Generating certificates...')
  const secret = crypto.randomBytes(32).toString('hex')
  const certs = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: secret
    }
  })

  await knex('settings').insert([
    {
      key: 'auth',
      value: {
        audience: 'urn:wiki.js',
        tokenExpiration: '30m',
        tokenRenewal: '14d',
        certs: {
          jwk: pem2jwk(certs.publicKey),
          public: certs.publicKey,
          private: certs.privateKey
        },
        secret,
        rootAdminUserId: userAdminId,
        guestUserId: userGuestId
      }
    },
    {
      key: 'flags',
      value: {
        experimental: false,
        authDebug: false,
        sqlLog: false
      }
    },
    {
      key: 'icons',
      value: {
        fa: {
          isActive: true,
          config: {
            version: 6,
            license: 'free',
            token: ''
          }
        },
        la: {
          isActive: true
        }
      }
    },
    {
      key: 'mail',
      value: {
        senderName: '',
        senderEmail: '',
        host: '',
        port: 465,
        name: '',
        secure: true,
        verifySSL: true,
        user: '',
        pass: '',
        useDKIM: false,
        dkimDomainName: '',
        dkimKeySelector: '',
        dkimPrivateKey: ''
      }
    },
    {
      key: 'search',
      value: {
        termHighlighting: true,
        dictOverrides: {}
      }
    },
    {
      key: 'security',
      value: {
        corsConfig: '',
        corsMode: 'OFF',
        cspDirectives: '',
        disallowFloc: true,
        disallowIframe: true,
        disallowOpenRedirect: true,
        enforceCsp: false,
        enforceHsts: false,
        enforceSameOriginReferrerPolicy: true,
        forceAssetDownload: true,
        hstsDuration: 0,
        trustProxy: false,
        authJwtAudience: 'urn:wiki.js',
        authJwtExpiration: '30m',
        authJwtRenewablePeriod: '14d',
        uploadMaxFileSize: 10485760,
        uploadMaxFiles: 20,
        uploadScanSVG: true
      }
    },
    {
      key: 'update',
      value: {
        lastCheckedAt: null,
        version: WIKI.version,
        versionDate: WIKI.releaseDate
      }
    },
    {
      key: 'userDefaults',
      value: {
        timezone: 'America/New_York',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '12h'
      }
    }
  ])

  // -> DEFAULT SITE

  await knex('sites').insert({
    id: siteId,
    hostname: '*',
    isEnabled: true,
    config: {
      title: 'My Wiki Site',
      description: '',
      company: '',
      contentLicense: '',
      footerExtra: '',
      pageExtensions: ['md', 'html', 'txt'],
      pageCasing: true,
      discoverable: false,
      defaults: {
        tocDepth: {
          min: 1,
          max: 2
        }
      },
      features: {
        browse: true,
        ratings: false,
        ratingsMode: 'off',
        comments: false,
        contributions: false,
        profile: true,
        reasonForChange: 'required',
        search: true
      },
      logoText: true,
      sitemap: true,
      robots: {
        index: true,
        follow: true
      },
      authStrategies: [{ id: authModuleId, order: 0, isVisible: true }],
      locales: {
        primary: 'en',
        active: ['en']
      },
      assets: {
        logo: false,
        logoExt: 'svg',
        favicon: false,
        faviconExt: 'svg',
        loginBg: false
      },
      editors: {
        asciidoc: {
          isActive: true,
          config: {}
        },
        markdown: {
          isActive: true,
          config: {
            allowHTML: true,
            kroki: false,
            krokiServerUrl: 'https://kroki.io',
            latexEngine: 'katex',
            lineBreaks: true,
            linkify: true,
            multimdTable: true,
            plantuml: false,
            plantumlServerUrl: 'https://www.plantuml.com/plantuml/',
            quotes: 'english',
            tabWidth: 2,
            typographer: false,
            underline: true
          }
        },
        wysiwyg: {
          isActive: true,
          config: {}
        }
      },
      theme: {
        dark: false,
        codeBlocksTheme: 'github-dark',
        colorPrimary: '#1976D2',
        colorSecondary: '#02C39A',
        colorAccent: '#FF9800',
        colorHeader: '#000000',
        colorSidebar: '#1976D2',
        injectCSS: '',
        injectHead: '',
        injectBody: '',
        contentWidth: 'full',
        sidebarPosition: 'left',
        tocPosition: 'right',
        showSharingMenu: true,
        showPrintBtn: true,
        baseFont: 'roboto',
        contentFont: 'roboto'
      },
      uploads: {
        conflictBehavior: 'overwrite',
        normalizeFilename: true
      }
    }
  })

  // -> DEFAULT GROUPS

  await knex('groups').insert([
    {
      id: groupAdminId,
      name: 'Administrators',
      permissions: JSON.stringify(['manage:system']),
      rules: JSON.stringify([]),
      isSystem: true
    },
    {
      id: groupUserId,
      name: 'Users',
      permissions: JSON.stringify(['read:pages', 'read:assets', 'read:comments']),
      rules: JSON.stringify([
        {
          id: uuid(),
          name: 'Default Rule',
          roles: ['read:pages', 'read:assets', 'read:comments'],
          match: 'START',
          mode: 'ALLOW',
          path: '',
          locales: [],
          sites: []
        }
      ]),
      isSystem: true
    },
    {
      id: groupGuestId,
      name: 'Guests',
      permissions: JSON.stringify(['read:pages', 'read:assets', 'read:comments']),
      rules: JSON.stringify([
        {
          id: uuid(),
          name: 'Default Rule',
          roles: ['read:pages', 'read:assets', 'read:comments'],
          match: 'START',
          mode: 'DENY',
          path: '',
          locales: [],
          sites: []
        }
      ]),
      isSystem: true
    }
  ])

  // -> AUTHENTICATION MODULE

  await knex('authentication').insert({
    id: authModuleId,
    module: 'local',
    isEnabled: true,
    displayName: 'Local Authentication',
    config: JSON.stringify({
      emailValidation: true,
      enforceTfa: false
    })
  })

  // -> USERS

  await knex('users').insert([
    {
      id: userAdminId,
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      auth: {
        [authModuleId]: {
          password: await bcrypt.hash(process.env.ADMIN_PASS || '12345678', 12),
          mustChangePwd: !process.env.ADMIN_PASS,
          restrictLogin: false,
          tfaIsActive: false,
          tfaRequired: false,
          tfaSecret: ''
        }
      },
      name: 'Administrator',
      isSystem: false,
      isActive: true,
      isVerified: true,
      meta: {
        location: '',
        jobTitle: '',
        pronouns: ''
      },
      prefs: {
        timezone: 'America/New_York',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '12h',
        appearance: 'site',
        cvd: 'none'
      }
    },
    {
      id: userGuestId,
      email: 'guest@example.com',
      auth: {},
      name: 'Guest',
      isSystem: true,
      isActive: true,
      isVerified: true,
      meta: {},
      prefs: {
        timezone: 'America/New_York',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '12h',
        appearance: 'site',
        cvd: 'none'
      }
    }
  ])

  await knex('userGroups').insert([
    {
      userId: userAdminId,
      groupId: groupAdminId
    },
    {
      userId: userAdminId,
      groupId: groupUserId
    },
    {
      userId: userGuestId,
      groupId: groupGuestId
    }
  ])

  // -> BLOCKS

  await knex('blocks').insert({
    block: 'index',
    name: 'Index',
    description: 'Show a list of pages matching a path or set of tags.',
    icon: 'rules',
    isCustom: false,
    isEnabled: true,
    config: {},
    siteId: siteId
  })

  // -> NAVIGATION

  await knex('navigation').insert({
    id: siteId,
    items: JSON.stringify([
      {
        id: uuid(),
        type: 'header',
        label: 'Sample Header',
        visibilityGroups: []
      },
      {
        id: uuid(),
        type: 'link',
        icon: 'mdi-file-document-outline',
        label: 'Sample Link 1',
        target: '/',
        openInNewWindow: false,
        visibilityGroups: [],
        children: []
      },
      {
        id: uuid(),
        type: 'link',
        icon: 'mdi-book-open-variant',
        label: 'Sample Link 2',
        target: '/',
        openInNewWindow: false,
        visibilityGroups: [],
        children: []
      },
      {
        id: uuid(),
        type: 'separator',
        visibilityGroups: []
      },
      {
        id: uuid(),
        type: 'link',
        icon: 'mdi-airballoon',
        label: 'Sample Link 3',
        target: '/',
        openInNewWindow: false,
        visibilityGroups: [],
        children: []
      }
    ]),
    siteId: siteId
  })

  // -> STORAGE MODULE

  await knex('storage').insert({
    module: 'db',
    siteId,
    isEnabled: true,
    contentTypes: {
      activeTypes: ['pages', 'images', 'documents', 'others', 'large'],
      largeThreshold: '5MB'
    },
    assetDelivery: {
      streaming: true,
      directAccess: false
    },
    versioning: {
      enabled: false
    },
    state: {
      current: 'ok'
    }
  })

  // -> SCHEDULED JOBS

  await knex('jobSchedule').insert([
    {
      task: 'checkVersion',
      cron: '0 0 * * *',
      type: 'system'
    },
    {
      task: 'cleanJobHistory',
      cron: '5 0 * * *',
      type: 'system'
    },
    // {
    //   task: 'refreshAutocomplete',
    //   cron: '0 */6 * * *',
    //   type: 'system'
    // },
    {
      task: 'updateLocales',
      cron: '0 0 * * *',
      type: 'system'
    }
  ])

  await knex('jobLock').insert({
    key: 'cron',
    lastCheckedBy: 'init',
    lastCheckedAt: DateTime.utc().minus({ hours: 1 }).toISO()
  })

  WIKI.logger.info('Completed 3.0.0 database migration.')
}

export function down (knex) { }
