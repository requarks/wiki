exports.up = async knex => {
  await knex.schema.alterTable('comments', table => {
    table.boolean('notificationSent').notNullable().defaultTo(false)
  })
}

exports.down = knex => {
}
