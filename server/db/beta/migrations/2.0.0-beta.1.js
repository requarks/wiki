/* global WIKI */

exports.up = knex => {
  const dbCompat = {
    charset: (WIKI.config.db.type === `mysql` || WIKI.config.db.type === `mariadb`)
  }
  return knex.schema
    // =====================================
    // MODEL TABLES
    // =====================================
    // ASSETS ------------------------------
    .createTable('assets', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('filename').notNullable()
      table.string('basename').notNullable()
      table.string('ext').notNullable()
      table.enum('kind', ['binary', 'image']).notNullable().defaultTo('binary')
      table.string('mime').notNullable().defaultTo('application/octet-stream')
      table.integer('fileSize').unsigned().comment('In kilobytes')
      table.json('metadata')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // ASSET FOLDERS -----------------------
    .createTable('assetFolders', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('slug').notNullable()
      table.integer('parentId').unsigned().references('id').inTable('assetFolders')
    })
    // AUTHENTICATION ----------------------
    .createTable('authentication', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('key').notNullable().primary()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.json('config').notNullable()
      table.boolean('selfRegistration').notNullable().defaultTo(false)
      table.json('domainWhitelist').notNullable()
      table.json('autoEnrollGroups').notNullable()
    })
    // COMMENTS ----------------------------
    .createTable('comments', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.text('content').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // EDITORS -----------------------------
    .createTable('editors', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('key').notNullable().primary()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.json('config').notNullable()
    })
    // GROUPS ------------------------------
    .createTable('groups', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('name').notNullable()
      table.json('permissions').notNullable()
      table.json('pageRules').notNullable()
      table.boolean('isSystem').notNullable().defaultTo(false)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // LOCALES -----------------------------
    .createTable('locales', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('code', 2).notNullable().primary()
      table.json('strings')
      table.boolean('isRTL').notNullable().defaultTo(false)
      table.string('name').notNullable()
      table.string('nativeName').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // LOGGING ----------------------------
    .createTable('loggers', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('key').notNullable().primary()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.string('level').notNullable().defaultTo('warn')
      table.json('config')
    })
    // NAVIGATION ----------------------------
    .createTable('navigation', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('key').notNullable().primary()
      table.json('config')
    })
    // PAGE HISTORY ------------------------
    .createTable('pageHistory', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('hash').notNullable()
      table.string('title').notNullable()
      table.string('description')
      table.boolean('isPrivate').notNullable().defaultTo(false)
      table.boolean('isPublished').notNullable().defaultTo(false)
      table.string('publishStartDate')
      table.string('publishEndDate')
      table.text('content')
      table.string('contentType').notNullable()
      table.string('createdAt').notNullable()
    })
    // PAGES -------------------------------
    .createTable('pages', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('hash').notNullable()
      table.string('title').notNullable()
      table.string('description')
      table.boolean('isPrivate').notNullable().defaultTo(false)
      table.boolean('isPublished').notNullable().defaultTo(false)
      table.string('privateNS')
      table.string('publishStartDate')
      table.string('publishEndDate')
      table.text('content')
      table.text('render')
      table.json('toc')
      table.string('contentType').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // PAGE TREE ---------------------------
    .createTable('pageTree', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('path').notNullable()
      table.integer('depth').unsigned().notNullable()
      table.string('title').notNullable()
      table.boolean('isPrivate').notNullable().defaultTo(false)
      table.boolean('isFolder').notNullable().defaultTo(false)
      table.string('privateNS')
    })
    // RENDERERS ---------------------------
    .createTable('renderers', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('key').notNullable().primary()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.json('config')
    })
    // SEARCH ------------------------------
    .createTable('searchEngines', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('key').notNullable().primary()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.json('config')
    })
    // SETTINGS ----------------------------
    .createTable('settings', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('key').notNullable().primary()
      table.json('value')
      table.string('updatedAt').notNullable()
    })
    // STORAGE -----------------------------
    .createTable('storage', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.string('key').notNullable().primary()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.string('mode', ['sync', 'push', 'pull']).notNullable().defaultTo('push')
      table.json('config')
    })
    // TAGS --------------------------------
    .createTable('tags', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('tag').notNullable().unique()
      table.string('title')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // USER KEYS ---------------------------
    .createTable('userKeys', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('kind').notNullable()
      table.string('token').notNullable()
      table.string('createdAt').notNullable()
      table.string('validUntil').notNullable()
    })
    // USERS -------------------------------
    .createTable('users', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.string('email').notNullable()
      table.string('name').notNullable()
      table.string('providerId')
      table.string('password')
      table.boolean('tfaIsActive').notNullable().defaultTo(false)
      table.string('tfaSecret')
      table.string('jobTitle').defaultTo('')
      table.string('location').defaultTo('')
      table.string('pictureUrl')
      table.string('timezone').notNullable().defaultTo('America/New_York')
      table.boolean('isSystem').notNullable().defaultTo(false)
      table.boolean('isActive').notNullable().defaultTo(false)
      table.boolean('isVerified').notNullable().defaultTo(false)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // =====================================
    // RELATION TABLES
    // =====================================
    // PAGE HISTORY TAGS ---------------------------
    .createTable('pageHistoryTags', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.integer('pageId').unsigned().references('id').inTable('pageHistory').onDelete('CASCADE')
      table.integer('tagId').unsigned().references('id').inTable('tags').onDelete('CASCADE')
    })
    // PAGE TAGS ---------------------------
    .createTable('pageTags', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
      table.integer('tagId').unsigned().references('id').inTable('tags').onDelete('CASCADE')
    })
    // USER GROUPS -------------------------
    .createTable('userGroups', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.integer('userId').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('groupId').unsigned().references('id').inTable('groups').onDelete('CASCADE')
    })
    // =====================================
    // REFERENCES
    // =====================================
    .table('assets', table => {
      table.integer('folderId').unsigned().references('id').inTable('assetFolders')
      table.integer('authorId').unsigned().references('id').inTable('users')
    })
    .table('comments', table => {
      table.integer('pageId').unsigned().references('id').inTable('pages')
      table.integer('authorId').unsigned().references('id').inTable('users')
    })
    .table('pageHistory', table => {
      table.integer('pageId').unsigned().references('id').inTable('pages')
      table.string('editorKey').references('key').inTable('editors')
      table.string('localeCode', 2).references('code').inTable('locales')
      table.integer('authorId').unsigned().references('id').inTable('users')
    })
    .table('pages', table => {
      table.string('editorKey').references('key').inTable('editors')
      table.string('localeCode', 2).references('code').inTable('locales')
      table.integer('authorId').unsigned().references('id').inTable('users')
      table.integer('creatorId').unsigned().references('id').inTable('users')
    })
    .table('pageTree', table => {
      table.integer('parent').unsigned().references('id').inTable('pageTree')
      table.integer('pageId').unsigned().references('id').inTable('pages')
      table.string('localeCode', 2).references('code').inTable('locales')
    })
    .table('userKeys', table => {
      table.integer('userId').unsigned().references('id').inTable('users')
    })
    .table('users', table => {
      table.string('providerKey').references('key').inTable('authentication').notNullable().defaultTo('local')
      table.string('localeCode', 2).references('code').inTable('locales').notNullable().defaultTo('en')
      table.string('defaultEditor').references('key').inTable('editors').notNullable().defaultTo('markdown')

      table.unique(['providerKey', 'email'])
    })
}

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('userGroups')
    .dropTableIfExists('pageHistoryTags')
    .dropTableIfExists('pageHistory')
    .dropTableIfExists('pageTags')
    .dropTableIfExists('assets')
    .dropTableIfExists('assetFolders')
    .dropTableIfExists('comments')
    .dropTableIfExists('editors')
    .dropTableIfExists('groups')
    .dropTableIfExists('locales')
    .dropTableIfExists('navigation')
    .dropTableIfExists('pages')
    .dropTableIfExists('renderers')
    .dropTableIfExists('settings')
    .dropTableIfExists('storage')
    .dropTableIfExists('tags')
    .dropTableIfExists('userKeys')
    .dropTableIfExists('users')
}
