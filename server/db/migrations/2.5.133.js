/* global WIKI */

exports.up = async knex => {
  await knex.schema.alterTable('pageTree', table => {
    table.dropForeign('parent') // Replace `pageTree_id` with the actual column referencing `pageTree.id`
  })

  // Step 1: Drop the existing primary key on `id`
  await knex.schema.alterTable('pageTree', table => {
    table.dropPrimary()
  })

  // Step 2: Add a unique constraint on the combination of `id` and `siteId`
  await knex.schema.alterTable('pageTree', table => {
    table.unique(['id', 'siteId'], 'pageTree_id_siteId_unique')
  })

  await knex.schema.alterTable('pageTree', table => {
    table.foreign(['parent', 'siteId']).references(['id', 'siteId']).inTable('pageTree').onDelete('CASCADE')
  })
}

exports.down = async knex => {
}
