exports.up = async knex => {
  return knex.schema
    .table('assetFolders', table => {
      table.uuid('siteId').references('id').inTable('sites').index()
    })
    .table('assets', table => {
      table.uuid('siteId').references('id').inTable('sites').index()
    })
    .table('pageHistory', table => {
      table.uuid('siteId').references('id').inTable('sites').index()
    })
    .table('pages', table => {
      table.uuid('siteId').references('id').inTable('sites').index() // .alter()
    })
    .table('tags', table => {
      table.uuid('siteId').references('id').inTable('sites')
      table.unique(['siteId', 'tag'])
    })
    .table('pageTree', table => {
      table.uuid('siteId').references('id').inTable('sites').index()
    })
}

exports.down = knex => { }
