exports.up = knex => {
  return knex.schema
    .alterTable('pageTree', table => {
      table.json('ancestors')
    })
}

exports.down = knex => { }
