exports.up = knex => {
  // USERS INACTIVITY --------------------------
  return knex.schema
    .createTable('userSiteInactivity', table => {
      table.increments('id').primary()
      table.integer('userId').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('siteId').references('id').inTable('sites').index().onDelete('CASCADE')
      table.timestamp('inactiveSince').defaultTo(knex.fn.now())
    })
}

exports.down = knex => { }
