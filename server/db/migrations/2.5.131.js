exports.up = async knex => {
  // Step 1: Insert a default site if it doesn't already exist
  await knex('sites')
    .insert({
      name: 'Default Site',
      path: 'default',
      isEnabled: true,
      config: JSON.stringify({})
    })

  const defaultSite = await knex('sites').where('path', 'default').first('id')

  // Check if defaultSite.id is valid before proceeding
  if (!defaultSite || !defaultSite.id) {
    throw new Error('Failed to insert default site and retrieve ID')
  }

  // Step 2: Update existing records if 'siteId' is NULL
  await knex('assetFolders').whereNull('siteId').update({ siteId: defaultSite.id })
  await knex('assets').whereNull('siteId').update({ siteId: defaultSite.id })
  await knex('pageHistory').whereNull('siteId').update({ siteId: defaultSite.id })
  await knex('pages').whereNull('siteId').update({ siteId: defaultSite.id })
  await knex('tags').whereNull('siteId').update({ siteId: defaultSite.id })
  await knex('pageTree').whereNull('siteId').update({ siteId: defaultSite.id })

  // Step 4: Alter tables to make 'siteId' NOT NULL
  await knex.schema
    .table('assetFolders', table => {
      table.uuid('siteId').notNullable().alter()
    })
    .table('assets', table => {
      table.uuid('siteId').notNullable().alter()
    })
    .table('pageHistory', table => {
      table.uuid('siteId').notNullable().alter()
    })
    .table('pages', table => {
      table.uuid('siteId').notNullable().alter()
    })
    .table('tags', table => {
      table.uuid('siteId').notNullable().alter()
    })
    .table('pageTree', table => {
      table.uuid('siteId').notNullable().alter()
    })
}

exports.down = knex => { }
