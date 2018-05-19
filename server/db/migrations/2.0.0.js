exports.up = knex => {
  return knex.schema
    // -------------------------------------
    // GROUPS
    // -------------------------------------
    .createTable('groups', table => {
      table.increments('id').primary()

      table.string('name').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // -------------------------------------
    // LOCALES
    // -------------------------------------
    .createTable('locales', table => {
      table.increments('id').primary()

      table.string('code', 2).notNullable().unique()
      table.json('strings')
      table.boolean('isRTL').notNullable().defaultTo(false)
      table.string('name').notNullable()
      table.string('nativeName').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // -------------------------------------
    // SETTINGS
    // -------------------------------------
    .createTable('settings', table => {
      table.increments('id').primary()

      table.string('key').notNullable().unique()
      table.json('value')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    // -------------------------------------
    // USERS
    // -------------------------------------
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
    // -------------------------------------
    // USER GROUPS
    // -------------------------------------
    .createTable('userGroups', table => {
      table.increments('id').primary()

      table.integer('userId').unsigned().references('id').inTable('users')
      table.integer('groupId').unsigned().references('id').inTable('groups')
    })
}

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('userGroups')
    .dropTableIfExists('groups')
    .dropTableIfExists('locales')
    .dropTableIfExists('settings')
    .dropTableIfExists('users')
}
