exports.up = async knex => {
  return knex.schema
    .createTable('followers', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('siteId').notNullable()
      table.integer('pageId')
      table.integer('userId').notNullable()
      table.unique(['siteId', 'pageId', 'userId'], 'followers_site_page_user_unique')
      table.foreign('siteId').references('id').inTable('sites').onDelete('CASCADE')
      table.foreign('pageId').references('id').inTable('pages').onDelete('CASCADE')
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE')
    })
}

exports.down = knex => { }
