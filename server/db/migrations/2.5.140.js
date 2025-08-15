exports.up = knex => {
  return knex.schema.alterTable('userSiteInactivity', table => {
    table.unique(['userId', 'siteId'])
  })
}

exports.down = knex => { }
