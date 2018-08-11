exports.up = knex => {
  return knex.schema
    // =====================================
    // MODEL TABLES
    // =====================================
    // ASSETS ------------------------------
    .createTable('assets', table => {
      table.increments('id').primary()
      table.string('filename').notNullable()
      table.string('basename').notNullable()
      table.string('ext').notNullable()
      table.enum('kind', ['binary', 'image']).notNullable().defaultTo('binary')
      table.string('mime').notNullable().defaultTo('application/octet-stream')
      table.integer('fileSize').unsigned().comment('In kilobytes')
      table.jsonb('metadata')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // ASSET FOLDERS -----------------------
    .createTable('assetFolders', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('slug').notNullable()
      table.integer('parentId').unsigned().references('id').inTable('assetFolders')
    })
    // AUTHENTICATION ----------------------
    .createTable('authentication', table => {
      table.increments('id').primary()
      table.string('key').notNullable().unique()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.jsonb('config').notNullable()
      table.boolean('selfRegistration').notNullable().defaultTo(false)
      table.jsonb('domainWhitelist').notNullable()
      table.jsonb('autoEnrollGroups').notNullable()
    })
    // COMMENTS ----------------------------
    .createTable('comments', table => {
      table.increments('id').primary()
      table.text('content').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // EDITORS -----------------------------
    .createTable('editors', table => {
      table.increments('id').primary()
      table.string('key').notNullable().unique()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.jsonb('config').notNullable()
    })
    // GROUPS ------------------------------
    .createTable('groups', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // LOCALES -----------------------------
    .createTable('locales', table => {
      table.increments('id').primary()
      table.string('code', 2).notNullable().unique()
      table.jsonb('strings')
      table.boolean('isRTL').notNullable().defaultTo(false)
      table.string('name').notNullable()
      table.string('nativeName').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // PAGE HISTORY ------------------------
    .createTable('pageHistory', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
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
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('title').notNullable()
      table.string('description')
      table.boolean('isPrivate').notNullable().defaultTo(false)
      table.boolean('isPublished').notNullable().defaultTo(false)
      table.string('publishStartDate')
      table.string('publishEndDate')
      table.text('content')
      table.text('render')
      table.string('contentType').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // SETTINGS ----------------------------
    .createTable('settings', table => {
      table.increments('id').primary()
      table.string('key').notNullable().unique()
      table.jsonb('value')
      table.string('updatedAt').notNullable()
    })
    // STORAGE -----------------------------
    .createTable('storage', table => {
      table.increments('id').primary()
      table.string('key').notNullable().unique()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.enum('mode', ['sync', 'push', 'pull']).notNullable().defaultTo('push')
      table.jsonb('config')
    })
    // TAGS --------------------------------
    .createTable('tags', table => {
      table.increments('id').primary()
      table.string('tag').notNullable().unique()
      table.string('title')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // USERS -------------------------------
    .createTable('users', table => {
      table.increments('id').primary()
      table.string('email').notNullable()
      table.string('name').notNullable()
      table.string('providerId')
      table.string('password')
      table.boolean('tfaIsActive').notNullable().defaultTo(false)
      table.string('tfaSecret')
      table.enum('role', ['admin', 'guest', 'user']).notNullable().defaultTo('guest')
      table.string('jobTitle').defaultTo('')
      table.string('location').defaultTo('')
      table.string('pictureUrl')
      table.string('timezone').notNullable().defaultTo('America/New_York')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // =====================================
    // RELATION TABLES
    // =====================================
    // PAGE HISTORY TAGS ---------------------------
    .createTable('pageHistoryTags', table => {
      table.increments('id').primary()
      table.integer('pageId').unsigned().references('id').inTable('pageHistory').onDelete('CASCADE')
      table.integer('tagId').unsigned().references('id').inTable('tags').onDelete('CASCADE')
    })
    // PAGE TAGS ---------------------------
    .createTable('pageTags', table => {
      table.increments('id').primary()
      table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
      table.integer('tagId').unsigned().references('id').inTable('tags').onDelete('CASCADE')
    })
    // USER GROUPS -------------------------
    .createTable('userGroups', table => {
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
    .dropTableIfExists('pageTags')
    .dropTableIfExists('assets')
    .dropTableIfExists('assetFolders')
    .dropTableIfExists('comments')
    .dropTableIfExists('groups')
    .dropTableIfExists('locales')
    .dropTableIfExists('pages')
    .dropTableIfExists('settings')
    .dropTableIfExists('tags')
    .dropTableIfExists('users')
}
