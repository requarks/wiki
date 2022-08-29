const { v4: uuid } = require('uuid')
const bcrypt = require('bcryptjs-then')
const crypto = require('crypto')
const pem2jwk = require('pem-jwk').pem2jwk

/* global WIKI */

exports.up = async knex => {
  WIKI.logger.info('Running 3.0.0 database migration...')

  // =====================================
  // PG EXTENSIONS
  // =====================================
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto;')

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
      table.string('filename').notNullable()
      table.string('hash').notNullable().index()
      table.string('ext').notNullable()
      table.enum('kind', ['binary', 'image']).notNullable().defaultTo('binary')
      table.string('mime').notNullable().defaultTo('application/octet-stream')
      table.integer('fileSize').unsigned().comment('In kilobytes')
      table.jsonb('metadata')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // ASSET DATA --------------------------
    .createTable('assetData', table => {
      table.uuid('id').notNullable().index()
      table.binary('data').notNullable()
    })
    // ASSET FOLDERS -----------------------
    .createTable('assetFolders', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('name').notNullable()
      table.string('slug').notNullable()
    })
    // AUTHENTICATION ----------------------
    .createTable('authentication', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('module').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.string('displayName').notNullable().defaultTo('')
      table.jsonb('config').notNullable().defaultTo('{}')
      table.boolean('selfRegistration').notNullable().defaultTo(false)
      table.jsonb('domainWhitelist').notNullable().defaultTo('[]')
      table.jsonb('autoEnrollGroups').notNullable().defaultTo('[]')
    })
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
    // LOCALES -----------------------------
    .createTable('locales', table => {
      table.string('code', 5).notNullable().primary()
      table.jsonb('strings')
      table.boolean('isRTL').notNullable().defaultTo(false)
      table.string('name').notNullable()
      table.string('nativeName').notNullable()
      table.integer('availability').notNullable().defaultTo(0)
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // NAVIGATION ----------------------------
    .createTable('navigation', table => {
      table.string('key').notNullable().primary()
      table.jsonb('config')
    })
    // PAGE HISTORY ------------------------
    .createTable('pageHistory', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('pageId').notNullable().index()
      table.string('path').notNullable()
      table.string('hash').notNullable()
      table.string('title').notNullable()
      table.string('description')
      table.enu('publishState', ['draft', 'published', 'scheduled']).notNullable().defaultTo('draft')
      table.timestamp('publishStartDate')
      table.timestamp('publishEndDate')
      table.string('action').defaultTo('updated')
      table.text('content')
      table.string('editor').notNullable()
      table.string('contentType').notNullable()
      table.jsonb('extra').notNullable().defaultTo('{}')
      table.jsonb('tags').defaultTo('[]')
      table.timestamp('versionDate').notNullable().defaultTo(knex.fn.now())
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
    })
    // PAGE LINKS --------------------------
    .createTable('pageLinks', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('localeCode', 5).notNullable()
    })
    // PAGES -------------------------------
    .createTable('pages', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('slug')
      table.string('path').notNullable()
      table.string('hash').notNullable()
      table.string('title').notNullable()
      table.string('description')
      table.enu('publishState', ['draft', 'published', 'scheduled']).notNullable().defaultTo('draft')
      table.timestamp('publishStartDate')
      table.timestamp('publishEndDate')
      table.text('content')
      table.text('render')
      table.jsonb('toc')
      table.string('editor').notNullable()
      table.string('contentType').notNullable()
      table.jsonb('extra').notNullable().defaultTo('{}')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // PAGE TREE ---------------------------
    .createTable('pageTree', table => {
      table.integer('id').unsigned().primary()
      table.string('path').notNullable()
      table.integer('depth').unsigned().notNullable()
      table.string('title').notNullable()
      table.boolean('isFolder').notNullable().defaultTo(false)
      table.jsonb('ancestors')
    })
    // RENDERERS ---------------------------
    .createTable('renderers', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('module').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.jsonb('config')
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
      table.jsonb('display').notNullable().defaultTo('{}')
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    // USER AVATARS ------------------------
    .createTable('userAvatars', table => {
      table.uuid('id').notNullable().primary()
      table.binary('data').notNullable()
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
      table.jsonb('prefs').notNullable().defaultTo('{}')
      table.string('pictureUrl')
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
    // PAGE TAGS ---------------------------
    .createTable('pageTags', table => {
      table.increments('id').primary()
      table.uuid('pageId').references('id').inTable('pages').onDelete('CASCADE')
      table.uuid('tagId').references('id').inTable('tags').onDelete('CASCADE')
    })
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
      table.uuid('folderId').notNullable().references('id').inTable('assetFolders').index()
      table.uuid('authorId').notNullable().references('id').inTable('users')
      table.uuid('siteId').notNullable().references('id').inTable('sites').index()
    })
    .table('assetFolders', table => {
      table.uuid('parentId').references('id').inTable('assetFolders').index()
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
      table.string('localeCode', 5).references('code').inTable('locales')
      table.uuid('authorId').notNullable().references('id').inTable('users')
      table.uuid('siteId').notNullable().references('id').inTable('sites').index()
    })
    .table('pageLinks', table => {
      table.uuid('pageId').notNullable().references('id').inTable('pages').onDelete('CASCADE')
      table.index(['path', 'localeCode'])
    })
    .table('pages', table => {
      table.string('localeCode', 5).references('code').inTable('locales').index()
      table.uuid('authorId').notNullable().references('id').inTable('users').index()
      table.uuid('creatorId').notNullable().references('id').inTable('users').index()
      table.uuid('siteId').notNullable().references('id').inTable('sites').index()
    })
    .table('pageTree', table => {
      table.integer('parent').unsigned().references('id').inTable('pageTree').onDelete('CASCADE')
      table.uuid('pageId').notNullable().references('id').inTable('pages').onDelete('CASCADE')
      table.string('localeCode', 5).references('code').inTable('locales')
    })
    .table('renderers', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
    })
    .table('storage', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
    })
    .table('tags', table => {
      table.uuid('siteId').notNullable().references('id').inTable('sites')
      table.unique(['siteId', 'tag'])
    })
    .table('userKeys', table => {
      table.uuid('userId').notNullable().references('id').inTable('users')
    })
    .table('users', table => {
      table.string('localeCode', 5).references('code').inTable('locales').notNullable().defaultTo('en')
    })

  // =====================================
  // DEFAULT DATA
  // =====================================

  // -> GENERATE IDS

  const groupAdminId = uuid()
  const groupGuestId = '10000000-0000-4000-8000-000000000001'
  const siteId = uuid()
  const authModuleId = uuid()
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
        locales: true
      }
    }
  ])

  // -> DEFAULT LOCALE

  await knex('locales').insert({
    code: 'en',
    strings: {},
    isRTL: false,
    name: 'English',
    nativeName: 'English'
  })

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
      defaults: {
        timezone: 'America/New_York',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '12h'
      },
      features: {
        ratings: false,
        ratingsMode: 'off',
        comments: false,
        contributions: false,
        profile: true,
        search: true
      },
      logoText: true,
      sitemap: true,
      robots: {
        index: true,
        follow: true
      },
      authStrategies: [{ id: authModuleId, order: 0, isVisible: true }],
      locale: 'en',
      localeNamespacing: false,
      localeNamespaces: [],
      theme: {
        dark: false,
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
    displayName: 'Local Authentication'
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
        darkMode: false
      },
      localeCode: 'en'
    },
    {
      id: userGuestId,
      email: 'guest@example.com',
      name: 'Guest',
      isSystem: true,
      isActive: true,
      isVerified: true,
      localeCode: 'en'
    }
  ])

  await knex('userGroups').insert([
    {
      userId: userAdminId,
      groupId: groupAdminId
    },
    {
      userId: userGuestId,
      groupId: groupGuestId
    }
  ])

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

  WIKI.logger.info('Completed 3.0.0 database migration.')
}

exports.down = knex => { }
