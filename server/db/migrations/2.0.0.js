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
    // COMMENTS ----------------------------
    .createTable('comments', table => {
      table.increments('id').primary()
      table.text('content').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
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
    // PAGES -------------------------------
    .createTable('pages', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('title').notNullable()
      table.string('description')
      table.boolean('isPublished').notNullable().defaultTo(false)
      table.string('publishStartDate')
      table.string('publishEndDate')
      table.text('content')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // SETTINGS ----------------------------
    .createTable('settings', table => {
      table.increments('id').primary()
      table.string('key').notNullable().unique()
      table.jsonb('value')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
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
      table.string('provider').notNullable().defaultTo('local')
      table.string('providerId')
      table.string('password')
      table.boolean('tfaIsActive').notNullable().defaultTo(false)
      table.string('tfaSecret')
      table.enum('role', ['admin', 'guest', 'user']).notNullable().defaultTo('guest')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()

      table.unique(['provider', 'email'])
    })
    // =====================================
    // RELATION TABLES
    // =====================================
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
    .table('pages', table => {
      table.string('locale', 2).references('code').inTable('locales')
      table.integer('authorId').unsigned().references('id').inTable('users')
    })
    .table('users', table => {
      table.string('locale', 2).references('code').inTable('locales')
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
