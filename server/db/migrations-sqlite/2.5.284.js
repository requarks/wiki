exports.up = async knex => {
  await knex.schema
    .alterTable('pages', table => {
      table.json('tocOptions').notNullable().defaultTo(JSON.stringify({
        min: 1,
        max: 2,
        useDefault: true
      }))
    })
}

exports.down = knex => { }
